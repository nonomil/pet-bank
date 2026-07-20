import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prototypeDir = path.join(root, 'prj', '学习机玩法原型');
const htmlPath = path.join(prototypeDir, 'index.html');
const cssPath = path.join(prototypeDir, 'styles.css');
const jsPath = path.join(prototypeDir, 'game.js');
const readmePath = path.join(prototypeDir, 'README.md');
const contentPath = path.join(prototypeDir, 'assets', 'generated', 'learning-games-content.json');
const wordCannonDesignPath = path.join(prototypeDir, '大炮打单词设计方法.md');
const typingViewPath = path.join(root, 'data', 'vocab', 'english-minecraft', 'views', 'typing-view.json');
const expandedTypingPackPath = path.join(prototypeDir, 'assets', 'generated', 'minecraft-typing-expanded.json');
const expandedTypingPackScriptPath = path.join(prototypeDir, 'assets', 'generated', 'minecraft-typing-expanded.js');
const unifiedTypingPackPath = path.join(prototypeDir, 'assets', 'generated', 'english-typing-unified.json');
const unifiedTypingPackScriptPath = path.join(prototypeDir, 'assets', 'generated', 'english-typing-unified.js');
const localFileVocabFallbackTestPath = path.join(prototypeDir, 'scripts', 'test-local-file-vocab-fallback.mjs');
const sharedHanziVoiceDir = path.join(root, 'prj', '拼音块收集台原型', 'assets', 'voice');
const sharedHanziVoiceMapPath = path.join(sharedHanziVoiceDir, 'map.json');
const sharedHanziVoiceManifestPath = path.join(sharedHanziVoiceDir, 'manifest.json');
const pureCannonBackgroundPath = path.join(prototypeDir, 'assets', '大炮打单词', '大炮打单词参考设计-纯背景.png');
const pinyinRacerLongTrackPath = path.join(prototypeDir, 'assets', 'generated', 'reference', 'pinyin-racer-long-track-strip', 'pinyin-racer-long-track-strip.png');
const pinyinRacerSkybridgePath = path.join(prototypeDir, 'assets', 'generated', 'reference', 'pinyin-racer-long-track-skybridge', 'pinyin-racer-long-track-skybridge.png');
const pinyinRacerAssetCheckPath = path.join(prototypeDir, 'scripts', 'test-pinyin-racer-assets.py');
const pinyinRacerRethemeManifestPath = path.join(prototypeDir, 'assets', 'generated', 'pinyin-racer-retheme-assets', 'manifest.json');
const pinyinRacerPreparedDir = path.join(prototypeDir, 'assets', '拼音赛车');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

assert.ok(fs.existsSync(prototypeDir), 'prototype directory should exist');
assert.ok(fs.existsSync(htmlPath), 'index.html should exist');
assert.ok(fs.existsSync(cssPath), 'styles.css should exist');
assert.ok(fs.existsSync(jsPath), 'game.js should exist');
assert.ok(fs.existsSync(readmePath), 'README.md should exist');
assert.ok(fs.existsSync(contentPath), 'content JSON should exist so content and code stay separated');
assert.ok(fs.existsSync(wordCannonDesignPath), 'word cannon design method document should exist');
assert.ok(fs.existsSync(typingViewPath), 'root minecraft game vocab typing view should exist');
assert.ok(fs.existsSync(expandedTypingPackPath), 'prototype expanded typing pack should exist');
assert.ok(fs.existsSync(expandedTypingPackScriptPath), 'prototype expanded typing pack browser fallback script should exist');
assert.ok(fs.existsSync(unifiedTypingPackPath), 'unified typing pack should exist');
assert.ok(fs.existsSync(unifiedTypingPackScriptPath), 'unified typing pack browser fallback script should exist');
assert.ok(fs.existsSync(localFileVocabFallbackTestPath), 'direct index.html local-file vocab fallback smoke test should exist');
assert.ok(fs.existsSync(sharedHanziVoiceMapPath), 'shared hanzi voice map should exist in the pinyin prototype');
assert.ok(fs.existsSync(sharedHanziVoiceManifestPath), 'shared hanzi voice manifest should exist in the pinyin prototype');
assert.ok(fs.existsSync(pureCannonBackgroundPath), 'updated pure-background cannon arena should exist');
assert.ok(fs.existsSync(pinyinRacerLongTrackPath), 'pinyin racer generated long track strip should exist');
assert.ok(fs.existsSync(pinyinRacerSkybridgePath), 'pinyin racer generated skybridge long track should exist');
assert.ok(fs.existsSync(pinyinRacerAssetCheckPath), 'pinyin racer RGBA asset check should exist');
assert.ok(fs.existsSync(pinyinRacerRethemeManifestPath), 'pinyin racer retheme semantic asset manifest should exist');
assert.ok(fs.existsSync(pinyinRacerPreparedDir), 'prepared pinyin racer asset directory should exist');

const html = readText(htmlPath);
const css = readText(cssPath);
const js = readText(jsPath);
const readme = readText(readmePath);
const wordCannonDesign = readText(wordCannonDesignPath);
const pageSource = [html, css, js].join('\n');
const docsAndContent = [readme, wordCannonDesign, readText(contentPath)].join('\n');
const content = JSON.parse(readText(contentPath));
const typingView = JSON.parse(readText(typingViewPath));
const expandedTypingPack = JSON.parse(readText(expandedTypingPackPath));
const unifiedTypingPack = JSON.parse(readText(unifiedTypingPackPath));
const sharedHanziVoiceMap = JSON.parse(readText(sharedHanziVoiceMapPath));
const sharedHanziVoiceManifest = JSON.parse(readText(sharedHanziVoiceManifestPath));
const pinyinRacerRethemeManifest = JSON.parse(readText(pinyinRacerRethemeManifestPath));
const hanziQuestions = JSON.parse(readText(path.join(root, 'data', 'hanzi-questions.json')));

assert.match(pageSource, /data-prototype="learning-arcade-game"/, 'page should expose arcade prototype marker');
assert.match(pageSource, /GAME_CONTENT_URL/, 'game should load project-local content JSON');
assert.match(pageSource, /learning-games-content\.json/, 'page should reference separated game content JSON');
assert.match(pageSource, /assets\/generated\/english-typing-unified\.json/, 'page should load the unified typing pack');
assert.match(js, /FILE_TYPING_FALLBACK_SCRIPTS/, 'runtime should define the local-file typing fallback script list');
assert.match(js, /loadFileFallbackScripts\(FILE_TYPING_FALLBACK_SCRIPTS\)/, 'runtime should load the typing fallback only when the game opens');
assert.match(js, /location\.protocol\s*===\s*['"]file:/, 'local-file fallback should be protocol-gated');
assert.doesNotMatch(html, /<script\s+src=["']\.\/assets\/generated\/(?:minecraft-typing-expanded|english-typing-unified)\.js/i, 'HTML should not preload deferred vocabulary scripts');
assert.match(js, /LearningArcadeTypingUnified/, 'runtime should fall back to the unified preloaded vocab script when local JSON fetch is blocked');
assert.match(readme, /sync_external_minecraft_vocab\.cjs[^]*单词库_分级/, 'README should document the formal graded vocab sync path');
assert.doesNotMatch(js, /data\/learn\/packs/, 'game runtime should not read formal learning-pack modules directly');
assert.doesNotMatch(js, /data\/vocab\/english-minecraft\/views\/typing-view\.json/, 'game runtime should no longer read the root official vocab view directly');
assert.match(js, /拼音块收集台原型\/assets\/voice|HANZI_SHARED_VOICE_MAP_URL|HANZI_SHARED_VOICE_ASSET_BASE/, 'learning arcade should point hanzi voice playback at the shared pinyin prototype voice bundle');
assert.match(js, /new Audio\(/, 'learning arcade should prefer local audio playback for hanzi prompts');
assert.match(js, /speechSynthesis|SpeechSynthesisUtterance/, 'learning arcade should keep browser speech fallback for hanzi prompts');
assert.match(js, /announceHanziTarget|catchHanziBubble|speakHanziTask|speakCurrentHanziTarget/, 'learning arcade should keep a dedicated hanzi prompt voice path');
assert.match(js, /function speakCurrentCannonWord[^]*speakHanziTask/, 'pinyin cannon should read hanzi and pinyin through the local hanzi voice path');
assert.doesNotMatch(js, /speakCurrentCannonWord[^]*speakSequence\(focusTarget\.wordData\)/, 'pinyin cannon should not read pinyin targets through the English word voice sequence');
assert.doesNotMatch(js, /flattenHanziLevels\(hanziData\)[^;]*\.slice\(0,\s*12\)/, 'pinyin games should use the full root hanzi question pool, not a 12-item prototype slice');
assert.match(js, /hanziPool:\s*\(\)\s*=>/, 'runtime debug API should expose the active hanzi/pinyin pool size');

assert.match(pageSource, /id="gameHome"/, 'page should include a home screen');
assert.match(pageSource, /id="gameCards"/, 'home should render game cards');
assert.match(pageSource, /data-game="word-shooter"/, 'first card should open the airplane battle word shooter');
assert.match(pageSource, /data-game="word-cannon"/, 'second card should open the pinyin racing game');
assert.match(pageSource, /拼音赛车/, 'second card should present the mode as pinyin racing instead of a second English word game');
assert.match(pageSource, /data-game="pinyin-snake"/, 'third card should open the snake game');
assert.doesNotMatch(html, /data-game="hanzi-jumper"/, 'home should no longer expose the removed jumping game');
assert.doesNotMatch(html, /data-game-panel="hanzi-jumper"/, 'page should no longer mount the jumping game panel');

assert.match(pageSource, /id="wordShooter"/, 'airplane battle panel should exist');
assert.match(pageSource, /id="wordCannon"/, 'cannon word panel should exist');
assert.match(pageSource, /id="pinyinSnake"/, 'snake panel should exist');
assert.match(pageSource, /id="gameScreen"[^>]*tabindex="-1"/, 'game window should be focusable for keyboard play');
assert.match(pageSource, /id="roundSummary"|round-summary/, 'game screen should include a shared round summary layer');
assert.match(js, /function openGame[^]*gameHome\.hidden\s*=\s*true/, 'opening a fullscreen game should hide the home screen');
assert.match(css, /position:\s*fixed[^}]*inset:\s*0/s, 'game window should overlay the home instead of appearing below it');

assert.match(pageSource, /typingEnemyLayer/, 'airplane battle should render enemy fighters');
assert.match(pageSource, /is-fighter|enemy fighter|战机/, 'airplane battle should frame enemies as word-bearing enemy fighters');
assert.match(js, /function inputWordLetter/, 'airplane battle should still accept per-letter typing');
assert.match(js, /function spawnTypingTrail/, 'airplane battle should keep visible projectile trails');
assert.match(pageSource, /wordDifficultySwitch|cannonDifficultySwitch|data-word-difficulty/, 'typing games should expose a visible word difficulty switch');
assert.match(pageSource, /wordPackSwitch|data-word-pack|setWordPack/, 'word shooter should expose a visible vocab pack switch');
assert.match(pageSource, /wordSettingsReset|resetWordSettings|恢复默认/, 'word shooter should expose a reset action for saved word settings');
assert.match(pageSource, /wordDifficultyBadge|cannonDifficultyBadge|difficulty-badge/, 'typing games should expose visible difficulty tuning badges');
assert.match(js, /setWordDifficulty|wordsForDifficulty|WORD_DIFFICULTY_OPTIONS/, 'typing games should support shared vocab difficulty switching');
assert.match(js, /WORD_DIFFICULTY_TUNING/, 'typing games should map difficulty to gameplay tuning');
assert.match(js, /maxEnemies|speedMultiplier|maxTargets|crashOnly|missLimit/, 'typing game difficulty should affect enemy count, target count, speed and failure pressure');
assert.match(js, /shuffleWordsForRound|startWordCursor/, 'word shooter should shuffle or rotate vocab starts so selected packs do not repeat the same first words');
assert.match(js, /crashOnly/, 'airplane battle should only end on player collision, not ordinary skipped enemies');
assert.match(js, /SETTINGS_STORAGE_KEY|localStorage|saveSettings|readSavedSettings/, 'word pack and difficulty settings should persist locally');
assert.match(pageSource, /triggerDifficultyCue|difficulty-badge-pulse|is-pulsing/, 'typing difficulty switches should trigger visible badge feedback');
assert.match(js, /sfx\.difficulty|difficulty\(level/, 'typing difficulty switches should trigger a light audio cue when sound is enabled');
assert.match(js, /roundRewardFor|enhanceTypingRoundSummary/, 'typing game summaries should compute difficulty-based rewards');
assert.match(js, /金币|钻石|星星|武器升级|轮胎升级|弓箭矩阵/, 'typing game summaries should expose coins, gems, stars and upgrade rewards');

assert.match(pageSource, /cannonStage|pinyin-race-stage/, 'pinyin racing game should include a dedicated stage');
assert.match(pageSource, /pinyin-racer|pinyin-race-stage|pinyin-race-car-img|pinyin-racer-assets/, 'pinyin racing game should render a race track and generated car assets');
assert.match(pageSource, /cannonTargetLayer/, 'pinyin racing game should render pinyin lane option cards');
assert.match(pageSource, /cannonFxLayer/, 'pinyin racing game should keep an acceleration and feedback effect layer');
assert.match(pageSource, /cannonKeyboard/, 'pinyin racing game should expose its own onscreen keyboard');
assert.match(js, /function startWordCannon/, 'pinyin racing game should reuse the stable pinyin lifecycle');
assert.match(js, /function moveWordCannonCar/, 'pinyin racing game should move the car left and right to catch pinyin cards');
assert.match(js, /function moveWordCannonToLane|wordCannonLaneFromPointer/, 'pinyin racing should support touch or click lane selection for young children');
assert.match(js, /retryTask|hintUntil|再找/, 'pinyin racing should retry the same pinyin with a gentle hint after a wrong catch');
assert.match(js, /pinyinInitialKey|childFriendly|differentInitial/, 'pinyin racing should tune distractor pinyin difficulty for young children');
assert.match(js, /completedReview|复习一下/, 'pinyin racing summary should include a short hanzi-pinyin review');
assert.doesNotMatch(js, /目标拼音[\s\S]*干扰卡/, 'pinyin option cards should not reveal the correct answer before play');
assert.match(js, /function spawnCannonShot/, 'pinyin racing game should draw speed-line trajectories');
assert.match(js, /function spawnCannonImpact/, 'pinyin racing game should show pinyin-card catch feedback');
assert.match(js, /function spawnCannonShards/, 'pinyin racing game should keep target fragments on completed words');
assert.match(js, /function spawnCannonShockwave/, 'pinyin racing game should keep a completion burst');
assert.match(css, /\.pinyin-racer\b|\.pinyin-race-stage\b/, 'pinyin racing game should have dedicated racing visual styling');
assert.match(css, /\.pinyin-race-car-img\b/, 'pinyin racing car asset should be styled');
assert.match(css, /pinyin-lane-stripes|pinyin-speed-streaks/, 'pinyin racing should simulate forward motion with scrolling lane markings and speed-line layers');
assert.doesNotMatch(css, /@keyframes race-car-sprint[^}]*scale\(/, 'pinyin racer sprint should move upward without changing car size');
assert.doesNotMatch(css, /race-car-idle|race-car-boost/, 'pinyin racer should not use idle bobbing or scale-boost animations');
assert.match(js, /assets\/拼音赛车|pinyin-racer-retheme-20260711|pinyin-racer-long-track-strip\.png|speed_trail_short|road_sign_dark_blank/, 'pinyin racing game should use the prepared rethemed track or legacy racing assets');
assert.match(js, /pinyin-racer-retheme-assets|initial_sound_gate|picture_supply_kiosk|finish_sprint_arch/, 'pinyin racing game should use semantic retheme facility assets');
assert.equal(pinyinRacerRethemeManifest.assets.length, 6, 'pinyin racer retheme manifest should describe six route facilities');
assert.ok(pinyinRacerRethemeManifest.assets.every(item => fs.existsSync(path.join(root, 'prj', '学习机玩法原型', item.file))), 'pinyin racer retheme manifest should point to existing files');
assert.match(css, /\.cannon-shot-trail\b/, 'pinyin racing speed-line trails should be styled');
assert.match(css, /\.cannon-impact\b/, 'pinyin racing pass effects should be styled');
assert.match(css, /\.cannon-shard\b/, 'cannon target fragments should be styled');
assert.match(css, /\.cannon-shockwave\b/, 'cannon circular shockwave should be styled');
assert.match(js, /拼音赛车参考图-02-漂浮天空赛道|pinyin-racer-retheme-20260711.*level-02-cloud-fork|pinyin-racer-long-track-skybridge\.png/, 'pinyin racing map set should include the prepared cloud-fork background');

assert.match(js, /PINYIN_RACER_SEGMENTS/, 'pinyin racer should define a deterministic multi-segment track catalogue');
assert.match(js, /s-bend|fork|bridge|tunnel|finish-sprint/, 'pinyin racer should include varied track segment shapes');
assert.match(js, /taskType|correctRoute|recoveryRoute|landmark/, 'pinyin racer segments should carry learning route metadata');
assert.match(html, /cannonRouteLayer|route-segment|race-landmark/, 'pinyin racer stage should expose a route layer for segment landmarks');
assert.match(css, /route-segment|race-landmark|is-fork|is-tunnel|is-boost/, 'pinyin racer should style route facilities and landmarks');
assert.match(js, /sound-gate|image-supply|tone-sign|final-gate|taskType/, 'pinyin racer should render more than one learning task type');

assert.match(pageSource, /pinyinSnake/, 'snake game should be present');
assert.match(pageSource, /snakeBoard/, 'snake game should include a board');
assert.match(pageSource, /snake-cell/, 'snake should render grid cells');
assert.match(pageSource, /snakeReferenceStage|snake-target-float|snake-ref-stat|snake-food-dot/, 'snake should use the reference-style grid arena, floating target label and dot foods');
assert.match(pageSource, /pinyin-snake-assets/, 'snake should use the generated transparent asset pack');
assert.match(pageSource, /snakePauseButton|data-snake-action="pause"/, 'snake should expose a pause/resume control');
assert.match(pageSource, /snakeSpeedSwitch|data-snake-speed/, 'snake should expose a slow/standard pace control');
assert.match(pageSource, /snakeHintButton|data-snake-action="hint"/, 'snake should expose a learning hint control');
assert.match(pageSource, /snakeTaskEmoji|snakeTaskExample/, 'snake task card should expose a semantic visual cue and example sentence');
assert.match(js, /function useSnakeHint\(\)/, 'snake should expose a per-round hint action');
assert.match(js, /hintUses|hintActiveUntil|data-food-hint|hintTick/, 'snake should track and render limited hint state');
assert.match(js, /speakHanziTask\(\[/, 'snake hint should reuse the hanzi and pinyin voice path');
assert.match(js, /function toggleSnakePause\(\)/, 'snake should support pausing without losing the current task');
assert.match(js, /snake\.speedMs|SNAKE_SPEED_PRESETS/, 'snake should keep an explicit pace preset instead of a hard-coded timer');

assert.doesNotMatch(pageSource, /vibe coding|内容和代码分开|最低门槛/i, 'visible home/game source should not show developer-facing project copy');
assert.match(readme, /最低门槛/, 'README should record low-friction input guidance');
assert.match(readme, /内容和代码/, 'README should record content-code separation guidance');
assert.match(docsAndContent, /飞机大战|战机/, 'docs should describe the airplane battle mode');
assert.match(docsAndContent, /拼音赛车|赛道|小车/, 'docs should describe the pinyin racing mode');
assert.match(readme, /基础.*进阶.*完整|难度/, 'README should document the typing difficulty tiers');
assert.match(readme, /状态徽章|HUD|可见/, 'README should document that difficulty tuning is visible in the game HUD');
assert.match(readme, /发光|音效|即时反馈/, 'README should document difficulty switch feedback');
assert.match(readme, /金币|钻石|星星|武器升级|轮胎|氮气|引擎/, 'README should document prototype reward outputs');
assert.match(readme, /撞到.*结束|碰到.*爆炸|只有.*撞/, 'README should document that airplane battle ends only on enemy collision');
assert.match(docsAndContent, /GPT生图|GPT image|生图提示词/i, 'docs should include the GPT image design prompt direction');
assert.match(docsAndContent, /SVG|DOM|PNG|元素爆炸图/, 'docs should record which assets are SVG, DOM or PNG-generated');
assert.match(docsAndContent, /Snake|贪吃蛇/i, 'docs should record snake reference direction');
assert.match(readme, /拼音块收集台原型|本地语音|汉字跳台/i, 'README should explain hanzi voice reuse');
assert.doesNotMatch(JSON.stringify(content), /hanzi-jumper|跳台|跳跃/, 'content JSON should not expose the removed jumping game');

assert.ok(Array.isArray(content.games), 'content JSON should expose games array');
assert.equal(content.games.length, 3, 'content JSON should define three game cards');
assert.deepEqual(content.games.map(game => game.id), ['word-shooter', 'word-cannon', 'pinyin-snake'], 'game card order should match requested order');
assert.ok(content.games.every(game => game.title && game.description && game.image), 'each game card should have title, description and image');
assert.ok(Array.isArray(content.homeNotes), 'content JSON should expose child-facing home notes');
assert.ok(content.homeNotes.some(tip => /分开/.test(tip)), 'home notes should explain that English and pinyin modes stay separated');
assert.ok(content.homeNotes.some(tip => /愿意|多玩|熟悉键盘/.test(tip)), 'home notes should keep the low-pressure play goal');
assert.deepEqual(
  content.games.map(game => game.image),
  [
    './assets/generated/home-card-word-shooter.webp',
    './assets/generated/home-card-word-cannon.webp',
    './assets/generated/home-card-pinyin-snake.webp'
  ],
  'home cards should use the Agnes-generated game option images'
);

assert.ok(Array.isArray(typingView.cards) && typingView.cards.length >= 80, 'root typing view should still expose the official shared typing deck');
assert.match(typingView.sourceModuleId, /minecraft-vocab/, 'root typing view should still come from the official repo game vocab view');
assert.ok(typingView.cards.every(card => /^[a-z]{3,8}$/.test(card.word)), 'root typing view should keep short lowercase typing words');
assert.ok(Array.isArray(expandedTypingPack.cards) && expandedTypingPack.cards.length >= 300, 'expanded typing pack should expose the larger external Minecraft deck for prototype compatibility');
assert.equal(expandedTypingPack.sourceModuleId, 'minecraft-vocab-external', 'expanded typing pack should track the external source module');
assert.ok(expandedTypingPack.cards.some(card => card.sourceProvider === 'graded-vocab'), 'expanded typing pack should include the formal graded vocab cards');
assert.ok(expandedTypingPack.cards.some(card => /单词库_分级/.test(card.sourceRoot || '')), 'expanded typing pack should track the formal graded vocab source root');
assert.ok(Array.isArray(expandedTypingPack.packs) && expandedTypingPack.packs.length >= 5, 'expanded typing pack should expose selectable external vocab packs');
assert.ok(expandedTypingPack.packs.some(pack => pack.id === 'kindergarten' && pack.count > 100), 'expanded typing pack should include the kindergarten pack option');
assert.ok(expandedTypingPack.packs.some(pack => pack.id === 'elementary' && pack.count > 100), 'expanded typing pack should include the elementary pack option');
assert.ok(expandedTypingPack.packs.some(pack => pack.id === 'junior_high' && pack.count > 100), 'expanded typing pack should include the junior-high pack option');
assert.ok(expandedTypingPack.packs.some(pack => pack.id === 'minecraft' && pack.count > 100), 'expanded typing pack should include the Minecraft pack option');
assert.ok(unifiedTypingPack.packs.some(pack => pack.id === 'core-english' && pack.count >= 300), 'unified pack should include the core curriculum');
assert.ok(unifiedTypingPack.packs.some(pack => pack.id === 'extension-english' && pack.count >= 500), 'unified pack should include the verified extension curriculum');
assert.ok(unifiedTypingPack.packs.some(pack => pack.id === 'curriculum-all' && pack.count >= 800), 'unified pack should include the complete curriculum');
assert.ok(expandedTypingPack.cards.every(card => /^[a-z]{3,7}$/.test(card.word)), 'expanded typing pack should also keep short lowercase typing words');
assert.ok(expandedTypingPack.cards.some(card => card.sourcePackGroup === 'kindergarten'), 'expanded typing pack should contain kindergarten words');
assert.ok(expandedTypingPack.cards.some(card => card.sourcePackGroup === 'elementary'), 'expanded typing pack should contain elementary words');
assert.ok(expandedTypingPack.cards.some(card => card.sourcePackGroup === 'junior_high'), 'expanded typing pack should contain junior-high words');
assert.ok(expandedTypingPack.cards.some(card => card.level === 'basic'), 'expanded typing pack should include basic difficulty words');
assert.ok(expandedTypingPack.cards.some(card => card.level === 'intermediate'), 'expanded typing pack should include intermediate difficulty words');
assert.ok(expandedTypingPack.cards.some(card => card.level === 'full'), 'expanded typing pack should include full difficulty words');
assert.equal(sharedHanziVoiceManifest.prototypeId, 'pinyin-star-scout', 'learning arcade should reuse the pinyin prototype hanzi voice bundle');
['山', 'shān', '我们一起去爬**山**。'].forEach(key => {
  assert.ok(sharedHanziVoiceMap[key], `shared hanzi voice map should contain ${key}`);
});
const arcadeHanziVoiceKeys = [...new Set(
  Object.values(hanziQuestions.levels || {})
    .flat()
    .slice(0, 12)
    .flatMap(item => [item.char, item.pinyin, item.example])
    .filter(Boolean)
)];
assert.ok(arcadeHanziVoiceKeys.length >= 30, 'learning arcade should have a practical local hanzi voice coverage set');
arcadeHanziVoiceKeys.forEach(key => {
  const digest = sharedHanziVoiceMap[key];
  assert.ok(digest, `shared hanzi voice map should cover learning arcade line: ${key}`);
  assert.ok(fs.existsSync(path.join(sharedHanziVoiceDir, `${digest}.mp3`)), `shared hanzi voice mp3 should exist for ${key}`);
});

console.log('PASS - 学习机玩法原型验证');
