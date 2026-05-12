import Constants from 'expo-constants';

export const isExpoGo = Constants.appOwnership === 'expo';

export function isNotificationsSupported(): boolean {
  return !isExpoGo;
}

export async function loadNotifications() {
  if (isExpoGo) {
    return null;
  }

  return import('expo-notifications');
}
