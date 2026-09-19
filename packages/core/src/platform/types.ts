/**
 * Platform seams: core holds the interfaces, each app injects its own
 * implementations (web: localStorage/navigator.clipboard; mobile later:
 * AsyncStorage/SecureStore/expo-clipboard).
 */

/** Subset of zustand's StateStorage — sync or async both supported. */
export interface KeyValueStorage {
  getItem(name: string): string | null | Promise<string | null>;
  setItem(name: string, value: string): void | Promise<void>;
  removeItem(name: string): void | Promise<void>;
}

export interface Clipboard {
  writeText(text: string): Promise<void>;
}
