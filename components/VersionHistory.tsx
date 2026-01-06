import React, { useState } from 'react';
import { History, RotateCcw, Eye, X, Clock, Edit3, Plus, ChevronRight } from 'lucide-react';
import { Note, NoteVersion } from '../types';

interface VersionHistoryProps {
    note: Note;
    onRestore: (version: NoteVersion) => void;
    onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
    note,
    onRestore,
    onClose
}) => {
    const [previewVersion, setPreviewVersion] = useState<NoteVersion | null>(null);
    const versions = note.versions || [];

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

        if (isToday) {
            return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else if (isYesterday) {
            return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    };

    const getChangeIcon = (type: string) => {
        switch (type) {
            case 'created': return <Plus size={12} className="text-green-600" />;
            case 'edited': return <Edit3 size={12} className="text-blue-600" />;
            case 'restored': return <RotateCcw size={12} className="text-purple-600" />;
            default: return <Clock size={12} className="text-slate-400" />;
        }
    };

    const getChangeLabel = (type: string) => {
        switch (type) {
            case 'created': return 'Created';
            case 'edited': return 'Edited';
            case 'restored': return 'Restored';
            default: return 'Changed';
        }
    };

    if (versions.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                    <History size={24} className="text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">No history yet</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Edit this note to start building version history. Up to 10 versions are saved.
                </p>
                <button
                    onClick={onClose}
                    className="mt-6 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                    <History size={20} className="text-purple-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800">Version History</h3>
                    <p className="text-sm text-slate-500">{versions.length} version{versions.length !== 1 ? 's' : ''} saved</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex mt-4">
                {/* Version List */}
                <div className={`${previewVersion ? 'w-1/2 pr-4 border-r border-slate-100' : 'w-full'} overflow-y-auto`}>
                    <div className="space-y-2">
                        {/* Current version (not in history yet) */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <Clock size={12} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-emerald-800">Current</span>
                                        <span className="text-xs text-emerald-600 ml-2">Latest changes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Previous versions */}
                        {versions.slice().reverse().map((version, index) => (
                            <div
                                key={version.id}
                                className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer ${previewVersion?.id === version.id
                                        ? 'border-purple-300 bg-purple-50'
                                        : 'border-slate-200'
                                    }`}
                                onClick={() => setPreviewVersion(version)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                            {getChangeIcon(version.changeType)}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-slate-700">
                                                {formatTimestamp(version.timestamp)}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-2">
                                                {getChangeLabel(version.changeType)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewVersion(version);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            title="Preview"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Restore this version? Current content will be saved to history.')) {
                                                    onRestore(version);
                                                }
                                            }}
                                            className="p-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                            title="Restore"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                        <ChevronRight size={14} className="text-slate-300" />
                                    </div>
                                </div>
                                {version.title !== note.title && (
                                    <div className="mt-2 text-xs text-slate-500">
                                        Title: "{version.title.substring(0, 40)}{version.title.length > 40 ? '...' : ''}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview Panel */}
                {previewVersion && (
                    <div className="w-1/2 pl-4 overflow-y-auto">
                        <div className="sticky top-0 bg-white pb-3 flex items-center justify-between">
                            <h4 className="font-medium text-slate-700">Preview</h4>
                            <button
                                onClick={() => setPreviewVersion(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-800 mb-3">{previewVersion.title}</h5>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                                {previewVersion.content || <span className="text-slate-400 italic">No content</span>}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                if (confirm('Restore this version? Current content will be saved to history.')) {
                                    onRestore(previewVersion);
                                }
                            }}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors"
                        >
                            <RotateCcw size={16} />
                            Restore This Version
                        </button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
