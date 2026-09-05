/* =========================================================
   /api/publish —— 接收发布 / 原地更新（Cloudflare Pages Function，POST）

   安全模型：前端先 GET /api/challenge 领取一次性 nonce，再用
   发布密码对 nonce 计算 HMAC-SHA256 得到 digest。本端点只收到
     { title, content, category, md, slug?, nonce, digest }
   —— 发布密码本身**永不明文离开浏览器**，digest 一次性有效、不可重放。
   鉴权细节见 _shared/auth.js（发布与删除共用）。

   content = 渲染后的单文件 HTML（阅读页用）；md = 原始 Markdown
   （写作工具「打开已发布文章」编辑用；新发布与更新的文章都会保存）。
   请求带 slug → 原地更新该文章（保留 slug 与 createdAt）；
   不带 slug → 新建一篇文章。

   校验通过后把文章存入 KV，键：post:<slug>。

   上线前需在 Cloudflare 控制台配置：
     · KV namespace 绑定   → 变量名 MYDREAM_KV
     · 环境变量 / 密钥      → PUBLISH_PASSWORD（仅存服务端，作 HMAC 密钥）
   ========================================================= */
import { verifyChallenge } from '../_shared/auth.js';

const CATEGORIES = ['dream', 'murmur', 'awake'];

const SAFE_SLUG = /^[a-z0-9-]+$/;

/* ASCII 安全 slug（中文等非 ASCII 一律丢弃，由时间戳保证唯一） */
function slugify(s) {
  const t = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (t || 'untitled').slice(0, 48);
}

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
  const category = data.category;
  const nonce = String(data.nonce || '');
  const digest = String(data.digest || '');
  const md = String(data.md || '');
  const updateSlug = data.slug ? String(data.slug).trim() : '';

  if (!title) return Response.json({ error: '标题不能为空' }, { status: 400 });
  if (!content) return Response.json({ error: '内容为空' }, { status: 400 });
  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: '分类无效' }, { status: 400 });
  }

  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: '服务器未配置存储（MYDREAM_KV）' }, { status: 500 });
  }

  // 一次性 nonce + HMAC 校验（含 env.PUBLISH_PASSWORD 缺失检查）
  const auth = await verifyChallenge(env, kv, nonce, digest);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // 带 slug：原地更新已发布文章（保留 slug 与 createdAt，更新其余字段）
  if (updateSlug) {
    if (!SAFE_SLUG.test(updateSlug)) {
      return Response.json({ error: '文章不存在' }, { status: 404 });
    }
    const key = 'post:' + updateSlug;
    const raw = await kv.get(key);
    let prev = null;
    if (raw) {
      try { prev = JSON.parse(raw); } catch (e) { /* ignore */ }
    }
    if (!prev || typeof prev !== 'object') {
      return Response.json({ error: '文章不存在' }, { status: 404 });
    }
    const record = {
      slug: updateSlug,
      title,
      category,
      content,
      md,
      note: extractNote(content),
      createdAt: Number(prev.createdAt) || Date.now(),
      updatedAt: Date.now(),
    };
    await kv.put(key, JSON.stringify(record));
    return Response.json({ ok: true, slug: updateSlug, updated: true });
  }

  // 不带 slug：新建，slug 唯一化（标题 + 时间戳，同毫秒重复发布时追加序号）
  const stamp = Date.now().toString(36);
  let slug, key, n = 1;
  do {
    slug = slugify(title) + '-' + stamp + (n > 1 ? '-' + n : '');
    key = 'post:' + slug;
    n += 1;
  } while (await kv.get(key));

  const record = {
    slug,
    title,
    category,
    content,
    md,
    note: extractNote(content),
    createdAt: Date.now(),
  };
  await kv.put(key, JSON.stringify(record));

  return Response.json({ ok: true, slug });
}

