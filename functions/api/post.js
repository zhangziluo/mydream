/* =========================================================
   /api/post —— 阅读 / 删除单篇文章（Cloudflare Pages Function）

   GET    /api/post?slug=<slug>  返回已渲染的单文件 HTML（阅读页）
                                 若该文是长文章节，会在正文末尾注入
                                 「上一章 / 目录 / 下一章」导航（服务端注入，
                                 保证新增章节后旧章节也能拿到新链接）
   GET    /api/post?slug=<slug>&md=1 返回 JSON
                                  {slug,title,category,md,createdAt,book,bookTitle,order}
                                  —— 写作工具「打开文件」打开已发布文章编辑用；
   DELETE /api/post?slug=<slug>  删除文章（body 携带 { nonce, digest }，
                                 鉴权见 _shared/auth.js）；若是长文章节，
                                 同时从长文章节表移除，长文空了则连整部删除。

   首页/分类页卡片点开 = GET 阅读；html-writer「发布管理」删除 = DELETE。
   ========================================================= */
import { verifyChallenge } from '../_shared/auth.js';
import {
  SAFE_SLUG, BOOK_PREFIX, POST_PREFIX, readBook, removeChapter, saveBook,
} from '../_shared/books.js';

function json(data, status) {
  return Response.json(data, { status: status || 200 });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------- 长文章节导航（注入成品 HTML） ---------- */
const NAV_CSS = '<style>'
  + '.hw-chapter-nav{display:flex;align-items:flex-end;justify-content:space-between;'
  + 'gap:14px;margin:3.2em 0 0;padding-top:1.3em;'
  + 'border-top:1px solid rgba(128,128,128,.32);font-size:.88em;line-height:1.6}'
  + '.hw-chapter-nav a{color:inherit;text-decoration:none}'
  + '.hw-chapter-nav .hw-nav-dir{display:block;font-size:.8em;letter-spacing:.14em;'
  + 'opacity:.62;margin-bottom:2px}'
  + '.hw-chapter-nav .hw-nav-link{max-width:40%}'
  + '.hw-chapter-nav .hw-nav-next{text-align:right;margin-left:auto}'
  + '.hw-chapter-nav .hw-nav-title{border-bottom:1px dashed rgba(128,128,128,.5)}'
  + '.hw-chapter-nav a:hover .hw-nav-title{border-bottom-style:solid}'
  + '.hw-chapter-nav .hw-nav-toc{flex:none;text-align:center;white-space:nowrap;padding:0 6px}'
  + '.hw-chapter-nav .hw-nav-toc .hw-nav-title{border-bottom:0}'
  + '@media print{.hw-chapter-nav{display:none}}'
  + '</style>';

const postHref = (slug) => '/api/post?slug=' + encodeURIComponent(slug);

/* 生成章节导航：上一章 / 目录（第 n / 总章数）/ 下一章 */
function chapterNavHtml(book, chapterSlug) {
  const chapters = book.chapters || [];
  const idx = chapters.findIndex((c) => String(c.slug) === String(chapterSlug));
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = (idx >= 0 && idx < chapters.length - 1) ? chapters[idx + 1] : null;
  const bookTitle = escapeHtml(book.title || '');

  const prevHtml = prev
    ? '<a class="hw-nav-link hw-nav-prev" href="' + postHref(prev.slug) + '">'
      + '<span class="hw-nav-dir">← 上一章</span>'
      + '<span class="hw-nav-title">' + escapeHtml(prev.title) + '</span></a>'
    : '<span class="hw-nav-link hw-nav-prev" aria-hidden="true"></span>';

  const nextHtml = next
    ? '<a class="hw-nav-link hw-nav-next" href="' + postHref(next.slug) + '">'
      + '<span class="hw-nav-dir">下一章 →</span>'
      + '<span class="hw-nav-title">' + escapeHtml(next.title) + '</span></a>'
    : '<span class="hw-nav-link hw-nav-next" aria-hidden="true"></span>';

  const pos = idx >= 0
    ? '<span class="hw-nav-dir">目录 · 第 ' + (idx + 1) + ' / ' + chapters.length + ' 章</span>'
    : '<span class="hw-nav-dir">目录</span>';
  const toc = '<a class="hw-nav-toc" href="/book?slug=' + encodeURIComponent(book.slug) + '"'
    + ' title="《' + bookTitle + '》目录">' + pos
    + '<span class="hw-nav-title">《' + bookTitle + '》</span></a>';

  return NAV_CSS
    + '<nav class="hw-chapter-nav" aria-label="章节导航">'
    + prevHtml + toc + nextHtml
    + '</nav>';
}

/* 把导航插到正文末尾（</article> 内），没有 article 则退回 </body> 前 */
function injectChapterNav(html, nav) {
  const s = String(html);
  if (/<\/article>/i.test(s)) return s.replace(/<\/article>/i, nav + '\n</article>');
  if (/<\/body>/i.test(s)) return s.replace(/<\/body>/i, nav + '\n</body>');
  return s + nav;
}

/* ====================== GET：阅读 / 编辑用 Markdown ====================== */
export async function onRequestGet({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return new Response('Server not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  const wantMd = url.searchParams.get('md') === '1';
  if (!SAFE_SLUG.test(slug)) {
    return new Response('Not found', { status: 404 });
  }

  const raw = await kv.get(POST_PREFIX + slug);
  if (!raw) {
    return new Response('Not found', { status: 404 });
  }

  let r;
  try {
    r = JSON.parse(raw);
  } catch (e) {
    return new Response('Broken record', { status: 500 });
  }

  // ?md=1：写作工具「打开文件」编辑已发布文章用，返回原始 Markdown + 长文归属
  if (wantMd) {
    const bookSlug = r.book ? String(r.book) : '';
    let book = null;
    let order = 0;
    if (bookSlug) {
      book = await readBook(kv, bookSlug);
      if (book) {
        const i = (book.chapters || []).findIndex((c) => String(c.slug) === slug);
        order = i >= 0 ? i + 1 : 0;
      }
    }
    return json({
      slug: r.slug || slug,
      title: String(r.title || ''),
      category: String(r.category || ''),
      md: String(r.md || ''),
      createdAt: Number(r.createdAt) || 0,
      book: bookSlug,
      bookTitle: book ? String(book.title || '') : '',
      order,
      chapterCount: book ? (book.chapters || []).length : 0,
    });
  }

  // 阅读：长文章节自动追加「上一章 / 目录 / 下一章」导航
  let html = String(r.content);
  if (r.book) {
    const book = await readBook(kv, String(r.book));
    if (book) html = injectChapterNav(html, chapterNavHtml(book, slug));
  }
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* ====================== DELETE：删除文章（含长文章节表维护） ====================== */
export async function onRequestDelete({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return json({ error: '服务器未配置存储（MYDREAM_KV）' }, 500);
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!SAFE_SLUG.test(slug)) {
    return json({ error: '文章不存在' }, 404);
  }

  let body = null;
  try {
    body = await request.json();
  } catch (e) { /* ignore */ }
  if (!body || typeof body !== 'object') {
    return json({ error: '请求体必须是 JSON' }, 400);
  }

  // 一次性 nonce + HMAC 校验（含 env.PUBLISH_PASSWORD 缺失检查）
  const auth = await verifyChallenge(
    env, kv,
    String(body.nonce || ''),
    String(body.digest || '')
  );
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  const key = POST_PREFIX + slug;
  const raw = await kv.get(key);
  if (!raw) {
    return json({ error: '文章不存在' }, 404);
  }
  await kv.delete(key);

  // 长文章节：同步从长文章节表移除；长文空了就连整部长文一起删除
  let bookSlug = '';
  let bookDeleted = false;
  try {
    const r = JSON.parse(raw);
    if (r && r.book) bookSlug = String(r.book);
  } catch (e) { /* ignore */ }
  if (bookSlug) {
    const book = await readBook(kv, bookSlug);
    if (book && removeChapter(book, slug)) {
      if (book.chapters.length) {
        await saveBook(kv, book);
      } else {
        await kv.delete(BOOK_PREFIX + book.slug);
        bookDeleted = true;
      }
    }
  }

  return json(Object.assign(
    { ok: true, slug },
    bookSlug ? { book: bookSlug, bookDeleted } : {}
  ));
}
