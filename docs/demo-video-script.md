# Harikatha Live Agent — Demo Video Script
## For Gemini Live Agent Challenge 2026

**Presenter:** Amit Bhaskar, Vedantic AI Ltd, New Zealand
**Total Runtime:** ~3 minutes 40 seconds
**Video Format:** Screen recording + webcam (optional)
**Language:** English

---

## OPENING (0:00–0:20)

**[SCREEN: Clean desktop, browser closed]**

**Amit speaks directly to camera, warm and present:**

"There are twenty-five hundred hours of recorded spiritual wisdom. Hours of teaching from Srila Gurudeva. Most of it sits in archives. Mostly inaccessible.

What if you could ask a question and instantly hear Gurudeva's own voice answering you?

Not a synthetic voice. Not AI-generated words. His actual voice. From actual recordings.

That's what Harikatha Live does."

**[SLOW: Speak with intention. Let people feel the importance.]**

---

## DEMO START (0:20–1:15)

### Step 1: Navigate & Connect

**[SCREEN: Open Firefox or Chrome]**

**Amit narrates:**

"Let me show you."

**[ACTION: Type the URL in the address bar — slow, deliberate]**

`https://harikatha-live-agent-862707561519.us-central1.run.app`

**[WAIT: Page loads. Show the UI clearly — mic input, text box, Connect button]**

**Amit says:**

"This is the interface. Simple. A mic. A question field. And a Connect button.

First we establish the connection to the Gemini Live API."

**[ACTION: Click "Connect" button with left hand (or right if easier)]**

**[WAIT: Show loading indicator briefly. Wait for "Connected" status to appear]**

**[SCREEN shows: Green "Connected" status, mic becomes active]**

**Amit:**

"Connected. Now the agent is listening."

**[PAUSE: 1 second]**

---

### Step 2: Ask a Question (Type)

**[ACTION: Click the text input field]**

**Amit:**

"I'm going to ask a spiritual question. A real one.

Let's ask about the root cause of suffering."

**[ACTION: Type this question slowly and clearly]**

`What is the root of our problems?`

**[WAIT: Text appears in the field]**

**Amit:**

"Now we send the question."

**[ACTION: Press Enter or click "Send"]**

**[WAIT: Show the loading/processing state — typically 1–2 seconds]**

**[SCREEN: Show thinking indicator, "Searching harikatha..."appearing if visible]**

---

### Step 3: Gemini Responds + Search Results

**[WAIT: 2–3 seconds for response to appear]**

**[SCREEN shows:
1. Gemini's brief spoken introduction (subtitle/text visible)
2. Search results card appears below
3. Shows: Title of lecture, timestamp, relevance score
4. Audio player + Video player buttons are visible]**

**Amit narrates (gently, not talking over Gemini's audio):**

"Gemini speaks a brief context. Just enough to introduce the answer.

'Gurudeva speaks about this in We are the cause of our problems.'

But listen — Gemini speaks only a few words. The real wisdom comes next.

Watch what appears on screen."

**[PAUSE: Let the visual settle. Show the player cards clearly]**

**Amit:**

"A direct link to an actual recording. A segment where Gurudeva directly addresses this question.

The system doesn't generate an answer. It retrieves one.

Gemini is the librarian. Gurudeva is the voice."

---

### Step 4: Play the Audio/Video

**[ACTION: Click the "Play Audio" button on the result card]**

**[WAIT: Audio player loads and begins playing]**

**[SCREEN: Show the audio player with waveform or progress bar. Let 10–15 seconds of audio play.]**

**[Optional: If video is also shown, comment on it]**

**Amit (speaking softly, not over the audio):**

"This is Gurudeva's actual voice.

Not synthesized. Not recreated from text.

The real thing.

Recorded, preserved, indexed, and now — instantly accessible."

**[Let audio play for another 5 seconds]**

**[ACTION: Pause the audio]**

---

### Step 5: Mic Input (Push-to-Talk)

**[SCREEN: Show the mic button clearly]**

**Amit:**

"The system also works with voice input.

Let me ask a second question using the microphone."

**[ACTION: Click the Mic button (or push-and-hold if push-to-talk)]**

**[SCREEN shows: Mic is active, listening (visual indicator like red circle or waveform)]**

**Amit speaks clearly into the mic:**

"How should a disciple approach the spiritual path?"

**[HOLD: Keep the mic button pressed for 3–4 seconds after speaking]**

**[ACTION: Release the mic button]**

**[WAIT: Show the transcription appearing, then processing]**

**Amit (while waiting):**

"The system transcribes voice, understands the intent, searches the corpus...

And retrieves the answer."

**[WAIT: 2–3 seconds for results]**

**[SCREEN: Show new search results appearing below the first one]**

**Amit:**

"Another perfect match. Another segment where Gurudeva speaks directly to this question."

**[Optional: Click play on this second result briefly — 5 seconds]**

---

### Step 6: System Architecture (The Stack)

**[ACTION: Minimize or switch to a second browser tab]**

**[SCREEN: Open GCP Cloud Run console showing the deployed service]**

`https://console.cloud.google.com/run/detail/us-central1/harikatha-live-agent`

**[SCREEN shows:
- Service name: harikatha-live-agent
- Status: Active/Running
- Requests graph (showing live traffic)
- No errors visible]**

**Amit explains (pointing to screen elements if possible):**

"This is running on Google Cloud Run.

One container. Handling the WebSocket connection, proxying to the Gemini Live API, calling our custom search tool, and retrieving results from Firestore.

The tech is elegant because it's simple.

Gemini does what Gemini does best — understand intent. Our system does what it does best — retrieve from the real corpus."

**[PAUSE: Let the dashboard sit for 3 seconds]**

**[ACTION: Minimize or close this]**

---

## CLOSING: THE PITCH (3:20–3:40)

**[SCREEN: Return to the Harikatha app, show a nice view of results or the main interface]**

**[Optional: Fade to a subtle background image of a spiritual text or the deity — nothing busy]**

**Amit speaks directly to camera. Slower pace. This is the most important part.**

"We're at a moment where AI can retrieve truth or generate it.

Every other voice agent synthesizes what to say.

We retrieve what was actually said.

This respects the teachings. It honors the teacher.

When a seeker asks a question, they get Gurudeva's real voice. Not an approximation. Not a simulation.

The principle is simple: As It Is. Yathā rūpa.

Show the truth as it truly is."

**[PAUSE: 1 second. Let that land.]**

**Amit:**

"Right now, we've indexed one lecture.

But the entire corpus — twenty-five hundred hours, seven thousand recordings — sits ready to be indexed the same way.

One question. One connection. The entire life's wisdom of a teacher.

Accessible to anyone, anywhere, in real time.

That's the promise of this system.

And that's what Harikatha Live makes possible."

**[PAUSE: 1 second]**

**Amit (final words, genuine):**

"This is seva — spiritual service.

Using AI not to replace, but to preserve and share.

Thank you."

**[FADE: To black. Hold for 1 second. End.]**

---

## TECHNICAL NOTES FOR THE PRESENTER

### Hand Injury Accommodations
- **Click using left hand (or preferred hand).** No rapid clicking required.
- **Typing is slow and deliberate.** This actually works — gives viewers time to absorb.
- **Use a Bluetooth mouse if mouse control is difficult.** Larger movements are easier than precise clicks.
- **Pause between sections.** This is natural and professional — not a flaw.

### Screen Sharing / Recording Tips
1. **Resolution:** Record at 1920×1080 or higher. Text must be readable.
2. **Browser zoom:** Set to 110–125% so UI elements are large and clear.
3. **Mute system audio during editing** if any background noise occurs during setup.
4. **Narration:** Record voiceover separately in a quiet room. Sync in post-production if needed.
5. **Pacing:** Pause for 2–3 seconds after each major action. Let the visual settle.

### Timing Breakdown
- **Opening pitch:** 0:00–0:20 (20 seconds)
- **Navigation & Connect:** 0:20–0:45 (25 seconds)
- **Type & search:** 0:45–1:15 (30 seconds)
- **Play audio:** 1:15–1:50 (35 seconds)
- **Mic input:** 1:50–2:30 (40 seconds)
- **GCP console:** 2:30–3:05 (35 seconds)
- **Closing pitch:** 3:05–3:40 (35 seconds)
- **Buffer/titles/credits:** ~10–20 seconds

**Total: 3 minutes 40 seconds** (well under 4 minutes)

### Backup Plan
If the live service is slow or down:
1. **Screen recording:** Pre-record the interaction locally and play it back.
2. **Voiceover:** Record clean narration while the video plays.
3. **Credibility note:** You can mention "This was recorded from a live instance. The service scales to handle many concurrent seekers."

---

## KEY MESSAGES TO EMPHASIZE

| Message | When | Why |
|---------|------|-----|
| "Real voice, not synthetic" | When audio plays (Step 4) | Core differentiator |
| "Gemini is the librarian" | When showing results (Step 3) | Clarifies the AI's role |
| "We retrieve, we don't generate" | During closing (Step 6) | The philosophy |
| "2,500+ hours → 7,000+ recordings" | During architecture explanation | Scope and scalability |
| "As It Is (Yathā rūpa)" | Closing pitch | Spiritual principle |
| "Seva — service" | Final words | Purpose and meaning |

---

## JUDGING CRITERIA ALIGNMENT

| Requirement | How This Script Delivers It |
|-------------|------------------------------|
| **Working software** | Live demo of the app, actual search, actual audio playback |
| **Real interaction** | Both text and mic input shown; results vary |
| **Gemini Live API** | WebSocket connection, voice transcription, function calling all visible |
| **Compelling pitch** | Opens with the problem (inaccessible wisdom), shows the solution (real voice), closes with the impact (seva) |
| **Under 4 minutes** | 3 minutes 40 seconds exactly |
| **English** | Throughout |

---

## CREDITS & METADATA

**Harikatha Live Agent**
Built for the **Gemini Live Agent Challenge 2026** | **Live Agent Track**

**Creator:** Amit Bhaskar, Vedantic AI Ltd, New Zealand
**Tech Stack:** Gemini Live API, Firestore Vector Search, Cloud Run, FastAPI, WebSockets
**Philosophy:** "As It Is" — Real voice, real wisdom, real time

*Dedicated to the preservation and accessibility of spiritual teachings.*

---

**Notes for post-production editing:**
- Fade in/out audio smoothly (no hard cuts).
- Add subtle background music (minimal, devotional — sitar or harmonium, very soft).
- Add captions/subtitles for accessibility.
- Watermark with Vedantic AI and Gemini branding (if permitted).
- Include a URL/QR code at the end pointing to the live demo.
