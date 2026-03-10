# Harikatha Live Agent — Session 2 Deployment Guide

## What We Built

```
Browser (mic/text)
   ↕ WebSocket /ws/live
Backend (FastAPI on Cloud Run)
   ↕ WebSocket proxy
Gemini Live API (voice in → voice out)
   → calls search_harikatha tool
   → backend executes Firestore vector search
   → returns results to Gemini + browser
   → browser plays Gurudeva's audio at correct timestamp
```

**Files created:**

| File | Purpose |
|------|---------|
| `src/main.py` | FastAPI backend: WS proxy + search + static files |
| `frontend/index.html` | Devotional UI |
| `frontend/css/style.css` | Yamuna-blue + saffron styling |
| `frontend/js/audio-utils.js` | Mic capture (16kHz PCM) + audio playback (24kHz) |
| `frontend/js/gemini-live.js` | WebSocket client to backend proxy |
| `frontend/js/app.js` | Ties everything together |
| `Dockerfile` | Cloud Run container |
| `requirements.txt` | Python dependencies |
| `scripts/deploy.sh` | One-command deploy |

---

## Step-by-Step Deployment (20 min)

### Step 1: Copy files to your project (2 min)

Copy all the files above into your local project at
`C:\Users\radha\Projects\harikatha-live-agent\`

Your folder should look like:

```
harikatha-live-agent/
├── Dockerfile
├── requirements.txt
├── scripts/deploy.sh
├── src/
│   ├── __init__.py
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── audio-utils.js
│       ├── gemini-live.js
│       └── app.js
└── (existing: corpus/, tests/, etc.)
```

### Step 2: Get your Gemini API Key (2 min)

Go to: https://aistudio.google.com/apikey

Create a key for project `harikatha-live-agent`. Copy it.

### Step 3: Test locally (5 min)

Open PowerShell in your project folder:

```powershell
# Create venv if not done already
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install deps
pip install -r requirements.txt

# Set your API key
$env:GOOGLE_API_KEY = "your-gemini-api-key-here"
$env:GCP_PROJECT = "harikatha-live-agent"

# Run locally
uvicorn src.main:app --reload --port 8080
```

Open browser: http://localhost:8080

You should see the saffron-and-blue Harikatha Live UI.

### Step 4: Deploy to Cloud Run (10 min)

Option A — Using deploy script (Linux/WSL/Cloud Shell):

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Option B — Manual commands (PowerShell):

```powershell
# Set project
gcloud config set project harikatha-live-agent

# Build + push container
gcloud builds submit --tag gcr.io/harikatha-live-agent/harikatha-live-agent --timeout=600

# Deploy
gcloud run deploy harikatha-live-agent `
    --image gcr.io/harikatha-live-agent/harikatha-live-agent `
    --region us-central1 `
    --platform managed `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --timeout 300 `
    --max-instances 3 `
    --set-env-vars "GCP_PROJECT=harikatha-live-agent,GOOGLE_API_KEY=your-key-here"
```

### Step 5: Set the API key on Cloud Run (1 min)

If you didn't include it in the deploy command:

```powershell
gcloud run services update harikatha-live-agent `
    --region us-central1 `
    --set-env-vars "GOOGLE_API_KEY=your-gemini-api-key"
```

### Step 6: Test live (2 min)

Open: https://harikatha-live-agent-862707561519.us-central1.run.app

1. Click **Connect** → should say "Connected — ready to listen"
2. Type a question like "Why do I have problems in life?" → Send
3. Gemini responds with voice + searches Gurudeva's corpus
4. If match found → Gurudeva's audio player appears
5. Hold the 🎙️ button to speak your question instead

---

## How It Works

1. **Browser** captures mic audio → 16kHz PCM16 → base64 → WebSocket
2. **Backend** proxies to `wss://generativelanguage.googleapis.com/ws/...`
3. **Gemini Live API** processes audio, understands question
4. Gemini calls `search_harikatha(query)` tool
5. **Backend** executes Firestore vector search (your seeded embeddings)
6. Results sent back to Gemini (for verbal response) AND to browser (for audio player)
7. **Gemini** speaks a summary: "Gurudeva has spoken on this topic..."
8. **Browser** shows Gurudeva's audio segment with play button

---

## Important Notes

- **Cloud Run WebSocket timeout**: Default 300s. The Gemini Live API session maxes at 10 min. This is fine for a hackathon demo.
- **CORS**: Already configured to allow all origins.
- **Model**: Using `gemini-2.5-flash-native-audio-preview-12-2025` (the latest native audio model). Free tier available.
- **Audio format**: Mic input = 16kHz PCM16 mono. Gemini output = 24kHz PCM16 mono.
- **Existing Firestore data**: Your seeded 5 segments + 10 QA pairs with embeddings will be searched automatically.

---

## Git Push

```powershell
cd C:\Users\radha\Projects\harikatha-live-agent
git add -A
git commit -m "feat: Gemini Live API voice + frontend with harikatha search"
git push origin master
```

---

## What's Next (Future Sessions)

- Upload more harikatha segments to Firestore
- Upload actual audio files to Cloud Storage bucket
- Add video playback support (YouTube embed or GCS video)
- Blog post for hackathon bonus points
- Demo video recording

---

*Jaya Srila Gurudeva! 🙏*
