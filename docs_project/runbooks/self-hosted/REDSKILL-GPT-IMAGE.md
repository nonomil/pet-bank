# RedSkill 与 GPT 生图技能接入说明

> 更新日期：2026-07-16

## 当前状态

- RedSkill CLI 已安装到用户目录 `C:\Users\<user>\.redskill`，Windows 启动入口为 `C:\Users\<user>\.local\bin\redskill.cmd`。
- 商店中的 `gpt-image@1.0.0` 已安装到本项目的 `.codex/skills/gpt-image/`；该目录被 `.gitignore` 排除，不进入业务仓库和 Pages 制品。
- 安装包入口为 `gpt-image-prompt-web/SKILL.md`。它负责把需求整理成可复制到 ChatGPT 网页端的英文提示词、中文翻译和关键假设，不执行 API 生图。
- 项目实际生图继续使用 `.codex/skills/gpt-image-bee-workflow/` 和 `.codex/skills/gpt-image-ui-assets/`；它们负责 API 生成、素材拆分、透明度检查、manifest 和网页验收。

## Hermes 执行顺序

1. 先读取 `AGENTS.md`、本手册和 `docs_project/runbooks/self-hosted/MINECRAFT-VOCAB-LEARNING-HERMES.md`。
2. 需要设计提示词时使用 `gpt-image-prompt-web`，只把生成的提示词作为临时输入保存到 `tmp/`。
3. 需要真实生成图片时改用项目 `gpt-image-bee-workflow`，密钥只从本机 key 文档读取，禁止写入命令、日志、文档或 Git。
4. 生成后检查 PNG/WebP 尺寸、可解码性、透明通道、文字污染和语义命名，再更新正式 `manifest.json`。
5. 运行对应 Minecraft 词卡/UI 素材门禁和 Pages 制品组装；不要把 `.codex/skills`、提示词、原始响应、外部参考图或 key 发布。

## 常用命令

```powershell
$env:PYTHONIOENCODING = 'utf-8'
& "$HOME\.local\bin\redskill.cmd" list --dir "$PWD\.codex\skills"
& "$HOME\.local\bin\redskill.cmd" search gpt-image --limit 20
& "$HOME\.local\bin\redskill.cmd" install gpt-image --dir "$PWD\.codex\skills"
```

Windows 的 RedSkill 运行依赖 Python 3.11+。若终端报 `fcntl`、`os.getuid` 或 GBK 编码错误，先确认使用本机 `.local\bin\redskill.cmd` 和 `PYTHONIOENCODING=utf-8`；不要把 RedSkill 源码复制到项目业务目录。

## 合入边界

合入仓库的是本说明和已有项目生图流程的引用关系；RedSkill CLI、用户级 lockfile、商店缓存和 `.codex/skills/gpt-image/` 不合入 Git。这样部署 AI 在有 RedSkill 的开发机上可以生成网页版提示词，在无 RedSkill 的 Hermes/服务器环境中仍能按项目现有脚本完成可验证的 API 生图。
