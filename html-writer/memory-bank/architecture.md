# 架构与关键实现（Architecture）

## 文件结构与职责

```
html-writer/
├── index.html           # 主页面：登录遮罩 + 顶栏(模板下拉/预览切换/导出) + 工具栏 + textarea + 预览 iframe
├── style.css            # 页面外壳样式（登录页、顶栏、工具栏、左右分栏、toast、移动端媒体查询）
├── preview.css          # 预览/导出「正文排版」基础层（body/article/标题/代码/表格…全部 em 相对 body 字号）
├── app.js               # 全部逻辑（约 26KB，见下）
├── templates/
│   ├── minimal.css      # 模板：极简（白底、下划线链接、引用无边框）
│   ├── magazine.css     # 模板：杂志风（衬线、居中标题、首字下沉、双线分隔）
│   ├── code.css         # 模板：代码风（深色 #0d1117、等宽、GitHub Dark 配色，body 基准 15px）
│   ├── dream.css        # 模板：梦（星夜蓝 #081226→#2b5b96、月光星点、呼应 .col--dream 强调色 #aecbff）
│   ├── murmur.css       # 模板：梦呓（暮色紫灰 #31406b→#6a5d74→#7a6459、呼应 .col--murmur #d9e4ff）
│   └── wake.css         # 模板：醒（向日葵晨光暖纸 #fff8e6→#f6c96b、呼应 .col--wake #ffd98a）
└── memory-bank/         # ← 本目录
```

## app.js 内部结构（按注释分区）

1. **配置**：`PASSWORD`（'2026'）、`KEY`（localStorage 键：hw_auth / hw_content / hw_tpl）、`TEMPLATES[]`（id/name/file）+ `TPL_MAP`、`SAMPLE_MD`（首启示例）。
2. **内置样式副本** `EMBEDDED_CSS`（键 = 文件路径），含 `EMBEDDED_PREVIEW/MINIMAL/MAGAZINE/CODE_CSS` 四份 —— **与 css 文件字节级一致**（见「坑 5」）。
2.5 **字号控件**：`FS_CTRL_CSS` + `FS_CTRL_HTML`（见「字号控件」节）。
3. DOM 引用 + 工具（`lsGet/lsSet` 带 try/catch、toast、`markedReady/ensureMarked`：`setOptions({gfm:true, breaks:true})`）。
4. **密码**：`submitPassword()` → 写 hw_auth → `enterApp()`（恢复内容/模板、渲染、聚焦）。
5. **工具栏**：`runCommand(cmd)`；`snapshot/undo/syncUndoBtn`（撤销栈上限 100，仅工具栏操作入栈）；`wrapSel`（占位符自动选中）；`prefixLines`（多行逐行加/去前缀 toggle）；`insertCodeBlock/insertLink/insertImage/insertHr`；`updateWordCount`（去空白计数）；`scheduleSave`（400ms 防抖）。
6. **实时预览**：`previewDocHtml()` → `render()`（doc.write 进 iframe，防抖 200ms，渲染后尽量恢复滚动位置）。
7. **导出**：`readCssText`（fetch→EMBEDDED 兜底，带缓存 cssCache）→ `exportHtml` → `buildStandaloneDoc()` → `download()`（Blob+`<a download>`）；`makeTitle`、`escapeHtml`。
8. **移动端**：`toggleMobileView/syncMobileBtn`（`#app.show-preview`）。
9. `init()`：登录判定 + 全部事件绑定，脚本尾部直接执行。

## 关键机制

### 预览 iframe（`sandbox="allow-same-origin"`）
- **不带 `allow-scripts`**：用户 Markdown 里的原始 `<script>` 不会执行；也决定了页内控件必须**纯 CSS**。
- `render()` 从父页面 `contentDocument.open/write` 整份写入（同源 about:blank 可访问）。
- 预览文档与导出文档**同构**：同一 `<article>` 结构；CSS 用 `<link>` 引真实文件（file:// 也能加载），加 `<base href=目录>` 保证相对路径。
- 切换模板 = 改 link href 重写整份文档（CSS 会被浏览器缓存，代价可接受）。

### 字号控件（第二轮新增）
- 隐藏 radio（`fs-s/m/l/xl`，name=fs）+ `.fs-ctrl` 右下角浮层 `<label for>` 按钮，**零脚本**。
- `body:has(#fs-s/l/xl:checked) { font-size: 14/18/20px }`；`fs-m`（默认）不写规则 → 回落模板基准字号（16 或 code 的 15px）。控件自身用 px + z-index 999 + `@media print` 隐藏。
- 高亮选中项：`#fs-x:checked ~ .fs-ctrl .fs-btn[for="fs-x"]`（radio 必须是 `.fs-ctrl` 的前置兄弟）。
- 注入点：`previewDocHtml()` 与 `buildStandaloneDoc()` 各注入一次（CSS 进 `<style>`，HTML 放 `<article>` 前）。
- 兼容性：`:has()` 需 Chrome 105+ / Safari 15.4+ / Firefox 121+；旧浏览器控件不生效但无副作用。

### 模板系统（三处登记）
模板要同时出现在：① `TEMPLATES` 常量；② `index.html` 的 `<select id="tplSelect">`；③ `EMBEDDED_CSS` 的 `templates/<id>.css` 键（仅 file:// 导出兜底需要）。样式优先级：`preview.css`（基础）→ `templates/*.css`（覆盖）。

## 易踩坑 / 注意事项（重要）

1. **marked 必须锁版本 4.3.0**：`https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js`。marked 新版（5+ 尤其 12+）已把根目录 `marked.min.js` 移除、主推 ESM，裸地址 `…/marked/marked.min.js` 会 404。
2. **file:// 下浏览器禁止 fetch 本地文件** → 导出 CSS 读不到 → 因此 `EMBEDDED_CSS` 必须与 css 文件保持同步（HTTP 部署时导出会优先 fetch 真实文件，副本不生效）。
3. **改 CSS 文件后要同步 EMBEDDED_CSS**：重新跑「读文件→替换 `__EMBED_*__` 占位符→写回」的思路即可（当时用 /tmp 下临时 Node 脚本注入并做 `includes` 校验，脚本已清理）。**不要手抄**，否则极易不一致。
4. `body` 字号基准分散：preview.css 16px、code.css 15px；字号控件的非「默认」档会以更高特异性覆盖它们，属预期行为。
5. 导出 body 内容**不做 HTML 转义**（自用工具，默认信任自己的 Markdown）；预览 iframe 因无 allow-scripts 至少挡住了脚本执行。
6. 相对路径图片在预览里相对 `html-writer/` 目录解析；导出后相对导出文件所在目录解析。
7. `breaks:true` → 单换行即 `<br>`（符合中文写作习惯），与多数所见即所得编辑器一致。
8. 页面与预览**完全隔离**：页面自身样式在 style.css；预览/导出排版在 preview.css + templates——别把文章排版写进 style.css。

## 运行 / 部署
- 本地：双击 `index.html`（需联网加载 marked）；`python3 -m http.server` 亦可。
- Cloudflare Pages：整目录推送，无构建步骤、无环境变量。
- 密码改法：`app.js` 顶部 `PASSWORD`；登录状态存 `hw_auth`，删掉即需重新输密码。
