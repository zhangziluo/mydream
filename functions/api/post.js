/* =========================================================
   /api/post —— 阅读单篇文章（Cloudflare Pages Function，GET）

   用法：GET /api/post?slug=<slug>
   从 KV 取出该文，原样返回已渲染好的单文件 HTML（含内联模板 CSS），
   首页卡片点开后即可直接阅读。
   ========================================================= */
const SAFE_SLUG = /^[a-z0-9-]+$/;

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
