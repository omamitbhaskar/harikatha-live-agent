# Harikatha Live Agent — Project Status

**Last updated:** March 13, 2026
**Owner:** Amit Bhaskar (Radhavinoda Prabhu)
**Deadline:** Monday March 17, 1:00 PM NZDT (Gemini Live Agent Challenge 2026)
**Repo:** github.com/omamitbhaskar/harikatha-live-agent
**GCP Project:** harikatha-live-agent
**Cloud Run URL:** https://harikatha-live-agent-862707561519.us-central1.run.app
**Local:** C:\Users\radha\Projects\harikatha-live-agent

---

## CRITICAL RULES — READ BEFORE CHANGING ANYTHING

1. **NEVER change the /static mount point** in main.py line 66. It must be:
   `app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")`
   Changing this to /frontend or anything else kills CSS, JS, and audio serving.

2. **Algorithm first, code second.** Write out the steps in comments before writing code.

3. **One change at a time.** Test between each change.

4. **Ask Amit before changing code.** Show him the exact lines. He approves, then you change.

5. **Comment everything clearly.** Old code gets commented out, not deleted. Mark with:
   `// OLD (description): original line here`
   `// NEW (description): replacement line here`

6. **The frontend uses modular JS architecture:**
   - `audio-utils.js` → AudioCapture class (mic input, 16kHz PCM16)
   - `gemini-live.js` → GeminiLiveClient class (WebSocket to /ws/live)
   - `app.js` → Main app logic, uses both classes above
   - index.html loads all three in order: audio-utils.js, gemini-live.js, app.js
   - NEVER combine these into a single file.

7. **WebSocket endpoint is /ws/live** — never /ws/gemini-live or anything else.

8. **Amit has a hand injury.** He uses voice dictation. Keep instructions concise.

---

## WHAT'S WORKING (as of March 13, 2026)

- FastAPI server runs locally: `uvicorn src.main:app --host 127.0.0.1 --port 8080`
- Frontend served from /static/ mount → http://127.0.0.1:8080
- WebSocket connects browser ↔ backend ↔ Gemini Live API
- Voice input (mic) works — Gemini transcribes speech
- Text input works — type question, hit enter
- search_harikatha tool called automatically by Gemini
- Firestore vector search returns results (73-76% match)
- Audio player shows with correct timestamps and transcript
- Video player shows alongside audio (user chooses which to play)
- Neither auto-plays — user clicks play on whichever they want
- Thinking text filter blocks Gemini's internal reasoning from UI
- Push-to-talk mic with proper start/stop

---

## ARCHITECTURE

### Data Pipeline (Video is the ROOT)
```
Video (.mp4) → Audio (.mp3) → Transcript → JSON → QA pairs → Firestore (with embeddings)
```

### Runtime Flow
```
User speaks/types question
  → Browser sends to backend via WebSocket (/ws/live)
    → Backend forwards to Gemini Live API
      → Gemini calls search_harikatha tool
        → Backend searches Firestore (vector similarity)
        → Backend sends results to browser (harikatha_result message)
        → Backend sends tool response back to Gemini
      → Gemini responds with brief text
    → Browser shows text + audio player + video player
  → User clicks play on audio or video
```

### Key Files
- `src/main.py` — FastAPI backend, WebSocket proxy, Firestore search
- `frontend/index.html` — Single page app, loads 3 JS files
- `frontend/js/app.js` — UI logic, message handling, media playback
- `frontend/js/gemini-live.js` — GeminiLiveClient WebSocket class
- `frontend/js/audio-utils.js` — AudioCapture (mic) + AudioPlayer classes
- `frontend/css/style.css` — All styling
- `Dockerfile` — Cloud Run deployment
- `requirements.txt` — Python dependencies

### Backend Message Types (WebSocket)
- `setup_complete` — Gemini session ready
- `text` — Text from Gemini (may contain "thinking" — filtered in app.js)
- `turn_complete` — Gemini finished responding
- `harikatha_result` — Search results with audio/video URLs
- `audio` — Gemini's own PCM voice (currently discarded)
- `interrupted` — User interrupted Gemini

### Backend Data Structure (harikatha_result)
```json
{
  "type": "harikatha_result",
  "query": "what is the root of our problems",
  "results": [
    {
      "score": 0.7387,
      "source_title": "We are the cause of Our Problems",
      "transcript": "...",
      "audio_url": "/static/we_are_the_cause_of_our_problems.mp3",
      "start_seconds": 51,
      "end_seconds": 0,
      "answer_timestamp": "0:51 - 1:03",
      "type": "qa"
    }
  ]
}
```

### Video URL Convention
Video URL is derived from audio URL in app.js:
`audio_url.replace('.mp3', '_badger_eng_subs.mp4')`
Example: `/static/we_are_the_cause_of_our_problems.mp3` → `/static/we_are_the_cause_of_our_problems_badger_eng_subs.mp4`

---

## MODELS
- Brain: gemini-3.1-pro-preview (text/search orchestration — not currently used in main.py)
- Voice: gemini-2.5-flash-native-audio-preview-12-2025 (Gemini Live API)
- Embeddings: models/gemini-embedding-001
- Voice name: Kore (should be changed to Gacrux — line 270 of main.py)

---

## KNOWN ISSUES / TODO

### Small fixes (safe to do):
1. Voice is "Kore" on line 270 of main.py — change to "Gacrux" (one word change)
2. Video should appear ABOVE audio in the player (swap order in index.html)
3. Mic stays active when connected — user's ambient speech triggers Gemini. Need clear mic on/off state.
4. favicon.ico missing (404 in logs) — minor cosmetic

### Bigger items (need planning):
5. Gemini "thinking" text still leaks sometimes — filter may need more patterns
6. Score shows in "Found!" message but not in player UI
7. Spoken question not displayed in conversation when using mic
8. Audio/video overlap if user plays both — should pause one when other starts
9. Logging and analytics
10. Deploy to Cloud Run (not yet pushed — git has conflicts with broken March 11 code)

### Future (post-hackathon):
- Scale to 2500 videos and 7000 audios
- Media served from GCS (not bundled in app)
- Video URL mapping from Firestore (not hardcoded convention)
- Proper search ranking and relevance tuning

---

## GIT STATUS (March 13)
- Local is CLEAN and WORKING
- Remote (GitHub) has broken March 11 commits ahead
- DO NOT `git pull` — it will overwrite working files
- To push: need `git push --force origin master` (after committing current state)
- Amit has a backup copy: "harikatha-live-agent working" folder

---

## WHAT BROKE THINGS ON MARCH 11 (DO NOT REPEAT)
1. Changing /static mount to /frontend in main.py — killed all asset serving
2. Rewriting index.html to load single app.js instead of 3 modular JS files
3. Rewriting app.js as monolith with wrong WebSocket endpoint (/ws/gemini-live)
4. All three changes together made the app completely non-functional

---

## HOW TO RUN LOCALLY
```powershell
cd C:\Users\radha\Projects\harikatha-live-agent
.\venv\Scripts\Activate
$env:GOOGLE_API_KEY = "your-key-here"
$env:GCP_PROJECT = "harikatha-live-agent"
uvicorn src.main:app --host 127.0.0.1 --port 8080
# Open http://127.0.0.1:8080
```

## HOW TO DEPLOY TO CLOUD RUN
```powershell
gcloud run deploy harikatha-live-agent --source . --project harikatha-live-agent --region us-central1 --allow-unauthenticated --set-env-vars "GOOGLE_API_KEY=your-key-here,GCP_PROJECT=harikatha-live-agent"
```
