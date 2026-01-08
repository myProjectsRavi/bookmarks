import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Check, X, Loader, Copy, ArrowLeft, Camera, QrCode, Folder as FolderIcon, Zap } from 'lucide-react';
import { Folder, Bookmark, Notebook, Note } from '../types';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import Peer, { DataConnection } from 'peerjs';

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

// Generate a short readable peer ID
function generatePeerId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
    let id = 'LH-';
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
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
    const [peerId, setPeerId] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'waiting' | 'connected' | 'transferring' | 'done' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [inputCode, setInputCode] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState(0);

    const peerRef = useRef<Peer | null>(null);
    const connectionRef = useRef<DataConnection | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => { });
            scannerRef.current = null;
        }
        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
    };

    // SENDER: Start hosting and wait for connection
    const startSender = async () => {
        setStatus('waiting');
        setStatusMessage('Creating connection...');

        const id = generatePeerId();
        setPeerId(id);

        try {
            const peer = new Peer(id, {
                debug: 0, // Minimal logging
            });
            peerRef.current = peer;

            peer.on('open', async (openedId) => {
                setStatusMessage('Ready! Scan QR or enter code on other device');

                // Generate QR with just the peer ID
                const qr = await QRCode.toDataURL(openedId, {
                    width: 280,
                    margin: 2,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#1e293b', light: '#ffffff' }
                });
                setQrDataUrl(qr);
            });

            peer.on('connection', (conn) => {
                connectionRef.current = conn;
                setStatus('connected');
                setStatusMessage('Device connected! Sending data...');

                conn.on('open', () => {
                    // Send all data
                    const payload = {
                        type: 'linkhaven-sync',
                        folders,
                        bookmarks,
                        notebooks,
                        notes,
                        vaultBookmarks
                    };

                    setStatus('transferring');
                    setProgress(50);

                    conn.send(JSON.stringify(payload));

                    setProgress(100);
                    setStatus('done');
                    setStatusMessage(`✨ Sent ${bookmarks.length} bookmarks!`);
                });

                conn.on('error', (err) => {
                    setStatus('error');
                    setStatusMessage('Connection error');
                    console.error('Connection error:', err);
                });
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // ID already in use, try again
                    cleanup();
                    startSender();
                } else {
                    setStatus('error');
                    setStatusMessage('Connection failed. Try again.');
                }
            });

        } catch (err) {
            setStatus('error');
            setStatusMessage('Failed to start. Check network.');
        }
    };

    // RECEIVER: Connect to sender
    const connectToSender = (senderId: string) => {
        const cleanId = senderId.trim().toUpperCase();
        if (!cleanId) {
            onError('Please enter a code');
            return;
        }

        setStatus('waiting');
        setStatusMessage('Connecting...');
        setIsScanning(false);

        const peer = new Peer({
            debug: 0,
        });
        peerRef.current = peer;

        peer.on('open', () => {
            setStatusMessage('Connecting to sender...');

            const conn = peer.connect(cleanId, { reliable: true });
            connectionRef.current = conn;

            conn.on('open', () => {
                setStatus('connected');
                setStatusMessage('Connected! Waiting for data...');
            });

            conn.on('data', (data) => {
                try {
                    const payload = typeof data === 'string' ? JSON.parse(data) : data;

                    if (payload.type === 'linkhaven-sync') {
                        setStatus('done');
                        setProgress(100);

                        onImport({
                            folders: payload.folders || [],
                            bookmarks: payload.bookmarks || [],
                            notebooks: payload.notebooks || [],
                            notes: payload.notes || [],
                            vaultBookmarks: payload.vaultBookmarks || []
                        });

                        const count = payload.bookmarks?.length || 0;
                        onSuccess(`✨ Imported ${count} bookmarks!`);

                        setTimeout(() => {
                            cleanup();
                            onClose();
                        }, 1500);
                    }
                } catch (e) {
                    setStatus('error');
                    setStatusMessage('Failed to parse data');
                }
            });

            conn.on('error', () => {
                setStatus('error');
                setStatusMessage('Connection failed');
            });
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            setStatus('error');
            if (err.type === 'peer-unavailable') {
                setStatusMessage('Code not found. Check the code and try again.');
            } else {
                setStatusMessage('Connection failed. Check network.');
            }
        });
    };

    // QR Scanner
    const startScanner = async () => {
        setIsScanning(true);

        try {
            const html5QrCode = new Html5Qrcode("qr-scanner-container");
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    html5QrCode.stop().catch(() => { });
                    setIsScanning(false);
                    connectToSender(decodedText);
                },
                () => { }
            );
        } catch (err) {
            setIsScanning(false);
            onError('Camera access denied');
        }
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

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Wifi size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">WiFi Sync</h3>
                    <p className="text-sm text-slate-500">Direct device-to-device transfer</p>
                </div>
            </div>

            {/* Mode Selection */}
            {mode === 'select' && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100 rounded-lg p-4 text-sm">
                        <p className="font-medium text-cyan-800 flex items-center gap-2">
                            <Zap size={16} /> Instant WiFi Sync
                        </p>
                        <p className="text-cyan-600 mt-1">
                            Sync {totalItems}+ items instantly. Both devices need internet.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => {
                                setMode('send');
                                startSender();
                            }}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <QrCode size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Send</div>
                                <div className="text-xs text-slate-500 mt-1">Show code</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('receive')}
                            className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all group"
                        >
                            <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                                <Camera size={28} className="text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <div className="font-semibold text-slate-800">Receive</div>
                                <div className="text-xs text-slate-500 mt-1">Scan code</div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* SEND Mode */}
            {mode === 'send' && (
                <div className="space-y-4">
                    {/* Data summary */}
                    <div className="bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-white rounded border text-xs">
                                📁 {dataStats.folders} folders
                            </span>
                            <span className="px-2 py-1 bg-white rounded border text-xs">
                                🔖 {dataStats.bookmarks} bookmarks
                            </span>
                            {dataStats.notes > 0 && (
                                <span className="px-2 py-1 bg-white rounded border text-xs">
                                    📝 {dataStats.notes} notes
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    {status === 'waiting' && !qrDataUrl && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                            <p className="text-sm text-slate-600">{statusMessage}</p>
                        </div>
                    )}

                    {status === 'waiting' && qrDataUrl && (
                        <div className="space-y-4">
                            <div className="flex justify-center p-4 bg-white border-2 border-slate-200 rounded-xl">
                                <img src={qrDataUrl} alt="Sync QR" className="w-56 h-56" />
                            </div>

                            <div className="text-center">
                                <div className="text-2xl font-mono font-bold text-slate-800 tracking-wider">
                                    {peerId}
                                </div>
                                <p className="text-sm text-slate-500 mt-2">
                                    📱 Scan QR or enter this code on other device
                                </p>
                            </div>
                        </div>
                    )}

                    {status === 'connected' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check size={32} className="text-emerald-600" />
                            </div>
                            <p className="text-sm text-slate-600">{statusMessage}</p>
                        </div>
                    )}

                    {status === 'transferring' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                            <p className="text-sm text-slate-600">Sending data...</p>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className="bg-cyan-500 h-2 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {status === 'done' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check size={32} className="text-emerald-600" />
                            </div>
                            <p className="text-lg font-semibold text-emerald-700">{statusMessage}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                <X size={32} className="text-red-600" />
                            </div>
                            <p className="text-sm text-red-600">{statusMessage}</p>
                            <button
                                onClick={() => {
                                    cleanup();
                                    setStatus('idle');
                                    startSender();
                                }}
                                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* RECEIVE Mode */}
            {mode === 'receive' && (
                <div className="space-y-4">
                    {status === 'idle' && !isScanning && (
                        <>
                            <button
                                onClick={startScanner}
                                className="w-full flex flex-col items-center gap-3 p-8 border-2 border-dashed border-slate-300 rounded-xl hover:border-cyan-500 hover:bg-cyan-50/50 transition-all"
                            >
                                <Camera size={48} className="text-cyan-600" />
                                <div className="text-center">
                                    <div className="font-semibold text-slate-800">Scan QR Code</div>
                                    <div className="text-xs text-slate-500 mt-1">Point camera at sender's screen</div>
                                </div>
                            </button>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 border-t border-slate-200"></div>
                                <span className="text-xs text-slate-400">or enter code</span>
                                <div className="flex-1 border-t border-slate-200"></div>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                                    placeholder="LH-XXXXXX"
                                    className="flex-1 px-4 py-3 text-center font-mono text-lg font-bold tracking-wider border-2 border-slate-200 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                                    maxLength={9}
                                />
                                <button
                                    onClick={() => connectToSender(inputCode)}
                                    disabled={inputCode.length < 8}
                                    className="px-6 py-3 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Connect
                                </button>
                            </div>
                        </>
                    )}

                    {isScanning && (
                        <div className="space-y-4">
                            <div
                                id="qr-scanner-container"
                                className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden"
                            />
                            <button
                                onClick={stopScanner}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                <X size={16} /> Cancel
                            </button>
                        </div>
                    )}

                    {(status === 'waiting' || status === 'connected') && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader size={40} className="animate-spin text-cyan-500" />
                            <p className="text-sm text-slate-600">{statusMessage}</p>
                        </div>
                    )}

                    {status === 'done' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Check size={32} className="text-emerald-600" />
                            </div>
                            <p className="text-lg font-semibold text-emerald-700">Import complete!</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                <X size={32} className="text-red-600" />
                            </div>
                            <p className="text-sm text-red-600 text-center">{statusMessage}</p>
                            <button
                                onClick={() => {
                                    cleanup();
                                    setStatus('idle');
                                    setInputCode('');
                                }}
                                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                                Try Again
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
                            setStatus('idle');
                            setQrDataUrl('');
                            setPeerId('');
                            setInputCode('');
                        } else {
                            onClose();
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                    <ArrowLeft size={16} />
                    {mode === 'select' ? 'Cancel' : 'Back'}
                </button>
                <div className="text-xs text-slate-400">
                    P2P encrypted
                </div>
            </div>
        </div>
    );
};
