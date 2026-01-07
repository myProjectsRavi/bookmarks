/**
 * SimHash - Content Similarity Detection
 * 
 * ALGORITHM:
 * 1. Tokenize text → words
 * 2. Hash each word → 64-bit fingerprint
 * 3. Weight by term frequency
 * 4. Combine into single 64-bit SimHash
 * 5. Compare via Hamming distance (XOR + popcount)
 * 
 * PROPERTIES:
 * - Similar documents have similar fingerprints
 * - Hamming distance ≤ 3 → >90% similarity
 * - Hamming distance ≤ 6 → >80% similarity
 * 
 * COMPLEXITY:
 * - Fingerprint generation: O(n) where n = words
 * - Comparison: O(1) per pair
 * - Find all similar: O(n²) naive, O(n) with LSH
 * 
 * MATH MOAT: Google uses SimHash for web deduplication
 */

// 64-bit number representation using two 32-bit numbers
// (JavaScript's bitwise ops are limited to 32 bits)
interface SimHash64 {
    high: number;  // High 32 bits
    low: number;   // Low 32 bits
}

// Stop words to filter out (common words with no semantic meaning)
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
    'the', 'to', 'was', 'were', 'will', 'with', 'you', 'your', 'this',
    'they', 'we', 'our', 'have', 'been', 'not', 'but', 'what', 'all',
    'can', 'had', 'her', 'there', 'which', 'their', 'if', 'each',
    'about', 'how', 'up', 'out', 'them', 'then', 'she', 'many', 'some',
    'so', 'these', 'would', 'other', 'into', 'who', 'no', 'more',
]);

/**
 * FNV-1a 64-bit hash (fast, good distribution)
 * Implemented in 32-bit chunks for JavaScript
 */
function fnv1a64(str: string): SimHash64 {
    const FNV_PRIME_LOW = 0x01b3;
    const FNV_PRIME_HIGH = 0x0100;
    const FNV_OFFSET_LOW = 0x62b82175;
    const FNV_OFFSET_HIGH = 0xcbf29ce4;

    let low = FNV_OFFSET_LOW;
    let high = FNV_OFFSET_HIGH;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);

        // XOR with character
        low ^= char;

        // Multiply by prime (simplified for 32-bit)
        const temp = low * FNV_PRIME_LOW;
        low = temp >>> 0;
        high = ((high * FNV_PRIME_LOW) + (high * FNV_PRIME_HIGH) + Math.floor(temp / 0x100000000)) >>> 0;
    }

    return { high, low };
}

/**
 * Tokenize and normalize text
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .split(/\s+/)              // Split on whitespace
        .filter(word =>
            word.length >= 2 &&      // Min 2 chars
            word.length <= 30 &&     // Max 30 chars
            !STOP_WORDS.has(word) && // Remove stop words
            !/^\d+$/.test(word)      // Remove pure numbers
        );
}

/**
 * Calculate term frequency
 */
function calculateTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    return tf;
}

/**
 * Generate 64-bit SimHash fingerprint
 */
export function generateSimHash(text: string): SimHash64 {
    const tokens = tokenize(text);
    if (tokens.length === 0) {
        return { high: 0, low: 0 };
    }

    const tf = calculateTF(tokens);

    // Accumulator for each bit position (64 bits = 32 high + 32 low)
    const vectorHigh = new Array(32).fill(0);
    const vectorLow = new Array(32).fill(0);

    // For each token, hash and add weighted contribution
    for (const [token, count] of tf) {
        const hash = fnv1a64(token);
        const weight = count; // TF as weight

        // Process high 32 bits
        for (let i = 0; i < 32; i++) {
            if ((hash.high >> i) & 1) {
                vectorHigh[i] += weight;
            } else {
                vectorHigh[i] -= weight;
            }
        }

        // Process low 32 bits
        for (let i = 0; i < 32; i++) {
            if ((hash.low >> i) & 1) {
                vectorLow[i] += weight;
            } else {
                vectorLow[i] -= weight;
            }
        }
    }

    // Convert to binary (positive → 1, negative → 0)
    let high = 0;
    let low = 0;

    for (let i = 0; i < 32; i++) {
        if (vectorHigh[i] > 0) high |= (1 << i);
        if (vectorLow[i] > 0) low |= (1 << i);
    }

    return { high: high >>> 0, low: low >>> 0 };
}

/**
 * Calculate Hamming distance between two SimHashes
 * Returns number of differing bits (0-64)
 */
export function hammingDistance(a: SimHash64, b: SimHash64): number {
    // XOR to find differing bits
    const xorHigh = a.high ^ b.high;
    const xorLow = a.low ^ b.low;

    // Popcount (count set bits)
    return popcount32(xorHigh) + popcount32(xorLow);
}

/**
 * Fast popcount for 32-bit integer
 */
function popcount32(n: number): number {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    n = (n + (n >> 4)) & 0x0f0f0f0f;
    n = n + (n >> 8);
    n = n + (n >> 16);
    return n & 0x3f;
}

/**
 * Convert Hamming distance to similarity percentage
 * 0 distance = 100% similar
 * 64 distance = 0% similar
 */
export function distanceToSimilarity(distance: number): number {
    return Math.round((1 - distance / 64) * 100);
}

/**
 * Check if two documents are similar (Hamming ≤ threshold)
 */
export function isSimilar(
    a: SimHash64,
    b: SimHash64,
    threshold: number = 6
): boolean {
    return hammingDistance(a, b) <= threshold;
}

/**
 * Convert SimHash to hex string for storage
 */
export function simHashToHex(hash: SimHash64): string {
    const highHex = hash.high.toString(16).padStart(8, '0');
    const lowHex = hash.low.toString(16).padStart(8, '0');
    return highHex + lowHex;
}

/**
 * Parse hex string back to SimHash
 */
export function hexToSimHash(hex: string): SimHash64 {
    if (hex.length !== 16) {
        return { high: 0, low: 0 };
    }
    return {
        high: parseInt(hex.slice(0, 8), 16) >>> 0,
        low: parseInt(hex.slice(8, 16), 16) >>> 0,
    };
}

/**
 * Find all similar documents in a collection
 * Returns pairs of (index1, index2, similarity%)
 */
export function findSimilarPairs(
    hashes: SimHash64[],
    threshold: number = 6
): Array<{ i: number; j: number; similarity: number }> {
    const pairs: Array<{ i: number; j: number; similarity: number }> = [];

    for (let i = 0; i < hashes.length; i++) {
        for (let j = i + 1; j < hashes.length; j++) {
            const distance = hammingDistance(hashes[i], hashes[j]);
            if (distance <= threshold) {
                pairs.push({
                    i,
                    j,
                    similarity: distanceToSimilarity(distance),
                });
            }
        }
    }

    // Sort by similarity (highest first)
    return pairs.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Cluster similar documents together
 */
export function clusterBySimilarity(
    hashes: SimHash64[],
    threshold: number = 6
): number[][] {
    const n = hashes.length;
    const visited = new Set<number>();
    const clusters: number[][] = [];

    for (let i = 0; i < n; i++) {
        if (visited.has(i)) continue;

        const cluster: number[] = [i];
        visited.add(i);

        for (let j = i + 1; j < n; j++) {
            if (visited.has(j)) continue;

            if (isSimilar(hashes[i], hashes[j], threshold)) {
                cluster.push(j);
                visited.add(j);
            }
        }

        clusters.push(cluster);
    }

    return clusters;
}

export type { SimHash64 };
