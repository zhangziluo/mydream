/* =========================================================
   /api/posts —— 文章列表（Cloudflare Pages Function，GET）

   用法：
     GET /api/posts                       → 分组对象（首页用）
     GET /api/posts?category=dream|murmur|awake → 该分类扁平数组
        （分类管理页/瀑布流用，按 createdAt 降序）

   每项含 { slug, title, note, category, createdAt, text }
   —— text 为正文去标签后的纯文本（供分类页全文搜索）。
   ========================================================= */
const CATEGORIES = ['dream', 'murmur', 'awake'];

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

  const list = await kv.list({ prefix: 'post:' });
  const records = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await kv.get(k.name);
      if (!raw) return null;
      try {
        const r = JSON.parse(raw);
        const cat = CATEGORIES.includes(r.category) ? r.category : 'dream';
        return {
          slug: r.slug || k.name.slice(5),
          title: String(r.title || ''),
          note: String(r.note || ''),
          category: cat,
          createdAt: Number(r.createdAt) || 0,
          text: stripToText(r.content || ''),
        };
      } catch (e) {
        return null;
      }
    })
  );
  const posts = records
    .filter(Boolean)
    .filter((p) => !category || p.category === category)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (category) return Response.json(posts);

  const out = { dream: [], murmur: [], awake: [] };
  posts.forEach((p) => out[p.category].push(p));
  return Response.json(out);
}

