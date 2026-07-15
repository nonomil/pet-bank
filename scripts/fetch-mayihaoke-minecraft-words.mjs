import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { enrichCard } = require('./enrich_minecraft_vocab.cjs');

export const MAYIHAOKE_WORDS_URL = 'https://www.mayihaoke.com/api/ant/course/words/card?course_id=minewords';
export const DEFAULT_OUTPUT = path.resolve('data/learn/external/mayihaoke/word-cards.json');

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const nested = [payload.data, payload.list, payload.words, payload.cards]
    .find(value => Array.isArray(value));
  if (nested) return nested;
  return Object.keys(payload)
    .filter(key => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map(key => payload[key]);
}

export function normalizeMayihaokeRows(payload) {
  const seen = new Set();
  const rows = rowsFromPayload(payload);
  return rows.map((row, offset) => {
    const source = row && typeof row === 'object' ? row : {};
    const word = stripHtml(source.word || source.term || '');
    const chinese = stripHtml(source.chinese || source.translation || source.meaning || '');
    const key = word.toLocaleLowerCase();
    if (!word || !chinese || seen.has(key)) return null;
    seen.add(key);
    return {
      index: stripHtml(source.index || String(offset + 1).padStart(3, '0')),
      word,
      phonetic: stripHtml(source.phonetic || source.uk || source.us || ''),
      chinese,
      example: stripHtml(source.example || source.sentence || ''),
      exampleTranslation: stripHtml(source.example_translation || source.exampleTranslation || source.sentence_translation || '')
    };
  }).filter(Boolean);
}

export async function fetchMayihaokeWords(fetchImpl = globalThis.fetch, url = MAYIHAOKE_WORDS_URL) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response || !response.ok) {
    throw new Error(`mayihaoke words request failed: ${response?.status || 'unknown'}`);
  }
  return normalizeMayihaokeRows(await response.json()).map(card => enrichCard(card));
}

export function buildSnapshot(cards, fetchedAt = new Date().toISOString()) {
  return {
    provider: 'mayihaoke',
    sourceUrl: MAYIHAOKE_WORDS_URL,
    fetchedAt,
    count: cards.length,
    usage: '结构化本地审查素材；不包含参考站原图、音频或完整 HTML。',
    cards
  };
}

export function writeSnapshot(snapshot, outputPath = DEFAULT_OUTPUT) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function main() {
  const cards = await fetchMayihaokeWords();
  const output = writeSnapshot(buildSnapshot(cards));
  const resourcesPath = path.resolve('data/learn/external/mayihaoke/resources.json');
  if (fs.existsSync(resourcesPath)) {
    const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'));
    resources.wordCardsPath = path.relative(path.dirname(resourcesPath), output).replaceAll('\\', '/');
    resources.wordCardsCount = cards.length;
    resources.wordCardsFetchedAt = new Date().toISOString();
    fs.writeFileSync(resourcesPath, `${JSON.stringify(resources, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({ output, count: cards.length }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('fetch-mayihaoke-minecraft-words.mjs')) {
  main().catch(error => {
    console.error(`[mayihaoke] ${error.message}`);
    process.exitCode = 1;
  });
}
