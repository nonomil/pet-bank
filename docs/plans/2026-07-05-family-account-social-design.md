# 家庭账号社交体系设计稿

## 目标

为当前 `pet-bank` 项目设计一套可落地的账号与社交升级路径，使产品从“单设备多孩子本地养成”升级为“多家长账号、多孩子、多家庭互动”的轻社交养成系统。

## 背景

当前仓库已经有：

- 纯前端 SPA 架构
- `localStorage` 持久化
- `js/profiles.js` 的多孩子本地切换
- `math-pk.js` / `hanzi-game.js` / `home.js` 等可复用玩法壳

但当前架构仍然不支持：

- 多账号登录
- 多设备恢复
- 邀请码注册
- 家庭成员协作
- 跨家庭好友关系
- 异步同题 PK

## 核心结论

### 1. 产品模型

推荐结构：

`家长账号 -> 家庭 -> 孩子 -> 宠物 -> 跨家庭好友/互动/PK`

### 2. 技术模型

推荐路线：

- 前端：保留当前静态 HTML + Vanilla JS
- 云端：Supabase Auth + Postgres + RLS + Edge Functions
- 本地：`profiles.js` 降级为“导入桥 + 本地缓存 + 离线兜底”

### 3. 社交模型

先做异步轻社交：

- 好友制，不做陌生人广场
- 串门、足迹、礼物、轻互动
- 数学同题异步 PK
- 汉字同题异步 PK

## 邀请码设计

邀请码必须拆成三类：

1. `注册邀请码`
2. `家庭邀请码`
3. `宠物好友码`

不要复用同一个 code 承担三种职责。

## MVP 范围

### 必做

- 家长账号注册 / 登录
- 家庭创建
- 家庭邀请协作家长
- 多孩子管理
- 本地 profile 导入
- 好友关系
- 串门
- 数学异步 PK

### 第二阶段

- 汉字异步 PK
- 动态流
- 礼物系统

### 暂不做

- 实时在线
- 聊天
- 陌生人广场

## 数据模型摘要

核心实体：

- `account_profiles`
- `households`
- `household_members`
- `children`
- `child_pet_state`
- `child_home_state`
- `child_friendships`
- `house_visits`
- `pk_matches`
- `pk_question_sets`
- `pk_attempts`

## 与当前代码的衔接

### 可沿用

- `js/profiles.js`
- `js/home.js`
- `js/math-pk.js`
- `js/hanzi-game.js`
- `js/leaderboard.js`

### 需新增

- `js/cloud-client.js`
- `js/auth.js`
- `js/household.js`
- `js/social.js`
- `js/profile-sync.js`
- `js/pk-service.js`

## 风险控制

1. 不一次重写全部前端模块
2. 不在第一版做实时在线
3. 不让 `localStorage` 继续扮演唯一真源
4. 先冻结关系模型，再开发交互

## 推荐实施顺序

1. 账号、家庭、多孩子云端化
2. 协作家长与好友关系
3. 小屋串门
4. 数学异步 PK
5. 汉字异步 PK

## 关联专题

- [家庭账号社交体系专题索引](../家庭账号社交体系/README.md)
- [方案总览](../家庭账号社交体系/01-方案总览.md)
- [数据模型与权限](../家庭账号社交体系/02-数据模型与权限.md)
- [分阶段落地计划](../家庭账号社交体系/03-分阶段落地计划.md)

