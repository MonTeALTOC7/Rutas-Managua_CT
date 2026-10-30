import { inArea, normalize } from './planner.js';

// Public Nominatim: explicit submitted searches only. No input handler calls
// this module. Local-only MVP: one user; use an aggregate-limited proxy before
// serving multiple users. Endpoint is runtime configurable in config.json.
export function createGeocoder({ endpoint, fetcher = fetch, storage, now = Date.now, online = () => globalThis.navigator?.onLine !== false }) {
  // Some privacy settings throw on the localStorage getter itself.
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let busy = false;
  let last = 0;
  function read(key) { try { return storage?.getItem(key); } catch { return null; } }
  function write(key, value) { try { storage?.setItem(key, value); } catch { /* Private mode: memory rate limit remains. */ } }
  return async function search(query) {
    const text = query.trim();
    if (text.length < 3) throw new Error('Escribe al menos 3 caracteres para buscar un lugar.');
    const key = `rutas:geocode:${normalize(text)}`;
    let cached;
    try { cached = JSON.parse(read(key)); } catch { cached = null; }
    if (cached?.at > now() - 7 * 86400000 && Array.isArray(cached.results)) {
      return cached.results.filter(p => inArea(p) && typeof p.name === 'string');
    }
    if (!online()) throw new Error('Sin conexión. Busca una parada guardada o elige un punto en el mapa.');
    if (busy || now() - Math.max(last, Number(read('rutas:geocode:last')) || 0) < 1200) {
      throw new Error('Espera un momento antes de hacer otra búsqueda de dirección.');
    }
    const url = new URL(endpoint);
    url.search = new URLSearchParams({ q: text, format: 'jsonv2', limit: '6', countrycodes: 'ni',
      viewbox: '-86.55,12.35,-86.05,11.95', bounded: '1', 'accept-language': 'es' }).toString();
    busy = true;
    last = now();
    write('rutas:geocode:last', String(last));
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(response.status === 429 ? 'El buscador está ocupado. Inténtalo más tarde.' : 'No se pudo consultar el buscador de direcciones.');
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error('El buscador devolvió una respuesta inesperada. Elige en el mapa o inténtalo más tarde.');
      const results = body.filter(p => p && p.lat != null && p.lon != null && typeof p.display_name === 'string')
        .map(p => ({ lat: Number(p.lat), lon: Number(p.lon), name: p.display_name, source: 'OSM / Nominatim' })).filter(inArea);
      // Bound persisted address searches to 20, to avoid unbounded local storage.
      try {
        const entries = Object.keys(storage).filter(k => k.startsWith('rutas:geocode:') && k !== 'rutas:geocode:last');
        if (entries.length >= 20 && !entries.includes(key)) storage.removeItem(entries[0]);
      } catch { /* Optional cache. */ }
      write(key, JSON.stringify({ at: now(), results }));
      return results;
    } finally { busy = false; }
  };
}
