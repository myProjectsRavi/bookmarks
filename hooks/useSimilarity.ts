/**
 * useSimilarity - Content Similarity Detection Hook
 * 
 * Provides SimHash fingerprinting and duplicate detection.
 */

import { useState, useCallback, useMemo } from 'react';
import { Bookmark, Note } from '../types';
import {
    SimHash64,
    generateSimHash,
    hammingDistance,
    distanceToSimilarity,
    findSimilarPairs,
    clusterBySimilarity,
    simHashToHex,
    hexToSimHash,
} from '../utils/simhash';

export interface SimilarityResult {
    item1Index: number;
    item2Index: number;
    similarity: number; // 0-100%
}

export interface SimilarityCluster {
    indices: number[];
    representative: number; // Index of "main" item in cluster
}

export function useSimilarity() {
    const [hashCache, setHashCache] = useState<Map<string, SimHash64>>(new Map());
    const [isProcessing, setIsProcessing] = useState(false);

    /**
     * Generate fingerprint for content
     */
    const getFingerprint = useCallback((content: string, id?: string): SimHash64 => {
        if (id && hashCache.has(id)) {
            return hashCache.get(id)!;
        }

        const hash = generateSimHash(content);

        if (id) {
            setHashCache(prev => new Map(prev).set(id, hash));
        }

        return hash;
    }, [hashCache]);

    /**
     * Compare two items and return similarity percentage
     */
    const compareSimilarity = useCallback((
        content1: string,
        content2: string
    ): number => {
        const hash1 = generateSimHash(content1);
        const hash2 = generateSimHash(content2);
        const distance = hammingDistance(hash1, hash2);
        return distanceToSimilarity(distance);
    }, []);

    /**
     * Find similar bookmarks
     */
    const findSimilarBookmarks = useCallback((
        bookmarks: Bookmark[],
        threshold: number = 6 // Hamming distance threshold
    ): SimilarityResult[] => {
        setIsProcessing(true);

        try {
            // Generate fingerprints for all bookmarks
            const hashes = bookmarks.map(b => {
                const content = `${b.title || ''} ${b.description || ''} ${b.url}`;
                return getFingerprint(content, b.id);
            });

            // Find similar pairs
            const pairs = findSimilarPairs(hashes, threshold);

            return pairs.map(p => ({
                item1Index: p.i,
                item2Index: p.j,
                similarity: p.similarity,
            }));
        } finally {
            setIsProcessing(false);
        }
    }, [getFingerprint]);

    /**
     * Find similar notes
     */
    const findSimilarNotes = useCallback((
        notes: Note[],
        threshold: number = 6
    ): SimilarityResult[] => {
        setIsProcessing(true);

        try {
            const hashes = notes.map(n => {
                const content = `${n.title || ''} ${n.content || ''}`;
                return getFingerprint(content, n.id);
            });

            const pairs = findSimilarPairs(hashes, threshold);

            return pairs.map(p => ({
                item1Index: p.i,
                item2Index: p.j,
                similarity: p.similarity,
            }));
        } finally {
            setIsProcessing(false);
        }
    }, [getFingerprint]);

    /**
     * Cluster bookmarks by similarity
     */
    const clusterBookmarks = useCallback((
        bookmarks: Bookmark[],
        threshold: number = 6
    ): SimilarityCluster[] => {
        const hashes = bookmarks.map(b => {
            const content = `${b.title || ''} ${b.description || ''} ${b.url}`;
            return getFingerprint(content, b.id);
        });

        const clusters = clusterBySimilarity(hashes, threshold);

        return clusters.map(indices => ({
            indices,
            representative: indices[0], // First item is representative
        }));
    }, [getFingerprint]);

    /**
     * Get duplicate suggestions (similarity > 90%)
     */
    const getDuplicateSuggestions = useCallback((
        bookmarks: Bookmark[]
    ): Array<{ bookmark1: Bookmark; bookmark2: Bookmark; similarity: number }> => {
        // Use low threshold (3) for high similarity
        const similar = findSimilarBookmarks(bookmarks, 3);

        return similar
            .filter(s => s.similarity >= 90)
            .map(s => ({
                bookmark1: bookmarks[s.item1Index],
                bookmark2: bookmarks[s.item2Index],
                similarity: s.similarity,
            }));
    }, [findSimilarBookmarks]);

    /**
     * Store hash for persistence
     */
    const serializeHash = useCallback((hash: SimHash64): string => {
        return simHashToHex(hash);
    }, []);

    /**
     * Restore hash from storage
     */
    const deserializeHash = useCallback((hex: string): SimHash64 => {
        return hexToSimHash(hex);
    }, []);

    return {
        isProcessing,
        getFingerprint,
        compareSimilarity,
        findSimilarBookmarks,
        findSimilarNotes,
        clusterBookmarks,
        getDuplicateSuggestions,
        serializeHash,
        deserializeHash,
        clearCache: () => setHashCache(new Map()),
    };
}
