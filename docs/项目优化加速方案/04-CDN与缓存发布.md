# CDN、对象存储与缓存发布

## 推荐架构

```text
www.example.com       HTML、路由入口、API 代理
static.example.com    版本化 JS/CSS/图片/音频/公开 JSON
                       CDN/Edge
                       COS/OSS
api.example.com       Node.js + SQLite 或同域 /api
```

第一阶段只迁移大媒体；第二阶段再把完整静态制品迁移到 CDN。当前同源基址必须继续可用，方便本地开发、局域网和 CDN 故障回退。

## 版本目录

```text
releases/v0.8.0/index.html
releases/v0.8.0/js/...
releases/v0.8.0/assets/...
releases/v0.8.0/data/...
```

禁止原地覆盖已经发布的 JS、CSS、JSON、图片和音频。版本切换只改变入口或资源基址；旧版本保留至少一个可回滚版本。

## 缓存规则

| 类型 | 缓存 |
|---|---|
| HTML/深层入口 | `no-cache` 或短 TTL |
| 版本化 JS/CSS | `public, max-age=31536000, immutable` |
| 版本化图片/音频 | `public, max-age=31536000, immutable` |
| 版本化公开 JSON | 1 天到长期缓存 |
| 登录、Profile、快照 API | `no-store` |
| 健康检查 API | `no-store` |

JS/CSS/JSON 开启 Brotli 或 gzip；PNG/WebP/OGG/MP3 不重复压缩；音频必须验证 `Content-Type`、Range 和跨域策略。

## 发布验收

1. 组装制品，不上传仓库根目录。
2. 上传到新版本目录，不切正式入口。
3. 检查根入口和全部深层路由。
4. 检查 JS/CSS/JSON/图片/音频 MIME。
5. 检查 CDN 首次回源和第二次命中。
6. 检查跨域、Range、404、5xx 和断网 fallback。
7. 切换上一版本目录验证回滚。

## 安全边界

CDN 不得缓存 token、账号、家庭、孩子、Profile 快照或依赖权限的 JSON。静态资源可以公开，但不能因为静态资源公开而放宽 API 权限。
