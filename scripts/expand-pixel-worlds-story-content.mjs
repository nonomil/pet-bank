import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));
const tracks = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])];

const guideByWorld = {
    'sci-fi': 'star_engineer',
    forest: 'forest_guide',
    block: 'block_builder',
    detective: 'detective_helper'
};

const worldBeats = {
    'sci-fi': {
        pet: '我听到光核在轻轻嗡鸣，信号就在附近。',
        guide: '先看清蓝色航线，再做一个安全的小动作。',
        discover: '扫描光点后，隐藏的星尘轨迹露出来了。',
        connect: '把这条轨迹和星图接起来，下一站就会亮起。',
        remember: '记住这束光，它会带我们穿过下一段星际航线。'
    },
    forest: {
        pet: '我闻到了叶子和雨水的味道，森林朋友就在附近。',
        guide: '先听树叶的声音，再用温柔的动作帮助这里的朋友。',
        discover: '轻轻完成这一步，藏在叶影里的小路出现了。',
        connect: '把这条小路和森林地图连起来，萤光就会为我们领路。',
        remember: '记住这片叶子的形状，下一次遇见它就知道该往哪里走。'
    },
    block: {
        pet: '我听到方块碰撞的声音，新的建造点就在前面。',
        guide: '先找稳固的方块，再一步一步搭出安全的路线。',
        discover: '方块放稳后，藏在墙后的通道露出来了。',
        connect: '把这段通道接到村子的道路上，伙伴们就能一起通过。',
        remember: '记住这块特别的方块，它会成为下一座建筑的起点。'
    },
    detective: {
        pet: '我发现了一点不一样的声音，线索可能就在转角后面。',
        guide: '小侦探先观察，再选择一条最可靠的线索。',
        discover: '线索被照亮了，细小的痕迹终于连成了一条路。',
        connect: '把证物和故事顺序排好，答案就离我们更近了。',
        remember: '记住这个细节，下一次推理时它会成为关键提示。'
    }
};

function line(type, text, character, position) {
    const result = { type, text, character };
    if (position) result.position = position;
    return result;
}

function expandLevel(level, node, track) {
    const scene = level.scenes && level.scenes[0];
    if (!scene || !Array.isArray(scene.lines)) return false;
    const originalNarration = scene.lines.find((item) => item.type === 'narration') || { text: `新的线索在${node.label}附近发光。`, character: 'narrator' };
    const originalActivity = scene.lines.find((item) => item.type === 'activity');
    const originalEnding = [...scene.lines].reverse().find((item) => item.type === 'dialogue') || line('dialogue', '线索记下来了，我们继续出发吧！', 'pet', 'right');
    if (!originalActivity) return false;

    const guide = guideByWorld[track.id] || 'detective_helper';
    const beat = worldBeats[track.id] || worldBeats.detective;
    const label = node.label || level.title || '这个地方';
    const subtitle = node.subtitle || '新的线索';
    const prompt = originalActivity.prompt || node.prompt || '完成这一次小互动。';
    const firstAction = originalActivity.actions?.[0]?.label || node.actions?.[0]?.label || '仔细观察线索';

    scene.lines = [
        originalNarration,
        line('dialogue', `这里就是${label}。我们先把“${subtitle}”记在地图上。`, 'hero', 'left'),
        line('dialogue', beat.pet, 'pet', 'right'),
        line('dialogue', beat.guide, guide, 'left'),
        Object.assign({}, originalActivity, { prompt }),
        line('narration', `小小探险家完成了第一步，${firstAction}让周围的线索变得清楚起来。`, 'narrator'),
        line('dialogue', `看！刚才藏起来的线索露出来了。`, 'hero', 'left'),
        line('dialogue', beat.discover, 'pet', 'right'),
        line('dialogue', beat.connect, guide, 'left'),
        line('dialogue', beat.remember, guide, 'left'),
        originalEnding
    ];
    level.storyVersion = 2;
    return true;
}

let updated = 0;
for (const track of tracks) {
    for (const node of track.nodes || []) {
        const file = path.join(packRoot, 'levels', `${node.levelId}.json`);
        if (!fs.existsSync(file)) continue;
        const level = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (expandLevel(level, node, track)) {
            fs.writeFileSync(file, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
            updated += 1;
        }
    }
}
console.log(`Expanded ${updated} pixel-world levels to ten story beats.`);
