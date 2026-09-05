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

仓库根（发布根）另含发布相关文件：
```
functions/
├── _shared/auth.js      # 共用鉴权 verifyChallenge（nonce+HMAC），publish/post 删除共用
├── api/challenge.js     # GET  /api/challenge（发布/删除前领取一次性 nonce）
├── api/publish.js       # POST /api/publish（HMAC 校验→存 KV post:<slug>）
├── api/posts.js         # GET /api/posts（分组）；?category= → 扁平数组；含 text 全文（分类页搜索用）
└── api/post.js          # GET ?slug= 阅读；DELETE ?slug= 删除（HMAC 校验）
index.html               # 首页（build.js 生成静态卡片占位；每栏动态显示最新 2 篇已发布文章）
dream.html / murmur.html / awake.html   # 分类管理页（data-category 区分）
assets/main.js           # 首页：拉 /api/posts，每栏 slice(0,2) 追加卡片
assets/category.js|css   # 分类页：瀑布流卡片 + 标题/正文全文搜索
assets/style.css         # 首页与分类页共用视觉（--dream/murmur/wake、.col 等）
build.js                 # 扫描 dream/whisper/awake 目录生成静态卡片（当前目录全空，输出 0 张）
dream/ whisper/ awake/   # 静态板块目录（当前为空，发布已走 KV）
wrangler.toml            # KV 绑定声明 + 本地联调说明
.dev.vars                # 本地 PUBLISH_PASSWORD（已 gitignore）
```

## app.js 内部结构（按注释分区）

1. **配置**：`PASSWORD`（当前 `'19930214'`，勿与发布密钥混淆）、`KEY`（localStorage 键：hw_auth / hw_content / hw_tpl）、`TEMPLATES[]`（id/name/file）+ `TPL_MAP`、`SAMPLE_MD`（首启示例）、`PUBLISH_TEMPLATE`/`CATEGORY_NAMES`（分类→模板/中文名）。
2. **内置样式副本** `EMBEDDED_*_CSS`：`EMBEDDED_PREVIEW_CSS` + 每个模板一份（minimal/magazine/code/dream/murmur/wake，共 7 份），键 = 文件路径 —— **与 css 文件字节级一致**（见「坑 3」）。
2.5 **字号控件**：`FS_CTRL_CSS` + `FS_CTRL_HTML`（见「字号控件」节）。
3. DOM 引用 + 工具（`lsGet/lsSet` 带 try/catch、toast、`markedReady/ensureMarked`：`setOptions({gfm:true, breaks:true})`）。
4. **密码**：`submitPassword()` → 写 hw_auth → `enterApp()`（恢复内容/模板、渲染、聚焦）。
5. **工具栏**：`runCommand(cmd)`；`snapshot/undo/syncUndoBtn`（撤销栈上限 100，仅工具栏操作入栈）；`wrapSel`（占位符自动选中）；`prefixLines`（多行逐行加/去前缀 toggle）；`insertCodeBlock/insertLink/insertImage/insertHr`；`updateWordCount`（去空白计数）；`scheduleSave`（400ms 防抖）。
6. **实时预览**：`previewDocHtml()` → `render()`（doc.write 进 iframe，防抖 200ms，渲染后尽量恢复滚动位置）。
7. **导出**：`readCssText`（fetch→EMBEDDED 兜底，带缓存 cssCache）→ `exportHtml` → `buildStandaloneDoc()` → `download()`（Blob+`<a download>`）；`makeTitle`、`escapeHtml`。
8. **发布到主页 + 发布管理**：`guessTitle`（首行 `# 标题`）→ `publishPost()`（按 PUBLISH_TEMPLATE 渲染单文件 HTML → `/api/challenge` 取 nonce → 本机 HMAC → POST `/api/publish`）；管理：`openManageDialog/closeManageDialog` → `loadManageList`（GET `/api/posts` 绝对路径）→ `deleteManagedPost`（confirm + nonce/HMAC → DELETE `/api/post?slug=`）；共用 `hmacSha256Hex`。成功 toast「发布成功 / 已删除」/ 401 红字「密码错误」/ fetch 异常「网络错误」。
9. **移动端**：`toggleMobileView/syncMobileBtn`（`#app.show-preview`）。
10. `init()`：登录判定 + 全部事件绑定（发布/管理按钮、两个 modal 开关、委托删除、Esc 双弹窗、撤销/导出/预览切换等），脚本尾部直接执行。

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

### 发布系统（第四轮，仓库根 functions/ + 首页动态；第五轮加删除）
- 「发布」= 把正文渲染成**所选分类对应模板的单文件 HTML**（前端 `buildStandaloneDoc` 输出即 `content`，含内联 CSS 与 `<title>`）→ 经**挑战-应答 HMAC-SHA256** 授权后存 KV；「删除」= `DELETE /api/post?slug=` 走同一鉴权删 KV。
- **安全模型（无明文密码上线）**：① 前端 GET `/api/challenge` 领取一次性 nonce（KV 登记、120s 过期、用后即删）；② 发布密码**只在本机**与 nonce 算 HMAC-SHA256 → 请求携带 `{..., nonce, digest}`；③ 后端 `verifyChallenge()`（见 `_shared/auth.js`，发布与删除共用）用 `env.PUBLISH_PASSWORD` 重新计算并 `crypto.subtle.verify`（常量时间）。明文密码永不出浏览器，digest 不可重放；`PUBLISH_PASSWORD` 仅存 CF 密钥（**不是**页面访问密码 `PASSWORD`）。
- KV：键 `post:<slug>`（slug = 标题 sanitize（ASCII）+ 时间戳），值 JSON `{slug,title,category,content,note,createdAt}`；note 由后端从 HTML 首 `<p>` 提取（思路同根目录 build.js）。挑战 nonce 键：`challenge:<nonce>`。
- 阅读链路：首页 `assets/main.js` fetch `api/posts`（GET 分组列表）→ 追加 `.work` 卡片（链接 `api/post?slug=`）→ GET `api/post` 原样返回存好的 HTML。发布失败/未配置后端时首页与 html-writer 均静默降级，不影响纯静态使用。
- 前端分类→模板：`PUBLISH_TEMPLATE = { dream:'dream', murmur:'murmur', awake:'wake' }`（注意站点分类键 `awake` 对应模板 `wake`）。HMAC 依赖 `crypto.subtle`（HTTPS/localhost 才可用；file:// 发布本就无后端，提示网络错误）。
- 上线需在 Cloudflare 控制台：绑定 KV namespace `MYDREAM_KV` + 添加密钥 `PUBLISH_PASSWORD`。**wrangler v4 的 `pages dev` 不读 toml 的 `[[kv_namespaces]]`，本地要用 `--kv MYDREAM_KV` 显式绑定**。

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
- 本地：双击 `index.html`（需联网加载 marked；file:// 下「发布」会因无后端提示网络错误，属预期）；`python3 -m http.server` 亦可。
- 发布相关本地联调：`npx wrangler pages dev . --kv MYDREAM_KV`（发布密码放 `.dev.vars` 的 `PUBLISH_PASSWORD`；注意 wrangler v4 的 pages dev 不会自动读 toml 的 `[[kv_namespaces]]`，必须 `--kv` 显式绑定）。
- **线上部署（实际使用）**：Pages 项目 `mydream`（`https://mydream-4y4.pages.dev`）+ GitHub main 分支 Git 集成，`git push` 即自动构建（build 命令 `node build.js`）→ 无需手动 wrangler deploy。KV 绑定 `MYDREAM_KV` 与密钥 `PUBLISH_PASSWORD` 均已配置。
- **绑定/密钥生效规则（坑）**：改 KV 绑定或密钥后，必须**再推一次（空 commit 即可）**让 Functions 构建时快照刷新；别用裸 REST 整块 PATCH `deployment_configs`（会清掉密钥，恢复需 `wrangler pages secret put` + 重部署）。线上 KV 判断/清理请走 REST，勿用 `wrangler kv` CLI（本地模拟误导）。
- 页面访问密码改法：`app.js` 顶部 `PASSWORD`（当前 `'19930214'`）；登录状态存 `hw_auth`，删掉即需重新输密码。
