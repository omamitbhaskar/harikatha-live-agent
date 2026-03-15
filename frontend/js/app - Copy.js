/**
 * app.js — Harikatha Live Agent
 *
 * ANSWER-FIRST ARCHITECTURE:
 * 1. User asks question (voice or text)
 * 2. Gemini calls search_harikatha → backend searches Firestore
 * 3. Text answer appears INSTANTLY (milliseconds) from search results
 * 4. Video / Audio available as buttons — user clicks to load on demand
 * 5. Gemini's own audio is DISCARDED (garbled PCM, not needed)
 * 6. Gemini's "thinking" text is FILTERED out
 */

document.addEventListener("DOMContentLoaded", () => {
    // ── Elements ──
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("statusText");
    const conversation = document.getElementById("conversation");
    const connectBtn = document.getElementById("connectBtn");
    const micBtn = document.getElementById("micBtn");
    const textInput = document.getElementById("textInput");
    const sendBtn = document.getElementById("sendBtn");
    const harikathaPlayer = document.getElementById("harikathaPlayer");
    const playerQuestion = document.getElementById("playerQuestion");
    const playerAnswer = document.getElementById("playerAnswer");
    const playerTitle = document.getElementById("playerTitle");
    const harikathaAudio = document.getElementById("harikathaAudio");
    const harikathaVideo = document.getElementById("harikathaVideo");
    const btnLoadVideo = document.getElementById("btnLoadVideo");
    const btnLoadAudio = document.getElementById("btnLoadAudio");
    const visualiserCanvas = document.getElementById("visualiser");
    const vCtx = visualiserCanvas.getContext("2d");

    // ── State ──
    const client = new GeminiLiveClient();
    const capture = new AudioCapture();
    let isRecording = false;
    let agentTextBuffer = "";
    let animFrame = null;
    let segmentStopTimer = null;
    let visualiserActive = false;
    // Current result for media loading
    let currentResult = null;

    // ── Status ──
    function setStatus(state, text) {
        statusDot.className = "status-dot " + state;
        statusText.textContent = text;
    }

    // ── Add message to conversation ──
    function addMessage(role, text) {
        const welcome = conversation.querySelector(".welcome-message");
        if (welcome) welcome.remove();

        const div = document.createElement("div");
        div.className = "msg " + role;
        div.textContent = text;
        conversation.appendChild(div);
        conversation.scrollTop = conversation.scrollHeight;
    }

    // ── Filter Gemini's "thinking" text ──
    function isThinkingText(text) {
        if (!text) return true;
        const lower = text.toLowerCase();
        const thinkingPatterns = [
            "**", "i'm now", "i've initiated", "my aim is", "my plan is",
            "my next step", "i'll structure", "i'll analyze", "i'll formulate",
            "i'm preparing", "i'm expanding", "i'm refining", "i'm currently",
            "i'm employing", "i'm eager", "now awaiting", "after the expanded",
            "search results may", "search_harikatha", "function calling", "tool call",
        ];
        return thinkingPatterns.some(p => lower.includes(p));
    }

    function cleanAgentText(text) {
        if (!text) return "";
        let cleaned = text.replace(/\*\*[^*]*\*\*/g, "").trim();
        cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
        if (isThinkingText(cleaned)) return "";
        return cleaned;
    }

    // ── Visualiser ──
    function drawVisualiser() {
        const w = visualiserCanvas.width;
        const h = visualiserCanvas.height;
        vCtx.clearRect(0, 0, w, h);

        if (visualiserActive) {
            const midY = h / 2;
            const barCount = 30;
            const barWidth = w / barCount;
            const now = Date.now() / 1000;
            for (let i = 0; i < barCount; i++) {
                const val = 0.2 + 0.3 * Math.sin(now * 3 + i * 0.5);
                const barH = val * midY * 0.6;
                const alpha = 0.2 + val * 0.4;
                vCtx.fillStyle = `rgba(232, 168, 57, ${alpha})`;
                vCtx.fillRect(i * barWidth + 1, midY - barH, barWidth - 2, barH * 2);
            }
        }
        animFrame = requestAnimationFrame(drawVisualiser);
    }

    // ══════════════════════════════════════════════════════════════════
    // ANSWER-FIRST: Show text answer INSTANTLY when search results arrive
    // ══════════════════════════════════════════════════════════════════
    function showAnswerInstantly(result, queryText) {
        if (!result) return;

        currentResult = result;
        const startSec = result.start_seconds || 0;
        const endSec = result.end_seconds || 0;

        // 1. Show the question
        if (queryText) {
            playerQuestion.textContent = queryText;
            playerQuestion.style.display = "block";
        } else {
            playerQuestion.style.display = "none";
        }

        // 2. Show the answer text INSTANTLY
        const answerText = result.transcript || result.answer_summary || "";
        if (answerText) {
            playerAnswer.textContent = answerText;
            playerAnswer.style.display = "block";
        } else {
            playerAnswer.style.display = "none";
        }

        // 3. Show source title
        playerTitle.textContent = result.source_title || "Gurudeva's Harikatha";

        // 4. Show media buttons (don't load media yet)
        if (result.audio_url) {
            btnLoadAudio.style.display = "inline-flex";
            // Check if video might exist (derived from audio URL)
            const videoUrl = result.audio_url.replace('.mp3', '_badger_eng_subs.mp4');
            btnLoadVideo.style.display = "inline-flex";
            // Store URLs as data attributes for on-demand loading
            btnLoadAudio.dataset.url = result.audio_url;
            btnLoadAudio.dataset.start = startSec;
            btnLoadAudio.dataset.end = endSec;
            btnLoadVideo.dataset.url = videoUrl;
            btnLoadVideo.dataset.start = startSec;
            btnLoadVideo.dataset.end = endSec;
        } else {
            btnLoadAudio.style.display = "none";
            btnLoadVideo.style.display = "none";
        }

        // 5. Hide the actual players until user clicks a button
        harikathaAudio.style.display = "none";
        harikathaAudio.src = "";
        harikathaVideo.style.display = "none";
        harikathaVideo.src = "";

        // 6. Show the answer panel
        harikathaPlayer.style.display = "block";
        conversation.scrollTop = conversation.scrollHeight;
        setStatus("connected", "Answer ready — ask another question");
    }

    // ── Load and play AUDIO on demand ──
    function loadAndPlayAudio() {
        const url = btnLoadAudio.dataset.url;
        const startSec = parseFloat(btnLoadAudio.dataset.start) || 0;
        const endSec = parseFloat(btnLoadAudio.dataset.end) || 0;
        if (!url) return;

        harikathaAudio.src = url;
        harikathaAudio.style.display = "block";
        btnLoadAudio.textContent = "Loading audio...";

        harikathaAudio.onloadedmetadata = () => {
            harikathaAudio.currentTime = startSec;
            harikathaAudio.play().catch(() => {});
            btnLoadAudio.textContent = "🔊 Playing Audio";
            visualiserActive = true;
        };

        harikathaAudio.onerror = () => {
            btnLoadAudio.textContent = "Audio not available";
            harikathaAudio.style.display = "none";
        };

        // Auto-stop at end_seconds
        if (endSec > startSec) {
            harikathaAudio.addEventListener("timeupdate", function onTimeUpdate() {
                if (harikathaAudio.currentTime >= endSec) {
                    harikathaAudio.pause();
                    harikathaAudio.removeEventListener("timeupdate", onTimeUpdate);
                    visualiserActive = false;
                    btnLoadAudio.textContent = "🔊 Listen Again";
                    setStatus("connected", "Segment finished — ask another question");
                }
            });
        }

        harikathaAudio.onended = () => {
            visualiserActive = false;
            btnLoadAudio.textContent = "🔊 Listen Again";
            setStatus("connected", "Connected — ask another question");
        };
    }

    // ── Load and play VIDEO on demand ──
    function loadAndPlayVideo() {
        const url = btnLoadVideo.dataset.url;
        const startSec = parseFloat(btnLoadVideo.dataset.start) || 0;
        const endSec = parseFloat(btnLoadVideo.dataset.end) || 0;
        if (!url) return;

        harikathaVideo.src = url;
        harikathaVideo.style.display = "block";
        btnLoadVideo.textContent = "Loading video...";

        harikathaVideo.onloadedmetadata = () => {
            harikathaVideo.currentTime = startSec;
            harikathaVideo.play().catch(() => {});
            btnLoadVideo.textContent = "▶ Playing Video";
        };

        harikathaVideo.onerror = () => {
            console.warn("Video not available:", url);
            btnLoadVideo.textContent = "Video not available";
            btnLoadVideo.style.opacity = "0.4";
            harikathaVideo.style.display = "none";
        };

        // Auto-stop at end_seconds
        if (endSec > startSec) {
            harikathaVideo.addEventListener("timeupdate", function onTimeUpdate() {
                if (harikathaVideo.currentTime >= endSec) {
                    harikathaVideo.pause();
                    harikathaVideo.removeEventListener("timeupdate", onTimeUpdate);
                    btnLoadVideo.textContent = "▶ Watch Again";
                    setStatus("connected", "Segment finished — ask another question");
                }
            });
        }

        harikathaVideo.onended = () => {
            btnLoadVideo.textContent = "▶ Watch Again";
            setStatus("connected", "Connected — ask another question");
        };
    }

    // ── Wire up media buttons ──
    btnLoadAudio.addEventListener("click", loadAndPlayAudio);
    btnLoadVideo.addEventListener("click", loadAndPlayVideo);

    // ══════════════════════════════════════════════════════════════════
    // WebSocket callbacks
    // ══════════════════════════════════════════════════════════════════

    // ── Connect / Disconnect ──
    connectBtn.addEventListener("click", () => {
        if (client.isConnected) {
            client.disconnect();
            capture.stop();
            harikathaAudio.pause();
            harikathaVideo.pause();
            if (segmentStopTimer) clearTimeout(segmentStopTimer);
            return;
        }
        setStatus("connecting", "Connecting to Gemini...");
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;
        client.connect();
    });

    client.onSetupComplete = () => {
        setStatus("connected", "Connected — ask a question");
        connectBtn.textContent = "Disconnect";
        connectBtn.disabled = false;
        connectBtn.classList.add("connected");
        micBtn.disabled = false;
        addMessage("system", "Hare Krishna! Ask any spiritual question — by voice or text.");
        drawVisualiser();
    };

    client.onDisconnect = () => {
        setStatus("", "Disconnected");
        connectBtn.textContent = "Connect";
        connectBtn.disabled = false;
        connectBtn.classList.remove("connected");
        micBtn.disabled = true;
        isRecording = false;
        micBtn.classList.remove("recording");
        capture.stop();
        harikathaAudio.pause();
        harikathaVideo.pause();
        visualiserActive = false;
        if (animFrame) cancelAnimationFrame(animFrame);
        if (segmentStopTimer) clearTimeout(segmentStopTimer);
    };

    client.onError = (msg) => {
        setStatus("error", "Error: " + msg);
        connectBtn.textContent = "Connect";
        connectBtn.disabled = false;
        connectBtn.classList.remove("connected");
    };

    // Discard Gemini's garbled PCM audio — we only play Gurudeva's real recordings
    client.onAudio = (base64Data) => {
        visualiserActive = true;
    };

    client.onText = (text) => {
        agentTextBuffer += text;
    };

    client.onTurnComplete = () => {
        visualiserActive = false;

        // Show clean Gemini text (if any — usually just "Gurudeva speaks about...")
        if (agentTextBuffer.trim()) {
            const cleaned = cleanAgentText(agentTextBuffer);
            if (cleaned && cleaned.length > 5) {
                addMessage("agent", cleaned);
            }
            agentTextBuffer = "";
        }

        // Answer was already shown instantly by onHarikathaResult
        // Nothing else to do here
        setStatus("connected", "Connected — ask another question");
    };

    client.onInterrupted = () => {
        agentTextBuffer = "";
        visualiserActive = false;
        harikathaAudio.pause();
        harikathaVideo.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);
    };

    // ══════════════════════════════════════════════════════════════════
    // THE KEY MOMENT: search results arrive → show answer INSTANTLY
    // ══════════════════════════════════════════════════════════════════
    client.onHarikathaResult = (results, query) => {
        if (!results || results.length === 0) {
            addMessage("system", "No matching harikatha found for: " + query);
            return;
        }

        const best = results[0];
        const scorePercent = Math.round(best.score * 100);
        addMessage("harikatha-found",
            `Found! (${scorePercent}% match) — "${best.source_title || "Harikatha"}"`
        );

        // INSTANT: show question + text answer + media buttons NOW
        showAnswerInstantly(best, query);
    };

    // ══════════════════════════════════════════════════════════════════
    // Mic (push-to-talk)
    // ══════════════════════════════════════════════════════════════════
    micBtn.addEventListener("mousedown", startRecording);
    micBtn.addEventListener("mouseup", stopRecording);
    micBtn.addEventListener("mouseleave", stopRecording);
    micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    micBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });

    async function startRecording() {
        if (!client.isSetupComplete || isRecording) return;
        harikathaAudio.pause();
        harikathaVideo.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        isRecording = true;
        micBtn.classList.add("recording");
        setStatus("connected", "Listening... (release to stop)");

        capture.onAudioData = (base64Chunk) => {
            client.sendAudio(base64Chunk);
        };

        try {
            await capture.start();
        } catch (e) {
            console.error("Mic error:", e);
            setStatus("error", "Microphone access denied");
            isRecording = false;
            micBtn.classList.remove("recording");
        }
    }

    function stopRecording() {
        if (!isRecording) return;
        isRecording = false;
        micBtn.classList.remove("recording");
        capture.stop();
        setStatus("connected", "Processing...");
    }

    // ══════════════════════════════════════════════════════════════════
    // Text input
    // ══════════════════════════════════════════════════════════════════
    sendBtn.addEventListener("click", sendTextQuery);
    textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendTextQuery();
        }
    });

    function sendTextQuery() {
        const text = textInput.value.trim();
        if (!text) return;
        if (!client.isSetupComplete) {
            addMessage("system", "Please connect first");
            return;
        }
        harikathaAudio.pause();
        harikathaVideo.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        addMessage("user", text);
        client.sendText(text);
        textInput.value = "";
        setStatus("connected", "Searching Gurudeva's harikatha...");
    }
});
