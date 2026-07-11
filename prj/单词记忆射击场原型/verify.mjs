import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = {
  html: path.join(dir, 'index.html'),
  css: path.join(dir, 'styles.css'),
  js: path.join(dir, 'game.js'),
  readme: path.join(dir, 'README.md'),
  data: path.join(dir, 'assets', 'word-memory-cards.json'),
  dataFallback: path.join(dir, 'assets', 'word-memory-cards.js'),
  voiceMap: path.join(dir, 'assets', 'voice', 'map.json'),
  voiceFallback: path.join(dir, 'assets', 'voice', 'map.js'),
  assetManifest: path.join(dir, 'assets', 'generated', 'topdown-farm-assets', 'manifest.json'),
  farmGptManifest: path.join(dir, 'assets', 'generated', 'world-bg-tiles', 'farm-gpt-9grid-manifest.json'),
  farmGptSourceMeta: path.join(dir, 'assets', 'generated', 'world-bg-tiles', 'farm-gpt-9grid-source.json'),
  boyHeroManifest: path.join(dir, 'assets', 'generated', 'hero-boy-assets', 'manifest.json'),
  adapterScript: path.join(dir, 'scripts', 'build_word_memory_cards_from_minecraft.cjs'),
  farmGptWorkflowScript: path.join(dir, 'scripts', 'generate_farm_gpt_9grid.py'),
  heroExtractScript: path.join(dir, 'scripts', 'extract_boy_hero_frames.py'),
  adapterManifest: path.join(dir, 'assets', 'generated', 'minecraft-memory-adapter', 'manifest.json'),
  adapterSnapshot: path.join(dir, 'assets', 'generated', 'minecraft-memory-adapter', 'minecraft-word-memory-cards.json'),
  allView: path.join(dir, '..', '..', 'data', 'vocab', 'word-memory-combined', 'views', 'all.json'),
  vocabManifest: path.join(dir, '..', '..', 'data', 'vocab', 'word-memory-combined', 'manifest.json'),
  design: path.join(dir, '..', '..', 'docs', 'plans', '2026-07-08-topdown-word-memory-design.md'),
  plan: path.join(dir, '..', '..', 'docs', 'plans', '2026-07-08-topdown-word-memory-implementation.md'),
  adapterPlan: path.join(dir, '..', '..', 'docs', 'plans', '2026-07-08-word-memory-minecraft-adapter-implementation.md')
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

Object.values(files).forEach(file => {
  assert.ok(fs.existsSync(file), `${file} should exist`);
});

const html = read(files.html);
const css = read(files.css);
const js = read(files.js);
const readme = read(files.readme);
const dataFallback = read(files.dataFallback);
const voiceFallback = read(files.voiceFallback);
const docs = `${read(files.design)}\n${read(files.plan)}\n${read(files.adapterPlan)}`;
const source = `${html}\n${css}\n${js}`;
const data = JSON.parse(read(files.data));
const sourceAndData = `${source}\n${JSON.stringify(data)}`;
const voiceMap = JSON.parse(read(files.voiceMap));
const assetManifest = JSON.parse(read(files.assetManifest));
const farmGptManifest = JSON.parse(read(files.farmGptManifest));
const farmGptSourceMeta = JSON.parse(read(files.farmGptSourceMeta));
const boyHeroManifest = JSON.parse(read(files.boyHeroManifest));
const adapterManifest = JSON.parse(read(files.adapterManifest));
const adapterSnapshot = JSON.parse(read(files.adapterSnapshot));
const allView = JSON.parse(read(files.allView));
const vocabManifest = JSON.parse(read(files.vocabManifest));

assert.match(source, /data-prototype="word-memory-topdown"/, 'page should expose the topdown prototype marker');
assert.match(source, /word-memory-cards\.json/, 'game should load external card data');
assert.match(html, /word-memory-cards\.js/, 'page should include a browser fallback data script');
assert.match(js, /WORD_MEMORY_CARDS_DATA/, 'game should use browser fallback card data when fetch is unavailable');
assert.match(dataFallback, /window\.WORD_MEMORY_CARDS_DATA/, 'fallback script should publish card data for file protocol');
assert.match(html, /assets\/voice\/map\.js/, 'page should include a browser fallback voice map script');
assert.match(js, /WORD_MEMORY_VOICE_MAP/, 'game should use browser fallback voice map when fetch is unavailable');
assert.match(voiceFallback, /window\.WORD_MEMORY_VOICE_MAP/, 'voice fallback script should publish voice map data for file protocol');
assert.match(source, /arrowleft|arrowright|arrowup|arrowdown/, 'game should support arrow keys');
assert.match(source, /key === 'tab'/, 'game should support target cycling with Tab');
assert.match(source, /key === 'tab'/, 'game should support target cycling with Tab');
assert.match(source, /key === 'enter' \|\| key === ' '/, 'game should support firing with Enter or Space');
assert.match(source, /map-scene|world-scene/, 'page should expose a dedicated map scene container');
assert.match(source, /heroSelectOverlay|heroSelectGrid|heroSelectStartButton/, 'page should expose a hero selection overlay');
assert.match(js, /DEBUG_WORLD_CONTROLS\s*=\s*false/, 'normal gameplay should disable manual world switching controls');
assert.match(source, /entity-layer/, 'page should render map entities in a separate layer');
assert.match(source, /enemy-word/, 'page should render floating English labels above enemies');
assert.match(source, /meaning-orb|bomb-node/, 'page should render Chinese meaning bomb nodes on the map');
assert.match(source, /carried-word|currentMeaning|selectedMeaning/, 'page should expose the currently selected meaning in the hud');
assert.match(source, /missionRail|missionCountText|missionProgressFill/, 'page should expose a compact mission rail');
assert.match(source, /comboChip|comboText/, 'page should expose combo feedback in the HUD');
assert.match(source, /supportTray|supportSlotList|supportTrayTitle/, 'page should expose a support item tray in the HUD');
assert.match(source, /support_(shield_leaf|slow_clock|auto_star)\.png/, 'support items should use dedicated icon assets');
assert.match(source, /shieldText|shieldStrip|MAX_SHIELD/, 'page should expose hero shield state');
assert.match(html, /categorySelect/, 'page should expose a category selector');
assert.match(source, /renderCategorySelect|categoryStats|activeCardPool|selectedCategory|viewCategory/, 'game should build rounds from the selected vocab category');
assert.match(source, /updateTargets|enemyAttack|ENEMY_CHASE_SPEED|ENEMY_ATTACK_RADIUS/, 'game should make enemies chase and attack the hero');
assert.match(source, /supportShieldCharges|supportSlowMs|supportAutoAimShots|supportSpeedMs|supportHintCharges|supportComboBonus|supportDrops/, 'game should track lightweight support item state');
assert.match(source, /SUPPORT_DROP_EVERY_SCORE|makeSupportDrop|maybeSpawnSupportDrop|applySupportDrop/, 'game should spawn and apply support drops during map play');
assert.match(source, /补盾叶|减速钟|瞄准星|加速鞋|词卡提示|连击加成/, 'game should include the support item set for the map prototype');
assert.match(source, /id:\s*'level-1'[\s\S]*worldPack:\s*'farm_gpt'/, 'level 1 should now default to the farm GPT pack');
assert.match(source, /id:\s*'level-2'[\s\S]*worldPack:\s*'farm_gpt'/, 'level 2 should now default to the farm GPT pack');
assert.match(js, /ENEMY_CHASE_SPEED\s*=\s*0\.0031/, 'topdown enemies should preserve the tuned chase speed');
assert.match(source, /heroInvincibleMs|shieldBreakReset/, 'game should give the hero brief invincibility and a shield reset');
assert.match(js, /function throwHeldBomb\(aimPoint\s*=\s*null,\s*targetId\s*=\s*''\)/, 'map mode should throw the held bomb from the hero facing direction or click aim point');
assert.match(js, /orb\.inFlight\s*=\s*true[\s\S]*state\.shots\.push\(\{[\s\S]*vx:\s*vector\.x\s*\*\s*THROW_SPEED[\s\S]*vy:\s*vector\.y\s*\*\s*THROW_SPEED/s, 'thrown bombs should become JS-driven projectiles with velocity');
assert.match(js, /THROW_HOMING_MAX_MS[\s\S]*function updateHomingShot\(shot\)[\s\S]*targetPosition\(target\)[\s\S]*function updateShots\(deltaMs\)[\s\S]*updateHomingShot\(shot\)[\s\S]*THROW_HIT_RADIUS[\s\S]*resolveShotHit/s, 'clicked-target projectiles should home toward enemies before resolving collisions');
assert.match(js, /function aimVector\(aimPoint[\s\S]*throwHeldBomb\(targetPosition\(target\),\s*target\.id\)/s, 'click throws should auto-seek the clicked enemy instead of using stale facing');
assert.match(js, /orbButton[\s\S]*selectOrb\(orbButton\.dataset\.orbId,\s*true\)/s, 'clicking a map bomb should pick it up immediately');
assert.match(source, /classicStage|classic-target-row|classic-cannon-row/, 'page should keep the classic bottom-shell top-word shooting layout');
assert.match(source, /modeButton|toggleViewMode/, 'page should provide a mode switch between topdown and classic shooting');
assert.match(source, /classicModeButton|classicProgressText/, 'classic mode should expose its own map-return button and progress text');
assert.match(js, /function classicFireAt\([\s\S]*state\.classicShotFx[\s\S]*state\.shotsFired/s, 'classic mode should fire a bottom shell toward a top word target');
assert.match(source, /\.map-scene\s*\{[^}]*height:\s*100vh/s, 'map scene should fill the viewport');
assert.match(source, /worldStage|sceneBackdrop|world-tile|farm-9grid-manifest|WORLD_BG_MANIFEST_URL/, 'page should expose the stitched 3x3 world map background');
assert.match(source, /farm-gpt-9grid-manifest/, 'game should keep a parallel farm GPT preview world pack available');
assert.match(source, /topdown-farm-assets/, 'page should reference the published farm asset pack');
assert.match(source, /guardian_golem\.png/, 'page should use the generated guardian golem hero');
assert.match(source, /guardian_down_idle\.png/, 'page should use the recovered directional hero idle sprite');
assert.match(source, /guardian_side_walk_a\.png/, 'page should use the recovered side walk hero sprite');
assert.match(source, /guardian_cast\.png/, 'page should use the recovered hero cast sprite');
assert.match(source, /guardian_right_idle\.png/, 'page should use a dedicated right-facing hero idle sprite');
assert.match(source, /guardian_right_walk_a\.png/, 'page should use a dedicated right-facing hero walk sprite');
assert.match(source, /guardian_cast_right\.png/, 'page should use a dedicated right-facing cast sprite');
assert.match(source, /hero-boy-assets|boy_down_idle\.png|boy_side_walk_a\.png|boy_cast\.png/, 'page should ship the extracted boy hero asset pack');
assert.match(source, /HERO_SELECTION_KEY|selectedHeroId|currentHeroPack|renderHeroSelect|selectHero/, 'game should support choosing and persisting a hero');
assert.match(source, /data-hero="\$\{state\.selectedHeroId\}"/, 'hero render should expose the active hero id for styling');
assert.match(source, /heroAnimTime|heroDirection|heroMoving/, 'game should track directional hero animation state');
assert.match(source, /HERO_WALK_FRAME_COUNT\s*=\s*3/, 'game should define a three-beat walk cycle');
assert.match(source, /frameSources\s*=\s*\[\s*heroSprites\[family\]\.walk\[0\],\s*heroSprites\[family\]\.idle,\s*heroSprites\[family\]\.walk\[1\]/s, 'moving hero should sequence walk, idle, walk for a three-beat cadence');
assert.match(source, /streak:\s*0,\s*bestStreak:\s*0,\s*shotsFired:\s*0,\s*wrongShots:\s*0/s, 'game should track combo and finish stats counters');
assert.match(source, /finishStats|命中率|最长连对/, 'finish summary should expose accuracy and best streak details');
assert.match(source, /is-facing-up|is-facing-down|is-facing-right|is-facing-left/, 'page should expose directional hero facing classes');
assert.match(source, /HERO_ATTACK_POSE_MS/, 'game should define a dedicated attack pose timing constant');
assert.doesNotMatch(css, /scaleX\(-1\)/, 'hero should use dedicated directional art instead of CSS mirroring');
assert.match(css, /@keyframes hero-idle-breathe[\s\S]*translate\(-50%/, 'hero idle animation should preserve horizontal centering');
assert.match(css, /@keyframes hero-walk-step[\s\S]*translate\(-50%/, 'hero walk animation should preserve horizontal centering');
assert.match(css, /\.hero-unit\[data-hero="boy"\]\s*\{[\s\S]*width:\s*clamp\(98px,\s*9vw,\s*126px\)/, 'boy hero should render slightly larger than the guardian');
assert.match(css, /@keyframes enemy-attack-pop/, 'enemy attacks should have clear feedback');
assert.match(css, /@keyframes hero-shadow-step/, 'hero movement should include a grounded shadow step');
assert.match(css, /@keyframes carry-orb-bob[\s\S]*var\(--carry-x\)[\s\S]*var\(--carry-y\)/, 'carried orb animation should preserve carry offset variables');
assert.doesNotMatch(css, /@keyframes hero-bob[\s\S]*translateY\(/, 'hero animation should not replace the full transform with translateY only');
assert.match(sourceAndData, /enemy_(chicken|pig|boar|sheep|chick|mouse)\.png/, 'page should use generated enemy sprites');
assert.match(sourceAndData, /assets\/MineCraft宠物图片\/poses\/mc_(allay|axolotl|cat|creeper|enderman|zombie|wolf)_idle\.webp/, 'page should reuse project-local original Minecraft pose images as enemy art fallback');
assert.doesNotMatch(sourceAndData, /assets\/pets\/poses-originals\//, 'enemy art should not point at the old original pose folder after project-local migration');
assert.doesNotMatch(sourceAndData, /assets\/cards\/composed-v2\/mc_/, 'enemy art should use original pose images instead of full card images');
assert.match(sourceAndData, /bomb_(plain|ring|skull|rope|band|star)\.png/, 'page should use generated bomb sprites');
assert.match(source, /label_capsule_wide/, 'page should use generated label capsule art');
assert.match(source, /hit_burst_(star|spike|flash|badge)\.png/, 'page should use generated hit burst art');
assert.match(source, /farm_tile_r1_c1|farm_tile_r2_c2|farm_tile_r3_c3|world-bg-tiles/, 'page should use the split 9-grid world background tiles');
assert.match(source, /speechSynthesis|SpeechSynthesisUtterance/, 'game should offer lightweight speech support');
assert.match(source, /assets\/voice\/map\.json/, 'game should load a local prototype voice map first');
assert.match(source, /new Audio\(/, 'game should prefer local html audio playback before fallback speech');
assert.match(source, /target-avatar|enemyImage/, 'game should render enemy artwork');
assert.match(source, /enemyFallbackImage|data-fallback-src|onerror="this\.onerror=null;this\.src=this\.dataset\.fallbackSrc;"/, 'enemy artwork should fall back locally when online images fail');
assert.match(source, /ENEMY_IMAGE_FALLBACK_MS|armEnemyImageFallbacks|naturalWidth === 0/, 'enemy artwork should time out pending online images into local fallbacks');
assert.match(source, /sceneButton|cycleScene|renderDecor/, 'page should offer lightweight scene switching and decor rendering');
assert.match(source, /hideWorldDebugControls|整张地图|清空当前大地图/, 'runtime copy and control flow should frame progression as clearing the whole map before the next level');
assert.match(source, /经典炮弹|上方单词，下方炮弹/, 'docs or UI should keep the classic shooting mode visible');
assert.doesNotMatch(source, /orbDock/, 'bottom orb dock should not be the primary interaction surface');
assert.doesNotMatch(source, /mission-card/, 'large mission card layout should be removed');

assert.ok(Array.isArray(data.cards), 'card data should be an array');
assert.equal(data.adapterVersion, 'minecraft-memory-v1', 'card data should come from the Minecraft memory adapter');
assert.equal(vocabManifest.id, 'word-memory-combined', 'root vocab manifest should identify the combined word-memory vocab package');
assert.equal(data.source?.moduleId, 'word-memory-combined', 'card data should trace back to the combined vocab module');
assert.equal(data.source?.viewId, 'all', 'card data should use the root full vocab view');
assert.equal(data.source?.file, 'data/vocab/word-memory-combined/views/all.json', 'card data should point at the combined all-view source');
assert.equal(data.source?.registryManifest, 'data/vocab/word-memory-combined/manifest.json', 'card data should point at the combined vocab manifest');
assert.deepEqual(data, adapterSnapshot, 'active card data should match the generated Minecraft adapter snapshot');
assert.equal(adapterManifest.cardCount, data.cards.length, 'adapter manifest should track the active card count');
assert.deepEqual(
  data.cards.map(card => card.word).sort(),
  allView.cards.map(card => card.word).sort(),
  'active card words should mirror the combined word-memory all view'
);
assert.ok(data.cards.length >= 3000, 'card data should include the copied external English vocab deck');
assert.ok(
  data.cards.every(card => card.word && card.translation && card.icon && card.enemyImage),
  'every card should have word, translation, icon, and enemy image'
);
assert.ok(
  data.cards.every(card => card.enemyFallbackImage && !/^https?:\/\//.test(card.enemyFallbackImage)),
  'every card should keep a local enemy image fallback'
);
assert.ok(
  data.cards.every(card => card.sourceCardId && card.sourceProvider && card.viewCategory),
  'every adapted card should retain source trace metadata'
);
const localVoiceCards = data.cards.filter(card => voiceMap[card.word] || voiceMap[card.translation]);
assert.ok(localVoiceCards.length >= 90, 'large combined decks should keep local mp3 coverage for the curated Minecraft starter set');
assert.ok(
  Object.values(voiceMap).every(digest => {
    const audio = path.join(dir, 'assets', 'voice', `${digest}.mp3`);
    return fs.existsSync(audio) && fs.statSync(audio).size > 100;
  }),
  'published voice map entries should resolve to playable local mp3 files'
);
assert.ok(Array.isArray(assetManifest.assets), 'asset manifest should include assets');
assert.ok(assetManifest.assets.length >= 16, 'asset manifest should publish a meaningful subset of the farm assets');
assert.equal(farmGptManifest.id, 'farm-gpt-9grid-world', 'farm GPT preview manifest should have a stable world id');
assert.equal(farmGptManifest.tiles.length, 9, 'farm GPT preview manifest should list 9 runtime tiles');
assert.equal(farmGptSourceMeta.generatedViaBrowserActChatGPT, true, 'farm GPT source meta should document the browser-act ChatGPT generation workflow');
assert.equal(farmGptSourceMeta.tileCount, 9, 'farm GPT preview source meta should record all 9 exported tiles');
assert.equal(farmGptSourceMeta.workflowScript, 'prj/browser-act-imagegen/README.md', 'farm GPT source meta should point at the browser-act workflow documentation');
assert.equal(farmGptSourceMeta.manifest, 'prj/单词记忆射击场原型/assets/generated/world-bg-tiles/farm-gpt-9grid-manifest.json', 'farm GPT preview source meta should point at the runtime manifest');
assert.equal(boyHeroManifest.source, 'assets/主角图/小男孩--主角多角度动态图.png', 'boy hero manifest should trace back to the user-provided sprite sheet');
assert.ok(
  ['boy_down_idle', 'boy_down_walk_a', 'boy_down_walk_b', 'boy_up_idle', 'boy_side_idle', 'boy_right_idle', 'boy_cast', 'boy_cast_right', 'boy_happy']
    .every(name => boyHeroManifest.assets.some(asset => asset.name === name)),
  'boy hero manifest should contain the extracted directional hero set'
);
assert.ok(
  ['guardian_golem', 'guardian_down_idle', 'guardian_side_walk_a', 'guardian_cast', 'guardian_right_idle', 'guardian_right_walk_a', 'guardian_cast_right', 'enemy_chicken', 'enemy_pig', 'enemy_boar', 'enemy_sheep', 'enemy_chick', 'enemy_mouse', 'bomb_plain', 'label_capsule_wide_a', 'hit_burst_star', 'support_shield_leaf', 'support_slow_clock', 'support_auto_star', 'support_speed_boots', 'support_hint_card', 'support_combo_badge']
    .every(name => assetManifest.assets.some(asset => asset.name === name)),
  'asset manifest should contain the core named farm assets'
);

assert.match(readme, /俯视地图|地图上移动|top-down/i, 'README should describe the topdown direction');
assert.match(readme, /小男孩|铁傀儡|选择角色/, 'README should document the new hero selection flow');
assert.match(readme, /经典炮弹|上方单词、下方炮弹/, 'README should document the retained classic shell shooting mode');
assert.match(readme, /农场词汇|farm/i, 'README should mention the current farm-word visual set');
assert.match(readme, /minecraft-vocab|all\.json|全量/i, 'README should describe the full Minecraft vocab adapter');
assert.match(readme, /9 宫格|3x3|大地图|镜头跟随/i, 'README should mention the stitched 3x3 scrolling world map');
assert.match(readme, /农场 GPT|generate_farm_gpt_9grid\.py/i, 'README should document the parallel farm GPT preview workflow');
assert.match(readme, /任务条|连对|命中率|最长连对/i, 'README should mention the reward feedback HUD and finish stats');
assert.match(readme, /本地 mp3|assets\/voice|generate_voice_assets\.py/i, 'README should describe the local voice workflow');
assert.match(readme, /127\.0\.0\.1:8000/, 'README should include local access url');
assert.match(docs, /俯视地图版单词记忆游戏|top-down map-based word memory game/i, 'docs should record the topdown rebuild plan');
assert.match(docs, /中文球散落地图|Chinese bomb nodes on the map/, 'docs should mention map-scattered meaning bombs');
assert.match(docs, /Minecraft memory-view|minecraft-vocab-memory-view|全量|all view/i, 'docs should record the Minecraft memory adapter');

console.log('PASS - 单词记忆射击场原型验证');
