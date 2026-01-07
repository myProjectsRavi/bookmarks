/**
 * Hooks Index
 * 
 * Central export point for all custom hooks.
 * Includes core functionality and premium features.
 */

// Core Hooks
export { useStorage, STORAGE_KEYS, generateId } from './useStorage';
export type { StorageData } from './useStorage';

export { useAuth } from './useAuth';
export type { AuthState, AuthActions } from './useAuth';

export { useToast } from './useToast';
export type { ToastState, UseToastReturn } from './useToast';

export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { KeyboardShortcuts } from './useKeyboardShortcuts';

export { useBookmarkSearch, useNoteSearch, useGlobalSearch } from './useSearch';
export type { SearchResult } from './useSearch';

// Premium Feature Hooks
export { useGhostVault } from './useGhostVault';
export type { VaultMode, VaultData } from './useGhostVault';

export { useRules } from './useRules';

export { useCitations } from './useCitations';
export type { BookmarkWithCitation } from './useCitations';

export { useSimilarity } from './useSimilarity';
export type { SimilarityResult, SimilarityCluster } from './useSimilarity';
