import { readFile, writeFile, mkdir, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { root, hash, verify } from './verify-source.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[i + 1]]);
  return pairs;
}, []));
if (!args['portfolio-root'] || !args.out) throw Error('Usage: npm run build -- --portfolio-root PATH --out NEW_DIRECTORY [--assets-root SIGNED_PNG_DIRECTORY]');
const portfolio = path.resolve(args['portfolio-root']);
const site = path.join(portfolio, 'site');
const output = path.resolve(args.out);
const publicRoot = path.join(output, 'public');
if (output === root || output === site || output.startsWith(site + path.sep)) throw Error('Output must not overwrite repository source');
try { await access(output); throw Error(`Output already exists: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const { manifest, art } = await verify();
const assets = path.resolve(args['assets-root'] || path.join(site, 'guides/comic-panels/images'));
const templatePath = path.join(site, 'guides/comic-panels/index.html');
const template = await readFile(templatePath, 'utf8');
const main = await readFile(path.join(root, 'src/main.html'), 'utf8');
const reader = await readFile(path.join(root, 'src/reader.html'), 'utf8');
for (const tag of ['main', 'dialog']) if ((template.match(new RegExp(`<${tag}\\b`, 'g')) || []).length !== 1) throw Error(`Shell must contain exactly one ${tag} slot`);
const html = template.replace(/<main\b[\s\S]*?<\/main>/, () => main).replace(/<dialog\b[\s\S]*?<\/dialog>/, () => reader);
const sharedStyles = await readFile(path.join(site, 'styles.css'), 'utf8');
const sharedPaths = new Set(['/styles.css', '/landing.js']);
for (const match of (template + '\n' + main).matchAll(/src\s*=\s*["'](\/assets\/[^"'\s]+)/g)) sharedPaths.add(match[1].split(/[?#]/)[0]);
for (const match of sharedStyles.matchAll(/url\(\s*["']?([^"'\s)]+)/g)) {
  const url = new URL(match[1], 'https://portfolio.invalid/styles.css');
  if (url.origin === 'https://portfolio.invalid' && !url.hash) sharedPaths.add(url.pathname);
}
for (const match of template.matchAll(/<link\b[^>]*href=["'](\/assets\/[^"']+)["']/g)) sharedPaths.add(match[1].split(/[?#]/)[0]);
sharedPaths.add('/project-identities.css');
if(template.includes('/app.webmanifest')) {
  sharedPaths.add('/app.webmanifest');
  const manifest=JSON.parse(await readFile(path.join(site,'app.webmanifest')));
  for(const icon of manifest.icons)sharedPaths.add(icon.src);
}
for (const file of await readdir(path.join(site, 'fonts'), { withFileTypes: true })) if (file.isFile() && /(?:ofl|license|notice)/i.test(file.name)) sharedPaths.add('/fonts/' + file.name);
const outputs = [], dependencies = [];
async function emit(relative, bytes, role) {
  const target = path.resolve(publicRoot, relative);
  if (!target.startsWith(publicRoot + path.sep)) throw Error(`Unsafe output path: ${relative}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  outputs.push({ path: relative.replaceAll('\\', '/'), bytes: Buffer.byteLength(bytes), sha256: hash(bytes), role });
}
// Read/validate inputs before emitting any output. Never mutate or re-encode artwork.
const imageBytes = [];
for (const image of art.assets) {
  if (path.basename(image.filename) !== image.filename) throw Error('Unsafe asset filename');
  const bytes = await readFile(path.join(assets, image.filename));
  if (bytes.length !== image.bytes || hash(bytes) !== image.sha256 || bytes.readUInt32BE(16) !== image.width || bytes.readUInt32BE(20) !== image.height) throw Error(`Approved image mismatch: ${image.id}`);
  imageBytes.push([image, bytes]);
}
const displayBytes = [];
for (const image of JSON.parse(await readFile(path.join(root,'art/derivatives.json')))) {
  if (path.basename(image.filename)!==image.filename) throw Error('Unsafe display filename');
  const bytes=await readFile(path.join(assets,image.filename));
  if (bytes.length!==image.bytes || hash(bytes)!==image.sha256) throw Error('Display image mismatch: '+image.id);
  displayBytes.push([image,bytes]);
}
const sharedBytes = [];
for (const url of sharedPaths) {
  const source = path.resolve(site, '.' + url);
  if (!source.startsWith(site + path.sep)) throw Error(`Unsafe shared path: ${url}`);
  const bytes = await readFile(source);
  sharedBytes.push([url.slice(1), bytes]);
  dependencies.push({ path: url, bytes: bytes.length, sha256: hash(bytes), owner: 'external shared website' });
}
await emit('guides/comic-panels/index.html', html, 'portfolio shell with collection-owned fragments');
for (const name of ['comic-panels.css', 'comic-panels.js', 'comics.json']) await emit('guides/comic-panels/' + name, await readFile(path.join(root, 'src', name)), 'collection source');
for (const [relative, bytes] of sharedBytes) await emit(relative, bytes, 'shared portfolio dependency');
for (const [image, bytes] of imageBytes) await emit('guides/comic-panels/images/' + image.filename, bytes, 'external approved signed image');
for (const [image,bytes] of displayBytes) await emit('guides/comic-panels/images/'+image.filename,bytes,'verified full-resolution lossless display image');
const receipt = { schemaVersion: 1, sourceManifest: manifest, shell: { source: templatePath, sha256: hash(template), owner: 'external shared website' }, externalAssets: { source: assets, copiedWithoutConversion: true }, sharedDependencies: dependencies, files: outputs };
await writeFile(path.join(output, 'BUILD-MANIFEST.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ output, publicRoot, files: outputs.length, approvedImages: imageBytes.length, sharedDependencies: dependencies.length }));
