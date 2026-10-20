import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@planner/token';
const REFRESH_KEY = '@planner/refresh';
const USER_KEY = '@planner/user';

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
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
  },
  // Usuario de la sesión (nombre, moneda, tema, inicio de semana) para arrancar sin red.
  async getUser<T>(): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async setUser(user: unknown) {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // sin caché de usuario: se pide a /api/auth/me
    }
  },
  // Tras cambiar moneda/semana/tema: los resúmenes cacheados quedan viejos.
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cache = keys.filter((k) => k.startsWith('@planner/cache:'));
      if (cache.length) await AsyncStorage.multiRemove(cache);
    } catch {
      // nada
    }
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
