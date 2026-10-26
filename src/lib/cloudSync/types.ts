import type { Session, Folder } from '../types';

export type CloudProviderId = 'none' | 'google-drive' | 'onedrive' | 'webdav' | 'cloudflare';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface GoogleDriveConfig {
  connected: boolean;
  userEmail?: string;
  userName?: string;
  accessToken?: string;
  tokenExpiry?: number;
  clientId?: string; // Custom client ID override if desired
  fileId?: string; // Cache the drive file ID
}

export interface OneDriveConfig {
  connected: boolean;
  userEmail?: string;
  userName?: string;
  accessToken?: string;
  tokenExpiry?: number;
  clientId?: string;
}

export interface WebDavConfig {
  connected: boolean;
  serverUrl: string; // e.g. https://nextcloud.example.com/remote.php/dav/files/username/
  username: string;
  password: string; // App-specific password
  folderPath: string; // default '/Sonexa'
}

export interface CloudflareConfig {
  connected: boolean;
  userEmail?: string;
  token?: string;
}

export interface MultiCloudSettings {
  activeProvider: CloudProviderId;
  autoSync: boolean;
  syncIntervalMs: number; // default 5 minutes (300,000 ms)
  syncAudio: boolean;
  lastSyncTime: number | null;
  googleDrive: GoogleDriveConfig;
  oneDrive: OneDriveConfig;
  webdav: WebDavConfig;
  cloudflare: CloudflareConfig;
}

export const DEFAULT_MULTI_CLOUD_SETTINGS: MultiCloudSettings = {
  activeProvider: 'none',
  autoSync: true,
  syncIntervalMs: 300000, // 5 mins
  syncAudio: false,
  lastSyncTime: null,
  googleDrive: {
    connected: false,
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  },
  oneDrive: {
    connected: false,
    clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID || '',
  },
  webdav: {
    connected: false,
    serverUrl: '',
    username: '',
    password: '',
    folderPath: '/Sonexa',
  },
  cloudflare: {
    connected: false,
  },
};

export interface SyncOperationResult {
  success: boolean;
  provider: CloudProviderId;
  pulledSessions: number;
  pulledFolders: number;
  pushedSessions: number;
  pushedFolders: number;
  timestamp: number;
  error?: string;
}

export interface CloudProviderMeta {
  id: CloudProviderId;
  name: string;
  shortName: string;
  badgeLabel: string;
  description: string;
  storageTarget: string;
  iconName: 'google' | 'microsoft' | 'webdav' | 'cloudflare' | 'hard-drive';
  requiresAuth: boolean;
  isSelfHosted?: boolean;
}

export const CLOUD_PROVIDER_META: Record<CloudProviderId, CloudProviderMeta> = {
  none: {
    id: 'none',
    name: 'Local Only (No Sync)',
    shortName: 'Local Only',
    badgeLabel: 'Local',
    description: 'Keep all transcripts, audio, and documents on this device without cloud sync.',
    storageTarget: 'IndexedDB (Browser Storage)',
    iconName: 'hard-drive',
    requiresAuth: false,
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    shortName: 'Google Drive',
    badgeLabel: 'Drive Synced',
    description: 'Sync privately to your personal Google Drive in a secure, isolated App Data folder.',
    storageTarget: 'Google Drive (AppData Folder)',
    iconName: 'google',
    requiresAuth: true,
  },
  onedrive: {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    shortName: 'OneDrive',
    badgeLabel: 'OneDrive Synced',
    description: 'Sync to your personal or work Microsoft OneDrive in a dedicated Sonexa app folder.',
    storageTarget: 'OneDrive (/Apps/Sonexa)',
    iconName: 'microsoft',
    requiresAuth: true,
  },
  webdav: {
    id: 'webdav',
    name: 'WebDAV / Nextcloud',
    shortName: 'WebDAV',
    badgeLabel: 'WebDAV Synced',
    description: 'Sync to Nextcloud, ownCloud, Fastmail, or any custom WebDAV-compatible server.',
    storageTarget: 'Custom WebDAV Server',
    iconName: 'webdav',
    requiresAuth: true,
    isSelfHosted: true,
  },
  cloudflare: {
    id: 'cloudflare',
    name: 'Sonexa Cloud (Cloudflare D1)',
    shortName: 'Sonexa Cloud',
    badgeLabel: 'Cloud Synced',
    description: 'Built-in cloud sync powered by Sonexa account and Cloudflare edge network.',
    storageTarget: 'Cloudflare D1 Edge DB',
    iconName: 'cloudflare',
    requiresAuth: true,
  },
};
