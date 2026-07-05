import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(path.resolve('js/home.js'), 'utf8');

const noop = () => {};
const homeContainer = {
  id: 'home-container',
  innerHTML: '',
  querySelector: () => null,
  querySelectorAll: () => [],
  appendChild: noop,
  addEventListener: noop,
};

const document = {
  head: { appendChild: noop },
  body: { appendChild: noop },
  createElement(tag) {
    return {
      tagName: String(tag || '').toUpperCase(),
      id: '',
      className: '',
      innerHTML: '',
      textContent: '',
      style: {},
      appendChild: noop,
      addEventListener: noop,
      setAttribute: noop,
      remove: noop,
    };
  },
  getElementById(id) {
    if (id === 'home-container') return homeContainer;
    return null;
  },
  querySelector: () => null,
  querySelectorAll: () => [],
};

const localStorageStore = new Map();
const localStorage = {
  getItem(key) {
    return localStorageStore.has(key) ? localStorageStore.get(key) : null;
  },
  setItem(key, value) {
    localStorageStore.set(key, String(value));
  },
  removeItem(key) {
    localStorageStore.delete(key);
  },
};

const petState = {
  species: null,
  hp: 10,
  max_hp: 10,
  total_max_hp: 10,
  hunger: 50,
  happiness: 50,
  intimacy: 10,
  exp: 0,
  level: 1,
  cleanliness: 50,
  stage: { name: '宠物蛋' },
  stage_emoji: '🥚',
};

const PetSystem = {
  EXP_TABLE: [0, 30, 80],
  STAGES: [
    { name: '宠物蛋', min_level: 1 },
    { name: '幼崽', min_level: 2 },
  ],
  getState() {
    return { ...petState };
  },
  getCurrentStageImage() {
    return null;
  },
  markHomeExit: noop,
  decay: noop,
};

const windowObject = {
  window: null,
  document,
  localStorage,
  PetSystem,
  SocialSystem: null,
};
windowObject.window = windowObject;

const context = {
  window: windowObject,
  document,
  localStorage,
  PetSystem,
  console,
  setTimeout,
  clearTimeout,
  alert: noop,
};

vm.createContext(context);
vm.runInContext(source, context);

try {
  context.window.HomeSystem.renderUI('home-container');
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}

if (!homeContainer.innerHTML.includes('home-bg')) {
  console.error('expected home render to include background layer');
  process.exit(1);
}

console.log('PASS - home render survives missing init state');
