import React from 'react';
import { FileText, Tag, Trash2, Edit3 } from 'lucide-react';
import { Note, Notebook } from '../types';

interface NotesGridProps {
    notes: Note[];
    notebooks: Notebook[];
    onDeleteNote: (id: string) => void;
    onEditNote: (note: Note) => void;
    onTagClick?: (tag: string) => void;
    searchQuery?: string;
}

// Highlight search matches
const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
        regex.test(part) ? <mark key={i} className="bg-amber-200 text-amber-900 rounded px-0.5">{part}</mark> : part
    );
};

// Truncate content for preview
const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
};

export const NotesGrid: React.FC<NotesGridProps> = ({
    notes,
    notebooks,
    onDeleteNote,
    onEditNote,
    onTagClick,
    searchQuery = ''
}) => {
    if (notes.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-1">No notes yet</h3>
                <p className="text-sm text-slate-400">
                    Click "+ Add Note" to create your first note
                </p>
            </div>
        );
    }

    const getNotebookName = (notebookId: string) => {
        return notebooks.find(n => n.id === notebookId)?.name || 'General';
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note) => (
                <div
                    key={note.id}
                    className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col"
                >
                    {/* Note Content */}
                    <div className="p-4 flex-1">
                        {/* Title */}
                        <h3 className="font-semibold text-slate-800 mb-2 line-clamp-2">
                            {highlightMatch(note.title, searchQuery)}
                        </h3>

                        {/* Content Preview */}
                        <p className="text-sm text-slate-500 mb-3 line-clamp-4">
                            {highlightMatch(truncateContent(note.content), searchQuery)}
                        </p>

                        {/* Tags */}
                        {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                                {note.tags.slice(0, 3).map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTagClick?.(tag);
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs hover:bg-indigo-100 transition-colors"
                                    >
                                        <Tag size={10} />
                                        {tag}
                                    </button>
                                ))}
                                {note.tags.length > 3 && (
                                    <span className="px-2 py-0.5 text-xs text-slate-400">
                                        +{note.tags.length - 3} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                            <span className="font-medium text-slate-500">{getNotebookName(note.notebookId)}</span>
                            <span className="mx-1">•</span>
                            {formatDate(note.updatedAt || note.createdAt)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEditNote(note)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Note"
                            >
                                <Edit3 size={14} />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm(`Delete "${note.title}"?`)) {
                                        onDeleteNote(note.id);
                                    }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Note"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
