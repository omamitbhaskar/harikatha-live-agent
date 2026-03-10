/**
 * app.js — Main application logic for Harikatha Live Agent.
 *
 * Ties together: GeminiLiveClient, AudioCapture, AudioPlayer, UI.
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
    const player = new AudioPlayer();
    let isRecording = false;
    let agentTextBuffer = "";
    let animFrame = null;

    // ── Status helpers ──
    function setStatus(state, text) {
        statusDot.className = "status-dot " + state;
        statusText.textContent = text;
    }

    // ── Add message to conversation ──
    function addMessage(role, text) {
        // Remove welcome message on first interaction
        const welcome = conversation.querySelector(".welcome-message");
        if (welcome) welcome.remove();

        const div = document.createElement("div");
        div.className = "msg " + role;
        div.textContent = text;
        conversation.appendChild(div);
        conversation.scrollTop = conversation.scrollHeight;
    }

    // ── Visualiser ──
    function drawVisualiser() {
        const data = player.getFrequencyData();
        const w = visualiserCanvas.width;
        const h = visualiserCanvas.height;
        vCtx.clearRect(0, 0, w, h);

        if (data.length === 0) {
            animFrame = requestAnimationFrame(drawVisualiser);
            return;
        }

        const barCount = Math.min(data.length, 40);
        const barWidth = w / barCount;
        const midY = h / 2;

        for (let i = 0; i < barCount; i++) {
            const val = data[i] / 255;
            const barH = val * midY * 0.8;

            // Saffron gradient
            const alpha = 0.3 + val * 0.5;
            vCtx.fillStyle = `rgba(232, 168, 57, ${alpha})`;
            vCtx.fillRect(i * barWidth + 1, midY - barH, barWidth - 2, barH * 2);
        }

        animFrame = requestAnimationFrame(drawVisualiser);
    }

    // ── Connect / Disconnect ──
    connectBtn.addEventListener("click", () => {
        if (client.isConnected) {
            client.disconnect();
            capture.stop();
            player.stop();
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
        addMessage("system", "Connected to Gurudeva's harikatha agent");
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
        player.stop();
        if (animFrame) cancelAnimationFrame(animFrame);
    };

    client.onError = (msg) => {
        setStatus("error", "Error: " + msg);
        connectBtn.textContent = "Connect";
        connectBtn.disabled = false;
        connectBtn.classList.remove("connected");
    };

    client.onAudio = (base64Data) => {
        player.enqueue(base64Data);
    };

    client.onText = (text) => {
        agentTextBuffer += text;
    };

    client.onTurnComplete = () => {
        if (agentTextBuffer.trim()) {
            addMessage("agent", agentTextBuffer.trim());
            agentTextBuffer = "";
        }
        setStatus("connected", "Connected — ready to listen");
    };

    client.onInterrupted = () => {
        player.stop();
        agentTextBuffer = "";
    };

    client.onHarikathaResult = (results, query) => {
        if (!results || results.length === 0) {
            addMessage("system", "No matching harikatha found for: " + query);
            return;
        }

        const best = results[0];
        const scorePercent = Math.round(best.score * 100);

        addMessage("harikatha-found",
            `🎙️ Found Gurudeva's harikatha! (${scorePercent}% match)\n"${best.source_title || "Harikatha"}"`
        );

        // Show player if audio URL available
        if (best.audio_url) {
            playerTitle.textContent = best.source_title || "Gurudeva's Harikatha";

            // Build audio URL with timestamp
            let audioUrl = best.audio_url;
            if (best.start_seconds && best.start_seconds > 0) {
                audioUrl += `#t=${best.start_seconds}`;
            }
            harikathaAudio.src = audioUrl;
            playerTranscript.textContent = best.transcript || "";
            harikathaPlayer.style.display = "block";

            // Auto-play the segment
            harikathaAudio.play().catch(e => {
                console.log("Auto-play blocked, user must click play:", e);
            });
        }

        // Show transcript even without audio
        if (best.transcript && !best.audio_url) {
            addMessage("agent",
                `📜 Gurudeva's words: "${best.transcript.substring(0, 200)}..."`
            );
        }
    };

    // ── Microphone toggle ──
    micBtn.addEventListener("mousedown", startRecording);
    micBtn.addEventListener("mouseup", stopRecording);
    micBtn.addEventListener("mouseleave", stopRecording);
    micBtn.addEventListener("touchstart", (e) => { e.preventDefault(); startRecording(); });
    micBtn.addEventListener("touchend", (e) => { e.preventDefault(); stopRecording(); });

    async function startRecording() {
        if (!client.isSetupComplete || isRecording) return;

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

        addMessage("user", text);
        client.sendText(text);
        textInput.value = "";
        setStatus("connected", "Gurudeva is responding...");
    }
});
