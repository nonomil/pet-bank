# TTS 语音服务

为宠物积分系统提供文本转语音（TTS）能力，支持**实时生成**（动态文本：战斗伤害、数学题、随机事件）和**预生成**（固定文本批量出 MP3）两种模式。

引擎降级链：**VoxCPM2（GPU 最高音质）→ edge-tts（云端，需联网）→ 前端 Web Speech（浏览器兜底）**。

---

## 三级方案

按需选择，从简到繁：

### 方案 ① 不启动服务（前端浏览器兜底）

前端 `voice.js` 默认走浏览器 **Web Speech API**，无需任何后端。适合离线/无 GPU/不想装依赖的场景，音质一般但零成本。

### 方案 ② edge-tts 实时服务（推荐起步）

云端引擎，**无 GPU 也能跑，需联网**。约 1-2 秒/句。

```bash
cd prj/tts
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
python tts_server.py
```

启动后访问 `http://127.0.0.1:9885/health`，返回 `{"ok":true,"voxcpm2":false,"edge":true,"gpu":false}` 即正常。

前端语音设置面板填：`http://127.0.0.1:9885`

### 方案 ③ VoxCPM2 最高音质（需 NVIDIA GPU）

自然语言描述音色，音质最佳。要求 **NVIDIA GPU（≥8GB 显存）** + 独立虚拟环境。

```bash
# 在单独的虚拟环境里装（不进默认 requirements，因为要 torch）
python -m venv D:/PythonEnvs/tts-voxcpm
D:/PythonEnvs/tts-voxcpm/Scripts/activate
pip install voxcpm torch soundfile
```

然后告诉实时服务这个环境的 python 在哪（环境变量）：

```bash
# Windows PowerShell
set VOXCPM2_PYTHON=D:/PythonEnvs/tts-voxcpm/Scripts/python.exe
# Git Bash
export VOXCPM2_PYTHON="D:/PythonEnvs/tts-voxcpm/Scripts/python.exe"
```

重启 `python tts_server.py`，`/health` 的 `voxcpm2` 变为 `true` 即生效。`engine=auto` 时自动优先用 VoxCPM2，失败降级 edge-tts。

> **首次运行 VoxCPM2 需下载模型（数 GB）**。国内直连 HuggingFace 易卡死，**务必设镜像**：
> ```bash
> # Git Bash（启动 tts_server 前执行，子进程会继承）
> export HF_ENDPOINT=https://hf-mirror.com
> # Windows CMD
> set HF_ENDPOINT=https://hf-mirror.com
> # 仍慢可加 HF_TOKEN（huggingface.co 注册免费 token）解除匿名限速
> ```
> 也可手动预下载验证（用 VoxCPM2 虚拟环境）：
> ```bash
> "D:/PythonEnvs/tts-voxcpm/Scripts/python.exe" -c "import os; os.environ['HF_ENDPOINT']='https://hf-mirror.com'; from huggingface_hub import snapshot_download; print(snapshot_download('openbmb/VoxCPM2'))"
> ```
> `/health` 的 `voxcpm2` 字段会**检查模型权重是否完整下载**（非 `.incomplete`），模型没下完时为 `false`，此时 `engine=auto` 自动走 edge-tts，不会卡等超时。
> VoxCPM2 冷启动（import torch + load + generate）常 >120s，超时由 `VOXCPM2_TIMEOUT` 控制（默认 300s，可改）。

---

## 虚拟环境重建

```bash
cd prj/tts
python -m venv .venv          # 创建
.venv\Scripts\activate         # 激活（Windows）
pip install -r requirements.txt
```

---

## 预生成模式（可选优化，非必需）

`generate_all_tts.py` 用于**固定文本**批量预生成 MP3 + `map.json`，前端查表直接播放，零延迟。本工程的动态文本不适用此模式。

```bash
# 扫描默认 ./courseware
python generate_all_tts.py
# 指定目录
python generate_all_tts.py --dir /path/to/html
# 或用环境变量
COURSEWARE_DIR=/path/to/html python generate_all_tts.py
```

---

## API 契约（前端 voice.js 依赖）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | `{"ok","voxcpm2","edge","gpu"}` |
| GET | `/voices` | `{"voices":[{"key","label"}]}` |
| POST | `/tts` | body `{text, voice, engine}` → `audio/mpeg`；失败 HTTP200 + `{error,fallback:true}` |

`voice`: `mom` | `grandpa` | `teacher` | `child`（默认 `mom`）
`engine`: `auto` | `edge` | `voxcpm2`（默认 `auto`）

---

## 常见坑

- **asyncio 嵌套**：edge-tts 在 async 路由里直接 `await comm.save()`，**不要用 `asyncio.run()`**（FastAPI 已在事件循环里，嵌套会报错）。本服务已规避。
- **CORS**：已开 `allow_origins=["*"]`，前端可直接跨域调用。
- **VoxCPM2 首次下模型慢**：数 GB，挂梯子或耐心等。
- **edge-tts 需联网**：断网会失败，会自动返回 `fallback:true` 让前端走 Web Speech。
- **MD5 缓存**：相同 `{text,voice,engine}` 命中 `cache/*.mp3` 直接返回，避免重复生成。

---

## 目录结构

```
prj/tts/
├── config.py              # 路径/端口/音色预设配置（服务与引擎共用）
├── tts_server.py          # FastAPI 实时服务（动态文本走这里）
├── generate_all_tts.py    # 预生成脚本（固定文本批量出 MP3，可选）
├── edge_tts_config.py     # edge-tts 参考配置（从绘本项目拷贝）
├── requirements.txt       # 默认依赖（不含 voxcpm/torch）
├── .gitignore
├── services/
│   └── tts_service.py     # 引擎工具（VoxCPM2 子进程 + edge-tts 同步版）
├── cache/                 # 实时生成 mp3 缓存（git 忽略）
├── docs/                  # 文档（edge-tts / VoxCPM2 说明）
└── reference-tts-engine.js # 绘本项目前端引擎（仅参考，不直接用）
```
