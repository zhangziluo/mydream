/* =========================================================
   /api/publish —— 接收发布 / 原地更新（Cloudflare Pages Function，POST）

   安全模型：前端先 GET /api/challenge 领取一次性 nonce，再用
   发布密码对 nonce 计算 HMAC-SHA256 得到 digest。本端点只收到
     { title, content, category, md, slug?, book?, bookTitle?, nonce, digest }
   —— 发布密码本身**永不明文离开浏览器**，digest 一次性有效、不可重放。
   鉴权细节见 _shared/auth.js（发布与删除共用）。

   content = 渲染后的单文件 HTML（阅读页用）；md = 原始 Markdown
   （写作工具「打开已发布文章」编辑用；新发布与更新的文章都会保存）。
   请求带 slug → 原地更新该文章（保留 slug 与 createdAt）；
   不带 slug → 新建一篇文章。

   长文（分章作品）——两个可选字段二选一：
     · book      = 已存在长文的 slug → 本文作为该长文的**一章**
                   （新章追加到末尾，更新章节保持原章序），分类跟随长文；
     · bookTitle = 新建长文标题 → 先建长文，再把本文作为它的第一章；
   都不传 = 普通单篇文章。原本属于长文的文章若不再传 book/bookTitle，
   会自动从长文中移除（长文空了则一并删除）。

   校验通过后存 KV：文章 post:<slug>，长文 book:<bookSlug>。
   数据模型与章节表维护见 _shared/books.js。

   上线前需在 Cloudflare 控制台配置：
     · KV namespace 绑定   → 变量名 MYDREAM_KV
     · 环境变量 / 密钥      → PUBLISH_PASSWORD（仅存服务端，作 HMAC 密钥）
   ========================================================= */
import { verifyChallenge } from '../_shared/auth.js';
import {
  CATEGORIES, SAFE_SLUG, POST_PREFIX, BOOK_PREFIX,
  slugify, uniqueSlug, readBook, upsertChapter, removeChapter, saveBook,
} from '../_shared/books.js';

/* 从发布 HTML 提取首段作为首页卡片说明（思路同根目录 build.js） */
function extractNote(html) {
  const m = String(html).match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return '';
  const text = m[1]
    .replace(/<[^>]*>/g, '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return text.length > 110 ? text.slice(0, 109) + '…' : text;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  const data = await readJson(request);
  if (!data || typeof data !== 'object') {
    return Response.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }

  const title = String(data.title || '').trim();
  const content = String(data.content || '').trim();
  let category = data.category;
  const nonce = String(data.nonce || '');
  const digest = String(data.digest || '');
  const md = String(data.md || '');
  const updateSlug = data.slug ? String(data.slug).trim() : '';
  const bookInput = String(data.book || '').trim();                        // 已有长文
  const bookTitleInput = String(data.bookTitle || '').trim().slice(0, 80); // 新建长文

  if (!title) return Response.json({ error: '标题不能为空' }, { status: 400 });
  if (!content) return Response.json({ error: '内容为空' }, { status: 400 });

  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: '服务器未配置存储（MYDREAM_KV）' }, { status: 500 });
  }

  // 一次性 nonce + HMAC 校验（含 env.PUBLISH_PASSWORD 缺失检查）
  const auth = await verifyChallenge(env, kv, nonce, digest);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // 更新模式：先取出原文（保留 slug / createdAt，并知道它原本属于哪部长文）
  let prev = null;
  if (updateSlug) {
    if (!SAFE_SLUG.test(updateSlug)) {
      return Response.json({ error: '文章不存在' }, { status: 404 });
    }
    const raw = await kv.get(POST_PREFIX + updateSlug);
    if (raw) {
      try { prev = JSON.parse(raw); } catch (e) { /* ignore */ }
    }
    if (!prev || typeof prev !== 'object') {
      return Response.json({ error: '文章不存在' }, { status: 404 });
    }
  }

  /* ---------- 解析目标长文：null = 单篇文章 ---------- */
  let targetBook = null;
  if (bookInput) {
    targetBook = await readBook(kv, bookInput);
    if (!targetBook) {
      return Response.json({ error: '长文不存在（可能已被删除）' }, { status: 400 });
    }
    // 章节分类跟随长文，避免同一部书里分类不一致
    if (CATEGORIES.includes(targetBook.category)) category = targetBook.category;
  } else if (bookTitleInput) {
    const bookSlug = await uniqueSlug(kv, BOOK_PREFIX, slugify(bookTitleInput));
    targetBook = {
      slug: bookSlug,
      title: bookTitleInput,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chapters: [],
    };
  }

  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: '分类无效' }, { status: 400 });
  }

  const slug = updateSlug || await uniqueSlug(kv, POST_PREFIX, slugify(title));
  const createdAt = prev ? (Number(prev.createdAt) || Date.now()) : Date.now();

  const record = {
    slug,
    title,
    category,
    content,
    md,
    note: extractNote(content),
    createdAt,
  };
  if (targetBook) record.book = targetBook.slug;
  if (prev) record.updatedAt = Date.now();

  // 原先属于别的长文（或不再属于任何长文）→ 先从原长文移除，空了就删掉整部长文
  const prevBookSlug = prev && prev.book ? String(prev.book) : '';
  const targetBookSlug = targetBook ? targetBook.slug : '';
  if (prevBookSlug && prevBookSlug !== targetBookSlug) {
    const prevBook = await readBook(kv, prevBookSlug);
    if (prevBook && removeChapter(prevBook, slug)) {
      if (prevBook.chapters.length) await saveBook(kv, prevBook);
      else await kv.delete(BOOK_PREFIX + prevBook.slug);
    }
  }

  await kv.put(POST_PREFIX + slug, JSON.stringify(record));

  // 登记 / 更新章节（数组顺序即章序；order 为 1 起的章节序号）
  let order = 0;
  if (targetBook) {
    order = upsertChapter(targetBook, { slug, title, createdAt });
    await saveBook(kv, targetBook);
  }

  return Response.json(Object.assign(
    { ok: true, slug, updated: Boolean(prev) },
    targetBook ? { book: targetBook.slug, bookTitle: targetBook.title, order } : {}
  ));
}
