# 仓库整理与清理手册

## 前置检查

```powershell
git status --short
Get-Process node,python -ErrorAction SilentlyContinue
```

工作树有未提交改动时，先记录归属；不要用清理命令覆盖、重置或删除这些文件。仍在运行的本地服务、构建或浏览器自动化可能占用 `_site*`、`tmp/` 或 profile 目录。

## 可清理范围

| 路径 | 条件 | 再生成方式 |
| --- | --- | --- |
| `_site*`、`_pages_test_root/` | 不是用户手工验收制品，且没有服务占用 | `node scripts/assemble-pages-artifact.mjs <out-dir>` |
| `tmp/pages-route-mount/`、`tmp/petbank-self-hosted-site/` | 已完成本地部署验证 | 自托管发布脚本或 Pages 制品组装 |
| `tmp/` 下截图、报告、浏览器测试产物 | 不属于待提交缺陷证据 | 对应测试/截图命令 |
| `prj/browser-act-imagegen/chrome-pet-sprite-profile/` | 浏览器自动化未运行 | 重新创建浏览器 profile |
| Python `__pycache__/` 与 `*.pyc` | 无 | Python 自动再生成 |

## 禁止删除

- 禁止删除工作树中任何未提交的业务代码、词库、素材、脚本或文档。
- 禁止删除 `assets/`、`data/`、`prj/` 的文件，除非已证明没有运行引用、没有 Pages 制品引用、并且存在可恢复来源。
- 禁止删除 `docs/参考/` 和原始素材，只能在完成外部备份、归档说明或用户明确确认后处理。
- 禁止用 `git reset --hard`、`git clean -fdx` 作为整理手段。

## 清理后验证

```powershell
node scripts/test-repository-boundaries.mjs
node scripts/test-static-route-entries.mjs
node scripts/test-pages-fast-gate-contract.mjs
git status --short
```

涉及发布资源时额外执行：

```powershell
node scripts/assemble-pages-artifact.mjs _site_verify
```

检查 `_site_verify/` 中主站、打字防线和像素探险的入口及其运行资源存在后，再删除这个临时目录。

## 归档原则

参考资料不复制进正式工程文档。对后续维护有价值的结论应压缩写入 `docs_project/`，原始截图、网页快照和生图中间物留在本机参考区或外部备份中。
