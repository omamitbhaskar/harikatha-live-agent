/**
 * audio-utils.js — Microphone capture + audio playback utilities
 * Mic input: 16kHz mono PCM16 (what Gemini Live API expects)
 * Gemini output: 24kHz mono PCM16
 */

class AudioCapture {
    constructor() {
        this.stream = null;
        this.audioContext = null;
        this.processor = null;
        this.source = null;
        this.isCapturing = false;
        this.onAudioData = null; // callback: (base64PcmChunk) => void
    }

    async start() {
        if (this.isCapturing) return;

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            }
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        // ScriptProcessor (widely supported) — 4096 samples per chunk
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
            if (!this.isCapturing) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const pcm16 = this._float32ToPcm16(float32);
            const base64 = this._arrayBufferToBase64(pcm16.buffer);
            if (this.onAudioData) {
                this.onAudioData(base64);
            }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        this.isCapturing = true;
        console.log("🎙️ Mic capture started (16kHz PCM16)");
    }

    stop() {
        this.isCapturing = false;
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        console.log("🎙️ Mic capture stopped");
    }

    _float32ToPcm16(float32Array) {
        const pcm16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm16;
    }

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}


class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.queue = [];       // queue of Float32Array chunks
        this.isPlaying = false;
        this.currentSource = null;
        this.sampleRate = 24000; // Gemini outputs 24kHz
        this.analyser = null;
    }

    _ensureContext() {
        if (!this.audioContext || this.audioContext.state === "closed") {
            this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.connect(this.audioContext.destination);
        }
        if (this.audioContext.state === "suspended") {
            this.audioContext.resume();
        }
    }

    /**
     * Enqueue a base64-encoded PCM16 chunk for playback.
     */
    enqueue(base64Data) {
        this._ensureContext();
        const pcm16 = this._base64ToPcm16(base64Data);
        const float32 = this._pcm16ToFloat32(pcm16);
        this.queue.push(float32);

        if (!this.isPlaying) {
            this._playNext();
        }
    }

    _playNext() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const float32 = this.queue.shift();

        const buffer = this.audioContext.createBuffer(1, float32.length, this.sampleRate);
        buffer.getChannelData(0).set(float32);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser);
        source.onended = () => this._playNext();
        source.start();
        this.currentSource = source;
    }

    stop() {
        this.queue = [];
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch(e) {}
            this.currentSource = null;
        }
        this.isPlaying = false;
    }

    /**
     * Get frequency data for visualisation. Returns Uint8Array.
     */
    getFrequencyData() {
        if (!this.analyser) return new Uint8Array(0);
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    _base64ToPcm16(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer);
    }

    _pcm16ToFloat32(pcm16) {
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768;
        }
        return float32;
    }
}
