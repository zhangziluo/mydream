/* =========================================================
   /api/post —— 阅读 / 删除单篇文章（Cloudflare Pages Function）

   GET    /api/post?slug=<slug>  返回已渲染的单文件 HTML（阅读页）
   DELETE /api/post?slug=<slug>  删除文章（body 携带
                                 { nonce, digest }，同一性鉴权见
                                 _shared/auth.js）

   首页卡片点开 = GET 阅读；html-writer「发布管理」删除 = DELETE。
   ========================================================= */
import { verifyChallenge } from '../_shared/auth.js';

const SAFE_SLUG = /^[a-z0-9-]+$/;

function json(data, status) {
  return Response.json(data, { status: status || 200 });
}

export async function onRequestGet({ request, env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return new Response('Server not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!SAFE_SLUG.test(slug)) {
    return new Response('Not found', { status: 404 });
  }

  const raw = await kv.get('post:' + slug);
  if (!raw) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const r = JSON.parse(raw);
    return new Response(r.content, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    return new Response('Broken record', { status: 500 });
  }
}

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

  const key = 'post:' + slug;
  const raw = await kv.get(key);
  if (!raw) {
    return json({ error: '文章不存在' }, 404);
  }
  await kv.delete(key);
  return json({ ok: true, slug });
}

