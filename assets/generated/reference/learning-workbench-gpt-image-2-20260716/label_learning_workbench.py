from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "learning-workbench-reference.png"
OUTPUT = ROOT / "learning-workbench-reference-labeled.png"
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


image = Image.open(SOURCE).convert("RGB")
draw = ImageDraw.Draw(image)

dark = "#253A32"
muted = "#6B7872"
sidebar_bg = "#F5FAF6"
card_bg = "#FFFFFF"
header_bg = "#F2FAF4"

# Profile summary.
draw.rounded_rectangle((82, 233, 245, 293), radius=6, fill="#FFFFFF")
draw.text((95, 239), "小麦的学习空间", font=font(17, True), fill=dark)
draw.text((82, 270), "今天已完成 2 项", font=font(12), fill=muted)

# Local vertical navigation. Each item remains a real first-level tab inside Learning.
nav_items = [
    ("学习总览", "今日进度"),
    ("今日学习", "继续任务"),
    ("幼小衔接", "晨读与识字"),
    ("绘本阅读", "独立书架"),
    ("中文学习", "汉字与拼音"),
    ("数学启蒙", "100以内练习"),
    ("英语学习", "故事与听读"),
    ("Minecraft词汇", "单词远征"),
    ("学习游戏", "边玩边练"),
    ("学习资源", "网站与打印"),
    ("我的进度", "完成记录"),
    ("学习设置", "偏好管理"),
]

for index, (title, subtitle) in enumerate(nav_items):
    top = 322 + index * 48
    if index == 0:
        draw.rounded_rectangle((76, top + 5, 247, top + 43), radius=5, fill="#37C7A6")
        title_color = "#FFFFFF"
        subtitle_color = "#E9FFFA"
    else:
        draw.rectangle((76, top + 3, 250, top + 44), fill=sidebar_bg)
        title_color = dark
        subtitle_color = muted
    draw.text((82, top + 5), title, font=font(15, True), fill=title_color)
    draw.text((82, top + 26), subtitle, font=font(9), fill=subtitle_color)

# Learning overview header.
draw.rounded_rectangle((505, 113, 811, 180), radius=8, fill=header_bg)
draw.text((519, 116), "学习中心", font=font(30, True), fill=dark)
draw.text((519, 154), "今天想从哪里开始？", font=font(15), fill=muted)
draw.rounded_rectangle((916, 119, 1086, 153), radius=8, fill="#E8F3FF", outline="#B9D9F4", width=1)
draw.text((939, 126), "布局参考图", font=font(14, True), fill="#3777A6")

# Compact progress summaries.
metric_titles = ["今日计划", "连续学习", "本周收获", "成长记录"]
metric_x = [440, 729, 1014, 1298]
for x, title in zip(metric_x, metric_titles):
    draw.rounded_rectangle((x - 5, 269, x + 145, 313), radius=5, fill=card_bg)
    draw.text((x, 273), title, font=font(16, True), fill=dark)
    draw.text((x, 298), "查看详情", font=font(10), fill=muted)

# Category card labels. The illustrations remain generated; labels are deterministic.
cards = [
    (391, 528, "幼小衔接"),
    (775, 528, "绘本阅读"),
    (1157, 528, "汉字与拼音"),
    (391, 733, "数学启蒙"),
    (775, 733, "英语故事"),
    (1157, 733, "Minecraft 词汇"),
    (391, 958, "学习游戏"),
    (775, 958, "学习网站"),
    (1157, 958, "打印资料"),
]

for x, y, title in cards:
    draw.rounded_rectangle((x - 4, y - 4, x + 305, y + 30), radius=5, fill=card_bg)
    draw.text((x, y), title, font=font(18, True), fill=dark)
    draw.text((x + 232, y + 4), "进入", font=font(12, True), fill="#3986B8")

image.save(OUTPUT, format="PNG", optimize=True)
print(OUTPUT)
