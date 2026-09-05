# 当前进度（Active Context）

> 续写项目时**最先看本文件**。最近会话的七轮改动均已完成并通过验证，无遗留的半成品改动。

## 📌 项目当前状态快照（2026-09-05 收盘）

> 站点 = 写作工具 html-writer + Pages Functions（KV 发布/阅读/删除）+ 首页/分类管理页（瀑布流 + 全文搜索）。仓库根即发布根，memory-bank 覆盖整个站点而不仅是 html-writer。

**线上部署（Git 自动构建）**
- Pages 项目 `mydream`，域 `https://mydream-4y4.pages.dev`；GitHub `zhangziluo/mydream` 的 main 分支 push 即自动部署（build 命令 `node build.js`）。
- CF 账号：`Zhang409543901@gmail.com's Account`（id `55b7fa0b926a9a73a6c4f8b1e39ff300`）。
- KV：`MYDREAM_KV`（id `3b88c00c81fa4c829febc8a2570098c8`），已绑定 Pages 项目 production + preview。
- 密钥：`PUBLISH_PASSWORD` 已配置于 CF production（值由用户掌握；本地副本在 `.dev.vars`，已 gitignore）。html-writer 页面访问密码在 `app.js` 顶部 `PASSWORD = '19930214'`（二者不同）。
- HEAD：`2228997`（最近一次内容变更：删除本地 awake 静态文章并重建首页卡片）。

**代码布局（仓库根）**
- 首页 `index.html` + `assets/style.css` + `assets/main.js`：静态卡片由 build.js 生成；每栏动态显示**最新 2 篇**已发布文章；栏目标题 /「查看全部 →」→ 分类页。
- 分类管理页 `dream.html / murmur.html / awake.html` + `assets/category.css|js`：每分类一页，CSS 多列瀑布流 + 顶部搜索框（标题 + 正文全文本地过滤）。
- API：`functions/api/{challenge,publish,posts,post}.js` + 共用鉴权 `functions/_shared/auth.js`。
- 写作工具 `html-writer/`（登录遮罩 → Markdown 编辑器 → 导出 / 📤发布 / 🗂已发布管理删除）。
- 板块静态目录 `dream/ whisper/ awake/` **当前全空**（不再用静态目录发新文）；`build.js` 仍在 build 命令里执行（输出 0 张卡片占位，无害）。

**线上数据（收盘快照，会变）**：`/api/posts` → dream 0 / murmur 2（两篇《9月5日的日记》）/ awake 0。增删都在线进行（html-writer「🗂 已发布」）。

**关键经验 / 坑（详见过往轮次与 architecture「易踩坑」）**
1. `wrangler kv` CLI 在仓库含 `wrangler.toml` 时操作的是**本地模拟**；判断/清理线上 KV 请走 REST（`/accounts/{acct}/storage/kv/namespaces/{ns}/…`）。**切勿删除 KV 里名为 `PUBLISH_PASSWORD` 的键**（CF 内部使用，删了发布即坏）。
2. PATCH Pages 项目的 `deployment_configs` 是整块覆盖——**曾因此误清 `PUBLISH_PASSWORD` 密钥**；改完绑定后用 `wrangler pages secret put PUBLISH_PASSWORD` 恢复，再推空 commit 重部署。
3. Pages Functions 的绑定 / 密钥在**构建时快照**：改完必须再部署一次（空 commit 即可）才生效。
4. 裸 REST 用 OAuth token 过期会 401；`wrangler …` 会自动刷新 token。
5. CF Pages 会把 `/xxx.html` 308 到 `/xxx`（干净 URL）；不存在的路径会**回退首页 200**（SPA 行为）。

## 第七轮：删除本地 awake 静态文章并同步线上（2026-09-05）

- 用户在本地删除 `awake/我们都是-童年消逝-…（尼尔·波兹曼书评）.html`（静态 build.js 卡片时代的遗留文章）。
- 运行 `node build.js` 重建首页 → 三栏静态卡片归零（均回退「静候文字落笔……」占位，栏目标题与「查看全部→」保留）；commit `2228997` 推送，Pages 自动上线。
- 线上核验：首页已无该卡片；`/api/posts` dream 0 / awake 0 / murmur 2；旧静态 URL 回退首页（SPA 行为，200）。
- 意义：静态目录发布通道已实际停用（本地 3 目录全空），内容统一走 KV 发布系统；`build.js` 保留仅为兼容旧流程。

## 第六轮：首页限 2 篇 + 分类管理页（瀑布流 + 全文搜索）（2026-09-05）

用户确认：分类页**只展示已发布（KV）文章**；首页静态 build.js 卡片保留不动（2 篇上限只作用于已发布文章）。

1. **后端 `functions/api/posts.js`**：
   - 支持 `?category=dream|murmur|awake` → 返回该分类扁平数组（按 createdAt 倒序），无参数保持分组结构（首页用）。
   - 每项新增 `text` = 正文去 `<style>/<script>`、去标签、折叠空白后的纯文本，供分类页全文搜索。
2. **首页**：
   - `assets/main.js`：每个栏目动态文章 `slice(0,2)`（最新 2 篇），静态卡片不动。
   - `index.html`：三栏 `<h2>` 标题改为链接（`.col-title-link` → `dream/murmur/awake.html`），每栏列表后加「查看全部 →」（`.col-more`）。
   - `assets/style.css`：新增 `.col-title-link`、`.col-more` 样式（hover 用栏目 `--accent`）。
3. **分类管理页（新文件，每个分类一页）**：
   - `dream.html` / `murmur.html` / `awake.html`（根目录，`<body data-category="dream|murmur|awake">` 区分）。
   - `assets/category.css`：延续首页「星月夜→向日葵」渐变背景 + 顶部返回/标题/搜索框 + **CSS 多列瀑布流**（1/2/3 列响应式，卡片 `break-inside: avoid`）+ 空态 + 移动端竖排背景。
   - `assets/category.js`：按 `data-category` 拉 `/api/posts?category=` → 渲染卡片（《标题》/摘要/日期 → `/api/post?slug=` 阅读）；搜索框按**标题 + 正文全文**本地过滤（中文子串 + 空格多关键词 AND，160ms 防抖），实时显示「共 N 篇 / 命中 M 篇」。
   - 注意：CF Pages 会把 `/xxx.html` 308 重定向到干净路径 `/xxx`（`/dream` 200），相对资源在无后缀路径下仍从根解析，正常。
4. **验证**：本地 `wrangler pages dev`：发布 3 梦 +1 呓语 → `/api/posts` 分组含 text、`?category=dream` 倒序 3 篇、text 含正文独特词、分类页/资源 200、首页含 6 处入口链接 ✅。已推送线上复验。

## 第五轮：可删除已发布的文章（2026-09-05）

在 html-writer 加「🗂 已发布」发布管理入口（用户确认放 html-writer 内）。要点：

1. **后端**：
   - 新增 `functions/_shared/auth.js`：把「一次性 nonce 校验 + HMAC-SHA256 签名校验」抽成 `verifyChallenge(env, kv, nonce, digest)`，`publish.js` 与 `post.js` 共用（原来 publish.js 内联的实现已删除，避免两处复制）。
   - `functions/api/post.js` 新增 `onRequestDelete`：`DELETE /api/post?slug=<slug>`，body 携带 `{ nonce, digest }`（与发布同一鉴权）；校验通过后删除 KV `post:<slug>`；文章不存在返回 404。GET 阅读保持不变。
2. **前端（html-writer）**：顶栏新增 `#manageBtn`（🗂 已发布，位于 发布 与 导出 之间）+ `#manageModal` 发布管理对话框：打开即 `GET /api/posts` 按时间倒序列出（标题/分类/时间 + 删除按钮）；删除时输入发布密码 → 领取 nonce → 本机 HMAC 签名 → DELETE；成功 toast「已删除」并刷新列表，401 红字「密码错误」，fetch 异常「网络错误」。样式新增 `.manage-*`（含空态、列表滚动、危险按钮），移动端顶栏进一步收紧（隐藏品牌图标、压缩模板下拉）。
   - 注意：html-writer 页面位于 `/html-writer/`，管理列表/删除的 fetch 一律用**绝对路径** `/api/posts`、`/api/post?slug=`（相对路径会命中 `/html-writer/api/...` 404）。
3. **验证**：本地 `wrangler pages dev` 端到端（发布→列表 1 篇→错密码删除 401→正确删除 200→再删 404→阅读 404→列表清空）✅；已提交推送并线上复验。

> 经验（重要）：`wrangler kv` CLI 在仓库含 `wrangler.toml` 时会读写**本地模拟**而非线上 namespace，切勿用它判断线上 KV 内容/删除线上键——线上 KV 操作请走 REST API（`/accounts/{acct}/storage/kv/namespaces/{ns}/values/...`）。

## 第四轮：发布到主页（2026-09-05）

在 html-writer 加「📤 发布」入口，打通「写 → 发布 → 首页可见」闭环。本次按用户确认的范围实现三部分：

1. **前端（html-writer）**：顶栏「导出」左侧新增 `#publishBtn`（📤 发布）；点击弹 `#publishModal` 对话框（分类 梦/梦呓/醒 → `dream/murmur/awake`、标题默认取首行 `# 标题`、发布密码）。确认后把正文**渲染为所选分类对应模板的单文件 HTML**（复用 `readCssText` + `buildStandaloneDoc`：梦→dream、梦呓→murmur、醒→wake 模板），再经**挑战-应答 HMAC-SHA256**（先 `GET /api/challenge` 领一次性 nonce，密码在本机签名，**明文永不上传**）POST `{title, content, category, nonce, digest}` 到 `/api/publish`。成功 toast「发布成功」；401 → 红字「密码错误」；凭证失效/过期 400 → 显示服务端原因；fetch 异常 → 「网络错误」。样式新增 `.modal` 系列（`style.css`，并补上原本缺失的 `--danger` 变量）。
2. **后端（仓库根 `functions/`，Cloudflare Pages Function）**：
   - `functions/api/challenge.js`（GET）：随机 16 字节 → nonce（32 位 hex），KV `challenge:<nonce>` 登记 120s 过期（TTL + exp 双重）。
   - `functions/api/publish.js`（POST）：分类白名单 → 校验一次性 nonce（存在/未过期，**用后即删防重放**）→ `crypto.subtle.verify` 校验 HMAC（`env.PUBLISH_PASSWORD` 为密钥，常量时间）→ 生成 ASCII slug（标题 sanitize + 时间戳）→ 从 HTML 提取首段作 note → 存 KV `post:<slug>`。
   - `functions/api/posts.js`（GET）：KV 前缀 `post:` 列表 → 按 `createdAt` 降序、按 dream/murmur/awake 分组返回。
   - `functions/api/post.js`（GET `?slug=`）：取回存好的单文件 HTML 原样返回（text/html），供首页卡片点击阅读。
3. **首页动态渲染（`assets/main.js`）**：页面加载后 `fetch('api/posts')`，把已发布文章以 `.work` 卡片插入对应板块（`dream/murmur/awake` → `data-works="dream/murmur/wake"`），有动态文章时移除 `.empty` 占位；失败静默不影响静态卡片。

**安全设计说明（应「线上不要明文密码」要求，第四轮后半程将明文密码上传改为挑战-应答）**：`PUBLISH_PASSWORD` 只作为服务端 HMAC 密钥存在 Cloudflare 密钥里；发布密码不进入请求体、不落日志、不在仓库；nonce 一次性 + 120s 过期，即使抓包也无法重放；HMAC 校验用 `crypto.subtle.verify`（常量时间，抗时序攻击）。代价：发布依赖 HTTPS/localhost（`crypto.subtle` 安全上下文），file:// 下提示「网络错误」（本就无后端）。

**上线前待配置**：Cloudflare 控制台创建 KV namespace 并绑定 `MYDREAM_KV`、添加密钥 `PUBLISH_PASSWORD`（本地在 `.dev.vars`，已加 `.gitignore`）。本地联调命令：`npx wrangler pages dev . --kv MYDREAM_KV`（wrangler v4 的 pages dev 不会自动读 toml 里的 `[[kv_namespaces]]`，需 `--kv` 显式绑定）。

**验证记录**：`node --check` 全部通过；mock KV 冒烟（challenge 领取 / 正确签名 200 / **重放 400** / 错密码 401 / 随机·过期·非法 nonce 400 / 老明文密码字段 400）✅；`wrangler pages dev . --kv MYDREAM_KV` 端到端 curl（challenge→HMAC→发布 200→重放 400→错签名 401→老字段 400→列表可见）✅。安全方案：挑战-应答 HMAC-SHA256，明文密码永不出浏览器，nonce 一次性防重放。

## 第一轮：从零搭建（2026-09-04）

按需求一次性创建了 7 个文件（详见 `architecture.md`），覆盖全部功能点：

1. **密码保护（自用）**：启动先弹登录遮罩；密码硬编码 `app.js → const PASSWORD`（**当前值 `'19930214'`**，勿与发布密钥 PUBLISH_PASSWORD 混淆）；输错提示「密码错误」+ 抖动动画；通过后写 `localStorage.hw_auth = '1'`，刷新免登录。
2. **编辑器**：采用「纯 textarea + 自绘工具栏」（未用 EasyMDE）——按钮经 `data-cmd` 分发到 `runCommand()`；含加粗/斜体/删除线/H1/H2/引用/无序/有序列表/行内代码/代码块/链接/图片/分割线/撤销。
3. **实时预览**：`marked`（CDN）解析 → 渲染进 `sandbox="allow-same-origin"` 的 iframe（doc.write），样式与导出文件**同构**，所见即所得。
4. **模板切换**：顶部下拉「极简 / 杂志风 / 代码风」，切换即换 `<link href="templates/*.css">`。
5. **导出 HTML**：`fetch` 读取 CSS 文本并内联 → 完整单文件下载，文件名取首个 `# 标题`（sanitize），无标题则 `article-日期.html`。
6. **移动端适配**：<820px 默认只显示编辑区；顶栏「👁 预览 / ✎ 编辑」切换（桌面隐藏）。
7. 内容防抖自动保存到 `localStorage.hw_content`；字数统计；轻提示 toast。

## 第二轮：给成品 HTML 加字号调节控件（2026-09-04）

用户先提需求，plan 模式下敲定方案（用户选项确认：**四档按钮：小/默认/大/特大**，纯 CSS）。

**最终实现**（只改 `app.js`）：
- 新增常量 `FS_CTRL_CSS`：右下角浮层控件样式（px，避免被正文字号连带缩放）+ 档位规则 + `@media print` 隐藏。
- 新增常量 `FS_CTRL_HTML`：4 个隐藏 `<input type="radio" name="fs">`（默认选 `fs-m`）+ `<label for>` 按钮组。
- **纯 CSS 交互**：`body:has(#fs-s/l/xl:checked){ font-size:14/18/20px }` 改 body 字号 → em 单位的标题/正文/引用/代码整体缩放。「默认」档不设规则、回落模板基准（minimal/magazine 16px，code 15px）。
- 注入点 2 处：`previewDocHtml()`（预览文档 `<head>` 内联 `<style>` + `<article>` 前插控件）、`buildStandaloneDoc()`（导出 `<style>` 追加 + `<article>` 前插控件）。
- 预览 iframe **未开 allow-scripts** 保持不变 → 这是选纯 CSS 方案的根本原因（脚本方案在预览里不会执行）。

## 第三轮：新增「梦 / 梦呓 / 醒」三个板块模板（2026-09-04）

按首页三大板块的色彩语言新增 3 个模板，配色取自首页天空渐变对应区段 + 各栏强调色：

1. **梦**（`templates/dream.css`，下拉名「梦」）：深蓝夜空 `#081226→#102a55→#1f4474→#2b5b96`、顶部月光晕 + fixed 星点背景，强调色 `--dream: #aecbff`。
2. **梦呓**（`templates/murmur.css`，下拉名「梦呓」）：暮色紫灰 `#1a2c52→#31406b→#4d4a70→#6a5d74→#7a6459`，强调色 `--murmur: #d9e4ff`；引用做成居中斜体 + 上下细线的「浮出水面」呓语样式。
3. **醒**（`templates/wake.css`，下拉名「醒」）：向日葵晨光暖纸 `#fff8e6→#ffeec3→#ffdf9e→#f6c96b`，强调色 `--wake: #ffd98a`（落笔用深金棕，保证亮底可读）。

三个模板共用首页视觉语言：`article::before` 顶部色标渐变线（呼应 `.col::before`）、宋体衬线居中大标题（呼应 `.hero`）、`background-attachment: fixed` 视口天空（呼应 `.sky` 固定背景；旧端不支持 fixed 时自动退化为整页渐变，不影响阅读）。

登记三处 + 内置副本（全部完成并校验）：
- `app.js` `TEMPLATES`（id：`dream` / `murmur` / `wake`，顺序 = 下拉顺序）；
- `index.html` `#tplSelect` 三个 `<option>`；
- `app.js` `EMBEDDED_DREAM/MURMUR/WAKE_CSS` 内置副本 —— 用临时 Node 脚本从 `templates/*.css` **字节级注入**（脚本在 /tmp，已清理）。
- 首启示例 `SAMPLE_MD` 的模板列表 / 表格同步加入三模板。

## 验证记录

- `node --check app.js` ✅（三轮改动后均通过）。
- jsdom 冒烟测试：
  - 第一轮核心功能 **23/23**：密码对/错、示例载入、字数、加粗/撤销、行标题 toggle、插链接光标位置、预览生成、三模板切换、导出文件名、移动端预览/编辑互切。
  - 第一轮导出内容 **7/7**：DOCTYPE、`<title>`、base+模板 CSS 内联、`<article>` 包裹正文、无外部 css `<link>`、`</style></html>` 收尾。
  - 第二轮字号控件 **20/20**：预览/导出均含 `.fs-ctrl`、4 个 radio、`fs-m` 默认 checked、`:has()` 规则与 `@media print`、切 code 模板控件仍在、导出无外部 css link、导出单文件可交互（新 JSDOM 解析后点「大/小」radio 正常切换）。
  - 第三轮新增模板登记 **通过**：`node --check app.js` 无语法错误；临时校验脚本确认 `EMBEDDED_DREAM/MURMUR/WAKE_CSS` 与 `templates/*.css` 字节一致、`TEMPLATES` / `EMBEDDED_CSS` map / `index.html` 下拉三处登记齐全。
- 内置 CSS 副本一致性：用临时 Node 脚本从 `preview.css`/`templates/*.css` **字节级注入** `app.js` 的 `EMBEDDED_CSS`（脚本在 /tmp，已清理，勿删上面那句提醒——将来改 CSS 需重建同思路脚本，见 architecture 第 5 点）。

## 最近一次操作人 / 时间
- 2026-09-04：两轮改动均完成并验证；随后建立本 Memory Bank。
- 2026-09-04（续）：第三轮新增「梦 / 梦呓 / 醒」三个板块模板（三处登记 + 内置副本 + 示例文案），均完成并验证。
- 2026-09-05：第四轮「发布到主页」（前端按钮/对话框/POST + functions/ 端点 + 首页动态渲染），已上线并绑定 KV 与发布密钥。
- 2026-09-05（续 2）：第五轮「🗂 已发布」删除文章、第六轮分类管理页（瀑布流 + 全文搜索）、第七轮删除本地 awake 静态文章，全部上线验证；并写入「项目当前状态快照」。HEAD = `2228997`。
