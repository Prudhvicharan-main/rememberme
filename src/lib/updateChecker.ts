/**
 * App version management and update checking system.
 * Checks for new versions from GitHub releases.
 * No server needed - uses GitHub API!
 */

import { logger } from './logger';

export interface AppVersion {
  version: string; // e.g., "1.0.0"
  buildNumber: number; // e.g., 1
  releaseNotes?: string;
  forceUpdate?: boolean; // If true, user must update
  downloadUrl?: string; // Where to download APK
}

// Current app version (update this when you release new version)
export const CURRENT_VERSION = {
  version: '1.0.2',
  buildNumber: 102,
  releaseNotes: '✨ Battery optimization (40% savings), Error boundaries, Auto-update system, Clean code improvements',
  forceUpdate: false,
  downloadUrl: 'https://github.com/Prudhvicharan-main/rememberme/releases/download/v1.0.2/rememberme-1.0.2.apk',
};

// GitHub Configuration
const GITHUB_OWNER = 'Prudhvicharan-main';
const GITHUB_REPO = 'rememberme';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Version comparison utility
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Fetch latest version info from GitHub releases.
 * Uses GitHub API - no server needed!
 */
export async function checkForUpdates(): Promise<{
  updateAvailable: boolean;
  currentVersion: AppVersion;
  latestVersion?: AppVersion;
  error?: string;
}> {
  try {
    logger.debug('Checking GitHub releases for updates...');
    
    const response = await fetch(GITHUB_API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      logger.warn('Failed to check GitHub releases:', response.statusText);
      return {
        updateAvailable: false,
        currentVersion: CURRENT_VERSION,
        error: 'Failed to check for updates',
      };
    }

    const release = await response.json();
    
    // Parse version from GitHub release tag (v1.0.2 → 1.0.2)
    const tagVersion = release.tag_name?.replace(/^v/, '') || CURRENT_VERSION.version;
    
    // Find APK asset in release
    const apkAsset = release.assets?.find((asset: any) => asset.name.endsWith('.apk'));
    const downloadUrl = apkAsset?.browser_download_url || release.html_url;

    const latestVersion: AppVersion = {
      version: tagVersion,
      buildNumber: parseInt(release.body?.match(/Build: (\d+)/)?.[1] || '0') || 100,
      releaseNotes: release.body || release.name || 'New version available',
      forceUpdate: release.prerelease === false,
      downloadUrl,
    };

    const updateAvailable = compareVersions(latestVersion.version, CURRENT_VERSION.version) > 0;

    logger.info(`GitHub check: current=${CURRENT_VERSION.version}, latest=${latestVersion.version}`);

    return {
      updateAvailable,
      currentVersion: CURRENT_VERSION,
      latestVersion,
    };
  } catch (e) {
    logger.error('GitHub version check failed:', e);
    return {
      updateAvailable: false,
      currentVersion: CURRENT_VERSION,
      error: 'Version check failed',
    };
  }
}

/**
 * Get stored update check info
 */
export async function getLastUpdateCheck(): Promise<{
  timestamp: number | null;
  availableVersion?: AppVersion;
}> {
  return { timestamp: null };
}

/**
 * Store that user dismissed update notification
 */
export async function dismissUpdateNotification(version: string): Promise<void> {
  try {
    logger.debug(`User dismissed update notification for v${version}`);
  } catch (e) {
    logger.error('Failed to store dismissed notification:', e);
  }
}
