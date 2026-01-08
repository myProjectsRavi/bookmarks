/**
 * AnimatedQRSync - Air-Gapped Data Transfer via QR Stream
 * 
 * "Spy-grade sync. Your data never touches the internet."
 * 
 * Uses animated QR code sequence for large data transfer between devices
 * without any network connectivity - 100% air-gapped.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, Camera, Check, AlertCircle, Radio, Wifi, WifiOff, Zap } from 'lucide-react';
import { Folder, Bookmark, Notebook, Note } from '../types';
import QRCode from 'qrcode';
import {
    createQRStream,
    QRStreamDisplay,
    QRStreamReceiver,
    encodeFrame,
    decodeFrame,
    estimateTransferTime,
    StreamProgress,
    QRFrame
} from '../utils/animatedQR';

interface AnimatedQRSyncProps {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks?: Notebook[];
    notes?: Note[];
    vaultBookmarks?: Bookmark[];
    onImport: (folders: Folder[], bookmarks: Bookmark[], notebooks?: Notebook[], notes?: Note[], vaultBookmarks?: Bookmark[]) => void;
    onClose: () => void;
}

// Generate sync payload (reuse from QRSync)
function generateSyncPayload(folders: Folder[], bookmarks: Bookmark[], notebooks?: Notebook[], notes?: Note[], vaultBookmarks?: Bookmark[]): string {
    const payload: any = {
        v: 4, // version 4 for stream sync
        t: Date.now(),
        f: folders.map(f => ({
            i: f.id,
            n: f.name,
            p: f.parentId,
            c: f.createdAt
        })),
        b: bookmarks.map(b => ({
            i: b.id,
            f: b.folderId,
            t: b.title,
            u: b.url,
            d: b.description,
            g: b.tags,
            c: b.createdAt
        }))
    };

    if (notebooks && notebooks.length > 0) {
        payload.nb = notebooks.map(n => ({
            i: n.id,
            n: n.name,
            p: n.parentId,
            c: n.createdAt
        }));
    }

    if (notes && notes.length > 0) {
        payload.nt = notes.map(n => ({
            i: n.id,
            nb: n.notebookId,
            t: n.title,
            ct: n.content,
            tg: n.tags,
            c: n.createdAt,
            u: n.updatedAt
        }));
    }

    if (vaultBookmarks && vaultBookmarks.length > 0) {
        payload.vb = vaultBookmarks.map(b => ({
            i: b.id,
            f: b.folderId,
            t: b.title,
            u: b.url,
            d: b.description,
            g: b.tags,
            c: b.createdAt
        }));
    }

    return JSON.stringify(payload);
}

// Parse sync payload
function parseSyncPayload(data: string): { folders: Folder[], bookmarks: Bookmark[], notebooks: Notebook[], notes: Note[], vaultBookmarks: Bookmark[] } | null {
    try {
        const payload = JSON.parse(data);

        if (!payload.f || !payload.b) {
            return null;
        }

        const folders: Folder[] = payload.f.map((f: any) => ({
            id: f.i,
            name: f.n,
            parentId: f.p || null,
            createdAt: f.c
        }));

        const bookmarks: Bookmark[] = payload.b.map((b: any) => ({
            id: b.i,
            folderId: b.f,
            title: b.t,
            url: b.u,
            description: b.d || '',
            tags: b.g || [],
            createdAt: b.c
        }));

        const notebooks: Notebook[] = payload.nb ? payload.nb.map((n: any) => ({
            id: n.i,
            name: n.n,
            parentId: n.p || null,
            createdAt: n.c
        })) : [];

        const notes: Note[] = payload.nt ? payload.nt.map((n: any) => ({
            id: n.i,
            notebookId: n.nb,
            title: n.t,
            content: n.ct,
            tags: n.tg || [],
            createdAt: n.c,
            updatedAt: n.u
        })) : [];

        const vaultBookmarks: Bookmark[] = payload.vb ? payload.vb.map((b: any) => ({
            id: b.i,
            folderId: b.f,
            title: b.t,
            url: b.u,
            description: b.d || '',
            tags: b.g || [],
            createdAt: b.c
        })) : [];

        return { folders, bookmarks, notebooks, notes, vaultBookmarks };
    } catch {
        return null;
    }
}

export const AnimatedQRSync: React.FC<AnimatedQRSyncProps> = ({
    folders,
    bookmarks,
    notebooks = [],
    notes = [],
    vaultBookmarks = [],
    onImport,
    onClose
}) => {
    const [mode, setMode] = useState<'send' | 'receive'>('send');

    // Send state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentQR, setCurrentQR] = useState<string>('');
    const [sendProgress, setSendProgress] = useState<StreamProgress | null>(null);
    const [streamDisplay, setStreamDisplay] = useState<QRStreamDisplay | null>(null);

    // Receive state
    const [receiver, setReceiver] = useState<QRStreamReceiver | null>(null);
    const [receiveProgress, setReceiveProgress] = useState<StreamProgress | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanInput, setScanInput] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Canvas for QR rendering
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate data size and estimate
    const payloadSize = generateSyncPayload(folders, bookmarks, notebooks, notes, vaultBookmarks).length;
    const estimate = estimateTransferTime(payloadSize);

    // Initialize stream display for sending
    useEffect(() => {
        if (mode === 'send') {
            const display = new QRStreamDisplay({
                fps: 6,
                maxLoops: 20,
                onFrame: async (frame, encoded) => {
                    setSendProgress({
                        currentFrame: frame.s + 1,
                        totalFrames: frame.t,
                        percent: Math.round(((frame.s + 1) / frame.t) * 100),
                        bytesTransferred: 0,
                        totalBytes: 0
                    });

                    // Generate QR code image
                    if (canvasRef.current) {
                        try {
                            await QRCode.toCanvas(canvasRef.current, encoded, {
                                width: 300,
                                margin: 2,
                                errorCorrectionLevel: 'L'
                            });
                        } catch (e) {
                            console.error('QR generation error:', e);
                        }
                    }
                }
            });

            setStreamDisplay(display);

            // Load frames
            const loadFrames = async () => {
                const payload = generateSyncPayload(folders, bookmarks, notebooks, notes, vaultBookmarks);
                const stream = createQRStream(payload);
                await display.loadFromStream(stream);
            };

            loadFrames();

            return () => {
                display.stop();
            };
        }
    }, [mode, folders, bookmarks, notebooks, notes, vaultBookmarks]);

    // Initialize receiver
    useEffect(() => {
        if (mode === 'receive') {
            const recv = new QRStreamReceiver({
                onProgress: setReceiveProgress,
                onComplete: (data) => {
                    const result = parseSyncPayload(data);
                    if (result) {
                        setSuccess(true);
                        setTimeout(() => {
                            onImport(result.folders, result.bookmarks, result.notebooks, result.notes, result.vaultBookmarks);
                            onClose();
                        }, 1500);
                    } else {
                        setError('Failed to parse received data');
                    }
                },
                onError: setError
            });
            setReceiver(recv);

            return () => {
                recv.reset();
            };
        }
    }, [mode, onImport, onClose]);

    // Handle play/pause
    const handleTogglePlay = useCallback(() => {
        if (!streamDisplay) return;

        if (isPlaying) {
            streamDisplay.stop();
            setIsPlaying(false);
        } else {
            streamDisplay.start();
            setIsPlaying(true);
        }
    }, [streamDisplay, isPlaying]);

    // Handle manual frame input (for testing or slow scanning)
    const handleFrameInput = useCallback(() => {
        if (!receiver || !scanInput.trim()) return;

        try {
            const frame = decodeFrame(scanInput.trim());
            if (frame) {
                receiver.receiveFrame(frame);
                setScanInput('');
                setError('');
            } else {
                setError('Invalid QR frame data');
            }
        } catch (e) {
            setError('Failed to process frame');
        }
    }, [receiver, scanInput]);

    return (
        <div className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                    onClick={() => setMode('send')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'send'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Radio size={16} />
                    Stream Data
                </button>
                <button
                    onClick={() => setMode('receive')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'receive'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Camera size={16} />
                    Receive Data
                </button>
            </div>

            {mode === 'send' ? (
                <>
                    {/* Send Mode - Animated QR Display */}
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <WifiOff size={20} className="text-indigo-600" />
                            <span className="text-sm font-medium text-indigo-700">Air-Gapped Transfer</span>
                        </div>
                        <h3 className="font-semibold text-slate-800 mb-1">100% Offline Sync</h3>
                        <p className="text-sm text-slate-600">
                            Point the receiving device's camera at this screen
                        </p>
                    </div>

                    {/* QR Canvas */}
                    <div className="flex justify-center">
                        <div className="bg-white p-4 rounded-xl shadow-lg">
                            <canvas
                                ref={canvasRef}
                                className="block mx-auto"
                                style={{ width: 300, height: 300 }}
                            />
                        </div>
                    </div>

                    {/* Progress */}
                    {sendProgress && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Frame {sendProgress.currentFrame} / {sendProgress.totalFrames}</span>
                                <span>{sendProgress.percent}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 transition-all duration-100"
                                    style={{ width: `${sendProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleTogglePlay}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${isPlaying
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                            {isPlaying ? 'Pause' : 'Start Streaming'}
                        </button>
                    </div>

                    {/* Info */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-700">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap size={14} />
                            <strong>Spy-grade privacy</strong>
                        </div>
                        <p>
                            {estimate.frames} frames • {estimate.displayText} to transfer •
                            No internet, WiFi, or Bluetooth needed
                        </p>
                    </div>
                </>
            ) : (
                <>
                    {/* Receive Mode */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 text-center">
                        <Camera size={48} className="mx-auto text-green-600 mb-3" />
                        <h3 className="font-semibold text-slate-800 mb-1">Scan QR Stream</h3>
                        <p className="text-sm text-slate-600">
                            Point your camera at the streaming QR codes
                        </p>
                    </div>

                    {/* Progress */}
                    {receiveProgress && receiveProgress.totalFrames > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Received {receiveProgress.currentFrame} / {receiveProgress.totalFrames} frames</span>
                                <span>{receiveProgress.percent}%</span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-100"
                                    style={{ width: `${receiveProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Manual Input (for testing) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Paste QR Frame (manual input)
                        </label>
                        <textarea
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            placeholder='Paste scanned QR content here...'
                            className="w-full h-20 p-3 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                        />
                    </div>

                    <button
                        onClick={handleFrameInput}
                        disabled={!scanInput.trim()}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                    >
                        Process Frame
                    </button>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                            <Check size={16} />
                            Data received successfully! Importing...
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                        <strong>Tip:</strong> For best results, hold your camera steady and ensure good lighting.
                        Missing frames will be automatically detected.
                    </div>
                </>
            )}

            {/* Close Button */}
            <div className="pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="w-full py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
