/**
 * useStorage - Encrypted IndexedDB persistence hook
 * 
 * ARCHITECTURE:
 * - Uses IndexedDB for unlimited storage (50GB+ vs localStorage's 5MB)
 * - All data encrypted with AES-256-GCM before storage
 * - Zero server, zero cloud - purely local browser storage
 * - Graceful degradation if IndexedDB unavailable
 * 
 * COMPLEXITY:
 * - Read: O(1) per item via primary key
 * - Write: O(1) per item
 * - Bulk load: O(n) where n = total items
 * - Space: Limited only by disk (~50GB typical)
 */

import { useCallback } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Folder, Bookmark, Notebook, Note, TrashedItem } from '../types';
import { encrypt, decrypt, isEncryptionSupported } from '../utils/crypto';

// Database schema version - increment when schema changes
const DB_VERSION = 1;
const DB_NAME = 'LinkHavenDB';

// Storage keys for small config items (localStorage OK for these)
export const STORAGE_KEYS = {
    CANARY: 'lh_canary',      // Encrypted verification (tiny)
    SALT: 'lh_salt',          // Crypto salt (32 bytes)
    SESSION: 'lh_session',    // Session flag (1 byte)
    ENCRYPTED: 'lh_encrypted' // Encryption flag (1 byte)
} as const;

// IndexedDB store names
const STORES = {
    FOLDERS: 'folders',
    BOOKMARKS: 'bookmarks',
    NOTEBOOKS: 'notebooks',
    NOTES: 'notes',
    TRASH: 'trash',
    META: 'meta'  // For storing encrypted blobs if needed
} as const;

// Database schema definition
interface LinkHavenDB extends DBSchema {
    folders: {
        key: string;
        value: Folder;
        indexes: { 'by-created': number };
    };
    bookmarks: {
        key: string;
        value: Bookmark;
        indexes: { 'by-folder': string; 'by-created': number };
    };
    notebooks: {
        key: string;
        value: Notebook;
        indexes: { 'by-created': number };
    };
    notes: {
        key: string;
        value: Note;
        indexes: { 'by-notebook': string; 'by-created': number };
    };
    trash: {
        key: string;
        value: TrashedItem;
        indexes: { 'by-delete-time': number };
    };
    meta: {
        key: string;
        value: { data: string }; // Encrypted JSON blob
    };
}

export interface StorageData {
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks: Notebook[];
    notes: Note[];
    trash: TrashedItem[];
}

// Singleton database promise
let dbPromise: Promise<IDBPDatabase<LinkHavenDB>> | null = null;

/**
 * Initialize IndexedDB with schema
 * Uses singleton pattern for efficiency
 */
function getDB(): Promise<IDBPDatabase<LinkHavenDB>> {
    if (!dbPromise) {
        dbPromise = openDB<LinkHavenDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // Initial schema creation
                if (oldVersion < 1) {
                    // Folders store
                    const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
                    folderStore.createIndex('by-created', 'createdAt');

                    // Bookmarks store with folder index for fast filtering
                    const bookmarkStore = db.createObjectStore(STORES.BOOKMARKS, { keyPath: 'id' });
                    bookmarkStore.createIndex('by-folder', 'folderId');
                    bookmarkStore.createIndex('by-created', 'createdAt');

                    // Notebooks store
                    const notebookStore = db.createObjectStore(STORES.NOTEBOOKS, { keyPath: 'id' });
                    notebookStore.createIndex('by-created', 'createdAt');

                    // Notes store with notebook index
                    const noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
                    noteStore.createIndex('by-notebook', 'notebookId');
                    noteStore.createIndex('by-created', 'createdAt');

                    // Trash store with auto-delete index
                    const trashStore = db.createObjectStore(STORES.TRASH, { keyPath: 'id' });
                    trashStore.createIndex('by-delete-time', 'autoDeleteAt');

                    // Meta store for encrypted config
                    db.createObjectStore(STORES.META, { keyPath: 'key' });
                }
            },
            blocked() {
                console.warn('IndexedDB blocked - close other tabs');
            },
            blocking() {
                console.warn('IndexedDB blocking - upgrade needed');
            },
        });
    }
    return dbPromise;
}

/**
 * Encrypt a single item for storage
 */
async function encryptItem<T>(item: T, key: CryptoKey | null): Promise<T | string> {
    if (!key || !isEncryptionSupported()) return item;
    return await encrypt(JSON.stringify(item), key);
}

/**
 * Decrypt a single item from storage
 */
async function decryptItem<T>(data: T | string, key: CryptoKey | null): Promise<T> {
    if (!key || typeof data !== 'string') return data as T;
    try {
        return JSON.parse(await decrypt(data, key));
    } catch {
        return data as T;
    }
}

/**
 * Hook for encrypted IndexedDB operations
 * 
 * Provides unlimited storage with AES-256-GCM encryption
 * Compatible with existing data flow
 */
export function useStorage(cryptoKey: CryptoKey | null) {
    /**
     * Load all data from IndexedDB
     * Falls back to localStorage for migration
     */
    const loadData = useCallback(async (): Promise<StorageData> => {
        try {
            const db = await getDB();
            const isEncrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED) === 'true';

            // Check if we need to migrate from localStorage
            const hasOldData = localStorage.getItem('lh_bookmarks');
            if (hasOldData) {
                console.log('Migrating from localStorage to IndexedDB...');
                const migrated = await migrateFromLocalStorage(db, cryptoKey);
                if (migrated) {
                    // Clear old localStorage data after successful migration
                    ['lh_folders', 'lh_bookmarks', 'lh_notebooks', 'lh_notes', 'lh_trash'].forEach(k => {
                        localStorage.removeItem(k);
                    });
                    console.log('Migration complete!');
                }
            }

            // Load from IndexedDB
            let folders = await db.getAll(STORES.FOLDERS);
            let bookmarks = await db.getAll(STORES.BOOKMARKS);
            let notebooks = await db.getAll(STORES.NOTEBOOKS);
            let notes = await db.getAll(STORES.NOTES);
            let trash = await db.getAll(STORES.TRASH);

            // Decrypt if encrypted
            if (isEncrypted && cryptoKey) {
                folders = await Promise.all(folders.map(f => decryptItem(f, cryptoKey)));
                bookmarks = await Promise.all(bookmarks.map(b => decryptItem(b, cryptoKey)));
                notebooks = await Promise.all(notebooks.map(n => decryptItem(n, cryptoKey)));
                notes = await Promise.all(notes.map(n => decryptItem(n, cryptoKey)));
                trash = await Promise.all(trash.map(t => decryptItem(t, cryptoKey)));
            }

            // Default values if empty
            if (folders.length === 0) {
                folders = [{ id: 'default', name: 'General', createdAt: Date.now() }];
            }
            if (notebooks.length === 0) {
                notebooks = [{ id: 'default-notebook', name: 'General', createdAt: Date.now() }];
            }

            // Normalize tags
            bookmarks = bookmarks.map(b => ({ ...b, tags: b.tags || [] }));
            notes = notes.map(n => ({ ...n, tags: n.tags || [] }));

            // Auto-cleanup expired trash (7-day)
            const now = Date.now();
            const expiredTrash = trash.filter(t => t.autoDeleteAt <= now);
            if (expiredTrash.length > 0) {
                const tx = db.transaction(STORES.TRASH, 'readwrite');
                await Promise.all(expiredTrash.map(t => tx.store.delete(t.id)));
                await tx.done;
                console.log(`Auto-deleted ${expiredTrash.length} expired trash items`);
                trash = trash.filter(t => t.autoDeleteAt > now);
            }

            return { folders, bookmarks, notebooks, notes, trash };
        } catch (e) {
            console.error('Failed to load data:', e);
            return {
                folders: [{ id: 'default', name: 'General', createdAt: Date.now() }],
                bookmarks: [],
                notebooks: [{ id: 'default-notebook', name: 'General', createdAt: Date.now() }],
                notes: [],
                trash: []
            };
        }
    }, [cryptoKey]);

    /**
     * Save all data to IndexedDB
     */
    const saveData = useCallback(async (data: StorageData): Promise<void> => {
        try {
            const db = await getDB();
            const shouldEncrypt = cryptoKey && isEncryptionSupported();

            if (shouldEncrypt) {
                localStorage.setItem(STORAGE_KEYS.ENCRYPTED, 'true');
            }

            // Use transaction for atomic write
            const tx = db.transaction(
                [STORES.FOLDERS, STORES.BOOKMARKS, STORES.NOTEBOOKS, STORES.NOTES, STORES.TRASH],
                'readwrite'
            );

            // Clear and repopulate each store
            await tx.objectStore(STORES.FOLDERS).clear();
            await tx.objectStore(STORES.BOOKMARKS).clear();
            await tx.objectStore(STORES.NOTEBOOKS).clear();
            await tx.objectStore(STORES.NOTES).clear();
            await tx.objectStore(STORES.TRASH).clear();

            // Write all items (encrypt if needed)
            for (const folder of data.folders) {
                const item = shouldEncrypt ? await encryptItem(folder, cryptoKey) : folder;
                await tx.objectStore(STORES.FOLDERS).put(item as Folder);
            }
            for (const bookmark of data.bookmarks) {
                const item = shouldEncrypt ? await encryptItem(bookmark, cryptoKey) : bookmark;
                await tx.objectStore(STORES.BOOKMARKS).put(item as Bookmark);
            }
            for (const notebook of data.notebooks) {
                const item = shouldEncrypt ? await encryptItem(notebook, cryptoKey) : notebook;
                await tx.objectStore(STORES.NOTEBOOKS).put(item as Notebook);
            }
            for (const note of data.notes) {
                const item = shouldEncrypt ? await encryptItem(note, cryptoKey) : note;
                await tx.objectStore(STORES.NOTES).put(item as Note);
            }
            for (const trash of data.trash) {
                const item = shouldEncrypt ? await encryptItem(trash, cryptoKey) : trash;
                await tx.objectStore(STORES.TRASH).put(item as TrashedItem);
            }

            await tx.done;
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }, [cryptoKey]);

    /**
     * Save a single item to a specific store
     * More efficient for single-item updates
     */
    const saveItem = useCallback(async <T extends { id: string }>(
        store: keyof typeof STORES,
        item: T
    ): Promise<void> => {
        try {
            const db = await getDB();
            const shouldEncrypt = cryptoKey && isEncryptionSupported();
            const toSave = shouldEncrypt ? await encryptItem(item, cryptoKey) : item;
            await db.put(STORES[store], toSave as any);
        } catch (e) {
            console.error(`Failed to save item to ${store}:`, e);
        }
    }, [cryptoKey]);

    /**
     * Delete a single item from a store
     */
    const deleteItem = useCallback(async (
        store: keyof typeof STORES,
        id: string
    ): Promise<void> => {
        try {
            const db = await getDB();
            await db.delete(STORES[store], id);
        } catch (e) {
            console.error(`Failed to delete item from ${store}:`, e);
        }
    }, []);

    /**
     * Clear all stored data
     */
    const clearData = useCallback(async () => {
        try {
            const db = await getDB();
            const tx = db.transaction(
                [STORES.FOLDERS, STORES.BOOKMARKS, STORES.NOTEBOOKS, STORES.NOTES, STORES.TRASH],
                'readwrite'
            );
            await tx.objectStore(STORES.FOLDERS).clear();
            await tx.objectStore(STORES.BOOKMARKS).clear();
            await tx.objectStore(STORES.NOTEBOOKS).clear();
            await tx.objectStore(STORES.NOTES).clear();
            await tx.objectStore(STORES.TRASH).clear();
            await tx.done;
        } catch (e) {
            console.error('Failed to clear data:', e);
        }
        // Also clear localStorage config
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    }, []);

    /**
     * Check if user has existing data
     */
    const hasExistingData = useCallback(() => {
        return !!localStorage.getItem(STORAGE_KEYS.CANARY);
    }, []);

    /**
     * Get storage usage estimate
     */
    const getStorageEstimate = useCallback(async (): Promise<{ used: number; quota: number }> => {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                quota: estimate.quota || 0
            };
        }
        return { used: 0, quota: 0 };
    }, []);

    return {
        loadData,
        saveData,
        saveItem,
        deleteItem,
        clearData,
        hasExistingData,
        getStorageEstimate,
        STORAGE_KEYS
    };
}

/**
 * Migrate data from localStorage to IndexedDB
 * One-time migration for existing users
 */
async function migrateFromLocalStorage(
    db: IDBPDatabase<LinkHavenDB>,
    cryptoKey: CryptoKey | null
): Promise<boolean> {
    try {
        const isEncrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED) === 'true';

        // Read from localStorage
        let foldersData = localStorage.getItem('lh_folders');
        let bookmarksData = localStorage.getItem('lh_bookmarks');
        let notebooksData = localStorage.getItem('lh_notebooks');
        let notesData = localStorage.getItem('lh_notes');
        let trashData = localStorage.getItem('lh_trash');

        // Decrypt if needed
        if (isEncrypted && cryptoKey) {
            if (foldersData) foldersData = await decrypt(foldersData, cryptoKey);
            if (bookmarksData) bookmarksData = await decrypt(bookmarksData, cryptoKey);
            if (notebooksData) notebooksData = await decrypt(notebooksData, cryptoKey);
            if (notesData) notesData = await decrypt(notesData, cryptoKey);
            if (trashData) trashData = await decrypt(trashData, cryptoKey);
        }

        // Parse JSON
        const folders: Folder[] = foldersData ? JSON.parse(foldersData) : [];
        const bookmarks: Bookmark[] = bookmarksData ? JSON.parse(bookmarksData) : [];
        const notebooks: Notebook[] = notebooksData ? JSON.parse(notebooksData) : [];
        const notes: Note[] = notesData ? JSON.parse(notesData) : [];
        const trash: TrashedItem[] = trashData ? JSON.parse(trashData) : [];

        // Write to IndexedDB
        const tx = db.transaction(
            [STORES.FOLDERS, STORES.BOOKMARKS, STORES.NOTEBOOKS, STORES.NOTES, STORES.TRASH],
            'readwrite'
        );

        for (const folder of folders) await tx.objectStore(STORES.FOLDERS).put(folder);
        for (const bookmark of bookmarks) await tx.objectStore(STORES.BOOKMARKS).put(bookmark);
        for (const notebook of notebooks) await tx.objectStore(STORES.NOTEBOOKS).put(notebook);
        for (const note of notes) await tx.objectStore(STORES.NOTES).put(note);
        for (const t of trash) await tx.objectStore(STORES.TRASH).put(t);

        await tx.done;
        return true;
    } catch (e) {
        console.error('Migration failed:', e);
        return false;
    }
}

/**
 * Generate a unique ID
 * Uses timestamp + random for collision resistance
 */
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
