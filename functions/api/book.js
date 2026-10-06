/* =========================================================
   /api/book —— 长文（分章作品）目录 / 整部删除

   GET    /api/book?slug=<bookSlug>
          返回 JSON：{ slug, title, category, createdAt, updatedAt,
                       chapterCount, note, chapters: [{slug,title,createdAt}] }
          —— 目录页 book.html 渲染用；chapters 顺序即章序。
   DELETE /api/book?slug=<bookSlug>
          body 携带 { nonce, digest }（一次性 nonce + HMAC，见
          _shared/auth.js）→ 删除长文记录及其**全部章节** post。
   ========================================================= */
import { verifyChallenge } from '../_shared/auth.js';
import {
  CATEGORIES, SAFE_SLUG, BOOK_PREFIX, POST_PREFIX, readBook, bookNote,
} from '../_shared/books.js';

function json(data, status) {
  return Response.json(data, { status: status || 200 });
}

export async function onRequestGet({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) return json({ error: '服务器未配置存储（MYDREAM_KV）' }, 500);

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  const book = await readBook(kv, slug);
  if (!book) return json({ error: '长文不存在' }, 404);

  return json({
    slug: book.slug,
    title: String(book.title || ''),
    category: CATEGORIES.includes(book.category) ? book.category : 'dream',
    createdAt: Number(book.createdAt) || 0,
    updatedAt: Number(book.updatedAt) || Number(book.createdAt) || 0,
    chapterCount: book.chapters.length,
    note: bookNote(book),
    chapters: book.chapters.map((c) => ({
      slug: String(c.slug || ''),
      title: String(c.title || ''),
      createdAt: Number(c.createdAt) || 0,
    })),
  });
}

export async function onRequestDelete({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) return json({ error: '服务器未配置存储（MYDREAM_KV）' }, 500);

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!SAFE_SLUG.test(slug)) return json({ error: '长文不存在' }, 404);

  let body = null;
  try {
    body = await request.json();
  } catch (e) { /* ignore */ }
  if (!body || typeof body !== 'object') {
    return json({ error: '请求体必须是 JSON' }, 400);
  }

  // 一次性 nonce + HMAC 校验（与发布/删除文章同一套鉴权）
  const auth = await verifyChallenge(
    env, kv,
    String(body.nonce || ''),
    String(body.digest || '')
  );
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const book = await readBook(kv, slug);
  if (!book) return json({ error: '长文不存在' }, 404);

  // 先删章节，再删长文本身（顺序固定，便于失败时定位）
  await Promise.all(book.chapters.map((c) => kv.delete(POST_PREFIX + String(c.slug || ''))));
  await kv.delete(BOOK_PREFIX + book.slug);

  return json({ ok: true, slug: book.slug, deletedChapters: book.chapters.length });
}
