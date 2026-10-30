# Rutas Managua

PWA para consultar rutas de transporte público en Managua desde un origen hasta un destino.

## Alcance inicial

- Buscar rutas por origen y destino.
- Consultar qué rutas pasan cerca de un punto.
- Seleccionar ubicaciones por dirección, GPS o mapa.
- Mostrar trazados, paradas, caminatas y transbordos.
- Calcular por separado el viaje de ida y el de regreso.

La aplicación no ofrecerá horarios, frecuencias ni seguimiento en vivo de buses.

## Primera versión local

PWA estática para explorar **datos históricos**, con mapa, búsqueda de lugares,
paradas cercanas, rutas por número y opciones de viaje por sentido. No acredita
la operación actual de las rutas. Los datos espaciales son de MapaNica/OSM (2020)
y el GTFS archivado termina el 31 de enero de 2023.

Con Node.js 22 o superior:

```sh
npm ci
npm run dev
```

Abrir `http://localhost:4173`. Para comprobar y construir:

```sh
npm test
npm run build
```

El GPS se solicita bajo acción explícita. La búsqueda remota de direcciones es
manual; las sugerencias de paradas son locales. El modo sin conexión conserva
la aplicación y los datos, sin descargar teselas para uso offline.

- [Auditoría de fuentes](docs/AUDITORIA_FUENTES_TRANSPORTE.md).
- [Implementación, pruebas en Android y límites](docs/IMPLEMENTACION_PWA.md).
- [Procedencia y licencia de los datos](public/data/README.md).

La instalación en Android requiere HTTPS o localhost; la documentación explica
cómo probar por USB sin publicar. `npm run dev` construye y sirve, sin recarga
automática. No hay despliegue configurado.
