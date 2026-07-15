import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const levelsDir = path.join(root, 'data/story-packs/05-pixel-worlds-story/levels');

const specs = {
  'sci-fi': `
蓝色信号|光|月环补给站
光核碎片|核|云朵信号带
云桥航线|云|星尘维修区
推进器零件|修|漂浮温室
星芽微光|芽|轨道电梯
发光踏板|搭|双星桥
桥心电流|连|回家发射台
森林回声|森|量子花园
移动微光|微|月面车站
月面车票|月|流星厨房
能量果|能|回声电台
问候声音|声|机器人码头
迷路机器人|机|彩虹观景台
绿色箭头|方|星门候车室
三界旅行箱|旅|星云滑梯
安全滑道|安|记忆舱
朋友影像|友|维修月台
星桥缺口|桥|导航塔顶
绿色星标|标|星港新航线
森林航线|林|森林世界`,
  forest: `
圆脚印|森|萤火溪
发光露珠|水|树屋邮局
朋友信件|信|蘑菇谷
害羞小芽|芽|风铃瀑布
失声风铃|风|古树图书馆
故事书签|书|松果广场
小松鼠|友|雾林小桥
安静小桥|桥|花瓣车站
花瓣车|香|树洞诊所
受伤小鸟|鸟|风的广场
会飞叶片|叶|雨滴工坊
雨滴水车|水|蘑菇邮路
绿色信封|信|月光草坡
月亮草|月|萤火剧场
树叶舞台|舞|树冠缆车
树冠缆车|高|种子仓库
发光种子|种|守林人小屋
屋顶木片|木|森林望远台
远方方块光|远|三界树门
绿色光门|光|方块地下城`,
  block: `
村口路牌|方|矿洞火把路
安全火把|明|地下水渠
回家的水渠|水|红石工坊
红石机关|工|遗迹图书馆
旧地图|图|地下城星门
三界星门|门|木门小路
木门通道|路|方块农场
方块麦穗|麦|石砖广场
星星图案|星|水晶矿井
蓝色水晶|晶|轨道车站
轨道车|车|村民广场
村民信|信|深石瀑布
水帘方门|门|熔岩安全桥
安全石桥|桥|地底蘑菇园
发光蘑菇|花|红石钟楼
回家钟声|钟|旧矿车库
地下车票|票|回声石室
伙伴回声|声|星门前厅
三界光核|光|地下城新地图
回家门|家|真正的家`,
  detective: `
蓝光碎片|光|移动星图
移动星点|星|云桥脚印
云桥脚印|脚|维修区密码
星形密码|符|温室声音
星芽声音|声|消失的桥片
双星桥片|桥|森林蓝羽毛
星光蓝羽|羽|树屋暗号
重复叶符|叶|溪边露珠
配对露珠|露|蘑菇谷影子
神秘影子|影|方块村空箱
缺失方块|方|矿洞回声
三次回声|回|红石断点
红石连接|断|地下城旧地图
隐藏道路|图|三界徽章
三界徽章|徽|回家铃声
回家铃声|铃|最后光核
最后光核|核|门后的朋友
门后朋友|友|三界线索墙
三界线索墙|墙|侦探的回家信
回家光核|家|三个世界的家`
};

const npcByWorld = {
  'sci-fi': 'star_engineer',
  forest: 'forest_guide',
  block: 'block_builder',
  detective: 'detective_helper'
};

const worldFeel = {
  'sci-fi': '蓝色舱灯和轻轻的电流声',
  forest: '树叶、溪水和萤火虫的声音',
  block: '方块碰撞和远处的机关声',
  detective: '放大镜下闪动的线索光'
};

const worldAction = {
  'sci-fi': '把光线接回星图',
  forest: '用温柔的动作帮助森林朋友',
  block: '一步一步搭出安全的路线',
  detective: '把可靠的证据放回案件记录'
};

const actNames = ['发现问题', '收集线索', '遇到困难', '打开新路'];

function readSpecs(worldId) {
  return specs[worldId].trim().split('\n').map((line) => {
    const [clue, anchor, next] = line.trim().split('|');
    return { clue, anchor, next };
  });
}

function replaceLine(line, text) {
  return { ...line, text };
}

function createOpening(worldId, index, level, clue, next) {
  const act = actNames[Math.floor(index / 5)];
  if (worldId === 'detective') {
    return `案件记录来到第${index + 1}站：“${level.title}”出现了新的变化。我们要找到${clue}，看看它和${next}有什么关系。`;
  }
  return `${level.title}正在发生变化。现在是“${act}”的一步：我们要找到${clue}，再把线索送向${next}。`;
}

function createLines(worldId, index, level, lines, spec) {
  const activity = lines.find((line) => line.type === 'activity');
  const npc = npcByWorld[worldId];
  const action = activity?.actions || [];
  const task = (activity?.prompt || `完成${spec.clue}`).replace(/(，让[^，。！]+的线索显现出来[。！]?)+$/, '');
  const act = actNames[Math.floor(index / 5)];
  const opening = createOpening(worldId, index, level, spec.clue, spec.next);
  const result = worldId === 'detective'
    ? `线索被记录下来：${spec.clue}和${spec.next}之间出现了联系。案件向前推进了一步。`
    : `${spec.clue}被找到后，${spec.next}的方向亮了起来。${worldAction[worldId]}，新的道路出现了。`;
  const heroAfter = worldId === 'detective'
    ? `我把“${spec.anchor}”记在案件本上，这条证据不能漏掉。`
    : `原来“${spec.anchor}”也藏在这里。我们把它和地图上的光点连起来。`;
  const petAfter = worldId === 'detective'
    ? `我发现这不是一条孤单的线索，它正指向${spec.next}。`
    : `我听见${spec.next}传来的声音了，刚才的努力真的让它更近了。`;
  const guideAfter = worldId === 'detective'
    ? `先保留可靠的细节，下一站还会用到“${spec.clue}”的证据。`
    : `${spec.clue}让大家知道，${spec.next}不是远处的名字，而是一条可以走到的路。`;
  let close = worldId === 'detective'
    ? `我们把这条线索交给${spec.next}，下一份答案就在路上。`
    : `完成这一站后，${spec.next}的入口已经亮起。我们带着“${spec.anchor}”继续走。`;

  if (worldId === 'detective' && index === 4) close = '第一组线索拼好了：蓝光是被风暴打散的，不是被谁偷走的。';
  if (worldId === 'detective' && index === 9) close = '森林的绿色光种接住了蓝光，两个世界的线索终于连在一起。';
  if (worldId === 'detective' && index === 14) close = '三枚世界徽章排出了钥匙顺序，地下城星门可以被打开了。';
  if (worldId === 'detective' && index === 19) close = '案件结案：蓝光、绿种和方块钥匙都是同一枚回家光核留下的线索。';
  if (worldId === 'sci-fi' && index === 19) close = '绿色航线已经亮起，森林世界正在回应。我们带着修好的星图出发吧。';
  if (worldId === 'forest' && index === 19) close = '绿色光已经交给三界树门，方块地下城的入口在树根下亮了起来。';
  if (worldId === 'block' && index === 19) close = '三界光核合在一起，回家门终于打开了。三个世界的朋友一起说：欢迎回家！';

  const output = [...lines];
  if (index >= (worldId === 'sci-fi' ? 8 : worldId === 'forest' || worldId === 'block' ? 6 : 0)) {
    output[0] = replaceLine(output[0], opening);
  }
  if (output[1]?.type === 'dialogue') output[1] = replaceLine(output[1], `这里是“${level.title}”。我们的任务是“${task.replace(/[。！]$/, '')}”，先看清${spec.clue}，再决定下一步。`);
  if (output[2]?.type === 'dialogue') output[2] = replaceLine(output[2], `${worldFeel[worldId]}告诉我，${spec.clue}就在附近。`);
  if (output[3]?.type === 'dialogue') output[3] = replaceLine(output[3], `${worldId === 'detective' ? `在“${level.title}”案件里` : `在${level.title}`}，${act}不能只靠着急。我们要${worldAction[worldId]}，先处理${spec.clue}，也要照顾身边的朋友。`);
  if (activity) {
    activity.prompt = `${task.replace(/[。！]$/, '')}，让${spec.clue}的线索显现出来。`;
    if (action[0]) action[0].feedback = `${action[0].label}后，${spec.clue}出现了；${spec.next}的方向更清楚了。`;
    if (action[1]) action[1].feedback = `${action[1].label}让另一个细节亮起来：${spec.anchor}标记指向${spec.next}。`;
  }
  if (output[5]?.type === 'narration') output[5] = replaceLine(output[5], result);
  if (output[6]?.type === 'dialogue') output[6] = replaceLine(output[6], heroAfter);
  if (output[7]?.type === 'dialogue') output[7] = replaceLine(output[7], petAfter);
  if (output[8]?.type === 'dialogue') output[8] = replaceLine(output[8], guideAfter);
  if (output[9]?.type === 'dialogue') output[9] = replaceLine(output[9], `这件事提醒我们：${spec.clue}不是终点，它会把故事带到${spec.next}。`);
  if (output[10]?.type === 'dialogue' || output[10]?.type === 'narration') output[10] = replaceLine(output[10], close);
  return output;
}

for (const file of fs.readdirSync(levelsDir).filter((name) => name.endsWith('.json'))) {
  const filePath = path.join(levelsDir, file);
  const level = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const worldSpecs = readSpecs(level.worldId);
  const index = Number(level.levelId.match(/(\d+)$/)?.[1]) - 1;
  if (!worldSpecs[index]) throw new Error(`${file}: missing story spec`);
  const scenes = level.scenes.map((scene) => ({
    ...scene,
    lines: createLines(level.worldId, index, level, scene.lines || [], worldSpecs[index])
  }));
  fs.writeFileSync(filePath, `${JSON.stringify({ ...level, scenes }, null, 2)}\n`, 'utf8');
}

console.log('Rewrote pixel story content: 4 tracks / 80 levels');
