/**
 * useCitations - Academic Reference Manager Hook
 * 
 * Provides automatic detection of academic papers and citation generation.
 */

import { useState, useCallback } from 'react';
import { Bookmark } from '../types';
import {
    AcademicMetadata,
    detectAcademicUrl,
    fetchAcademicMetadata,
    isAcademicUrl,
} from '../utils/citationParser';
import {
    CitationFormat,
    formatCitation,
    generateBibliography,
    getAvailableFormats,
    getFormatName,
} from '../utils/citationFormatter';

export interface BookmarkWithCitation extends Bookmark {
    academicMetadata?: AcademicMetadata;
}

export function useCitations() {
    const [isLoading, setIsLoading] = useState<Set<string>>(new Set());
    const [metadataCache, setMetadataCache] = useState<Map<string, AcademicMetadata>>(new Map());

    /**
     * Check if a bookmark is likely an academic paper
     */
    const isAcademicBookmark = useCallback((bookmark: Bookmark): boolean => {
        return isAcademicUrl(bookmark.url);
    }, []);

    /**
     * Fetch metadata for a bookmark
     */
    const fetchMetadata = useCallback(async (bookmark: Bookmark): Promise<AcademicMetadata | null> => {
        // Check cache first
        if (metadataCache.has(bookmark.id)) {
            return metadataCache.get(bookmark.id)!;
        }

        setIsLoading(prev => new Set([...prev, bookmark.id]));

        try {
            const metadata = await fetchAcademicMetadata(bookmark.url);

            if (metadata) {
                setMetadataCache(prev => new Map(prev).set(bookmark.id, metadata));
            }

            return metadata;
        } finally {
            setIsLoading(prev => {
                const next = new Set(prev);
                next.delete(bookmark.id);
                return next;
            });
        }
    }, [metadataCache]);

    /**
     * Generate citation for a bookmark
     */
    const getCitation = useCallback(async (
        bookmark: Bookmark,
        format: CitationFormat = 'apa'
    ): Promise<string | null> => {
        const metadata = await fetchMetadata(bookmark);
        if (!metadata) return null;
        return formatCitation(metadata, format);
    }, [fetchMetadata]);

    /**
     * Generate bibliography from multiple bookmarks
     */
    const getBibliography = useCallback(async (
        bookmarks: Bookmark[],
        format: CitationFormat = 'apa'
    ): Promise<string> => {
        const academicBookmarks = bookmarks.filter(isAcademicBookmark);
        const metadataList = await Promise.all(
            academicBookmarks.map(b => fetchMetadata(b))
        );

        const validMetadata = metadataList.filter((m): m is AcademicMetadata => m !== null);
        return generateBibliography(validMetadata, format);
    }, [isAcademicBookmark, fetchMetadata]);

    /**
     * Copy citation to clipboard
     */
    const copyCitation = useCallback(async (
        bookmark: Bookmark,
        format: CitationFormat = 'apa'
    ): Promise<boolean> => {
        const citation = await getCitation(bookmark, format);
        if (!citation) return false;

        try {
            await navigator.clipboard.writeText(citation);
            return true;
        } catch {
            return false;
        }
    }, [getCitation]);

    /**
     * Export bibliography as file
     */
    const exportBibliography = useCallback(async (
        bookmarks: Bookmark[],
        format: CitationFormat
    ): Promise<void> => {
        const content = await getBibliography(bookmarks, format);

        const extension = format === 'bibtex' ? 'bib' :
            format === 'ris' ? 'ris' : 'txt';
        const mimeType = 'text/plain';

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `bibliography.${extension}`;
        a.click();

        URL.revokeObjectURL(url);
    }, [getBibliography]);

    return {
        isLoading: (id: string) => isLoading.has(id),
        isAcademicBookmark,
        fetchMetadata,
        getCitation,
        getBibliography,
        copyCitation,
        exportBibliography,
        formats: getAvailableFormats(),
        getFormatName,
        metadataCache,
    };
}
