"""Extract only spatial, attributable data from the exact audited GTFS.

Usage: python scripts/import_gtfs.py [path/to/feed.zip]
Without an argument, download the immutable snapshot into .cache (ignored).
No service times, trip counts, calendars or frequencies enter the app dataset.
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import urllib.request
import zipfile
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent
URL = "https://files.mobilitydatabase.org/mdb-1021/mdb-1021-202402080021/mdb-1021-202402080021.zip"
SHA = "72b87bf81724b0ccac805acd40532afd70b3a4f5a3ee3758dd7b8efff64427b4"
KNOWN_ORDER_WARNINGS = {"5450896", "5910108", "5910107", "2602869", "3155254", "4482498", "2941129"}
# Local metric approximation is used only for conservative quality checks.
X = 111320 * math.cos(math.radians(12.15))
Y = 111320


def metric(a, b):
    return math.hypot((a[1] - b[1]) * X, (a[0] - b[0]) * Y)


def project(point, shape, cumulative):
    best = (float("inf"), 0, 0.0, shape[0])
    for i, (a, b) in enumerate(zip(shape, shape[1:])):
        dx, dy = (b[1] - a[1]) * X, (b[0] - a[0]) * Y
        px, py = (point[1] - a[1]) * X, (point[0] - a[0]) * Y
        t = max(0, min(1, (px * dx + py * dy) / (dx * dx + dy * dy))) if dx or dy else 0
        q = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
        dist = metric(point, q)
        if dist < best[0]:
            best = (dist, i, cumulative[i] + t * metric(a, b), q)
    return {"offset": round(best[0], 1), "segment": best[1], "along": round(best[2], 1),
            "point": [round(c, 7) for c in best[3]]}


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".cache/feed.zip"
    if not path.exists() and len(sys.argv) == 1:
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(URL, headers={"User-Agent": "RutasManaguaSpatialImporter/0.1"})
        with urllib.request.urlopen(request, timeout=120) as response:
            path.write_bytes(response.read())
    content = path.read_bytes()
    if hashlib.sha256(content).hexdigest() != SHA:
        raise ValueError("El archivo no coincide con el ZIP auditado; no se importó.")
    archive = zipfile.ZipFile(io.BytesIO(content))

    def rows(name):
        return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding="utf-8-sig"))

    routes = {r["route_id"]: {"id": r["route_id"], "name": r["route_long_name"]} for r in rows("routes.txt")}
    stops = {s["stop_id"]: {"id": s["stop_id"], "name": s["stop_name"],
              "lat": float(s["stop_lat"]), "lon": float(s["stop_lon"]), "parent": s.get("parent_station", "")}
             for s in rows("stops.txt") if s["location_type"] == "0"}
    trips = {t["trip_id"]: (t["route_id"], t["shape_id"], t["trip_headsign"]) for t in rows("trips.txt")}
    sequences = defaultdict(list)
    for r in rows("stop_times.txt"):
        sequences[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"]))
    patterns = defaultdict(set)
    for trip, seq in sequences.items():
        patterns[trips[trip]].add(tuple(s for _, s in sorted(seq)))
    raw_shapes = defaultdict(list)
    for s in rows("shapes.txt"):
        raw_shapes[s["shape_id"]].append((int(s["shape_pt_sequence"]), float(s["shape_pt_lat"]), float(s["shape_pt_lon"])))
    shapes = {sid: [[lat, lon] for _, lat, lon in sorted(points)] for sid, points in raw_shapes.items()}
    variants = []
    for (route, shape_id, headsign), values in sorted(patterns.items()):
        for index, seq in enumerate(sorted(values)):
            shape = shapes[shape_id]
            cumulative = [0.0]
            for a, b in zip(shape, shape[1:]):
                cumulative.append(cumulative[-1] + metric(a, b))
            positions = [project([stops[s]["lat"], stops[s]["lon"]], shape, cumulative) for s in seq]
            issues = []
            if shape_id.split("/")[-1] in KNOWN_ORDER_WARNINGS:
                issues.append("Orden de paradas señalado por el validador del archivo")
            if any(p["offset"] > 80 for p in positions):
                issues.append("Parada separada más de 80 m del trazado")
            if any(b["along"] < a["along"] for a, b in zip(positions, positions[1:])):
                issues.append("Orden ambiguo al proyectar las paradas sobre el trazado")
            if any(metric(a, b) > 500 for a, b in zip(shape, shape[1:])):
                issues.append("Salto de más de 500 m entre puntos del trazado")
            variants.append({"id": f"{route}:{shape_id}:{index}", "routeId": route, "shapeId": shape_id,
                             "headsign": headsign, "stops": list(seq), "positions": positions,
                             "planningEligible": not issues, "issues": issues})
    used = {s for v in variants for s in v["stops"]}
    dataset = {
        "schemaVersion": 1,
        "source": {"name": "MapaNica / OpenStreetMap · archivo Mobility Database", "url": URL,
                   "sha256": SHA, "spatialPublication": "2020-10-27", "feedEnd": "2023-01-31",
                   "archiveDate": "2024-02-08", "auditDate": "2026-10-29", "license": "ODbL-1.0",
                   "confidence": "Histórico · operación actual no verificada"},
        "routes": list(routes.values()), "stops": {s: stops[s] for s in sorted(used)},
        "shapes": shapes, "variants": variants,
    }
    target = ROOT / "public/data/network.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"routes": len(routes), "stops": len(used), "variants": len(variants),
                      "planningEligible": sum(v["planningEligible"] for v in variants),
                      "excluded": [{"route": v["routeId"], "shape": v["shapeId"], "issues": v["issues"]}
                                   for v in variants if v["issues"]], "bytes": target.stat().st_size}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
