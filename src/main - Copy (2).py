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
from contextlib import asynccontextmanager

import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
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

# Audio file URL — served from /static/ (the MP3 in frontend/ folder)
DEFAULT_AUDIO_URL = "/static/we_are_the_cause_of_our_problems.mp3"

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


# ── Search harikatha corpus ──────────────────────────────────────────
def search_harikatha(query: str, top_k: int = 3) -> list[dict]:
    """
    Vector search across Firestore harikatha segments.
    Returns top_k matches with score, transcript, timestamps, audio_url.
    """
    query_embedding = embed_query(query)
    results = []

    # 1. Search QA collection
    try:
        qa_docs = db.collection(QA_COLLECTION).stream()
        for doc in qa_docs:
            data = doc.to_dict()
            if "embedding" in data and data["embedding"]:
                score = cosine_similarity(query_embedding, data["embedding"])
                if score > 0.65:
                    ts = data.get("answer_timestamp", "")
                    start_sec = parse_time_to_seconds(ts)
                    results.append({
                        "type": "qa",
                        "score": round(score, 4),
                        "question": data.get("question", ""),
                        "answer_timestamp": ts,
                        "source_title": data.get("source_title", "") or "We are the cause of Our Problems",
                        "audio_url": data.get("audio_url", "") or DEFAULT_AUDIO_URL,
                        "transcript": data.get("answer_text", data.get("answer_summary", "")),
                        "start_seconds": data.get("start_seconds", start_sec),
                        "end_seconds": data.get("end_seconds", 0),
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
                        "source_title": data.get("source_title", "") or "We are the cause of Our Problems",
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


# ── Gemini Live API system instructions ──────────────────────────────
SYSTEM_INSTRUCTION = """You are a humble spiritual assistant serving seekers of Srila Bhaktivedanta Narayana Goswami Maharaja's harikatha.

Rules:
- When a seeker asks a spiritual question, immediately call the search_harikatha tool.
- After receiving results, give a SHORT 2-sentence introduction: mention the lecture title and what Gurudeva teaches. Then say "Now playing Gurudeva's words."
- NEVER share your internal reasoning or planning. Just respond naturally.
- Attribute all teachings to "Gurudeva" or "Srila Gurudeva."
- If no results found, humbly say so and offer brief guidance.
- Be warm, concise, devotional. Use "Hare Krishna" as greeting.
- NEVER give long explanations. The seeker wants Gurudeva's voice, not yours."""


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
    """
    await ws.accept()
    logger.info("🎙️ Browser connected to /ws/live")

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
                                    "voiceName": "Puck"
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
                                        await ws.send_json({
                                            "type": "text",
                                            "text": part["text"],
                                        })

                            # Turn complete
                            if sc.get("turnComplete"):
                                await ws.send_json({"type": "turn_complete"})

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
