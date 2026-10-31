package ni.rutasmanagua.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import org.json.*;

public final class LocationTrackingService extends Service {
  public static final String START="ni.rutasmanagua.START", STOP="ni.rutasmanagua.STOP", LOCATION_ACTION="ni.rutasmanagua.LOCATION";
  public static final String PREFS="trip_tracking";
  private static final String SAVED_ROUTE="route_payload";
  private static final int NOTIFICATION=27, ALERT=28;
  private LocationManager manager;
  private LocationListener listener;
  private PowerManager.WakeLock wakeLock;
  private JSONArray points = new JSONArray();
  private String stopName="", routeName="";
  private boolean alerted=false;

  @Override public void onCreate() {
    super.onCreate(); manager=(LocationManager)getSystemService(LOCATION_SERVICE); createChannel();
  }
  @Override public int onStartCommand(Intent intent,int flags,int id) {
    if (intent!=null && STOP.equals(intent.getAction())) { stopTracking(); stopSelf(); return START_NOT_STICKY; }
    if (intent!=null && intent.hasExtra("route")) {
      try {
        JSONObject r=new JSONObject(intent.getStringExtra("route"));
        points=r.optJSONArray("points"); if(points==null) points=new JSONArray();
        stopName=r.optString("stop",""); routeName=r.optString("route","");
      } catch(Exception ignored) { points=new JSONArray(); }
      getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean("active",true).putString("latest","null").putString(SAVED_ROUTE,intent.getStringExtra("route")).apply();
    }
    if(intent==null && points.length()==0 && getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean("active",false)) {
      try { JSONObject r=new JSONObject(getSharedPreferences(PREFS,MODE_PRIVATE).getString(SAVED_ROUTE,"{}")); points=r.optJSONArray("points"); if(points==null)points=new JSONArray(); stopName=r.optString("stop",""); routeName=r.optString("route",""); } catch(Exception ignored) {}
    }
    startForegroundCompat();
    acquireWakeLock();
    requestUpdates();
    return START_STICKY;
  }
  private void startForegroundCompat() {
    Notification n=notification("Seguimiento activo · "+routeName,"GPS activo. Puedes apagar la pantalla; toca para volver al recorrido.",true);
    if(Build.VERSION.SDK_INT>=29) startForeground(NOTIFICATION,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    else startForeground(NOTIFICATION,n);
  }
  private Notification notification(String title,String text,boolean ongoing) {
    Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi=PendingIntent.getActivity(this,1,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Intent end=new Intent(this,LocationTrackingService.class).setAction(STOP);
    PendingIntent stop=PendingIntent.getService(this,2,end,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    return new Notification.Builder(this,"trip_tracking")
      .setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(text)
      .setContentIntent(pi).setOngoing(ongoing).setCategory(Notification.CATEGORY_SERVICE)
      .addAction(new Notification.Action.Builder(null,"Finalizar",stop).build()).build();
  }
  private void createChannel() {
    if(Build.VERSION.SDK_INT>=26) {
      NotificationChannel c=new NotificationChannel("trip_tracking","Seguimiento del recorrido",NotificationManager.IMPORTANCE_LOW);
      c.setDescription("Notificación persistente mientras el GPS sigue tu recorrido.");
      ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
      NotificationChannel a=new NotificationChannel("trip_alerts","Aviso de parada",NotificationManager.IMPORTANCE_HIGH);
      ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(a);
    }
  }
  private void acquireWakeLock() {
    if(wakeLock==null) {
      PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);
      wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"RutasManagua:TripLocation");
      wakeLock.setReferenceCounted(false); wakeLock.acquire();
    } else if(!wakeLock.isHeld()) wakeLock.acquire();
  }
  private void requestUpdates() {
    try {
      if(checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION)!=android.content.pm.PackageManager.PERMISSION_GRANTED
        && checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION)!=android.content.pm.PackageManager.PERMISSION_GRANTED) return;
      if(listener!=null) manager.removeUpdates(listener);
      listener=new LocationListener() {
        @Override public void onLocationChanged(Location l) { handle(l); }
        @Override public void onProviderEnabled(String p) {}
        @Override public void onProviderDisabled(String p) {}
      };
      manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,3000L,3f,listener,Looper.getMainLooper());
    } catch(SecurityException ignored) {}
  }
  private void handle(Location l) {
    try {
      JSONObject fix=new JSONObject().put("lat",l.getLatitude()).put("lon",l.getLongitude()).put("accuracy",l.getAccuracy()).put("timestamp",l.getTime());
      getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString("latest",fix.toString()).apply();
      Intent broadcast=new Intent(LOCATION_ACTION).setPackage(getPackageName()).putExtra("location",fix.toString()); sendBroadcast(broadcast);
      double remaining=remainingMeters(l.getLatitude(),l.getLongitude());
      String detail=routeName.isEmpty()?"GPS activo":routeName+" · "+Math.round(remaining)+" m aprox. a "+stopName;
      ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(NOTIFICATION,notification("Seguimiento activo",detail,true));
      if(remaining<=300 && !alerted) {
        alerted=true;
        Notification alert=new Notification.Builder(this,"trip_alerts").setSmallIcon(R.drawable.ic_notification).setContentTitle("Próxima parada")
          .setContentText("Estás cerca de "+stopName+". Prepárate para bajar.").setAutoCancel(true).build();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(ALERT,alert);
      } else if(remaining>500) alerted=false;
    } catch(Exception ignored) {}
  }
  private double remainingMeters(double lat,double lon) {
    if(points.length()<2) return 0;
    try {
      double best=Double.MAX_VALUE, remaining=0; int bestIndex=0;
      for(int i=0;i<points.length()-1;i++) {
        JSONArray a=points.getJSONArray(i), b=points.getJSONArray(i+1);
        double lat1=a.getDouble(0), lon1=a.getDouble(1), lat2=b.getDouble(0), lon2=b.getDouble(1);
        double mid=Math.toRadians((lat1+lat2+lat)/3.0), sx=111320.0*Math.cos(mid), sy=111320.0;
        double ax=lon1*sx, ay=lat1*sy, bx=lon2*sx, by=lat2*sy, px=lon*sx, py=lat*sy;
        double dx=bx-ax, dy=by-ay, den=dx*dx+dy*dy;
        double t=den==0?0:Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den));
        double ex=px-(ax+t*dx), ey=py-(ay+t*dy), offset=Math.hypot(ex,ey);
        if(offset<best) { best=offset; bestIndex=i; remaining=Math.hypot(dx,dy)*(1-t); }
      }
      for(int i=bestIndex+1;i<points.length()-1;i++) {
        JSONArray a=points.getJSONArray(i), b=points.getJSONArray(i+1);
        float[] d=new float[1]; Location.distanceBetween(a.getDouble(0),a.getDouble(1),b.getDouble(0),b.getDouble(1),d); remaining+=d[0];
      }
      return remaining;
    } catch(Exception ignored) { return 0; }
  }
  private void stopTracking() {
    if(manager!=null && listener!=null) manager.removeUpdates(listener);
    listener=null;
    if(wakeLock!=null && wakeLock.isHeld()) wakeLock.release();
    getSharedPreferences(PREFS,MODE_PRIVATE).edit().putBoolean("active",false).remove("latest").apply();
    ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(NOTIFICATION);
    ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(ALERT);
    stopForeground(true);
  }
  @Override public void onDestroy() { stopTracking(); super.onDestroy(); }
  @Override public android.os.IBinder onBind(Intent intent) { return null; }
}