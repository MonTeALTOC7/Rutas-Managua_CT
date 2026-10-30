# Auditoría de fuentes de transporte: Managua y Ciudad Sandino

**Fecha de consulta: 29 de octubre de 2026 (America/Mexico_City).** Las marcas de tiempo de Git y OpenStreetMap se conservan en UTC (`Z`).

**Resultado:** hay datos abiertos útiles para comparar números de ruta, variantes, trazados y paradas, pero esta revisión no acredita la vigencia operativa de ninguna ruta. MapaNica, el GTFS archivado y OSM comparten procedencia: su coincidencia no equivale a tres confirmaciones independientes.

## 1. Alcance y estado del repositorio

- Rama comprobada antes de investigar: `feat/rutas-data-audit`.
- Estado inicial: limpio; el único archivo versionado era `README.md`, leído íntegramente.
- `HEAD` y `main` apuntaban a `b1715c401f40d6229be4bd440685b431aad67e74` (`docs: initialize Rutas Managua repository`).
- El README plantea consultas por origen/destino, cercanía, trazados, paradas, caminatas, transbordos e ida/regreso separados. Excluye horarios, frecuencias y seguimiento en vivo.
- Esta tarea solo añade documentación. No construye interfaz, importa datos a una aplicación, inventa recorridos ni modifica `main`. No se realizan commit, push, PR ni despliegue.
- No se consultaron ni rasparon Moovit o Google Maps. Los campos temporales de los archivos de transporte no se utilizan para ofrecer horarios, frecuencias, ETA o seguimiento. Del calendario solo se comprueba el periodo de validez; de `stop_times.txt`, las referencias y el orden de paradas.

## 2. Fuentes consultadas y acceso

Todas las fuentes de esta tabla se consultaron el **2026-10-29**. Los enlaces a commits fijan la versión examinada; los sitios y la API OSM pueden cambiar después de la consulta.

| Fuente | Acceso y evidencia obtenida |
| --- | --- |
| [MapaNica: rutas de Managua y Ciudad Sandino](https://rutas.mapanica.net/) | Sitio accesible; se identifica como trabajo colectivo en proceso. Se descargó además el GeoJSON público de la ruta 110, primer sentido. |
| [mapanica/rutas](https://github.com/mapanica/rutas/tree/be713680ec966f31c0b97685f2e2819adc9b5bcb) | Árbol completo del repositorio e historial de `extra/data`; 90 GeoJSON, correspondientes a 45 etiquetas de ruta. Se inspeccionaron los dos GeoJSON de la 110. |
| [Repositorio de datos MapaNica](https://github.com/mapanica/datos/tree/d34a60369a66bc9ee49633d753222f5b2ce12867) | Sustituto verificable del servidor de datos: README, índice, licencia, historial y ZIP disponibles. El [índice fijado](https://github.com/mapanica/datos/blob/d34a60369a66bc9ee49633d753222f5b2ce12867/index.html#L176) identifica los datos de Managua y Ciudad Sandino. |
| [Servidor datos.mapanica.net](https://datos.mapanica.net/) y [URL del productor GTFS](https://datos.mapanica.net/ni-managua-gtfs.zip) | No se pudieron descargar directamente: resolución DNS fallida (`getaddrinfo failed`) desde este entorno. Esto no prueba una caída universal. |
| [Mobility Database, mdb-1021](https://mobilitydatabase.org/feeds/gtfs/mdb-1021) | Ficha, ZIP archivado e informe de validación accesibles. Agencia: Instituto Regulador del Transporte del Municipio de Managua; publicador del archivo: MapaNica.net. |
| [ZIP mdb-1021-202402080021](https://files.mobilitydatabase.org/mdb-1021/mdb-1021-202402080021/mdb-1021-202402080021.zip) | Descarga HTTP 200, procesada localmente con Python estándar. El lector web no admite este binario; la descarga HTTP directa sí funcionó. |
| [Informe GTFS Validator 8.0.0](https://files.mobilitydatabase.org/mdb-1021/mdb-1021-202402080021/report_8.0.0.html) | Informe publicado, generado el 2026-05-07. No se ejecutó localmente el validador completo. |
| [Wiki OSM: Managua y Ciudad Sandino](https://wiki.openstreetmap.org/wiki/ES:Nicaragua/Transporte_p%C3%BAblico/Managua) | Se leyó mediante el lector web. Es un índice de relaciones y antecedentes, con una sección denominada «Managua 2020». La descarga directa con Python falló por certificado TLS caducado; no se desactivó la verificación. Algunas reconsultas web agotaron el tiempo de espera. |
| [API OSM: red 3665537](https://api.openstreetmap.org/api/0.6/relation/3665537.json) y relaciones indicadas por los 92 `shape_id` del GTFS | HTTP 200. Se obtuvieron identificadores, versiones, fechas, etiquetas y listas de miembros de las 92 relaciones; no las geometrías completas de todas sus vías y nodos. |
| [Condiciones Mobility Database](https://mobilitydatabase.org/terms-and-conditions), [licencia OSM](https://www.openstreetmap.org/copyright) y [referencia GTFS](https://gtfs.org/documentation/schedule/reference/) | Consultadas para separar licencias de código, datos y metadatos, y para interpretar `location_type`, `direction_id` y secuencias. |
| [README de pt-data-managua](https://github.com/mapanica/pt-data-managua/blob/d7a1b77ad930769947d924e3df9751b1523c9a6e/README.md) y su licencia | Solo se revisaron la descripción y la licencia del insumo temporal para documentar condiciones; no se incorporó su contenido temporal. |

Las descargas de trabajo quedaron fuera del repositorio, en el directorio temporal `rutas-managua-audit-20261029`. No se incorporan ZIP, datos operativos ni programas al proyecto. Los enlaces, hashes, procedimiento y resultados quedan en este documento; los temporales no son un archivo permanente de evidencias.

## 3. Qué aporta cada fuente y qué fecha significa realmente

### 3.1. MapaNica: distinguir las distintas publicaciones

**Exportación de enero de 2016.** El índice de `mapanica/datos` ofrece GeoJSON y SHP etiquetados **27/01/2016**, extraídos de OSM. Se descargó y abrió el [ZIP GeoJSON](https://raw.githubusercontent.com/mapanica/datos/d34a60369a66bc9ee49633d753222f5b2ce12867/mapanica-managua-tuc-2016-01-27.geojson.zip): contiene **76 archivos y 38 etiquetas de ruta**. Sus geometrías suman 27 `LineString`, 49 `MultiLineString` y 5,831 entidades `Point`. Estas entidades no se han deduplicado ni validado como paradas físicas. La fecha publicada es de extracción, no una certificación de servicio ni la fecha de observación de cada objeto.

**Archivos del sitio de rutas.** En `mapanica/rutas`, `extra/data` contiene **90 GeoJSON y 45 etiquetas**, un conjunto distinto del ZIP de enero. El [historial de esa carpeta](https://github.com/mapanica/rutas/commits/be713680ec966f31c0b97685f2e2819adc9b5bcb/extra/data) muestra cambios de datos en agosto de 2016 y un último commit de la carpeta el 2016-09-17, relacionado con la licencia. El despliegue del sitio tiene un `Last-Modified` de 2025; eso no rejuvenece las geometrías. La muestra descargada desde `/data/110-1.geojson` coincide byte a byte con el archivo fijado en GitHub; no se comprobó esa igualdad para los otros 89 archivos.

**GTFS anunciado en 2020.** El índice conserva **27/10/2020** junto al GTFS. Se verificó el [commit de esa fecha](https://github.com/mapanica/datos/commit/91b4d36ead97f2b9241dc36a01c317614a91df52) y se descargó su ZIP. Luego se comparó con el del [commit del 2021-02-08](https://github.com/mapanica/datos/commit/d34a60369a66bc9ee49633d753222f5b2ce12867):

| Contenido comparado dentro de los ZIP | Resultado |
| --- | --- |
| `agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`, `shapes.txt` | Idénticos byte a byte entre los commits de 2020 y 2021. |
| `calendar.txt`, `feed_info.txt` | Cambiaron. El periodo pasó de 2020-10-01–2021-09-30 a 2021-02-01–2023-01-31. |

Por tanto, la actualización de 2021 **no demuestra una actualización espacial**: las rutas, paradas y geometrías examinadas ya estaban en el ZIP de octubre de 2020. Tampoco se conoce la fecha de levantamiento de cada tramo o parada a partir de esos CSV.

**Aporte:** inventario histórico, nombres y alias, trazados, puntos y enlaces implícitos a objetos OSM. **Limitación:** varias publicaciones y coberturas distintas, sin evidencia de operación actual. La licencia MIT de los repositorios no debe confundirse con una licencia MIT de los geodatos derivados de OSM; véase §5.

### 3.2. Mobility Database / IRTRAMMA

La ficha denomina el feed «Official Feed» y su URL de productor corresponde a MapaNica. `agency.txt` identifica a IRTRAMMA y `feed_info.txt` a **MapaNica.net**, versión `0.1`, idioma `es`. La etiqueta del catálogo no constituye confirmación de servicio actual por parte de la autoridad.

Se distinguen cuatro fechas:

| Evidencia | Fecha y alcance |
| --- | --- |
| Datos espaciales del ZIP comparado | Ya presentes, sin cambios en los archivos espaciales, en el commit de 2020-10-27. Fecha de observación en campo desconocida. |
| Último cambio del ZIP en el repositorio de datos | 2021-02-08; cambia calendario e información del feed. |
| Periodo declarado dentro del ZIP | **2021-02-01 a 2023-01-31**, en las tres filas de `calendar.txt` y en `feed_info.txt`. No existe `calendar_dates.txt` que lo amplíe. |
| Captura del catálogo | Identificador `mdb-1021-202402080021`; ficha: 2024-02-08; cabecera HTTP del ZIP `Last-Modified: Thu, 08 Feb 2024 00:57:29 GMT`. Es fecha de archivo, no de relevamiento. |

El ZIP archivado y el ZIP de `mapanica/datos` en el commit de 2021 son **exactamente iguales por SHA-256**. No representan dos levantamientos independientes.

La cabecera de la ficha y el informe indican 2023-01-31 como final del servicio. La tabla de historial de la misma ficha muestra 2023-02-01. Se registra esta discrepancia de presentación y se adopta **2023-01-31**, verificado en los archivos. No se infiere el motivo del día de diferencia.

La ficha muestra revisiones del informe, de la etiqueta oficial y del sello durante 2026. Son metadatos del catálogo; no cambian el periodo interno del ZIP ni acreditan vigencia. El informe presenta cero errores, pero contiene advertencias, entre ellas calendarios vencidos y siete incidencias `stops_match_shape_out_of_order`; también señala 162 casos `trip_headsign_matches_intermediate_stop`. Por eso ni un resultado estructural sin errores ni un `trip_headsign` bastan para validar un destino o recorrido.

**Aporte:** copia histórica identificable y descargable, inventario estructurado y relaciones entre ruta, variante, geometría y paradas. **Limitación:** calendario vencido, campos incompletos, inconsistencias espaciales pendientes y ausencia de prueba actual de operación. No se usarán sus tiempos de viaje ni se derivarán servicios vigentes de su calendario.

### 3.3. OpenStreetMap

La wiki permite localizar relaciones de red, `route_master` y `route=bus`, pero sus títulos, tablas y fechas editoriales no certifican todo el conjunto. La relación de red **3665537**, versión 6, tiene fecha **2020-09-24T07:52:45Z** y 46 miembros de tipo relación. Esa fecha corresponde únicamente a esa relación contenedora.

Se extrajeron los 92 identificadores OSM de `shape_id` y se consultaron en un lote a la API. Resultado:

- **92/92** relaciones respondieron; todas tienen `type=route`, `route=bus` y un `ref` que coincide con el `route_id` del feed, incluidos los sufijos `CS`.
- Las últimas ediciones de **esas 92 relaciones**, no de toda la red, se distribuyen en 10 de 2025 y 82 de 2026. El intervalo observado es **2025-01-28T20:36:48Z–2026-09-11T20:46:54Z**.
- Se conserva el detalle por relación y sentido en el anexo B. No se asigna una fecha única a OSM.
- Una edición puede cambiar etiquetas o membresía sin verificar el servicio. Las vías y los nodos miembros tienen versiones y fechas propias, y pueden cambiar sin editar la relación.
- No se descargaron recursivamente todos los miembros ni se calculó una comparación geométrica actual. Tampoco se buscaron exhaustivamente relaciones nuevas fuera del inventario histórico del GTFS.

**Aporte:** entidades identificables, miembros ordenados, etiquetas de origen/destino, plataformas, posiciones de parada e historial público. **Limitación:** cobertura y actualidad heterogéneas; no existe en lo revisado una fecha acreditada de verificación operativa para cada ruta/sentido. Los metadatos recientes justifican revisar OSM como candidato de comparación, no anunciar automáticamente rutas vigentes.

## 4. Procesamiento del GTFS y contrastes concretos

### 4.1. Conteos reproducidos del archivo archivado

Los conteos siguientes son resultados del procesamiento local del ZIP identificado en el anexo A, no estimaciones de la red actual.

| Comprobación | Resultado |
| --- | --- |
| `routes.txt` | 46 filas, 46 identificadores; dos `shape_id` por ruta en este archivo. No convertir esto en una regla para datos futuros. |
| `stops.txt` | 2,247 filas e identificadores únicos: **1,712 con `location_type=0` y 535 con `location_type=1`**. |
| Uso de paradas | 1,712 `stop_id` distintos en las secuencias; todos de tipo 0. Las 535 estaciones de tipo 1 no aparecen como paradas en `stop_times.txt`. No son necesariamente registros erróneos: existe jerarquía mediante `parent_station`. |
| `shapes.txt` | 47,624 puntos distribuidos en 92 geometrías; sin duplicados de `shape_pt_sequence` dentro de una misma geometría. |
| `trips.txt` | 21,022 registros. **`direction_id` vacío en todos**. Este conteo no se interpreta como oferta o frecuencia actual. |
| `stop_times.txt` | 997,333 filas inspeccionadas únicamente para referencias y secuencias, sin usar sus horas. |
| Agrupación espacial | 92 combinaciones de `(route_id, shape_id, trip_headsign)`; una secuencia ordenada de `stop_id` por combinación en esta copia. |
| Referencias | No se encontraron viajes con ruta, geometría o servicio inexistentes, ni filas de secuencia con viaje o parada inexistentes. Es una comprobación parcial, no una validación integral GTFS. |

Así, «2,247 paradas» reproduce la cifra agregada del catálogo, pero no significa 2,247 lugares distintos de abordaje. Para comparar paradas hay que distinguir estaciones, posiciones y plataformas, además de resolver duplicados y lados de la vía. La interpretación de tipos y campos se basa en la [referencia GTFS](https://gtfs.org/documentation/schedule/reference/#stopstxt).

### 4.2. Ruta 110: separación de variantes sin inventar `direction_id`

| Fuente / identificador | Origen y destino documentados | Evidencia de paradas |
| --- | --- | --- |
| [MapaNica `110-1.geojson`](https://github.com/mapanica/rutas/blob/be713680ec966f31c0b97685f2e2819adc9b5bcb/extra/data/110-1.geojson) | Mercado Mayoreo → El Seminario | 44 entidades `Point` y una `LineString`; sin equipararlas automáticamente a paradas GTFS. |
| [MapaNica `110-2.geojson`](https://github.com/mapanica/rutas/blob/be713680ec966f31c0b97685f2e2819adc9b5bcb/extra/data/110-2.geojson) | El Seminario → Mercado Mayoreo | 40 entidades `Point` y una `LineString`. |
| GTFS `shape_id=relation/3751865`, `trip_headsign=Aldea SOS` | Primera parada: Mercado Mayoreo (`node/3227474896`); última: Aldea SOS (`node/3230468200`) | 46 entradas de parada en la secuencia única de esta variante. |
| GTFS `shape_id=relation/3751885`, `trip_headsign=Mercado Mayoreo` | Primera parada: Aldea SOS (`node/3227474640`); última: Mercado Mayoreo (`node/2865703778`) | 51 entradas de parada en la secuencia única de esta variante. |
| [OSM 3751865](https://www.openstreetmap.org/relation/3751865), v183, 2026-09-03T22:25:50Z | Etiquetas `from=Mercado Mayoreo`, `to=Aldea SOS` | 41 miembros con rol `stop` y 42 con rol `platform`; no sumarlos como 83 paradas. |
| [OSM 3751885](https://www.openstreetmap.org/relation/3751885), v169, 2026-07-02T10:54:40Z | Etiquetas `from=Aldea SOS`, `to=Mercado Mayoreo` | 44 miembros `stop` y 46 `platform`; requieren emparejamiento y revisión. |

**Conclusión limitada:** `shape_id` y `trip_headsign`, contrastados con la secuencia y sus extremos, permiten separar dos variantes históricas de la 110. La correspondencia de identificadores con OSM existe, pero no certifica que sus geometrías sean iguales. «El Seminario» frente a «Aldea SOS» y las diferencias de conteo requieren revisar alias, extensión del recorrido, plataformas y cambios reales; no se decide aquí cuál explicación es correcta. Tampoco se convierte el atributo OSM `direction` en `direction_id` GTFS sin documentar el criterio.

### 4.3. Cobertura y homónimos de Ciudad Sandino

El GTFS distingue `125` de `125CS` y `172` de `172CS`. El inventario de `mapanica/rutas`, normalizando solamente la escritura `125 (CS)` → `125CS` para la comparación de etiquetas, tiene las mismas etiquetas que el feed excepto **`172CS`, ausente en ese inventario del sitio**. Una diferencia entre fuentes históricas no prueba la creación ni la desaparición de una ruta.

Ejemplos que deben conservarse separados:

| `route_id` GTFS | Geometrías | Destinos `trip_headsign` del archivo |
| --- | --- | --- |
| `125CS` | `relation/5859063`, `relation/5859064` | Mercadito (Ciudad Sandino); KM 9 Motastepe. |
| `172CS` | `relation/11228557`, `relation/11228556` | Terminal Villa Sandino; Entrada a Ciudad Sandino. |

La relación 11228557 fue editada el 2025-01-28, mientras su contraparte 11228556 fue editada el 2026-03-02. La diferencia demuestra por qué se debe registrar cada sentido por separado. `MR4` aparece en el GTFS con nombre largo `Miniruta 4 (261)`; el alias tampoco autoriza fusionarla con otra ruta sin contraste. El ZIP de enero de 2016 usa `Vanegas` en nombres de archivo y otras fuentes usan `VAN`: la equivalencia debe quedar justificada, no depender solo de una transformación de texto.

## 5. Licencias y condiciones de reutilización

| Material | Condición verificada | Aplicación a esta auditoría y pendiente |
| --- | --- | --- |
| Código de `mapanica/rutas` y `mapanica/datos` | Archivos `LICENSE` MIT en ambos repositorios. | Si se reutiliza código, conservar el aviso y la licencia. No extender MIT automáticamente a los datos geográficos. |
| Geodatos de MapaNica | El [índice del productor](https://github.com/mapanica/datos/blob/d34a60369a66bc9ee49633d753222f5b2ce12867/index.html#L213) declara procedencia OSM y **ODbL**; solicita reconocimiento. | Atribuir a MapaNica y a los contribuidores de OSM, enlazar la licencia y conservar procedencia. Las obligaciones de compartir bases derivadas deben evaluarse según el material que se distribuya. |
| Datos de OpenStreetMap | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), con atribución a OpenStreetMap y sus contribuidores. | No confundir datos con teselas, servicios de API o documentación. Respetar también las políticas de acceso del servicio utilizado. |
| Texto/documentación OSM | La página de copyright declara **CC BY-SA 2.0** para la documentación. | El índice wiki sirve de referencia; no se copia íntegramente su tabla. Los datos de la API mantienen ODbL. |
| Metadatos Mobility Database | Sus [condiciones](https://mobilitydatabase.org/terms-and-conditions) indican **CC0** para metadatos generados por MobilityData; las licencias de cada feed dependen de sus titulares. | Que un ZIP esté en el catálogo no lo convierte en CC0 ni acredita su actualidad. |
| GTFS archivado completo | No contiene un archivo de licencia. Hay declaración ODbL para geodatos del productor y evidencia de origen OSM. El [README del insumo temporal](https://github.com/mapanica/pt-data-managua/blob/d7a1b77ad930769947d924e3df9751b1523c9a6e/README.md) declara **CC BY-SA 4.0** para ese insumo. | Se documenta la procedencia espacial. No se afirma una licencia única MIT/CC0 para todo el ZIP ni se acredita aquí la cadena de generación de cada campo. Antes de redistribuir un feed completo, aclarar con el productor la cobertura de las condiciones de sus componentes. No se usarán horarios. |

## 6. Base de comparación y límites de publicación

| Material o conclusión | Uso admisible en la auditoría | Qué no debe presentarse como vigente |
| --- | --- | --- |
| GeoJSON/SHP publicados en 2016 | Comparación histórica de trazados, puntos y denominaciones, manteniendo la versión específica. | Recorridos o paradas actuales por el mero hecho de seguir visibles en una web. |
| GTFS espacial 2020 / calendario modificado 2021 / archivo 2024 | Base histórica reproducible de 46 rutas y 92 variantes, con IDs y secuencias. | Servicio operativo en 2026; sus tiempos, frecuencias, ETA o disponibilidad. |
| Relaciones OSM consultadas en 2026 | Candidatos de contraste por identificador, versión, sentido, miembros y, en la siguiente fase, geometría. | Actualidad de toda una ruta por la fecha de un objeto, de una dirección por la otra o de la red por su relación contenedora. |
| Coincidencia MapaNica–GTFS–OSM | Consistencia entre representaciones de origen relacionado. | Corroboración independiente del funcionamiento real. |
| Número o destino coincidente | Hipótesis de equivalencia registrada con sus pruebas. | Identidad automática de rutas, lados de la vía, variantes o terminales. |

Ninguna ruta queda aprobada para uso público como vigente en esta primera auditoría. La siguiente fase deberá obtener evidencia actual y resolver los conflictos relevantes antes de esa clasificación.

## 7. Plan verificable de auditoría por ruta y sentido

### Paso 1: fijar y ampliar el inventario

Partir de las 46 rutas y 92 variantes del anexo B, conservando IDs como texto. Incorporar los miembros actuales de `route_master`, las referencias de la wiki y una búsqueda OSM delimitada a Managua/Ciudad Sandino para detectar relaciones fuera del feed. Registrar también rutas presentes solo en una fuente; no confundir ausencia en un conjunto con baja operativa.

**Entregable de la siguiente fase:** inventario con cobertura por fuente, alias justificados, municipio/ámbito comprobado, fechas de consulta y archivos con SHA-256. Criterio de cierre: todas las entidades de cada extracción tienen una correspondencia explícita o un motivo documentado para quedar sin correspondencia.

### Paso 2: identificar sentidos y variantes

En GTFS, agrupar inicialmente por `route_id`, `shape_id`, `trip_headsign` y secuencia ordenada de `stop_id`; ignorar horas. No suponer siempre dos variantes ni considerar que el regreso es la ida invertida. En OSM, guardar `route_master`, relación `route`, `ref`, `from`, `to`, `via`, roles y orden de miembros. Contrastar ambos extremos con paradas y geometría, preservando ramales, bucles y servicios parciales cuando estén documentados.

**Criterio de cierre:** cada correspondencia tiene origen, destino, evidencia de orden y explicación de cualquier alias; las ambiguas quedan pendientes. Prioridad: 110, 125/125CS y 172/172CS.

### Paso 3: reconstruir y comparar geometrías

Descargar las relaciones OSM con sus vías y nodos, guardando versiones/fechas de todos los componentes y el momento de la extracción. Para GTFS, ordenar `shapes.txt` por `shape_pt_sequence`. Para GeoJSON, conservar los componentes de `MultiLineString` y comprobar su conectividad. No unir huecos ni ajustar trazados automáticamente para hacerlos coincidir.

Comparar en un sistema métrico apropiado para Managua, por ejemplo WGS 84 / UTM zona 16N (`EPSG:32616`): longitud, extremos, discontinuidades, calles exclusivas de cada sentido y distancia entre líneas. Como **umbrales iniciales de revisión**, marcar diferencias de longitud superiores al 10 %, extremos separados más de 100 m y segmentos que se alejen más de 50 m del otro trazado; calibrarlos con casos conocidos y registrar la versión del criterio. Estar por debajo del umbral no certifica vigencia.

**Entregable:** diferencias localizadas por tramo y fuente, con el método y parámetros. Criterio de cierre: ninguna discontinuidad o diferencia material queda corregida sin evidencia o explicación.

### Paso 4: auditar paradas y su secuencia

Separar `location_type=0`, estaciones y `parent_station`; en OSM, posiciones de parada, plataformas y áreas. Proponer correspondencias primero por IDs OSM preservados y después por proximidad, nombre, lado de vía y orden. Una cercanía de 30 m puede generar un candidato, nunca una fusión automática. Identificar plataformas opuestas, paradas renombradas, repetidas en un bucle, retiradas o desplazadas.

Verificar que cada parada se proyecta razonablemente sobre su trazado, que la secuencia no retrocede injustificadamente y que origen/destino coinciden con lo documentado. Revisar primero las siete incidencias de orden del informe publicado y los destinos que coinciden con paradas intermedias. No contar conjuntamente `stop` y `platform` sin resolver su asociación.

**Entregable:** lista ordenada por variante, correspondencias, diferencias y causa de cada excepción. Criterio de cierre: cada parada tiene un estado explícito y ninguna fusión depende solo del nombre o de la distancia.

### Paso 5: obtener confirmación independiente y actual

Solicitar o localizar documentación fechada de IRTRAMMA, autoridades competentes de Ciudad Sandino y cooperativas; aceptar para incorporación solo fuentes con condiciones de reutilización claras. Complementar con revisión local o recorrido en campo documentado, por sentido, fecha, terminales, calles y paradas. Una confirmación de un operador debe identificar exactamente la variante y lo que confirmó. No se ha contactado a nadie durante esta tarea.

**Criterio de cierre:** para declarar una variante verificada, disponer de evidencia actual que cubra su geometría y paradas en ese sentido, con responsable, fecha y conflictos resueltos. Un documento que solo enumera números no valida trazados. Definir antes de publicar una política de caducidad/revisión; no inventar aquí una vigencia automática de N meses.

### Paso 6: registrar decisiones y mantener trazabilidad

La matriz de auditoría futura deberá contener al menos:

| Grupo | Campos requeridos |
| --- | --- |
| Identidad | Número/etiqueta original, ID de fuente, alias, ámbito territorial, variante, origen, destino y `via`. |
| Evidencia | URL, versión/commit, SHA-256, fecha de consulta, fecha de edición/publicación y fecha de observación o confirmación si existe. |
| Geometría | `shape_id` o relación/versiones de miembros, secuencia, extremos, métricas y diferencias localizadas. |
| Paradas | IDs originales, tipo, jerarquía, lado de vía, orden y correspondencias justificadas. |
| Decisión | Estado, conflicto, evidencia actual, responsable de revisión, fecha y próxima revisión. |
| Derechos | Licencia por componente y atribución necesaria. |

Estados propuestos: `histórica`, `candidata sin confirmar`, `conflicto`, `verificada a fecha` y `fuera de alcance`. La baja de una ruta requiere evidencia; no se deduce de que una fuente no la incluya. Registrar por separado estado de geometría, paradas y operación. Las decisiones no deben incluir horarios, frecuencias, ETA ni seguimiento de buses.

## 8. Vacíos y asuntos pendientes

1. **Operación actual:** no se obtuvo confirmación independiente de IRTRAMMA/cooperativas por ruta y sentido. Ningún dato examinado acredita por sí solo la situación de calle a la fecha de consulta.
2. **Cobertura completa:** el lote OSM se limitó a las 92 relaciones referidas por el feed. Faltan la expansión de las relaciones maestras y la búsqueda de altas, bajas y variantes ajenas a ese inventario, en especial para Ciudad Sandino.
3. **Geometrías actuales:** faltan vías/nodos recursivos, comparación espacial y revisión de discontinuidades. Los metadatos de relación descargados no sustituyen ese trabajo.
4. **Ruta 110:** resolver El Seminario/Aldea SOS, diferencias de paradas y cambios del trazado. Para el resto de rutas, el anexo B es inventario de evidencia, no una auditoría completada.
5. **Paradas:** comprobar jerarquías, plataformas, lado de vía, nombres, posibles duplicados y orden; resolver las incidencias espaciales del informe GTFS.
6. **Actualización de origen:** el dominio de datos falló por DNS. El repositorio permitió verificar sus archivos históricos, pero no demuestra la inexistencia de una publicación más reciente en otra ubicación.
7. **Licencia por componente:** documentar la cadena de generación y las condiciones aplicables antes de redistribuir el GTFS completo o una base derivada. MIT/CC0 no se presumen para los geodatos.
8. **Trazabilidad permanente:** si se ejecuta la auditoría completa, acordar dónde conservar capturas y manifiestos versionados; los archivos temporales de esta consulta pueden desaparecer.

## Anexo A. Procedencia y reproducción

### A.1. Archivos identificados

| Archivo | URL fijada / identificación | Tamaño (bytes) | SHA-256 |
| --- | --- | ---: | --- |
| GTFS archivado | [Mobility Database, 202402080021](https://files.mobilitydatabase.org/mdb-1021/mdb-1021-202402080021/mdb-1021-202402080021.zip) | 9,876,583 | `72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4` |
| GTFS del productor, commit 2021 | [MapaNica d34a603](https://raw.githubusercontent.com/mapanica/datos/d34a60369a66bc9ee49633d753222f5b2ce12867/ni-managua-gtfs.zip) | 9,876,583 | `72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4` |
| GTFS del productor, commit 2020 | [MapaNica 91b4d36](https://raw.githubusercontent.com/mapanica/datos/91b4d36ead97f2b9241dc36a01c317614a91df52/ni-managua-gtfs.zip) | 9,876,480 | `a60bca339e841fc57b622e54c322e7c466d8976c3dd48a294168b640f8b0c8b5` |
| GeoJSON, publicación enero de 2016 | [MapaNica TUC 2016](https://raw.githubusercontent.com/mapanica/datos/d34a60369a66bc9ee49633d753222f5b2ce12867/mapanica-managua-tuc-2016-01-27.geojson.zip) | 542,333 | `3f16734c203a0adea88f4857f96d2c7585043f2d9effe19772bcaf8f255f21be` |
| Muestra del sitio: 110, primer sentido | [Sitio público](https://rutas.mapanica.net/data/110-1.geojson), idéntico al [archivo fijado](https://raw.githubusercontent.com/mapanica/rutas/be713680ec966f31c0b97685f2e2819adc9b5bcb/extra/data/110-1.geojson) | 17,191 | `ef4b13ae55a4601f2be16ca8995722b4da68e315e50244112c71aa816f6c12a3` |
| Respuesta OSM de las 92 relaciones | API `/api/0.6/relations.json?relations=...`; IDs derivados de los `shape_id` únicos y ordenados como texto, sin el prefijo `relation/` | 980,332 | `ed049fee6314789ed3f6fc270650fc62cd7921d280765cf56d746afc8b276e67` |

El hash OSM identifica la respuesta obtenida, incluidos sus metadatos; una consulta posterior puede producir otro hash. Las versiones concretas se registran en el anexo B. Recuperar la misma versión de una relación no fija automáticamente las versiones históricas de sus miembros.

### A.2. Procedimiento mínimo reproducible

Python 3.14.6, bibliotecas estándar `urllib.request`, `zipfile`, `csv`, `io`, `hashlib`, `collections` y `json`. No se instalaron dependencias en el proyecto. Descargar los ZIP del anexo en una carpeta temporal y comprobar los SHA-256 **antes** de interpretar resultados. Este bloque reproduce los conteos y agrupaciones principales, sin leer horas como datos de análisis:

```python
from pathlib import Path
from collections import Counter, defaultdict
import csv, hashlib, io, json, zipfile

# Ejecutar en la carpeta temporal que contiene la descarga como feed.zip.
path = Path("feed.zip")
assert hashlib.sha256(path.read_bytes()).hexdigest() == (
    "72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4"
)
z = zipfile.ZipFile(path)

def rows(name):
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig"))

routes = list(rows("routes.txt"))
stops = list(rows("stops.txt"))
trips = list(rows("trips.txt"))
shapes = list(rows("shapes.txt"))
print("routes, stops, trips, shape points:",
      len(routes), len(stops), len(trips), len(shapes))
print("location_type:", Counter(s["location_type"] for s in stops))
print("direction_id:", Counter(t.get("direction_id", "<absent>") for t in trips))
print("feed info:", list(rows("feed_info.txt")))
print("service dates:", [(c["service_id"], c["start_date"], c["end_date"])
                         for c in rows("calendar.txt")])
print("calendar_dates present:", "calendar_dates.txt" in z.namelist())

by_trip = {t["trip_id"]: t for t in trips}
stop_ids = {s["stop_id"] for s in stops}
sequences = defaultdict(list)
used, n_rows, missing = set(), 0, 0
for row in rows("stop_times.txt"):
    # Solo conservar estas tres columnas; descartar las horas.
    trip_id, stop_id = row["trip_id"], row["stop_id"]
    sequence = int(row["stop_sequence"])
    n_rows += 1
    missing += trip_id not in by_trip or stop_id not in stop_ids
    used.add(stop_id)
    sequences[trip_id].append((sequence, stop_id))

patterns = defaultdict(set)
for trip_id, seq in sequences.items():
    t = by_trip[trip_id]
    key = (t["route_id"], t["shape_id"], t["trip_headsign"])
    patterns[key].add(tuple(s for _, s in sorted(seq)))
print("sequence rows, used stops, bad references:", n_rows, len(used), missing)
print("variant groups, patterns:", len(patterns), sum(map(len, patterns.values())))
for key, values in sorted(patterns.items()):
    if key[0] == "110":
        print(key, [(len(seq), seq[0], seq[-1]) for seq in values])

ids = sorted({s["shape_id"].removeprefix("relation/") for s in shapes})
assert all(i.isdigit() for i in ids)
print("OSM metadata URL:",
      "https://api.openstreetmap.org/api/0.6/relations.json?relations=" + ",".join(ids))
```

Para repetir el contraste temporal, abrir los ZIP de los commits 2020 y 2021 y comparar `zip_2020.read(nombre) == zip_2021.read(nombre)` para cada archivo. No comparar solo fechas internas ZIP: varias son `1980-01-01`, un valor técnico que no fecha el relevamiento.

Para reproducir el inventario OSM, descargar la URL de metadatos que imprime el bloque y guardar el cuerpo original y su SHA-256. Cruzar `elements[].id` con `shape_id`; registrar `version`, `timestamp`, `tags.ref`, `tags.from`, `tags.to` y los roles de `members`. Para una auditoría histórica, conservar las versiones del anexo B; para una nueva consulta, registrar las nuevas sin sustituir silenciosamente esta evidencia.

## Anexo B. Inventario por variante: GTFS histórico y metadatos OSM

**Alcance:** 92 combinaciones de variante del GTFS archivado, correspondientes a 46 rutas. `Destino GTFS` y `Entradas de parada` proceden de la secuencia histórica; la versión y fecha corresponden a la relación OSM consultada en 2026. No significan que esa secuencia sea la secuencia actual de OSM ni que la ruta esté operativa. Todos los registros tienen pendiente el contraste completo de geometría, paradas y operación descrito en §7.

| Ruta GTFS | Relación OSM / sufijo de `shape_id` | Destino GTFS (`trip_headsign`) | Entradas de parada GTFS | Versión OSM | Última edición de la relación (UTC) |
| --- | --- | --- | ---: | ---: | --- |
| 101 | [2602440](https://www.openstreetmap.org/relation/2602440) | Mercado Mayoreo | 59 | 184 | 2026-02-05T06:30:41Z |
| 101 | [5450299](https://www.openstreetmap.org/relation/5450299) | San Miguel Arcángel | 55 | 116 | 2026-07-25T15:58:25Z |
| 102 | [2606806](https://www.openstreetmap.org/relation/2606806) | Pulpería Karla | 54 | 192 | 2026-07-25T15:58:25Z |
| 102 | [5450896](https://www.openstreetmap.org/relation/5450896) | Mercado Mayoreo | 55 | 132 | 2026-06-04T16:11:45Z |
| 103 | [2602869](https://www.openstreetmap.org/relation/2602869) | Laureles Sur | 53 | 242 | 2026-09-08T23:07:30Z |
| 103 | [5357337](https://www.openstreetmap.org/relation/5357337) | Hospital Lenín Fonseca | 46 | 152 | 2026-06-19T15:01:19Z |
| 104 | [2606881](https://www.openstreetmap.org/relation/2606881) | Hialeah | 53 | 202 | 2026-09-03T22:25:50Z |
| 104 | [4559121](https://www.openstreetmap.org/relation/4559121) | Mercado Mayoreo | 53 | 115 | 2026-05-25T02:31:25Z |
| 105 | [2941631](https://www.openstreetmap.org/relation/2941631) | Plazoleta Camilo Ortega | 50 | 309 | 2026-06-19T15:01:19Z |
| 105 | [2942229](https://www.openstreetmap.org/relation/2942229) | Terminal 105 | 49 | 323 | 2026-06-19T15:01:19Z |
| 106 | [2614526](https://www.openstreetmap.org/relation/2614526) | Terminal Berta Díaz | 59 | 194 | 2026-07-02T10:54:40Z |
| 106 | [3279637](https://www.openstreetmap.org/relation/3279637) | El Seminario | 55 | 168 | 2026-09-03T22:25:50Z |
| 107 | [2607453](https://www.openstreetmap.org/relation/2607453) | El Panal | 44 | 119 | 2025-09-09T15:20:32Z |
| 107 | [3376761](https://www.openstreetmap.org/relation/3376761) | Terminal Camilo Ortega | 42 | 78 | 2026-02-26T04:38:15Z |
| 108 | [2942162](https://www.openstreetmap.org/relation/2942162) | Terminal Reparto Schick | 51 | 107 | 2026-06-19T15:01:19Z |
| 108 | [5453245](https://www.openstreetmap.org/relation/5453245) | Terminal 108 | 55 | 85 | 2026-09-03T22:25:50Z |
| 109 | [2942156](https://www.openstreetmap.org/relation/2942156) | Terminal Reparto Schick | 58 | 128 | 2026-09-11T20:46:54Z |
| 109 | [4245551](https://www.openstreetmap.org/relation/4245551) | Hospital Lenín Fonseca | 56 | 95 | 2026-06-08T21:14:30Z |
| 110 | [3751865](https://www.openstreetmap.org/relation/3751865) | Aldea SOS | 46 | 183 | 2026-09-03T22:25:50Z |
| 110 | [3751885](https://www.openstreetmap.org/relation/3751885) | Mercado Mayoreo | 51 | 169 | 2026-07-02T10:54:40Z |
| 111 | [2616965](https://www.openstreetmap.org/relation/2616965) | Terminal 111 | 56 | 197 | 2026-07-25T15:58:25Z |
| 111 | [3291966](https://www.openstreetmap.org/relation/3291966) | Terminal Miguel Bonilla | 61 | 137 | 2026-07-25T15:58:25Z |
| 112 | [2879899](https://www.openstreetmap.org/relation/2879899) | Parque Independencia | 54 | 201 | 2026-08-05T17:06:09Z |
| 112 | [3126759](https://www.openstreetmap.org/relation/3126759) | Terminal 116 | 58 | 176 | 2026-02-20T05:20:06Z |
| 113 | [4266316](https://www.openstreetmap.org/relation/4266316) | Terminal 113 | 43 | 91 | 2026-02-26T04:38:15Z |
| 113 | [4268979](https://www.openstreetmap.org/relation/4268979) | El Panal | 47 | 97 | 2025-12-16T04:47:42Z |
| 114 | [2606743](https://www.openstreetmap.org/relation/2606743) | Terminal de la Ruta 114 | 46 | 251 | 2026-08-05T17:06:09Z |
| 114 | [3877882](https://www.openstreetmap.org/relation/3877882) | Villa José Benito Escobar | 49 | 207 | 2026-07-02T10:54:40Z |
| 115 | [5714046](https://www.openstreetmap.org/relation/5714046) | Pollo El Granjero | 57 | 95 | 2026-03-02T05:53:10Z |
| 115 | [5714047](https://www.openstreetmap.org/relation/5714047) | Colegio Cristiano el Edén | 56 | 90 | 2026-03-02T05:53:10Z |
| 116 | [3199877](https://www.openstreetmap.org/relation/3199877) | El Seminario | 45 | 134 | 2026-06-04T16:11:45Z |
| 116 | [5446754](https://www.openstreetmap.org/relation/5446754) | Terminal 116 | 46 | 89 | 2026-06-04T16:11:45Z |
| 117 | [3753499](https://www.openstreetmap.org/relation/3753499) | UCA | 44 | 123 | 2026-09-03T22:25:50Z |
| 117 | [3753516](https://www.openstreetmap.org/relation/3753516) | Villa José Benito Escobar | 43 | 112 | 2026-06-08T18:57:09Z |
| 118 | [2941501](https://www.openstreetmap.org/relation/2941501) | Cuesta El Plomo Sur | 58 | 197 | 2026-06-04T16:11:45Z |
| 118 | [5435724](https://www.openstreetmap.org/relation/5435724) | Laureles Sur | 57 | 137 | 2026-07-02T10:54:40Z |
| 119 | [2602344](https://www.openstreetmap.org/relation/2602344) | Terminal 119 | 47 | 219 | 2026-05-12T02:30:37Z |
| 119 | [3213716](https://www.openstreetmap.org/relation/3213716) | Cuesta El Plomo Sur | 52 | 170 | 2026-09-03T22:25:50Z |
| 120 | [2607516](https://www.openstreetmap.org/relation/2607516) | El Seminario | 40 | 244 | 2026-08-05T17:06:09Z |
| 120 | [5438277](https://www.openstreetmap.org/relation/5438277) | Mercado Mayoreo | 47 | 151 | 2026-07-02T10:54:40Z |
| 123 | [4279121](https://www.openstreetmap.org/relation/4279121) | Terminal San Judas | 60 | 140 | 2026-07-02T10:54:40Z |
| 123 | [4284473](https://www.openstreetmap.org/relation/4284473) | Mercado Huembes Suroeste | 62 | 146 | 2026-02-20T05:20:06Z |
| 125 | [5709615](https://www.openstreetmap.org/relation/5709615) | Sector Este Dupla Sur | 30 | 83 | 2026-07-02T10:54:40Z |
| 125 | [5709616](https://www.openstreetmap.org/relation/5709616) | Terminal 125 | 31 | 84 | 2026-06-16T23:55:52Z |
| 125CS | [5859063](https://www.openstreetmap.org/relation/5859063) | Mercadito (Ciudad Sandino) | 34 | 37 | 2026-03-02T05:53:10Z |
| 125CS | [5859064](https://www.openstreetmap.org/relation/5859064) | KM 9 Motastepe | 31 | 33 | 2026-03-02T06:57:08Z |
| 133 | [5709365](https://www.openstreetmap.org/relation/5709365) | Terminal de Retorno 133 | 49 | 83 | 2025-12-16T04:47:42Z |
| 133 | [5709468](https://www.openstreetmap.org/relation/5709468) | Terminal 133 | 48 | 85 | 2025-12-16T04:47:42Z |
| 154 | [2608742](https://www.openstreetmap.org/relation/2608742) | Mercado Iván Montenegro Sureste | 61 | 185 | 2026-07-02T10:54:40Z |
| 154 | [4287285](https://www.openstreetmap.org/relation/4287285) | La Cooperativa | 54 | 142 | 2026-07-02T10:54:40Z |
| 158 | [2730510](https://www.openstreetmap.org/relation/2730510) | El Panal | 37 | 134 | 2025-09-17T22:21:23Z |
| 158 | [4420884](https://www.openstreetmap.org/relation/4420884) | La Cooperativa | 36 | 94 | 2025-12-23T05:51:07Z |
| 159 | [4439329](https://www.openstreetmap.org/relation/4439329) | Mercado Mayoreo | 61 | 91 | 2026-06-04T16:11:45Z |
| 159 | [4450949](https://www.openstreetmap.org/relation/4450949) | Terminal Huellas de Acahualinca | 54 | 108 | 2026-07-25T15:58:25Z |
| 163 | [2879951](https://www.openstreetmap.org/relation/2879951) | El Panal | 52 | 115 | 2026-06-08T21:14:30Z |
| 163 | [3293473](https://www.openstreetmap.org/relation/3293473) | Terminal 163 | 49 | 100 | 2026-06-19T15:01:19Z |
| 164 | [4463818](https://www.openstreetmap.org/relation/4463818) | Terminal 164 | 40 | 75 | 2026-06-19T15:01:19Z |
| 164 | [4464027](https://www.openstreetmap.org/relation/4464027) | El Bóer | 44 | 78 | 2026-09-11T20:46:54Z |
| 165 | [2739256](https://www.openstreetmap.org/relation/2739256) | Escuela Comunal Las Torres | 48 | 104 | 2026-09-03T22:25:50Z |
| 165 | [4482498](https://www.openstreetmap.org/relation/4482498) | Terminal 165 | 54 | 87 | 2026-06-19T15:01:19Z |
| 167 | [4482796](https://www.openstreetmap.org/relation/4482796) | Mercado Israel Lewites Sur | 60 | 116 | 2026-09-11T20:46:54Z |
| 167 | [4485305](https://www.openstreetmap.org/relation/4485305) | Terminal 167 | 57 | 109 | 2026-06-04T16:11:45Z |
| 168 | [3155254](https://www.openstreetmap.org/relation/3155254) | Terminal Miguel Bonilla | 50 | 169 | 2026-06-04T16:11:45Z |
| 168 | [3199878](https://www.openstreetmap.org/relation/3199878) | Terminal Lomas de Guadalupe | 50 | 173 | 2026-06-04T16:11:45Z |
| 169 | [4501269](https://www.openstreetmap.org/relation/4501269) | Terminal 169 | 41 | 48 | 2026-09-10T15:17:54Z |
| 169 | [4503689](https://www.openstreetmap.org/relation/4503689) | Zona Franca Las Mercedes | 40 | 53 | 2026-07-25T15:58:25Z |
| 170 | [2602495](https://www.openstreetmap.org/relation/2602495) | Terminal 170 | 28 | 93 | 2026-08-05T17:06:09Z |
| 170 | [4508224](https://www.openstreetmap.org/relation/4508224) | Villa José Benito Escobar | 31 | 80 | 2026-02-05T06:30:41Z |
| 172 | [5709563](https://www.openstreetmap.org/relation/5709563) | El Panal | 37 | 94 | 2025-12-19T00:19:53Z |
| 172 | [5709564](https://www.openstreetmap.org/relation/5709564) | Los Brasiles | 39 | 88 | 2025-12-16T04:47:42Z |
| 172CS | [11228556](https://www.openstreetmap.org/relation/11228556) | Entrada a Ciudad Sandino | 12 | 13 | 2026-03-02T07:49:42Z |
| 172CS | [11228557](https://www.openstreetmap.org/relation/11228557) | Terminal Villa Sandino | 13 | 14 | 2025-01-28T20:36:48Z |
| 175 | [4512987](https://www.openstreetmap.org/relation/4512987) | Terminal Los Laureles Norte | 63 | 123 | 2026-06-04T16:11:45Z |
| 175 | [5860303](https://www.openstreetmap.org/relation/5860303) | Terminal Memorial Sandino | 61 | 98 | 2026-06-04T16:11:45Z |
| 195 | [4512869](https://www.openstreetmap.org/relation/4512869) | Parque San Sebastián | 60 | 105 | 2026-05-25T02:31:25Z |
| 195 | [5449249](https://www.openstreetmap.org/relation/5449249) | Terminal 195 | 59 | 93 | 2026-05-12T02:30:37Z |
| 210 | [2665333](https://www.openstreetmap.org/relation/2665333) | Serrano | 37 | 156 | 2026-09-08T23:07:30Z |
| 210 | [5463744](https://www.openstreetmap.org/relation/5463744) | Villa Nueva | 40 | 119 | 2026-09-08T23:07:30Z |
| 262 | [3182542](https://www.openstreetmap.org/relation/3182542) | INATEC | 67 | 121 | 2026-06-04T16:11:45Z |
| 262 | [3201772](https://www.openstreetmap.org/relation/3201772) | Terminal 262 | 59 | 107 | 2026-06-04T16:11:45Z |
| 266 | [2602458](https://www.openstreetmap.org/relation/2602458) | Vidriera | 26 | 84 | 2026-09-10T15:17:54Z |
| 266 | [4553998](https://www.openstreetmap.org/relation/4553998) | Terminal Primero de Mayo | 32 | 84 | 2026-02-19T04:31:07Z |
| 6 | [2607580](https://www.openstreetmap.org/relation/2607580) | Parque Independencia | 63 | 299 | 2026-07-02T10:54:40Z |
| 6 | [2608650](https://www.openstreetmap.org/relation/2608650) | Terminal Barrio Camilo Chamorro | 69 | 243 | 2026-02-20T05:20:06Z |
| ESQ | [5872493](https://www.openstreetmap.org/relation/5872493) | Terminal Esquipulas | 37 | 43 | 2026-09-03T22:25:50Z |
| ESQ | [5872784](https://www.openstreetmap.org/relation/5872784) | Mercado Huembes Suroeste | 33 | 43 | 2026-05-29T06:42:53Z |
| MR4 | [3283256](https://www.openstreetmap.org/relation/3283256) | Villa Roma | 55 | 135 | 2026-09-03T22:25:50Z |
| MR4 | [5453740](https://www.openstreetmap.org/relation/5453740) | Terminal de la MR4 | 59 | 110 | 2025-11-17T21:08:36Z |
| SIS | [5910107](https://www.openstreetmap.org/relation/5910107) | Terminal San Isidro | 26 | 48 | 2026-09-03T23:12:03Z |
| SIS | [5910108](https://www.openstreetmap.org/relation/5910108) | Policía Distrito I Norte | 25 | 49 | 2026-09-03T23:12:03Z |
| VAN | [2941129](https://www.openstreetmap.org/relation/2941129) | Terminal Los Vanegas | 34 | 107 | 2026-05-27T09:13:52Z |
| VAN | [2941503](https://www.openstreetmap.org/relation/2941503) | Terminal Vanegas | 27 | 197 | 2026-05-27T09:13:52Z |
