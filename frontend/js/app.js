/**
 * app.js — Harikatha Live Agent
 *
 * Flow: Question → Search → Brief text intro → Gurudeva's voice plays
 * - Gemini's PCM audio is DISCARDED (garbled/not needed)
 * - Gemini's "thinking" text is FILTERED out
 * - Only clean, short agent responses are shown
 * - Gurudeva's audio plays at exact segment timestamps
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
    const playerTitle = document.getElementById("playerTitle");
    const harikathaAudio = document.getElementById("harikathaAudio");
    const playerTranscript = document.getElementById("playerTranscript");
    const visualiserCanvas = document.getElementById("visualiser");
    const vCtx = visualiserCanvas.getContext("2d");

    // ── State ──
    const client = new GeminiLiveClient();
    const capture = new AudioCapture();
    let isRecording = false;
    let agentTextBuffer = "";
    let animFrame = null;
    let pendingHarikatha = null;
    let segmentStopTimer = null;
    let visualiserActive = false;

    // ── Status ──
    function setStatus(state, text) {
        statusDot.className = "status-dot " + state;
        statusText.textContent = text;
    }

    // ── Add message ──
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
    // The native audio model leaks its internal reasoning as text.
    // We detect and remove it so the seeker only sees clean responses.
    function isThinkingText(text) {
        if (!text) return true;
        const lower = text.toLowerCase();
        // Patterns that indicate internal reasoning, not a real response
        const thinkingPatterns = [
            "**",               // Markdown bold headers
            "i'm now",          // "I'm now employing..."
            "i've initiated",   // "I've initiated a search..."
            "my aim is",
            "my plan is",
            "my next step",
            "i'll structure",
            "i'll analyze",
            "i'll formulate",
            "i'm preparing",
            "i'm expanding",
            "i'm refining",
            "i'm currently",
            "i'm employing",
            "i'm eager",
            "now awaiting",
            "after the expanded",
            "search results may",
            "search_harikatha",
            "function calling",
            "tool call",
        ];
        return thinkingPatterns.some(p => lower.includes(p));
    }

    function cleanAgentText(text) {
        if (!text) return "";
        // Remove markdown bold markers
        let cleaned = text.replace(/\*\*[^*]*\*\*/g, "").trim();
        // Remove multiple spaces/newlines
        cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
        // If after cleaning it's mostly thinking, return empty
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

    // ── Play Gurudeva's audio at exact segment ──
    function playHarikathaSegment(result) {
        if (!result || !result.audio_url) return;

        const startSec = result.start_seconds || 0;
        const endSec = result.end_seconds || 0;

        playerTitle.textContent = result.source_title || "Gurudeva's Harikatha";
        playerTranscript.textContent = result.transcript || "";
        harikathaAudio.src = result.audio_url;
        harikathaPlayer.style.display = "block";
        conversation.scrollTop = conversation.scrollHeight;

        if (segmentStopTimer) {
            clearTimeout(segmentStopTimer);
            segmentStopTimer = null;
        }

        harikathaAudio.onloadedmetadata = () => {
            harikathaAudio.currentTime = startSec;
            harikathaAudio.play().then(() => {
                setStatus("connected", "🎙️ Playing Gurudeva's harikatha...");
                visualiserActive = true;

                if (endSec > startSec) {
                    const durationMs = (endSec - startSec) * 1000;
                    segmentStopTimer = setTimeout(() => {
                        harikathaAudio.pause();
                        visualiserActive = false;
                        setStatus("connected", "Connected — ask another question");
                        addMessage("system", "Segment complete. Ask another question!");
                    }, durationMs);
                }
            }).catch(e => {
                console.log("Auto-play blocked:", e);
                setStatus("connected", "Press ▶ to hear Gurudeva");
            });
        };

        harikathaAudio.onpause = () => {
            visualiserActive = false;
            if (segmentStopTimer) {
                clearTimeout(segmentStopTimer);
                segmentStopTimer = null;
            }
        };

        harikathaAudio.onended = () => {
            visualiserActive = false;
            setStatus("connected", "Connected — ask another question");
        };
    }

    // ── Connect / Disconnect ──
    connectBtn.addEventListener("click", () => {
        if (client.isConnected) {
            client.disconnect();
            capture.stop();
            harikathaAudio.pause();
            if (segmentStopTimer) clearTimeout(segmentStopTimer);
            return;
        }
        setStatus("connecting", "Connecting to Gemini...");
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;
        client.connect();
    });

    // ── Callbacks ──
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

    // Discard Gemini's garbled PCM audio — we only play Gurudeva's MP3
    client.onAudio = (base64Data) => {
        // Intentionally not playing. Visualiser shows activity.
        visualiserActive = true;
    };

    client.onText = (text) => {
        agentTextBuffer += text;
    };

    client.onTurnComplete = () => {
        visualiserActive = false;

        // Filter and show only clean text (no thinking)
        if (agentTextBuffer.trim()) {
            const cleaned = cleanAgentText(agentTextBuffer);
            if (cleaned && cleaned.length > 5) {
                addMessage("agent", cleaned);
            }
            agentTextBuffer = "";
        }

        // Play Gurudeva's audio AFTER Gemini is done
        if (pendingHarikatha) {
            playHarikathaSegment(pendingHarikatha);
            pendingHarikatha = null;
        } else {
            setStatus("connected", "Connected — ask another question");
        }
    };

    client.onInterrupted = () => {
        agentTextBuffer = "";
        visualiserActive = false;
        harikathaAudio.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);
    };

    client.onHarikathaResult = (results, query) => {
        if (!results || results.length === 0) {
            addMessage("system", "No matching harikatha found for: " + query);
            pendingHarikatha = null;
            return;
        }

        const best = results[0];
        const scorePercent = Math.round(best.score * 100);
        addMessage("harikatha-found",
            `🎙️ Found! (${scorePercent}% match) — "${best.source_title || "Harikatha"}"`
        );

        // Store — play after Gemini's turn ends
        pendingHarikatha = best;
    };

    // ── Mic (push-to-talk) ──
    micBtn.addEventListener("mousedown", startRecording);
    micBtn.addEventListener("mouseup", stopRecording);
    micBtn.addEventListener("mouseleave", stopRecording);
    micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    micBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });

    async function startRecording() {
        if (!client.isSetupComplete || isRecording) return;
        harikathaAudio.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        isRecording = true;
        micBtn.classList.add("recording");
        setStatus("connected", "🎙️ Listening...");

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

    // ── Text input ──
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
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        addMessage("user", text);
        client.sendText(text);
        textInput.value = "";
        setStatus("connected", "Searching Gurudeva's harikatha...");
    }
});
