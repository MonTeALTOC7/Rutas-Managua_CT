# Rutas Managua para Android

Esta primera versión Android abre la web pública y añade seguimiento GPS nativo en primer plano. Al iniciar **Modo viaje**, Android muestra una notificación persistente y el servicio continúa solicitando ubicación con la pantalla apagada. Usa el botón **Finalizar** de la notificación o detén el viaje desde la app para cerrar el seguimiento.

## Obtener el APK

En GitHub abre **Actions → Android APK**, selecciona una ejecución exitosa y descarga el artefacto `rutas-managua-android-debug`. Descomprime el ZIP e instala `app-debug.apk`. Para instalarlo, Android puede pedir permiso para instalar aplicaciones descargadas desde el navegador.

Concede ubicación precisa y notificaciones cuando la app las solicite. La pantalla debe estar encendida al comenzar un viaje. El seguimiento requiere GPS, consume batería y Android puede aplicar restricciones adicionales de batería según el fabricante. Esta app necesita internet para cargar mapas y datos.

El historial del itinerario permanece en el almacenamiento local de la web; el servicio Android conserva solo la última ubicación mientras el seguimiento está activo y la elimina al finalizar.
