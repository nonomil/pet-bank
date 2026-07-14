import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const manifestPath = path.join(packRoot, 'manifest.json');
const promptRoot = path.join(root, 'tmp', 'pixel-worlds-prompts');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const worldBriefs = {
    'sci-fi': '明亮现代的科幻儿童像素游戏场景，青蓝全息光、珊瑚橙平台、玻璃穹顶、圆润安全的科技设施',
    forest: '明亮现代的森林儿童像素游戏场景，清澈溪流、鲜绿色树冠、暖黄色阳光、圆润木质设施和少量友好的科技信标',
    block: '明亮现代的原创方块建造儿童游戏场景，干净的方块地形、木头、石头、玻璃、水、青色晶体和琥珀色灯光，不使用任何现成游戏角色或标志',
    detective: '明亮现代的像素侦探小游戏场景，青色全息线索面板、暖木色工作台、珊瑚色标记、清晰可观察的证据物件，安全而有趣',
};

const characterByTrack = {
    'sci-fi': ['hero', 'pet', 'star_engineer'],
    forest: ['hero', 'pet', 'forest_guide'],
    block: ['hero', 'pet', 'block_builder', 'cave_keeper'],
    detective: ['hero', 'pet', 'detective_helper'],
};

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function scenePath(trackId, levelId) {
    return `assets/story/pixel-worlds-v1/scenes/${trackId}/${levelId}.webp`;
}

function promptFor(trackId, node, level) {
    const title = level?.title || node.label || node.levelId;
    const subtitle = node.subtitle || '';
    const task = node.prompt || level?.scenes?.[0]?.lines?.find((line) => line.type === 'activity')?.prompt || '发现一个新的故事线索';
    return [
        'Use case: illustration-story',
        'Asset type: reusable 16:9 background for a children\'s pixel dialogue story',
        `Primary request: ${title}${subtitle ? `，${subtitle}` : ''}。画面要自然呈现这个节点的活动：${task}`,
        `Scene/backdrop: ${worldBriefs[trackId]}`,
        'Style/medium: polished pixel-inspired 3D illustration, crisp chunky forms, clean readable silhouettes, bright contemporary children\'s game art, subtle pixel edges, not retro or muddy',
        'Composition/framing: wide 16:9 scene, the important action and clue objects in the middle and sides, leave a calm darker-but-readable lower area for an HTML dialogue box, no characters with cropped faces',
        'Lighting/mood: bright welcoming daylight or colorful soft sci-fi light, playful curiosity, safe for ages 5-7',
        'Constraints: the scene must be visibly different from every other node; show the specific place, object, route, or action implied by the title and task; no embedded interface',
        'Avoid: text, letters, numbers, Chinese characters, pinyin, fake writing, logos, watermark, copied game characters, horror, dark muddy colors, empty generic backgrounds',
    ].join('\n');
}

function makeGeneratedLevel(trackId, node, existing) {
    const background = scenePath(trackId, node.levelId);
    if (existing) {
        const next = { ...existing };
        next.worldId = trackId;
        next.scenes = (next.scenes || []).map((scene, index) => ({
            ...scene,
            background,
            sceneId: scene.sceneId || `${node.levelId}-scene-${index + 1}`,
            sceneAssets: {
                ...(scene.sceneAssets || {}),
                characters: [...new Set((scene.lines || []).map((line) => line.character).filter(Boolean))],
                props: [`assets/story/pixel-worlds-v1/props/${trackId}/${node.levelId}.webp`],
            },
        }));
        next.background = background;
        return next;
    }

    const characters = characterByTrack[trackId] || characterByTrack.detective;
    const actor = characters[2];
    const task = node.prompt || '找到故事里的新线索';
    const actions = node.actions || [
        { label: '仔细观察', feedback: '你发现了新的线索，故事继续向前走。' },
        { label: '和伙伴商量', feedback: '伙伴点点头，大家一起找到安全的办法。' },
    ];
    return {
        levelId: node.levelId,
        chapterId: node.levelId,
        worldId: trackId,
        title: node.label || node.levelId,
        rewards: { growthPoints: trackId === 'detective' ? 3 : 5 },
        scenes: [{
            sceneId: `${node.levelId}-scene-1`,
            background,
            sceneAssets: {
                characters: ['narrator', 'hero', 'pet', actor],
                props: [`assets/story/pixel-worlds-v1/props/${trackId}/${node.levelId}.webp`],
            },
            lines: [
                { type: 'narration', text: `小小探险家来到${node.label || '新的地方'}。${task}，新的线索正在等着被发现。`, character: 'narrator' },
                { type: 'dialogue', text: `我们先看看周围，再决定怎样帮助这里的朋友。`, character: 'hero', position: 'left' },
                { type: 'activity', activityType: node.activityType || 'scan', prompt: task, character: actor, position: 'right', actions },
                { type: 'dialogue', text: '做完这一小步，回家的星图又亮了一格。我们继续出发吧！', character: 'pet', position: 'right' },
            ],
        }],
    };
}

function collectTracks() {
    return [
        ...(manifest.worlds || []).map((world) => ({ ...world, trackId: world.id })),
        ...(manifest.bonusTracks || []).map((track) => ({ ...track, trackId: track.id })),
    ];
}

ensureDir(promptRoot);
const assetIndex = [];
for (const track of collectTracks()) {
    const trackId = track.trackId;
    for (const node of track.nodes || []) {
        const levelPath = path.join(packRoot, 'levels', `${node.levelId}.json`);
        const existing = fs.existsSync(levelPath) ? JSON.parse(fs.readFileSync(levelPath, 'utf8')) : null;
        const nextLevel = makeGeneratedLevel(trackId, node, existing);
        writeJson(levelPath, nextLevel);
        node.background = scenePath(trackId, node.levelId);
        node.sceneAssets = {
            characters: characterByTrack[trackId] || characterByTrack.detective,
            props: [`assets/story/pixel-worlds-v1/props/${trackId}/${node.levelId}.webp`],
        };
        const promptPath = path.join(promptRoot, `${node.levelId}.txt`);
        fs.writeFileSync(promptPath, `${promptFor(trackId, node, nextLevel)}\n`, 'utf8');
        assetIndex.push({ levelId: node.levelId, trackId, background: node.background });
    }
}

manifest.levelCount = (manifest.worlds || []).reduce((sum, world) => sum + world.nodes.length, 0);
manifest.bonusLevelCount = (manifest.bonusTracks || []).reduce((sum, track) => sum + track.nodes.length, 0);
manifest.assetPlan = {
    version: '20260714-scenes-v1',
    scenePolicy: 'one-independent-background-per-node',
    sceneCount: assetIndex.length,
    index: assetIndex,
};
manifest.characters.detective_helper = {
    id: 'detective_helper',
    name: '线索小助手',
    voicePreset: 'lively_teacher',
    labelStyle: 'friend',
    sprite: 'assets/story/pixel-worlds-v1/characters/detective-helper.webp',
};
writeJson(manifestPath, manifest);
writeJson(path.join(promptRoot, 'asset-index.json'), assetIndex);
console.log(`PREPARED scenes=${assetIndex.length} prompts=${assetIndex.length} levels=${manifest.levelCount} bonus=${manifest.bonusLevelCount}`);
