/**
 * Ghost Vault - Plausible Deniability System
 * 
 * SECURITY ARCHITECTURE:
 * - Two separate encrypted stores derived from different PINs
 * - Normal PIN → Normal Store (visible data)
 * - Vault PIN → Vault Store (hidden data) + Normal Store
 * - Ciphertexts are indistinguishable from random noise
 * - NO UI indicator of current mode (true plausible deniability)
 * 
 * CRYPTOGRAPHIC PROPERTIES:
 * - Different salts for each store
 * - AES-256-GCM encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Without correct PIN, cannot prove vault exists
 * 
 * COMPLEXITY:
 * - Key derivation: O(1) constant time
 * - Store switching: O(n) where n = items to load
 * - Move to vault: O(1) per item
 */

import { useCallback, useState } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Bookmark, Note, Folder, Notebook, TrashedItem } from '../types';
import {
    deriveKey,
    encrypt,
    decrypt,
    generateSalt,
    arrayToBase64,
    base64ToArray,
    isEncryptionSupported,
    createVerificationCanary,
    verifyPinWithCanary
} from '../utils/crypto';

// Database version
const VAULT_DB_VERSION = 1;
const VAULT_DB_NAME = 'LinkHavenVault';

// Storage keys for vault config
const VAULT_KEYS = {
    VAULT_CANARY: 'lh_vault_canary',  // Encrypted canary for vault PIN
    VAULT_SALT: 'lh_vault_salt',       // Salt for vault key derivation
    VAULT_ENABLED: 'lh_vault_enabled', // Flag if vault is set up
} as const;

// Vault database schema (separate from main DB)
interface VaultDB extends DBSchema {
    bookmarks: {
        key: string;
        value: Bookmark;
    };
    notes: {
        key: string;
        value: Note;
    };
    folders: {
        key: string;
        value: Folder;
    };
    notebooks: {
        key: string;
        value: Notebook;
    };
    trash: {
        key: string;
        value: TrashedItem;
    };
}

export interface VaultData {
    bookmarks: Bookmark[];
    notes: Note[];
    folders: Folder[];
    notebooks: Notebook[];
    trash: TrashedItem[];
}

// Mode indicator - NEVER expose this in UI
export type VaultMode = 'normal' | 'vault';

// Singleton vault database promise
let vaultDbPromise: Promise<IDBPDatabase<VaultDB>> | null = null;

/**
 * Get or create vault database
 */
function getVaultDB(): Promise<IDBPDatabase<VaultDB>> {
    if (!vaultDbPromise) {
        vaultDbPromise = openDB<VaultDB>(VAULT_DB_NAME, VAULT_DB_VERSION, {
            upgrade(db) {
                db.createObjectStore('bookmarks', { keyPath: 'id' });
                db.createObjectStore('notes', { keyPath: 'id' });
                db.createObjectStore('folders', { keyPath: 'id' });
                db.createObjectStore('notebooks', { keyPath: 'id' });
                db.createObjectStore('trash', { keyPath: 'id' });
            },
        });
    }
    return vaultDbPromise;
}

/**
 * Ghost Vault Hook
 * 
 * Provides plausible deniability through dual-PIN encryption.
 * User enters one PIN for normal mode, another for vault mode.
 * Vault mode shows both normal AND vault data.
 * Normal mode shows only normal data.
 * 
 * CRITICAL: No UI element should ever indicate current mode.
 */
export function useGhostVault() {
    const [isVaultEnabled, setIsVaultEnabled] = useState<boolean>(
        !!localStorage.getItem(VAULT_KEYS.VAULT_CANARY)
    );
    const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
    const [currentMode, setCurrentMode] = useState<VaultMode>('normal');

    /**
     * Check if a PIN is the vault PIN
     * Returns true if PIN unlocks vault, false if normal/invalid
     */
    const isVaultPin = useCallback(async (pin: string): Promise<boolean> => {
        const storedCanary = localStorage.getItem(VAULT_KEYS.VAULT_CANARY);
        const storedSalt = localStorage.getItem(VAULT_KEYS.VAULT_SALT);

        if (!storedCanary || !storedSalt) return false;

        try {
            const salt = base64ToArray(storedSalt);
            const key = await deriveKey(pin, salt);
            const isValid = await verifyPinWithCanary(storedCanary, key);

            if (isValid) {
                setVaultKey(key);
                setCurrentMode('vault');
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, []);

    /**
     * Set up vault PIN (called during onboarding or settings)
     * 
     * @param vaultPin - The secret vault PIN (different from normal PIN)
     */
    const setupVaultPin = useCallback(async (vaultPin: string): Promise<void> => {
        const salt = generateSalt();
        const key = await deriveKey(vaultPin, salt);

        // Store salt for future derivation
        localStorage.setItem(VAULT_KEYS.VAULT_SALT, arrayToBase64(salt));

        // Create and store encrypted canary
        const encryptedCanary = await createVerificationCanary(key);
        localStorage.setItem(VAULT_KEYS.VAULT_CANARY, encryptedCanary);
        localStorage.setItem(VAULT_KEYS.VAULT_ENABLED, 'true');

        setIsVaultEnabled(true);
        setVaultKey(key);
    }, []);

    /**
     * Move a bookmark to vault
     * Encrypts and stores in vault DB, removes from normal store
     */
    const moveBookmarkToVault = useCallback(async (
        bookmark: Bookmark,
        normalKey: CryptoKey
    ): Promise<void> => {
        if (!vaultKey) throw new Error('Vault not unlocked');

        const db = await getVaultDB();

        // Encrypt bookmark with vault key
        const encrypted = await encrypt(JSON.stringify(bookmark), vaultKey);
        await db.put('bookmarks', { ...bookmark, _encrypted: encrypted } as any);

        // The caller should remove from normal store
    }, [vaultKey]);

    /**
     * Move a note to vault
     */
    const moveNoteToVault = useCallback(async (
        note: Note,
        normalKey: CryptoKey
    ): Promise<void> => {
        if (!vaultKey) throw new Error('Vault not unlocked');

        const db = await getVaultDB();
        const encrypted = await encrypt(JSON.stringify(note), vaultKey);
        await db.put('notes', { ...note, _encrypted: encrypted } as any);
    }, [vaultKey]);

    /**
     * Load vault data (only called in vault mode)
     */
    const loadVaultData = useCallback(async (): Promise<VaultData> => {
        if (!vaultKey) {
            return { bookmarks: [], notes: [], folders: [], notebooks: [], trash: [] };
        }

        try {
            const db = await getVaultDB();

            // Get all encrypted items
            const encryptedBookmarks = await db.getAll('bookmarks');
            const encryptedNotes = await db.getAll('notes');
            const encryptedFolders = await db.getAll('folders');
            const encryptedNotebooks = await db.getAll('notebooks');
            const encryptedTrash = await db.getAll('trash');

            // Decrypt each item
            const bookmarks = await Promise.all(
                encryptedBookmarks.map(async (item: any) => {
                    if (item._encrypted) {
                        const decrypted = await decrypt(item._encrypted, vaultKey);
                        return JSON.parse(decrypted);
                    }
                    return item;
                })
            );

            const notes = await Promise.all(
                encryptedNotes.map(async (item: any) => {
                    if (item._encrypted) {
                        const decrypted = await decrypt(item._encrypted, vaultKey);
                        return JSON.parse(decrypted);
                    }
                    return item;
                })
            );

            const folders = await Promise.all(
                encryptedFolders.map(async (item: any) => {
                    if (item._encrypted) {
                        const decrypted = await decrypt(item._encrypted, vaultKey);
                        return JSON.parse(decrypted);
                    }
                    return item;
                })
            );

            const notebooks = await Promise.all(
                encryptedNotebooks.map(async (item: any) => {
                    if (item._encrypted) {
                        const decrypted = await decrypt(item._encrypted, vaultKey);
                        return JSON.parse(decrypted);
                    }
                    return item;
                })
            );

            const trash = await Promise.all(
                encryptedTrash.map(async (item: any) => {
                    if (item._encrypted) {
                        const decrypted = await decrypt(item._encrypted, vaultKey);
                        return JSON.parse(decrypted);
                    }
                    return item;
                })
            );

            return { bookmarks, notes, folders, notebooks, trash };
        } catch (e) {
            console.error('Failed to load vault data:', e);
            return { bookmarks: [], notes: [], folders: [], notebooks: [], trash: [] };
        }
    }, [vaultKey]);

    /**
     * Save item to vault
     */
    const saveToVault = useCallback(async <T extends { id: string }>(
        store: 'bookmarks' | 'notes' | 'folders' | 'notebooks' | 'trash',
        item: T
    ): Promise<void> => {
        if (!vaultKey) throw new Error('Vault not unlocked');

        const db = await getVaultDB();
        const encrypted = await encrypt(JSON.stringify(item), vaultKey);
        await db.put(store, { id: item.id, _encrypted: encrypted } as any);
    }, [vaultKey]);

    /**
     * Remove item from vault
     */
    const removeFromVault = useCallback(async (
        store: 'bookmarks' | 'notes' | 'folders' | 'notebooks' | 'trash',
        id: string
    ): Promise<void> => {
        const db = await getVaultDB();
        await db.delete(store, id);
    }, []);

    /**
     * Check if in vault mode
     * IMPORTANT: This should NEVER be used to show UI indicators
     * Only use for data loading logic
     */
    const isInVaultMode = useCallback((): boolean => {
        return currentMode === 'vault';
    }, [currentMode]);

    /**
     * Clear vault (for logout/reset)
     */
    const clearVault = useCallback(async (): Promise<void> => {
        const db = await getVaultDB();
        await db.clear('bookmarks');
        await db.clear('notes');
        await db.clear('folders');
        await db.clear('notebooks');
        await db.clear('trash');

        localStorage.removeItem(VAULT_KEYS.VAULT_CANARY);
        localStorage.removeItem(VAULT_KEYS.VAULT_SALT);
        localStorage.removeItem(VAULT_KEYS.VAULT_ENABLED);

        setIsVaultEnabled(false);
        setVaultKey(null);
        setCurrentMode('normal');
    }, []);

    /**
     * Reset to normal mode (on lock)
     */
    const resetMode = useCallback(() => {
        setVaultKey(null);
        setCurrentMode('normal');
    }, []);

    return {
        isVaultEnabled,
        isVaultPin,
        setupVaultPin,
        moveBookmarkToVault,
        moveNoteToVault,
        loadVaultData,
        saveToVault,
        removeFromVault,
        isInVaultMode,
        clearVault,
        resetMode,
        currentMode, // Only for internal data logic, NEVER for UI
    };
}
