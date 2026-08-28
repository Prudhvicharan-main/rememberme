import { create } from 'zustand';
import { Settings, DEFAULT_SETTINGS } from '@/types';
import { readJson, writeJson, StorageKeys } from '@/lib/storage';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const stored = await readJson<Settings>(StorageKeys.settings, DEFAULT_SETTINGS);
    set({ settings: { ...DEFAULT_SETTINGS, ...stored }, loaded: true });
  },

  update: async (partial) => {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    await writeJson(StorageKeys.settings, next);
  },
}));
