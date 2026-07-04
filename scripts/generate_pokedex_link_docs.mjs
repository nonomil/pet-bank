import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const docsDir = path.join(repoRoot, "docs", "图鉴探索联动");
const planDir = path.join(repoRoot, "docs", "plans");
const petsPath = path.join(repoRoot, "data", "pets.json");
const scenesPath = path.join(repoRoot, "data", "scenes.json");
const loreDataPath = path.join(repoRoot, "data", "pokedex-lore-draft.json");

fs.mkdirSync(docsDir, { recursive: true });
fs.mkdirSync(planDir, { recursive: true });

const petsDb = JSON.parse(fs.readFileSync(petsPath, "utf8"));
const pets = petsDb.flat || [];
const scenesDb = JSON.parse(fs.readFileSync(scenesPath, "utf8"));
const runtimeSceneNames = Object.fromEntries((scenesDb.scenes || []).map((scene) => [scene.id, scene.name]));
const generatedAt = new Date().toISOString();

const galleryMeta = {
  sunshine: {
    name: "阳光花园馆",
    subtitle: "经典植物 · 写实实验",
    sources: ["original", "pvz"],
    cardDoc: "04-卡片文案-阳光花园馆.md",
    summary:
      "负责植物镇、温室、实验田一带的图鉴调查，主打基础植物伙伴与写实观察对象。",
  },
  adventure: {
    name: "奇趣冒险馆",
    subtitle: "旅途族群 · 陪伴发现",
    sources: ["banchong"],
    cardDoc: "05-卡片文案-奇趣冒险馆.md",
    summary:
      "负责灵兽、旅行、山海、瑞兽等多族群冒险伙伴的档案补完，是探索系统的主力图鉴分馆。",
  },
  classroom: {
    name: "创想课堂馆",
    subtitle: "主题创作 · 风格练习",
    sources: ["classpet"],
    cardDoc: "06-卡片文案-创想课堂馆.md",
    summary:
      "负责课堂主题、幻想创作、像素实验、国潮灵感等创意宠物的文本整理与图鉴记录。",
  },
  blocky: {
    name: "方块生态馆",
    subtitle: "像素地貌 · 原版生态",
    sources: ["minecraft"],
    cardDoc: "07-卡片文案-方块生态馆.md",
    summary:
      "负责方块营地、红石工坊和像素生态区的观察记录，是地图探索和采集循环的重要支线。",
  },
};

const sourceToGallery = {
  original: "sunshine",
  pvz: "sunshine",
  banchong: "adventure",
  classpet: "classroom",
  minecraft: "blocky",
};

const rarityLabel = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

const seriesDisplayLabel = {
  PVZ: "经典植物线",
  pvz真实: "写实实验线",
};

const rolePrefix = {
  common: "见习",
  rare: "正式",
  epic: "资深",
  legendary: "首席",
};

const sceneMeta = {
  forest: {
    name: "神秘森林",
    chapter: "第一章 · 起点花园",
    chapterGoal: "学会观察与登记，让第一批伙伴进入图鉴馆。",
    mission:
      "图鉴馆委托你进入植物镇外侧的神秘森林，登记最基础也最常陪孩子成长的伙伴。",
    opening:
      "你背着空白图鉴册走进森林，树影间传来温室铃声，像是在提醒你第一份记录就要开始了。",
    discover:
      "在潮湿的树根边，你会捡到写有宠物线索的叶片标签，提示它们平时住在哪、爱做什么。",
    math:
      "数学谜题不再只是开路机关，而是“登记测试”：算对数量，图鉴馆才会确认你真的观察到了现场细节。",
    choice:
      "分岔路会让你决定先去水边还是花圃，不同路线会提前遇到不同风格的草木系伙伴。",
    encounter:
      "最终遭遇以植物镇基础宠物为主，战斗更像“接受登记考核”，证明你有资格把它写进图鉴。",
    ending:
      "战斗结束后，图鉴册会自动浮现该宠物的第一页档案，你也正式成为图鉴馆见习调查员。",
    focusSeries: ["PVZ", "萌宠风", "绒爪族", "守护系"],
  },
  beach: {
    name: "蔚蓝海滩",
    chapter: "第二章 · 森林边界",
    chapterGoal: "认识旅途型与海风型伙伴，学会从行为判断它们的个性。",
    mission:
      "图鉴馆要你前往蔚蓝海滩，调查喜欢远行和巡岸的伙伴，补齐“旅行习惯”和“社交方式”两栏。",
    opening:
      "海浪把一串写着宠物名字缩写的漂流瓶推到你脚边，说明今天会遇到愿意主动试探你的伙伴。",
    discover:
      "你会在沙滩、栈桥和贝壳堆里发现它们留下的爪印、羽毛和补给袋。",
    math:
      "这里的题目会变成分配贝壳、计算路程、整理补给，像真正的外勤登记练习。",
    choice:
      "不同选择会让你先接触双钳族、旅行族或外向型伙伴，影响之后的遭遇顺序。",
    encounter:
      "海边的宠物更擅长先观察你，打赢它们后，图鉴会补上“是否愿意和陌生人组队”这一项。",
    ending:
      "收卡后，海风会吹开图鉴页角，显示这只宠物最喜欢和谁一起远行。",
    focusSeries: ["旅行族", "双钳族", "酷肖族", "萌肖族"],
  },
  candy: {
    name: "糖果王国",
    chapter: "第二章 · 森林边界",
    chapterGoal: "记录梦境、创意与情绪表达型伙伴，建立图鉴馆的“想象力分馆”。",
    mission:
      "创想课堂馆希望你进入糖果王国，补完那些总被误解成“只会卖萌”的幻想型宠物档案。",
    opening:
      "甜雾里漂着会发光的便签纸，上面写着“先看它喜欢做什么，再判断它会不会战斗”。",
    discover:
      "你会发现糖纸折成的小地图、软糖脚印和梦境碎片，它们都在提示宠物的爱好与专长。",
    math:
      "这里的数学题更像配方题和分糖题，图鉴馆借此测试你能不能把“看起来可爱”翻译成“观察得准确”。",
    choice:
      "选择不同甜点路线，会遇到幻想风、绮梦族和萌宠风的不同代表。",
    encounter:
      "这些宠物不一定敌意强，但会用捉迷藏、镜像和错觉考验你是否真的认识它们。",
    ending:
      "收卡后，图鉴会解锁“喜欢被怎样夸奖”这一栏，让它们不再只是漂亮立绘。",
    focusSeries: ["幻想风", "绮梦族", "萌宠风"],
  },
  waterfall: {
    name: "彩虹瀑布",
    chapter: "第三章 · 海边集市",
    chapterGoal: "补完水系、清洁型与照料型伙伴的工作档案。",
    mission:
      "图鉴馆要你调查彩虹瀑布的照料型伙伴，确认它们在队伍里到底承担恢复、清洁还是引路职责。",
    opening:
      "瀑布边的雾气里悬着一排湿润标签，每张都写着“工作岗位尚未登记”，提醒你这一章要重点补完它们在队伍里的职责。",
    discover:
      "你会在石台、水潭和苔藓角落里找到它们的工具、储物袋和清洁痕迹。",
    math:
      "数学题会围绕水量、轮值和恢复次数，让图鉴记录更像真正的工作表。",
    choice:
      "你可以先去浅滩、瀑顶或洞口，不同路线会提前遇到温柔辅助型或谨慎守护型伙伴。",
    encounter:
      "它们的战斗更像“上岗考试”，打赢后会解锁“最适合和哪种伙伴组队”这一条。",
    ending:
      "收卡时，图鉴馆会把这只宠物归入“可靠后勤伙伴”栏目。",
    focusSeries: ["pvz真实", "绒爪族", "国潮风", "守护系"],
  },
  desert: {
    name: "沙漠绿洲",
    chapter: "第三章 · 海边集市",
    chapterGoal: "补完远行、敦煌、守望与耐力型伙伴的背景故事。",
    mission:
      "图鉴馆要你前往沙漠绿洲，记录那些擅长背负、引路与守望的宠物，让它们不再只剩稀有度标签。",
    opening:
      "风里夹着半张旧地图，提示你今天登记的不只是能力，还有它们如何穿越孤独与漫长旅程。",
    discover:
      "你会在驿站残墙、风化石柱和商队脚印之间找到宠物留下的故事线索。",
    math:
      "数学题以分水、计程、轮换补给为主，让每一次解题都像完成一次远行登记。",
    choice:
      "你可以选择跟商队、进壁画洞或追踪风铃，不同选择会先遇到旅行族、敦煌族或山海支线。",
    encounter:
      "沙漠宠物出场时更像守路人，打赢它们后才能知道它们究竟是在守护宝物，还是在等同伴归来。",
    ending:
      "收卡后，图鉴会自动补上一条“它曾经独自走过的路”。",
    focusSeries: ["敦煌族", "旅行族", "山海族"],
  },
  underwater: {
    name: "珊瑚王国",
    chapter: "第四章 · 高地洞窟",
    chapterGoal: "补完深水与双钳型伙伴的团队分工与守卫规则。",
    mission:
      "珊瑚王国的委托是查清楚哪些伙伴负责巡逻、哪些伙伴负责搬运、哪些伙伴是珊瑚区的守门人。",
    opening:
      "水泡里漂着来自图鉴馆的防水札记，提醒你这一次要特别留意“群体协作”字段。",
    discover:
      "珊瑚缝隙、沉船边和气泡轨迹都会透露宠物的行动规律与职能。",
    math:
      "题目改成分配贝珠、记录巡逻班次和计算氧泡数量，强化“观察之后再登记”。",
    choice:
      "路线会在珊瑚林、沉船仓和潮汐门之间切换，提前暴露不同宠物族群。",
    encounter:
      "海底宠物多半先用阵型试探你，打赢后图鉴会解锁它们“最信任的队友类型”。",
    ending:
      "收卡时，水面会映出它在珊瑚王国的岗位徽记，让图鉴不只写战力。",
    focusSeries: ["双钳族", "星瞳族", "我的世界"],
  },
  mountain: {
    name: "雪山之巅",
    chapter: "第四章 · 高地洞窟",
    chapterGoal: "补完灵兽、巡山者与耐寒型伙伴的成长经历。",
    mission:
      "图鉴馆需要你去雪山之巅查证：那些看起来很强的灵兽，到底是天生孤傲，还是长期守山训练的结果。",
    opening:
      "第一阵山风吹开图鉴页，露出“童年经历尚未登记”的空栏，暗示这章要更多关注伙伴的成长故事。",
    discover:
      "冰面抓痕、风铃石和旧巡山旗会提示宠物小时候住在哪里、受过谁的照顾。",
    math:
      "题目以绳索长度、雪橇人数和巡山时间为主，更贴近训练记录。",
    choice:
      "不同路线会让你先接触灵兽族、瑞兽族，或偏守护型的高地伙伴。",
    encounter:
      "山巅宠物擅长把战斗当作资格审查，只有赢过它，图鉴馆才承认你真的理解它的生活方式。",
    ending:
      "收卡后，图鉴会额外浮现“从小受过哪位前辈影响”。",
    focusSeries: ["灵兽族", "瑞兽族", "守护系"],
  },
  cave: {
    name: "水晶洞窟",
    chapter: "第四章 · 高地洞窟",
    chapterGoal: "补完隐藏型、守库型与洞窟观察者的档案。",
    mission:
      "图鉴馆怀疑许多水晶洞窟里的宠物并不爱主动现身，所以把“观察证据”这一章交给你补全。",
    opening:
      "洞口的石牌写着“别急着抓，先学会看”，说明这里的故事要靠耐心和推理推进。",
    discover:
      "反光矿石、掉落羽片和储物刻痕会提示宠物的作息和领地范围。",
    math:
      "数学题会围绕矿石数量、火把顺序和机关角度，让你像做一次洞窟考古登记。",
    choice:
      "你可以走矿道、回声道或旧仓道，分别对应像素风、山海族和守库型伙伴。",
    encounter:
      "洞穴里的宠物更强调“你有没有看懂我留下的线索”，战斗只是最后的确认步骤。",
    ending:
      "收卡后，图鉴页边会出现它藏起来的那一项真实习惯。",
    focusSeries: ["山海族", "像素风", "我的世界"],
  },
  castle: {
    name: "云端城堡",
    chapter: "第四章 · 高地洞窟",
    chapterGoal: "补完守护者、礼仪型与高位稀有宠物的责任档案。",
    mission:
      "云端城堡要求图鉴馆解释清楚：这些看似高冷的宠物为什么要守门、守序或守约。",
    opening:
      "你刚走进城门，阶梯尽头就亮起一枚馆徽，提醒你这章要重点登记“责任与岗位”。",
    discover:
      "徽章、值勤表和城堡回音都会透露宠物在这里承担的秩序工作。",
    math:
      "这里的题目偏向轮值、编队、座次与礼仪数量，像一份城堡值班记录。",
    choice:
      "路线会在塔楼、回廊和藏书厅之间切换，对应不同的守护与礼仪型伙伴。",
    encounter:
      "城堡宠物更像在审阅你的资格，打赢后才能得到真正的身份说明。",
    ending:
      "收卡时，图鉴会补出它“为什么选择守护这座城堡”的一句心声。",
    focusSeries: ["瑞兽族", "国潮风", "守护系", "科幻风"],
  },
  volcano: {
    name: "温暖火山",
    chapter: "第五章 · 星空终点",
    chapterGoal: "补完力量型、锻造型与极限环境伙伴的真实个性。",
    mission:
      "图鉴馆要你去火山地带纠正偏见：很多看起来暴躁的宠物，真实工作可能是锻造、照明或护送。",
    opening:
      "火山边的热流吹开图鉴馆的红封条，露出“请记录它温柔的一面”。",
    discover:
      "熔岩脚印、锻造台和热能晶石会提示它们平时如何工作、如何帮助队友。",
    math:
      "题目围绕温度、熔块、矿锭和轮班次数，让你在高压环境下做出可靠记录。",
    choice:
      "你可以走矿炉、火口边或余温洞，不同路线会遇到酷肖族、灵兽族和像素工坊支线。",
    encounter:
      "火山宠物的战斗像一场试火礼，打赢后才能读懂它外热内稳的真正性格。",
    ending:
      "收卡后，图鉴馆会把它归入“力量型但可托付”的高价值伙伴名单。",
    focusSeries: ["酷肖族", "灵兽族", "像素风"],
  },
  space: {
    name: "太空站",
    chapter: "第五章 · 星空终点",
    chapterGoal: "补完观测型、科幻型与星空分馆核心伙伴的职能档案。",
    mission:
      "太空站是星空终点的第一道门，图鉴馆要你补完这里的观测员、导航员和实验型宠物档案。",
    opening:
      "舷窗外的星轨和图鉴页上的空白轨道重叠，像是在提醒你：这里记录的是“方向感”和“判断力”。",
    discover:
      "你会在操控台、星图室和维护廊发现它们留下的观测笔记。",
    math:
      "题目改成轨道数量、补给配比和灯塔规律，让它看起来更像真正的太空站值班表。",
    choice:
      "不同舱段会先遇到星瞳族、科幻风或像素生态伙伴。",
    encounter:
      "这里的宠物很重视判断与秩序，打赢后才会把真正的导航数据交给你写入图鉴。",
    ending:
      "收卡时，图鉴会点亮它专属的星轨徽记。",
    focusSeries: ["星瞳族", "科幻风", "像素风", "我的世界"],
  },
  stargarden: {
    name: "星光花园",
    chapter: "第五章 · 星空终点",
    chapterGoal: "补完传说级、终章级与图鉴馆压轴伙伴的完整档案。",
    mission:
      "星光花园是图鉴馆最终登记地，只有在前面几章积累了足够记录，花园才会向你展示真正的压轴伙伴。",
    opening:
      "你翻开最后一册空白图鉴，花园里的光点自动聚成一句话：‘只记录战斗，是看不见真正伙伴的。’",
    discover:
      "每一朵星花、每一条光路都在补足宠物的来历、责任与愿望。",
    math:
      "题目围绕规律、节奏与群星排序，像是图鉴馆的毕业考核。",
    choice:
      "不同路径会提前接触瑞兽族、星瞳族和幻想终章伙伴。",
    encounter:
      "这里的宠物更像最终审稿人，它们会确认你是否真的把伙伴写成了有来历、有工作、有性格的人物。",
    ending:
      "收卡后，图鉴馆总册会补完它的终章档案，你也完成从见习调查员到正式记录员的升级。",
    focusSeries: ["瑞兽族", "星瞳族", "幻想风", "灵兽族"],
  },
};

const seriesLore = {
  PVZ: {
    region: "植物镇的晨露坡",
    schools: ["晨光学堂", "种子值日班"],
    workplaces: ["阳光温室", "花圃巡护站", "补给苗圃"],
    roles: ["守园员", "补给员", "巡苗员", "种植助教"],
    titles: ["阳光守望者", "清晨补给手", "花圃值日生"],
    childhood: [
      "总爱趴在花盆边听种子说悄悄话",
      "会在太阳升起前替大家把水壶排整齐",
      "习惯跟着管理员学习怎么照看新芽",
    ],
    lessons: ["植物观察", "补给整理", "花圃协作"],
    hobbies: ["清晨晒太阳", "整理种子盒", "给同伴准备小点心"],
    specialties: ["稳定补给和队伍续航", "观察叶片状态后及时提醒队友", "把植物系伙伴排成最舒服的队形"],
    abilities: ["晨光能量储存", "叶面护盾", "温室恢复节奏"],
    skills: ["阳光结晶", "叶脉提醒", "晨曦补给"],
    scenes: ["forest", "waterfall"],
  },
  "pvz真实": {
    region: "植物镇外侧的写实试验田",
    schools: ["实景观察课", "写实培育班"],
    workplaces: ["观察温室", "生态实验棚", "水雾苗圃"],
    roles: ["观察员", "生态记录员", "试验棚助理", "种植研究员"],
    titles: ["实景记录者", "温室观察员", "叶脉实验员"],
    childhood: [
      "从小跟着研究员辨认不同土壤和光线的差别",
      "最爱把叶片和种子一张张贴进观察册里",
      "小时候就能分清哪株植物今天需要额外照料",
    ],
    lessons: ["生态记录", "水雾调节", "观察笔记整理"],
    hobbies: ["擦拭玻璃温室", "收集叶形样本", "记录天气变化"],
    specialties: ["耐心观察细节", "把实验结果整理成明白的笔记", "在复杂环境里也保持稳定发挥"],
    abilities: ["实景拟态", "生长修正", "环境感知"],
    skills: ["实景共鸣", "叶面校准", "雾棚恢复"],
    scenes: ["waterfall", "forest", "castle"],
  },
  "我的世界": {
    region: "方块营地与红石工坊",
    schools: ["合成学社", "红石练习班"],
    workplaces: ["像素生态站", "矿洞前哨", "红石工坊"],
    roles: ["生态观察员", "合成助理", "矿道向导", "工坊巡查员"],
    titles: ["方块生态员", "红石小能手", "营地守望者"],
    childhood: [
      "从小就在方块营地学习怎么辨认昼夜和地形",
      "很早就会把材料分门别类收进不同箱子",
      "喜欢跟着前辈一起去矿道做路线标记",
    ],
    lessons: ["合成配方", "矿洞导航", "营地协作"],
    hobbies: ["整理储物箱", "测试机关", "在营地周围放路标"],
    specialties: ["地形记忆和路线判断", "在混乱环境里快速整理资源", "为队友准备安全撤离路线"],
    abilities: ["像素构筑", "红石共振", "营地定位"],
    skills: ["方块护栏", "红石脉冲", "营地回响"],
    scenes: ["cave", "space", "underwater", "volcano"],
  },
  灵兽族: {
    region: "云岚高地与灵风谷",
    schools: ["灵岚书院", "巡山试炼营"],
    workplaces: ["高地巡山站", "灵风观测台", "雪线前哨"],
    roles: ["巡山员", "风纹守望者", "试炼引路员", "高地记录官"],
    titles: ["高地守望者", "灵风巡山人", "云岚引路者"],
    childhood: [
      "会追着山风跑到天黑，直到把每条小路都记熟",
      "小时候最喜欢替前辈看守山口的风铃",
      "从小就学会在冰雪里辨认脚印和方向",
    ],
    lessons: ["山路记忆", "风纹判断", "守山礼仪"],
    hobbies: ["清晨巡山", "给风铃换新的系绳", "在高地练习长距离奔跑"],
    specialties: ["高地巡逻与预警", "在恶劣天气里保护队伍", "带领同伴穿越复杂地形"],
    abilities: ["灵风护体", "山纹共鸣", "高地震慑"],
    skills: ["云岚跃击", "巡山号角", "灵风护路"],
    scenes: ["mountain", "volcano", "stargarden"],
  },
  星瞳族: {
    region: "星灯巷与夜观台",
    schools: ["夜观学社", "星轨记录班"],
    workplaces: ["观星回廊", "轨道灯塔", "夜巡天台"],
    roles: ["观测员", "星图抄写员", "灯塔导航员", "夜巡记录员"],
    titles: ["群星观察者", "夜航导航员", "星轨抄写人"],
    childhood: [
      "小时候常趴在屋顶数星星，连云缝里的亮点都不想错过",
      "最喜欢帮大人整理观星记录和夜灯顺序",
      "从小就能靠星光判断天气和方向",
    ],
    lessons: ["星图辨认", "夜间巡逻", "灯塔导航"],
    hobbies: ["看星轨", "擦亮夜灯", "给图鉴页角画小星图"],
    specialties: ["观察细节和判断时机", "在夜色里保持稳定节奏", "给队友指出最安全的前进方向"],
    abilities: ["星轨感知", "月辉加护", "夜目锁定"],
    skills: ["星轨标记", "月辉安定", "灯塔引航"],
    scenes: ["space", "underwater", "stargarden"],
  },
  绮梦族: {
    region: "梦糖湾与绮梦工坊",
    schools: ["梦织学堂", "甜雾练习班"],
    workplaces: ["彩糖剧场", "梦境工坊", "香草庭院"],
    roles: ["梦织员", "舞台布景师", "甜雾引导员", "气氛设计师"],
    titles: ["梦境编织者", "甜雾小导演", "彩糖守梦人"],
    childhood: [
      "小时候最爱把糖纸折成小城堡，再邀请同伴一起演戏",
      "会把做过的梦全记在软绵绵的便签纸上",
      "从小就特别擅长用颜色和气味安慰别人",
    ],
    lessons: ["舞台想象", "情绪表达", "梦境整理"],
    hobbies: ["收集糖纸", "布置小剧场", "给伙伴准备惊喜装饰"],
    specialties: ["制造轻松氛围", "把复杂情绪说得更温柔", "用想象力帮队伍恢复状态"],
    abilities: ["甜雾造景", "梦光共鸣", "情绪安抚"],
    skills: ["绮梦幕布", "甜雾抱抱", "彩糖回声"],
    scenes: ["candy", "castle", "stargarden"],
  },
  萌肖族: {
    region: "年岁里与灯笼街",
    schools: ["节庆学堂", "团圆值日班"],
    workplaces: ["年礼铺", "节令驿站", "灯笼作坊"],
    roles: ["节令助手", "灯会向导", "年礼整理员", "街巷巡访员"],
    titles: ["节庆小帮手", "团圆向导", "灯会记录员"],
    childhood: [
      "小时候一到节日就主动帮忙贴彩纸和分点心",
      "喜欢跟着长辈学怎么照顾年幼的小伙伴",
      "总会在热闹的时候主动跑去维持秩序",
    ],
    lessons: ["节庆礼仪", "分工协作", "街巷照看"],
    hobbies: ["挂灯笼", "收集节日印章", "帮同伴挑礼物"],
    specialties: ["在热闹场合照顾大家", "把事情安排得井井有条", "用亲切的方式化解紧张气氛"],
    abilities: ["团圆气场", "福运鼓舞", "节奏安定"],
    skills: ["灯会召集", "福袋补给", "团圆守护"],
    scenes: ["forest", "beach", "candy"],
  },
  酷肖族: {
    region: "街潮码头与烈焰坡",
    schools: ["街头工坊", "节奏试炼班"],
    workplaces: ["坡道训练场", "码头巡逻队", "火口补给站"],
    roles: ["节奏领队", "坡道巡查员", "热场引导员", "行动队员"],
    titles: ["节奏领跑者", "热场先锋", "街潮行动员"],
    childhood: [
      "小时候就爱在斜坡上比谁跑得更快",
      "总想把最难的动作先练会，再教给其他人",
      "从小就不怕吵闹和热场，越紧张越能冷静下来",
    ],
    lessons: ["动作协调", "队伍带节奏", "场地巡查"],
    hobbies: ["练习新动作", "测试装备", "带队热身"],
    specialties: ["高压场景下快速行动", "帮队伍点燃士气", "在突发状况下保持冲劲和秩序"],
    abilities: ["爆发冲刺", "热场共振", "火线应答"],
    skills: ["热浪突进", "节拍引燃", "冲锋护场"],
    scenes: ["beach", "volcano", "castle"],
  },
  绒爪族: {
    region: "森语谷与柔叶营地",
    schools: ["森语学舍", "林间照护班"],
    workplaces: ["柔叶营地", "林间补给站", "溪谷看护屋"],
    roles: ["看护员", "林间陪跑员", "柔叶巡查员", "补给伙伴"],
    titles: ["柔叶看护员", "林间陪伴者", "小队安抚官"],
    childhood: [
      "小时候最喜欢躲在树洞里观察别的伙伴怎么相处",
      "总会主动把掉队的小伙伴带回营地",
      "很早就学会通过动作和语气安慰别人",
    ],
    lessons: ["陪伴沟通", "林间识路", "温和协助"],
    hobbies: ["整理睡垫", "照看幼苗", "陪同伴做练习"],
    specialties: ["陪伴和安抚", "保护队伍里最容易紧张的成员", "把混乱场面拉回温柔节奏"],
    abilities: ["安抚气场", "林语感知", "柔叶护持"],
    skills: ["绒爪拍肩", "柔叶安定", "林间回护"],
    scenes: ["forest", "waterfall", "candy"],
  },
  瑞兽族: {
    region: "瑞云台与星纹庭",
    schools: ["瑞云书院", "守约试炼营"],
    workplaces: ["祥瑞观礼台", "云庭巡守所", "终章花园门廊"],
    roles: ["守约官", "礼序守望者", "仪典巡守员", "终章见证者"],
    titles: ["祥瑞守序者", "终章见证者", "云庭巡守官"],
    childhood: [
      "小时候就被要求先学会守时守约，再学习更难的力量",
      "从小习惯在大典前一遍遍确认每个细节",
      "很早就明白“强大”也意味着要照顾秩序和规则",
    ],
    lessons: ["礼序守则", "守约训练", "仪典判断"],
    hobbies: ["整理徽记", "检查礼台", "帮年幼伙伴记规则"],
    specialties: ["守护秩序与约定", "在关键时刻稳定全队", "成为终章挑战里的可靠坐标"],
    abilities: ["祥瑞庇护", "誓约共鸣", "终章威压"],
    skills: ["瑞光立约", "云庭镇场", "终章护印"],
    scenes: ["mountain", "castle", "stargarden"],
  },
  山海族: {
    region: "古图峡与异闻书库",
    schools: ["异闻讲堂", "古图考证班"],
    workplaces: ["山海档案室", "古图巡检所", "洞窟考察站"],
    roles: ["异闻整理员", "古图看守员", "线索考证员", "遗迹向导"],
    titles: ["山海考证员", "古图守秘者", "异闻巡检官"],
    childhood: [
      "小时候就喜欢把奇怪的石头和旧纸片都带回家研究",
      "总缠着前辈讲那些看起来像传说的旧故事",
      "从小就分得清哪些线索值得再看一遍",
    ],
    lessons: ["遗迹观察", "异闻分类", "线索整理"],
    hobbies: ["抄古图", "比对纹路", "收集被遗漏的小故事"],
    specialties: ["把零散线索串成完整故事", "在复杂环境里找到关键证据", "替图鉴补完背景说明"],
    abilities: ["古纹识别", "异闻回响", "遗迹感知"],
    skills: ["古图显影", "异闻连线", "遗迹定标"],
    scenes: ["desert", "cave", "castle"],
  },
  守护系: {
    region: "前哨堡与护林边界",
    schools: ["守望班", "前哨协作营"],
    workplaces: ["护林前哨", "边界巡查站", "守门台"],
    roles: ["巡查员", "守门员", "护送官", "边界记录员"],
    titles: ["边界守护者", "前哨巡查员", "护送记录官"],
    childhood: [
      "小时候最在意谁落单了、谁需要被接回去",
      "从小就会把危险和安全区域记得特别牢",
      "总想先站到最前面看看有没有人需要帮忙",
    ],
    lessons: ["边界辨识", "队伍保护", "风险预警"],
    hobbies: ["巡逻", "做警示牌", "陪伙伴练习撤离路线"],
    specialties: ["护送和挡线", "为队伍建立安全感", "在关键时刻顶住压力"],
    abilities: ["守线屏障", "护送共鸣", "风险预警"],
    skills: ["前哨护壁", "守门站位", "护送回路"],
    scenes: ["forest", "waterfall", "mountain", "castle"],
  },
  双钳族: {
    region: "潮崖码头与珊瑚湾",
    schools: ["潮汐练习班", "搬运协作课"],
    workplaces: ["珊瑚搬运站", "潮口巡逻队", "码头储运所"],
    roles: ["搬运员", "潮口巡逻员", "甲壳护运员", "海湾整备员"],
    titles: ["潮崖搬运员", "珊瑚巡逻兵", "海湾护运官"],
    childhood: [
      "小时候就特别擅长一边横着走一边观察周围动静",
      "总会帮长辈把散落的贝壳和工具重新搬回去",
      "从小就知道什么时候该硬顶、什么时候该让路",
    ],
    lessons: ["搬运协作", "潮口守线", "海湾整理"],
    hobbies: ["收集亮贝", "整理货箱", "巡看潮口"],
    specialties: ["团队搬运与占位", "在水边地形里保持稳定", "帮队伍卡住最危险的空隙"],
    abilities: ["甲壳防线", "潮汐借力", "海湾稳场"],
    skills: ["潮口卡位", "甲壳顶线", "贝潮整备"],
    scenes: ["beach", "underwater"],
  },
  旅行族: {
    region: "风铃驿与长路市场",
    schools: ["地图学会", "远行整理班"],
    workplaces: ["驿站补给点", "路标修整所", "远行登记台"],
    roles: ["驿站向导", "路标修整员", "补给联络员", "旅程记录员"],
    titles: ["长路向导", "驿站联络员", "风铃记录者"],
    childhood: [
      "小时候就总想知道路的另一头还有谁在等自己",
      "会把每一次出门的路线都画在小本子上",
      "从小就学着为别人准备刚刚好的补给和提醒",
    ],
    lessons: ["路线记忆", "补给安排", "远行礼仪"],
    hobbies: ["画地图", "修路标", "收集旅人故事"],
    specialties: ["长途陪伴和行前准备", "替队伍判断路线节奏", "把远行里的陌生感变成安全感"],
    abilities: ["路标感知", "补给分配", "远行安定"],
    skills: ["路书展开", "风铃提醒", "驿站补给"],
    scenes: ["beach", "desert", "space"],
  },
  萌宠风: {
    region: "彩笔街与午后教室",
    schools: ["彩笔班", "午后陪伴课"],
    workplaces: ["教室收纳角", "绘本屋", "创作展示台"],
    roles: ["陪伴员", "绘本助手", "收纳小队长", "课堂鼓励官"],
    titles: ["午后陪伴者", "绘本小助手", "课堂鼓励官"],
    childhood: [
      "小时候最喜欢和同伴一起给绘本角色配声音",
      "总会第一个举手说自己愿意帮忙收拾桌面",
      "从小就特别擅长发现别人紧张时的小动作",
    ],
    lessons: ["课堂协作", "表达鼓励", "收纳整理"],
    hobbies: ["整理蜡笔", "读图画书", "帮同伴准备展示材料"],
    specialties: ["陪伴和鼓励", "把课堂气氛变轻松", "让小队在练习时更愿意合作"],
    abilities: ["暖场鼓励", "课堂安定", "陪伴续航"],
    skills: ["彩笔鼓劲", "绘本抱抱", "午后续航"],
    scenes: ["forest", "candy"],
  },
  幻想风: {
    region: "云糖阁与想象剧场",
    schools: ["幻想班", "故事拼贴课"],
    workplaces: ["想象剧场", "云糖展示厅", "灵感工坊"],
    roles: ["灵感布景师", "故事演员", "想象助手", "舞台巡演员"],
    titles: ["灵感布景师", "故事小演员", "云糖巡演员"],
    childhood: [
      "小时候会把任何一个盒子都想成新的冒险入口",
      "总喜欢把平凡小事讲成特别大的故事",
      "从小就擅长让周围的人一起进入同一个想象世界",
    ],
    lessons: ["故事拼接", "舞台表达", "灵感记录"],
    hobbies: ["布置场景", "给故事取名字", "收集奇怪又可爱的灵感"],
    specialties: ["营造想象空间", "让队伍保持好奇心", "把紧张时刻转成有趣体验"],
    abilities: ["幻景展开", "故事共鸣", "灵感回路"],
    skills: ["幻景开幕", "灵感串场", "故事安抚"],
    scenes: ["candy", "stargarden"],
  },
  像素风: {
    region: "方格实验室与拼块教室",
    schools: ["方格实验班", "像素搭建课"],
    workplaces: ["像素试验台", "拼块观测站", "模块整理室"],
    roles: ["拼块设计员", "模块观察员", "试验台助手", "结构整理员"],
    titles: ["方格实验员", "模块小工程师", "像素整理官"],
    childhood: [
      "小时候就喜欢把任何东西都按方格排整齐",
      "会因为一个小机关能正常运转高兴一整天",
      "从小就喜欢把复杂问题拆成一个个小步骤",
    ],
    lessons: ["结构分解", "模块搭建", "机关测试"],
    hobbies: ["搭机关", "拼地形", "重新摆放方格道具"],
    specialties: ["把复杂结构拆解清楚", "快速搭出稳定方案", "在迷路时找到最短的模块路径"],
    abilities: ["模块重组", "像素定标", "结构护持"],
    skills: ["方格重构", "模块定位", "像素稳场"],
    scenes: ["cave", "space", "volcano"],
  },
  科幻风: {
    region: "星环实验舱与发明街",
    schools: ["发明社", "星环练习班"],
    workplaces: ["实验舱", "导航台", "零件整理室"],
    roles: ["实验员", "导航助手", "装置维护员", "发明记录员"],
    titles: ["星环实验员", "装置维护官", "导航台助手"],
    childhood: [
      "小时候就会拆开坏掉的小装置看里面是怎么转的",
      "总爱问“如果把这个和那个放一起，会不会变得更好用”",
      "从小就喜欢拿纸片画各种还没被做出来的机器",
    ],
    lessons: ["装置维护", "导航逻辑", "零件管理"],
    hobbies: ["测试小发明", "画结构图", "替队友修工具"],
    specialties: ["用工具提高效率", "把观察结果转成清楚的方案", "在复杂系统里快速找故障点"],
    abilities: ["装置过载", "导航锁定", "能量校准"],
    skills: ["舱室校准", "导航扫描", "零件回路"],
    scenes: ["space", "castle"],
  },
  国潮风: {
    region: "纸灯戏台与水墨长街",
    schools: ["纸灯班", "纹样练习课"],
    workplaces: ["戏台后台", "纹样工坊", "长街巡演点"],
    roles: ["戏台助手", "纹样整理员", "巡演向导", "礼乐记录员"],
    titles: ["纸灯巡演员", "纹样记录者", "戏台守序员"],
    childhood: [
      "小时候最爱跟着大人学怎么摆好一场热闹的表演",
      "会一遍遍描同样的纹样，直到线条变得顺畅漂亮",
      "从小就明白一场好看的演出后面有很多细致准备",
    ],
    lessons: ["礼乐节奏", "纹样整理", "舞台协作"],
    hobbies: ["描纹样", "挂纸灯", "为表演整理道具"],
    specialties: ["把传统节奏和队伍合作结合起来", "在正式场合稳定发挥", "替队伍收住气场与秩序"],
    abilities: ["纹样护场", "纸灯安神", "礼乐共振"],
    skills: ["纸灯落位", "纹样护栏", "礼乐稳场"],
    scenes: ["waterfall", "desert", "castle"],
  },
};

const customLore = {
  "豌豆射手": {
    codexTitle: "植物镇快投手",
    subtitle: "晨光学堂速射班 · 先锋型伙伴",
    origin: "植物镇北边的练靶坡",
    childhood: "总爱把豆荚当弹丸练准头，越远的木靶越想先打中。",
    school: "晨光学堂速射班",
    work: "前哨练习场的见习快投手",
    hobby: "晨跑、擦拭训练木牌、和同伴比谁先命中远靶",
    specialty: "在危险刚出现时抢先压住前线节奏",
    ability: "连续射击与前线预警",
    intro:
      "豌豆射手是植物镇最典型的前排伙伴之一，擅长先发现危险、先站到队伍最前面。",
    story:
      "豌豆射手来自植物镇北边的练靶坡，从小就喜欢把豆荚当弹丸练准头。它小时候在晨光学堂的速射班上学，最喜欢和同伴比赛谁能先击中最远的木靶。毕业后它留在前哨练习场做见习快投手，负责在冒险队出发前帮大家测试防线。平时它喜欢晨跑、擦拭训练木牌，也最擅长在危险刚出现的时候用连续射击争取准备时间。",
    traits: ["反应快", "愿意打头阵", "训练认真", "很有责任感"],
    skills: [
      { name: "连珠快投", desc: "在短时间里连续投出豆荚，帮队伍争取开场优势。" },
      { name: "前哨提醒", desc: "总能第一时间发现前方动静，提醒同伴调整站位。" },
      { name: "木靶热身", desc: "战斗前越充分热身，命中节奏就越稳定。" },
    ],
    sceneId: "forest",
  },
  "向日葵": {
    codexTitle: "植物镇见习培育师",
    subtitle: "晨光学堂毕业生 · 白天型补给伙伴",
    origin: "植物镇南边的晨露坡",
    childhood: "从小跟着花圃管理员记录太阳升落，特别会观察天气和情绪变化。",
    school: "植物镇的晨光学堂",
    work: "温室里的见习培育师",
    hobby: "清晨晒太阳、整理补给篮、给伙伴准备阳光点心",
    specialty: "稳定补给和队伍续航",
    ability: "把储存的光能变成温暖结晶",
    intro:
      "向日葵是图鉴馆最适合做样板档案的伙伴之一，稳定、温暖，也最能代表“陪伴型宠物”的价值。",
    story:
      "向日葵来自植物镇南边的晨露坡，从小就跟着花圃管理员记录太阳升落，所以总能比别人更早发现天气和情绪的变化。它小时候在植物镇的晨光学堂上学，最爱把窗台上的种子盒排得整整齐齐，毕业后留在温室里做见习培育师，负责照看刚发芽的小苗。平时它最喜欢清晨晒太阳、整理补给篮，还会悄悄给准备出发的伙伴塞上一包阳光点心。遇到队伍紧张或体力下滑时，它最擅长把储存的光能变成温暖结晶，让大家重新打起精神。",
    traits: ["温暖靠谱", "晨光亲和", "补给意识强", "很会照顾同伴"],
    skills: [
      { name: "阳光结晶", desc: "把晨光压缩成柔亮结晶，稳定恢复伙伴体力与心情。" },
      { name: "温室点名", desc: "快速观察全队状态，优先照顾最紧张或最疲惫的伙伴。" },
      { name: "晨曦补给", desc: "清晨行动时效率最高，能让整支队伍更快进入好状态。" },
    ],
    sceneId: "waterfall",
  },
  "坚果墙": {
    codexTitle: "花圃前线挡位员",
    subtitle: "守园训练组 · 防线型伙伴",
    origin: "植物镇的石阶花圃",
    childhood: "小时候就喜欢坐在门口看人来人往，把每一级台阶都记得很熟。",
    school: "守园训练组",
    work: "花圃前线的挡位员",
    hobby: "打扫台阶、摆正护栏、陪年纪更小的伙伴练站位",
    specialty: "在最危险的时候顶住第一波冲击",
    ability: "前线挡位与护栏稳场",
    intro:
      "坚果墙最擅长把危险挡在后排之外，是植物镇孩子们最有安全感的基础伙伴。",
    story:
      "坚果墙来自植物镇的石阶花圃，从小就喜欢坐在门口看别人来来往往。它在守园训练组上学时，总是最后一个离开练习场，因为它坚持把每一条防线都站熟。现在它在花圃前线做挡位员，负责带着年纪更小的伙伴练习怎么守住第一波冲击。它平时喜欢打扫台阶、摆正护栏，也最擅长在最危险的时候顶住位置，让后排有时间准备。",
    traits: ["沉稳", "耐心", "很能抗压", "安全感强"],
    skills: [
      { name: "前线挡位", desc: "把最直接的冲击稳稳接住，保护后排输出空间。" },
      { name: "石阶定心", desc: "越是混乱的时候，越能稳住队伍节奏。" },
      { name: "护栏示范", desc: "常常一边战斗一边教年幼伙伴正确站位。" },
    ],
    sceneId: "forest",
  },
  "大嘴花": {
    codexTitle: "温室惊喜考官",
    subtitle: "捕捉练习班 · 爆发型伙伴",
    origin: "植物镇温室靠里侧的捕捉区",
    childhood: "小时候就能一口叼住被风吹跑的训练布，特别喜欢偷偷练习爆发时机。",
    school: "植物镇的捕捉练习班",
    work: "温室里的惊喜考官",
    hobby: "闭眼晒太阳、练习突然出手、观察新人会不会被吓到",
    specialty: "抓住空隙后突然爆发",
    ability: "高爆发咬合与时机判断",
    intro:
      "大嘴花的第一印象总是吓人一跳，但真正认识后会发现它其实很讲究时机与礼貌。",
    story:
      "大嘴花在植物镇的捕捉练习班很有名，因为它小时候就能一口叼住被风吹跑的训练布。它从小住在温室靠里侧，总爱安静地等到最合适的时候才突然出手。现在它在温室里做惊喜考官，专门负责测试见习调查员有没有认真观察周围。它平时最喜欢闭眼晒太阳，擅长抓住空隙、突然爆发，也因此总被写在“别只看外表”的图鉴备注里。",
    traits: ["爆发强", "很会等时机", "安静", "反差感大"],
    skills: [
      { name: "时机咬合", desc: "耐心等待最好的出手机会，再一次性完成爆发。" },
      { name: "闭眼感知", desc: "即使不四处张望，也能靠气流判断接近的目标。" },
      { name: "惊喜考核", desc: "常用突然现身的方式测试新人观察力。" },
    ],
    sceneId: "forest",
  },
  "寒冰射手": {
    codexTitle: "雾棚降温员",
    subtitle: "冷雾班毕业生 · 控场型伙伴",
    origin: "植物镇喷雾棚旁的冷雾走廊",
    childhood: "小时候最喜欢待在喷雾棚边看水珠凝结，越急的场面越想先让大家冷静下来。",
    school: "植物镇的冷雾班",
    work: "观察温室的降温员",
    hobby: "擦拭雾棚玻璃、记录温度变化、慢慢整理节奏",
    specialty: "先让局面慢下来，再替队伍争取准备时间",
    ability: "冷雾减速与节奏回稳",
    intro:
      "寒冰射手负责让队伍在混乱时重新冷静下来，是植物镇最受欢迎的控场型伙伴之一。",
    story:
      "寒冰射手在植物镇的冷雾班长大，小时候最喜欢待在喷雾棚边看水珠凝结。它比起一味冲锋，更擅长先让局面慢下来，再替同伴争取整理节奏的机会。现在它在观察温室做降温员，负责处理太热或太急躁的训练场。它喜欢擦拭雾棚玻璃、记录温度变化，也最擅长用冰凉但不刺人的方式让队伍重新找回秩序。",
    traits: ["冷静", "控场强", "节奏感好", "观察细致"],
    skills: [
      { name: "冷雾减速", desc: "让对方动作慢下来，给队伍更多准备时间。" },
      { name: "雾棚巡看", desc: "一边战斗一边注意全场节奏变化。" },
      { name: "清凉回神", desc: "在紧张过头时帮助伙伴快速冷静。" },
    ],
    sceneId: "waterfall",
  },
  "双发射手": {
    codexTitle: "双线补位手",
    subtitle: "连发训练组 · 节奏型伙伴",
    origin: "植物镇练习场旁的连发小屋",
    childhood: "小时候总想一口气做完两件事，因此早早练出了少见的双线节奏。",
    school: "晨光学堂的连发训练组",
    work: "练习场的双线补位手",
    hobby: "一边练准头一边和同伴聊天、帮大家补空档",
    specialty: "同时照看左右两侧的危险",
    ability: "双线连发与快速补位",
    intro:
      "双发射手最大的特点不是火力高，而是能同时顾到两个方向，让队伍更安心。",
    story:
      "双发射手小时候总想一口气做完两件事，因此在晨光学堂里练出了少见的双线节奏。它现在留在练习场做补位手，负责在队伍换位时填补空出来的位置。平时它喜欢一边练准头一边和同伴聊天，擅长同时照看左右两侧的危险，也很适合在混战里做稳定的多线输出。",
    traits: ["顾全两边", "节奏稳定", "健谈", "很会补位"],
    skills: [
      { name: "双线连发", desc: "一次照顾两个方向的敌情，减少后排压力。" },
      { name: "补位提醒", desc: "队友换位时能立刻补上空档。" },
      { name: "节奏陪练", desc: "平时常陪新人一起练习射击节奏。" },
    ],
    sceneId: "forest",
  },
  "樱桃炸弹": {
    codexTitle: "紧急清场员",
    subtitle: "果能实验组 · 爆裂型伙伴",
    origin: "植物镇果能实验棚",
    childhood: "小时候就知道自己不适合长时间守前线，更适合在真正危险时一击清场。",
    school: "植物镇的果能实验组",
    work: "花圃演练区的紧急清场员",
    hobby: "和伙伴排练撤离顺序、确认安全距离、准备紧急预案",
    specialty: "在最短时间内清掉一整片危险区域",
    ability: "果能引爆与危机处理",
    intro:
      "樱桃炸弹是植物镇少数专门负责“紧急情况处理”的伙伴，平时笑眯眯，关键时刻最果断。",
    story:
      "樱桃炸弹出生在果能实验组，从小就知道自己不适合长时间待在前线，而更适合在危急时刻一击清场。它小时候在实验棚里学会了怎么控制力量，避免误伤同伴。现在它负责花圃的紧急清场演练，平时最喜欢和伙伴一起排练“什么时候应该立刻出手”。它擅长短时间的大范围爆发，也因此被图鉴馆标注成“请在真正需要时再叫它”。",
    traits: ["果断", "爆发高", "责任心强", "平时很开朗"],
    skills: [
      { name: "果能引爆", desc: "在最短时间内清掉一整片危险区域。" },
      { name: "演练倒数", desc: "总会先确认队友是否已经撤到安全位置。" },
      { name: "紧急出动", desc: "只有真正危险的时候才会动用全力。" },
    ],
    sceneId: "forest",
  },
  "机枪豌豆": {
    codexTitle: "前线火力班长",
    subtitle: "强化连发组 · 压制型伙伴",
    origin: "植物镇强化连发组前排练区",
    childhood: "从小就不满足于普通射击，总爱想办法在同样时间里完成更多输出。",
    school: "强化连发组",
    work: "练习场前线的火力班长",
    hobby: "检查发射口、整理训练记录、带队做高频压制练习",
    specialty: "长时间保持高密度输出而不乱节奏",
    ability: "持续压制与班长口令",
    intro:
      "机枪豌豆是植物镇里少见的压制型老手，负责在高压时段守住整条防线。",
    story:
      "机枪豌豆从小就不满足于普通射击，总爱想办法让自己在同样时间里完成更多输出。它在强化连发组里长大，如今是练习场前线的火力班长，专门负责守住最容易被冲开的区域。平时它喜欢检查发射口和训练记录，擅长持续压制和高频输出，也最能代表“熟练以后再谈炫技”的老手气质。",
    traits: ["输出密度高", "老练", "可靠", "压制感强"],
    skills: [
      { name: "持续压制", desc: "用高频火力稳住敌人推进速度。" },
      { name: "班长口令", desc: "前线越混乱，它越能用口令帮队伍稳住。" },
      { name: "强化连发", desc: "长时间保持高密度输出而不乱节奏。" },
    ],
    sceneId: "waterfall",
  },
};

function hashValue(text) {
  return Array.from(String(text)).reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 1), 0);
}

function pick(list, seed, offset = 0) {
  return list[(seed + offset) % list.length];
}

function getSceneMeta(sceneId) {
  const meta = sceneMeta[sceneId];
  if (!meta) throw new Error(`missing scene meta for ${sceneId}`);
  return {
    ...meta,
    name: runtimeSceneNames[sceneId] || meta.name,
  };
}

function getSeriesDisplayName(series) {
  return seriesDisplayLabel[series] || series || "未分类";
}

function buildChildhoodStoryText(childhood) {
  const text = String(childhood || "").trim();
  if (!text) return "从小就喜欢观察身边伙伴的一举一动";
  if (text.startsWith("从小") || text.startsWith("小时候")) return text;
  return `从小${text}`;
}

function formatChildhoodDossierText(childhood) {
  return String(childhood || "")
    .trim()
    .replace(/^(从小|小时候)/, "")
    .trim();
}

function galleryIdForPet(pet) {
  return sourceToGallery[pet.source || "original"] || "adventure";
}

function seriesConfigForPet(pet) {
  return seriesLore[pet.series] || seriesLore[pet.source] || seriesLore.PVZ;
}

function buildGenericLore(pet) {
  const cfg = seriesConfigForPet(pet);
  const seed = hashValue(`${pet.id}-${pet.name}`);
  const sceneId = pick(cfg.scenes, seed, 1);
  const scene = getSceneMeta(sceneId);
  const school = pick(cfg.schools, seed, 2);
  const workplace = pick(cfg.workplaces, seed, 3);
  const role = `${rolePrefix[pet.rarity || "common"]}${pick(cfg.roles, seed, 4)}`;
  const title = pick(cfg.titles, seed, 5);
  const childhood = pick(cfg.childhood, seed, 6);
  const lesson = pick(cfg.lessons, seed, 7);
  const hobby = pick(cfg.hobbies, seed, 8);
  const specialty = pick(cfg.specialties, seed, 9);
  const ability = pick(cfg.abilities, seed, 10);
  const skillA = pick(cfg.skills, seed, 11);
  const skillB = pick(cfg.skills, seed, 12);
  const skillC = pick(cfg.skills, seed, 13);
  const intro = `${pet.name}来自${cfg.region}，现在是${workplace}的${role}，也是${scene.name}一带经常被图鉴馆记录到的代表伙伴。`;
  const story = `${pet.name}出生在${cfg.region}，${buildChildhoodStoryText(childhood)}。它小时候在${school}学习${lesson}，毕业后留在${workplace}担任${role}。平时它最喜欢${hobby}，也因此练出了一手${specialty}。当冒险者接近${scene.name}时，${pet.name}往往会主动出来确认对方是不是认真观察过周围环境，所以图鉴馆把它列为这一带最值得登记的伙伴之一。它真正让人佩服的地方，是能把${ability}稳定地用在照顾队伍、守护岗位或完成委托上，而不是只拿来炫耀力量。`;
  const traitA = specialty.split("与")[0];
  const traitB = hobby.length > 8 ? hobby.slice(0, 8) : hobby;
  const traitC = ability.length > 8 ? ability.slice(0, 8) : ability;
  return {
    id: pet.id,
    name: pet.name,
    series: pet.series,
    source: pet.source,
    rarity: pet.rarity,
    galleryId: galleryIdForPet(pet),
    codexTitle: `${pick(["图鉴记录员", "调查样本", "外勤伙伴", "分馆代表"], seed, 14)} · ${title}`,
    subtitle: `${school} · ${role}`,
    intro,
    origin: cfg.region,
    childhood,
    school,
    work: `${workplace}的${role}`,
    hobby,
    specialty,
    ability,
    sceneId,
    sceneName: scene.name,
    story,
    traits: [
      getSeriesDisplayName(pet.series),
      traitA,
      traitB,
      traitC,
    ],
    skills: [
      {
        name: skillA,
        desc: `利用${ability}帮助队伍完成${specialty}相关的工作，是${pet.name}最稳定的看家本领。`,
      },
      {
        name: `${scene.name}登记`,
        desc: `在${scene.name}接受调查员挑战时，会特别留意对方是否真的看懂了现场线索。`,
      },
      {
        name: skillC,
        desc: `把平时${hobby}练出的节奏转化成战斗与协作能力，让它在队伍里更有辨识度。`,
      },
    ],
  };
}

function buildLore(pet) {
  const custom = customLore[pet.name];
  if (custom) {
    const scene = getSceneMeta(custom.sceneId);
    return {
      id: pet.id,
      name: pet.name,
      series: pet.series,
      source: pet.source,
      rarity: pet.rarity,
      galleryId: galleryIdForPet(pet),
      codexTitle: custom.codexTitle,
      subtitle: custom.subtitle,
      intro: custom.intro,
      origin: custom.origin,
      childhood: custom.childhood,
      school: custom.school,
      work: custom.work,
      hobby: custom.hobby,
      specialty: custom.specialty,
      ability: custom.ability,
      sceneId: custom.sceneId,
      sceneName: scene.name,
      story: custom.story,
      traits: custom.traits,
      skills: custom.skills,
    };
  }
  return buildGenericLore(pet);
}

const loreEntries = pets
  .map((pet) => ({ ...pet, lore: buildLore(pet) }))
  .sort((a, b) => {
    const ga = galleryIdForPet(a);
    const gb = galleryIdForPet(b);
    if (ga !== gb) return ga.localeCompare(gb, "zh-CN");
    if ((a.series || "") !== (b.series || "")) return String(a.series || "").localeCompare(String(b.series || ""), "zh-CN");
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
  });

const sceneStoryDrafts = Object.entries(sceneMeta).map(([sceneId, meta]) => ({
  sceneId,
  sceneName: getSceneMeta(sceneId).name,
  chapter: meta.chapter,
  chapterGoal: meta.chapterGoal,
  focusSeries: meta.focusSeries.map(getSeriesDisplayName),
  mission: meta.mission,
  opening: meta.opening,
  discover: meta.discover,
  math: meta.math,
  choice: meta.choice,
  encounter: meta.encounter,
  ending: meta.ending,
}));

function groupByGallery(entries) {
  const grouped = {};
  for (const [galleryId] of Object.entries(galleryMeta)) grouped[galleryId] = [];
  for (const entry of entries) grouped[entry.lore.galleryId].push(entry);
  return grouped;
}

function toBulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildReadme() {
  return `# 图鉴探索联动文档包

> 生成时间：${generatedAt}
> 目标：把当前“积分 + 宠物养成 + 探索地图”改造成带有图鉴调查主线的轻量宠物收集冒险。

## 文档索引

- [00-方案分析总览](./00-方案分析总览.md)
- [01-世界观与主线设定](./01-世界观与主线设定.md)
- [02-图鉴档案字段设计](./02-图鉴档案字段设计.md)
- [03-探索剧情改造设计](./03-探索剧情改造设计.md)
- [04-卡片文案-阳光花园馆](./04-卡片文案-阳光花园馆.md)
- [05-卡片文案-奇趣冒险馆](./05-卡片文案-奇趣冒险馆.md)
- [06-卡片文案-创想课堂馆](./06-卡片文案-创想课堂馆.md)
- [07-卡片文案-方块生态馆](./07-卡片文案-方块生态馆.md)
- [08-探索故事-12场景](./08-探索故事-12场景.md)
- [09-网页合入实施计划](./09-网页合入实施计划.md)
- [10-测试与验收清单](./10-测试与验收清单.md)

## 这包文档做了什么

- 把项目重新定位成“图鉴馆委托调查冒险”
- 统一了 198 只宠物的卡片档案字段、介绍口径和故事模板
- 给 12 个探索场景写了与图鉴掉卡相联动的剧情草案
- 提前整理了网页合入位置、验证方式和验收清单

## 产出的配套数据

- 文档草案之外，还会同步生成 \`data/pokedex-lore-draft.json\`
- 后续网页如果要接入完整图鉴档案，可以直接从这份数据层继续推进
`;
}

function buildAnalysisDoc() {
  return `# 图鉴探索联动方案分析总览

> 生成时间：${generatedAt}
> 推荐方向：**B 混合推荐型**，保留当前地图、积分和养成主循环，把探索叙事改写成“图鉴馆委托调查”。

## 1. 当前项目底座已经具备的能力

- 探索故事已经外置到 \`data/stories/*.json\`
- 高危险场景已经支持 \`species\` 宠物敌人
- 战斗胜利已经能触发 \`CardCollection.addCard(...)\` 收卡
- 图鉴详情页已经有了“完整档案”方向的样板结构

这说明项目缺的不是“收卡机制”，而是**收卡的叙事意义**。

## 2. 这次改造的目标

把探索从“路上随便发生点事”升级成：

1. 图鉴馆派发调查委托
2. 进入不同场景寻找宠物线索
3. 通过观察 / 数学 / 选择 / 战斗完成登记考核
4. 打赢后获得该宠物卡片
5. 卡片详情页补完它的来历、学校、工作、喜好、特长、能力

这样形成真正的闭环：

\`任务打卡 -> 宠物成长 -> 探索调查 -> 打赢宠物 -> 收卡登记 -> 完成图鉴\`

## 3. 为什么不直接选“完整宝可梦化”

完整宝可梦化意味着：

- 低危险场景也要全面替换成宠物对战
- 现有 monster 体系要整体退场
- 探索奖励、掉率、数值和节奏都要重做

这会让当前已经跑通的演示主链路风险陡增。

## 4. 推荐方案的产品定位

推荐方案不是“完全复制宝可梦”，而是：

**成长积分系统里的图鉴调查冒险版主线**

它保留项目最特别的三个点：

- 家长 / 课堂场景下的成长积分主循环
- 宠物陪伴与长期养成
- 场景探索与图鉴收集的结合

## 5. 改造后用户会感知到的变化

- 探索故事有明确任务，不再像临时拼出来的随机文案
- 场景里遇到的宠物和图鉴里的卡片故事会互相解释
- 收到卡片后不再只多一张图，而是多一份“完整人物档案”
- 孩子会更容易理解“为什么要去这个场景、为什么要打这一场、为什么要收这张卡”

## 6. 本轮文档包输出范围

- 世界观与主线定位
- 图鉴字段设计
- 198 只宠物的第一版卡片介绍和卡片故事
- 12 个探索场景的图鉴调查版故事
- 网页合入计划
- 测试与验收清单

## 7. 后续落地顺序

1. 先把故事与文案资产准备齐
2. 再把图鉴详情从“单样板”升级成“统一数据驱动”
3. 再改 12 个探索场景文案
4. 最后做网页体验收口、测试和验收
`;
}

function buildWorldDoc() {
  const galleryLines = Object.values(galleryMeta).map(
    (gallery) => `- **${gallery.name}**：${gallery.summary}`
  );
  return `# 世界观与主线设定

## 1. 核心世界观

项目的新主线叫做：

**图鉴馆委托调查**

植物镇中央新开了一座图鉴馆，馆里保存着四大分馆的宠物档案，但许多卡片只有立绘、名字和稀有度，缺少真正的故事内容。玩家不是单纯去打怪，而是作为图鉴馆见习调查员，去各个场景帮忙补完宠物档案。

## 2. 主角身份

- 你不是传统勇者，而是“图鉴馆见习调查员”
- 你带着自己的宠物伙伴，去不同场景完成委托
- 每次委托的目标不是“扫清地图”，而是“找到代表宠物并完成登记考核”

## 3. 四大分馆

${galleryLines.join("\n")}

## 4. 五章主线节奏

1. **第一章 起点花园**
   - 认识植物镇基础伙伴
   - 学会看线索、做记录、完成第一次收卡
2. **第二章 森林边界**
   - 接触旅行型、幻想型和情绪表达型伙伴
   - 学会从行为判断性格
3. **第三章 海边集市**
   - 调查水系、远行系、敦煌系与照料型伙伴
   - 补完“工作岗位”和“长期经历”
4. **第四章 高地洞窟**
   - 接触守护型、高地型、遗迹型伙伴
   - 更强调责任、秩序和背景故事
5. **第五章 星空终点**
   - 进入最终调查阶段
   - 收集稀有与传说伙伴，补完终章图鉴册

## 5. 图鉴馆真正想登记的内容

图鉴馆并不只关心数值，它关心的是：

- 这只宠物来自哪里
- 它小时候是什么样
- 它在哪上学或学艺
- 它现在做什么工作
- 它喜欢什么
- 它擅长什么
- 它为什么会在这个场景出现
- 它愿不愿意和调查员合作

## 6. 改造后的探索意义

探索不再只是“走到场景里随机触发几段文案”，而是：

- 开场拿委托
- 中途找线索
- 解题证明你观察到了现场
- 做选择判断宠物习惯
- 通过战斗完成登记考核
- 收卡并解锁完整档案
`;
}

function buildFieldDoc() {
  return `# 图鉴档案字段设计

## 1. 为什么要补字段

当前图鉴详情页已经能展示故事、特征和技能，但真正要把探索和图鉴串起来，必须把“档案字段”定清楚，不然探索里拿到的是线索，图鉴里展示的却是另一套口径。

## 2. 推荐字段

每只宠物至少补完以下字段：

- \`codexTitle\`：图鉴称号
- \`subtitle\`：副标题，通常是学校 / 工作 / 类型
- \`intro\`：卡片介绍，1 句给孩子快速理解这只宠物
- \`origin\`：来自哪里
- \`childhood\`：从小的经历
- \`school\`：在哪上学 / 学艺
- \`work\`：现在做什么
- \`hobby\`：喜欢做什么
- \`specialty\`：擅长什么
- \`ability\`：能力是什么
- \`sceneId\`：推荐出现场景
- \`story\`：完整卡片故事
- \`traits\`：性格标签
- \`skills\`：代表技能

## 3. 字段分层

### A. 卡片页短信息

- 名称
- 稀有度
- 图鉴称号
- 一句卡片介绍

### B. 详情页正文

- 卡片故事
- 性格特征
- 代表技能
- 成长阶段
- 能力面板

### C. 探索联动字段

- 推荐出现场景
- 这只宠物为什么会在这里出现
- 打赢后图鉴解锁哪一栏说明

## 4. 本轮数据产物

本轮先生成一份 \`data/pokedex-lore-draft.json\` 作为草稿数据层：

- 先不要求全部立刻接入网页
- 但后续网页改造应优先复用这层数据
- 避免继续把长文案直接写死在 \`js/card-collection.js\`

## 5. 设计原则

- 写法要像“有身份的伙伴”，不是“会攻击的素材”
- 每只宠物都要有可被孩子复述的人物感
- 文案优先强调责任、兴趣、专长和场景关系
- 避免把所有宠物写成同一种语气
`;
}

function buildExplorationDesignDoc() {
  return `# 探索剧情改造设计

## 1. 当前问题

当前探索的基本结构已经完整：

- narrate
- discover
- math
- choice
- encounter

但这些文本大多只是“场景里发生了一点事”，还没有明确说明：

- 你为什么会来这里
- 你在调查谁
- 为什么打赢之后会掉一张宠物卡
- 图鉴页里新增的故事和这次探索有什么关系

## 2. 新结构：图鉴调查版探索

每个场景都改写成同一条主线：

1. **委托目标**
   - 图鉴馆告诉你，这一带有哪类宠物档案缺失
2. **开场叙事**
   - 说明这里的环境、馆方任务和调查重点
3. **发现事件**
   - 捡到宠物留下的工具、脚印、便签、路标、值班表等
4. **数学事件**
   - 不只是开路机关，而是“登记测试”
5. **选择事件**
   - 根据线索判断应该先去哪里、先看什么
6. **遭遇事件**
   - 宠物出现，像在确认你是否有资格把它写进图鉴
7. **战斗结束语**
   - 收卡、登记、补完档案

## 3. 低危区和高危区怎么处理

不建议这轮把所有场景都改成 100% 宠物战斗。

建议保留现有节奏：

- 低危险场景：以“调查基础伙伴”为主，战斗像轻量考核
- 高危险场景：更容易遇到真正的 \`species\` 宠物敌人
- 这样既保住现有数值和地图节奏，也能逐步强化“收卡冒险感”

## 4. 探索与图鉴的明确联动

- 场景里遇到的宠物，需要在图鉴里能找到对应卡片故事
- 图鉴里写到的“来自哪里、在做什么”，需要在场景线索里提前出现影子
- 这样孩子会觉得：
  - “我先在路上认识它”
  - “打赢后才知道它完整的来历”
  - “这张卡不是凭空掉出来的”

## 5. 这轮文本输出范围

- 12 场景的完整第一版调查主线草案
- 每个场景对应的重点系列
- 每个场景的开场 / 发现 / 数学 / 选择 / 遭遇 / 结束语
`;
}

function buildCardDoc(galleryId, entries) {
  const gallery = galleryMeta[galleryId];
  const groupedBySeries = entries.reduce((acc, entry) => {
    const key = entry.series || "未分类";
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const seriesSections = Object.entries(groupedBySeries)
    .sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
    .map(([series, seriesEntries]) => {
      const petBlocks = seriesEntries
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-CN"))
        .map((entry) => {
          const lore = entry.lore;
          return `### ${entry.name}

- 图鉴称号：${lore.codexTitle}
- 副标题：${lore.subtitle}
- 稀有度：${rarityLabel[entry.rarity || "common"]}
- 卡片介绍：${lore.intro}
- 来自哪里：${lore.origin || "待补完"}
- 小时候：${formatChildhoodDossierText(lore.childhood) || "待补完"}
- 学校 / 学艺：${lore.school || "待补完"}
- 现在的工作：${lore.work || "待补完"}
- 喜欢做什么：${lore.hobby || "待补完"}
- 擅长什么：${lore.specialty || "待补完"}
- 核心能力：${lore.ability || "待补完"}
- 推荐出现场景：${lore.sceneName}
- 性格标签：${lore.traits.join(" / ")}
- 代表技能：${lore.skills.map((skill) => skill.name).join(" / ")}

${lore.story}`;
        })
        .join("\n\n");

      return `## ${getSeriesDisplayName(series)}

${petBlocks}`;
    })
    .join("\n\n");

  return `# ${gallery.name} 卡片文案

> 分馆定位：${gallery.summary}
> 宠物数量：${entries.length}
> 适用范围：图鉴详情页、探索遭遇联动、后续数据接入

${seriesSections}
`;
}

function buildSceneDoc() {
  const sections = sceneStoryDrafts
    .map((scene) => {
      return `## ${scene.sceneName}

- 章节：${scene.chapter}
- 本章目标：${scene.chapterGoal}
- 重点系列：${scene.focusSeries.join(" / ")}
- 委托任务：${scene.mission}
- 开场文案：${scene.opening}
- 发现事件文案：${scene.discover}
- 数学事件文案：${scene.math}
- 选择事件文案：${scene.choice}
- 遭遇事件文案：${scene.encounter}
- 收卡结束语：${scene.ending}`;
    })
    .join("\n\n");

  return `# 探索故事 - 12 场景第一版文本

> 目标：把现有探索文案统一改写成“图鉴馆委托调查”口径。

${sections}
`;
}

function buildImplementationDoc() {
  return `# 网页合入实施计划

## 1. 文本资产先行

本轮已经准备好的文本资产包括：

- 世界观与主线定位
- 198 只宠物的第一版卡片介绍与卡片故事
- 12 场景的调查型探索文本
- \`data/pokedex-lore-draft.json\` 数据草稿

## 2. 建议接入顺序

### Phase 1

- 图鉴详情页优先从 \`data/pokedex-lore-draft.json\` 读取
- 先替换当前通用 fallback story
- 保留现有样式结构，避免 UI 同时大改

### Phase 2

- 把 12 个 \`data/stories/*.json\` 改写成图鉴调查版文本
- 保留事件结构 \`narrate / discover / math / choice / encounter\`
- 只替换正式文案和场景重点

### Phase 3

- 在战斗胜利反馈里增加“登记完成 / 图鉴补完”提示
- 让收卡反馈不只是一句掉落提示

### Phase 4

- 在图鉴页增加“推荐出现场景”或“来自哪一章”之类的辅助信息
- 让卡片与探索之间的联系更明显

## 3. 关键文件

- \`data/pokedex-lore-draft.json\`
- \`data/stories/*.json\`
- \`js/card-collection.js\`
- \`js/exploration-detail.js\`
- \`js/exploration.js\`
- 必要时补一个新的数据加载辅助模块

## 4. 风险点

- 当前 \`js/card-collection.js\` 已经在做较大重构，接数据层时要避免把已有 UI 改坏
- 探索文本改造要保持现有数学 / choice / encounter 结构不回归
- \`species\` 掉卡只在高危险场景更强，低危险场景的故事要解释“为什么也能认识基础伙伴”

## 5. 建议原则

- 先接数据，再做体验强化
- 先把“图鉴真的有故事”做实，再追加更多视觉提示
- 不在同一轮同时大改图鉴 UI、探索 UI 和数值节奏
`;
}

function buildQaDoc() {
  return `# 测试与验收清单

## 1. 文档与数据层验收

- \`docs/图鉴探索联动/\` 已生成完整文档包
- \`data/pokedex-lore-draft.json\` 能正常读取
- 198 只宠物都有完整第一版档案字段
- 12 个场景都有调查型探索文本

## 2. 图鉴页验收

- 点击宠物卡片后，详情页能显示专属故事，而不是统一通用模板
- 至少抽检：
  - 向日葵
  - 豌豆射手
  - 1 只灵兽族
  - 1 只星瞳族
  - 1 只课堂宠物
  - 1 只我的世界宠物
- 检查图鉴详情页里“场景来源 / 角色身份 / 能力描述”是否完整

## 3. 探索页验收

- 12 个场景的开场文本都改成“委托调查”口径
- discover / math / choice / encounter 都和图鉴调查目标有关
- 结束语能解释为什么获得这张卡

## 4. 联动验收

- 打赢 \`species\` 宠物敌人后，收卡提示和图鉴故事能互相对上
- 卡片故事里写到的“工作 / 场景 / 能力”，在探索文本里能找到对应线索

## 5. 回归测试建议

- 图鉴相关：
  - \`python prj/pet_pokedex_detail_layout.test.py\`
  - \`python prj/pet_gallery_home_refresh.test.py\`
- 探索相关：
  - 逐页手工打开 12 场景
  - 抽查至少 3 个高危险场景的掉卡闭环

## 6. 产品层最终感知

验收不只看“代码能跑”，还要看以下感受是否成立：

- 孩子能理解“为什么去这个场景”
- 孩子能理解“为什么这只宠物会在这里出现”
- 收到卡后会觉得“我认识了它”，而不是“我多了一张素材图”
`;
}

function buildPlanDoc() {
  return `# Pokedex Linked Exploration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the pet card story system and the exploration story system so the web app feels like a lightweight card-collecting creature adventure built around the existing growth loop.

**Architecture:** First move long-form pet dossier text into a dedicated data layer, then refit card detail rendering to consume that layer instead of ad hoc JS-only samples. After the detail page is data-driven, rewrite the 12 exploration scene texts around “pokedex investigation” missions while preserving the current event structure and species-card reward pipeline.

**Tech Stack:** Vanilla JS, JSON data files, static Markdown docs, local Python smoke tests, local browser validation

---

### Task 1: Lock the new text assets into the repo

**Files:**
- Verify: \`docs/图鉴探索联动/*.md\`
- Verify: \`data/pokedex-lore-draft.json\`
- Modify later if needed: \`scripts/generate_pokedex_link_docs.mjs\`

**Step 1: Run the generator**

Run: \`node scripts/generate_pokedex_link_docs.mjs\`

Expected: the docs folder and lore draft JSON refresh successfully.

**Step 2: Sanity-check generated pet coverage**

Run: \`@'\\nconst fs = require('fs');\\nconst d = JSON.parse(fs.readFileSync('data/pokedex-lore-draft.json','utf8'));\\nconsole.log(d.pets.length);\\n'@ | node\`

Expected: \`198\`

### Task 2: Add a failing regression for lore data loading

**Files:**
- Create: \`prj/pokedex_lore_data_contract.test.py\`
- Modify later: \`js/card-collection.js\`

**Step 1: Write the failing test**

Check that:

- \`data/pokedex-lore-draft.json\` exists
- card collection code references the lore data source or a planned production equivalent
- the sampled pets expose fields like \`intro\`, \`story\`, \`sceneName\`

**Step 2: Run the test to verify it fails**

Run: \`python prj/pokedex_lore_data_contract.test.py\`

Expected: FAIL before the runtime consumes the new data layer.

### Task 3: Refactor card detail to use the lore data layer

**Files:**
- Modify: \`js/card-collection.js\`
- Possibly create: \`js/pokedex-lore.js\` or inline loader helper
- Use: \`data/pokedex-lore-draft.json\` (or rename to final production file)

**Step 1: Load the lore JSON**

- Add a loader for the lore data
- Key by pet id and/or pet name
- Preserve the current sunflower sample behavior through the shared data layer

**Step 2: Replace fallback-only story assembly**

- Prefer loaded lore fields for:
  - codexTitle
  - subtitle
  - story
  - traits
  - skills
  - scene linkage
- Keep a minimal fallback only for pets missing data

**Step 3: Run the card regressions**

Run:
- \`python prj/pet_pokedex_detail_layout.test.py\`
- \`python prj/pet_gallery_home_refresh.test.py\`
- \`python prj/pokedex_lore_data_contract.test.py\`

Expected: PASS

### Task 4: Rewrite exploration story data around pokedex investigation

**Files:**
- Modify: \`data/stories/forest.json\`
- Modify: \`data/stories/beach.json\`
- Modify: \`data/stories/candy.json\`
- Modify: \`data/stories/waterfall.json\`
- Modify: \`data/stories/desert.json\`
- Modify: \`data/stories/underwater.json\`
- Modify: \`data/stories/mountain.json\`
- Modify: \`data/stories/cave.json\`
- Modify: \`data/stories/castle.json\`
- Modify: \`data/stories/volcano.json\`
- Modify: \`data/stories/space.json\`
- Modify: \`data/stories/stargarden.json\`

**Step 1: Write a failing text regression**

Create a test that asserts:

- story files mention the investigation / pokedex framing
- each scene has a consistent mission-like opening and a registration-style ending

**Step 2: Replace scene copy with the approved drafts**

- Preserve event ids
- Preserve event types
- Replace only formal scene text and top-level ending text

**Step 3: Re-run the story regression**

Expected: PASS

### Task 5: Improve in-app reward feedback after card acquisition

**Files:**
- Modify: \`js/app.js\`
- Possibly modify: \`js/exploration-detail.js\`

**Step 1: Add a lightweight “登记完成 / 图鉴补完” message path**

- When a species card is awarded, make the user-facing text sound like a completed pokedex registration rather than a generic drop

**Step 2: Verify no reward chain regression**

Manual checks:
- high-danger scene species win still adds the card
- text feedback now matches the pokedex investigation theme

### Task 6: Manual browser validation

**Files:**
- Verify runtime behavior in the local app

**Step 1: Start the local server**

Run: \`python -m http.server 8765 --bind 127.0.0.1\`

**Step 2: Validate card detail**

- Open \`宠物 -> 卡片图鉴\`
- Check several pets across multiple galleries
- Confirm detail copy feels like a real dossier

**Step 3: Validate exploration**

- Open multiple scenes
- Confirm the opening text now reads like a mission from the gallery
- Win at least one species battle and confirm reward copy matches the new framing

### Task 7: Final regression sweep

**Files:**
- Verify all touched runtime files and tests

**Step 1: Run targeted tests**

Run:
- \`python prj/pet_pokedex_detail_layout.test.py\`
- \`python prj/pet_gallery_home_refresh.test.py\`
- \`python prj/pokedex_lore_data_contract.test.py\`
- any new exploration story regression

**Step 2: Search for stale placeholder language**

Run:
\`rg -n "当前使用通用图鉴介绍模板|随便编|待补完|掉落:" js data docs -S\`

Expected: no stale user-facing fallback copy remains in the newly upgraded flows.
`;
}

function writeFile(relativePath, contents) {
  const absPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, contents, "utf8");
}

writeFile(path.join("docs", "图鉴探索联动", "README.md"), buildReadme());
writeFile(path.join("docs", "图鉴探索联动", "00-方案分析总览.md"), buildAnalysisDoc());
writeFile(path.join("docs", "图鉴探索联动", "01-世界观与主线设定.md"), buildWorldDoc());
writeFile(path.join("docs", "图鉴探索联动", "02-图鉴档案字段设计.md"), buildFieldDoc());
writeFile(path.join("docs", "图鉴探索联动", "03-探索剧情改造设计.md"), buildExplorationDesignDoc());

const galleryGroups = groupByGallery(loreEntries);
for (const [galleryId, items] of Object.entries(galleryGroups)) {
  writeFile(path.join("docs", "图鉴探索联动", galleryMeta[galleryId].cardDoc), buildCardDoc(galleryId, items));
}

writeFile(path.join("docs", "图鉴探索联动", "08-探索故事-12场景.md"), buildSceneDoc());
writeFile(path.join("docs", "图鉴探索联动", "09-网页合入实施计划.md"), buildImplementationDoc());
writeFile(path.join("docs", "图鉴探索联动", "10-测试与验收清单.md"), buildQaDoc());
writeFile(path.join("docs", "plans", "2026-07-04-pokedex-linked-exploration-implementation.md"), buildPlanDoc());

writeFile(
  path.join("data", "pokedex-lore-draft.json"),
  JSON.stringify(
    {
      generatedAt,
      world: {
        title: "图鉴馆委托调查冒险",
        premise:
          "植物镇图鉴馆委托调查员前往不同场景补完宠物档案，通过探索、判断、战斗与收卡完成整套图鉴记录。",
      },
      pets: loreEntries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        series: entry.series,
        source: entry.source,
        rarity: entry.rarity,
        ...entry.lore,
      })),
      scenes: sceneStoryDrafts,
    },
    null,
    2
  )
);

console.log(
  JSON.stringify(
    {
      generatedAt,
      docsDir: path.relative(repoRoot, docsDir),
      loreData: path.relative(repoRoot, loreDataPath),
      petCount: loreEntries.length,
      sceneCount: sceneStoryDrafts.length,
    },
    null,
    2
  )
);
