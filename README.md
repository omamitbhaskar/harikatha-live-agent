# Harikatha Live Agent
### "As It Is" — Real Voice, Real Wisdom, Real-Time

> A multimodal AI agent that lets seekers ask spiritual questions by voice and receive answers in Srila Bhaktivedanta Narayana Goswami Maharaja's own recorded voice and video — not synthesized, not fabricated, but retrieved from the actual corpus of harikatha.

Built for the [Gemini Live Agent Challenge 2026](https://geminiliveagentchallenge.devpost.com/) | **Live Agent Track**

**Live Demo:** [https://harikatha-live-agent-862707561519.us-central1.run.app](https://harikatha-live-agent-862707561519.us-central1.run.app)

---

## What It Does

A seeker speaks or types a spiritual question. The Gemini Live API understands the intent, calls a custom `search_harikatha` tool, which performs vector similarity search across an indexed corpus of actual harikatha recordings, and returns the exact audio/video segment where Srila Gurudeva answers that question — in his own voice.

The AI never puts words in Gurudeva's mouth. Gemini speaks only a brief contextual introduction. All spiritual content comes from the actual recordings. The AI is the librarian, not the speaker.

---

## Architecture

```
Seeker (Browser/Mic)
  → WebSocket (/ws/live)
    → FastAPI Backend (Cloud Run)
      → Gemini Live API (Speech-to-Text + Intent)
        → search_harikatha tool (Function Calling)
          → Firestore Vector Search (Vertex AI Embeddings)
          → Returns audio/video segment with timestamps
        → Gemini speaks brief introduction
      → Browser plays Gurudeva's actual recorded voice/video
```

### Data Pipeline (Video is the root)
```
Video (.mp4) → Audio (.mp3) → Transcript → JSON → QA pairs → Firestore (with embeddings)
```

---

## Tech Stack

| Hackathon Requirement | Technology Used |
|---|---|
| Gemini Model | `gemini-2.5-flash-native-audio-preview` (Gemini Live API) |
| Embeddings | `gemini-embedding-001` (Vertex AI) |
| Google GenAI SDK | `google-genai` Python SDK v1.14 |
| Google Cloud Services | Cloud Run, Firestore, Cloud Storage |
| Backend | Python 3.11 / FastAPI / WebSockets |
| Frontend | Vanilla HTML + JavaScript (modular, 3 JS files) |
| Containerisation | Docker |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Google Cloud CLI (`gcloud`)
- A Google Cloud project with Firestore enabled and billing active
- A Gemini API key

### Local Development

```bash
# Clone the repo
git clone https://github.com/omamitbhaskar/harikatha-live-agent.git
cd harikatha-live-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GOOGLE_API_KEY="your-gemini-api-key"
export GCP_PROJECT="harikatha-live-agent"

# On Windows PowerShell:
# $env:GOOGLE_API_KEY = "your-gemini-api-key"
# $env:GCP_PROJECT = "harikatha-live-agent"

# Run locally
uvicorn src.main:app --host 127.0.0.1 --port 8080

# Open http://127.0.0.1:8080
```

### Deploy to Google Cloud Run

```bash
# Option 1: One-command deploy
gcloud run deploy harikatha-live-agent \
  --source . \
  --project harikatha-live-agent \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=your-key,GCP_PROJECT=harikatha-live-agent"

# Option 2: Use the deploy script
./scripts/deploy.sh
```

---

## Project Structure

```
harikatha-live-agent/
├── README.md                   # This file
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Cloud Run container definition
├── .gitignore
│
├── src/                        # Backend
│   ├── __init__.py
│   └── main.py                 # FastAPI app: WebSocket proxy to Gemini Live API,
│                               # Firestore vector search, tool call handling,
│                               # embedding generation, static file serving
│
├── frontend/                   # Browser client (served from /static/)
│   ├── index.html              # Single-page app with mic, text input, players
│   ├── css/
│   │   └── style.css           # Devotional-themed styling (saffron/yamuna palette)
│   └── js/
│       ├── app.js              # UI logic, message handling, media playback
│       ├── gemini-live.js      # GeminiLiveClient class (WebSocket to /ws/live)
│       └── audio-utils.js      # AudioCapture (mic 16kHz PCM16) + AudioPlayer
│
├── corpus/                     # Harikatha corpus data
│   ├── segments/
│   │   └── sample-001.json     # Segment definitions with QA pairs
│   └── media/
│       └── .gitkeep            # Audio/video files (large, not in git)
│
├── scripts/                    # Deployment & data scripts
│   ├── deploy.sh               # Cloud Run deployment automation
│   └── seed_firestore.py       # Seed Firestore with corpus data + embeddings
│
└── tests/
    ├── test_gemini_v2.py       # Gemini API connection test
    └── test_search.py          # Search accuracy tests
```

---

## How It Works

1. **Seeker speaks or types** a question (e.g., "What is the root of our problems?")
2. **Browser** captures audio at 16kHz PCM16 and sends via WebSocket to `/ws/live`
3. **Backend** proxies to Gemini Live API, which transcribes and understands intent
4. **Gemini calls `search_harikatha`** — our custom function calling tool
5. **Backend** generates an embedding for the query using `gemini-embedding-001`
6. **Firestore** returns matching segments ranked by cosine similarity (threshold: 0.65)
7. **Backend** sends results to browser with audio URL, timestamps, and transcript
8. **Gemini** speaks a brief introduction: "Gurudeva speaks about this in [title]."
9. **Browser** shows audio + video players at the correct timestamp — seeker clicks play
10. **Seeker hears Gurudeva's actual voice** answering their question

---

## Corpus Format

Each harikatha recording is indexed as JSON with segments and QA pairs:

```json
{
  "source": {
    "title": "We are the cause of Our Problems",
    "speaker": "Srila Bhaktivedanta Narayana Goswami Maharaja",
    "duration_seconds": 296
  },
  "segments": [
    {
      "id": "seg_001",
      "start_time": "0:00",
      "end_time": "1:03",
      "transcript": "...",
      "topics": ["saranagati", "root cause of suffering"]
    }
  ],
  "qa_pairs": [
    {
      "natural_questions": ["Why do I have so many problems?"],
      "answer_segment": "seg_001",
      "answer_timestamp": "0:51 - 1:03"
    }
  ]
}
```

---

## Key Design Principles

1. **Real voice, not synthetic.** Every other agent generates speech. We retrieve it from an actual corpus. This preserves the guru's words "as it is."

2. **Gemini as librarian, not speaker.** Gemini understands the question, searches the corpus, and speaks only a brief introduction. All substantive spiritual content comes from the actual recordings.

3. **No hallucination, no fabrication.** If no matching segment is found, the agent says so honestly. It never invents answers.

4. **Push-to-talk mic.** Prevents ambient speech from triggering unintended searches.

5. **Video alongside audio.** The same segment is available as both audio and video (with English subtitles). The seeker chooses.

---

## Hackathon Submission

- **Track:** Live Agent
- **Category:** Real-time Interaction (Audio/Vision)
- **Demo Video:** [YouTube link TBD]
- **Blog Post:** [link TBD] `#GeminiLiveAgentChallenge`

---

## Future Roadmap

- Scale to 2,500+ videos and 7,000+ audio recordings from the full harikatha corpus
- Media served from Google Cloud Storage (not bundled in the app)
- Video URL mapping from Firestore (not hardcoded naming convention)
- Query logging for analytics and RLHF-based relevance improvement
- Camera input for darshan — seekers point their phone at the deity while asking
- Admin panel for monitoring queries, answers, and search quality

---

## Author

**Amit Bhaskar** — [Vedantic AI Ltd](https://vedanticai.com)
New Zealand | [GitHub](https://github.com/omamitbhaskar)

---

## Licence

MIT — See [LICENCE](LICENCE) for details.

*Built with devotion for the Gemini Live Agent Challenge 2026*
