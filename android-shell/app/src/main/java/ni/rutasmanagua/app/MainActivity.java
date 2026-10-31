package ni.rutasmanagua.app;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.net.Uri;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.Bundle;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
  private static final int PERMISSIONS = 41;
  private static final String HOME = "https://montealtoc7.github.io/Rutas-Managua_CT/";
  private WebView web;
  private JSONObject pendingRoute;
  private boolean receiverRegistered;
  private final BroadcastReceiver updates = new BroadcastReceiver() {
    @Override public void onReceive(Context c, Intent i) {
      String json = i.getStringExtra("location");
      if (json != null) dispatch("rutas-android-location", json);
    }
  };

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(0xff123e35);
    web = new WebView(this);
    web.setBackgroundColor(0xfffffefa);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setGeolocationEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.addJavascriptInterface(new Bridge(), "RutasAndroidBridge");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri=request.getUrl();
        if ("montealtoc7.github.io".equalsIgnoreCase(uri.getHost()) && "https".equalsIgnoreCase(uri.getScheme())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch(Exception ignored) {}
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
          || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        callback.invoke(origin, granted, false);
      }
    });
    setContentView(web);
    web.loadUrl(HOME);
  }

  @Override protected void onStart() {
    super.onStart();
    IntentFilter f = new IntentFilter(LocationTrackingService.LOCATION_ACTION);
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(updates, f, Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(updates, f);
    receiverRegistered = true;
  }
  @Override protected void onStop() {
    if (receiverRegistered) { unregisterReceiver(updates); receiverRegistered = false; }
    super.onStop();
  }
  @Override public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else moveTaskToBack(true);
  }

  private void dispatch(String event, String detail) {
    if (web == null) return;
    runOnUiThread(() -> web.evaluateJavascript("window.dispatchEvent(new CustomEvent('" + event + "',{detail:" + detail + "}))", null));
  }
  private boolean hasLocationPermission() {
    return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
      || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }
  private void beginTracking(JSONObject route) {
    if (!hasLocationPermission() || (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)) {
      pendingRoute = route;
      java.util.ArrayList<String> p = new java.util.ArrayList<>();
      if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) p.add(Manifest.permission.ACCESS_FINE_LOCATION);
      if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) p.add(Manifest.permission.ACCESS_COARSE_LOCATION);
      if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) p.add(Manifest.permission.POST_NOTIFICATIONS);
      requestPermissions(p.toArray(new String[0]), PERMISSIONS);
      return;
    }
    Intent i = new Intent(this, LocationTrackingService.class)
      .setAction(LocationTrackingService.START)
      .putExtra("route", route.toString());
    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
  }
  @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    if (request != PERMISSIONS || pendingRoute == null) return;
    JSONObject route = pendingRoute; pendingRoute = null;
    if (hasLocationPermission() && (Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)) beginTracking(route);
    else dispatch("rutas-android-error", "{\"message\":\"Concede ubicación y notificaciones para mantener el seguimiento activo con la pantalla apagada.\"}");
  }

  private final class Bridge {
    @JavascriptInterface public void startTracking(String line, String stop, String route) {
      runOnUiThread(() -> {
        try {
          JSONArray points = new JSONArray(line);
          JSONObject payload = new JSONObject().put("points", points).put("stop", stop).put("route", route);
          beginTracking(payload);
        } catch (Exception e) { dispatch("rutas-android-error", "{\"message\":\"No se pudo preparar el seguimiento.\"}"); }
      });
    }
    @JavascriptInterface public void stopTracking() {
      runOnUiThread(() -> startService(new Intent(MainActivity.this, LocationTrackingService.class).setAction(LocationTrackingService.STOP)));
    }
    @JavascriptInterface public boolean isTracking() {
      return getSharedPreferences(LocationTrackingService.PREFS, MODE_PRIVATE).getBoolean("active", false);
    }
    @JavascriptInterface public String getLatestLocation() {
      return getSharedPreferences(LocationTrackingService.PREFS, MODE_PRIVATE).getString("latest", "null");
    }
  }
}