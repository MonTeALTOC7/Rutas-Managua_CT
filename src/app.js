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
let travel = null, travelLayer, travelWatch = null;
function stopTravel() {
  if (travelWatch !== null) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = null; travel = null; travelLayer?.clearLayers();
  if (journeys && mode === 'journey') renderJourneys();
}
function pauseTravel(message = 'Seguimiento pausado.') {
  if (travelWatch !== null) navigator.geolocation.clearWatch(travelWatch);
  travelWatch = null;
  if (travel) { travel.paused = true; travel.message = message; renderJourneys(); }
}
function startTravel(index) {
  if (!window.isSecureContext || !navigator.geolocation) { tell('El modo viaje necesita GPS y HTTPS o localhost.'); return; }
  const result = journeys?.[direction]?.[selectedResult], leg = result?.legs[index];
  if (!leg) return;
  stopTravel();
  travel = { resultId: result.id, index, line: legGeometry(network, leg), route: leg.routeId,
    stop: network.stops[leg.alightId].name, paused: false, alerted: false, message: 'Esperando ubicación del GPS…' };
  renderJourneys();
  travelWatch = navigator.geolocation.watchPosition(pos => {
    if (!travel || travel.paused) return;
    const p = { lat: pos.coords.latitude, lon: pos.coords.longitude }, accuracy = pos.coords.accuracy;
    const projected = remainingOnLine(p, travel.line);
    travelLayer.clearLayers();
    L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#2377d4', fillOpacity: 1 }).addTo(travelLayer).bindTooltip('Tu ubicación aproximada');
    if (!projected || !Number.isFinite(accuracy) || accuracy > 100 || projected.offset > Math.max(100, accuracy * 2)) {
      travel.message = `Ubicación imprecisa o alejada del trazado (precisión aprox. ${meters(accuracy)}). No se puede estimar la distancia.`;
    } else {
      travel.message = `Aprox. ${meters(projected.remaining)} por el trazado hasta ${travel.stop}. Precisión GPS ±${meters(accuracy)}; separación del trazado ${meters(projected.offset)}.`;
      if (projected.remaining <= 300 && !travel.alerted) {
        travel.alerted = true;
        travel.message += ' Te acercas a la parada de bajada; comprueba tu ubicación.';
        tell(`Te acercas a ${travel.stop}. Comprueba la parada antes de bajar.`, true);
      } else if (travel.alerted && projected.remaining <= 300) travel.message += ' Te acercas a la parada; comprueba tu ubicación.';
      else if (projected.remaining > 500) travel.alerted = false;
    }
    renderJourneys();
  }, error => {
    if (!travel) return;
    pauseTravel(error.code === 1 ? 'Permiso de ubicación denegado. Puedes reanudar tras concederlo.' : 'No se pudo obtener una ubicación. Comprueba el GPS y reanuda.');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && travel && !travel.paused) pauseTravel('Seguimiento pausado al salir de la app. Vuelve a abrirla y reanuda.');
});

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
  stopTravel();
  journeys = null;
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
  direction = 0; selectedResult = 0; $('#plan-button').disabled = false;
  renderJourneys(); drawJourney();
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
        html += `<div class="result-note"><strong>Modo viaje opcional</strong><p>Usa solo tu GPS, con la app abierta. La distancia sigue el trazado histórico; la precisión, los bucles y los cambios de ruta pueden causar errores. Confirma la parada antes de bajar.</p>${result.legs.map((l,i) => `<button type="button" class="button secondary" data-travel="${i}">Seguir tramo ${i + 1} · ${esc(l.routeId)}</button>`).join(' ')}${travel?.resultId === result.id ? `<p role="status">${esc(travel.message)}</p><button type="button" class="button secondary" data-travel-action="${travel.paused ? 'resume' : 'pause'}">${travel.paused ? 'Reanudar' : 'Pausar'}</button> <button type="button" class="button secondary" data-travel-action="stop">Finalizar</button>` : ''}</div>`;
        html += '<div class="result-note">MapaNica / OSM · geometrías 2020 · GTFS finalizado el 31-ene-2023. Revisa la operación y el acceso antes de viajar.</div>';
      }
      html += '</article>';
    });
  }
  $('#journey-results').innerHTML = html;
}
$('#journey-results').addEventListener('click', event => {
  const action = event.target.closest('[data-travel-action]');
  if (action) { if (action.dataset.travelAction === 'pause') pauseTravel(); else if (action.dataset.travelAction === 'resume') startTravel(travel.index); else stopTravel(); return; }
  const follow = event.target.closest('[data-travel]');
  if (follow) { startTravel(Number(follow.dataset.travel)); return; }
  const toggle = event.target.closest('[data-direction]'), result = event.target.closest('[data-result]');
  if (toggle) { stopTravel(); direction = Number(toggle.dataset.direction); selectedResult = 0; renderJourneys(); drawJourney(); }
  if (result) { stopTravel(); selectedResult = Number(result.dataset.result); renderJourneys(); drawJourney(); }
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

let baseLayer, tileFailed = false;
function connectionStatus() {
  const offline = !navigator.onLine;
  if (map && baseLayer) {
    if (offline && map.hasLayer(baseLayer)) map.removeLayer(baseLayer);
    if (!offline && !map.hasLayer(baseLayer)) baseLayer.addTo(map);
  }
  $('#map-status').hidden = !offline && !tileFailed;
  $('#map-status').textContent = offline ? 'Sin conexión: datos guardados; mapa base no disponible.' : 'El mapa base no está respondiendo. Los trazados históricos siguen disponibles.';
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
    map.attributionControl.addAttribution('Rutas: <a href="https://github.com/mapanica/datos">MapaNica</a> / OSM · 2020');
    // Keep OSM attribution even when offline and the tile layer is removed.
    map.attributionControl.addAttribution(config.tileAttribution);
    baseLayer = L.tileLayer(config.tileUrl, { attribution: config.tileAttribution, maxZoom: 19,
      updateWhenIdle: true, keepBuffer: 0, bounds: [[11.95, -86.55], [12.35, -86.05]] });
    baseLayer.on('tileerror', () => { tileFailed = true; connectionStatus(); });
    baseLayer.on('load', () => { /* A partial tile failure remains visible until the next successful connection. */ });
    if (navigator.onLine) baseLayer.addTo(map);
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
    new ResizeObserver(() => map.invalidateSize()).observe($('.map-section'));
    $('#data-summary').textContent = `${network.routes.length} rutas · archivo espacial de 2020`;
    const excluded = network.variants.filter(v => !v.planningEligible).length;
    $('#quality-summary').textContent = `${excluded} variantes tienen inconsistencias de orden o continuidad y se excluyen del planificador. Siguen visibles para consulta, con su advertencia. Las demás tampoco tienen vigencia operativa confirmada.`;
    $('#plan-button').disabled = false;
    connectionStatus(); renderRoutes();
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
