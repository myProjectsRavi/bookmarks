/**
 * Merkle Tree - Cryptographic Content Verification
 * 
 * ALGORITHM:
 * - Binary tree of SHA-256 hashes
 * - Leaf nodes = content chunks
 * - Parent = SHA-256(left + right)
 * - Root = unique fingerprint of entire content
 * 
 * PROPERTIES:
 * - Any change flips the root hash
 * - Efficient verification: O(log n)
 * - Tamper-evident: Cannot modify without detection
 * 
 * USE CASE: Wayback Time-Lock
 * - Prove content unchanged since timestamp
 * - Legal-grade integrity verification
 */

/**
 * SHA-256 hash using Web Crypto API
 */
async function sha256(data: string | ArrayBuffer): Promise<string> {
    const buffer = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Split content into chunks for Merkle tree
 */
function chunkContent(content: string, chunkSize: number = 4096): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks.length > 0 ? chunks : [''];
}

/**
 * Build Merkle tree and return root hash
 */
export async function buildMerkleRoot(content: string): Promise<string> {
    const chunks = chunkContent(content);

    // Hash all leaf nodes
    let level = await Promise.all(chunks.map(chunk => sha256(chunk)));

    // Build tree bottom-up
    while (level.length > 1) {
        const nextLevel: string[] = [];

        for (let i = 0; i < level.length; i += 2) {
            if (i + 1 < level.length) {
                // Hash pair of nodes
                nextLevel.push(await sha256(level[i] + level[i + 1]));
            } else {
                // Odd node, promote as-is
                nextLevel.push(level[i]);
            }
        }

        level = nextLevel;
    }

    return level[0];
}

/**
 * Cryptographic timestamp seal
 */
export interface TimeLockSeal {
    contentHash: string;      // Merkle root of content
    timestamp: number;        // Unix timestamp (ms)
    nonce: string;            // Random nonce for uniqueness
    sealHash: string;         // Hash of (contentHash + timestamp + nonce)
    version: number;          // Seal format version
}

/**
 * Create a time-lock seal for content
 * Proves content existed at specific time
 */
export async function createTimeLockSeal(content: string): Promise<TimeLockSeal> {
    const contentHash = await buildMerkleRoot(content);
    const timestamp = Date.now();

    // Generate random nonce
    const nonceArray = new Uint8Array(16);
    crypto.getRandomValues(nonceArray);
    const nonce = Array.from(nonceArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Create seal hash
    const sealData = `${contentHash}:${timestamp}:${nonce}`;
    const sealHash = await sha256(sealData);

    return {
        contentHash,
        timestamp,
        nonce,
        sealHash,
        version: 1,
    };
}

/**
 * Verify a time-lock seal
 * Returns true if seal is valid and content unchanged
 */
export async function verifyTimeLockSeal(
    content: string,
    seal: TimeLockSeal
): Promise<{ valid: boolean; reason?: string }> {
    try {
        // Verify content hash
        const contentHash = await buildMerkleRoot(content);
        if (contentHash !== seal.contentHash) {
            return { valid: false, reason: 'Content has been modified' };
        }

        // Verify seal integrity
        const sealData = `${seal.contentHash}:${seal.timestamp}:${seal.nonce}`;
        const expectedSealHash = await sha256(sealData);
        if (expectedSealHash !== seal.sealHash) {
            return { valid: false, reason: 'Seal has been tampered with' };
        }

        // Verify timestamp is in the past
        if (seal.timestamp > Date.now()) {
            return { valid: false, reason: 'Timestamp is in the future' };
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, reason: 'Verification error' };
    }
}

/**
 * Format seal timestamp for display
 */
export function formatSealTimestamp(seal: TimeLockSeal): string {
    return new Date(seal.timestamp).toISOString();
}

/**
 * Calculate seal age in days
 */
export function getSealAgeDays(seal: TimeLockSeal): number {
    const ageMs = Date.now() - seal.timestamp;
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

/**
 * Compact representation of seal for storage
 */
export function serializeSeal(seal: TimeLockSeal): string {
    return JSON.stringify(seal);
}

/**
 * Parse serialized seal
 */
export function deserializeSeal(data: string): TimeLockSeal | null {
    try {
        const seal = JSON.parse(data);
        if (
            typeof seal.contentHash === 'string' &&
            typeof seal.timestamp === 'number' &&
            typeof seal.nonce === 'string' &&
            typeof seal.sealHash === 'string'
        ) {
            return seal;
        }
        return null;
    } catch {
        return null;
    }
}
