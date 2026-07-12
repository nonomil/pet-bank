import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = path.join(ROOT, 'docs_project', 'data-contracts', 'localstorage-registry.json');
const JS_ROOT = path.join(ROOT, 'js');

function patternToRegExp(pattern) {
  return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*')}$`);
}

export async function loadRegistry() {
  const raw = await fs.readFile(REGISTRY_PATH, 'utf8');
  const registry = JSON.parse(raw);
  return {
    ...registry,
    entries: registry.entries.map((entry) => ({ ...entry, matcher: patternToRegExp(entry.pattern) })),
  };
}

async function jsFiles() {
  const names = await fs.readdir(JS_ROOT);
  return names.filter((name) => name.endsWith('.js')).map((name) => path.join(JS_ROOT, name));
}

export async function scanLocalStorageKeys() {
  const registry = await loadRegistry();
  const sources = await Promise.all((await jsFiles()).map(async (file) => ({
    file,
    text: await fs.readFile(file, 'utf8'),
  })));
  const keys = new Set();
  const keyPattern = /[\x27\x22](petbank_[A-Za-z0-9_:$.-]+|arena_points|learning-arcade-settings-v1)[\x27\x22]/g;
  for (const source of sources) {
    for (const match of source.text.matchAll(keyPattern)) keys.add(match[1]);
  }

  const unknown = [];
  const legacy = [];
  for (const key of [...keys].sort()) {
    const entry = registry.entries.find((candidate) => candidate.matcher.test(key));
    if (!entry) unknown.push(key);
    else if (entry.scope === 'legacy') legacy.push(key);
  }
  return { keys: [...keys].sort(), unknown, legacy };
}

if (import.meta.url === `file://${process.argv[1].replaceAll('\\', '/')}`) {
  const report = await scanLocalStorageKeys();
  console.log(JSON.stringify(report, null, 2));
  if (report.unknown.length > 0) process.exitCode = 1;
}
