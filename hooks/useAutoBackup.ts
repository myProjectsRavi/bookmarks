import { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, Bookmark, Notebook, Note } from '../types';

// File System Access API types
declare global {
    interface Window {
        showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    }
}

interface BackupData {
    version: number;
    timestamp: number;
    folders: Folder[];
    bookmarks: Bookmark[];
    notebooks: Notebook[];
    notes: Note[];
    vaultBookmarks: Bookmark[];
    rules?: any[];
}

interface AutoBackupState {
    isEnabled: boolean;
    hasDirectoryAccess: boolean;
    directoryName: string;
    lastBackupTime: Date | null;
    backupStatus: 'idle' | 'saving' | 'error' | 'success';
    errorMessage: string | null;
    isSupported: boolean;
}

const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BACKUP_FILENAME = 'linkhaven_backup_latest.json';
const DIRECTORY_HANDLE_KEY = 'lh_backup_directory_handle';
const LAST_BACKUP_KEY = 'lh_last_backup_time';

export function useAutoBackup() {
    const [state, setState] = useState<AutoBackupState>({
        isEnabled: false,
        hasDirectoryAccess: false,
        directoryName: '',
        lastBackupTime: null,
        backupStatus: 'idle',
        errorMessage: null,
        isSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    });

    const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
    const intervalRef = useRef<number | null>(null);
    const dataRef = useRef<BackupData | null>(null);

    // Load saved state on mount
    useEffect(() => {
        const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
        if (lastBackup) {
            setState(prev => ({
                ...prev,
                lastBackupTime: new Date(parseInt(lastBackup)),
            }));
        }
    }, []);

    // Select backup folder
    const selectBackupFolder = useCallback(async (): Promise<boolean> => {
        if (!state.isSupported) {
            setState(prev => ({
                ...prev,
                errorMessage: 'File System Access API not supported in this browser',
            }));
            return false;
        }

        try {
            const handle = await window.showDirectoryPicker!({ mode: 'readwrite' });
            directoryHandleRef.current = handle;

            setState(prev => ({
                ...prev,
                isEnabled: true,
                hasDirectoryAccess: true,
                directoryName: handle.name,
                errorMessage: null,
            }));

            // Try to persist permission
            if ('permissions' in navigator && 'query' in (navigator as any).permissions) {
                try {
                    // @ts-ignore - experimental API
                    await handle.requestPermission({ mode: 'readwrite' });
                } catch {
                    // Permission persistence not available, that's ok
                }
            }

            return true;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                // User cancelled, not an error
                return false;
            }
            setState(prev => ({
                ...prev,
                errorMessage: 'Failed to access folder',
            }));
            return false;
        }
    }, [state.isSupported]);

    // Write backup to file
    const writeBackup = useCallback(async (data: BackupData): Promise<boolean> => {
        if (!directoryHandleRef.current) {
            return false;
        }

        setState(prev => ({ ...prev, backupStatus: 'saving' }));

        try {
            // Request permission again in case it was lost
            // @ts-ignore - experimental API
            const permission = await directoryHandleRef.current.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                // @ts-ignore
                const newPermission = await directoryHandleRef.current.requestPermission({ mode: 'readwrite' });
                if (newPermission !== 'granted') {
                    throw new Error('Permission denied');
                }
            }

            // Create/overwrite the backup file
            const fileHandle = await directoryHandleRef.current.getFileHandle(BACKUP_FILENAME, { create: true });
            const writable = await fileHandle.createWritable();

            const backupWithMeta: BackupData = {
                ...data,
                version: 1,
                timestamp: Date.now(),
            };

            await writable.write(JSON.stringify(backupWithMeta, null, 2));
            await writable.close();

            const now = new Date();
            localStorage.setItem(LAST_BACKUP_KEY, now.getTime().toString());

            setState(prev => ({
                ...prev,
                backupStatus: 'success',
                lastBackupTime: now,
                errorMessage: null,
            }));

            // Reset status after a moment
            setTimeout(() => {
                setState(prev => ({ ...prev, backupStatus: 'idle' }));
            }, 2000);

            return true;
        } catch (error: any) {
            console.error('Backup failed:', error);
            setState(prev => ({
                ...prev,
                backupStatus: 'error',
                errorMessage: error.message || 'Backup failed',
                hasDirectoryAccess: false,
            }));
            return false;
        }
    }, []);

    // Manual backup trigger
    const backupNow = useCallback(async (): Promise<boolean> => {
        if (!dataRef.current) {
            return false;
        }
        return writeBackup(dataRef.current);
    }, [writeBackup]);

    // Update data reference (called on every data change)
    const updateData = useCallback((data: Omit<BackupData, 'version' | 'timestamp'>) => {
        dataRef.current = {
            ...data,
            version: 1,
            timestamp: Date.now(),
        };
    }, []);

    // Start/stop auto-backup interval
    useEffect(() => {
        if (state.isEnabled && state.hasDirectoryAccess) {
            // Initial backup
            if (dataRef.current) {
                writeBackup(dataRef.current);
            }

            // Set interval
            intervalRef.current = window.setInterval(() => {
                if (dataRef.current) {
                    writeBackup(dataRef.current);
                }
            }, BACKUP_INTERVAL);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        }
    }, [state.isEnabled, state.hasDirectoryAccess, writeBackup]);

    // Disable backup
    const disableBackup = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        directoryHandleRef.current = null;
        setState(prev => ({
            ...prev,
            isEnabled: false,
            hasDirectoryAccess: false,
            directoryName: '',
        }));
    }, []);

    // Parse backup file for restore
    const parseBackupFile = useCallback(async (file: File): Promise<BackupData | null> => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate structure
            if (!data.folders || !data.bookmarks) {
                throw new Error('Invalid backup file format');
            }

            return data as BackupData;
        } catch (error) {
            console.error('Failed to parse backup file:', error);
            return null;
        }
    }, []);

    // Get time since last backup (human readable)
    const getTimeSinceBackup = useCallback((): string => {
        if (!state.lastBackupTime) return 'Never';

        const now = new Date();
        const diff = now.getTime() - state.lastBackupTime.getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;

        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }, [state.lastBackupTime]);

    return {
        // State
        isEnabled: state.isEnabled,
        isSupported: state.isSupported,
        hasDirectoryAccess: state.hasDirectoryAccess,
        directoryName: state.directoryName,
        lastBackupTime: state.lastBackupTime,
        backupStatus: state.backupStatus,
        errorMessage: state.errorMessage,

        // Actions
        selectBackupFolder,
        updateData,
        backupNow,
        disableBackup,
        parseBackupFile,
        getTimeSinceBackup,
    };
}
