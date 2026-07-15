import fs from 'node:fs/promises';
import path from 'node:path';
import { request } from 'playwright';

const repoRoot = process.cwd();
const RAW_DIR = path.join(repoRoot, 'tmp', 'mayihaoke-minecraft-media', 'raw');
const MANIFEST_PATH = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'media-manifest.json');
const MEDIA_TEMPLATE = 'https://myhk-1318485526.cos.ap-guangzhou.myqcloud.com/minewords/{index}.webp';
const count = Number(process.env.MAYIHAOKE_MEDIA_COUNT || 500);
const concurrency = Math.max(1, Number(process.env.MAYIHAOKE_MEDIA_CONCURRENCY || 6));

function cardIndex(value) {
  return String(value).padStart(3, '0');
}

function sourceUrl(index) {
  return MEDIA_TEMPLATE.replace('{index}', cardIndex(index));
}

async function fetchOne(client, index) {
  const key = cardIndex(index);
  const rawPath = path.join(RAW_DIR, `${key}.webp`);
  const url = sourceUrl(index);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await client.get(url, {
      headers: {
        referer: 'https://mayihaoke.com/minewords',
        origin: 'https://mayihaoke.com',
        'user-agent': 'Mozilla/5.0 pet-bank local media snapshot'
      },
      timeout: 30000
    });
    if (response.ok()) {
      const body = await response.body();
      await fs.writeFile(rawPath, body);
      return { index: key, sourceUrl: url, rawPath: path.relative(repoRoot, rawPath).replaceAll('\\', '/'), bytes: body.length };
    }
    if (attempt === 3) throw new Error(`media request failed ${response.status()} ${url}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 500));
  }
  throw new Error(`media request failed ${url}`);
}

async function main() {
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error(`invalid media count: ${count}`);
  await fs.mkdir(RAW_DIR, { recursive: true });
  const client = await request.newContext();
  const cards = [];
  try {
    for (let start = 1; start <= count; start += concurrency) {
      const batch = Array.from({ length: Math.min(concurrency, count - start + 1) }, (_, offset) => fetchOne(client, start + offset));
      cards.push(...await Promise.all(batch));
      console.log(`[mayihaoke-media] downloaded ${cards.length}/${count}`);
    }
  } finally {
    await client.dispose();
  }
  const snapshot = {
    provider: 'mayihaoke',
    route: '/minewords',
    sourceTemplate: MEDIA_TEMPLATE,
    fetchedAt: new Date().toISOString(),
    count: cards.length,
    cards: cards.sort((a, b) => Number(a.index) - Number(b.index))
  };
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ manifest: path.relative(repoRoot, MANIFEST_PATH).replaceAll('\\', '/'), count: cards.length }, null, 2));
}

main().catch(error => {
  console.error(`[mayihaoke-media] ${error.message}`);
  process.exitCode = 1;
});
