import { doc, getDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { APP_STORE_URL } from '../constants/urls';
import { isVersionBelow } from '../utils/semver';

const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC = 'requirements';

export type ForceUpdateConfig = {
  minimumVersion: string;
  updateMessage?: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
};

/** Native app version (from store build), falls back to app.json version. */
export function getCurrentAppVersion(): string {
  const native = Constants.nativeAppVersion;
  const expo = Constants.expoConfig?.version;
  return (typeof native === 'string' && native.length > 0 ? native : expo) || '0.0.0';
}

/**
 * Reads Firestore `appConfig/requirements`. Create in console:
 * { minimumVersion: "1.0.0", updateMessage?: "...", iosStoreUrl?, androidStoreUrl? }
 * If current version < minimumVersion, user must update (handled by UI).
 */
export async function fetchForceUpdateConfig(): Promise<ForceUpdateConfig | null> {
  try {
    const ref = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    const minimumVersion = typeof d.minimumVersion === 'string' ? d.minimumVersion.trim() : '';
    if (!minimumVersion) return null;
    return {
      minimumVersion,
      updateMessage: typeof d.updateMessage === 'string' ? d.updateMessage : undefined,
      iosStoreUrl: typeof d.iosStoreUrl === 'string' ? d.iosStoreUrl : undefined,
      androidStoreUrl: typeof d.androidStoreUrl === 'string' ? d.androidStoreUrl : undefined,
    };
  } catch (e) {
    console.warn('appVersionService: could not fetch requirements', e);
    return null;
  }
}

export async function shouldForceUpdate(): Promise<{
  force: boolean;
  config: ForceUpdateConfig | null;
  currentVersion: string;
}> {
  const currentVersion = getCurrentAppVersion();
  const config = await fetchForceUpdateConfig();
  if (!config) {
    return { force: false, config: null, currentVersion };
  }
  const force = isVersionBelow(currentVersion, config.minimumVersion);
  return { force, config, currentVersion };
}

/** Firestore `iosStoreUrl` overrides; otherwise `APP_STORE_URL` in `constants/urls.ts` (iOS). */
export function getStoreUrlForPlatform(config: ForceUpdateConfig): string | undefined {
  const fallback =
    typeof APP_STORE_URL === 'string' && APP_STORE_URL.trim().length > 0 ? APP_STORE_URL.trim() : undefined;
  if (Platform.OS === 'ios') return config.iosStoreUrl || fallback;
  if (Platform.OS === 'android') return config.androidStoreUrl;
  return config.iosStoreUrl ?? config.androidStoreUrl ?? fallback;
}
