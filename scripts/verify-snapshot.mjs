import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This verifies this public snapshot, not an original import or prior Git history.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestName = 'SOURCE-SNAPSHOT.json';
const manifest = JSON.parse(await readFile(path.join(root, manifestName), 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.kind !== 'public-source-snapshot' || !Array.isArray(manifest.files)) {
  throw new Error('Unsupported public snapshot manifest');
}
const extraIgnored = new Set(manifest.generatedPaths || []);
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vitest', '.cache', '.local']);
const ignoredFile = (name) => name.endsWith('.log') || name.endsWith('.tsbuildinfo') || name === '.DS_Store';
const expected = new Set();
const failures = [];
for (const file of manifest.files) {
  if (typeof file.path !== 'string' || file.path.includes('\\') || file.path.split('/').some(part => !part || part === '.' || part === '..') || path.posix.isAbsolute(file.path) || /^[A-Za-z]:/.test(file.path)) {
    throw new Error('Unsafe manifest path');
  }
  if (file.path === manifestName || expected.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid manifest entry');
  expected.add(file.path);
  const absolute = path.resolve(root, file.path);
  if (!absolute.startsWith(root + path.sep)) throw new Error('Manifest path leaves snapshot');
  try {
    if (!(await lstat(absolute)).isFile()) throw new Error('Not a regular file');
    const bytes = await readFile(absolute);
    if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) failures.push('Changed: ' + file.path);
  } catch { failures.push('Missing or unreadable: ' + file.path); }
}
async function walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (extraIgnored.has(relative)) continue;
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(path.join(directory, entry.name), relative + '/');
    } else if (entry.isSymbolicLink()) failures.push('Symbolic link: ' + relative);
    else if (entry.isFile() && relative !== manifestName && !ignoredFile(entry.name) && !expected.has(relative)) failures.push('Unexpected: ' + relative);
  }
}
await walk(root);
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Verified ${manifest.files.length} public snapshot files (SHA-256). Dependency/build output is excluded; this is not an authenticity signature or security scan.`);
