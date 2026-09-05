# 待办 / 已知问题 / 需求记录（Roadmap）

## 已完成（近期新增功能，回顾见 activeContext）
- [x] **发布到主页**（2026-09-05）：html-writer「📤 发布」+ `/api/challenge`（一次性 nonce）+ `/api/publish`（HMAC-SHA256 签名校验，明文密码不上传）+ `/api/posts` + `/api/post`（KV 存储）+ 首页动态渲染。
  - **上线前待做**：Cloudflare 控制台创建 KV namespace 并绑定 `MYDREAM_KV`、添加密钥 `PUBLISH_PASSWORD`；wrangler.toml 里已留占位与说明。

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

## 历史需求澄清记录
- 编辑器形态：用户在「纯 textarea + 工具栏」与「EasyMDE」之间选前者的实现方向（未显式确认，当时按更轻量、预览/导出样式可控选了纯 textarea）。
- 字号控件形态：用户确认选 **四档按钮（纯 CSS）**，而非 A−/A+/滑杆（后两者需脚本，成品可用但预览不可点）。
