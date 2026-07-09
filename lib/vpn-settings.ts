import { Capacitor, registerPlugin } from '@capacitor/core';

interface VpnSettingsPlugin {
  openVpnSettings(): Promise<{ opened: boolean }>;
}

const VpnSettings = registerPlugin<VpnSettingsPlugin>('VpnSettings');

export async function openVpnSettings() {
  if (!Capacitor.isNativePlatform()) {
    window.alert('VPN settings are available in the Android APK.');
    return;
  }

  await VpnSettings.openVpnSettings();
}
