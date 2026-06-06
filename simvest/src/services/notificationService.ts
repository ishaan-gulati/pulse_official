import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { userService } from './userService';

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export const notificationService = {
  async requestPermissions(): Promise<PermissionStatus> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return 'granted';
    const { status } = await Notifications.requestPermissionsAsync();
    return status as PermissionStatus;
  },

  async getPermissionStatus(): Promise<PermissionStatus> {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  },

  async registerPushTokenIfGranted(uid: string): Promise<string | null> {
    const status = await this.getPermissionStatus();
    if (status !== 'granted') return null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // optional; required for EAS push in production
      });
      const token = tokenData?.data ?? (tokenData as unknown as { data: string })?.data;
      if (token) {
        await userService.updateUserProfile(uid, { pushToken: token });
        return token;
      }
    } catch (_) {
      // Simulator or missing projectId - skip saving token
    }
    return null;
  },

  async showPriceAlertNotification(symbol: string, currentPrice: number, condition: 'above' | 'below'): Promise<void> {
    const title = 'Price alert';
    const body =
      condition === 'above'
        ? `${symbol} is now at $${currentPrice.toFixed(2)} (above your target)`
        : `${symbol} is now at $${currentPrice.toFixed(2)} (below your target)`;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  },
};
