/**
 * SnapshotHistory - Shadow Snapshots (Anti-Censorship Feature)
 * 
 * PURPOSE: Store multiple timestamped versions of page snapshots
 * 
 * USE CASE:
 * - Journalist saves controversial article
 * - Author edits/deletes it later
 * - User has cryptographically timestamped proof of original content
 * 
 * ARCHITECTURE:
 * - Separate IndexedDB store from main snapshots
 * - Compound key: [bookmarkId, timestamp]
 * - Keeps up to MAX_VERSIONS per bookmark
 * - Auto-prunes oldest when limit reached
 * 
 * MARKETING: "Time-Travel Snapshots. Prove what the page said."
 * 
 * ZERO COST: Pure IndexedDB, no server
 */

import { openDB, IDBPDatabase } from 'idb';
import LZString from 'lz-string';
import { encrypt, decrypt, isEncryptionSupported } from './crypto';
import { createTimeLockSeal, TimeLockSeal } from './merkleTree';

// Configuration
const DB_NAME = 'linkhaven_history';
const DB_VERSION = 1;
const STORE_NAME = 'snapshot_history';
const MAX_VERSIONS = 10; // Keep last 10 versions per bookmark

/**
 * Versioned snapshot record
 */
export interface SnapshotVersion {
    id: string;              // Composite: bookmarkId_timestamp
    bookmarkId: string;      // Parent bookmark
    version: number;         // Auto-increment per bookmark (1, 2, 3...)
    savedAt: number;         // Unix timestamp
    encryptedContent: string; // LZ + AES encrypted
    title: string;
    originalUrl: string;
    excerpt: string;
    compressedSize: number;
    originalSize: number;
    seal?: TimeLockSeal;     // Cryptographic proof
}

/**
 * Version metadata (without content)
 */
export interface VersionMetadata {
    id: string;
    bookmarkId: string;
    version: number;
    savedAt: number;
    title: string;
    excerpt: string;
    compressedSize: number;
    hasProof: boolean;
}

/**
 * Full version content
 */
export interface VersionContent {
    id: string;
    bookmarkId: string;
    version: number;
    savedAt: number;
    content: string;
    title: string;
    originalUrl: string;
    seal?: TimeLockSeal;
}

/**
 * SnapshotHistoryDB Class
 */
class SnapshotHistoryDBClass {
    private db: IDBPDatabase | null = null;
    private cryptoKey: CryptoKey | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize database
     */
    private async init(): Promise<void> {
        if (this.db) return;

        if (this.initPromise) {
            await this.initPromise;
            return;
        }

        this.initPromise = (async () => {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                        store.createIndex('bookmarkId', 'bookmarkId');
                        store.createIndex('savedAt', 'savedAt');
                        store.createIndex('bookmark_time', ['bookmarkId', 'savedAt']);
                    }
                },
            });
        })();

        await this.initPromise;
    }

    /**
     * Set encryption key
     */
    setCryptoKey(key: CryptoKey | null): void {
        this.cryptoKey = key;
    }

    /**
     * Save a new version of a snapshot
     * Creates cryptographic seal for proof-of-existence
     */
    async saveVersion(
        bookmarkId: string,
        content: string,
        metadata: {
            originalUrl: string;
            title: string;
            excerpt: string;
        }
    ): Promise<VersionMetadata> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        // Get next version number
        const existingVersions = await this.getVersionHistory(bookmarkId);
        const nextVersion = existingVersions.length > 0
            ? Math.max(...existingVersions.map(v => v.version)) + 1
            : 1;

        const savedAt = Date.now();
        const id = `${bookmarkId}_${savedAt}`;

        // Compress
        const originalSize = new Blob([content]).size;
        const compressed = LZString.compressToUTF16(content);
        if (!compressed) throw new Error('Compression failed');
        const compressedSize = new Blob([compressed]).size;

        // Encrypt
        let encryptedContent: string;
        if (this.cryptoKey && isEncryptionSupported()) {
            encryptedContent = await encrypt(compressed, this.cryptoKey);
        } else {
            encryptedContent = compressed;
        }

        // Create cryptographic seal (TimeLock proof)
        const seal = await createTimeLockSeal(content);

        // Create record
        const record: SnapshotVersion = {
            id,
            bookmarkId,
            version: nextVersion,
            savedAt,
            encryptedContent,
            title: metadata.title,
            originalUrl: metadata.originalUrl,
            excerpt: metadata.excerpt.slice(0, 200),
            compressedSize,
            originalSize,
            seal,
        };

        // Store
        await this.db.put(STORE_NAME, record);

        // Prune old versions if over limit
        await this.pruneVersions(bookmarkId);

        return {
            id,
            bookmarkId,
            version: nextVersion,
            savedAt,
            title: metadata.title,
            excerpt: metadata.excerpt,
            compressedSize,
            hasProof: true,
        };
    }

    /**
     * Get all versions for a bookmark (metadata only)
     * Ordered by timestamp descending (newest first)
     */
    async getVersionHistory(bookmarkId: string): Promise<VersionMetadata[]> {
        await this.init();
        if (!this.db) return [];

        const index = this.db.transaction(STORE_NAME).store.index('bookmarkId');
        const records = await index.getAll(bookmarkId) as SnapshotVersion[];

        return records
            .sort((a, b) => b.savedAt - a.savedAt)
            .map(r => ({
                id: r.id,
                bookmarkId: r.bookmarkId,
                version: r.version,
                savedAt: r.savedAt,
                title: r.title,
                excerpt: r.excerpt,
                compressedSize: r.compressedSize,
                hasProof: !!r.seal,
            }));
    }

    /**
     * Get specific version content
     */
    async getVersion(id: string): Promise<VersionContent | null> {
        await this.init();
        if (!this.db) return null;

        const record = await this.db.get(STORE_NAME, id) as SnapshotVersion | undefined;
        if (!record) return null;

        // Decrypt
        let compressed: string;
        if (this.cryptoKey && isEncryptionSupported()) {
            try {
                compressed = await decrypt(record.encryptedContent, this.cryptoKey);
            } catch {
                compressed = record.encryptedContent;
            }
        } else {
            compressed = record.encryptedContent;
        }

        // Decompress
        const content = LZString.decompressFromUTF16(compressed);
        if (!content) throw new Error('Decompression failed');

        return {
            id: record.id,
            bookmarkId: record.bookmarkId,
            version: record.version,
            savedAt: record.savedAt,
            content,
            title: record.title,
            originalUrl: record.originalUrl,
            seal: record.seal,
        };
    }

    /**
     * Get version count for a bookmark
     */
    async getVersionCount(bookmarkId: string): Promise<number> {
        await this.init();
        if (!this.db) return 0;

        const index = this.db.transaction(STORE_NAME).store.index('bookmarkId');
        return await index.count(bookmarkId);
    }

    /**
     * Delete a specific version
     */
    async deleteVersion(id: string): Promise<void> {
        await this.init();
        if (!this.db) return;

        await this.db.delete(STORE_NAME, id);
    }

    /**
     * Delete all versions for a bookmark
     */
    async deleteAllVersions(bookmarkId: string): Promise<void> {
        await this.init();
        if (!this.db) return;

        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const index = tx.store.index('bookmarkId');

        let cursor = await index.openKeyCursor(bookmarkId);
        while (cursor) {
            await tx.store.delete(cursor.primaryKey);
            cursor = await cursor.continue();
        }

        await tx.done;
    }

    /**
     * Prune versions to keep only MAX_VERSIONS per bookmark
     */
    private async pruneVersions(bookmarkId: string): Promise<void> {
        await this.init();
        if (!this.db) return;

        const versions = await this.getVersionHistory(bookmarkId);

        if (versions.length > MAX_VERSIONS) {
            // Delete oldest versions beyond limit
            const toDelete = versions.slice(MAX_VERSIONS);
            for (const v of toDelete) {
                await this.db.delete(STORE_NAME, v.id);
            }
        }
    }

    /**
     * Get all bookmarks with version history
     */
    async getAllBookmarksWithHistory(): Promise<string[]> {
        await this.init();
        if (!this.db) return [];

        const records = await this.db.getAll(STORE_NAME) as SnapshotVersion[];
        const bookmarkIds = new Set(records.map(r => r.bookmarkId));
        return Array.from(bookmarkIds);
    }

    /**
     * Get storage statistics for history
     */
    async getStats(): Promise<{
        totalVersions: number;
        totalBookmarks: number;
        totalSize: number;
    }> {
        await this.init();
        if (!this.db) return { totalVersions: 0, totalBookmarks: 0, totalSize: 0 };

        const records = await this.db.getAll(STORE_NAME) as SnapshotVersion[];
        const bookmarkIds = new Set(records.map(r => r.bookmarkId));
        const totalSize = records.reduce((sum, r) => sum + r.compressedSize, 0);

        return {
            totalVersions: records.length,
            totalBookmarks: bookmarkIds.size,
            totalSize,
        };
    }
}

// Singleton export
export const SnapshotHistoryDB = new SnapshotHistoryDBClass();
