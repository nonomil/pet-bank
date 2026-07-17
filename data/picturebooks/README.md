# 绘本目录维护

绘本馆由 `catalog.json` 驱动。新增一本绘本时，只需要：

1. 创建 `assets/picturebooks/images/<story-id>/`，放入 `page-1.png`、`page-2.png` 等分页图片。
2. 在 `catalog.json` 的 `stories` 数组增加一条书目。
3. 填写 `id`、`titleZh`、`titleEn`、`shelf`、`cover`、`ageRange`、`difficulty`、`durationMin`、`tags`、`keywords`、`license` 和 `publishable`。
4. 每页填写 `image`，至少提供 `zh` 或 `en` 一种文字。
5. 运行：

```powershell
node scripts/test-picturebooks-contract.mjs
node scripts/test-picturebooks-browser.mjs
```

`id` 只能使用小写字母、数字和连字符，并且必须唯一。`cover` 和 `pages[].image` 只能指向 `assets/picturebooks/images/`。只有确认素材可以发布时，才把 `publishable` 设为 `true`；本地或受限素材不要进入 Pages 制品。

当前模块不在 `prj/` 下重复建应用。需要批量切图、OCR 或导入时，再把工具单独放到 `prj/picturebook-library-tools/`，生成结果仍回到本目录和素材目录。
