/**
 * useSearch - Fuzzy Search Hook with Fuse.js
 * 
 * MATHEMATICAL MOAT:
 * - Uses Bitap algorithm (approximate string matching)
 * - Pre-computed index for O(1) search initialization
 * - Threshold-based fuzzy matching (Levenshtein distance normalized)
 * 
 * COMPLEXITY:
 * - Index creation: O(n) where n = total items
 * - Search: O(k * m) where k = pattern length, m = matched results
 * - Memory: O(n) for index storage
 * 
 * FEATURES:
 * - Typo tolerance (searches "javscript" finds "javascript")
 * - Multi-field search (title, url, tags, description)
 * - Weighted scoring (title matches rank higher)
 */

import { useMemo, useCallback } from 'react';
import Fuse, { IFuseOptions, FuseResult } from 'fuse.js';
import { Bookmark, Note } from '../types';

// Fuse.js configuration optimized for bookmark/note search
const BOOKMARK_SEARCH_OPTIONS: IFuseOptions<Bookmark> = {
    // Fields to search with weights
    keys: [
        { name: 'title', weight: 2.0 },        // Title matches rank highest
        { name: 'url', weight: 1.0 },           // URL matches
        { name: 'description', weight: 0.8 },   // Description matches
        { name: 'tags', weight: 1.5 },          // Tag matches rank high
    ],
    // Fuzzy matching configuration
    threshold: 0.3,        // 0 = exact match, 1 = match anything
    distance: 100,         // Characters to search within
    minMatchCharLength: 2, // Minimum chars to trigger search
    includeScore: true,    // Include match score for ranking
    includeMatches: true,  // Include match positions (for highlighting)
    ignoreLocation: true,  // Search entire string
    useExtendedSearch: false,
    findAllMatches: true,
};

const NOTE_SEARCH_OPTIONS: IFuseOptions<Note> = {
    keys: [
        { name: 'title', weight: 2.0 },
        { name: 'content', weight: 1.0 },
        { name: 'tags', weight: 1.5 },
    ],
    threshold: 0.3,
    distance: 200,         // Notes can be longer
    minMatchCharLength: 2,
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    findAllMatches: true,
};

export interface SearchResult<T> {
    item: T;
    score: number;  // 0 = perfect, 1 = no match
    matches?: Array<{
        key: string;
        indices: Array<[number, number]>;
    }>;
}

/**
 * Hook for searching bookmarks with fuzzy matching
 * 
 * @param bookmarks - Array of bookmarks to search
 * @returns Search function and result count
 */
export function useBookmarkSearch(bookmarks: Bookmark[]) {
    // Create Fuse index (memoized, recalculates when bookmarks change)
    const fuse = useMemo(() => {
        return new Fuse(bookmarks, BOOKMARK_SEARCH_OPTIONS);
    }, [bookmarks]);

    /**
     * Search bookmarks with fuzzy matching
     * 
     * @param query - Search query string
     * @returns Sorted array of matching bookmarks with scores
     */
    const search = useCallback((query: string): SearchResult<Bookmark>[] => {
        if (!query.trim()) {
            // Return all bookmarks with perfect score if no query
            return bookmarks.map(item => ({ item, score: 0 }));
        }

        const results = fuse.search(query);
        return results.map((result: FuseResult<Bookmark>) => ({
            item: result.item,
            score: result.score ?? 0,
            matches: result.matches?.map(m => ({
                key: m.key ?? '',
                indices: m.indices as Array<[number, number]>
            }))
        }));
    }, [fuse, bookmarks]);

    /**
     * Filter by tag (exact match, O(n))
     */
    const filterByTag = useCallback((tag: string): Bookmark[] => {
        if (!tag) return bookmarks;
        return bookmarks.filter(b => b.tags?.includes(tag));
    }, [bookmarks]);

    /**
     * Filter by folder (exact match, O(n))
     */
    const filterByFolder = useCallback((folderId: string): Bookmark[] => {
        if (!folderId || folderId === 'ALL') return bookmarks;
        return bookmarks.filter(b => b.folderId === folderId);
    }, [bookmarks]);

    return {
        search,
        filterByTag,
        filterByFolder,
        totalCount: bookmarks.length
    };
}

/**
 * Hook for searching notes with fuzzy matching
 * 
 * @param notes - Array of notes to search
 * @returns Search function
 */
export function useNoteSearch(notes: Note[]) {
    const fuse = useMemo(() => {
        return new Fuse(notes, NOTE_SEARCH_OPTIONS);
    }, [notes]);

    const search = useCallback((query: string): SearchResult<Note>[] => {
        if (!query.trim()) {
            return notes.map(item => ({ item, score: 0 }));
        }

        const results = fuse.search(query);
        return results.map((result: FuseResult<Note>) => ({
            item: result.item,
            score: result.score ?? 0,
            matches: result.matches?.map(m => ({
                key: m.key ?? '',
                indices: m.indices as Array<[number, number]>
            }))
        }));
    }, [fuse, notes]);

    const filterByTag = useCallback((tag: string): Note[] => {
        if (!tag) return notes;
        return notes.filter(n => n.tags?.includes(tag));
    }, [notes]);

    const filterByNotebook = useCallback((notebookId: string): Note[] => {
        if (!notebookId || notebookId === 'ALL_NOTES') return notes;
        return notes.filter(n => n.notebookId === notebookId);
    }, [notes]);

    return {
        search,
        filterByTag,
        filterByNotebook,
        totalCount: notes.length
    };
}

/**
 * Combined search for both bookmarks and notes
 * Useful for global search feature
 */
export function useGlobalSearch(bookmarks: Bookmark[], notes: Note[]) {
    const bookmarkSearch = useBookmarkSearch(bookmarks);
    const noteSearch = useNoteSearch(notes);

    const searchAll = useCallback((query: string) => {
        return {
            bookmarks: bookmarkSearch.search(query),
            notes: noteSearch.search(query)
        };
    }, [bookmarkSearch, noteSearch]);

    return {
        searchAll,
        searchBookmarks: bookmarkSearch.search,
        searchNotes: noteSearch.search,
        totalBookmarks: bookmarks.length,
        totalNotes: notes.length
    };
}
