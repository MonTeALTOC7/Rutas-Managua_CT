# Datos espaciales de Rutas Managua

`network.json` es una extracción espacial reproducible del ZIP auditado:

- Productor: MapaNica.net; geodatos de © contribuidores de OpenStreetMap.
- Archivo: [Mobility Database mdb-1021, captura 2024-02-08](https://files.mobilitydatabase.org/mdb-1021/mdb-1021-202402080021/mdb-1021-202402080021.zip).
- SHA-256 de entrada: `72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4`.
- Datos espaciales publicados en 2020-10-27, idénticos en el ZIP actualizado en 2021. Periodo GTFS terminado el 2023-01-31. **No certifican vigencia actual.**
- [Declaración del productor sobre ODbL](https://github.com/mapanica/datos/blob/d34a60369a66bc9ee49633d753222f5b2ce12867/index.html#L213).
- Esta base espacial derivada se ofrece bajo [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), con reconocimiento a MapaNica y OpenStreetMap. Véase también [copyright de OSM](https://www.openstreetmap.org/copyright).

Incluye rutas, coordenadas, nombres/IDs de paradas, jerarquía original de referencia, geometrías, secuencias espaciales únicas y resultados de controles geométricos. No incluye horas, calendarios, frecuencias, ETA ni seguimiento. Los IDs `parent` son referencias de procedencia; las estaciones padre no se usan para inferir transbordos ni se incorporan como puntos de abordaje.

Generación: `python scripts/import_gtfs.py [ruta-al-zip]` desde la raíz del proyecto. El importador rechaza un hash diferente, usa listas explícitas de campos e identifica variantes por ruta, geometría, destino y secuencia. No utiliza un `direction_id` inventado.

Las posiciones proyectadas son auxiliares para cortar un tramo de la geometría publicada; no trasladan ni reemplazan las coordenadas originales de las paradas. Las tolerancias son conservadoras, no una verificación física. Toda variante con orden invertido, una parada a más de 80 m del trazado, un salto entre puntos mayor a 500 m o un aviso de orden del informe auditado queda fuera del cálculo. La app muestra esos conflictos. No corrige automáticamente el archivo original.
