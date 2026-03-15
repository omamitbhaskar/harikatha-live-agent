# Building the Harikatha Live Agent: A Spiritual QA System with Real Voice

**Author:** Amit Bhaskar, Vedantic AI Ltd, New Zealand

---

When I started the Harikatha Live Agent project for the #GeminiLiveAgentChallenge, I wasn't just building another AI chatbot. I was trying to solve a problem that's been bothering me for years: how do you deliver authentic spiritual teachings at scale without losing the voice, nuance, and presence of the original teacher?

The answer I landed on is unconventional. Instead of generating synthetic speech like every other voice AI, the Harikatha Live Agent retrieves *actual audio recordings* of Srila Bhaktivedanta Narayana Goswami Maharaja answering questions. Users ask via voice, and they receive answers in the guru's real recorded voice—not fabricated, not synthesized. Just as it is.

This post documents the technical journey of building this system using Google's Gemini Live API, and the unexpected challenges that emerge when you prioritize authenticity over convenience.

## The Problem Space

Spiritual knowledge is traditionally transmitted through direct conversation. A student sits with a teacher, asks a question, and receives wisdom in the teacher's own voice and presence. When that teacher is no longer alive, how do you preserve that transmission?

Narayana Maharaja spent decades giving audio lectures, interviews, and classes—thousands of hours of recorded material. The material exists, but it's fragmented across files, languages, and decades. A spiritual seeker can't easily ask their question and receive a directly relevant response from the guru's mouth.

Enter the challenge: Can I build a system that makes this possible? And can I do it using the latest AI tools?

## Architecture: Real-Time WebSocket Proxying

The architecture is deceptively simple on paper:

```
User speaks → WebSocket → FastAPI (Cloud Run) → Gemini Live API
    → search_harikatha tool → Firestore vector search → audio segment returned
    → browser plays real voice
```

But implementing it was trickier than it sounds.

The Gemini Live API communicates over WebSockets with real-time audio. The browser can't directly connect to Google's servers for security reasons, so I needed to build a proxy. FastAPI handles the bidirectional WebSocket connection between browser and backend, while simultaneously maintaining a connection to Gemini's Live API.

Here's the essential pattern:

```python
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # Connect to Gemini Live API
    gemini_ws = await create_gemini_connection()

    # Bidirectional relay with tool call interception
    async for message in websocket.iter_bytes():
        # Forward audio to Gemini
        await gemini_ws.send_bytes(message)

        # Listen for Gemini responses
        response = await gemini_ws.recv_bytes()

        # Intercept tool calls before sending to browser
        if is_tool_call(response):
            tool_result = await handle_tool_call(response)
            # Send result back to Gemini, which refines its response
            await gemini_ws.send_bytes(tool_result)
        else:
            # Forward speech response to browser
            await websocket.send_bytes(response)
```

The magic is in the tool interception. Gemini doesn't have direct access to our vector database, so when it detects a spiritual question, it calls the `search_harikatha` tool. The backend catches this call, executes the search server-side, and feeds the results back to Gemini—all without the browser knowing anything about it.

## Function Calling: Teaching Gemini to Search

Function calling with the Gemini Live API was surprisingly elegant. I defined the search tool like this:

```python
tools = [
    {
        "name": "search_harikatha",
        "description": "Search the harikatha corpus for teachings related to the user's question. Use this when the user asks a spiritual question about bhakti, meditation, Krishna consciousness, or related topics.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The semantic essence of the user's question in 1-2 sentences"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Relevant Sanskrit/Hindi spiritual terms (e.g., 'bhakti', 'saranagati', 'uttama-bhakti')"
                }
            },
            "required": ["query"]
        }
    }
]
```

Gemini learned to call this automatically. The moment a user asks about spiritual practice, karma, or devotion, it triggers a search. What impressed me most was that the model understood when *not* to search—casual greetings and off-topic questions skip the tool entirely.

## The Vector Search Challenge: Embedding Spiritual Vocabulary

Here's where things got interesting. Gemini embeddings work brilliantly on English, but what about Sanskrit and Hindi spiritual terms?

I tested vectors for words like:
- **uttama bhakti** (supreme devotion)
- **saranagati** (surrender)
- **bhava** (emotional state in spiritual practice)
- **rasa** (relish, taste of devotion)

The Gemini Embedding API handled multilingual terms surprisingly well. I achieved **73-76% cosine similarity accuracy** when matching user queries to relevant harikatha segments. That means when someone asks about surrender, the system correctly identified answers about saranagati roughly 3 out of 4 times.

The indexing strategy was straightforward:
1. Segment the audio corpus into logical chunks (usually 1-3 minutes each)
2. Transcribe each segment
3. Generate embeddings using `gemini-embedding-001`
4. Store metadata (audio URL, video timestamp, topic tags) in Firestore
5. Index the embeddings for vector search

The hardest part wasn't the embeddings—it was the segmentation. Harikatha discourse is philosophical and flowing. Where do you split a 2-hour lecture without breaking the meaning?

## The Thinking Text Problem

Here's a problem I didn't anticipate: **Gemini's native audio model leaks internal reasoning.**

When using `gemini-2.5-flash-native-audio-preview`, the model's internal reasoning process sometimes appears in the text response as well as the audio. You'd get something like:

> "Let me search for teachings on this topic... [thinking] The user is asking about karma, I should search for relevant segments... [/thinking] Here's the answer from Maharaja..."

Users don't want to hear the backend deliberation. So I added regex-based filtering to strip out thinking markers before passing responses to audio generation:

```python
def clean_thinking_text(response):
    # Remove thinking blocks from response text
    cleaned = re.sub(r'\[thinking\](.*?)\[/thinking\]', '', response, flags=re.DOTALL)
    cleaned = re.sub(r'Let me search.*?\.\.\.\n*', '', cleaned)
    return cleaned.strip()
```

It's a blunt instrument, but it works. Ideally, the API would have a parameter to disable thinking output entirely, but for now, regex is our friend.

## The Always-On Mic Disaster

Early versions used an always-on microphone—the browser constantly streamed audio to the backend. I thought this would create a more natural experience, like talking to someone in the room.

It didn't. Instead, ambient noise—a car passing, a dog barking, a fan in the background—would trigger searches. The system would think you asked a spiritual question when you were just living your life.

I switched to **push-to-talk**: users hold a button to record. It's less flashy, but it actually works. Sometimes the simplest interface is the right one.

## Real Voice vs Synthetic: A Philosophical Stand

This is the core decision that shaped the entire project.

Every modern voice AI generates synthetic speech. It's impressive—voices sound natural, modulation is perfect. But it's not real. It's an imitation.

Building Harikatha Live Agent taught me that this distinction matters, especially in spiritual contexts. When seekers hear Narayana Maharaja answer their question, they're not hearing an approximation or a trained model. They're hearing the actual person—his voice, his cadence, his presence.

The tradeoff is obvious: synthetic speech can answer any question instantly. Retrieved audio can only answer questions that were already addressed in the corpus. But within that constraint, authenticity wins.

## Tech Stack Summary

- **Gemini Live API** (gemini-2.5-flash-native-audio-preview) for real-time conversational reasoning
- **Gemini Embedding API** (gemini-embedding-001) for vector search
- **FastAPI + WebSockets** for the proxy layer
- **Google Cloud Run** for serverless hosting
- **Firestore** for both vector indexing and metadata storage
- **Docker** for containerization
- **Vanilla HTML/JS** frontend (no frameworks—just WebSocket calls and audio playback)

## Key Learnings

**1. Gemini's Live API is a game-changer for real-time agents.** The audio-native model eliminates the latency and quality loss of separate transcription/generation pipelines. It's genuinely different from prior APIs.

**2. Function calling is the secret sauce.** Seamless tool integration means the model can orchestrate complex workflows without you building state machines. Gemini just calls your functions when it needs them.

**3. Firestore + embeddings is a viable vector search solution.** You don't always need Pinecone or Weaviate. If your dataset fits in Firestore and your QPS is reasonable, it works fine.

**4. The hardest problem is never the technology.** It was segmenting and indexing the corpus accurately. The first attempt at automatic segmentation was disaster—spiritual teachings don't have natural breakpoints. I ended up with a hybrid approach: algorithmic chunking with manual review.

**5. Authenticity matters.** In an age of synthetic everything, users actually notice and care when something is real.

## What's Next

The Harikatha Live Agent is just the beginning. Future work includes:
- Expanding the corpus to other spiritual teachers and traditions
- Adding multiple language support (Gujarati, Tamil, Bengali)
- Building an admin panel for corpus management
- Implementing feedback loops so the system learns which segments users find most helpful
- Eventually, building this into a structured library of spiritual knowledge

For now, the system is live, and seekers are asking questions. Maharaja's voice is answering. It's not perfect, but it's real.

---

**Building the Harikatha Live Agent for the #GeminiLiveAgentChallenge has been a reminder that the best tools aren't the ones with the most features—they're the ones that disappear. When the technology becomes transparent, what remains is just a student, a question, and a teacher's voice. That's what we built.**

#GeminiLiveAgentChallenge
