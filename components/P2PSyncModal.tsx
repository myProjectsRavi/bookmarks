import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Check, X, Loader, ArrowLeft, Camera, QrCode, Zap, Play, Pause } from 'lucide-react';
import { Folder, Bookmark, Notebook, Note } from '../types';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import pako from 'pako';

interface P2PSyncModalProps {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks: Notebook[];
    notes: Note[];
    vaultBookmarks: Bookmark[];
    onImport: (data: {
        folders: Folder[];
        bookmarks: Bookmark[];
        notebooks: Notebook[];
        notes: Note[];
        vaultBookmarks?: Bookmark[];
    }) => void;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

type SyncMode = 'select' | 'send' | 'receive';

// QR chunk size (safe for most QR scanners)
const CHUNK_SIZE = 1500;
const ANIMATION_SPEED = 600; // ms per QR

// Compress and encode data
function compressData(data: object): string {
    const json = JSON.stringify(data);
    const compressed = pako.deflate(json);
    // Convert to base64
    let binary = '';
    compressed.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
}

// Decode and decompress data
function decompressData(encoded: string): object | null {
    try {
        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decompressed = pako.inflate(bytes, { to: 'string' });
        return JSON.parse(decompressed);
    } catch (e) {
        console.error('Decompress error:', e);
        return null;
    }
}

// Split data into QR chunks
function createChunks(data: string): string[] {
    const chunks: string[] = [];
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
        const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        // Format: LH|chunkIndex|totalChunks|data
        chunks.push(`LH|${i}|${totalChunks}|${chunk}`);
    }

    return chunks;
}

// Parse chunk
function parseChunk(qrData: string): { index: number; total: number; data: string } | null {
    if (!qrData.startsWith('LH|')) return null;

    const parts = qrData.split('|');
    if (parts.length < 4) return null;

    return {
        index: parseInt(parts[1], 10),
        total: parseInt(parts[2], 10),
        data: parts.slice(3).join('|') // Rejoin in case data contained |
    };
}

export const P2PSyncModal: React.FC<P2PSyncModalProps> = ({
    folders,
    bookmarks,
    notebooks,
    notes,
    vaultBookmarks,
    onImport,
    onClose,
    onSuccess,
    onError
}) => {
    const [mode, setMode] = useState<SyncMode>('select');

    // Sender state
    const [chunks, setChunks] = useState<string[]>([]);
    const [qrDataUrls, setQrDataUrls] = useState<string[]>([]);
    const [currentChunk, setCurrentChunk] = useState(0);
    const [isAnimating, setIsAnimating] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Receiver state
    const [isScanning, setIsScanning] = useState(false);
    const [receivedChunks, setReceivedChunks] = useState<Map<number, string>>(new Map());
    const [expectedTotal, setExpectedTotal] = useState(0);
    const [scanComplete, setScanComplete] = useState(false);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const animationRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup
    useEffect(() => {
        return () => cleanup();
    }, []);

    const cleanup = () => {
        if (animationRef.current) {
            clearInterval(animationRef.current);
            animationRef.current = null;
        }
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => { });
            scannerRef.current = null;
        }
    };

    // Generate QR codes for all chunks
    const generateQRs = async () => {
        setIsGenerating(true);

        // Prepare payload
        const payload = {
            v: 5, // version 5 = compressed chunks
            f: folders.map(f => ({ i: f.id, n: f.name, p: f.parentId, c: f.createdAt })),
            b: bookmarks.map(b => ({ i: b.id, f: b.folderId, t: b.title, u: b.url, d: b.description, g: b.tags, c: b.createdAt })),
            nb: notebooks.map(n => ({ i: n.id, n: n.name, p: n.parentId, c: n.createdAt })),
            nt: notes.map(n => ({ i: n.id, nb: n.notebookId, t: n.title, ct: n.content, tg: n.tags, c: n.createdAt, u: n.updatedAt })),
            vb: vaultBookmarks.map(b => ({ i: b.id, f: b.folderId, t: b.title, u: b.url, d: b.description, g: b.tags, c: b.createdAt }))
        };

        // Compress
        const compressed = compressData(payload);
        console.log(`Original: ~${JSON.stringify(payload).length} bytes, Compressed: ${compressed.length} bytes`);

        // Create chunks
        const dataChunks = createChunks(compressed);
        setChunks(dataChunks);

        // Generate QR for each chunk
        const urls: string[] = [];
        for (const chunk of dataChunks) {
            const url = await QRCode.toDataURL(chunk, {
                width: 300,
                margin: 1,
                errorCorrectionLevel: 'L',
                color: { dark: '#1e293b', light: '#ffffff' }
            });
            urls.push(url);
        }

        setQrDataUrls(urls);
        setIsGenerating(false);

        // Start animation
        startAnimation();
    };

    // Animate through QRs
    const startAnimation = () => {
        setIsAnimating(true);
        animationRef.current = setInterval(() => {
            setCurrentChunk(prev => (prev + 1) % chunks.length || 0);
        }, ANIMATION_SPEED);
    };

    const toggleAnimation = () => {
        if (isAnimating) {
            if (animationRef.current) clearInterval(animationRef.current);
            setIsAnimating(false);
        } else {
            startAnimation();
        }
    };

    // Update animation when chunks change
    useEffect(() => {
        if (qrDataUrls.length > 0 && isAnimating && !animationRef.current) {
            startAnimation();
        }
    }, [qrDataUrls]);

    // Start scanning
    const startScanner = async () => {
        setIsScanning(true);
        setReceivedChunks(new Map());
        setExpectedTotal(0);
        setScanComplete(false);

        try {
            const html5QrCode = new Html5Qrcode("qr-scanner-container");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 280, height: 280 } },
                (decodedText) => {
                    handleScannedChunk(decodedText);
                },
                () => { }
            );
        } catch (err) {
            setIsScanning(false);
            onError('Camera access denied');
        }
    };

    // Handle scanned chunk
    const handleScannedChunk = (qrData: string) => {
        const parsed = parseChunk(qrData);
        if (!parsed) return;

        setExpectedTotal(parsed.total);

        setReceivedChunks(prev => {
            const updated = new Map(prev);
            if (!updated.has(parsed.index)) {
                updated.set(parsed.index, parsed.data);

                // Check if complete
                if (updated.size === parsed.total) {
                    completeImport(updated, parsed.total);
                }
            }
            return updated;
        });
    };

    // Complete the import
    const completeImport = async (chunks: Map<number, string>, total: number) => {
        setScanComplete(true);

        // Stop scanner
        if (scannerRef.current) {
            await scannerRef.current.stop().catch(() => { });
        }
        setIsScanning(false);

        // Reassemble data
        let fullData = '';
        for (let i = 0; i < total; i++) {
            fullData += chunks.get(i) || '';
        }

        // Decompress
        const payload = decompressData(fullData) as any;
        if (!payload || !payload.f || !payload.b) {
            onError('Failed to decode data');
            return;
        }

        // Convert back to full objects
        const importData = {
            folders: payload.f.map((f: any) => ({
                id: f.i, name: f.n, parentId: f.p || null, createdAt: f.c
            })),
            bookmarks: payload.b.map((b: any) => ({
                id: b.i, folderId: b.f, title: b.t, url: b.u,
                description: b.d || '', tags: b.g || [], createdAt: b.c
            })),
            notebooks: (payload.nb || []).map((n: any) => ({
                id: n.i, name: n.n, parentId: n.p || null, createdAt: n.c
            })),
            notes: (payload.nt || []).map((n: any) => ({
                id: n.i, notebookId: n.nb, title: n.t, content: n.ct,
                tags: n.tg || [], createdAt: n.c, updatedAt: n.u
            })),
            vaultBookmarks: (payload.vb || []).map((b: any) => ({
                id: b.i, folderId: b.f, title: b.t, url: b.u,
                description: b.d || '', tags: b.g || [], createdAt: b.c
            }))
        };

        onImport(importData);
        onSuccess(`✨ Imported ${importData.bookmarks.length} bookmarks!`);

        setTimeout(() => {
            cleanup();
            onClose();
        }, 1500);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => { });
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const dataStats = {
        folders: folders.length,
        bookmarks: bookmarks.length,
        notes: notes.length,
        vault: vaultBookmarks.length
    };

    const totalItems = dataStats.bookmarks + dataStats.notes + dataStats.vault;
    const receivedCount = receivedChunks.size;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <QrCode size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">QR Sync</h3>
                    <p className="text-sm text-slate-500">Works offline • No limits</p>
                </div>
            </div>

            {/* Mode Selection */}
            {mode === 'select' && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100 rounded-lg p-4 text-sm">
                        <p className="font-medium text-cyan-800 flex items-center gap-2">
                            <Zap size={16} /> Animated QR + Compression
                        </p>
                        <p className="text-cyan-600 mt-1">
                            Sync {totalItems}+ items via animated QR codes. Just hold camera steady!
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => {
                                setMode('send');
                                generateQRs();
                            }}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <QrCode size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Send</div>
                                <div className="text-xs text-slate-500 mt-1">Show QR</div>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                setMode('receive');
                                startScanner();
                            }}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <Camera size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Receive</div>
                                <div className="text-xs text-slate-500 mt-1">Scan QR</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* SEND Mode - Animated QR */}
            {mode === 'send' && (
                <div className="space-y-4">
                    {/* Stats */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-white rounded border text-xs">
                                🔖 {dataStats.bookmarks} bookmarks
                            </span>
                            {dataStats.notes > 0 && (
                                <span className="px-2 py-1 bg-white rounded border text-xs">
                                    📝 {dataStats.notes} notes
                                </span>
                            )}
                        </div>
                        {qrDataUrls.length > 0 && (
                            <span className="text-xs text-cyan-600 font-medium">
                                {qrDataUrls.length} QR{qrDataUrls.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {isGenerating ? (
                        <div className="flex flex-col items-center py-12 gap-4">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                            <p className="text-sm text-slate-600">Generating QR codes...</p>
                        </div>
                    ) : qrDataUrls.length > 0 ? (
                        <div className="space-y-4">
                            {/* QR Display */}
                            <div className="flex justify-center p-4 bg-white border-2 border-slate-200 rounded-xl relative">
                                <img
                                    src={qrDataUrls[currentChunk]}
                                    alt={`QR ${currentChunk + 1}/${qrDataUrls.length}`}
                                    className="w-56 h-56"
                                />

                                {/* Chunk indicator */}
                                {qrDataUrls.length > 1 && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-800/80 text-white text-xs font-medium rounded-full">
                                        {currentChunk + 1} / {qrDataUrls.length}
                                    </div>
                                )}
                            </div>

                            {/* Progress bar */}
                            {qrDataUrls.length > 1 && (
                                <div className="space-y-2">
                                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div
                                            className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                                            style={{ width: `${((currentChunk + 1) / qrDataUrls.length) * 100}%` }}
                                        />
                                    </div>

                                    {/* Play/Pause */}
                                    <button
                                        onClick={toggleAnimation}
                                        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        {isAnimating ? <Pause size={16} /> : <Play size={16} />}
                                        {isAnimating ? 'Pause' : 'Resume'} Animation
                                    </button>
                                </div>
                            )}

                            <p className="text-center text-sm text-slate-500">
                                📱 Point other device's camera at the QR code
                            </p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* RECEIVE Mode - Scanner */}
            {mode === 'receive' && (
                <div className="space-y-4">
                    {isScanning && !scanComplete && (
                        <div className="space-y-4">
                            <div id="qr-scanner-container" className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden" />

                            {/* Progress */}
                            {expectedTotal > 0 && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Receiving...</span>
                                        <span className="font-medium text-cyan-600">
                                            {receivedCount} / {expectedTotal}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                            className="bg-cyan-500 h-2 rounded-full transition-all"
                                            style={{ width: `${(receivedCount / expectedTotal) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {expectedTotal === 0 && (
                                <p className="text-center text-sm text-slate-500">
                                    📸 Hold camera steady at the QR code...
                                </p>
                            )}

                            <button
                                onClick={stopScanner}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                <X size={16} /> Cancel
                            </button>
                        </div>
                    )}

                    {scanComplete && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check size={32} className="text-emerald-600" />
                            </div>
                            <p className="text-lg font-semibold text-emerald-700">Import complete!</p>
                        </div>
                    )}

                    {!isScanning && !scanComplete && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <button
                                onClick={startScanner}
                                className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-cyan-500"
                            >
                                <Camera size={48} className="text-cyan-600" />
                                <span className="font-semibold text-slate-800">Start Camera</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                    onClick={() => {
                        cleanup();
                        if (mode !== 'select') {
                            setMode('select');
                            setChunks([]);
                            setQrDataUrls([]);
                            setCurrentChunk(0);
                            setReceivedChunks(new Map());
                            setExpectedTotal(0);
                            setScanComplete(false);
                        } else {
                            onClose();
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    <ArrowLeft size={16} />
                    {mode === 'select' ? 'Cancel' : 'Back'}
                </button>
                <div className="text-xs text-slate-400">100% offline</div>
            </div>
        </div>
    );
};
