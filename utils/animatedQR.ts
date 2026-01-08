/**
 * Animated QR Stream - Air-Gapped Data Transfer
 * 
 * CONCEPT: Transfer large datasets between devices using video-like QR code stream
 * 
 * ALGORITHM:
 * 1. Compress data with gzip
 * 2. Split into ~2KB chunks (QR capacity limit)
 * 3. Add frame headers: sequence, total, CRC16
 * 4. Display QR codes as animated sequence (5-10 FPS)
 * 5. Scanner reconstructs chunks, verifies CRC, assembles data
 * 
 * TRANSFER RATE: ~10-20 KB/s realistically (accounting for camera lag)
 * 
 * MARKETING: "Spy-grade sync. Your data never touches the internet."
 * 
 * SECURITY:
 * - 100% air-gapped (no network)
 * - No STUN/TURN servers
 * - No ICE candidates
 * - Works through Faraday cage
 * 
 * ZERO DEPENDENCIES: Uses native APIs only
 */

// Maximum reliable QR code data capacity (Version 40, L error correction)
const MAX_CHUNK_SIZE = 2000; // ~2KB per QR code
const DEFAULT_FPS = 6; // Frames per second for display

/**
 * QR Stream Frame - Single unit of transfer
 */
export interface QRFrame {
    v: 1;           // Version
    s: number;      // Sequence number (0-indexed)
    t: number;      // Total frames
    c: string;      // Chunk data (base64)
    h: string;      // CRC16 hash of chunk (for error detection)
}

/**
 * Stream Progress Event
 */
export interface StreamProgress {
    currentFrame: number;
    totalFrames: number;
    percent: number;
    bytesTransferred: number;
    totalBytes: number;
}

/**
 * CRC16-CCITT implementation (fast, good error detection)
 * Used instead of SHA for speed - only for error detection, not security
 */
function crc16(data: string): string {
    let crc = 0xFFFF;

    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
        crc &= 0xFFFF;
    }

    return crc.toString(16).padStart(4, '0');
}

/**
 * Compress data using native CompressionStream
 */
async function compressData(data: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
        // Fallback: return uncompressed if not supported
        return data;
    }

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
    writer.close();

    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

/**
 * Decompress gzip data
 */
async function decompressData(data: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
        return data;
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

/**
 * Convert Uint8Array to base64
 */
function uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 to Uint8Array
 */
function base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Generate QR stream frames from data
 * Returns an async generator that yields frames for display
 */
export async function* createQRStream(
    data: string,
    onProgress?: (progress: StreamProgress) => void
): AsyncGenerator<QRFrame> {
    // Convert string to bytes and compress
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(data);
    const compressed = await compressData(rawBytes);
    const base64 = uint8ToBase64(compressed);

    // Calculate number of frames needed
    const totalFrames = Math.ceil(base64.length / MAX_CHUNK_SIZE);

    // Generate frames
    for (let i = 0; i < totalFrames; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, base64.length);
        const chunk = base64.slice(start, end);

        const frame: QRFrame = {
            v: 1,
            s: i,
            t: totalFrames,
            c: chunk,
            h: crc16(chunk)
        };

        if (onProgress) {
            onProgress({
                currentFrame: i + 1,
                totalFrames,
                percent: Math.round(((i + 1) / totalFrames) * 100),
                bytesTransferred: end,
                totalBytes: base64.length
            });
        }

        yield frame;
    }
}

/**
 * Encode frame to JSON string for QR code
 */
export function encodeFrame(frame: QRFrame): string {
    return JSON.stringify(frame);
}

/**
 * Parse QR code data back to frame
 */
export function decodeFrame(qrData: string): QRFrame | null {
    try {
        const frame = JSON.parse(qrData);

        // Validate frame structure
        if (
            frame.v !== 1 ||
            typeof frame.s !== 'number' ||
            typeof frame.t !== 'number' ||
            typeof frame.c !== 'string' ||
            typeof frame.h !== 'string'
        ) {
            return null;
        }

        // Verify CRC
        if (crc16(frame.c) !== frame.h) {
            console.warn(`CRC mismatch on frame ${frame.s}`);
            return null;
        }

        return frame as QRFrame;
    } catch {
        return null;
    }
}

/**
 * QR Stream Receiver - Accumulates frames and reconstructs data
 */
export class QRStreamReceiver {
    private frames = new Map<number, QRFrame>();
    private totalFrames = 0;
    private onProgress?: (progress: StreamProgress) => void;
    private onComplete?: (data: string) => void;
    private onError?: (error: string) => void;

    constructor(options: {
        onProgress?: (progress: StreamProgress) => void;
        onComplete?: (data: string) => void;
        onError?: (error: string) => void;
    }) {
        this.onProgress = options.onProgress;
        this.onComplete = options.onComplete;
        this.onError = options.onError;
    }

    /**
     * Process a received frame
     * Returns true if data is complete
     */
    async receiveFrame(frame: QRFrame): Promise<boolean> {
        // Validate frame
        if (frame.v !== 1) {
            this.onError?.('Incompatible stream version');
            return false;
        }

        // Store frame
        this.frames.set(frame.s, frame);
        this.totalFrames = frame.t;

        // Report progress
        if (this.onProgress) {
            this.onProgress({
                currentFrame: this.frames.size,
                totalFrames: this.totalFrames,
                percent: Math.round((this.frames.size / this.totalFrames) * 100),
                bytesTransferred: 0, // Not tracked per-frame
                totalBytes: 0
            });
        }

        // Check if complete
        if (this.frames.size >= this.totalFrames) {
            await this.complete();
            return true;
        }

        return false;
    }

    /**
     * Assemble and decompress data
     */
    private async complete(): Promise<void> {
        try {
            // Check for missing frames
            for (let i = 0; i < this.totalFrames; i++) {
                if (!this.frames.has(i)) {
                    this.onError?.(`Missing frame ${i + 1} of ${this.totalFrames}`);
                    return;
                }
            }

            // Assemble base64 chunks in order
            let base64 = '';
            for (let i = 0; i < this.totalFrames; i++) {
                base64 += this.frames.get(i)!.c;
            }

            // Decompress
            const compressed = base64ToUint8(base64);
            const decompressed = await decompressData(compressed);
            const decoder = new TextDecoder();
            const data = decoder.decode(decompressed);

            this.onComplete?.(data);
        } catch (e) {
            this.onError?.(`Failed to reconstruct data: ${e}`);
        }
    }

    /**
     * Get current progress
     */
    getProgress(): StreamProgress {
        return {
            currentFrame: this.frames.size,
            totalFrames: this.totalFrames || 1,
            percent: this.totalFrames ? Math.round((this.frames.size / this.totalFrames) * 100) : 0,
            bytesTransferred: 0,
            totalBytes: 0
        };
    }

    /**
     * Get missing frame numbers
     */
    getMissingFrames(): number[] {
        const missing: number[] = [];
        for (let i = 0; i < this.totalFrames; i++) {
            if (!this.frames.has(i)) {
                missing.push(i);
            }
        }
        return missing;
    }

    /**
     * Reset receiver for new stream
     */
    reset(): void {
        this.frames.clear();
        this.totalFrames = 0;
    }
}

/**
 * Animated QR Display Controller
 * Cycles through frames at specified FPS for camera scanning
 */
export class QRStreamDisplay {
    private frames: QRFrame[] = [];
    private currentIndex = 0;
    private intervalId: number | null = null;
    private fps: number;
    private onFrame?: (frame: QRFrame, encoded: string) => void;
    private loopCount = 0;
    private maxLoops: number;

    constructor(options: {
        fps?: number;
        maxLoops?: number;
        onFrame?: (frame: QRFrame, encoded: string) => void;
    } = {}) {
        this.fps = options.fps || DEFAULT_FPS;
        this.maxLoops = options.maxLoops || 10; // Loop 10 times by default
        this.onFrame = options.onFrame;
    }

    /**
     * Load frames from generator
     */
    async loadFromStream(
        streamGenerator: AsyncGenerator<QRFrame>
    ): Promise<void> {
        this.frames = [];
        for await (const frame of streamGenerator) {
            this.frames.push(frame);
        }
    }

    /**
     * Start animated display
     */
    start(): void {
        if (this.frames.length === 0) return;
        if (this.intervalId) this.stop();

        this.currentIndex = 0;
        this.loopCount = 0;

        const tick = () => {
            const frame = this.frames[this.currentIndex];
            const encoded = encodeFrame(frame);

            this.onFrame?.(frame, encoded);

            this.currentIndex++;
            if (this.currentIndex >= this.frames.length) {
                this.currentIndex = 0;
                this.loopCount++;

                if (this.loopCount >= this.maxLoops) {
                    this.stop();
                }
            }
        };

        // Tick immediately, then on interval
        tick();
        this.intervalId = window.setInterval(tick, 1000 / this.fps);
    }

    /**
     * Stop animated display
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Get total frame count
     */
    getFrameCount(): number {
        return this.frames.length;
    }

    /**
     * Get current frame index
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Check if streaming
     */
    isPlaying(): boolean {
        return this.intervalId !== null;
    }
}

/**
 * Estimate transfer time for given data size
 */
export function estimateTransferTime(dataSize: number, fps: number = DEFAULT_FPS): {
    frames: number;
    seconds: number;
    displayText: string;
} {
    // Assume ~60% compression ratio
    const compressedSize = dataSize * 0.4;
    const base64Size = compressedSize * 1.37; // base64 expansion
    const frames = Math.ceil(base64Size / MAX_CHUNK_SIZE);
    const seconds = frames / fps;

    let displayText: string;
    if (seconds < 60) {
        displayText = `~${Math.ceil(seconds)} seconds`;
    } else {
        displayText = `~${Math.ceil(seconds / 60)} minutes`;
    }

    return { frames, seconds, displayText };
}
