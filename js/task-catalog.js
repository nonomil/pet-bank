(function (global) {
    'use strict';

    const DIMENSIONS = {
        learning: {
            name: '学习力', en: 'Learning', icon: 'book-open',
            tasks: [
                { name: '阅读 20 分钟', pts: 1 },
                { name: '练字一页', pts: 1 },
                { name: '背诵一首古诗', pts: 2 },
                { name: '完成英语听写', pts: 2 },
                { name: '数学专项练习', pts: 2 },
                { name: '写日记', pts: 2 }
            ]
        },
        sports: {
            name: '运动力', en: 'Sports', icon: 'bike',
            tasks: [
                { name: '运动 30 分钟', pts: 1 },
                { name: '跳绳 100 个', pts: 2 },
                { name: '户外跑步', pts: 2 },
                { name: '球类运动 1 小时', pts: 2 },
                { name: '骑行 5 公里', pts: 3 },
                { name: '早起晨练', pts: 2 }
            ]
        },
        selfcontrol: {
            name: '自控力', en: 'Self-control', icon: 'clock',
            tasks: [
                { name: '屏幕时间不超过 2 小时', pts: 2 },
                { name: '整理书桌', pts: 1 },
                { name: '制定明日计划', pts: 1 },
                { name: '按时起床', pts: 1 },
                { name: '独立完成作业', pts: 2 },
                { name: '无需提醒洗漱', pts: 1 }
            ]
        },
        exploration: {
            name: '探索力', en: 'Exploration', icon: 'compass',
            tasks: [
                { name: '观察一种植物', pts: 1 },
                { name: '学做一道新菜', pts: 3 },
                { name: '阅读一本新书', pts: 2 },
                { name: '记录一个好奇点', pts: 1 },
                { name: '绘制一张地图', pts: 2 },
                { name: '探索家附近新路线', pts: 1 }
            ]
        },
        practice: {
            name: '实践力', en: 'Practice', icon: 'wrench',
            tasks: [
                { name: '帮做家务', pts: 1 },
                { name: '整理房间', pts: 1 },
                { name: '浇花/养宠物', pts: 1 },
                { name: '垃圾分类投放', pts: 1 },
                { name: '洗自己的衣物', pts: 2 },
                { name: '做一道家常菜', pts: 3 }
            ]
        },
        petcare: {
            name: '守护力', en: 'Pet Care', icon: 'paw-print',
            tasks: [
                { name: '喂食（按宠物种类按时喂）', pts: 2 },
                { name: '清理宠物窝/笼', pts: 2 },
                { name: '陪伴玩耍 15 分钟', pts: 2 },
                { name: '健康检查（观察状态）', pts: 1 },
                { name: '遛宠物（如适用）', pts: 3 },
                { name: '给宠物梳毛/抚摸', pts: 1 },
                { name: '记录宠物成长日记', pts: 2 }
            ]
        }
    };

    const HOME_PRIORITY_TASKS = [
        { dim: 'learning', task: '阅读 20 分钟', pts: 1, hint: '读完就能继续点开喜欢的栏目。' },
        { dim: 'sports', task: '运动 30 分钟', pts: 1, hint: '活动一下，再去冒险会更有精神。' },
        { dim: 'selfcontrol', task: '屏幕时间不超过 2 小时', pts: 2, hint: '守住今天的小习惯，也算一次成长。' }
    ];

    const POINT_TASK_ART = {
        guide: 'assets/ui/points-exchange/kidstar-guide.webp',
        reading: 'assets/ui/points-exchange/kidstar-reading.webp',
        writing: 'assets/ui/points-exchange/kidstar-writing.webp',
        math: 'assets/ui/points-exchange/kidstar-math.webp',
        sports: 'assets/ui/points-exchange/kidstar-sports.webp',
        clock: 'assets/ui/points-exchange/kidstar-clock.webp',
        tidy: 'assets/ui/points-exchange/kidstar-tidy.webp',
        explore: 'assets/ui/points-exchange/kidstar-explore.webp',
        petcare: 'assets/ui/points-exchange/kidstar-petcare.webp',
        cooking: 'assets/ui/points-exchange/kidstar-cooking.webp'
    };

    function getPointTaskArt(task) {
        const text = `${task.dim || ''} ${task.dimName || ''} ${task.name || task.task || ''}`;
        if (/数学|算|口算|计算|专项/.test(text)) return POINT_TASK_ART.math;
        if (/练字|日记|写|听写|抄写/.test(text)) return POINT_TASK_ART.writing;
        if (/阅读|背诵|古诗|英语|学习力|新书/.test(text)) return POINT_TASK_ART.reading;
        if (/运动|跳绳|跑步|骑行|球|晨练|户外/.test(text)) return POINT_TASK_ART.sports;
        if (/起床|屏幕|计划|自控|提醒|赖床|时间|按时|独立完成/.test(text)) return POINT_TASK_ART.clock;
        if (/整理|家务|房间|书桌|清理|垃圾|玩具|分类|衣物/.test(text)) return POINT_TASK_ART.tidy;
        if (/做菜|新菜|家常菜|厨房/.test(text)) return POINT_TASK_ART.cooking;
        if (/宠物|喂食|梳毛|抚摸|遛宠物|宠物窝|清理宠物|陪伴玩耍|健康检查|成长日记|守护力/.test(text)) return POINT_TASK_ART.petcare;
        if (/探索|观察|植物|地图|路线|好奇|记录/.test(text)) return POINT_TASK_ART.explore;
        return POINT_TASK_ART.guide;
    }

    global.PetBankTaskCatalog = Object.freeze({ DIMENSIONS, HOME_PRIORITY_TASKS, POINT_TASK_ART, getPointTaskArt });
})(typeof window !== 'undefined' ? window : globalThis);
