import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.resolve(process.argv[2] || path.join(root, 'tmp', 'oxford-wordlists.html'));
const outputPath = path.join(root, 'docs', 'minecraft-vocab-evidence', 'raw', 'OXFORD_3000_5000_CEFR.csv');
const cefrOrder = new Map([['a1', 1], ['a2', 2], ['b1', 3], ['b2', 4], ['c1', 5]]);

function csv(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalize(value) {
    return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

if (!fs.existsSync(inputPath)) throw new Error(`missing Oxford HTML snapshot: ${inputPath}`);
const html = fs.readFileSync(inputPath, 'utf8');
const rows = new Map();
const pattern = /<li\s+data-hw="([^"]+)"\s+data-ox3000="([^"]*)"\s+data-ox5000="([^"]*)"/gi;
for (const match of html.matchAll(pattern)) {
    const word = normalize(match[1]);
    const oxford3000 = String(match[2] || '').toLowerCase();
    const oxford5000 = String(match[3] || '').toLowerCase();
    const cefr = oxford3000 || oxford5000;
    if (!word || !cefrOrder.has(cefr)) continue;
    const previous = rows.get(word);
    if (!previous || cefrOrder.get(cefr) < cefrOrder.get(previous.cefr)) {
        rows.set(word, { word, cefr, oxford3000: oxford3000 || '', oxford5000: oxford5000 || '' });
    }
}

const output = [
    '# Source: https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000',
    '# Extracted from the public HTML wordlist page; duplicate parts of speech are deduplicated to the lowest CEFR level.',
    `# Input SHA-256: ${crypto.createHash('sha256').update(html).digest('hex')}`,
    'word,cefr,oxford3000,oxford5000',
    ...[...rows.values()].sort((a, b) => a.word.localeCompare(b.word)).map(row => [row.word, row.cefr, row.oxford3000, row.oxford5000].map(csv).join(','))
].join('\n') + '\n';
fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outputPath).replace(/\\/g, '/'), rows: rows.size, inputSha256: crypto.createHash('sha256').update(html).digest('hex') }, null, 2));
