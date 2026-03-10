/**
 * gemini-live.js — WebSocket client for Gemini Live API via backend proxy.
 *
 * Connects to /ws/live on the backend, which proxies to Gemini Live API.
 * Handles: setup, audio streaming, text sending, tool call results.
 */

class GeminiLiveClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isSetupComplete = false;

        // Event callbacks
        this.onSetupComplete = null;    // () => void
        this.onAudio = null;            // (base64Data) => void
        this.onText = null;             // (text) => void
        this.onTurnComplete = null;     // () => void
        this.onInterrupted = null;      // () => void
        this.onHarikathaResult = null;  // (results, query) => void
        this.onError = null;            // (error) => void
        this.onDisconnect = null;       // () => void
    }

    /**
     * Connect to the backend WebSocket proxy.
     */
    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.warn("Already connected");
            return;
        }

        // Determine WebSocket URL (same host as page)
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/live`;

        console.log(`🔗 Connecting to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("✅ WebSocket open");
            this.isConnected = true;
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleMessage(msg);
            } catch (e) {
                console.error("Failed to parse WS message:", e);
            }
        };

        this.ws.onerror = (event) => {
            console.error("WebSocket error:", event);
            if (this.onError) this.onError("WebSocket connection error");
        };

        this.ws.onclose = (event) => {
            console.log("🔌 WebSocket closed:", event.code, event.reason);
            this.isConnected = false;
            this.isSetupComplete = false;
            if (this.onDisconnect) this.onDisconnect();
        };
    }

    /**
     * Disconnect from the backend.
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isSetupComplete = false;
    }

    /**
     * Send a base64-encoded PCM16 audio chunk.
     */
    sendAudio(base64Data) {
        if (!this.isConnected || !this.isSetupComplete) return;
        this._send({ type: "audio", data: base64Data });
    }

    /**
     * Send a text message.
     */
    sendText(text) {
        if (!this.isConnected || !this.isSetupComplete) return;
        this._send({ type: "text", text: text });
    }

    // ── Private ──

    _send(obj) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }

    _handleMessage(msg) {
        switch (msg.type) {
            case "setup_complete":
                console.log("✅ Gemini session ready");
                this.isSetupComplete = true;
                if (this.onSetupComplete) this.onSetupComplete();
                break;

            case "audio":
                if (this.onAudio) this.onAudio(msg.data);
                break;

            case "text":
                if (this.onText) this.onText(msg.text);
                break;

            case "turn_complete":
                if (this.onTurnComplete) this.onTurnComplete();
                break;

            case "interrupted":
                if (this.onInterrupted) this.onInterrupted();
                break;

            case "harikatha_result":
                console.log("🎙️ Harikatha result:", msg.results);
                if (this.onHarikathaResult) {
                    this.onHarikathaResult(msg.results, msg.query);
                }
                break;

            case "error":
                console.error("Server error:", msg.message);
                if (this.onError) this.onError(msg.message);
                break;

            default:
                console.debug("Unknown message type:", msg.type);
        }
    }
}
