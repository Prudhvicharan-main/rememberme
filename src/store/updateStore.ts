/**
 * Store for managing app updates and notifications.
 * Tracks update availability, user preferences, and update history.
 */

import { create } from 'zustand';
import { checkForUpdates, CURRENT_VERSION, AppVersion } from '@/lib/updateChecker';
import { logger } from '@/lib/logger';

interface UpdateState {
  currentVersion: string;
  updateAvailable: boolean;
  latestVersion: AppVersion | null;
  lastChecked: number | null;
  checkForUpdates: () => Promise<void>;
  dismissUpdate: () => void;
  clearUpdateState: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  currentVersion: CURRENT_VERSION.version,
  updateAvailable: false,
  latestVersion: null,
  lastChecked: null,

  checkForUpdates: async () => {
    try {
      const result = await checkForUpdates();
      set({
        updateAvailable: result.updateAvailable,
        latestVersion: result.latestVersion || null,
        lastChecked: Date.now(),
      });
      if (result.updateAvailable) {
        logger.info(`Update available: ${result.latestVersion?.version}`);
      }
    } catch (e) {
      logger.error('Check for updates failed:', e);
    }
  },

  dismissUpdate: () => {
    set({ updateAvailable: false });
  },

  clearUpdateState: () => {
    set({
      updateAvailable: false,
      latestVersion: null,
      lastChecked: null,
    });
  },
}));
