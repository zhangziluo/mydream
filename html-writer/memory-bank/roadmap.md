# 待办 / 已知问题 / 需求记录（Roadmap）

## 已完成（近期新增功能，回顾见 activeContext）
- [x] **全站 favicon**（2026-09-06）：`assets/favicon.png`（256 方形圆角，星月夜→向日葵渐变 + 月牙/星点），纯 Node（内置 zlib 手写 PNG 编码）生成、无外部库；7 个页面（首页/三分类/留言/关于/html-writer）均已加 `<link rel="icon">`。
- [x] **全站页脚友情链接**（2026-09-06）：6 个公开页面 footer 加入「我的图书馆（myfami.cn）/ 我的日程管理工具（ics-editor Workers）」两个兄弟链接（外链新窗口），样式入 `assets/style.css` 与 `assets/category.css`。
- [x] **站点页脚扩展**（2026-09-06）：首页 footer 去 Dream OS，新增「赞助」二维码弹窗（assets/images/afdian-qr.png + wechat-reward.png）、纯前端留言板 `guestbook.html`（localStorage：`guest_name` 随机昵称 / `guestbook_messages` 上限 50 删最早，倒序 + 相对时间，textContent 防 XSS）、`about.html` 关于页、`✉ mailto:409543901@qq.com`。JS 追加进 `assets/main.js`、新增 `assets/guestbook.js`；样式统一在 `assets/style.css`。
- [x] **打开文件 + 编辑已发布文章**（2026-09-06）：html-writer 顶栏「📂 打开文件」——本地 `.md/.txt` 打开（FileReader 纯前端）；已发布文章列表打开取回原始 Markdown 编辑，发布**默认原地更新原文**（`/api/publish` 带 `slug`，保留 slug/createdAt），发布框可勾选「另存为新文章」；发布起同时保存 `md`，`/api/post?md=1` 取回；旧版无 md 文章置灰不可编辑。
- [x] **发布到主页**（2026-09-05）：html-writer「📤 发布」+ `/api/challenge`（一次性 nonce）+ `/api/publish`（HMAC-SHA256 签名校验，明文密码不上传）+ `/api/posts` + `/api/post`（KV 存储）+ 首页动态渲染。
- [x] **删除已发布文章**（2026-09-05）：html-writer「🗂 已发布」管理对话框（列表 + 删除），`DELETE /api/post?slug=` 走同一 HMAC 鉴权；抽公共 `functions/_shared/auth.js`。
- [x] **首页限 2 篇 + 分类管理页**（2026-09-05）：首页每栏动态文章最多 2 篇 +「查看全部→」；新增 `dream.html/murmur.html/awake.html`（瀑布流卡片 + 标题/全文搜索，共享 `assets/category.css|js`）；`/api/posts` 支持 `?category=` 并返回 `text`。
- [x] **停用静态目录通道**（2026-09-05）：本地删除 awake 遗留静态文章，`node build.js` 重建首页（三栏归零占位）；`dream/whisper/awake` 全空，内容统一走 KV。
- 上线配置：KV `MYDREAM_KV` 已绑定 + 密钥 `PUBLISH_PASSWORD` 已配置（production）。HEAD = `824c5a3`。

## 可选的下一步（按价值排序）
- [ ] **字号档位「记忆」**：导出文件里内联一小段脚本，读 `localStorage` 恢复上次档位（仅成品；预览保持纯 CSS 不可记忆）。
- [ ] **退出登录**：顶栏加「退出」按钮 → 清 `localStorage.hw_auth` 回到登录遮罩（当前只能手清 localStorage）。
- [ ] **模板增删的易用化**：当前加模板要改 3 处（TEMPLATES 常量、index.html 下拉、EMBEDDED_CSS 副本），可考虑把下拉选项由 JS 渲染以减少漏改。
- [ ] **导出前预览窗口 / 导出排版确认**：如字号控件、模板最终效果是否需要用户在编辑器里先切到该模板确认。

## 已知问题 / 限制（接受，暂不处理）
1. **file:// 直开 + 修改模板 CSS 文件** → 预览能看到新样式（走 `<link>`），但导出用 `EMBEDDED_CSS` 内置旧副本，二者会不一致；HTTP/CF Pages 部署下无此问题。规避：改 CSS 后同步内置副本（见 architecture「坑 3」）。
2. **字号控件覆盖 code 模板 15px 基准**：非默认档固定 14/18/20px（特异性更高）；默认档仍回落 15px。
3. **`:has()` 需要现代浏览器**（Chrome 105+/Safari 15.4+/Firefox 121+），更旧浏览器点字号按钮无效（无报错）。
4. 导出正文含用户手写原始 HTML（marked 透传），不转义；自用可接受。
5. 相对路径图片在导出后以「导出文件所在目录」解析，跨文件夹看图需自行处理路径。
6. **Pages 不存在的路径会回退首页（HTTP 200）**：如已删除文章 / 旧静态页 URL 打开是首页而非 404（CF Pages 该项目的 SPA 行为）。若想严格 404，可加 `_redirects`（`/awake/* /404.html 404`）并新建 404.html，暂未做。

## 历史需求澄清记录
- 编辑器形态：用户在「纯 textarea + 工具栏」与「EasyMDE」之间选前者的实现方向（未显式确认，当时按更轻量、预览/导出样式可控选了纯 textarea）。
- 字号控件形态：用户确认选 **四档按钮（纯 CSS）**，而非 A−/A+/滑杆（后两者需脚本，成品可用但预览不可点）。
