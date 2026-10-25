import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function verify() {
  const manifest = JSON.parse(await readFile(path.join(root, 'provenance/source-manifest.json')));
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(root, file.path));
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw Error(`Source pin mismatch: ${file.path}`);
  }
  const comics = JSON.parse(await readFile(path.join(root, 'src/comics.json')));
  const art = JSON.parse(await readFile(path.join(root, 'art/manifest.json')));
  if (new Set(comics.map(c => c.id)).size !== comics.length || comics.length !== art.assets.length) throw Error('Collection IDs are duplicated or missing');
  for (const comic of comics) {
    const image = art.assets.find(a => a.id === comic.id);
    if (!image || comic.image !== image.url || path.basename(image.url) !== image.filename) throw Error(`Asset mapping mismatch: ${comic.id}`);
    if (!comic.title || !comic.note || !comic.alt || !/^[a-f0-9]{64}$/.test(image.sha256)) throw Error(`Incomplete record: ${comic.id}`);
  }
  return { manifest, comics, art };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { comics } = await verify();
  console.log(`Verified source pins and ${comics.length} unique panel/image/note/alt mappings.`);
}
