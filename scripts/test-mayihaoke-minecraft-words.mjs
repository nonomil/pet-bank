import assert from 'node:assert/strict';
import { fetchMayihaokeWords, normalizeMayihaokeRows } from './fetch-mayihaoke-minecraft-words.mjs';

const rows = normalizeMayihaokeRows([
  {
    index: '001',
    word: ' Minecraft ',
    phonetic: '/ˈmaɪnkræft/',
    chinese: '我的世界',
    example: '<b>Minecraft</b> is my favorite game.',
    example_translation: '《我的世界》是我最喜欢的游戏。'
  },
  {
    index: '002',
    word: 'Survival Mode',
    phonetic: '/sərˈvaɪvəl moʊd/',
    chinese: '生存模式',
    example: 'Find food.',
    example_translation: '寻找食物。'
  },
  { index: '003', word: '', chinese: '无效' },
  { index: '004', word: 'Minecraft', chinese: '重复' }
]);

assert.deepEqual(rows, [
  {
    index: '001',
    word: 'Minecraft',
    phonetic: '/ˈmaɪnkræft/',
    chinese: '我的世界',
    example: 'Minecraft is my favorite game.',
    exampleTranslation: '《我的世界》是我最喜欢的游戏。'
  },
  {
    index: '002',
    word: 'Survival Mode',
    phonetic: '/sərˈvaɪvəl moʊd/',
    chinese: '生存模式',
    example: 'Find food.',
    exampleTranslation: '寻找食物。'
  }
]);

const fetched = await fetchMayihaokeWords(async () => ({
  ok: true,
  async json() {
    return [{ word: 'Creeper', chinese: '苦力怕', example: 'A creeper is near the village.' }];
  }
}));
assert.equal(fetched[0].phrase, 'a friendly creeper');
assert.equal(fetched[0].phraseTranslation, '一只友好的苦力怕');
assert.equal(fetched[0].sentence, 'A creeper is near the village.');
assert.equal(fetched[0].sentenceTranslation, '一只苦力怕在村庄附近。');

console.log('mayihaoke Minecraft words: PASS');
