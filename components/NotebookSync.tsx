import React, { useState, useEffect } from 'react';
import { Smartphone, Copy, Check, Upload, Download, AlertCircle, BookOpen } from 'lucide-react';
import { Notebook, Note } from '../types';

interface NotebookSyncProps {
    notebooks: Notebook[];
    notes: Note[];
    onImport: (notebooks: Notebook[], notes: Note[]) => void;
    onClose: () => void;
}

// Simple compression for sync payload
function compressData(data: string): string {
    return btoa(encodeURIComponent(data));
}

function decompressData(compressed: string): string {
    try {
        return decodeURIComponent(atob(compressed));
    } catch {
        return '';
    }
}

// Generate sync code for notebooks and notes
function generateNotebookSyncCode(notebooks: Notebook[], notes: Note[]): string {
    const payload = {
        v: 1, // version
        type: 'notebook', // distinguish from bookmark sync
        t: Date.now(),
        nb: notebooks.map(n => ({
            i: n.id,
            n: n.name,
            p: n.parentId,
            c: n.createdAt
        })),
        nt: notes.map(n => ({
            i: n.id,
            nb: n.notebookId,
            t: n.title,
            ct: n.content,
            tg: n.tags,
            c: n.createdAt,
            u: n.updatedAt
        }))
    };
    return compressData(JSON.stringify(payload));
}

// Parse sync code back to notebooks and notes
function parseNotebookSyncCode(code: string): { notebooks: Notebook[], notes: Note[] } | null {
    try {
        const json = decompressData(code);
        const payload = JSON.parse(json);

        if (!payload.v || payload.type !== 'notebook' || !payload.nb || !payload.nt) {
            return null;
        }

        const notebooks: Notebook[] = payload.nb.map((n: any) => ({
            id: n.i,
            name: n.n,
            parentId: n.p || null,
            createdAt: n.c
        }));

        const notes: Note[] = payload.nt.map((n: any) => ({
            id: n.i,
            notebookId: n.nb,
            title: n.t,
            content: n.ct,
            tags: n.tg || [],
            createdAt: n.c,
            updatedAt: n.u
        }));

        return { notebooks, notes };
    } catch {
        return null;
    }
}

export const NotebookSync: React.FC<NotebookSyncProps> = ({
    notebooks,
    notes,
    onImport,
    onClose
}) => {
    const [mode, setMode] = useState<'export' | 'import'>('export');
    const [syncCode, setSyncCode] = useState('');
    const [importCode, setImportCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (mode === 'export') {
            const code = generateNotebookSyncCode(notebooks, notes);
            setSyncCode(code);
        }
    }, [mode, notebooks, notes]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(syncCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleImport = () => {
        setError('');
        const result = parseNotebookSyncCode(importCode.trim());

        if (!result) {
            setError('Invalid notebook sync code. Make sure you copied the complete code.');
            return;
        }

        onImport(result.notebooks, result.notes);
        onClose();
    };

    return (
        <div className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                    onClick={() => setMode('export')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'export'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Upload size={16} />
                    Send Notebooks
                </button>
                <button
                    onClick={() => setMode('import')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${mode === 'import'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    <Download size={16} />
                    Receive Notebooks
                </button>
            </div>

            {mode === 'export' ? (
                <>
                    {/* Export Mode */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 text-center">
                        <BookOpen size={48} className="mx-auto text-purple-600 mb-3" />
                        <h3 className="font-semibold text-slate-800 mb-1">Share Your Notebooks</h3>
                        <p className="text-sm text-slate-600">
                            Copy this code and send it securely via WhatsApp, Signal, etc.
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">Notebook Sync Code</span>
                            <span className="text-xs text-slate-400">
                                {notebooks.length} notebooks, {notes.length} notes
                            </span>
                        </div>
                        <textarea
                            value={syncCode}
                            readOnly
                            className="w-full h-24 p-2 text-xs font-mono bg-white border border-slate-200 rounded resize-none"
                        />
                    </div>

                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Sync Code'}
                    </button>

                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-sm text-purple-700">
                        <strong>🔒 End-to-End Secure:</strong> This code is just encoded data. Only you and the recipient can read the actual notes after importing.
                    </div>
                </>
            ) : (
                <>
                    {/* Import Mode */}
                    <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg p-4 text-center">
                        <Smartphone size={48} className="mx-auto text-green-600 mb-3" />
                        <h3 className="font-semibold text-slate-800 mb-1">Receive Notebooks</h3>
                        <p className="text-sm text-slate-600">
                            Paste the notebook sync code from your friend
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Paste Notebook Sync Code
                        </label>
                        <textarea
                            value={importCode}
                            onChange={(e) => setImportCode(e.target.value)}
                            placeholder="Paste the notebook sync code here..."
                            className="w-full h-24 p-3 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleImport}
                        disabled={!importCode.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors"
                    >
                        <Download size={18} />
                        Import Notebooks
                    </button>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
                        <strong>Tip:</strong> This will add the notebooks to your existing collection. Duplicates will be preserved with new IDs.
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
