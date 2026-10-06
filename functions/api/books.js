/* =========================================================
   /api/books —— 长文列表（Cloudflare Pages Function，GET）

   用法：
     GET /api/books                        → 全部长文
     GET /api/books?category=dream|murmur|awake → 该分类的长文

   返回数组 [{ slug, title, category, createdAt, updatedAt,
              chapterCount, note, chapters }]，按 updatedAt 降序。
   —— html-writer 发布框「长文」下拉、长文管理对话框用。
   ========================================================= */
import { CATEGORIES, BOOK_PREFIX, bookNote } from '../_shared/books.js';

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

  const list = await kv.list({ prefix: BOOK_PREFIX });
  const books = (await Promise.all(
    list.keys.map(async (k) => {
      const raw = await kv.get(k.name);
      if (!raw) return null;
      try {
        const b = JSON.parse(raw);
        if (!b || typeof b !== 'object' || !Array.isArray(b.chapters)) return null;
        return {
          slug: String(b.slug || k.name.slice(BOOK_PREFIX.length)),
          title: String(b.title || ''),
          category: CATEGORIES.includes(b.category) ? b.category : 'dream',
          createdAt: Number(b.createdAt) || 0,
          updatedAt: Number(b.updatedAt) || Number(b.createdAt) || 0,
          chapterCount: b.chapters.length,
          note: bookNote(b),
          chapters: b.chapters.map((c) => ({
            slug: String(c.slug || ''),
            title: String(c.title || ''),
            createdAt: Number(c.createdAt) || 0,
          })),
        };
      } catch (e) {
        return null;
      }
    })
  ))
    .filter(Boolean)
    .filter((b) => !category || b.category === category)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return Response.json(books);
}
