# tts-portable · 可移植本地 TTS 服务

> 从「宠物积分系统」语音功能提炼的**可移植 TTS 方案**。目标只有一个：**复制到下一个项目就能用，不踩坑**。
>
> 三层降级：**VoxCPM2（GPU 最高音质）→ edge-tts（云端高音质）→ Web Speech（浏览器兜底）**。任意一层失败自动下探，前端永远有声。

---

## 这是什么

一个**零侵入、可移植**的本地 TTS 服务 + 前端播报库。

- **后端**（`tts_server.py`）：FastAPI 提供 HTTP TTS 接口，两层引擎 + 缓存。
- **前端**（`client/voice.js`）：通用可配置语音播报库，三层降级，监听任意文字容器自动播报。

下个项目不需要重新踩 TTS 的坑——把 `tts-portable/` 整个目录复制过去，照着 [快速启动.md](./快速启动.md) 三步跑起来即可。

---

## 三大特性

### 1. 零后端依赖（可选）

**不启动任何服务**，前端只引入 `client/voice.js` 就能用浏览器自带的 **Web Speech API** 兜底播报。适合纯静态站点、演示 Demo、没有 Python 环境的场景。需要更好音质时，再启动后端服务即可，前端代码不用改。

### 2. GPU 加速（VoxCPM2 最高音质）

配齐 NVIDIA GPU（≥8GB VRAM）+ VoxCPM2 模型后，走本地神经网络引擎：

- 原生 48kHz，支持自然语言描述声线（"年轻女性，声音温柔甜美"）
- 完全离线，无网络依赖，无调用费用
- Apache 2.0 开源，商用免费

### 3. 4 种儿童友好音色

预设四套声线，覆盖儿童应用主流场景，前端设置面板可一键切换：

| 音色 key | 展示名 | 适合场景 |
|----------|--------|----------|
| `mom` | 温柔妈妈 | 睡前故事、安抚情绪 |
| `grandpa` | 温暖爷爷 | 寓言、民间故事 |
| `teacher` | 活泼老师 | 教学反馈、鼓励互动 |
| `child` | 可爱童声 | 主角独白、童趣场景 |

> 音色预设定义在 `config.py` 的 `VOICE_PRESETS`，edge 引擎用 voice name + rate + pitch，VoxCPM2 用 text 前缀声线指令（括号描述拼到正文前）。改这里就能换声线。

---

## 快速启动（3 步）

### 最简 · 0 配置
前端 HTML 引入 `<script src="client/voice.js"></script>`，调用 `VoiceSystem.init()`。**不装任何东西**，直接用浏览器 Web Speech 兜底播报。

详见 [快速启动.md](./docs/快速启动.md) 的 **Level 0**。

### 推荐 · edge-tts（高音质，需联网，无 GPU）
```bash
cd prj/tts-portable
pip install -r requirements.txt
python tts_server.py          # 或 start.bat / start.sh
```
服务起在 `http://127.0.0.1:9885`，前端设置面板填入该地址即用云端高音质。

详见 [快速启动.md](./docs/快速启动.md) 的 **Level 1**。

### 最高音质 · VoxCPM2（本地 GPU）
在 Level 1 基础上，设环境变量指向已下好的本地模型：
```bash
# Windows CMD
set VOXCPM2_MODEL_PATH=D:/HuggingFaceCache/VoxCPM2
# 还需独立 GPU 虚拟环境，见 docs/快速启动.md 的 Level 2
```

详见 [快速启动.md](./docs/快速启动.md) 的 **Level 2**。

---

## 三层降级链

| 引擎 | 依赖 | 音质 | 速度 | 适用场景 |
|------|------|------|------|----------|
| **VoxCPM2** | NVIDIA GPU ≥8GB + 4.7GB 模型 + 独立 Python 环境 | ★★★★★ 原生 48kHz，声线可描述 | 较慢（冷启动 >120s，稳态 RTF≈0.13） | 最高音质、离线、商用 |
| **edge-tts** | 联网（微软云端）+ Python 包 | ★★★★ 自然，风格固定 | 极快（网络请求） | 推荐默认，零 GPU 门槛 |
| **Web Speech** | 仅现代浏览器，无任何后端 | ★★★ 取决于系统/浏览器 | 即时 | 兜底，离线，无服务也能响 |

降级由 `tts_server.py` 的 `/tts` 路由（后端两层）+ `client/voice.js` 的 `speak()`（前端第三层）共同实现。任一环节失败，用户无感知地降级到下一层。

---

## 目录结构

```
tts-portable/
├── tts_server.py          # FastAPI 后端服务（/health /voices /tts）
├── config.py              # 路径/端口/超时/音色预设（环境变量可覆盖）
├── requirements.txt       # Python 依赖（fastapi + uvicorn + edge-tts + soundfile）
├── services/
│   └── tts_service.py     # 引擎工具（批量生成用，非服务路径）
├── edge_tts_config.py     # edge-tts 音色配置参考
├── generate_all_tts.py    # 批量离线生成脚本（参考）
├── reference-tts-engine.js# 引擎参考实现（参考）
├── cache/                 # 实时音频缓存（.gitignore，自动生成）
├── client/
│   ├── voice.js           # ★ 通用前端播报库（核心，复制即用）
│   └── 接入示例.md        # ★ 新项目接入指南 + 最小 HTML 示例
└── docs/
    ├── 快速启动.md        # ★ 5 分钟上手（Level 0/1/2 三个梯度）
    ├── 踩坑与解决方案.md  # ★ 核心：10 个坑逐个详解（项目最大价值）
    ├── 移植指南.md        # ★ 如何复制到新项目 + 检查清单
    ├── VoxCPM2语音系统.md # VoxCPM2 引擎背景资料
    └── edge-tts语音说明.md# edge-tts 音色选型资料
```

> 标 ★ 的四份文档 + `client/voice.js` 是移植时必读的核心。

---

## 文档导航

| 文档 | 看这份解决什么 |
|------|----------------|
| [快速启动.md](./docs/快速启动.md) | 5 分钟跑起来，按 GPU/网络条件选梯度 |
| [踩坑与解决方案.md](./docs/踩坑与解决方案.md) | 遇到报错先查这里，10 个坑全记录 |
| [移植指南.md](./docs/移植指南.md) | 复制到新项目的完整流程 + 检查清单 |
| [client/接入示例.md](./client/接入示例.md) | 前端如何接入 voice.js + 配置 selectors |

---

## 设计原则

1. **降级优于报错**：任何一层失败都下探，用户永远听到声音（哪怕质量下降）。
2. **零侵入**：前端不改业务代码，监听 DOM 文字变化自动播报。
3. **环境变量驱动**：端口、模型路径、超时、HF 镜像全部可配，不写死。
4. **失败可观测**：`/health` 真实反映引擎就绪状态，前端有「测试连接」按钮。

---

## 许可

- 本项目代码：随宿主项目。
- VoxCPM2：Apache 2.0（OpenBMB）。
- edge-tts：调用微软免费 TTS 接口，需联网。
