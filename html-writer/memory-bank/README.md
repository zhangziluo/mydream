# 📁 Memory Bank — Mydream 站点（html-writer 写作工具 + Pages 发布系统）

写 Markdown → 一键导出「样式内联、可离线打开」单文件 HTML；并可经**挑战-应答 HMAC** 发布 / 删除到站点 KV，首页与分类页（瀑布流 + 全文搜索）动态展示。仓库根即发布根，本 memory-bank 覆盖整个站点。

本目录用于持久记录项目进度与上下文，便于后续（人或 AI）快速恢复状态。

| 文件 | 内容 |
|------|------|
| `activeContext.md` | **当前进度（含「项目当前状态快照」+ 逐轮改动 + 验证）**，续写时最先看这里 |
| `architecture.md` | 项目结构、各文件职责、关键实现与「坑」 |
| `roadmap.md` | 待办 / 已知问题 / 需求澄清记录 |

> 更新时间：2026-09-05（会话收盘，HEAD `2228997`）
> 仓库根：`/Users/zhangziluo/Downloads/Mydream`（html-writer 位于 `html-writer/`）
> 线上：Pages `mydream` → `https://mydream-4y4.pages.dev`（GitHub main 推送自动构建）
> html-writer 运行：直接双击 `index.html`（联网加载 CDN marked）或访问线上 `/html-writer/`
> 访问密码：`app.js` 顶部 `const PASSWORD`（当前 `'19930214'`）；发布密码是 CF 密钥 `PUBLISH_PASSWORD`（二者不同，勿混）
