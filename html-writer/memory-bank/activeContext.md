# 当前进度（Active Context）

> 续写项目时**最先看本文件**。最近会话的三轮改动均已完成并通过验证，无遗留的半成品改动。

## 第一轮：从零搭建（2026-09-04）

按需求一次性创建了 7 个文件（详见 `architecture.md`），覆盖全部功能点：

1. **密码保护（自用）**：启动先弹登录遮罩；密码硬编码 `app.js → const PASSWORD = '2026'`；输错提示「密码错误」+ 抖动动画；通过后写 `localStorage.hw_auth = '1'`，刷新免登录。
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
