import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@planner/token';
const REFRESH_KEY = '@planner/refresh';

export const storage = {
  async getToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
  async getRefresh() {
    return AsyncStorage.getItem(REFRESH_KEY);
  },
  async setTokens(token: string, refresh: string) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [REFRESH_KEY, refresh],
    ]);
  },
  async clear() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const extra = keys.filter(
        (k) =>
          k.startsWith('@planner/cache:') ||
          k === '@planner/pendingOps' ||
          k === '@planner/idMap',
      );
      if (extra.length) await AsyncStorage.multiRemove(extra);
    } catch {
      // nada
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
  },
  // Caché offline genérica (respuestas GET para consultar sin conexión)
  async getCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`@planner/cache:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async setCache(key: string, value: unknown) {
    try {
      await AsyncStorage.setItem(`@planner/cache:${key}`, JSON.stringify(value));
    } catch {
      // sin caché: la app sigue pidiendo al servidor
    }
  },
};
