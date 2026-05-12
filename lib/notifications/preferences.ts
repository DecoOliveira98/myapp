import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpoGo } from './client';

export const NOTIFICATIONS_ENABLED_KEY = 'notificationsEnabled';
export const LAST_APP_OPENED_AT_KEY = 'lastAppOpenedAt';

export async function getNotificationsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
  return value === 'true';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  if (isExpoGo && enabled) return;
  await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function touchLastAppOpenedAt(): Promise<void> {
  await AsyncStorage.setItem(LAST_APP_OPENED_AT_KEY, new Date().toISOString());
}

export async function getLastAppOpenedAt(): Promise<Date | null> {
  const value = await AsyncStorage.getItem(LAST_APP_OPENED_AT_KEY);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
