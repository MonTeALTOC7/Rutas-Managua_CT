# Primera versión local de Rutas Managua

La auditoría existente se conserva sin modificaciones. Esta implementación utiliza su base histórica y no declara vigente ninguna ruta.

## Ejecutar

Requisitos: Node.js 22 o superior y npm. Python 3.10 o superior solo para regenerar los datos.

```sh
npm ci
npm test
npm run build
npm run preview
```

Abrir `http://localhost:4173`. `npm run dev` también construye y sirve la aplicación. No hay recarga automática: después de editar, reconstruir y recargar. El servidor se enlaza solo a loopback. No hay backend, cuentas, base de datos ni publicación remota. `dist/` y `node_modules/` están ignorados.

## Android e instalación

La app incluye manifest con identidad, `start_url`, alcance, tema, modo standalone e iconos PNG de 192 y 512 px, además de uno maskable. El service worker prepara la app y el archivo de datos para uso sin conexión tras la primera carga completa. El botón Instalar aprovecha el evento del navegador cuando está disponible y ofrece indicaciones si no lo está.

La instalación y el GPS requieren un contexto seguro. La dirección HTTP de la computadora en la red local **no** basta. Para probar sin publicar, conectar un Android por USB, habilitar depuración USB y, si se dispone de Android Platform Tools, ejecutar:

```sh
adb reverse tcp:4173 tcp:4173
```

Abrir `http://localhost:4173` en Chrome del teléfono; desde su menú usar Instalar aplicación/Añadir a pantalla de inicio. Alternativa: un servidor local HTTPS con certificado confiado en el teléfono. No se ha configurado un túnel ni desplegado la aplicación. La disponibilidad del aviso de instalación depende del navegador. La instalación física en Android requiere comprobación en un dispositivo.

## Arquitectura

- HTML/CSS y módulos JavaScript nativos; Leaflet 1.9.4 como única dependencia de aplicación, fijada con lockfile y servida localmente.
- `src/planner.js`: búsqueda por secuencias dirigidas, índices de parada y geometrías propias de cada variante. Ida y regreso se calculan por separado.
- `src/app.js`: interfaz, mapa, estados vacíos, selección de puntos, GPS bajo acción explícita y opciones del archivo.
- `src/geocoder.js`: búsqueda de dirección enviada manualmente, serializada, con límite local de 1 solicitud cada 1.2 segundos y caché de hasta 20 consultas durante 7 días. No hace autocompletado remoto.
- `scripts/import_gtfs.py`: entrada fijada por SHA-256 y extracción exclusivamente espacial. `public/data/README.md` documenta fuente, licencia y reglas.
- `scripts/build.mjs`: copia los activos locales, mantiene el aviso BSD de Leaflet y genera el manifiesto de caché con una versión basada en contenido.
- `src/sw.js`: caché de una lista cerrada de activos del mismo origen. No intercepta solicitudes a otros orígenes ni almacena teselas o respuestas del geocodificador. Las actualizaciones esperan el cierre de clientes antiguos para evitar mezclar datos y código.

## Datos y decisiones del planificador

Se incorporan 46 rutas, 92 variantes y 1,712 paradas del archivo MapaNica/OSM conservado por Mobility Database. La publicación espacial data de 2020-10-27; el periodo GTFS termina el 2023-01-31. No se mezclan los GeoJSON de 2016 ni geometrías OSM editadas en 2025/2026 con el archivo histórico.

El procesamiento deja **83 variantes elegibles para comparación histórica** y nueve excluidas del cálculo: `relation/5450896`, `2602869`, `3293473`, `4482498`, `3155254`, `2602458`, `5910107`, `5910108`, `2941129`. Se muestran en la exploración con sus problemas. Los saltos de más de 500 m no se conectan visualmente al dibujar variantes del archivo. Elegibilidad espacial no significa vigencia ni validación completa.

Para calcular una opción:

1. Buscar paradas dentro del radio elegido (300, 600 o 1,000 m) alrededor de origen y destino, mediante distancia geodésica en línea recta.
2. Recorrer solo posiciones crecientes dentro de una variante elegible. No generar sentidos invirtiendo líneas. No generar paradas intermedias.
3. Permitir un máximo de un transbordo entre **rutas diferentes** únicamente en un `stop_id` compartido exactamente. No usar proximidad ni `parent_station` como evidencia suficiente de conexión.
4. Ordenar primero las opciones directas y luego por una puntuación de distancia: tres veces el acceso/egreso más distancia del trazado, con una penalización de transbordo. No es tiempo, coste monetario ni garantía de mejor viaje. Conservar hasta cinco combinaciones de variantes, con su mejor pareja de abordaje/bajada.
5. Dibujar únicamente la parte correspondiente del `shape_id` original, cortada mediante proyecciones espaciales auxiliares. Conservar los puntos reales de parada en sus coordenadas originales.

No existe grafo peatonal: se muestran distancias en línea recta y se indica que el acceso debe comprobarse. No se dibujan caminos peatonales supuestos. Una parada compartida acredita una coincidencia histórica, no la operación actual ni las condiciones físicas de intercambio. Un resultado vacío no implica ausencia de transporte actual.

La búsqueda por número conserva `125`/`125CS` y `172`/`172CS` separados; permite encontrar MR4 por el alias 261 en su nombre. La 110 muestra la discrepancia El Seminario/Aldea SOS recogida en la auditoría.

## Servicios externos y privacidad

Configuración de proveedor en `public/config.json`. Los valores por defecto son las teselas estándar de OpenStreetMap y Nominatim público, **para esta prueba local de uso moderado**. Atribución siempre visible. No se oculta el Referer ni se fuerzan cabeceras de no-cache para teselas. El caché HTTP normal del navegador sigue sus cabeceras, sin precarga ni descarga offline de mapas.

Nominatim solo se consulta al pulsar Buscar o Enter en un campo. El tecleo filtra las paradas ya guardadas en el dispositivo. La búsqueda remota se limita al área Managua/Ciudad Sandino y nunca selecciona silenciosamente el primer resultado. Los puntos GPS no se envían al geocodificador. Las coordenadas aproximadas visibles en el mapa determinan, como en cualquier mapa en línea, las teselas solicitadas.

Los puntos del viaje no persisten después de cerrar/recargar; no hay analítica ni cuentas. El seguimiento GPS opcional se describe a continuación. La caché de consultas remotas se puede borrar desde Datos. El límite de peticiones es local a este navegador, **no global para una aplicación multiusuario**. Antes de servirla a varios usuarios debe cambiarse a un proveedor adecuado o a un proxy con límite agregado y caché; la solución actual no afirma cumplir un límite agregado entre dispositivos.

## Modo viaje

En una opción de viaje, el botón de cada tramo inicia voluntariamente `watchPosition` para la posición del pasajero. Se calcula la distancia restante por la geometría histórica del tramo seleccionado, proyectando la ubicación GPS al segmento más cercano. Se muestra la precisión y separación estimadas; si la precisión supera 100 m o la posición está demasiado alejada, se oculta la distancia. Un aviso dentro de la app aparece a 300 m de la bajada estimada. Los lazos, cruces, calles paralelas, señales deficientes y trazados desactualizados pueden dar estimaciones o avisos erróneos: siempre se debe confirmar la parada. No existen notificaciones garantizadas, ETA ni localización de buses.

Pausar deja de solicitar actualizaciones; finalizar también elimina el marcador. El seguimiento se pausa automáticamente al ocultar la app o cambiar a otra sección. Reanudar requiere tocar el botón correspondiente. La app debe permanecer activa y visible; no se promete ejecución de fondo. La posición no se guarda ni se envía a un servidor por el modo viaje; si se usa el mapa en línea, las solicitudes de teselas pueden revelar el área visualizada al proveedor. No se ha verificado el GPS ni la instalación en un teléfono físico.

Políticas revisadas: [teselas OSM](https://operations.osmfoundation.org/policies/tiles/), [Nominatim](https://operations.osmfoundation.org/policies/nominatim/). No se consultan Google Maps ni Moovit.

## Verificación y límites

Las pruebas automatizadas cubren direccionalidad, transferencias justificadas por ID, exclusiones, radio, búsqueda de etiquetas, datos reales de la ruta 110, ausencia de campos temporales, comportamiento del geocodificador y aislamiento del caché PWA. No sustituyen trabajo de campo.

Pendiente: confirmación actual por ruta y sentido, auditoría geométrica completa, grafo peatonal, condiciones de accesibilidad, proveedor geográfico apto para múltiples usuarios y validación de instalación/GPS en un Android físico. Los estados de confianza y procedencia deben mantenerse al incorporar nuevas fuentes. No hay horarios, frecuencias, ETA ni seguimiento de buses.

### Registro de comprobaciones completadas — 2026-10-29

Se retomaron los archivos existentes en `feat/rutas-data-audit`, sin restaurarlos ni eliminar cambios locales. El SHA-256 de `AUDITORIA_FUENTES_TRANSPORTE.md` antes y después sigue siendo `3BE768908D91A97BE1B2FE5DCACD05B0750801B3A193923BBC3514267AF604E3`. `main` permanece en `b1715c401f40d6229be4bd440685b431aad67e74`.

Pruebas manuales realizadas en el navegador integrado, con la app servida en localhost y una comprobación visual a 390 × 844 px:

| Caso | Procedimiento y resultado observado |
| --- | --- |
| Dirección de origen | Se envió «Mercado Roberto Huembes» con Buscar. Aparecieron dos coincidencias OSM y se seleccionó explícitamente la correspondiente al mercado. El campo y el marcador A se actualizaron. |
| Dirección de destino | Se escribió «Universidad Centroamericana Managua» mientras se observaban los eventos de red: el tecleo no emitió solicitudes. Al pulsar Buscar apareció una coincidencia para Universidad Centroamericana de Ciencias Empresariales, con su nombre y dirección completos. Se eligió manualmente; no se asumió equivalencia con otra institución. |
| Origen tocando el mapa | Activar Elegir en mapa en Origen y tocar un punto produjo `12.1388, -86.3043`, sustituyó el origen anterior y colocó el marcador A. |
| Destino tocando el mapa | Activar Elegir en mapa en Destino y tocar otro punto produjo `12.1383, -86.2926`, actualizó el campo y el marcador B. Buscar recorrido devolvió opciones históricas y sus instrucciones. |
| Cancelación | Activar la selección y pulsar Cancelar ocultó el aviso sin asignar un punto. |
| Recarga offline | Tras la primera carga completa se simuló ausencia de red en la pestaña y se recargó. La app inició bajo control del service worker; funcionaron sugerencias locales, exploración de rutas y trazados. Se mostró «Sin conexión: datos guardados; mapa base no disponible», manteniendo atribución. |
| Planificación offline | Tras esa recarga se seleccionaron las paradas Mercado Mayoreo y Aldea SOS desde las sugerencias locales. Se calcularon cinco opciones de ida y cinco de regreso; se comprobó el cambio de instrucciones y sentido. La operación actual sigue sin confirmar. |
| Direcciones guardadas offline | Buscar nuevamente Mercado Roberto Huembes devolvió sus coincidencias guardadas. Una consulta no guardada («Plaza de la Revolución Managua») mostró el mensaje de falta de conexión, sin inventar un resultado. |
| Alcance de la caché | La inspección de Cache Storage encontró solo archivos del origen localhost: app, datos, documentación e iconos/Leaflet. No había teselas ni respuestas de Nominatim en la caché del service worker. Las búsquedas remotas se almacenan separadamente en localStorage según la política descrita arriba. |
| Actualización | La versión nueva quedó esperando mientras existía un cliente antiguo. Al salir temporalmente del origen y regresar se activó y se eliminó la caché anterior. No se forzó `skipWaiting` ni se borraron datos del usuario. |
| URL con parámetros offline | En la versión corregida se abrió `http://localhost:4173/?source=installed` sin conexión. Cargaron la app y la consulta de los dos sentidos de la ruta 110. |
| Recuperación | Se restauró la conexión de la pestaña y el tamaño de vista original al terminar la simulación. No quedó activado un modo offline del navegador. |

Durante la comprobación se detectó que el servidor del turno anterior ya no estaba escuchando; la app permanecía disponible por su caché. Se levantó nuevamente **solo la vista previa** sobre los archivos construidos para entregar la actualización y continuar las pruebas. No se reinició el proyecto ni se reimportaron sus datos.

Correcciones incorporadas:

- La navegación al inicio con parámetros ahora usa el mismo documento offline; la normalización se limita a `/` e `index.html` dentro del alcance. No intercepta páginas desconocidas, consultas API o servicios externos.
- El geocodificador tolera que el navegador bloquee incluso el acceso a `localStorage`, valida la estructura de las respuestas y evita tratar entradas incompletas como lugares.
- Una consulta nueva sin red informa primero de la falta de conexión, aunque todavía esté dentro del intervalo de espera entre peticiones. Las coincidencias guardadas siguen disponibles.

Resultado automatizado: **13 pruebas aprobadas, 0 fallidas**, mediante `npm test`; `npm run build` y `git diff --check` completados. Las pruebas añadidas cubren búsquedas guardadas/nuevas offline, almacenamiento bloqueado, respuestas inválidas y navegación de inicio con parámetros. Los errores 429 y las respuestas inesperadas se prueban con dobles de prueba, sin provocar carga artificial al servicio público.

La [captura móvil sin conexión](evidencias/pwa-offline-movil.jpg) documenta los trazados de la 110, sus dos sentidos y la advertencia de antigüedad. Esta prueba en navegador no equivale a una instalación comprobada en Android físico. No se solicitó la ubicación real del usuario durante las pruebas.
