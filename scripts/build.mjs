import { mkdir, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function build() {
  const dist = path.join(root, 'dist');
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'src'), dist, { recursive: true });
  await cp(path.join(root, 'public'), dist, { recursive: true });
  await cp(path.join(root, 'node_modules/leaflet/dist'), path.join(dist, 'vendor/leaflet'), { recursive: true });
  await cp(path.join(root, 'node_modules/leaflet/LICENSE'), path.join(dist, 'vendor/leaflet/LICENSE'));
  await mkdir(path.join(dist, 'docs'), { recursive: true });
  for (const name of ['AUDITORIA_FUENTES_TRANSPORTE.md', 'IMPLEMENTACION_PWA.md']) {
    await cp(path.join(root, 'docs', name), path.join(dist, 'docs', name));
  }
  // Exact first-party allowlist; no geocoder responses or map tiles in Cache Storage.
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (!entry.name.endsWith('.map') && entry.name !== 'sw.js' && !entry.name.startsWith('leaflet-src')) {
        files.push(path.relative(dist, full).replaceAll('\\', '/'));
      }
    }
  }
  await walk(dist);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(await readFile(path.join(dist, file)));
  const template = await readFile(path.join(root, 'src/sw.js'), 'utf8');
  const version = hash.update(template).digest('hex').slice(0, 16);
  await writeFile(path.join(dist, 'sw.js'), template
    .replace('__VERSION__', version).replace('/*__ASSETS__*/[]', JSON.stringify(files.map(f => `./${f}`))));
  console.log(`Build listo: ${dist} (${version})`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
