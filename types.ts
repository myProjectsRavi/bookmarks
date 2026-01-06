export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  folderId: string;
  title: string;
  description?: string;
  url: string;
  tags?: string[];
  linkHealth?: 'alive' | 'dead' | 'unknown' | 'checking';
  lastHealthCheck?: number;
  hasSnapshot?: boolean;        // Premium: page snapshot exists
  snapshotId?: string;          // Premium: reference to snapshot
  createdAt: number;
}

export interface Notebook {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  createdAt: number;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
}

export type ModalType =
  | 'ADD_BOOKMARK'
  | 'ADD_FOLDER'
  | 'EDIT_FOLDER'
  | 'EDIT_BOOKMARK'
  | 'IMPORT_CONFIRMATION'
  | 'BOOKMARKLET'
  | 'HEALTH_CHECK_PROGRESS'
  // Premium modals
  | 'SNAPSHOT_VIEWER'
  | 'SNAPSHOT_CAPTURE'
  | 'DEDUPLICATION'
  | 'QR_SYNC'
  | 'CLEANUP_WIZARD'
  | 'PREMIUM_UPGRADE'
  // Notes modals
  | 'ADD_NOTE'
  | 'EDIT_NOTE'
  | 'ADD_NOTEBOOK'
  | 'NOTEBOOK_SYNC'
  | null;

export interface ViewState {
  activeFolderId: string | 'ALL';
  searchQuery: string;
  isSidebarOpen: boolean;
}

// For tag filtering
export interface TagFilter {
  tag: string;
  active: boolean;
}

// Premium feature flags
export interface PremiumFeatures {
  eternalVault: boolean;      // Page snapshots
  deduplication: boolean;     // Fuzzy duplicate finder
  qrSync: boolean;            // Multi-device sync via QR
}

// Premium subscription status
export interface PremiumStatus {
  isActive: boolean;
  plan?: 'monthly' | 'yearly';
  expiresAt?: number;
  features: PremiumFeatures;
}