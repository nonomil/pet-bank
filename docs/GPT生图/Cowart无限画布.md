

COwart无限画布
https://github.com/zhongerxin/cowart

Cowart
Cowart 是一个面向 Codex 的原生无限画布 widget 插件。它基于 tldraw 提供可视化画布，用于构思、标注、生成图片和根据标注图迭代图片。画布由 MCP widget 直接打开，数据默认保存到当前用户项目的 canvas/ 目录，而不是保存到插件仓库里。

English README: README.en.md

功能
在 Codex 中打开一个原生 tldraw 无限画布 widget；正常使用不再通过网页浏览器或 in-app browser 打开本地页面。
在当前项目目录中持久化画布页面和图片资源。
在画布中创建 AI 图片框，直接输入 prompt、选择参考图，并让 Codex 按选中框的位置和比例生成图片后替换它。
标注好图片后，可从画布里直接提交标注截图，让 Codex 根据标注生成干净的新图并放到原图旁边。
通过 Cowart MCP 工具读取选择状态、保存画布、插入图片，并保存到页面本地资源目录。