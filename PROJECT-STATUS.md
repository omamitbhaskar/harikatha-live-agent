# Harikatha Live Agent — Project Status

**Last updated:** March 13, 2026 (end of session)
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

9. **Amit prefers working in Cowork** (not Claude chat/Projects) because Cowork can edit files directly. Start each session by reading this file.

---

## WHAT'S WORKING (as of March 13, 2026 — DEPLOYED LIVE)

- Cloud Run live: https://harikatha-live-agent-862707561519.us-central1.run.app
- FastAPI server runs locally: `uvicorn src.main:app --host 127.0.0.1 --port 8080`
- Frontend served from /static/ mount → http://127.0.0.1:8080
- WebSocket connects browser → backend → Gemini Live API
- Voice input (mic) works — Gemini transcribes speech
- Text input works — type question, hit enter
- search_harikatha tool called automatically by Gemini
- Firestore vector search returns results (73-76% match)
- Audio player shows with correct timestamps and transcript
- Video player shows alongside audio (user chooses which to play)
- Neither auto-plays — user clicks play on whichever they want
- Thinking text filter blocks Gemini's internal reasoning from UI
- Push-to-talk mic with proper start/stop
- Analytics installed: Inspectlet (ID: 1685756920), Google Analytics (G-BDVLKP8XSZ), Microsoft Clarity (vv04jazml9)
- Git and Cloud Run are IN SYNC — last deploy: revision harikatha-live-agent-00007-nr5

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
- `frontend/index.html` — Single page app, loads 3 JS files + analytics
- `frontend/js/app.js` — UI logic, message handling, media playback
- `frontend/js/gemini-live.js` — GeminiLiveClient WebSocket class
- `frontend/js/audio-utils.js` — AudioCapture (mic) + AudioPlayer classes
- `frontend/css/style.css` — All styling
- `Dockerfile` — Cloud Run deployment
- `requirements.txt` — Python dependencies

### Media Files in frontend/
- `we_are_the_cause_of_our_problems.mp3` (2.3MB) — audio
- `we_are_the_cause_of_our_problems_badger_eng_subs.mp4` (24MB) — video with English subs

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

## PRIORITY TODO — NEXT SESSION (March 14)

### FIRST THING: Fix the mic leak bug
- **BUG:** When WebSocket is connected, the mic is ALWAYS listening. Gemini hears ambient speech (even user talking to other apps) and triggers searches / leaks thinking text.
- **FIX NEEDED:** After Gemini returns search results + turn_complete, automatically stop listening. User must press mic button again to ask another question. Clear visual indicator when mic is live.
- This is the #1 priority because it affects the demo experience.

### Small fixes (safe to do):
1. Voice is "Kore" on line 270 of main.py — change to "Gacrux" (one word change)
2. Video should appear ABOVE audio in the player (swap order in index.html line 53-55)
3. favicon.ico missing (404 in logs) — minor cosmetic
4. Audio/video overlap if user plays both — should pause one when other starts

### Bigger items (need planning):
5. Gemini "thinking" text still leaks sometimes — filter may need more patterns
6. Score shows in "Found!" message but not in player UI
7. Spoken question not displayed in conversation when using mic
8. Need loading indicator while audio/video buffers

### Important features (plan carefully before building):
9. **Question/Answer logging to Firestore** — Every query, result, score, timestamp saved to a `query_logs` collection. Protects against misquoting. ~10-15 lines in main.py. LOW RISK (backend only, no frontend changes).
10. **Admin panel** — Separate page at /admin showing all logged queries, answers, scores, timestamps in a table. Needs logging (item 9) first. MEDIUM effort, 1-2 sessions.
11. **Camera input for darshan** — Users at the Dham point phone camera at deity while asking question. Gemini Live API supports video input. Additive change, doesn't break existing audio flow. MEDIUM effort.

### Future (post-hackathon):
- Scale to 2500 videos and 7000 audios
- Media served from GCS (not bundled in app)
- Video URL mapping from Firestore (not hardcoded convention)
- Proper search ranking and relevance tuning
- Google Secret Manager for API key (instead of env var in deploy command)

---

## GIT STATUS (March 13 — ALL CLEAN)
- Local, GitHub, and Cloud Run are ALL IN SYNC
- Last commit: "Add analytics: Inspectlet, Google Analytics, Microsoft Clarity"
- Git push works normally now (no more force push needed)
- Amit has a backup copy: "harikatha-live-agent working" folder on his machine

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

## HOW TO PUSH TO GITHUB
```powershell
git add -A
git commit -m "Description of what changed"
git push origin master
```

---

## SESSION LOG

### HACKATHON TIMELINE
- **March 14-15:** Final coding days (mic fix, logging, polishing)
- **March 15:** Start architecture diagrams, clean up repo for public viewing
- **March 16:** Record demo video, prepare documentation/submission
- **March 17 1:00 PM NZDT:** Deadline
- **Repo is PUBLIC** — audit needed before deadline (remove junk files, backup folders, sensitive data)

### AMIT'S NOTES (end of day March 13)
- Logging is URGENT — cannot build later, you lose the data. Add Firestore query_logs ASAP.
- Logging also useful for RLHF (reinforcement learning from human feedback) later
- Google dropped a new multimodal model — can read text, audio, video natively. Explore post-hackathon for direct video understanding
- Demo video needed for submission — plan content and recording
- Documentation needed — architecture map, what it does, how it works

### March 13, 2026
- Recovered from March 11 breakage by restoring March 10 backup
- Identified 3 breaking changes (mount path, monolith JS, wrong WS endpoint)
- Got local server running and tested successfully
- Added video player alongside audio player (user chooses which to play)
- Discovered mic leak bug: Gemini hears ambient speech when connected
- Added analytics: Inspectlet, Google Analytics, Microsoft Clarity
- Force pushed working code to GitHub (replaced broken March 11 commits)
- Deployed to Cloud Run — live and working
- Created PROJECT-STATUS.md for session continuity
- Created HOW-TO-RUN-HARIKATHA.txt in Projects folder (not in git)
