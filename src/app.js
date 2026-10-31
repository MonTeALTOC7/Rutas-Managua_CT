import { createNetwork, distance, inArea, nearby, searchStops, searchRoutes, plan, legGeometry } from './planner.js';
import { createGeocoder } from './geocoder.js';
import { remainingOnLine } from './travel.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  bus: '<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2m8-2v2M9 15h.01M15 15h.01M9 6h6"/>',
  route: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h7"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  locate: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
let toastTimer;
function tell(message, persistent = false) {
  clearTimeout(toastTimer);
  $('#status').textContent = message;
  $('#status').hidden = false;
  if (!persistent) toastTimer = setTimeout(() => { $('#status').hidden = true; }, 6500);
}
const meters = n => n < 1000 ? `${Math.round(n)} m` : `${(n / 1000).toFixed(1).replace('.', ',')} km`;
const labels = { origin: 'origen', destination: 'destino', nearby: 'punto de referencia' };
const fields = ['origin', 'destination', 'nearby'];
const points = { origin: null, destination: null, nearby: null };
const revisions = { origin: 0, destination: 0, nearby: 0 };
let mode = 'journey', pick = null, network, map, focusLayer, pointLayer, overview, geocode;
let journeys = null, direction = 0, selectedResult = 0, planRevision = 0;
let currentRoute = null, currentVariant = null;
const JOURNEY_STATE_KEY = 'rutas:journey-state:v1';
const JOURNEY_HISTORY_KEY = 'rutas:journey-history:v1';
let travel = null, travelLayer, travelWatch = null, journeyHistoryId = null;
function getJourneyHistory() {
  try { const items = JSON.parse(localStorage.getItem(JOURNEY_HISTORY_KEY) || '[]'); return Array.isArray(items) ? items : []; }
  catch { return []; }
}
function saveJourneyHistory(items) {
  try { localStorage.setItem(JOURNEY_HISTORY_KEY, JSON.stringify(items.slice(0, 20))); } catch {}
  renderJourneyHistory();
}
function saveJourneyState() {
  if (!journeys || !points.origin || !points.destination) return;
  const point = p => p && ({ lat: p.lat, lon: p.lon, name: p.name, source: p.source });
  const state = {
    origin: point(points.origin), destination: point(points.destination),
    options: { radius: Number($('#walk-radius').value), transfers: $('#transfers').checked },
    direction, selectedResult, historyId: journeyHistoryId,
    travel: travel && { index: travel.index, route: travel.route, stop: travel.stop, alerted: travel.alerted, historyId: travel.historyId, startedAt: travel.startedAt }
  };
  try { localStorage.setItem(JOURNEY_STATE_KEY, JSON.stringify(state)); } catch {}
}
function updateJourneyHistory(status) {
  const items = getJourneyHistory(), item = items.find(value => value.id === journeyHistoryId);
  if (!item) return;
  item.status = status; item.updatedAt = new Date().toISOString(); saveJourneyHistory(items);
}
function rememberJourney(status = 'Consultada') {
  const result = journeys?.[direction]?.[selectedResult];
  if (!result || !points.origin || !points.destination) return;
  const items = getJourneyHistory(), point = p => ({ lat: p.lat, lon: p.lon, name: p.name, source: p.source });
  let item = items.find(value => value.id === journeyHistoryId);
  if (!item) {
    journeyHistoryId = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    item = { id: journeyHistoryId, createdAt: new Date().toISOString() }; items.unshift(item);
  }
  Object.assign(item, {
    origin: point(points.origin), destination: point(points.destination),
    options: { radius: Number($('#walk-radius').value), transfers: $('#transfers').checked },
    direction, selectedResult, routeIds: result.legs.map(leg => leg.routeId),
    legs: result.legs.map(leg => ({ routeId: leg.routeId, board: network.stops[leg.boardId].name, alight: network.stops[leg.alightId].name })),
    status, updatedAt: new Date().toISOString()
  });
  saveJourneyHistory(items);
}
function renderJourneyHistory() {
  const section = $('#journey-history'), list = $('#journey-history-list');
  if (!section || !list) return;
  const items = getJourneyHistory(); section.hidden = !items.length;
  list.innerHTML = items.map(item => {
    const date = new Date(item.updatedAt || item.createdAt).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' });
    return `<article class="history-trip"><div><strong>${esc((item.routeIds || []).join(' → '))}</strong><small>${esc(item.origin?.name)} → ${esc(item.destination?.name)}</small><small>${esc(date)} · ${esc(item.status)}</small></div><button type="button" class="button secondary" data-reopen-trip="${esc(item.id)}">Ver ruta</button></article>`;
  }).join('');
}
function reopenJourney(snapshot) {
  if (!network || !map || !snapshot?.origin || !snapshot?.destination) return;
  if (mode !== 'journey') setMode('journey');
  stopTravel('Interrumpido');
  points.origin = snapshot.origin; points.destination = snapshot.destination;
  for (const field of ['origin', 'destination']) {
    $(`#${field}-input`).value = points[field].name || '';
    $(`[data-field="${field}"].endpoint`).classList.add('chosen');
    $(`#${field}-suggestions`).innerHTML = '';
  }
  $('#walk-radius').value = String(snapshot.options?.radius || 600);
  $('#transfers').checked = snapshot.options?.transfers !== false;
  const options = { radius: Number($('#walk-radius').value), transfers: $('#transfers').checked };
  journeys = [plan(network, points.origin, points.destination, options), plan(network, points.destination, points.origin, options)];
  direction = snapshot.direction === 1 ? 1 : 0;
  selectedResult = Math.min(Number(snapshot.selectedResult) || 0, Math.max(0, journeys[direction].length - 1));
  journeyHistoryId = snapshot.historyId || snapshot.id || null;
  travelLayer?.clearLayers(); renderPoints(); renderJourneys(); drawJourney(); saveJourneyState();
  $('.workspace').classList.remove('map-focus');
  $('#panel-toggle').setAttribute('aria-expanded', 'true');
  $('#panel-toggle-label').textContent = 'Ampliar mapa';
  $('#panel-toggle [data-icon]').innerHTML = icon('expand');
  requestAnimationFrame(() => map.invalidateSize({ pan: false }));
}
function restoreSavedJourney(saved) {
  if (!network || !map || !saved?.origin || !saved?.destination) return false;
  points.origin = saved.origin; points.destination = saved.destination;
  for (const field of ['origin', 'destination']) {
    $(`#${field}-input`).value = points[field].name || '';
    $(`[data-field="${field}"].endpoint`).classList.add('chosen');
  }
  $('#walk-radius').value = String(saved.options?.radius || 600);
  $('#transfers').checked = saved.options?.transfers !== false;
  const options = { radius: Number($('#walk-radius').value), transfers: $('#transfers').checked };
  journeys = [plan(network, points.origin, points.destination, options), plan(network, points.destination, points.origin, options)];
  direction = saved.direction === 1 ? 1 : 0;
  selectedResult = Math.min(Number(saved.selectedResult) || 0, Math.max(0, journeys[direction].length - 1));
  journeyHistoryId = saved.historyId || null;
  if (saved.travel && journeys[direction][selectedResult]?.legs[saved.travel.index]) {
    const leg = journeys[direction][selectedResult].legs[saved.travel.index];
    travel = {
      resultId: journeys[direction][selectedResult].id, index: saved.travel.index,
      line: legGeometry(network, leg), route: leg.routeId, stop: network.stops[leg.alightId].name,
      paused: !(window.RutasAndroidBridge && window.RutasAndroidBridge.isTracking()), alerted: !!saved.travel.alerted,
      historyId: saved.travel.historyId || journeyHistoryId, startedAt: saved.travel.startedAt,
      message: window.RutasAndroidBridge?.isTracking()
        ? 'Seguimiento Android activo en segundo plano; GPS actualizado por el servicio.'
        : 'La app quedó en segundo plano o se cerró. El recorrido está guardado; toca Reanudar para solicitar GPS otra vez.'
    };
    updateJourneyHistory('Interrumpida; lista para reanudar');
  }
  renderPoints(); renderJourneys(); drawJourney(); saveJourneyState();
  return true;
}

function stopTravel(status = 'Finalizado') {
  if (travelWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = null;
  try { window.RutasAndroidBridge?.stopTracking(); } catch {}
  if (travel) updateJourneyHistory(status);
  travel = null; travelLayer?.clearLayers(); saveJourneyState();
  if (journeys && mode === 'journey') renderJourneys();
}
function pauseTravel(message = 'Seguimiento pausado.') {
  if (travelWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = null;
  try { window.RutasAndroidBridge?.stopTracking(); } catch {}
  if (travel) { travel.paused = true; travel.message = message; updateJourneyHistory('Pausado'); saveJourneyState(); renderJourneys(); }
}
function applyTravelPosition(pos) {
  if (!travel || travel.paused) return;
  const lat = Number(pos?.coords?.latitude ?? pos?.lat);
  const lon = Number(pos?.coords?.longitude ?? pos?.lon);
  const accuracy = Number(pos?.coords?.accuracy ?? pos?.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const projected = remainingOnLine({ lat, lon }, travel.line);
  travelLayer.clearLayers();
  L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#2377d4', fillOpacity: 1 }).addTo(travelLayer).bindTooltip('Tu ubicación aproximada');
  if (!projected || !Number.isFinite(accuracy) || accuracy > 100 || projected.offset > Math.max(100, accuracy * 2)) {
    travel.message = `Ubicación imprecisa o alejada del trazado (precisión aprox. ${meters(accuracy)}). No se puede estimar la distancia.`;
  } else {
    travel.message = `Aprox. ${meters(projected.remaining)} por el trazado hasta ${travel.stop}. Precisión GPS ±${meters(accuracy)}; separación del trazado ${meters(projected.offset)}.`;
    if (projected.remaining <= 300 && !travel.alerted) {
      travel.alerted = true;
      travel.message += ' Te acercas a la parada de bajada; comprueba tu ubicación.';
      tell(`Te acercas a ${travel.stop}. Comprueba la parada antes de bajar.`, true);
    } else if (travel.alerted && projected.remaining <= 300) travel.message += ' Te acercas a la parada; comprueba la parada.';
    else if (projected.remaining > 500) travel.alerted = false;
  }
  saveJourneyState(); renderJourneys();
}
window.addEventListener('rutas-android-location', event => applyTravelPosition(event.detail));
window.addEventListener('rutas-android-error', event => {
  if (travel) pauseTravel(event.detail?.message || 'No se pudo iniciar el seguimiento GPS de Android.');
});
function startTravel(index) {
  const native = window.RutasAndroidBridge;
  if (!window.isSecureContext || (!native && !navigator.geolocation)) { tell('El modo viaje necesita GPS y HTTPS o localhost.'); return; }
  const result = journeys?.[direction]?.[selectedResult], leg = result?.legs[index];
  if (!leg) return;
  const resuming = !!travel?.paused && travel.index === index;
  const historyId = resuming ? travel.historyId : journeyHistoryId;
  if (travelWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = null;
  if (travel && !resuming) stopTravel('Interrumpido');
  journeyHistoryId = historyId || journeyHistoryId;
  travel = {
    resultId: result.id, index, line: legGeometry(network, leg), route: leg.routeId,
    stop: network.stops[leg.alightId].name, paused: false, alerted: resuming && !!travel?.alerted,
    historyId: journeyHistoryId, startedAt: resuming ? travel.startedAt : new Date().toISOString(),
    message: 'Esperando ubicación del GPS…'
  };
  rememberJourney('Seguimiento activo'); travel.historyId = journeyHistoryId;
  saveJourneyState(); renderJourneys();
  if (native) {
    try {
      native.startTracking(JSON.stringify(travel.line), travel.stop, travel.route);
      if (native.isTracking()) {
        const latest = JSON.parse(native.getLatestLocation() || 'null');
        if (latest) applyTravelPosition(latest);
      }
    } catch {
      pauseTravel('Android no pudo iniciar el GPS. Revisa los permisos de ubicación y notificaciones.');
    }
    return;
  }
  travelWatch = navigator.geolocation.watchPosition(applyTravelPosition, error => {
    if (!travel) return;
    pauseTravel(error.code === 1 ? 'Permiso de ubicación denegado. Puedes reanudar tras concederlo.' : 'No se pudo obtener una ubicación. Comprueba el GPS y reanuda.');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { saveJourneyState(); return; }
  if (!travel || travel.paused) return;
  const native = window.RutasAndroidBridge;
  if (native) {
    try {
      if (!native.isTracking()) { pauseTravel('El servicio GPS de Android ya no está activo. Toca Reanudar.'); return; }
      const latest = JSON.parse(native.getLatestLocation() || 'null');
      if (latest) applyTravelPosition(latest);
      else { saveJourneyState(); renderJourneys(); }
    } catch { tell('No pudimos recuperar la última ubicación del servicio Android.'); }
    return;
  }
  if (!navigator.geolocation) { pauseTravel('No se pudo recuperar el GPS. Toca Reanudar.'); return; }
  if (travelWatch !== null) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = navigator.geolocation.watchPosition(applyTravelPosition, error => pauseTravel(
    error.code === 1 ? 'Permiso de ubicación denegado. Puedes reanudar tras concederlo.' : 'No se pudo obtener una ubicación. Comprueba el GPS y reanuda.'
  ), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  travel.message = 'GPS solicitado de nuevo al volver. El navegador pudo suspenderlo mientras la pantalla estuvo apagada.';
  saveJourneyState(); renderJourneys();
});
window.addEventListener('pagehide', saveJourneyState);

function trust() { return `<p class="trust-line">${icon('history')}Histórico · vigencia sin confirmar</p>`; }
function renderPoints() {
  if (!pointLayer) return;
  pointLayer.clearLayers();
  for (const field of mode === 'nearby' ? ['nearby'] : ['origin', 'destination']) {
    const p = points[field];
    if (!p) continue;
    const letter = { origin: 'A', destination: 'B', nearby: 'P' }[field];
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="map-point ${field}">${letter}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }) })
      .addTo(pointLayer).bindTooltip(esc(p.name), { direction: 'top', offset: [0, -17] });
  }
}
function clearJourney() {
  stopTravel('Interrumpido');
  journeys = null;
  journeyHistoryId = null;
  try { localStorage.removeItem(JOURNEY_STATE_KEY); } catch {}
  planRevision++;
  $('#plan-button').disabled = !network;
  $('#journey-results').innerHTML = '';
  $('#welcome').hidden = false;
  if (mode === 'journey') { focusLayer?.clearLayers(); $('#map-caption').textContent = 'Red histórica · selecciona una ruta'; }
}
function setPoint(field, point) {
  revisions[field]++;
  points[field] = point;
  $(`#${field}-input`).value = point?.name || '';
  $(`[data-field="${field}"].endpoint`).classList.toggle('chosen', !!point);
  $(`#${field}-suggestions`).innerHTML = '';
  if (field !== 'nearby') clearJourney();
  renderPoints();
  if (field === 'nearby') renderNearby();
}
function stopPoint(stop) { return { ...stop, source: 'Parada del archivo histórico' }; }
function splitGaps(shape) {
  const chunks = [[]];
  shape.forEach((point, i) => {
    if (i && distance({ lat: point[0], lon: point[1] }, { lat: shape[i - 1][0], lon: shape[i - 1][1] }) > 500) chunks.push([]);
    chunks.at(-1).push(point);
  });
  return chunks.filter(chunk => chunk.length >= 2);
}
function fit(pointsToFit) {
  if (!pointsToFit.length) return;
  map.fitBounds(L.latLngBounds(pointsToFit), { padding: [35, 35], maxZoom: 16, animate: false });
}
function stopMarker(stop, color = '#28604d') {
  const marker = L.circleMarker([stop.lat, stop.lon], { radius: 5, color, weight: 2, fillColor: '#fffefa', fillOpacity: 1 }).addTo(focusLayer);
  const content = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = stop.name; content.append(title);
  for (const field of ['origin', 'destination']) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `Usar como ${labels[field]}`;
    button.addEventListener('click', () => { setMode('journey'); setPoint(field, stopPoint(stop)); map.closePopup(); });
    content.append(button);
  }
  marker.bindPopup(content).bindTooltip(esc(stop.name));
  return marker;
}
function setMode(next) {
  if (next !== 'journey' && travel && !travel.paused) pauseTravel('Seguimiento pausado al cambiar de pantalla. Vuelve a Mi viaje y reanuda.');
  mode = next;
  cancelPick();
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === mode);
    button.setAttribute('aria-pressed', String(button.dataset.tab === mode));
  });
  for (const name of ['journey', 'routes', 'nearby']) $(`#${name}-panel`).hidden = name !== mode;
  focusLayer?.clearLayers();
  renderPoints();
  if (!network) return;
  if (mode === 'routes') {
    if (currentRoute) renderRouteDetail(currentRoute); else renderRoutes();
  } else if (mode === 'nearby') renderNearby();
  else if (journeys) { renderJourneys(); drawJourney(); }
  if ((mode === 'journey' && !journeys) || (mode === 'routes' && !currentRoute)) $('#map-caption').textContent = 'Red histórica · selecciona una ruta';
}
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.tab)));

function cancelPick() {
  pick = null; $('#map-prompt').hidden = true; $('.map-section').classList.remove('picking');
}
$('#cancel-pick').addEventListener('click', cancelPick);
document.addEventListener('keydown', event => { if (event.key === 'Escape') cancelPick(); });
document.querySelectorAll('[data-pick]').forEach(button => button.addEventListener('click', () => {
  if (!map) return;
  pick = button.dataset.pick;
  $('#map-prompt-text').textContent = `Toca el mapa para elegir ${labels[pick]}`;
  $('#map-prompt').hidden = false; $('.map-section').classList.add('picking');
  $('#map').scrollIntoView({ block: 'center', behavior: 'auto' });
  $('#map').focus({ preventScroll: true });
}));
document.querySelectorAll('.clear-point').forEach(button => button.addEventListener('click', () => {
  setPoint(button.dataset.field, null); $(`#${button.dataset.field}-input`).focus();
}));

function suggestions(field, values, kind) {
  const box = $(`#${field}-suggestions`); box.innerHTML = '';
  if (!values.length) {
    const p = document.createElement('p'); p.className = 'suggestion-message';
    p.textContent = kind === 'local' ? 'Sin paradas con ese nombre. Pulsa Buscar para consultar direcciones o elige en el mapa.' : 'No encontramos ese lugar en el área. Prueba otra referencia o elige en el mapa.';
    box.append(p); return;
  }
  for (const value of values) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion';
    const caption = kind === 'local' ? `Parada histórica · ${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}` : 'Lugar en OpenStreetMap · comprueba su posición';
    button.innerHTML = `${esc(value.name)}<small>${esc(caption)}</small>`;
    button.addEventListener('click', () => {
      setPoint(field, value); map.setView([value.lat, value.lon], 15, { animate: false });
      tell(`${labels[field][0].toUpperCase() + labels[field].slice(1)} seleccionado.`);
    }); box.append(button);
  }
}
async function addressSearch(field) {
  if (!geocode) return;
  const text = $(`#${field}-input`).value.trim();
  const revision = ++revisions[field];
  const button = $(`[data-address="${field}"]`); button.disabled = true;
  try {
    const values = await geocode(text);
    if (revisions[field] !== revision) return;
    suggestions(field, values, 'remote');
  } catch (error) {
    if (revisions[field] === revision) tell(error.name === 'TimeoutError' ? 'La búsqueda tardó demasiado. Prueba otra vez o elige en el mapa.' : error.name === 'TypeError' ? 'El buscador no respondió. Comprueba tu conexión o elige el punto en el mapa.' : error.message || 'No pudimos consultar esa dirección.');
  } finally { button.disabled = false; }
}
for (const field of fields) {
  const input = $(`#${field}-input`);
  input.addEventListener('input', () => {
    revisions[field]++; points[field] = null; $(`[data-field="${field}"].endpoint`).classList.remove('chosen'); renderPoints();
    if (field !== 'nearby') clearJourney(); else renderNearby();
    if (network && input.value.trim().length >= 2) suggestions(field, searchStops(network, input.value).map(stopPoint), 'local');
    else $(`#${field}-suggestions`).innerHTML = '';
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addressSearch(field); } });
}
document.querySelectorAll('[data-address]').forEach(button => button.addEventListener('click', () => addressSearch(button.dataset.address)));
document.querySelectorAll('[data-gps]').forEach(button => button.addEventListener('click', () => {
  if (!network || !map) { tell('Espera a que termine de cargar el mapa.'); return; }
  if (!navigator.geolocation || !window.isSecureContext) { tell('El GPS necesita HTTPS o localhost. También puedes elegir el punto en el mapa.'); return; }
  const field = button.dataset.gps;
  const revision = ++revisions[field]; button.disabled = true; tell('Solicitando tu ubicación…');
  navigator.geolocation.getCurrentPosition(position => {
    button.disabled = false;
    if (revisions[field] !== revision) return;
    const p = { lat: position.coords.latitude, lon: position.coords.longitude, name: 'Mi ubicación', source: 'GPS' };
    if (!inArea(p)) { tell('Tu ubicación está fuera del área de Managua y Ciudad Sandino. Elige un punto dentro del mapa.'); return; }
    setPoint(field, p); map.setView([p.lat, p.lon], 15, { animate: false });
    tell(`Ubicación elegida. Precisión aproximada: ${meters(position.coords.accuracy)}. Comprueba el punto.`);
  }, error => {
    button.disabled = false;
    if (revisions[field] !== revision) return;
    tell(error.code === 1 ? 'No se permitió usar el GPS. Puedes buscar un lugar o tocar el mapa.' : 'No pudimos obtener tu ubicación. Prueba de nuevo o usa el mapa.');
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
}));

$('#journey-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!network) return;
  if (!points.origin || !points.destination) { tell('Elige una coincidencia para el origen y el destino, usa el GPS o toca el mapa.'); return; }
  if (distance(points.origin, points.destination) < 30) { tell('El origen y el destino están prácticamente en el mismo punto. Elige lugares distintos.'); return; }
  const revision = ++planRevision; $('#plan-button').disabled = true;
  await new Promise(resolve => setTimeout(resolve, 0));
  if (planRevision !== revision) return;
  const options = { radius: Number($('#walk-radius').value), transfers: $('#transfers').checked };
  // Compute both independently, even if one direction produces no candidates.
  journeys = [plan(network, points.origin, points.destination, options), plan(network, points.destination, points.origin, options)];
  direction = 0; selectedResult = 0; journeyHistoryId = null; $('#plan-button').disabled = false;
  if (journeys[0].length) rememberJourney('Consultada');
  renderJourneys(); drawJourney(); saveJourneyState();
});
$('#walk-radius').addEventListener('change', clearJourney);
$('#transfers').addEventListener('change', clearJourney);

function renderJourneys() {
  if (!journeys) return;
  $('#welcome').hidden = true;
  const results = journeys[direction];
  const start = direction ? points.destination : points.origin, end = direction ? points.origin : points.destination;
  let html = `<div class="direction-switch" aria-label="Sentido del viaje"><button type="button" data-direction="0" class="${direction === 0 ? 'active' : ''}" aria-pressed="${direction === 0}">Ida · ${journeys[0].length} opciones</button><button type="button" data-direction="1" class="${direction === 1 ? 'active' : ''}" aria-pressed="${direction === 1}">Regreso · ${journeys[1].length} opciones</button></div>
    <p class="hint">${esc(start.name)} → ${esc(end.name)}</p>${trust()}`;
  if (!results.length) html += '<div class="empty-state"><strong>No hay una conexión justificable con estos datos.</strong>Prueba otros puntos o amplía el radio. Algunas variantes están excluidas por inconsistencias. Esto no significa que no exista un servicio actual.</div>';
  else {
    html += `<div class="results-heading"><h2>Opciones del archivo</h2><small>Directas primero</small></div>`;
    results.forEach((result, index) => {
      const active = index === selectedResult;
      html += `<article class="result-card ${active ? 'selected' : ''}"><button type="button" data-result="${index}" class="result-header" aria-expanded="${active}" aria-label="Ver opción ${index + 1}, rutas ${esc(result.legs.map(l => l.routeId).join(' y '))}"><span class="route-chain">${result.legs.map(l => `<span class="route-badge">${esc(l.routeId)}</span>`).join(icon('arrow'))}</span><small>${result.legs.length === 1 ? 'Ruta directa' : '1 transbordo'}<br>${meters(result.access + result.egress)} de acceso aprox.</small></button>`;
      if (active) {
        html += '<div class="steps">';
        result.legs.forEach((leg, i) => {
          const v = network.variantsById.get(leg.variantId), board = network.stops[leg.boardId], alight = network.stops[leg.alightId];
          if (i) html += `<div class="step transfer"><strong>Cambia a la ruta ${esc(leg.routeId)}</strong><small>Mismo identificador de parada en ambos recorridos. Transbordo actual sin confirmar.</small></div>`;
          html += `<div class="step"><strong>Aborda la ${esc(leg.routeId)} en ${esc(board.name)}</strong><small>Sentido: ${esc(network.stops[v.stops[0]].name)} → ${esc(network.stops[v.stops.at(-1)].name)}</small><small>Rótulo del archivo: ${esc(v.headsign)}. Confírmalo al abordar.</small>${i === 0 ? `<small>Origen a parada: ${meters(result.access)} en línea recta; camino a pie por comprobar.</small>` : ''}</div>`;
          html += `<div class="step"><strong>Baja en ${esc(alight.name)}</strong><small>${leg.to - leg.from} tramos entre paradas en este sentido.</small>${i === result.legs.length - 1 ? `<small>Parada a destino: ${meters(result.egress)} en línea recta; camino a pie por comprobar.</small>` : ''}</div>`;
        });
        html += '</div>';
        html += `<div class="result-note"><strong>Modo viaje opcional</strong><p>El GPS funciona mientras la app está visible. Android puede suspenderlo al apagar la pantalla; el navegador no garantiza seguimiento continuo en segundo plano. La ruta se guarda en este dispositivo para reanudar al volver. Para GPS continuo con pantalla apagada hace falta una app Android con servicio en primer plano y notificación permanente. Confirma la parada antes de bajar.</p>${result.legs.map((l,i) => `<button type="button" class="button secondary" data-travel="${i}">Seguir tramo ${i + 1} · ${esc(l.routeId)}</button>`).join(' ')}${travel?.resultId === result.id ? `<p role="status">${esc(travel.message)}</p><button type="button" class="button secondary" data-travel-action="${travel.paused ? 'resume' : 'pause'}">${travel.paused ? 'Reanudar' : 'Pausar'}</button> <button type="button" class="button secondary" data-travel-action="stop">Finalizar</button>` : ''}</div>`;
        html += '<div class="result-note">MapaNica / OSM · geometrías 2020 · GTFS finalizado el 31-ene-2023. Revisa la operación y el acceso antes de viajar.</div>';
      }
      html += '</article>';
    });
  }
  $('#journey-results').innerHTML = html;
  renderJourneyHistory();
}
$('#journey-history').addEventListener('click', event => {
  const button = event.target.closest('[data-reopen-trip]');
  if (button) {
    const item = getJourneyHistory().find(value => value.id === button.dataset.reopenTrip);
    if (item) reopenJourney(item);
  }
});
$('#clear-journey-history').addEventListener('click', () => {
  saveJourneyHistory([]); journeyHistoryId = null;
  tell('Historial de recorridos borrado de este dispositivo.');
});
$('#journey-results').addEventListener('click', event => {
  const action = event.target.closest('[data-travel-action]');
  if (action) { if (action.dataset.travelAction === 'pause') pauseTravel(); else if (action.dataset.travelAction === 'resume') startTravel(travel.index); else stopTravel('Finalizado'); return; }
  const follow = event.target.closest('[data-travel]');
  if (follow) { startTravel(Number(follow.dataset.travel)); return; }
  const toggle = event.target.closest('[data-direction]'), result = event.target.closest('[data-result]');
  if (toggle) { stopTravel('Interrumpido'); direction = Number(toggle.dataset.direction); selectedResult = 0; rememberJourney('Ruta elegida'); renderJourneys(); drawJourney(); saveJourneyState(); }
  if (result) { stopTravel('Interrumpido'); selectedResult = Number(result.dataset.result); rememberJourney('Ruta elegida'); renderJourneys(); drawJourney(); saveJourneyState(); }
});
function drawJourney() {
  focusLayer.clearLayers();
  const result = journeys?.[direction]?.[selectedResult];
  if (!result) { $('#map-caption').textContent = 'Sin conexión de bus justificable en este sentido'; return; }
  const bounds = [];
  result.legs.forEach((leg, i) => {
    const color = i ? '#a46720' : '#145c46';
    const line = legGeometry(network, leg); bounds.push(...line);
    L.polyline(line, { color: '#fffefa', weight: 9, opacity: .9 }).addTo(focusLayer);
    L.polyline(line, { color, weight: 5, opacity: 1 }).addTo(focusLayer);
    stopMarker(network.stops[leg.boardId], color); stopMarker(network.stops[leg.alightId], color);
  });
  bounds.push([points.origin.lat, points.origin.lon], [points.destination.lat, points.destination.lon]);
  fit(bounds);
  $('#map-caption').textContent = `${direction ? 'Regreso' : 'Ida'} · ${result.legs.map(l => l.routeId).join(' → ')} · trazado histórico`;
}

function renderRoutes() {
  currentRoute = null; currentVariant = null;
  $('#route-detail').innerHTML = ''; $('#route-list').hidden = false; $('#routes-count').hidden = false;
  const values = searchRoutes(network, $('#route-query').value);
  $('#routes-count').textContent = `${values.length} ${values.length === 1 ? 'ruta' : 'rutas'} del archivo · 2020`;
  $('#route-list').innerHTML = values.length ? values.map(route => {
    const variants = network.variants.filter(v => v.routeId === route.id);
    return `<button type="button" class="route-row" data-route="${esc(route.id)}"><span class="route-badge">${esc(route.id)}</span><span><strong>${esc(route.name)}</strong><small>${esc(variants.map(v => v.headsign).join(' / '))}</small></span>${icon('arrow')}</button>`;
  }).join('') : '<div class="empty-state">No encontramos esa ruta en el archivo. Prueba con su número o nombre.</div>';
}
$('#route-query').addEventListener('input', () => { if (network) { focusLayer.clearLayers(); renderRoutes(); $('#map-caption').textContent = 'Red histórica · selecciona una ruta'; } });
$('#route-list').addEventListener('click', event => {
  const button = event.target.closest('[data-route]'); if (button) renderRouteDetail(button.dataset.route);
});
function renderRouteDetail(routeId) {
  currentRoute = routeId;
  $('#route-list').hidden = true; $('#routes-count').hidden = true;
  const variants = network.variants.filter(v => v.routeId === routeId);
  if (!variants.some(v => v.id === currentVariant)) currentVariant = variants[0].id;
  $('#route-detail').innerHTML = `<button type="button" class="back-button" data-back>${icon('arrow')}Todas las rutas</button><h2><span class="route-badge">${esc(routeId)}</span> Sus sentidos, por separado</h2>${trust()}${routeId === '110' ? '<p class="warning">La web de 2016 indica «El Seminario»; este archivo indica «Aldea SOS». La diferencia sigue pendiente de revisión.</p>' : ''}${variants.map((v, i) => `<article class="variant-card ${v.id === currentVariant ? 'selected' : ''}"><button type="button" class="variant-title" data-variant="${esc(v.id)}" aria-pressed="${v.id === currentVariant}">Sentido ${i + 1}: ${esc(network.stops[v.stops[0]].name)} → ${esc(network.stops[v.stops.at(-1)].name)}</button><small>${v.stops.length} entradas de parada · ${esc(v.shapeId)}</small>${v.issues.length ? `<p class="warning">Solo consulta, excluido del cálculo: ${esc(v.issues.join('. '))}.</p>` : '<small>Secuencia utilizable para comparación histórica. Servicio sin confirmar.</small>'}<details><summary>Ver paradas en orden</summary><ol class="stop-list">${v.stops.map(id => `<li><button type="button" data-stop="${esc(id)}">${esc(network.stops[id].name)}</button></li>`).join('')}</ol></details></article>`).join('')}`;
  drawVariant(network.variantsById.get(currentVariant));
}
$('#route-detail').addEventListener('click', event => {
  if (event.target.closest('[data-back]')) { focusLayer.clearLayers(); renderRoutes(); }
  const v = event.target.closest('[data-variant]'); if (v) { currentVariant = v.dataset.variant; renderRouteDetail(currentRoute); }
  const s = event.target.closest('[data-stop]'); if (s) { const stop = network.stops[s.dataset.stop]; map.setView([stop.lat, stop.lon], 17); stopMarker(stop).openPopup(); $('#map').scrollIntoView({ block: 'center' }); }
});
function drawVariant(v) {
  focusLayer.clearLayers();
  const shape = network.shapes[v.shapeId];
  const chunks = splitGaps(shape);
  L.polyline(chunks, { color: v.planningEligible ? '#175c48' : '#9c7433', weight: 5, opacity: .95, dashArray: v.planningEligible ? null : '7 6' }).addTo(focusLayer);
  v.stops.forEach(id => stopMarker(network.stops[id])); fit(shape);
  $('#map-caption').textContent = `Ruta ${v.routeId} · ${v.planningEligible ? 'trazado histórico' : 'inconsistencias · solo consulta'}`;
}
$('#use-map-center').addEventListener('click', () => {
  if (!map) return;
  const p = map.getCenter(); setPoint('nearby', { lat: p.lat, lon: p.lng, name: 'Centro del mapa', source: 'Selección manual' });
});
function renderNearby() {
  if (!network || mode !== 'nearby') return;
  focusLayer.clearLayers();
  if (!points.nearby) { $('#nearby-results').innerHTML = '<div class="empty-state">Elige un punto para ver sus paradas cercanas. El GPS solo se activa si lo solicitas.</div>'; return; }
  const matches = nearby(network, points.nearby, 600);
  L.circle([points.nearby.lat, points.nearby.lon], { radius: 600, color: '#859f52', weight: 1, fillOpacity: .07 }).addTo(focusLayer);
  matches.slice(0, 30).forEach(m => stopMarker(m.stop));
  let html = `<div class="results-heading"><h2>${matches.length} paradas a menos de 600 m</h2></div><p class="hint">Distancia en línea recta; no confirma acceso a pie. Se muestran hasta 30 paradas, de la más cercana a la más lejana.</p>${trust()}`;
  html += matches.length ? matches.slice(0, 30).map(m => `<article class="near-stop"><div class="near-stop-head"><button type="button" data-near-stop="${esc(m.stop.id)}">${esc(m.stop.name)}</button><small>${meters(m.distance)}</small></div><div class="near-routes">${[...new Set(m.variants.map(x => x.variant.routeId))].sort((a,b) => a.localeCompare(b, 'es', { numeric: true })).map(id => `<button type="button" data-near-route="${esc(id)}">${esc(id)}</button>`).join('')}</div><details><summary>Sentidos registrados</summary>${m.variants.map(({ variant, index }) => `<p>${esc(variant.routeId)} → ${esc(network.stops[variant.stops.at(-1)].name)}${index === variant.stops.length - 1 ? ' · última parada de este sentido' : ''}${variant.planningEligible ? '' : ' · solo consulta'}</p>`).join('')}</details></article>`).join('') : '<div class="empty-state">No hay paradas registradas a menos de 600 m. Elige otro punto. El archivo puede estar incompleto o desactualizado.</div>';
  $('#nearby-results').innerHTML = html;
  $('#map-caption').textContent = 'Paradas históricas · radio de 600 m';
}
$('#nearby-results').addEventListener('click', event => {
  const r = event.target.closest('[data-near-route]'); if (r) { currentRoute = r.dataset.nearRoute; setMode('routes'); }
  const s = event.target.closest('[data-near-stop]'); if (s) { const stop = network.stops[s.dataset.nearStop]; map.setView([stop.lat, stop.lon], 17); stopMarker(stop).openPopup(); }
});

function openSources(event) { event?.preventDefault(); $('#sources-dialog').showModal(); }
for (const id of ['sources-open', 'history-details', 'footer-sources']) $(`#${id}`).addEventListener('click', openSources);
$('#sources-close').addEventListener('click', () => $('#sources-dialog').close());
$('#sources-dialog').addEventListener('click', event => { if (event.target === $('#sources-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('#clear-search-cache').addEventListener('click', () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('rutas:geocode:') && k !== 'rutas:geocode:last').forEach(k => localStorage.removeItem(k)); tell('Búsquedas de direcciones borradas.'); }
  catch { tell('Este navegador no permite acceder al almacenamiento local.'); }
});
let installEvent;
const installBanner = $('#install-banner');
const installDialog = $('#install-dialog');
function isInstalledApp() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
function installDismissed() {
  try { return sessionStorage.getItem('rutas:install-dismissed') === '1'; } catch { return false; }
}
function showInstallBanner() {
  if (!isInstalledApp() && !installDismissed()) installBanner.hidden = false;
}
function dismissInstallBanner() {
  installBanner.hidden = true;
  try { sessionStorage.setItem('rutas:install-dismissed', '1'); } catch {}
}
function showInstallInstructions() {
  const platform = navigator.userAgent || '';
  const instructions = $('#install-instructions');
  if (/iPhone|iPad|iPod/i.test(platform)) {
    instructions.textContent = 'En iPhone o iPad: abre esta página en Safari, toca Compartir y elige «Añadir a pantalla de inicio».';
  } else if (/Android/i.test(platform)) {
    instructions.textContent = 'En Brave para Android: abre el menú ⋮ y selecciona «Instalar aplicación» o «Añadir a pantalla principal».';
  } else {
    instructions.textContent = 'En Brave para computadora: abre el menú ⋮, entra en «Guardar y compartir» y selecciona «Instalar Rutas Managua». También puedes usar el ícono de instalación que aparece en la barra de direcciones.';
  }
  if (installDialog?.showModal) installDialog.showModal();
  else tell(instructions.textContent, true);
}
async function requestInstall() {
  if (!installEvent) { showInstallInstructions(); return; }
  const promptEvent = installEvent;
  installEvent = null;
  try {
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result?.outcome === 'accepted') dismissInstallBanner();
    else tell('La instalación quedó pendiente. Puedes intentarlo de nuevo desde «Instalar».');
  } catch {
    showInstallInstructions();
  }
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
  showInstallBanner();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  installBanner.hidden = true;
  $('#install').hidden = true;
  if (installDialog.open) installDialog.close();
  tell('Rutas Managua está instalada.');
});
$('#install').addEventListener('click', requestInstall);
$('#install-banner-action').addEventListener('click', requestInstall);
$('#install-banner-close').addEventListener('click', dismissInstallBanner);
$('#install-close').addEventListener('click', () => installDialog.close());
$('#install-done').addEventListener('click', () => installDialog.close());
installDialog.addEventListener('click', event => {
  if (event.target === installDialog) installDialog.close();
});
$('#update-dismiss').addEventListener('click', () => { $('#update-notice').hidden = true; });
if (isInstalledApp()) {
  $('#install').hidden = true;
  installBanner.hidden = true;
} else {
  setTimeout(showInstallBanner, 1400);
}

let baseLayer, referenceLayers = [], tileFailed = false;
function connectionStatus() {
  const offline = !navigator.onLine;
  if (map && baseLayer) {
    if (offline) {
      if (map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
      referenceLayers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
    } else {
      if (!map.hasLayer(baseLayer)) baseLayer.addTo(map);
      if ($('#map-base-selector')?.value === 'satellite') {
        referenceLayers.forEach(layer => { if (!map.hasLayer(layer)) layer.addTo(map); });
      }
    }
  }
  $('#map-status').hidden = !offline && !tileFailed;
  const baseName = $('#map-base-selector')?.value === 'satellite' ? 'satélite Esri' : 'calles OSM';
  $('#map-status').textContent = offline ? 'Sin conexión: trazados históricos disponibles; mapa base no disponible.' : `No se pudo cargar el mapa de ${baseName}. Los trazados históricos siguen visibles.`;
}
window.addEventListener('offline', connectionStatus);
window.addEventListener('online', () => { tileFailed = false; connectionStatus(); });

async function start() {
  try {
    const [configResponse, dataResponse] = await Promise.all([fetch('./config.json'), fetch('./data/network.json')]);
    if (!configResponse.ok || !dataResponse.ok) throw new Error('No se pudo cargar el archivo de rutas.');
    const [config, data] = await Promise.all([configResponse.json(), dataResponse.json()]);
    network = createNetwork(data);
    geocode = createGeocoder({ endpoint: config.geocoderUrl });
    map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 11, maxZoom: 18,
      maxBounds: [[11.95, -86.55], [12.35, -86.05]], maxBoundsViscosity: .9 }).setView([12.140, -86.284], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('Rutas históricas: <a href="https://github.com/mapanica/datos">MapaNica</a> / OSM · 2020');
    const tileOptions = { maxZoom: 19, updateWhenIdle: true, keepBuffer: 0, bounds: [[11.95, -86.55], [12.35, -86.05]] };
    const baseLayers = {
      streets: L.tileLayer(config.tileUrl, { ...tileOptions, attribution: config.tileAttribution }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        ...tileOptions,
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Vantor, Earthstar Geographics, and GIS User Community'
      })
    };
    // Transparent Esri reference tiles add street names and place labels over imagery.
    referenceLayers = [
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        ...tileOptions,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Esri, HERE, Garmin'
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        ...tileOptions,
        attribution: 'Esri, HERE, Garmin, and GIS user community'
      })
    ];
    for (const [name, layer] of Object.entries(baseLayers)) {
      layer.on('tileerror', () => {
        if (baseLayer !== layer) return;
        tileFailed = true;
        connectionStatus();
      });
      layer.on('load', () => { if (baseLayer === layer) tileFailed = false; });
    }
    let initialBase = 'streets';
    try { initialBase = localStorage.getItem('rutas:map-base') || 'streets'; } catch {}
    if (!baseLayers[initialBase]) initialBase = 'streets';
    baseLayer = baseLayers[initialBase];
    $('#map-base-selector').value = initialBase;
    map.getContainer().classList.toggle('basemap-satellite', initialBase === 'satellite');
    $('#map-base-selector').addEventListener('change', event => {
      const nextName = event.target.value;
      if (!baseLayers[nextName]) return;
      if (map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
      referenceLayers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
      baseLayer = baseLayers[nextName];
      map.getContainer().classList.toggle('basemap-satellite', nextName === 'satellite');
      tileFailed = false;
      try { localStorage.setItem('rutas:map-base', nextName); } catch {}
      if (navigator.onLine) {
        baseLayer.addTo(map);
        if (nextName === 'satellite') referenceLayers.forEach(layer => layer.addTo(map));
      }
      connectionStatus();
    });
    if (navigator.onLine) {
      baseLayer.addTo(map);
      if (initialBase === 'satellite') referenceLayers.forEach(layer => layer.addTo(map));
    }
    overview = L.layerGroup().addTo(map); focusLayer = L.layerGroup().addTo(map); pointLayer = L.layerGroup().addTo(map); travelLayer = L.layerGroup().addTo(map);
    for (const shape of Object.values(network.shapes)) L.polyline(splitGaps(shape), { color: '#41705b', weight: 2, opacity: .20, interactive: false }).addTo(overview);
    map.on('click', event => {
      const p = { lat: event.latlng.lat, lon: event.latlng.lng, name: `Punto del mapa (${event.latlng.lat.toFixed(4)}, ${event.latlng.lng.toFixed(4)})`, source: 'Selección manual' };
      if (!inArea(p)) { tell('Selecciona un punto dentro del área de Managua y Ciudad Sandino.'); return; }
      if (pick) { const field = pick; cancelPick(); setPoint(field, p); tell(`${labels[field][0].toUpperCase() + labels[field].slice(1)} seleccionado en el mapa.`); }
      else {
        const content = document.createElement('div'); content.textContent = 'Usar este punto como:';
        for (const field of fields) { const button = document.createElement('button'); button.type = 'button'; button.textContent = field === 'nearby' ? 'Consultar paradas cercanas' : labels[field];
          button.addEventListener('click', () => { setMode(field === 'nearby' ? 'nearby' : 'journey'); setPoint(field, p); map.closePopup(); }); content.append(button); }
        L.popup().setLatLng(event.latlng).setContent(content).openOn(map);
      }
    });
    $('#map-home').addEventListener('click', () => map.fitBounds([[12.05, -86.43], [12.22, -86.15]], { animate: false }));
    const workspace = $('.workspace');
    $('#panel-toggle').addEventListener('click', () => {
      const mapFocused = workspace.classList.toggle('map-focus');
      $('#panel-toggle').setAttribute('aria-expanded', String(!mapFocused));
      $('#panel-toggle-label').textContent = mapFocused ? 'Volver al recorrido' : 'Ampliar mapa';
      $('#panel-toggle [data-icon]').innerHTML = icon(mapFocused ? 'route' : 'expand');
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    matchMedia('(max-width: 760px)').addEventListener('change', event => {
      if (!event.matches && workspace.classList.contains('map-focus')) {
        workspace.classList.remove('map-focus');
        $('#panel-toggle').setAttribute('aria-expanded', 'true');
        $('#panel-toggle-label').textContent = 'Ampliar mapa';
        $('#panel-toggle [data-icon]').innerHTML = icon('expand');
        requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      }
    });
    new ResizeObserver(() => map.invalidateSize()).observe($('.map-section'));
    $('#data-summary').textContent = `${network.routes.length} rutas · archivo espacial de 2020`;
    const excluded = network.variants.filter(v => !v.planningEligible).length;
    $('#quality-summary').textContent = `${excluded} variantes tienen inconsistencias de orden o continuidad y se excluyen del planificador. Siguen visibles para consulta, con su advertencia. Las demás tampoco tienen vigencia operativa confirmada.`;
    $('#plan-button').disabled = false;
    connectionStatus(); renderRoutes(); renderJourneyHistory();
    try {
      const saved = JSON.parse(localStorage.getItem(JOURNEY_STATE_KEY) || 'null');
      if (saved && restoreSavedJourney(saved)) tell('Restauramos tu último recorrido desde este dispositivo.');
    } catch {}
    if ('serviceWorker' in navigator && window.isSecureContext) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) $('#update-notice').hidden = false;
          });
        });
        if (registration.waiting && navigator.serviceWorker.controller) $('#update-notice').hidden = false;
        await navigator.serviceWorker.ready;
        $('#data-summary').textContent = `${network.routes.length} rutas · archivo disponible sin conexión`;
      } catch { tell('La app funciona, pero no se pudo preparar el acceso sin conexión.'); }
    }
  } catch (error) {
    $('#data-summary').textContent = 'No se pudieron cargar los datos';
    $('#welcome').innerHTML = `<h2>No pudimos iniciar la app</h2><p>${esc(error.message)}</p><p>Comprueba la conexión y vuelve a cargar. La primera visita requiere conexión.</p><button type="button" class="button secondary" id="retry-load">Reintentar</button>`;
    $('#retry-load').addEventListener('click', () => location.reload());
  }
}
start();
