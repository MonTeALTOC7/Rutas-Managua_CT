// No times, reversed lines or proximity-inferred transfers. Each edge follows
// an observed stop sequence and its own spatially checked historical shape.
export function distance(a, b) {
  const rad = Math.PI / 180;
  const lat = (b.lat - a.lat) * rad, lon = (b.lon - a.lon) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const inArea = point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon)
  && point.lat >= 11.95 && point.lat <= 12.35 && point.lon >= -86.55 && point.lon <= -86.05;

export function createNetwork(data) {
  const variants = new Map(data.variants.map(v => [v.id, v]));
  const atStop = new Map();
  for (const variant of data.variants) {
    variant.stops.forEach((id, index) => {
      if (!atStop.has(id)) atStop.set(id, []);
      atStop.get(id).push({ variant, index });
    });
  }
  return { ...data, variantsById: variants, atStop };
}

export function nearby(network, point, radius = 600) {
  return Object.values(network.stops).map(stop => ({ stop, distance: distance(point, stop),
    variants: network.atStop.get(stop.id) || [] }))
    .filter(s => s.distance <= radius).sort((a, b) => a.distance - b.distance);
}

export function searchStops(network, text, limit = 8) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return Object.values(network.stops)
    .filter(s => words.every(w => normalize(s.name).includes(w)))
    .sort((a, b) => a.name.length - b.name.length || a.id.localeCompare(b.id)).slice(0, limit);
}

export function searchRoutes(network, query) {
  const term = normalize(query).replace(/\s+/g, '');
  return network.routes.filter(r => normalize(r.id).includes(term) || normalize(r.name).replace(/\s+/g, '').includes(term))
    .sort((a, b) => (normalize(b.id) === term) - (normalize(a.id) === term)
      || a.id.localeCompare(b.id, 'es', { numeric: true }));
}

function leg(variant, from, to) {
  return { variantId: variant.id, routeId: variant.routeId, from, to,
    boardId: variant.stops[from], alightId: variant.stops[to],
    meters: variant.positions[to].along - variant.positions[from].along };
}

export function plan(network, origin, destination, { radius = 600, transfers = true, limit = 5 } = {}) {
  if (!inArea(origin) || !inArea(destination)) return [];
  const starts = nearby(network, origin, radius);
  const ends = new Map(nearby(network, destination, radius).map(s => [s.stop.id, s.distance]));
  const candidates = new Map();
  function add(legs, access, egress) {
    if (legs.some(l => l.to <= l.from || l.meters <= 1)) return;
    const key = legs.map(l => l.variantId).join('|');
    // Distance-based ordering only, never travel time. Avoid gratuitous detours.
    const score = (access + egress) * 3 + legs.reduce((sum, l) => sum + l.meters, 0) + (legs.length - 1) * 1800;
    const result = { id: legs.map(l => `${l.variantId}@${l.from}-${l.to}`).join('|'), legs, access, egress, score };
    if (!candidates.has(key) || score < candidates.get(key).score) candidates.set(key, result);
  }
  for (const start of starts) {
    for (const { variant: first, index: board } of network.atStop.get(start.stop.id) || []) {
      if (!first.planningEligible) continue;
      for (let exit = board + 1; exit < first.stops.length; exit++) {
        const stopId = first.stops[exit];
        if (ends.has(stopId)) add([leg(first, board, exit)], start.distance, ends.get(stopId));
        if (!transfers) continue;
        for (const { variant: second, index: change } of network.atStop.get(stopId) || []) {
          // Same exact stop_id is the only supported transfer evidence.
          if (!second.planningEligible || second.routeId === first.routeId) continue;
          for (let end = change + 1; end < second.stops.length; end++) {
            if (ends.has(second.stops[end])) {
              add([leg(first, board, exit), leg(second, change, end)], start.distance, ends.get(second.stops[end]));
            }
          }
        }
      }
    }
  }
  return [...candidates.values()].sort((a, b) => a.legs.length - b.legs.length || a.score - b.score).slice(0, limit);
}

export function legGeometry(network, item) {
  const v = network.variantsById.get(item.variantId);
  const a = v.positions[item.from], b = v.positions[item.to];
  if (a.along > b.along || item.from >= item.to) return [];
  return [a.point, ...network.shapes[v.shapeId].slice(a.segment + 1, b.segment + 1), b.point];
}
