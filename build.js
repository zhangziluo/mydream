#!/usr/bin/env node
/* =========================================================
   build.js —— Mydream 首页作品卡片生成器
   在项目根目录运行：node build.js

   扫描三个作品目录顶层的 *.html，把「链接卡片」自动写进
   index.html 的对应板块（<ul class="works" data-works="…">）：

     dream/   → data-works="dream"   （梦）
     whisper/ → data-works="murmur"  （梦呓，首页板块 id 沿用 murmur）
     awake/   → data-works="wake"    （醒）

   每份卡片：标题取文件 <title>，说明取 <meta description>，
   都没有则取正文第一段 <p>（超长截断）；排序按文件修改时间，最新在前。
   目录为空（或不存在）时写入「静候文字落笔……」占位。

   流程：往 dream/ whisper/ awake/ 丢入导出的 HTML → node build.js → 刷新首页。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, 'index.html');

/* 目录名 → 首页板块（data-works 值） */
const BOARDS = [
  { dir: 'dream', board: 'dream', label: '梦' },
  { dir: 'whisper', board: 'murmur', label: '梦呓' },
  { dir: 'awake', board: 'wake', label: '醒' }
];

const EMPTY_LI = '<li class="empty">静候文字落笔……</li>';

/* ---------- 小工具 ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function collapse(s) { return String(s).replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
function limit(s, n) { return s.length <= n ? s : s.slice(0, n - 1) + '…'; }
function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }

/* ---------- 从 HTML 文件提取元信息 ---------- */
function readFile(p) { return fs.readFileSync(p, 'utf8'); }

function pickTitle(fileBase, html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) {
    const t = collapse(stripTags(m[1]));
    if (t) return t;
  }
  return fileBase; // 兜底：去掉扩展名的文件名
}

function pickNote(html) {
  const md = html.match(/<meta\s+name=["']description["'][^>]*content=["']([^"']*)["']/i)
          || html.match(/<meta\s+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (md && collapse(md[1])) return limit(collapse(md[1]), 110);

  // 正文第一段：优先 <article>，其次 <body>
  const box = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
           || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const src = box ? box[1] : html;
  const p = src.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (p) {
    const txt = collapse(stripTags(p[1]));
    if (txt) return limit(txt, 110);
  }
  return '';
}

/* ---------- 扫描单个目录 ---------- */
function scanDir(dirName) {
  const dir = path.join(ROOT, dirName);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(function (f) { return /\.html?$/i.test(f); })
    .map(function (f) {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { name: f, mtime: st.mtimeMs, full: full };
    })
    .sort(function (a, b) { return b.mtime - a.mtime; });
}

/* ---------- 生成卡片（缩进对齐现有 HTML） ---------- */
const P = '        '; // 8 空格

function cardHtml(dirName, file) {
  const html = readFile(file.full);
  const base = path.basename(file.name, path.extname(file.name));
  const title = pickTitle(base, html);
  const note = pickNote(html);
  const href = dirName + '/' + encodeURI(file.name);

  let out = '';
  out += P + '<li>\n';
  out += P + '  <a class="work" href="' + escapeHtml(href) + '" target="_blank" rel="noopener">\n';
  out += P + '    <span class="w-info">\n';
  out += P + '      <span class="w-title">《' + escapeHtml(title) + '》</span>\n';
  if (note) out += P + '      <span class="w-note">' + escapeHtml(note) + '</span>\n';
  out += P + '    </span>\n';
  out += P + '    <span class="w-badge">html</span>\n';
  out += P + '    <span class="w-go" aria-hidden="true">→</span>\n';
  out += P + '  </a>\n';
  out += P + '</li>';
  return out;
}

/* ---------- 写入 index.html ---------- */
function inject(indexHtml, board, items) {
  const re = new RegExp(
    '(<ul\\s+class="works"\\s+data-works="' + board.board + '">)[\\s\\S]*?(</ul>)'
  );
  if (!re.test(indexHtml)) {
    throw new Error('在 index.html 找不到 data-works="' + board.board + '" 的 <ul>');
  }
  const pad6 = '      ';
  const inner = items.length
    ? items.map(function (f) { return cardHtml(board.dir, f); }).join('\n')
    : pad6 + EMPTY_LI;
  return indexHtml.replace(re, '$1\n' + inner + '\n' + pad6 + '$2');
}

/* ---------- 主流程 ---------- */
function main() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error('✗ 找不到 index.html（build.js 需放在项目根目录运行）');
    process.exit(1);
  }

  let indexHtml = readFile(INDEX_PATH);
  let total = 0;

  console.log('Mydream 首页生成：\n');

  BOARDS.forEach(function (b) {
    const items = scanDir(b.dir);
    indexHtml = inject(indexHtml, b, items);
    total += items.length;
    const names = items.map(function (f) { return '  · ' + f.name; }).join('\n');
    console.log('[' + b.label + '] ' + b.dir + '/ → ' + items.length + ' 篇'
      + (names ? '\n' + names : ''));
  });

  fs.writeFileSync(INDEX_PATH, indexHtml);
  console.log('\n✓ index.html 已更新，共 ' + total + ' 张卡片。');
}

main();
