# Harikatha Live Agent

## What It Is

A multimodal AI agent that lets spiritual seekers ask questions by voice and receive answers in Srila Bhaktivedanta Narayana Goswami Maharaja's own recorded voice—not synthesized, not fabricated, but *retrieved* from a living corpus of harikatha. The AI is the librarian, not the speaker.

## Key Innovation

Every other AI voice agent generates synthetic speech. Harikatha Live Agent retrieves authentic recorded voice from a curated corpus of spiritual discourses. This ensures fidelity to the Guru's original teaching, eliminates hallucination, and honors the principle of "As It Is"—presenting wisdom without fabrication.

## Features

- **Voice-Activated Spiritual Search:** Ask questions conversationally by voice; the agent understands spiritual intent
- **Real Recorded Voice:** Responses feature Gurudeva's actual recorded harikatha, not AI-generated speech
- **Vector-Powered Matching:** Custom semantic search across transcribed discourses with 73-76% accuracy on spiritual Q&A pairs
- **Live Audio & Video Players:** Seekers see synchronized timestamps, full transcripts, and can follow along with original recordings
- **Gemini Live API Integration:** Real-time audio transcription and intent understanding with native speech input/output
- **Push-to-Talk Control:** Essential for live audio agents—prevents ambient speech from triggering unintended searches
- **Web-Based Access:** Modern, responsive interface available instantly via browser

## How It Works

1. Seeker speaks or types a spiritual question via the web interface
2. Browser sends audio via WebSocket to FastAPI backend on Google Cloud Run
3. Backend proxies to Gemini Live API for real-time speech transcription and intent analysis
4. Gemini invokes a custom `search_harikatha` function calling tool
5. Backend generates semantic embedding and queries Firestore with cosine similarity (threshold 0.65)
6. Matching harikatha segments are retrieved—audio URL, timestamps, transcript
7. Gemini provides a brief contextual intro; browser displays audio + video players
8. Seeker hears Gurudeva's authentic recorded voice answering their question

## Technologies Used

- **AI & Language Models:**
  - Gemini 2.5 Flash (native audio preview)
  - Gemini Live API (real-time speech)
  - Gemini Embedding 001 (Vertex AI)
  - Google GenAI SDK v1.14 (Python)

- **Infrastructure:**
  - Google Cloud Run (serverless hosting)
  - Firestore (vector search + corpus storage)
  - Docker (containerization)

- **Backend:**
  - Python 3.11
  - FastAPI
  - WebSockets

- **Frontend:**
  - Vanilla HTML + JavaScript (modular, 3 core modules)

## Data Sources

Corpus of recorded harikatha (spiritual discourses) by Srila Bhaktivedanta Narayana Goswami Maharaja. All content is:
- Pre-segmented into discrete teachings
- Transcribed and indexed
- Embedded with Vertex AI embeddings
- Stored in Firestore for rapid semantic search

## Findings & Learnings

- **Gemini Live Audio Model:** The native audio model occasionally leaks internal "thinking" tokens—requires post-processing filters for clean output
- **Spiritual Vocabulary:** Sanskrit terminology (e.g., *uttama bhakti*, *saranagati*) integrates seamlessly with Gemini's intent understanding, enabling nuanced spiritual Q&A
- **Vector Search Accuracy:** Cosine similarity search with Vertex AI embeddings achieves 73-76% match accuracy for spiritual query-answer pairs
- **Function Calling for Custom Tools:** Gemini's function calling mechanism integrates flawlessly with custom search backends, enabling agentic workflows
- **UX Essentials:** Push-to-talk control is non-negotiable for live audio agents—continuous microphone input causes ambient speech to trigger unintended searches
- **AI as Librarian, Not Author:** The most impactful finding: positioning AI as a retrieval system rather than a generation system fundamentally preserves authenticity and builds trust

## The Vision

Harikatha Live Agent demonstrates how modern AI can serve as a custodian of spiritual wisdom rather than a replacement for it. By preserving and retrieving authentic teachings, the technology honors lineage, eliminates fabrication, and makes profound spiritual knowledge accessible to seekers worldwide—one voice, one question at a time.

---

**Live Demo:** https://harikatha-live-agent-862707561519.us-central1.run.app
**GitHub Repository:** https://github.com/omamitbhaskar/harikatha-live-agent
**Built by:** Amit Bhaskar, Vedantic AI Ltd, New Zealand
