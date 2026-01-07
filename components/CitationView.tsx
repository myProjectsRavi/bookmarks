/**
 * CitationView - Academic citation display and copy
 * 
 * Shows detected academic paper metadata and generates citations.
 */

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, BookOpen, ExternalLink, Download, Loader } from 'lucide-react';
import { Bookmark } from '../types';
import { AcademicMetadata } from '../utils/citationParser';
import { CitationFormat, formatCitation, getAvailableFormats, getFormatName } from '../utils/citationFormatter';

interface CitationViewProps {
    isOpen: boolean;
    onClose: () => void;
    bookmark: Bookmark;
    metadata: AcademicMetadata | null;
    isLoading: boolean;
    onFetchMetadata: () => Promise<void>;
}

export const CitationView: React.FC<CitationViewProps> = ({
    isOpen,
    onClose,
    bookmark,
    metadata,
    isLoading,
    onFetchMetadata,
}) => {
    const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('apa');
    const [copied, setCopied] = useState(false);
    const [citation, setCitation] = useState('');

    useEffect(() => {
        if (isOpen && !metadata && !isLoading) {
            onFetchMetadata();
        }
    }, [isOpen, metadata, isLoading, onFetchMetadata]);

    useEffect(() => {
        if (metadata) {
            setCitation(formatCitation(metadata, selectedFormat));
        }
    }, [metadata, selectedFormat]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(citation);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const extension = selectedFormat === 'bibtex' ? 'bib' :
            selectedFormat === 'ris' ? 'ris' : 'txt';
        const blob = new Blob([citation], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citation.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <BookOpen size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Generate Citation</h2>
                            <p className="text-emerald-100 text-sm">Academic reference manager</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/30 hover:bg-white/50 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader className="animate-spin text-emerald-600" size={32} />
                            <span className="ml-3 text-slate-600">Fetching paper metadata...</span>
                        </div>
                    ) : metadata ? (
                        <>
                            {/* Paper Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h3 className="font-semibold text-slate-800 text-base leading-tight mb-2">
                                    {metadata.title || bookmark.title}
                                </h3>
                                <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                                    {metadata.authors?.slice(0, 5).join(', ')}{metadata.authors && metadata.authors.length > 5 ? ' et al.' : ''}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {metadata.year && <span className="bg-slate-200 px-2 py-0.5 rounded">{metadata.year}</span>}
                                    {metadata.journal && <span className="italic">{metadata.journal}</span>}
                                    {metadata.citationCount !== undefined && (
                                        <span className="text-emerald-600 font-medium">{metadata.citationCount} citations</span>
                                    )}
                                </div>
                            </div>

                            {/* Format Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Citation Format
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {getAvailableFormats().map((format) => (
                                        <button
                                            key={format}
                                            onClick={() => setSelectedFormat(format)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedFormat === format
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {getFormatName(format).split(' ')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Citation Output */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {getFormatName(selectedFormat)} Citation
                                </label>
                                <div className="relative">
                                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                                        {citation}
                                    </pre>
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <button
                                            onClick={handleCopy}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            {copied ? (
                                                <Check size={16} className="text-green-400" />
                                            ) : (
                                                <Copy size={16} className="text-slate-300" />
                                            )}
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="Download file"
                                        >
                                            <Download size={16} className="text-slate-300" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Original Link */}
                            <a
                                href={bookmark.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                <ExternalLink size={14} />
                                Open original paper
                            </a>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-600">Could not fetch paper metadata.</p>
                            <p className="text-sm text-slate-500 mt-1">
                                This URL may not be a recognized academic paper.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
