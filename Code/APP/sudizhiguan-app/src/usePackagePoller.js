import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { getPackages } from './api';

const POLL_INTERVAL = 60_000;
const SEEN_KEY = 'poller_seen_ids';

async function getSeenIds() {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}

async function saveSeenIds(ids) {
  try {
    await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify([...ids]));
  } catch (_) {}
}

async function poll() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const packages = await getPackages(0);
    if (!Array.isArray(packages)) return;

    const currentIds = new Set(packages.map(p => String(p.id)));
    const seenIds = await getSeenIds();

    if (seenIds === null) {
      await saveSeenIds(currentIds);
      return;
    }

    const newPkgs = packages.filter(p => !seenIds.has(String(p.id)));
    await saveSeenIds(currentIds);

    if (newPkgs.length === 0) return;

    const body = newPkgs.length === 1
      ? `您有 1 个新包裹到站：${newPkgs[0].tracking_number}`
      : `您有 ${newPkgs.length} 个新包裹已到站，请及时取件`;

    await Notifications.scheduleNotificationAsync({
      content: { title: '包裹到站提醒', body, sound: true },
      trigger: null,
    });
  } catch (_) {}
}

export function usePackagePoller(enabled) {
  const timerRef    = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    function start() {
      poll();
      timerRef.current = setInterval(poll, POLL_INTERVAL);
    }

    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    const sub = AppState.addEventListener('change', next => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev !== 'active' && next === 'active') start();
      else if (next === 'background' || next === 'inactive') stop();
    });

    start();
    return () => { stop(); sub.remove(); };
  }, [enabled]);
}
