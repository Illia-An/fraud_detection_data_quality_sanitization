/** Session-tab persistence (F5 survives; close tab clears). Not DB Save. */

export function readSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw == null || raw === '') {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode — ignore
  }
}

export function removeSessionKey(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
