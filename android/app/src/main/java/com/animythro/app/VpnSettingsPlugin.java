package com.animythro.app;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VpnSettings")
public class VpnSettingsPlugin extends Plugin {
    @PluginMethod
    public void openVpnSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_VPN_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(intent);
        } catch (Exception error) {
            Intent fallback = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }

        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }
}
