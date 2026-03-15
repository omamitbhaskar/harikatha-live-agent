"""
Harikatha Live Agent — FastAPI Backend
WebSocket proxy: Browser ↔ Backend ↔ Gemini Live API
Handles auth, tool calls (search_harikatha), and audio segment serving.
"""

import asyncio
import json
import logging
import os
import base64
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from google.cloud import firestore
from google import genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("harikatha")

# ── Config ────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GCP_PROJECT = os.environ.get("GCP_PROJECT", "harikatha-live-agent")
GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"
EMBEDDING_MODEL = "models/gemini-embedding-001"
FIRESTORE_COLLECTION = "harikatha_segments"
QA_COLLECTION = "harikatha_qa"
QUERY_LOGS_COLLECTION = "query_logs"

# Admin auth — set these env vars locally and on Cloud Run
ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "")  # MUST be set — empty = admin disabled

# GCS base URL for audio files
GCS_AUDIO_BASE = os.environ.get(
    "GCS_AUDIO_BASE",
    f"https://storage.googleapis.com/{GCP_PROJECT}-corpus"
)

# ── Firestore + GenAI clients ────────────────────────────────────────
db = None
genai_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, genai_client
    db = firestore.Client(project=GCP_PROJECT)
    genai_client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else genai.Client()
    logger.info("✅ Firestore + GenAI clients ready")
    yield
    logger.info("Shutting down")


app = FastAPI(title="Harikatha Live Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static frontend ──────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# ── Admin auth (HTTP Basic) ─────────────────────────────────────────
security = HTTPBasic()


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    """
    Protect /admin and /api/logs with HTTP Basic auth.
    Browser shows a native username/password popup.
    Credentials come from ADMIN_USER and ADMIN_PASS env vars.
    """
    if not ADMIN_PASS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access disabled — set ADMIN_PASS environment variable",
        )
    import secrets
    correct_user = secrets.compare_digest(credentials.username, ADMIN_USER)
    correct_pass = secrets.compare_digest(credentials.password, ADMIN_PASS)
    if not (correct_user and correct_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ── Utility: embed query ─────────────────────────────────────────────
def embed_query(text: str) -> list[float]:
    """Generate embedding for a search query."""
    result = genai_client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config={"task_type": "RETRIEVAL_QUERY"},
    )
    return result.embeddings[0].values


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ── Audio file URL — Cloud Storage (production) or /static/ (local dev) ──
# Set MEDIA_BASE_URL env var to your GCS bucket URL for production.
# Locally, it falls back to /static/ (served from frontend/ folder).
MEDIA_BASE_URL = os.environ.get(
    "MEDIA_BASE_URL",
    "/static"  # Local fallback: files served from frontend/ via StaticFiles
)
DEFAULT_AUDIO_URL = f"{MEDIA_BASE_URL}/we_are_the_cause_of_our_problems.mp3"


def parse_time_to_seconds(time_str: str) -> int:
    """Parse '1:07' or '0:51 - 1:03' into seconds. Returns start seconds."""
    if not time_str:
        return 0
    # Handle ranges like '0:51 - 1:03' — take the first part
    time_str = time_str.split("-")[0].strip()
    parts = time_str.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return int(parts[0])
    except ValueError:
        return 0


def parse_end_time_to_seconds(time_str: str) -> int:
    """Parse the END time from a range like '0:51 - 1:03'. Returns end seconds."""
    if not time_str:
        return 0
    # If there's a dash, take the second part; otherwise treat as end time itself
    if "-" in time_str:
        end_str = time_str.split("-")[-1].strip()
    else:
        end_str = time_str.strip()
    parts = end_str.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return int(parts[0])
    except ValueError:
        return 0


# ── Search harikatha corpus ──────────────────────────────────────────
def search_harikatha(query: str, top_k: int = 3) -> list[dict]:
    """
    Vector search across Firestore harikatha segments.
    Returns top_k matches with score, transcript, timestamps, audio_url.
    """
    query_embedding = embed_query(query)

    # Search QA pairs first (higher quality matches)
    results = []

    # 1. Search QA collection
    try:
        qa_docs = db.collection(QA_COLLECTION).stream()
        for doc in qa_docs:
            data = doc.to_dict()
            if "embedding" in data and data["embedding"]:
                score = cosine_similarity(query_embedding, data["embedding"])
                if score > 0.65:
                    # Parse timestamp from answer_timestamp field
                    ts = data.get("answer_timestamp", "")
                    start_sec = parse_time_to_seconds(ts)
                    end_sec = parse_end_time_to_seconds(ts)
                    results.append({
                        "type": "qa",
                        "score": round(score, 4),
                        "question": data.get("question", ""),
                        "answer_timestamp": ts,
                        "source_title": data.get("source_title", "We are the cause of Our Problems"),
                        "audio_url": data.get("audio_url", "") or DEFAULT_AUDIO_URL,
                        "transcript": data.get("answer_text", data.get("answer_summary", "")),
                        "start_seconds": data.get("start_seconds", start_sec),
                        "end_seconds": data.get("end_seconds") or end_sec,
                    })
    except Exception as e:
        logger.warning(f"QA search error: {e}")

    # 2. Search segments collection
    try:
        seg_docs = db.collection(FIRESTORE_COLLECTION).stream()
        for doc in seg_docs:
            data = doc.to_dict()
            if "embedding" in data and data["embedding"]:
                score = cosine_similarity(query_embedding, data["embedding"])
                if score > 0.65:
                    start_sec = parse_time_to_seconds(data.get("start_time", ""))
                    end_sec = parse_time_to_seconds(data.get("end_time", ""))
                    results.append({
                        "type": "segment",
                        "score": round(score, 4),
                        "segment_id": data.get("segment_id", doc.id),
                        "transcript": data.get("transcript", ""),
                        "start_time": data.get("start_time", ""),
                        "end_time": data.get("end_time", ""),
                        "source_title": data.get("source_title", "We are the cause of Our Problems"),
                        "audio_url": data.get("audio_url", "") or DEFAULT_AUDIO_URL,
                        "start_seconds": data.get("start_seconds", start_sec),
                        "end_seconds": data.get("end_seconds", end_sec),
                        "topics": data.get("topics", []),
                    })
    except Exception as e:
        logger.warning(f"Segment search error: {e}")

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


# ── Query logging to Firestore ──────────────────────────────────────
def log_query(query: str, results: list[dict], source: str = "text",
              gemini_raw_text: str = "", session_id: str = ""):
    """
    Log every query + results to Firestore for analytics.
    Collection: query_logs
    Fields: timestamp, query, source (text|voice), results, top_score,
            top_title, gemini_raw_text (includes leaked thinking text),
            session_id
    """
    try:
        now = datetime.now(timezone.utc)
        top_result = results[0] if results else {}
        log_entry = {
            "timestamp": now,
            "query": query,
            "source": source,  # "text" or "voice"
            "num_results": len(results),
            "top_score": top_result.get("score", 0),
            "top_title": top_result.get("source_title", ""),
            "top_transcript": (top_result.get("transcript", ""))[:500],
            "top_timestamp": top_result.get("answer_timestamp", ""),
            "all_scores": [r.get("score", 0) for r in results],
            "gemini_raw_text": gemini_raw_text[:2000] if gemini_raw_text else "",
            "session_id": session_id,
        }
        db.collection(QUERY_LOGS_COLLECTION).add(log_entry)
        logger.info(f"📋 Logged query: '{query[:50]}' → {len(results)} results, top={top_result.get('score', 0)}")
    except Exception as e:
        logger.warning(f"Query logging error: {e}")


# ── HTTP endpoints ───────────────────────────────────────────────────
@app.get("/")
async def root():
    """Serve the frontend or return API status."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse({
        "project": "Harikatha Live Agent",
        "status": "running",
        "message": "As It Is — Real Voice, Real Wisdom, Real-Time",
    })


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/search")
async def api_search(q: str = Query(..., description="Search query")):
    """REST endpoint for testing search independently."""
    results = search_harikatha(q)
    return {"query": q, "results": results}


# ── Query logs API ──────────────────────────────────────────────────
@app.get("/api/logs")
async def api_logs(limit: int = Query(100, description="Max logs to return"),
                   _user: str = Depends(verify_admin)):
    """Return recent query logs from Firestore, newest first."""
    try:
        logs_ref = db.collection(QUERY_LOGS_COLLECTION)
        docs = logs_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit).stream()
        logs = []
        for doc in docs:
            d = doc.to_dict()
            # Convert timestamp to ISO string for JSON
            ts = d.get("timestamp")
            if ts:
                d["timestamp"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            d["id"] = doc.id
            logs.append(d)
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        logger.error(f"Error fetching logs: {e}")
        return {"logs": [], "count": 0, "error": str(e)}


# ── Admin panel ─────────────────────────────────────────────────────
ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Harikatha Admin — Query Logs</title>
<style>
  :root { --saffron: #e8a839; --yamuna: #1a2744; --cream: #fdf7ee; --tulsi: #4a7c59; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--yamuna); color: var(--cream); padding: 20px; }
  h1 { color: var(--saffron); margin-bottom: 8px; font-size: 1.6rem; }
  .subtitle { color: rgba(255,255,255,0.5); margin-bottom: 20px; font-size: 0.85rem; }
  .stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat-card { background: rgba(255,255,255,0.06); border: 1px solid rgba(232,168,57,0.2); border-radius: 8px; padding: 12px 20px; }
  .stat-num { font-size: 1.8rem; font-weight: 700; color: var(--saffron); }
  .stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; }
  .controls { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .controls button, .controls select { background: rgba(255,255,255,0.1); border: 1px solid rgba(232,168,57,0.3); color: var(--cream); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .controls button:hover { background: var(--saffron); color: var(--yamuna); }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { background: rgba(232,168,57,0.15); color: var(--saffron); text-align: left; padding: 10px 12px; position: sticky; top: 0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: top; max-width: 300px; }
  tr:hover td { background: rgba(232,168,57,0.04); }
  .score { font-weight: 700; }
  .score-high { color: #5cb85c; }
  .score-med { color: var(--saffron); }
  .score-low { color: #d9534f; }
  .leaked { color: #d9534f; font-style: italic; font-size: 0.8rem; max-height: 60px; overflow-y: auto; }
  .query-text { color: var(--cream); font-weight: 500; }
  .transcript { color: rgba(255,255,255,0.5); font-size: 0.8rem; max-height: 60px; overflow-y: auto; }
  .time { color: rgba(255,255,255,0.4); font-size: 0.8rem; white-space: nowrap; }
  .source-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
  .source-text { background: rgba(66,133,244,0.2); color: #82b1ff; }
  .source-voice { background: rgba(76,175,80,0.2); color: #81c784; }
  .empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }
  .refresh-note { color: rgba(255,255,255,0.3); font-size: 0.75rem; }
</style>
</head>
<body>
<h1>Harikatha Admin — Query Logs</h1>
<p class="subtitle">Every question asked and every answer given</p>

<div class="stats" id="stats"></div>

<div class="controls">
  <button onclick="loadLogs()">Refresh</button>
  <select id="limitSelect" onchange="loadLogs()">
    <option value="50">Last 50</option>
    <option value="100" selected>Last 100</option>
    <option value="500">Last 500</option>
  </select>
  <span class="refresh-note" id="lastRefresh"></span>
</div>

<table>
<thead>
<tr>
  <th>Time</th>
  <th>Source</th>
  <th>Query</th>
  <th>Score</th>
  <th>Title</th>
  <th>Transcript</th>
  <th>Gemini Raw Text (incl. leaked thinking)</th>
</tr>
</thead>
<tbody id="logBody">
<tr><td colspan="7" class="empty">Loading...</td></tr>
</tbody>
</table>

<script>
async function loadLogs() {
  const limit = document.getElementById('limitSelect').value;
  try {
    const res = await fetch('/api/logs?limit=' + limit, {credentials: 'same-origin'});
    const data = await res.json();
    const tbody = document.getElementById('logBody');
    const stats = document.getElementById('stats');

    if (!data.logs || data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No queries logged yet. Go ask a question!</td></tr>';
      stats.innerHTML = '';
      return;
    }

    // Stats
    const totalQueries = data.logs.length;
    const avgScore = data.logs.reduce((s, l) => s + (l.top_score || 0), 0) / totalQueries;
    const withResults = data.logs.filter(l => l.num_results > 0).length;
    const leaked = data.logs.filter(l => l.gemini_raw_text && l.gemini_raw_text.length > 0).length;
    stats.innerHTML = `
      <div class="stat-card"><div class="stat-num">${totalQueries}</div><div class="stat-label">Total Queries</div></div>
      <div class="stat-card"><div class="stat-num">${(avgScore * 100).toFixed(1)}%</div><div class="stat-label">Avg Top Score</div></div>
      <div class="stat-card"><div class="stat-num">${withResults}</div><div class="stat-label">With Results</div></div>
      <div class="stat-card"><div class="stat-num">${leaked}</div><div class="stat-label">With Gemini Text</div></div>
    `;

    // Table rows
    tbody.innerHTML = data.logs.map(log => {
      const ts = log.timestamp ? new Date(log.timestamp).toLocaleString() : '—';
      const score = log.top_score || 0;
      const scoreClass = score >= 0.75 ? 'score-high' : score >= 0.65 ? 'score-med' : 'score-low';
      const sourceBadge = log.source === 'voice'
        ? '<span class="source-badge source-voice">voice</span>'
        : '<span class="source-badge source-text">text</span>';
      return `<tr>
        <td class="time">${ts}</td>
        <td>${sourceBadge}</td>
        <td class="query-text">${esc(log.query || '')}</td>
        <td class="score ${scoreClass}">${score ? (score * 100).toFixed(1) + '%' : '—'}</td>
        <td>${esc(log.top_title || '—')}</td>
        <td class="transcript">${esc(log.top_transcript || '—')}</td>
        <td class="leaked">${esc(log.gemini_raw_text || '')}</td>
      </tr>`;
    }).join('');

    document.getElementById('lastRefresh').textContent = 'Last refreshed: ' + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById('logBody').innerHTML = '<tr><td colspan="7" class="empty">Error loading logs: ' + e.message + '</td></tr>';
  }
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
loadLogs();
// Auto-refresh every 30 seconds
setInterval(loadLogs, 30000);
</script>
</body>
</html>"""


@app.get("/admin")
async def admin_panel(_user: str = Depends(verify_admin)):
    """Serve the admin panel for viewing query logs. Protected by HTTP Basic auth."""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=ADMIN_HTML)


# ── Gemini Live API system instructions ──────────────────────────────
SYSTEM_INSTRUCTION = """You help seekers hear Srila Gurudeva's harikatha. When asked a question, call search_harikatha immediately. After getting results, say ONLY ONE sentence like "Gurudeva speaks about this in [title]. Here are his words." Then stop. Say NOTHING else. Do NOT explain the results. Do NOT share your reasoning. Do NOT plan out loud. Just the one sentence, then stop. If no results, say "I could not find a matching recording." Keep it extremely brief."""


# ── Tool declaration for Gemini Live API ─────────────────────────────
SEARCH_TOOL = {
    "function_declarations": [{
        "name": "search_harikatha",
        "description": "Search the corpus of Srila Gurudeva's harikatha recordings to find segments matching the seeker's spiritual question. Returns matching segments with transcripts, timestamps, and audio URLs.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "The seeker's spiritual question or topic to search for in Gurudeva's harikatha recordings"
                }
            },
            "required": ["query"]
        }
    }]
}


# ── WebSocket proxy: Browser ↔ Gemini Live API ──────────────────────
@app.websocket("/ws/live")
async def websocket_live_proxy(ws: WebSocket):
    """
    WebSocket proxy between browser and Gemini Live API.

    Flow:
    1. Browser connects to /ws/live
    2. We open a WebSocket to Gemini Live API
    3. We forward audio from browser → Gemini
    4. We listen for Gemini responses → forward to browser
    5. When Gemini issues a toolCall (search_harikatha), we execute it
       server-side and send the result back to Gemini, plus notify browser
       with the audio segment URL to play.
    """
    await ws.accept()
    logger.info("🎙️ Browser connected to /ws/live")

    # Session-level state for logging
    session_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    gemini_text_buffer = []  # Accumulate ALL Gemini text (including thinking/leaked)
    last_query = ""  # Track the most recent search query
    last_results = []  # Track the most recent search results

    # Build Gemini Live API WebSocket URL
    gemini_ws_url = (
        f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage."
        f"v1beta.GenerativeService.BidiGenerateContent?key={GOOGLE_API_KEY}"
    )

    try:
        async with websockets.connect(
            gemini_ws_url,
            additional_headers={"Content-Type": "application/json"},
            max_size=None,
            ping_interval=30,
            ping_timeout=10,
        ) as gemini_ws:
            logger.info("🔗 Connected to Gemini Live API")

            # 1. Send setup message
            setup_msg = {
                "setup": {
                    "model": f"models/{GEMINI_LIVE_MODEL}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Gacrux"
                                }
                            }
                        }
                    },
                    "systemInstruction": {
                        "parts": [{"text": SYSTEM_INSTRUCTION}]
                    },
                    "tools": [SEARCH_TOOL],
                }
            }
            await gemini_ws.send(json.dumps(setup_msg))
            logger.info("📤 Sent setup to Gemini")

            # Wait for setupComplete
            setup_response = await gemini_ws.recv()
            setup_data = json.loads(setup_response)
            if "setupComplete" in setup_data:
                logger.info("✅ Gemini session setup complete")
                await ws.send_json({"type": "setup_complete"})
            else:
                logger.warning(f"Unexpected setup response: {setup_data}")

            # 2. Run two tasks: browser→gemini and gemini→browser
            async def browser_to_gemini():
                """Forward audio/text from browser to Gemini."""
                try:
                    while True:
                        data = await ws.receive_text()
                        msg = json.loads(data)

                        if msg.get("type") == "audio":
                            # Browser sends base64 PCM audio chunks
                            gemini_msg = {
                                "realtimeInput": {
                                    "mediaChunks": [{
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": msg["data"]
                                    }]
                                }
                            }
                            await gemini_ws.send(json.dumps(gemini_msg))

                        elif msg.get("type") == "text":
                            # Browser sends text query
                            gemini_msg = {
                                "clientContent": {
                                    "turns": [{
                                        "role": "user",
                                        "parts": [{"text": msg["text"]}]
                                    }],
                                    "turnComplete": True
                                }
                            }
                            await gemini_ws.send(json.dumps(gemini_msg))
                            logger.info(f"📝 Forwarded text: {msg['text'][:60]}")

                except WebSocketDisconnect:
                    logger.info("Browser disconnected")
                except Exception as e:
                    logger.error(f"browser_to_gemini error: {e}")

            async def gemini_to_browser():
                """Forward audio/toolCalls from Gemini to browser."""
                nonlocal last_query, last_results
                try:
                    async for raw in gemini_ws:
                        msg = json.loads(raw)

                        # ── Tool call from Gemini ──
                        if "toolCall" in msg:
                            tool_call = msg["toolCall"]
                            logger.info(f"🔧 Tool call received: {tool_call}")

                            function_responses = []
                            for fc in tool_call.get("functionCalls", []):
                                if fc["name"] == "search_harikatha":
                                    query = fc["args"].get("query", "")
                                    logger.info(f"🔍 Searching: {query}")

                                    # Execute search
                                    results = search_harikatha(query)
                                    logger.info(f"📊 Found {len(results)} results")

                                    # Track for logging (will log at turn_complete)
                                    last_query = query
                                    last_results = results

                                    # Send results to browser for audio playback
                                    if results:
                                        await ws.send_json({
                                            "type": "harikatha_result",
                                            "results": results,
                                            "query": query,
                                        })

                                    # Send function response back to Gemini
                                    result_text = json.dumps(results) if results else json.dumps({"message": "No matching harikatha segments found"})
                                    function_responses.append({
                                        "id": fc["id"],
                                        "name": fc["name"],
                                        "response": {"result": result_text}
                                    })

                            # Send tool response to Gemini
                            tool_response_msg = {
                                "toolResponse": {
                                    "functionResponses": function_responses
                                }
                            }
                            await gemini_ws.send(json.dumps(tool_response_msg))
                            logger.info("📤 Sent tool response to Gemini")

                        # ── Audio from Gemini ──
                        elif "serverContent" in msg:
                            sc = msg["serverContent"]

                            # Check for model turn with audio parts
                            if "modelTurn" in sc:
                                parts = sc["modelTurn"].get("parts", [])
                                for part in parts:
                                    if "inlineData" in part:
                                        inline = part["inlineData"]
                                        if inline.get("mimeType", "").startswith("audio/"):
                                            await ws.send_json({
                                                "type": "audio",
                                                "data": inline["data"],
                                                "mimeType": inline["mimeType"],
                                            })

                                    elif "text" in part:
                                        # Capture ALL text from Gemini (including thinking/leaked)
                                        gemini_text_buffer.append(part["text"])
                                        await ws.send_json({
                                            "type": "text",
                                            "text": part["text"],
                                        })

                            # Turn complete — log the query + results + Gemini raw text
                            if sc.get("turnComplete"):
                                await ws.send_json({"type": "turn_complete"})
                                # Log query if there was a search this turn
                                if last_query:
                                    raw_text = "".join(gemini_text_buffer)
                                    log_query(
                                        query=last_query,
                                        results=last_results,
                                        source="text",  # TODO: detect voice vs text
                                        gemini_raw_text=raw_text,
                                        session_id=session_id,
                                    )
                                gemini_text_buffer.clear()

                            # Interrupted
                            if sc.get("interrupted"):
                                await ws.send_json({"type": "interrupted"})

                        # ── Setup complete (already handled above) ──
                        elif "setupComplete" in msg:
                            pass

                        else:
                            logger.debug(f"Other Gemini msg: {list(msg.keys())}")

                except websockets.ConnectionClosed:
                    logger.info("Gemini WS closed")
                except Exception as e:
                    logger.error(f"gemini_to_browser error: {e}")

            # Run both directions concurrently
            await asyncio.gather(
                browser_to_gemini(),
                gemini_to_browser(),
                return_exceptions=True,
            )

    except Exception as e:
        logger.error(f"WebSocket proxy error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        logger.info("🔌 Session ended")