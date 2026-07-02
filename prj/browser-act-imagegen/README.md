# browser-act 生图下载工具

> 基于 browser-act CLI 接管 ChatGPT 网页生图 + Fandom 抓官方图，自动下载、抠图（白→透明）、转 webp。
> 2026-07-01 在「宠物积分系统」跑通：MC 怪物 13 + PVZ 角色 38 + 小屋背景 6 + 卡牌边框文档。

---

## 环境要求
- Python 3.12+（建议 uv 管理）
- uv 包管理器
- **Google Chrome 标准版**（CentBrowser 等第三方 Chromium 不支持）
- browser-act-cli + browser-act skill

## 安装
```bash
# 1. browser-act CLI（uv 自动拉 Python 3.12）
uv tool install browser-act-cli --python 3.12

# 2. browser-act skill（给 Claude Code / Cursor 等 agent 用）
npx skills add browser-act/skills --skill browser-act

# 3. 验证
browser-act get-skills core --skill-version 2.0.2
```

---

## 核心流程

### A. ChatGPT 生图（chrome-direct 绕 Cloudflare）
```
创建 chrome-direct 浏览器（控制用户 Chrome）
  → open session navigate chatgpt.com（chrome-direct 用真人 Chrome 信誉绕 Cloudflare）
  → input prompt + Enter
  → 轮询等新图（记录生图前 img 数 N0，等 estuary img 数 > N0）
  → eval fetch 图 URL → canvas 转 webp → sessionStorage base64
  → 分段取 base64（40KB/段）→ 解码 → 抠图（白→透明）→ 存
```

### B. Fandom 抓官方图（Python，不耗 ChatGPT 额度）
- `Special:FilePath/{Name}.png?format=original`
- 必须 header：**Referer（具体 wiki 页面）+ Sec-Fetch-* + UA**（curl 会拿空 body）
- 文件名不规则，试变体（`_HD` / 标准 / 去符号 / `_PvZ2` / 数字）

### C. 抠图（白→透明）
- Python PIL：`ImageChops.difference(图, 纯白)` → `point(阈值<22 → alpha 0)` → putalpha

---

## 脚本清单（scripts/）

| 脚本 | 用途 |
|------|------|
| `fetch_mc_idle.py` | Fandom 抓 MC 怪物 idle（minecraft wiki，Python+header） |
| `fetch_legends.py` | Fandom 抓 herobrine 等传说角色 |
| `fetch_pvz.py` | Fandom 抓 PVZ 角色（pvz wiki） |
| `fetch_pvz_fail.py` | PVZ FAIL 角色文件名变体重抓 |
| `fetch_pvz_hd.py` | PVZ 小图重找更大版本 |
| `gen_pvz_hd.sh` | ChatGPT 生 PVZ HD（chrome-direct，含轮询+下载+抠图） |
| `gen_mc_happyattack.sh` | ChatGPT 生 MC happy/attack 动作图 |
| `keyout_pvz.py` / `keyout_mc.py` / `keyout_entity303.py` | 批量抠图白→透明 |
| `activate_window.ps1` | PowerShell 激活 Chrome 窗口到前台 |

> 脚本里 `PROJ` / `WORK` 是硬编码路径，迁移到别的项目时改成自己的。

---

## ⚠️ 踩过的坑（13 个）

1. **browser-act chrome 类型是 headless**：即使加 `--headed` 也不弹可见窗口。要手动操作浏览器时，用 `chrome-direct`（控制用户 Chrome，窗口可见）或 `remote-assist`（需 BrowserAct API key，免费注册）。

2. **Cloudflare 拦截**：ChatGPT / MC Wiki / NameMC 都拦 browser-act 的 chrome（被检测自动化）。**解法**：`chrome-direct` 控制用户正在用的 Chrome（真人浏览器信誉，绕过 ChatGPT Cloudflare）。

3. **import-profile 多 profile 冲突**：导入 Default profile 时，Profile 1 同时运行会报错 `230205`。**解法**：`taskkill //F //IM chrome.exe` 关所有 Chrome，再用 `--allow-restart-chrome`。

4. **CentBrowser 不支持**：browser-act 只认 Google Chrome 的 User Data，CentBrowser 等 Chromium 第三方浏览器 profile 用不上（路径/CDP 都不同）。

5. **remote debugging 持久配置**：`--allow-restart-chrome` 会改 Chrome Local State 开 remote debugging（关 Chrome + 重启）。这是**持久配置**（只监听本机，风险低，但用完想关回要手动改 Local State）。

6. **轮询 bug（生图重复）**：取「最新 estuary img」没等**新**图出现，ChatGPT 还在生图就取了上一张 → 多张 size 完全相同（重复）。**解法**：记录生图前 img 数 `N0`，轮询 `arr.length > N0` 才取。

7. **wait stable 误判生图完成**：ChatGPT 生图 spinner 期间 network 短暂 idle，`wait stable` 提前返回（图还没好）。**解法**：用 img 计数轮询，不依赖 `wait stable` 判生图完成。

8. **图片下载需登录态**：ChatGPT 图 URL 在 chatgpt.com 域，curl 拿不到（要 cookie）。**解法**：browser-act `eval fetch`（浏览器内，带 cookie）→ canvas 转 webp → base64。

9. **eval 输出有大小限制**：base64 大图（>20KB）直接 eval 返回会截断/丢。**解法**：存 sessionStorage，分段（40KB/段）eval `slice` 取回，拼接解码。

10. **白底 vs 透明**：ChatGPT 默认生白底，Fandom 原图是透明 PNG。要统一透明，ChatGPT 图需抠图（PIL ImageChops，白色 → alpha 0）。

11. **Fandom 反爬（curl 拿空 body）**：curl 拿到 HTTP 200 + Content-Type 但 SIZE=0。**解法**：Python `urllib` + `Referer`（具体 wiki 页面，不是根域名）+ `Sec-Fetch-Dest/Mode/Site` header。

12. **Fandom 文件名不规则**：`Special:FilePath/Wall-nut.png` 可能 404（实际文件名 `Wallnut.png` 或带版本号）。**解法**：试 `_HD` / `_PvZ2` / 数字 / 去连字符 / `in-game` 等变体；部分角色 Fandom 只有 96×96 小 sprite，无 HD 版。

13. **ChatGPT 额度**：免费版 ~5 张/天就到顶，Plus 额度高但批量上百张仍要分天/换号。

---

## FAQ

**Q: browser-act 的 Chrome 窗口看不到？**
A: chrome 类型是 headless（后台无窗口）。要可见窗口用 `chrome-direct`（控制你的 Chrome），或 `remote-assist`（需 API key）。

**Q: ChatGPT 被 Cloudflare 拦（Just a moment / `__cf_chl_rt_tk`）？**
A: 换 `chrome-direct` 模式（控制用户正在用的 Chrome，真人浏览器信誉绕过）。headless 的 chrome 类型绕不过。

**Q: 批量生图，多张完全一样（重复）？**
A: 轮询 bug。记录生图前的 img 数 `N0`，轮询条件 `arr.length > N0`（等**新**图出现），而不是取「最新」。

**Q: ChatGPT 生的是白底，项目要透明？**
A: Python 抠图：`ImageChops.difference(img, white)` → `point(lambda x: 0 if x<22 else 255)` → `putalpha`。简单阈值，角色纯白高光可能误删（不满意就用 ChatGPT 重生时 prompt 加 `transparent background`）。

**Q: Fandom 图 curl 报 403 或拿空 body？**
A: 别用 curl。Python `urllib` 加 `Referer`（具体角色页面 URL）+ `Sec-Fetch-*` header。

**Q: Fandom `Special:FilePath/XXX.png` 报 404？**
A: 文件名不对应。试 `_HD` / `_PvZ2` / 数字 / 去连字符变体；实在没有说明该角色 Fandom 只有小 sprite，考虑 ChatGPT 生 HD。

**Q: import-profile 报 profile 冲突（Error 230205）？**
A: `taskkill //F //IM chrome.exe` 关所有 Chrome 进程，再 `import-profile ... --allow-restart-chrome`。

**Q: ChatGPT 额度到顶（生不出图）？**
A: 免费版 ~5 张/天。换 Plus 账号，或分天批量。换号：新建 chrome 浏览器 + import 另一个 profile。

**Q: 想让用户手动过 Cloudflare / 登录？**
A: `browser-act --session <name> remote-assist --objective "..."`，但**需要 BrowserAct API key**（免费注册 browseract.com）。没 key 只能用 chrome-direct 让用户在自己 Chrome 操作。

---

## 使用示例

最小生图（ChatGPT 单张）：
```bash
# 1. 创建 chrome-direct 浏览器（首次，占用户 Chrome）
browser-act browser create --name "gen" --type chrome-direct --desc "生图"

# 2. open + 生 + 下载（参考 gen_mc_happyattack.sh 的循环结构）
browser-act --session s1 browser open <browser_id> "https://chatgpt.com"
# input prompt + 轮询 N0 + eval fetch + base64 分段 + keyout
```

Fandom 批量抓：
```bash
python scripts/fetch_pvz.py   # 改 mobs 字典 + PROJ 路径
```

抠图：
```bash
python scripts/keyout_mc.py   # 改 glob 模式 + PROJ
```
