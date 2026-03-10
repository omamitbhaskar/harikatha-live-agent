/**
 * app.js — Main application logic for Harikatha Live Agent.
 *
 * Key design:
 * - Gemini's voice (PCM audio) is NOT played — it's garbled and not needed.
 *   Instead we show Gemini's text response as the "introduction."
 * - After Gemini's turn completes, Gurudeva's actual audio plays automatically
 *   at the exact segment start time and stops at the segment end time.
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

    // Pending harikatha result — we store it and play AFTER Gemini finishes speaking
    let pendingHarikatha = null;
    let segmentStopTimer = null;

    // ── Status helpers ──
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

    // ── Clean Gemini's text (remove **thinking** markers) ──
    function cleanAgentText(text) {
        // Remove markdown bold markers and "thinking out loud" patterns
        return text
            .replace(/\*\*[^*]+\*\*/g, "")  // Remove **bold headers**
            .replace(/\s{2,}/g, " ")          // Collapse multiple spaces
            .trim();
    }

    // ── Simple visualiser (shows activity even without audio) ──
    let visualiserActive = false;
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

        // Set audio source (without #t fragment — we'll seek manually for reliability)
        harikathaAudio.src = result.audio_url;
        harikathaPlayer.style.display = "block";
        conversation.scrollTop = conversation.scrollHeight;

        // Clear any previous stop timer
        if (segmentStopTimer) {
            clearTimeout(segmentStopTimer);
            segmentStopTimer = null;
        }

        // When audio is loaded, seek to start time and play
        harikathaAudio.onloadedmetadata = () => {
            harikathaAudio.currentTime = startSec;

            harikathaAudio.play().then(() => {
                setStatus("connected", "🎙️ Playing Gurudeva's harikatha...");
                visualiserActive = true;

                // Set timer to stop at end of segment
                if (endSec > startSec) {
                    const durationMs = (endSec - startSec) * 1000;
                    segmentStopTimer = setTimeout(() => {
                        harikathaAudio.pause();
                        setStatus("connected", "Connected — ready to listen");
                        visualiserActive = false;
                        addMessage("system", "Segment complete. Ask another question!");
                    }, durationMs);
                }
            }).catch(e => {
                console.log("Auto-play blocked:", e);
                setStatus("connected", "Press play to hear Gurudeva");
            });
        };

        // Also stop if user manually pauses
        harikathaAudio.onpause = () => {
            visualiserActive = false;
            if (segmentStopTimer) {
                clearTimeout(segmentStopTimer);
                segmentStopTimer = null;
            }
        };

        // Stop visualiser when audio ends naturally
        harikathaAudio.onended = () => {
            visualiserActive = false;
            setStatus("connected", "Connected — ready to listen");
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

    // ── Client callbacks ──
    client.onSetupComplete = () => {
        setStatus("connected", "Connected — ready to listen");
        connectBtn.textContent = "Disconnect";
        connectBtn.disabled = false;
        connectBtn.classList.add("connected");
        micBtn.disabled = false;
        addMessage("system", "Hare Krishna! Connected to Gurudeva's harikatha agent. Ask any spiritual question.");
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

    // ── IMPORTANT: Do NOT play Gemini's audio — it's garbled PCM ──
    client.onAudio = (base64Data) => {
        // We intentionally discard Gemini's audio output.
        // The seeker hears Gurudeva's real voice from the MP3, not Gemini's TTS.
        // Just show that something is happening:
        visualiserActive = true;
    };

    client.onText = (text) => {
        agentTextBuffer += text;
    };

    client.onTurnComplete = () => {
        visualiserActive = false;

        // Show cleaned agent text (filter out thinking markers)
        if (agentTextBuffer.trim()) {
            const cleaned = cleanAgentText(agentTextBuffer);
            if (cleaned) {
                addMessage("agent", cleaned);
            }
            agentTextBuffer = "";
        }

        // NOW play Gurudeva's audio (after Gemini's intro is done)
        if (pendingHarikatha) {
            playHarikathaSegment(pendingHarikatha);
            pendingHarikatha = null;
        } else {
            setStatus("connected", "Connected — ready to listen");
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
            `🎙️ Found Gurudeva's harikatha! (${scorePercent}% match)\n"${best.source_title || "Harikatha"}"`
        );

        // Store the result — we'll play it AFTER Gemini finishes its voice intro
        pendingHarikatha = best;
    };

    // ── Microphone toggle (push-to-talk) ──
    micBtn.addEventListener("mousedown", startRecording);
    micBtn.addEventListener("mouseup", stopRecording);
    micBtn.addEventListener("mouseleave", stopRecording);
    micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    micBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });

    async function startRecording() {
        if (!client.isSetupComplete || isRecording) return;

        // Stop any playing harikatha audio first
        harikathaAudio.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        isRecording = true;
        micBtn.classList.add("recording");
        setStatus("connected", "Listening... (hold mic button)");

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
            addMessage("system", "Please connect first (press Connect button)");
            return;
        }

        // Stop any playing harikatha audio
        harikathaAudio.pause();
        if (segmentStopTimer) clearTimeout(segmentStopTimer);

        addMessage("user", text);
        client.sendText(text);
        textInput.value = "";
        setStatus("connected", "Gurudeva is responding...");
    }
});
