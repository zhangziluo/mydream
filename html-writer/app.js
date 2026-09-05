'use strict';

/* =========================================================
   app.js —— html-writer 核心逻辑（纯前端、无构建步骤）
   唯一外部依赖：marked.js（CDN，负责 Markdown → HTML）

   运行环境说明
   ------------
   1) 经 HTTP(S) 访问（Cloudflare Pages / 本地静态服务器）：
      预览、导出都直接读取 preview.css / templates/*.css，
      直接改模板 CSS 文件即可生效，无需动 app.js。
   2) 用 file:// 双击 index.html 打开：
      预览用 <link> 加载本地 CSS 依然正常；
      但浏览器禁止 file:// 页面 fetch() 本地文件，
      因此「导出」时自动回退到下方 EMBEDDED_CSS 内置副本
      （内容与对应 css 文件保持一致）。
   ========================================================= */

/* ---------------- 1. 配置（可自行修改） ---------------- */

const PASSWORD = '19930214';      // ← 访问密码，改这里即可
const KEY = {
  auth: 'hw_auth',            // 登录状态标记
  md:   'hw_content',         // 文章正文（自动保存）
  tpl:  'hw_tpl',             // 当前选中的模板
};

const DEFAULT_TPL = 'minimal';
const AUTOSAVE_DELAY = 400;   // 自动保存防抖 ms
const RENDER_DELAY   = 200;   // 实时预览防抖 ms

// 模板清单（顺序 = 顶部下拉顺序）
const TEMPLATES = [
  { id: 'minimal',  name: '极简',   file: 'templates/minimal.css' },
  { id: 'magazine', name: '杂志风', file: 'templates/magazine.css' },
  { id: 'code',     name: '代码风', file: 'templates/code.css' },
  { id: 'dream',    name: '梦',     file: 'templates/dream.css' },
  { id: 'murmur',   name: '梦呓',   file: 'templates/murmur.css' },
  { id: 'wake',     name: '醒',     file: 'templates/wake.css' },
];
const TPL_MAP = {};
TEMPLATES.forEach((t) => { TPL_MAP[t.id] = t; });

// 发布：站点分类 → 渲染所用模板 id（分类文案：梦/梦呓/醒）
const PUBLISH_TEMPLATE = { dream: 'dream', murmur: 'murmur', awake: 'wake' };
const PUBLISH_API = '/api/publish';

// 首次使用（localStorage 为空）时给出的示例文章
const SAMPLE_MD = [
  '# 我的第一篇文档',
  '',
  '> 一个极简的 Markdown 写作工具：左侧写作、右侧实时预览，导出的 HTML 完全独立、可离线打开。',
  '',
  '## 快速上手',
  '',
  '用工具栏按钮，或直接手写 Markdown：*斜体*、**加粗**、~~删除线~~、`行内代码`、[链接](https://example.com)。',
  '',
  '1. 顶部下拉可切换模板：**极简 / 杂志风 / 代码风 / 梦 / 梦呓 / 醒**',
  '2. 右上角「导出 HTML」会下载一个样式内联的单文件',
  '3. 内容自动保存在浏览器 localStorage，刷新不会丢',
  '',
  '## 一段示例代码',
  '',
  '```js',
  'function hello(name) {',
  '  return "Hello, " + name + "!";',
  '}',
  '```',
  '',
  '## 引用与表格',
  '',
  '> 「写作是为了再一次阅读。」',
  '',
  '| 模板 | 特点 |',
  '| ---- | ---- |',
  '| 极简 | 干净留白 |',
  '| 杂志风 | 衬线排版 |',
  '| 代码风 | 深色等宽 |',
  '| 梦 | 星夜深蓝 · 月光星点 |',
  '| 梦呓 | 暮色紫灰 · 半醒半睡 |',
  '| 醒 | 晨光暖色 · 向日葵之页 |',
].join('\n');

/* ---------------- 2. 内置样式副本（file:// 导出 fallback） ----------------
   经 HTTP(S) 访问时导出会 fetch() 真实 css 文件，本副本不会被用到；
   仅 file:// 直开导出时兜底，内容与 preview.css / templates/*.css 一致。 */

const EMBEDDED_PREVIEW_CSS = `
/* =========================================================
   preview.css —— 预览区 / 导出文件共用的基础排版
   作用于内容 <article>；模板在 templates/*.css 中做差异化覆盖。
   注意：app.js 里内置了一份相同副本（file:// 直开导出时用）。
   ========================================================= */

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  color: #2b2f36;
  background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC",
               sans-serif;
  font-size: 16px;
  line-height: 1.8;
  word-break: break-word;
  -webkit-font-smoothing: antialiased;
}

article {
  max-width: 46rem;
  margin: 0 auto;
  padding: 3rem 1.6rem 6rem;
}

/* ---- 标题 ---- */
h1, h2, h3, h4, h5 {
  font-weight: 700;
  line-height: 1.35;
  margin: 1.6em 0 0.55em;
}
h1 { font-size: 2.05em; margin-top: 0; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.2em; }

/* ---- 正文元素 ---- */
p  { margin: 0 0 1em; }
a  { color: #0b66d9; text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; }
hr  { border: 0; border-top: 1px solid #e5e7eb; margin: 2.2em auto; }

blockquote {
  margin: 1.2em 0;
  padding: 0.15em 1.1em;
  border-left: 4px solid #d1d5db;
  color: #6b7280;
  background: #fafafa;
}
blockquote p { margin: 0.6em 0; }

ul, ol { margin: 0 0 1.1em; padding-left: 1.7em; }
li { margin: 0.28em 0; }
li > ul, li > ol { margin-bottom: 0; }

/* ---- 代码 ---- */
code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
               "Liberation Mono", "Courier New", monospace;
  font-size: 0.9em;
  background: #f1f3f5;
  padding: 0.12em 0.4em;
  border-radius: 4px;
}
pre {
  margin: 1.1em 0;
  padding: 1em 1.2em;
  background: #f6f8fa;
  border: 1px solid #eaecef;
  border-radius: 8px;
  overflow: auto;
}
pre code { background: none; padding: 0; font-size: 0.92em; line-height: 1.65; }

/* ---- 表格 ---- */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.1em 0;
  display: block;
  overflow-x: auto;
}
th, td { border: 1px solid #dde1e6; padding: 0.5em 0.85em; text-align: left; }
th { background: #f6f8fa; font-weight: 600; }

mark { background: #fff3a3; padding: 0 0.15em; }
del { color: #9aa1a9; }

@media (max-width: 720px) {
  article { padding: 1.4rem 1.1rem 4rem; }
  h1 { font-size: 1.7em; }
}
`;
const EMBEDDED_MINIMAL_CSS = `
/* =========================================================
   minimal.css —— 模板：极简
   干净留白 + 克制的线条，适合日常笔记与长文。
   ========================================================= */

body { background: #fff; }

article { max-width: 40rem; }

h1, h2, h3 { letter-spacing: -0.01em; }
h1 { font-size: 2.2em; }
h2 { font-size: 1.45em; margin-top: 2em; }
h3 { color: #555; }

a {
  color: #000;
  text-decoration: underline;
  text-decoration-color: #d5d5d5;
  text-underline-offset: 3px;
}
a:hover { text-decoration-color: #000; }

hr { border-top-color: #e2e2e2; }

blockquote {
  border-left: none;
  background: none;
  padding: 0.5em 0;
  color: #8a8a8a;
  font-size: 1.05em;
}

code { background: #f5f5f5; }
pre { background: #fafafa; border-color: #ececec; }

th { background: #fafafa; }
`;
const EMBEDDED_MAGAZINE_CSS = `
/* =========================================================
   magazine.css —— 模板：杂志风
   衬线字体 + 居中大标题 + 首字下沉 + 仿古分隔线。
   ========================================================= */

body {
  background: #faf6ef;
  color: #211a12;
  font-family: Georgia, "Times New Roman", "Songti SC", "STSong",
               SimSun, serif;
}

article { max-width: 38rem; }

p { text-align: justify; }

h1, h2, h3 { font-weight: 600; }
h1 {
  font-size: 2.6em;
  line-height: 1.2;
  text-align: center;
  margin-bottom: 0.4em;
  letter-spacing: 0.02em;
}
h2 {
  font-size: 1.5em;
  text-align: center;
  font-variant-caps: small-caps;
  letter-spacing: 0.08em;
}
h3 { font-size: 1.15em; color: #7a5c3e; }

a { color: #8a3b2e; text-decoration: underline; text-underline-offset: 2px; }

/* 首字下沉 */
article > p:first-of-type::first-letter {
  float: left;
  font-size: 3.4em;
  line-height: 0.85;
  padding: 0.04em 0.12em 0 0;
  font-weight: 600;
  color: #8a3b2e;
}

blockquote {
  border: none;
  background: none;
  text-align: center;
  font-style: italic;
  color: #8a7355;
  font-size: 1.12em;
  padding: 0.5em 1em;
  border-top: 1px solid #d8c9ae;
  border-bottom: 1px solid #d8c9ae;
}

hr { border-top: 2px double #d8c9ae; width: 40%; }

img { background: #fff; border: 1px solid #e2d3b8; padding: 0.35em; }

code { background: #efe6d4; }
pre { background: #fffdf8; border: 1px solid #e4d6bd; }

th { background: #efe6d4; }
th, td { border-color: #d8c9ae; }
`;
const EMBEDDED_CODE_CSS = `
/* =========================================================
   code.css —— 模板：代码/技术风
   深色背景 + 等宽字体 + GitHub Dark 配色点缀。
   ========================================================= */

body {
  background: #0d1117;
  color: #c9d1d9;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
               "Liberation Mono", "Courier New", monospace;
  font-size: 15px;
  line-height: 1.75;
}

article { max-width: 52rem; }

h1, h2, h3, h4 { color: #e6edf3; font-weight: 600; }
h1 { font-size: 1.9em; padding-bottom: 0.4em; border-bottom: 1px solid #30363d; }
h2 { font-size: 1.35em; margin-top: 2em; padding-bottom: 0.3em; border-bottom: 1px dashed #30363d; }
h3 { color: #79c0ff; }

a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }

::selection { background: rgba(56, 139, 253, 0.4); }

code { color: #ffa657; background: rgba(110, 118, 129, 0.16); }
pre { background: #161b22; border: 1px solid #30363d; }
pre code { color: #e6edf3; }

blockquote {
  border-left-color: #30363d;
  background: transparent;
  color: #8b949e;
}

th { background: #161b22; color: #79c0ff; }
th, td { border-color: #30363d; }

hr { border-top-color: #30363d; }
mark { background: #e3b341; color: #0d1117; }
`;

const EMBEDDED_DREAM_CSS = `
/* =========================================================
   dream.css —— 模板：梦（星夜蓝）
   对应首页「梦」栏（.col--dream / --dream: #aecbff）。
   配色取自首页天空渐变左段（#081226 → #102a55 → #1f4474 → #2b5b96）：
   深蓝夜空 + 月光 + 星点，如铺展在星夜下阅读。
   ========================================================= */

html { min-height: 100%; }

/* 夜空：主渐变 + 顶部冷月光晕 + 细碎星点。
   背景 fixed 钉在视口（呼应首页 .sky 固定天空）；
   不支持 fixed 的旧端自动退化为整页渐变，不影响阅读。 */
body {
  min-height: 100vh;
  color: #eef3fb;
  background-color: #081226;
  background-image:
    radial-gradient(circle at 50% -10%, rgba(207, 226, 255, 0.22), transparent 58%),
    radial-gradient(circle at 18% 12%,  rgba(238, 243, 251, 0.9)  0, rgba(238, 243, 251, 0.9)  1.4px, transparent 2.2px),
    radial-gradient(circle at 34% 6%,   rgba(238, 243, 251, 0.55) 0, rgba(238, 243, 251, 0.55) 1px,   transparent 1.9px),
    radial-gradient(circle at 52% 18%,  rgba(238, 243, 251, 0.45) 0, rgba(238, 243, 251, 0.45) 1.5px, transparent 2.3px),
    radial-gradient(circle at 68% 10%,  rgba(238, 243, 251, 0.65) 0, rgba(238, 243, 251, 0.65) 1px,   transparent 1.9px),
    radial-gradient(circle at 84% 20%,  rgba(238, 243, 251, 0.5)  0, rgba(238, 243, 251, 0.5)  1.3px, transparent 2.1px),
    radial-gradient(circle at 94% 6%,   rgba(238, 243, 251, 0.75) 0, rgba(238, 243, 251, 0.75) 1px,   transparent 1.9px),
    radial-gradient(circle at 8% 34%,   rgba(238, 243, 251, 0.35) 0, rgba(238, 243, 251, 0.35) 1.1px, transparent 1.9px),
    radial-gradient(circle at 26% 46%,  rgba(238, 243, 251, 0.3)  0, rgba(238, 243, 251, 0.3)  1.4px, transparent 2.2px),
    radial-gradient(circle at 44% 38%,  rgba(238, 243, 251, 0.4)  0, rgba(238, 243, 251, 0.4)  1px,   transparent 1.8px),
    radial-gradient(circle at 62% 52%,  rgba(238, 243, 251, 0.28) 0, rgba(238, 243, 251, 0.28) 1.2px, transparent 2px),
    radial-gradient(circle at 76% 36%,  rgba(238, 243, 251, 0.35) 0, rgba(238, 243, 251, 0.35) 1px,   transparent 1.8px),
    radial-gradient(circle at 88% 50%,  rgba(238, 243, 251, 0.4)  0, rgba(238, 243, 251, 0.4)  1.2px, transparent 2px),
    radial-gradient(circle at 18% 66%,  rgba(238, 243, 251, 0.28) 0, rgba(238, 243, 251, 0.28) 1px,   transparent 1.9px),
    radial-gradient(circle at 40% 76%,  rgba(238, 243, 251, 0.22) 0, rgba(238, 243, 251, 0.22) 1.4px, transparent 2.2px),
    radial-gradient(circle at 58% 82%,  rgba(238, 243, 251, 0.2)  0, rgba(238, 243, 251, 0.2)  1px,   transparent 1.9px),
    radial-gradient(circle at 74% 64%,  rgba(238, 243, 251, 0.3)  0, rgba(238, 243, 251, 0.3)  1.2px, transparent 2px),
    radial-gradient(circle at 90% 80%,  rgba(238, 243, 251, 0.25) 0, rgba(238, 243, 251, 0.25) 1px,   transparent 1.8px),
    linear-gradient(180deg, #081226 0%, #102a55 34%, #1f4474 68%, #2b5b96 100%);
  background-attachment: fixed;
}

/* 顶部色标细线：呼应首页 .col::before 的栏顶渐变线 */
article { position: relative; max-width: 40rem; }
article::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(72%, 26rem);
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(174, 203, 255, 0.75), transparent);
}

/* 标题：衬线宋体，延续首页 hero 气质 */
h1, h2, h3, h4 {
  font-family: "Songti SC", "STSong", "Noto Serif CJK SC",
               "Source Han Serif SC", "SimSun", Georgia, serif;
  font-weight: 600;
  color: #f2f6fd;
}
h1 {
  margin-top: 0;
  text-align: center;
  font-size: 2.2em;
  letter-spacing: 0.08em;
  text-indent: 0.08em;
  text-shadow: 0 2px 26px rgba(174, 203, 255, 0.3);
}
h2 {
  margin-top: 2.1em;
  font-size: 1.5em;
  letter-spacing: 0.05em;
  text-indent: 0.05em;
}
h3 { color: #c8d8f6; font-size: 1.18em; }

a {
  color: #aecbff;
  text-underline-offset: 3px;
  text-decoration-color: rgba(174, 203, 255, 0.4);
}
a:hover { text-decoration-color: #aecbff; }

hr { border-top-color: rgba(174, 203, 255, 0.3); }

blockquote {
  background: rgba(174, 203, 255, 0.07);
  border-left-color: rgba(174, 203, 255, 0.5);
  border-radius: 0 10px 10px 0;
  color: rgba(238, 243, 251, 0.85);
}

code { background: rgba(174, 203, 255, 0.14); color: #dbe9ff; }
pre {
  background: rgba(5, 13, 32, 0.62);
  border-color: rgba(174, 203, 255, 0.2);
}
pre code { color: #e9effb; background: none; }

mark { background: rgba(255, 226, 150, 0.28); color: #ffe9b0; }
del { color: rgba(238, 243, 251, 0.45); }

th { background: rgba(174, 203, 255, 0.14); color: #dce9ff; }
th, td { border-color: rgba(174, 203, 255, 0.22); }

::selection { background: rgba(174, 203, 255, 0.32); }
`;

const EMBEDDED_MURMUR_CSS = `
/* =========================================================
   murmur.css —— 模板：梦呓（暮色紫灰）
   对应首页「梦呓」栏（.col--murmur / --murmur: #d9e4ff）。
   夜与晨之间的暮色：青蓝渐沉 → 紫灰 → 昏褐，
   取色自首页天空渐变中段（#1f4474 → #6a5d74 → #7a6459）。
   ========================================================= */

html { min-height: 100%; }

body {
  min-height: 100vh;
  color: #eef0f8;
  background-color: #1a2c52;
  background-image:
    radial-gradient(circle at 50% -12%, rgba(217, 228, 255, 0.16), transparent 55%),
    radial-gradient(circle at 24% 12%, rgba(238, 240, 248, 0.5) 0, rgba(238, 240, 248, 0.5) 1px, transparent 1.9px),
    radial-gradient(circle at 52% 20%, rgba(238, 240, 248, 0.3) 0, rgba(238, 240, 248, 0.3) 1.3px, transparent 2.1px),
    radial-gradient(circle at 78% 10%, rgba(238, 240, 248, 0.45) 0, rgba(238, 240, 248, 0.45) 1px, transparent 1.9px),
    radial-gradient(circle at 90% 30%, rgba(238, 240, 248, 0.28) 0, rgba(238, 240, 248, 0.28) 1.1px, transparent 1.9px),
    radial-gradient(circle at 14% 44%, rgba(238, 240, 248, 0.25) 0, rgba(238, 240, 248, 0.25) 1px, transparent 1.8px),
    radial-gradient(circle at 38% 56%, rgba(238, 240, 248, 0.2) 0, rgba(238, 240, 248, 0.2) 1.4px, transparent 2.2px),
    radial-gradient(circle at 64% 68%, rgba(238, 240, 248, 0.18) 0, rgba(238, 240, 248, 0.18) 1px, transparent 1.8px),
    radial-gradient(circle at 84% 56%, rgba(238, 240, 248, 0.25) 0, rgba(238, 240, 248, 0.25) 1.2px, transparent 2px),
    radial-gradient(circle at 94% 80%, rgba(238, 240, 248, 0.16) 0, rgba(238, 240, 248, 0.16) 1px, transparent 1.9px),
    linear-gradient(180deg, #1a2c52 0%, #31406b 26%, #4d4a70 52%, #6a5d74 74%, #7a6459 100%);
  background-attachment: fixed;
}

/* 顶部色标细线：呼应首页 .col::before 的栏顶渐变线 */
article { position: relative; max-width: 40rem; }
article::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(72%, 26rem);
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(217, 228, 255, 0.7), transparent);
}

/* 标题：衬线宋体；梦呓——字句浮在半醒半睡之间 */
h1, h2, h3, h4 {
  font-family: "Songti SC", "STSong", "Noto Serif CJK SC",
               "Source Han Serif SC", "SimSun", Georgia, serif;
  font-weight: 600;
  color: #f4f3fa;
}
h1 {
  margin-top: 0;
  text-align: center;
  font-size: 2.2em;
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  text-shadow: 0 2px 24px rgba(217, 228, 255, 0.22);
}
h2 {
  margin-top: 2.1em;
  font-size: 1.5em;
  letter-spacing: 0.05em;
  text-indent: 0.05em;
}
h3 { color: #c9d2ee; font-size: 1.18em; }

a {
  color: #d9e4ff;
  text-underline-offset: 3px;
  text-decoration-color: rgba(217, 228, 255, 0.4);
}
a:hover { text-decoration-color: #d9e4ff; }

hr { border-top-color: rgba(217, 228, 255, 0.3); }

/* 呓语：居中斜体 + 上下细线，像浮出水面的话 */
blockquote {
  border-left: none;
  border-top: 1px solid rgba(217, 228, 255, 0.3);
  border-bottom: 1px solid rgba(217, 228, 255, 0.3);
  background: rgba(217, 228, 255, 0.06);
  text-align: center;
  font-style: italic;
  color: rgba(238, 240, 248, 0.86);
}

code { background: rgba(217, 228, 255, 0.13); color: #e3eaff; }
pre {
  background: rgba(12, 19, 40, 0.6);
  border-color: rgba(217, 228, 255, 0.2);
}
pre code { color: #eceefb; background: none; }

mark { background: rgba(255, 226, 150, 0.26); color: #ffe9b0; }
del { color: rgba(238, 240, 248, 0.45); }

th { background: rgba(217, 228, 255, 0.13); color: #e2e9ff; }
th, td { border-color: rgba(217, 228, 255, 0.22); }

::selection { background: rgba(217, 228, 255, 0.3); }
`;

const EMBEDDED_WAKE_CSS = `
/* =========================================================
   wake.css —— 模板：醒（晨光 · 向日葵暖）
   对应首页「醒」栏（.col--wake / --wake: #ffd98a）。
   天亮后的暖纸感：奶油底 + 顶部向日葵光晕，
   取色自首页天空渐变右段（#c0803f → #f2c457）与 .col--wake。
   ========================================================= */

html { min-height: 100%; }

body {
  min-height: 100vh;
  color: #4a2f12;
  background-color: #fff6de;
  background-image:
    radial-gradient(circle at 50% -14%, rgba(255, 226, 150, 0.9), transparent 58%),
    linear-gradient(180deg, #fff8e6 0%, #ffeec3 40%, #ffdf9e 72%, #f6c96b 100%);
  background-attachment: fixed;
}

/* 顶部色标细线：呼应首页 .col::before 的栏顶渐变线 */
article { position: relative; max-width: 42rem; }
article::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(72%, 26rem);
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, rgba(212, 143, 30, 0.75), transparent);
}

/* 标题：衬线宋体，晨光下读的字 */
h1, h2, h3, h4 {
  font-family: "Songti SC", "STSong", "Noto Serif CJK SC",
               "Source Han Serif SC", "SimSun", Georgia, serif;
  font-weight: 600;
  color: #3c2406;
}
h1 {
  margin-top: 0;
  text-align: center;
  font-size: 2.2em;
  letter-spacing: 0.08em;
  text-indent: 0.08em;
}
h2 {
  margin-top: 2.1em;
  font-size: 1.5em;
  letter-spacing: 0.05em;
  text-indent: 0.05em;
}
h3 { color: #8a5a17; font-size: 1.18em; }

a {
  color: #8a4b0b;
  text-underline-offset: 3px;
  text-decoration-color: rgba(138, 75, 11, 0.4);
}
a:hover { text-decoration-color: #8a4b0b; }

hr { border-top-color: rgba(170, 110, 30, 0.35); }

blockquote {
  background: rgba(255, 255, 255, 0.55);
  border-left: 3px solid rgba(212, 143, 30, 0.6);
  border-radius: 0 10px 10px 0;
  color: #6b4a1e;
}

code { background: rgba(196, 124, 20, 0.12); color: #7a3d08; }
pre {
  background: rgba(255, 255, 255, 0.6);
  border-color: rgba(196, 124, 20, 0.3);
}
pre code { color: #6b4520; background: none; }

mark { background: #ffe08a; color: #4a2f12; }
del { color: rgba(74, 47, 18, 0.5); }

th { background: rgba(196, 124, 20, 0.12); color: #6b4510; }
th, td { border-color: rgba(196, 124, 20, 0.28); }

::selection { background: rgba(255, 184, 64, 0.4); }
`;

const EMBEDDED_CSS = {
  'preview.css': EMBEDDED_PREVIEW_CSS,
  'templates/minimal.css': EMBEDDED_MINIMAL_CSS,
  'templates/magazine.css': EMBEDDED_MAGAZINE_CSS,
  'templates/code.css': EMBEDDED_CODE_CSS,
  'templates/dream.css': EMBEDDED_DREAM_CSS,
  'templates/murmur.css': EMBEDDED_MURMUR_CSS,
  'templates/wake.css': EMBEDDED_WAKE_CSS,
};

/* ---------------- 2.5 字号调节控件（纯 CSS，注入预览与导出成品） ----------------
   原理：隐藏 radio + label 按钮 + body:has(#fs-*:checked) 改 body 字号。
   标题/正文/引用/代码多使用 em 单位，body 字号一变即整体缩放。
   无需脚本 → 在「预览 iframe（未开 allow-scripts）」与「导出单文件」里都能点。
   注意：控件样式用 px，避免被 body 字号连带缩放。 */

const FS_CTRL_CSS = `
/* 字号调节浮层（纯 CSS：radio + :has()） */
.fs-input {
  position: absolute;
  left: -9999px;
  opacity: 0;
  pointer-events: none;
}
.fs-ctrl {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(30, 32, 37, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 12px;
  color: #fff;
  user-select: none;
}
.fs-label {
  margin: 0 4px 0 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}
.fs-btn {
  padding: 5px 8px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  line-height: 1;
  border: 1px solid transparent;
}
.fs-btn:hover { background: rgba(255, 255, 255, 0.16); }
.fs-btn:active { background: rgba(255, 255, 255, 0.24); }

/* 当前选中档高亮 */
#fs-s:checked ~ .fs-ctrl .fs-btn[for="fs-s"],
#fs-m:checked ~ .fs-ctrl .fs-btn[for="fs-m"],
#fs-l:checked ~ .fs-ctrl .fs-btn[for="fs-l"],
#fs-xl:checked ~ .fs-ctrl .fs-btn[for="fs-xl"] {
  background: #fff;
  color: #1c1e22;
  font-weight: 700;
}

/* 字号档位：改 body 字号 → 内容整体缩放（默认档不设规则，回落模板基准） */
body:has(#fs-s:checked)  { font-size: 14px; }
body:has(#fs-l:checked)  { font-size: 18px; }
body:has(#fs-xl:checked) { font-size: 20px; }

@media print {
  .fs-ctrl, .fs-input { display: none !important; }
}
`;

const FS_CTRL_HTML = `
<!-- 字号调节控件（纯 CSS，无脚本） -->
<input class="fs-input" type="radio" name="fs" id="fs-s" value="s">
<input class="fs-input" type="radio" name="fs" id="fs-m" value="m" checked>
<input class="fs-input" type="radio" name="fs" id="fs-l" value="l">
<input class="fs-input" type="radio" name="fs" id="fs-xl" value="xl">
<div class="fs-ctrl" role="group" aria-label="字号调节">
  <span class="fs-label">字号</span>
  <label class="fs-btn" for="fs-s" title="小号字体">小</label>
  <label class="fs-btn" for="fs-m" title="默认字体">默认</label>
  <label class="fs-btn" for="fs-l" title="大号字体">大</label>
  <label class="fs-btn" for="fs-xl" title="特大字体">特大</label>
</div>
`;

/* ---------------- 3. DOM 引用与状态 ---------------- */
const $ = (id) => document.getElementById(id);
const app           = $('app');
const overlay       = $('authOverlay');
const authForm      = $('authForm');
const authInput     = $('authInput');
const authError     = $('authError');
const tplSelect     = $('tplSelect');
const editor        = $('editor');
const frame         = $('previewFrame');
const exportBtn     = $('exportBtn');
const publishBtn    = $('publishBtn');
const publishModal  = $('publishModal');
const publishForm   = $('publishForm');
const pubCategory   = $('pubCategory');
const pubTitle      = $('pubTitle');
const pubPassword   = $('pubPassword');
const pubError      = $('pubError');
const pubSubmit     = $('pubSubmit');
const mobileToggle  = $('mobileToggle');
const wordCount     = $('wordCount');
const toastEl       = $('toast');

let currentTpl = DEFAULT_TPL;
const undoStack = [];
const UNDO_LIMIT = 100;
let renderTimer = null;
let saveTimer = null;
let toastTimer = null;
let markedConfigured = false;

/* ---------- localStorage 小工具（隐私模式失败时静默降级） ---------- */
function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
}

/* ---------- Toast 轻提示 ---------- */
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------- marked 就绪检查 + 参数设置 ---------- */
function markedReady() {
  return typeof window.marked === 'object' && typeof window.marked.parse === 'function';
}
function ensureMarked() {
  if (!markedReady()) return false;
  if (!markedConfigured) {
    // gfm: 表格/删除线等；breaks: 普通换行即 <br>，符合中文写作习惯
    marked.setOptions({ gfm: true, breaks: true });
    markedConfigured = true;
  }
  return true;
}

/* ---------------- 4. 密码保护 ---------------- */
function submitPassword() {
  if (authInput.value === PASSWORD) {
    lsSet(KEY.auth, '1');          // 记住登录状态，刷新免输密码
    enterApp();
  } else {
    authError.textContent = '密码错误';
    authForm.classList.remove('shake');
    void authForm.offsetWidth;     // 重新触发 CSS 抖动动画
    authForm.classList.add('shake');
    authInput.select();
  }
}

function enterApp() {
  overlay.classList.add('hidden');
  app.classList.remove('hidden');

  // 恢复文章与模板；首次使用给示例文章
  editor.value = lsGet(KEY.md, '');
  if (!editor.value.trim()) editor.value = SAMPLE_MD;
  currentTpl = lsGet(KEY.tpl, DEFAULT_TPL);
  if (!TPL_MAP[currentTpl]) currentTpl = DEFAULT_TPL;
  tplSelect.value = currentTpl;

  updateWordCount();
  syncUndoBtn();
  render();
  editor.focus();
}

/* ---------------- 5. 编辑器工具栏 ---------------- */
function runCommand(cmd) {
  editor.focus();
  switch (cmd) {
    case 'undo':   undo(); break;
    case 'h1':     prefixLines('# '); break;
    case 'h2':     prefixLines('## '); break;
    case 'bold':   wrapSel('**', '**', '加粗文字'); break;
    case 'italic': wrapSel('*', '*', '斜体文字'); break;
    case 'strike': wrapSel('~~', '~~', '删除线文字'); break;
    case 'quote':  prefixLines('> '); break;
    case 'ul':     prefixLines('- '); break;
    case 'ol':     prefixLines('1. '); break;
    case 'code':   wrapSel('`', '`', 'code'); break;
    case 'pre':    insertCodeBlock(); break;
    case 'link':   insertLink(); break;
    case 'image':  insertImage(); break;
    case 'hr':     insertHr(); break;
  }
}

/* 修改前快照（仅工具栏操作入栈，撤销步数上限见 UNDO_LIMIT） */
function snapshot() {
  undoStack.push({ v: editor.value, s: editor.selectionStart, e: editor.selectionEnd });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  syncUndoBtn();
}
function undo() {
  const st = undoStack.pop();
  if (!st) return;
  editor.value = st.v;
  editor.setSelectionRange(st.s, st.e);
  syncUndoBtn();
  afterEdit();
}
function syncUndoBtn() {
  const btn = document.querySelector('.tool-btn[data-cmd="undo"]');
  if (btn) btn.disabled = undoStack.length === 0;
}

/* 触发统一的 input 处理（渲染 + 自动保存 + 字数） */
function afterEdit() {
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

/* 在选区前后包裹符号；无选区时插入「占位符」并选中，方便直接替换 */
function wrapSel(open, close, placeholder) {
  snapshot();
  const s = editor.selectionStart, e = editor.selectionEnd;
  const sel = editor.value.slice(s, e);
  if (sel) {
    editor.setRangeText(open + sel + close, s, e, 'end');
  } else {
    editor.setRangeText(open + placeholder + close, s, e, 'preserve');
    editor.focus();
    editor.setSelectionRange(s + open.length, s + open.length + placeholder.length);
  }
  afterEdit();
}

/* 行前缀（标题/引用/列表）：作用于「选区覆盖的每一行」，再次点击取消 */
function prefixLines(prefix) {
  snapshot();
  const v = editor.value;
  const s = editor.selectionStart, e = editor.selectionEnd;
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;   // 选区起始行行首
  let lineEnd = v.indexOf('\n', e);                    // 选区结束行行尾
  if (lineEnd === -1) lineEnd = v.length;
  const lines = v.slice(lineStart, lineEnd).split('\n');
  const allHave = lines.length > 0 && lines.every((l) => l.startsWith(prefix));
  const out = lines.map((l) => {
    if (allHave && l.startsWith(prefix)) return l.slice(prefix.length);
    if (allHave) return l;                              // 空行：去掉前缀时保持为空
    return prefix + l;
  }).join('\n');
  editor.setRangeText(out, lineStart, lineEnd, 'select');
  afterEdit();
}

/* 插入代码块：有选区则把选区包进代码块，否则插入空代码块 */
function insertCodeBlock() {
  snapshot();
  const s = editor.selectionStart, e = editor.selectionEnd;
  const sel = editor.value.slice(s, e);
  const fence = '```';
  let text, caret;
  if (sel) {
    text = fence + '\n' + sel + '\n' + fence;
    caret = s + text.length;
  } else {
    text = fence + '\n\n' + fence;
    caret = s + fence.length + 1;    // 停在代码块中间的空行
  }
  editor.setRangeText(text, s, e, 'preserve');
  editor.focus();
  editor.setSelectionRange(caret, caret);
  afterEdit();
}

/* 插入链接/图片：[文字](https://) / ![说明](https://)，光标落在 url 上 */
function insertLink() {
  snapshot();
  const s = editor.selectionStart, e = editor.selectionEnd;
  const label = editor.value.slice(s, e) || '链接文字';
  const url = 'https://';
  editor.setRangeText('[' + label + '](' + url + ')', s, e, 'preserve');
  editor.focus();
  const urlStart = s + 1 + label.length + 2;   // 跳过 [ label ](
  editor.setSelectionRange(urlStart, urlStart + url.length);
  afterEdit();
}
function insertImage() {
  snapshot();
  const s = editor.selectionStart, e = editor.selectionEnd;
  const alt = editor.value.slice(s, e) || '图片说明';
  const url = 'https://';
  editor.setRangeText('![' + alt + '](' + url + ')', s, e, 'preserve');
  editor.focus();
  const urlStart = s + 2 + alt.length + 2;     // 跳过 ![ alt ](
  editor.setSelectionRange(urlStart, urlStart + url.length);
  afterEdit();
}

/* 插入分割线 */
function insertHr() {
  snapshot();
  const s = editor.selectionStart;
  editor.setRangeText('\n\n---\n\n', s, s, 'preserve');
  editor.focus();
  editor.setSelectionRange(s + 5, s + 5);      // 停在 --- 之后的行首
  afterEdit();
}

/* ---------- 字数统计 + 自动保存 ---------- */
function updateWordCount() {
  const n = editor.value.replace(/\s/g, '').length;
  wordCount.textContent = n + ' 字';
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => lsSet(KEY.md, editor.value), AUTOSAVE_DELAY);
}

/* ---------------- 6. 实时预览 ---------------- */
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, RENDER_DELAY);
}

/* 构造与「导出文件」同构的 HTML。
   预览用 <link> 引用真实 css 文件，file:// 与 http 下都能看到最新样式。
   <base> 指向 index.html 所在目录，保证 about:blank 沙箱里相对路径生效。 */
function previewDocHtml() {
  const tpl = TPL_MAP[currentTpl];
  const dirUrl = new URL('.', location.href).href;
  return ''
    + '<!DOCTYPE html>\n'
    + '<html lang="zh-CN">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<base href="' + dirUrl + '">\n'
    + '<link rel="stylesheet" href="preview.css">\n'
    + '<link rel="stylesheet" href="' + tpl.file + '">\n'
    + '<style>\n'
    + FS_CTRL_CSS
    + '</style>\n'
    + '</head>\n'
    + '<body>\n'
    + FS_CTRL_HTML
    + '<article>\n'
    + marked.parse(editor.value)
    + '\n</article>\n'
    + '</body>\n'
    + '</html>';
}

function render() {
  if (!ensureMarked()) {
    $('previewHint').textContent = '⚠ marked.js 未加载，请检查网络后刷新';
    return;
  }
  $('previewHint').textContent = '';

  const doc = frame.contentDocument;
  if (!doc) return;
  const scroller = doc.scrollingElement || doc.documentElement;
  const prevTop = scroller ? scroller.scrollTop : 0;

  doc.open();
  doc.write(previewDocHtml());
  doc.close();

  // 尽量保持预览滚动位置，减少连续输入时的跳动
  requestAnimationFrame(() => {
    const el = doc.scrollingElement || doc.documentElement;
    if (el) el.scrollTop = Math.min(prevTop, Math.max(0, el.scrollHeight - el.clientHeight));
  });
}

/* ---------------- 7. 导出独立 HTML ---------------- */
const cssCache = {};

async function readCssText(url) {
  if (cssCache[url]) return cssCache[url];
  try {
    // http(s) 环境：读取真实 CSS 文件（改模板样式立即生效）
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('not css');   // 服务器返回了错误页
    cssCache[url] = text;
    return text;
  } catch (err) {
    // file:// 直开时浏览器禁止 fetch 本地文件 → 使用内置副本
    const fb = EMBEDDED_CSS[url];
    if (fb) {
      cssCache[url] = fb;
      return fb;
    }
    throw new Error('无法读取样式文件：' + url);
  }
}

async function exportHtml() {
  if (!ensureMarked()) { toast('marked.js 加载失败，无法导出'); return; }
  const tpl = TPL_MAP[currentTpl];
  let css;
  try {
    css = await Promise.all([
      readCssText('preview.css'),
      readCssText(tpl.file),
    ]);
  } catch (err) {
    toast(err.message);
    return;
  }
  const title = makeTitle();
  const doc = buildStandaloneDoc({
    title: title,
    css: css[0] + '\n\n' + css[1],
    bodyHtml: marked.parse(editor.value),
  });
  download(title + '.html', doc);
  toast('已导出：' + title + '.html');
}

/* 生成完全独立、不依赖任何外部资源的单文件 HTML */
function buildStandaloneDoc(opts) {
  return ''
    + '<!DOCTYPE html>\n'
    + '<html lang="zh-CN">\n'
    + '<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + escapeHtml(opts.title) + '</title>\n'
    + '<style>\n'
    + opts.css
    + '\n'
    + FS_CTRL_CSS
    + '</style>\n'
    + '</head>\n'
    + '<body>\n'
    + FS_CTRL_HTML
    + '<article>\n'
    + opts.bodyHtml
    + '\n</article>\n'
    + '</body>\n'
    + '</html>';
}

/* 文件名：取第一个 "# 标题"，去掉行内符号后做安全化；否则 article-日期 */
function makeTitle() {
  const m = editor.value.match(/^\s*#\s+(.+)$/m);
  let raw = m ? m[1].trim() : '';
  raw = raw.replace(/[*_`~]/g, '').trim();
  const safe = raw.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  if (safe) return safe.slice(0, 60);
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return 'article-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

/* ---------------- 8. 发布到主页（/api/publish） ----------------
   把正文渲染为「所选分类对应模板」的单文件 HTML（与导出同构）。
   安全流程：先 GET /api/challenge 取一次性 nonce → 用发布密码在本机
   算 HMAC-SHA256 签名 → POST { title, content, category, nonce, digest }
   —— 明文密码永不上传；签名一次性、不可重放。
   成功 → toast「发布成功」；签名错 → 红字「密码错误」；网络异常 → 「网络错误」。 */
function guessTitle() {
  const m = editor.value.match(/^\s*#\s+(.+)$/m);
  let t = m ? m[1].trim() : '';
  t = t.replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
  return t.slice(0, 60);
}

function openPublishDialog() {
  pubError.textContent = '';
  pubTitle.value = guessTitle();
  pubPassword.value = '';
  publishModal.classList.remove('hidden');
  (pubTitle.value ? pubPassword : pubTitle).focus();
}

function closePublishDialog() {
  publishModal.classList.add('hidden');
}

/* 用密码对 message 计算 HMAC-SHA256，返回小写 hex（仅在本机计算） */
async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function publishPost() {
  const title = pubTitle.value.trim();
  const password = pubPassword.value.trim();
  const category = pubCategory.value;
  const content = editor.value;

  pubError.textContent = '';
  if (!content.trim()) { pubError.textContent = '正文为空，无法发布'; return; }
  if (!title) { pubError.textContent = '请填写标题'; pubTitle.focus(); return; }
  if (!password) { pubError.textContent = '请填写发布密码'; pubPassword.focus(); return; }
  if (!ensureMarked()) { pubError.textContent = 'marked.js 未加载，无法发布'; return; }
  if (!window.crypto || !window.crypto.subtle) {
    pubError.textContent = '当前环境不支持安全发布（需 HTTPS 或 localhost）';
    return;
  }

  // 渲染为该分类对应模板的单文件 HTML（复用导出链路）
  const tpl = TPL_MAP[PUBLISH_TEMPLATE[category]];
  let css;
  try {
    css = await Promise.all([
      readCssText('preview.css'),
      readCssText(tpl.file),
    ]);
  } catch (err) {
    pubError.textContent = err.message || '样式加载失败';
    return;
  }
  const doc = buildStandaloneDoc({
    title: title,
    css: css[0] + '\n\n' + css[1],
    bodyHtml: marked.parse(content),
  });

  pubSubmit.disabled = true;
  try {
    // 1) 领取一次性 nonce（120s 有效，用过即作废）
    const ch = await fetch('/api/challenge', { cache: 'no-store' });
    if (!ch.ok) { pubError.textContent = '获取发布凭证失败，请检查网络后重试'; return; }
    const chData = await ch.json();
    if (!chData || !chData.nonce) throw new Error('no nonce');

    // 2) 密码只在本机参与签名，明文不上传；签名一次性、不可重放
    const digest = await hmacSha256Hex(password, chData.nonce);

    // 3) 提交文章 + nonce + 签名
    const res = await fetch(PUBLISH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, content: doc, category,
        nonce: chData.nonce, digest,
      }),
    });
    if (res.ok) { closePublishDialog(); toast('发布成功'); return; }
    let serverMsg = '';
    try {
      const data = await res.json();
      serverMsg = (data && (data.error || data.message)) || '';
    } catch (e) { /* 响应非 JSON 时忽略 */ }
    pubError.textContent =
      (res.status === 401 || res.status === 403 || /密码错误/.test(serverMsg))
        ? '密码错误'
        : (serverMsg || '发布失败（HTTP ' + res.status + '）');
  } catch (err) {
    pubError.textContent = '网络错误';
  } finally {
    pubSubmit.disabled = false;
  }
}

/* ---------------- 9. 移动端：预览 / 编辑切换 ---------------- */
function toggleMobileView() {
  const show = app.classList.toggle('show-preview');
  if (show) render();          // 切到预览时立即刷新一次
  syncMobileBtn();
}
function syncMobileBtn() {
  mobileToggle.textContent = app.classList.contains('show-preview') ? '✎ 编辑' : '👁 预览';
}

/* ---------------- 10. 初始化 ---------------- */
function init() {
  // 已通过密码验证 → 直接进入；否则显示登录遮罩
  if (lsGet(KEY.auth) === '1') {
    enterApp();
  } else {
    overlay.classList.remove('hidden');
    authInput.focus();
  }

  // 密码框提交（按钮 / 回车）
  authForm.addEventListener('submit', (e) => { e.preventDefault(); submitPassword(); });

  // 工具栏按钮
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => runCommand(btn.dataset.cmd));
  });

  // 模板切换：立即换预览样式，并记住选择
  tplSelect.addEventListener('change', () => {
    currentTpl = tplSelect.value;
    lsSet(KEY.tpl, currentTpl);
    scheduleRender();
  });

  // 输入 → 字数 + 自动保存 + 实时预览（都带防抖）
  editor.addEventListener('input', () => {
    updateWordCount();
    scheduleSave();
    scheduleRender();
  });

  exportBtn.addEventListener('click', exportHtml);
  publishBtn.addEventListener('click', openPublishDialog);
  publishModal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closePublishDialog();
  });
  publishForm.addEventListener('submit', (e) => { e.preventDefault(); publishPost(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !publishModal.classList.contains('hidden')) closePublishDialog();
  });
  mobileToggle.addEventListener('click', toggleMobileView);

  // 离开页面时把内容落盘
  window.addEventListener('pagehide', () => lsSet(KEY.md, editor.value));
}

init();





