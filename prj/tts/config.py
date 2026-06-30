"""TTS 配置：路径、服务参数、音色预设。

被 tts_server.py（实时服务）和 services/tts_service.py（引擎工具）共用。
所有路径/端口均可被同名环境变量覆盖。
"""

import os
from pathlib import Path

# VoxCPM2 Python 路径（独立虚拟环境，需 NVIDIA GPU）
VOXCPM2_PYTHON = Path(
    os.environ.get("VOXCPM2_PYTHON", "D:/PythonEnvs/tts-voxcpm/Scripts/python.exe")
)

# VoxCPM2 模型本地路径：复用儿童绘本项目已下好的权重（D:/HuggingFaceCache/VoxCPM2，4.7GB），
# 避免重新从 HuggingFace 下载。该目录是扁平结构（model.safetensors + audiovae.pth + config.json
# + tokenizer.json 等），直接传给 VoxCPM.from_pretrained。留空则回退在线名 openbmb/VoxCPM2（需联网下载）。
VOXCPM2_MODEL_PATH = os.environ.get("VOXCPM2_MODEL_PATH", "D:/HuggingFaceCache/VoxCPM2")

# FastAPI 服务监听
HOST = os.environ.get("TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("TTS_PORT", "9885"))  # 默认 9885，避开常见 LLM 代理占用的 8765

# 实时服务音频缓存目录（按 MD5(text|voice|engine) 命名）
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 单次请求文本上限（裁断到该长度，避免滥用）
MAX_TEXT_LEN = 500

# VoxCPM2 子进程超时（秒）。冷启动 import torch + 加载模型 + generate 常 >120s，故默认 300。
# 国内首次还需从 HuggingFace 下载模型（数 GB），建议启动前设镜像加速：
#   Windows CMD:  set HF_ENDPOINT=https://hf-mirror.com
#   Git Bash:     export HF_ENDPOINT=https://hf-mirror.com
# （子进程继承父进程环境变量；亦可设 HF_TOKEN 解除匿名限速）
VOXCPM2_TIMEOUT = int(os.environ.get("VOXCPM2_TIMEOUT", "300"))

# 音色预设：
#   edge   —— edge-tts 用 voice name + rate + pitch
#   voxcpm —— VoxCPM2 用 text 前缀声线指令（括号描述拼到文本前，本地包已验证；非 voice_description）
#   label  —— 前端展示名
VOICE_PRESETS = {
    "mom": {
        "label": "温柔妈妈",
        "edge": {"voice": "zh-CN-XiaoxiaoNeural", "rate": "-18%", "pitch": "+2Hz"},
        "voxcpm": "(温柔的女声，语速缓慢，充满关怀，像妈妈在给孩子讲睡前故事)",
    },
    "grandpa": {
        "label": "温暖爷爷",
        "edge": {"voice": "zh-CN-YunjianNeural", "rate": "-10%", "pitch": "-2Hz"},
        "voxcpm": "(老年男性，声音慈祥缓慢，像爷爷讲故事)",
    },
    "teacher": {
        "label": "活泼老师",
        "edge": {"voice": "zh-CN-XiaoyiNeural", "rate": "+0%", "pitch": "+6Hz"},
        "voxcpm": "(年轻女性，声音清晰温柔，老师上课的语调)",
    },
    "child": {
        "label": "可爱童声",
        "edge": {"voice": "zh-CN-XiaoyiNeural", "rate": "-15%", "pitch": "+8Hz"},
        "voxcpm": "(小女孩，六岁左右，活泼可爱)",
    },
}
