/**
 * Caching layer for AsyncStorage to reduce repeated reads.
 * Improves performance and reduces I/O operations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttlMs?: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default

export async function readJsonCached<T>(
  key: string,
  fallback: T,
  ttlMs: number = CACHE_TTL_MS
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  // Return cached value if still valid
  if (cached && (!cached.ttlMs || now - cached.timestamp < cached.ttlMs)) {
    return cached.value as T;
  }

  // Cache miss or expired - read from AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(key);
    const value = raw == null ? fallback : (JSON.parse(raw) as T);
    cache.set(key, { value, timestamp: now, ttlMs });
    return value;
  } catch (e) {
    // On error, return fallback
    return fallback;
  }
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function invalidateCachePattern(pattern: RegExp): void {
  for (const key of cache.keys()) {
    if (pattern.test(key)) cache.delete(key);
  }
}
