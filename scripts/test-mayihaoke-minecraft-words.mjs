import assert from 'node:assert/strict';
import { normalizeMayihaokeRows } from './fetch-mayihaoke-minecraft-words.mjs';

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

console.log('mayihaoke Minecraft words: PASS');
