/* =========================================================
   /api/posts —— 文章 / 长文列表（Cloudflare Pages Function，GET）

   用法：
     GET /api/posts                             → 分组对象（首页用）
     GET /api/posts?category=dream|murmur|awake → 该分类扁平数组
         （分类管理页/瀑布流用，按 createdAt 降序）
     GET /api/posts?chapters=1                  → 连章节一起返回
         （html-writer「🗂 已发布 / 📂 打开文件」列表用；站点页面不用，
           因为章节统一由长文目录页 book.html 组织，避免重复卡片）

   每项含 { slug, title, note, category, createdAt, text, hasMd, type }
     · type='post' 单篇文章；属长文章节时另有 book / bookTitle / order
     · type='book' 长文（分章作品）：另有 chapterCount，slug 为长文 slug，
       text 为各章标题拼接（分类页全文搜索用），note 形如「共 3 章 · 最新《…》」
   —— text 为正文去标签后的纯文本（供分类页全文搜索）；
   hasMd = 是否存有原始 Markdown（写作工具「打开文件」可编辑标记）。
   ========================================================= */
import {
  CATEGORIES, POST_PREFIX, BOOK_PREFIX, bookNote, bookText,
} from '../_shared/books.js';

/* 正文 HTML → 纯文本：先剔除 <style>/<script>，再去标签、折叠空白 */
function stripToText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function readJSON(kv, key) {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: 'server not configured' }, { status: 500 });
  }

  const url = new URL(request.url);
  const category = (url.searchParams.get('category') || '').trim();
  if (category && !CATEGORIES.includes(category)) {
    return Response.json({ error: 'category invalid' }, { status: 400 });
  }
  const withChapters = url.searchParams.get('chapters') === '1';

  const [postKeys, bookKeys] = await Promise.all([
    kv.list({ prefix: POST_PREFIX }),
    kv.list({ prefix: BOOK_PREFIX }),
  ]);

  // 长文：slug → { slug,title,category,updatedAt,chapters }，并建立「章节 slug → 章序」索引
  const bookMap = {};
  const books = (await Promise.all(
    bookKeys.keys.map(async (k) => {
      const b = await readJSON(kv, k.name);
      if (!b || typeof b !== 'object' || !Array.isArray(b.chapters)) return null;
      const slug = String(b.slug || k.name.slice(BOOK_PREFIX.length));
      const order = {};
      b.chapters.forEach((c, i) => { order[String(c.slug || '')] = i + 1; });
      bookMap[slug] = {
        slug,
        title: String(b.title || ''),
        category: CATEGORIES.includes(b.category) ? b.category : 'dream',
        order,
      };
      return b;
    })
  )).filter(Boolean);

  const records = await Promise.all(
    postKeys.keys.map(async (k) => {
      const r = await readJSON(kv, k.name);
      if (!r || typeof r !== 'object') return null;
      const slug = r.slug || k.name.slice(POST_PREFIX.length);
      const cat = CATEGORIES.includes(r.category) ? r.category : 'dream';
      const bookSlug = r.book ? String(r.book) : '';
      const info = bookSlug ? bookMap[bookSlug] : null;
      const item = {
        type: 'post',
        slug,
        title: String(r.title || ''),
        note: String(r.note || ''),
        category: cat,
        createdAt: Number(r.createdAt) || 0,
        text: stripToText(r.content || ''),
        hasMd: Boolean(r.md),
      };
      if (bookSlug) {
        item.book = bookSlug;
        item.bookTitle = info ? info.title : '';
        item.order = info ? (info.order[slug] || 0) : 0;
      }
      return item;
    })
  );

  // 章节默认不进列表（由长文目录页统一组织）；长文本身作为一张卡片出现
  const posts = records
    .filter(Boolean)
    .filter((p) => (withChapters || !p.book))
    .filter((p) => !category || p.category === category);

  const bookItems = books
    .map((b) => ({
      type: 'book',
      slug: String(b.slug),
      title: String(b.title || ''),
      note: bookNote(b),
      category: CATEGORIES.includes(b.category) ? b.category : 'dream',
      createdAt: Number(b.updatedAt) || Number(b.createdAt) || 0,
      text: bookText(b),
      hasMd: true,
      chapterCount: b.chapters.length,
    }))
    .filter((b) => !category || b.category === category);

  const all = posts.concat(bookItems).sort((a, b) => b.createdAt - a.createdAt);

  if (category) return Response.json(all);

  const out = { dream: [], murmur: [], awake: [] };
  all.forEach((p) => out[p.category].push(p));
  return Response.json(out);
}
