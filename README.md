# Harikatha Live Agent
### "As It Is" — Real Voice, Real Wisdom, Real-Time

> A multimodal AI agent that lets seekers ask spiritual questions by voice and receive answers in Srila Bhaktivedanta Narayana Goswami Maharaja's own recorded voice and video — not synthesized, not fabricated, but retrieved from the actual corpus of harikatha.

Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/) | **Live Agent Track**

---

## Architecture

```
Seeker (Browser/Mic)
    → Gemini Live API (Speech-to-Text + Intent)
    → FastAPI Backend (Cloud Run)
    → Vector Search (Firestore + Vertex AI Embeddings)
    → Audio/Video Corpus (Cloud Storage)
    → Gemini Agent (Context + Segment Selection)
    → Video/Audio Response → Seeker
```

See [docs/architecture.md](docs/architecture.md) for the full architecture diagram.

---

## Tech Stack

| Requirement | Technology |
|---|---|
| Gemini Model | Gemini 3.1 Pro / 2.0 Flash |
| SDK | Google GenAI SDK (Python) |
| Google Cloud | Cloud Run, Cloud Storage, Firestore, Vertex AI |
| Backend | Python 3.11+ / FastAPI |
| Frontend | HTML + JavaScript (vanilla) |
| Containerisation | Docker |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Docker Desktop
- Google Cloud CLI (`gcloud`)
- A Google Cloud project with billing enabled

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

# Set your API key
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# Run locally
uvicorn src.main:app --reload --port 8080
```

### Deploy to Google Cloud Run

```bash
# One-command deployment
./scripts/deploy.sh
```

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions.

---

## Project Structure

```
harikatha-live-agent/
├── README.md                  # You are here
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Container definition
├── .env.example               # Environment variable template
├── .gitignore                 # Git ignore rules
│
├── src/                       # Application source code
│   ├── __init__.py
│   ├── main.py                # FastAPI application entry point
│   ├── config.py              # Configuration and environment variables
│   ├── agent/                 # Gemini agent logic
│   │   ├── __init__.py
│   │   ├── orchestrator.py    # Main agent orchestration
│   │   ├── tools.py           # Tool definitions for Gemini
│   │   └── prompts.py         # System prompts and templates
│   ├── search/                # Corpus search engine
│   │   ├── __init__.py
│   │   ├── embeddings.py      # Vertex AI embedding generation
│   │   ├── vector_store.py    # Firestore vector search
│   │   └── ranker.py          # Result ranking and filtering
│   ├── corpus/                # Corpus data management
│   │   ├── __init__.py
│   │   ├── models.py          # Data models for segments, QA pairs
│   │   ├── loader.py          # Load corpus into Firestore
│   │   └── transcriber.py     # Audio/video transcription helpers
│   └── api/                   # API route definitions
│       ├── __init__.py
│       ├── routes.py          # HTTP endpoints
│       └── websocket.py       # WebSocket for live interaction
│
├── frontend/                  # Browser client
│   ├── index.html             # Main page
│   ├── css/
│   │   └── style.css          # Styling
│   └── js/
│       ├── app.js             # Main application logic
│       ├── audio.js           # Microphone and audio playback
│       └── gemini-live.js     # Gemini Live API WebSocket client
│
├── corpus/                    # Harikatha corpus data (NOT in git for large files)
│   ├── README.md              # Corpus documentation
│   ├── segments/              # JSON segment files
│   │   └── sample-001.json    # Example: "We are the cause of our problems"
│   └── media/                 # Audio/video files (gitignored, stored in Cloud Storage)
│       └── .gitkeep
│
├── scripts/                   # Deployment and utility scripts
│   ├── deploy.sh              # One-command Cloud Run deployment
│   ├── setup_gcp.sh           # GCP project setup automation
│   ├── upload_corpus.sh       # Upload corpus to Cloud Storage
│   └── seed_firestore.py      # Seed Firestore with corpus data
│
├── docs/                      # Documentation
│   ├── architecture.md        # Architecture diagram and explanation
│   ├── deployment.md          # Deployment guide
│   ├── corpus-format.md       # How to prepare corpus data
│   └── hackathon-submission.md # Devpost submission notes
│
├── tests/                     # Test files
│   ├── test_gemini.py         # API connection test (tracer bullet)
│   ├── test_search.py         # Search accuracy tests
│   └── test_agent.py          # Agent integration tests
│
└── blog/                      # Hackathon blog post (+0.6 bonus points)
    └── building-harikatha-live-agent.md
```

---

## Corpus Format

Each harikatha segment is stored as a JSON file with this structure:

```json
{
  "source": {
    "title": "We are the cause of Our Problems",
    "speaker": "Srila Bhaktivedanta Narayana Goswami Maharaja",
    "date": "Unknown",
    "duration_seconds": 296
  },
  "segments": [
    {
      "id": "seg_001",
      "start_time": "0:00",
      "end_time": "1:03",
      "transcript": "...",
      "topics": ["saranagati", "root cause of suffering"],
      "key_concepts": ["saranagati", "krishna-nama"]
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

See [docs/corpus-format.md](docs/corpus-format.md) for full specification.

---

## Hackathon Submission

- **Track:** Live Agent
- **Category:** Real-time Interaction (Audio/Vision)
- **Demo Video:** [YouTube link TBD]
- **Blog Post:** [link TBD] `#GeminiLiveAgentChallenge`

---

## Author

**Amit Bhaskar** — [Vedantic AI Ltd](https://vedanticai.com)  
New Zealand | [GitHub](https://github.com/omamitbhaskar)

---

## Licence

MIT — See [LICENCE](LICENCE) for details.

*Built with devotion for the Gemini Live Agent Challenge 2026*
