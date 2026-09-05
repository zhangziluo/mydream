/* =========================================================
   /api/posts —— 文章列表（Cloudflare Pages Function，GET）

   从 KV 读取全部已发布文章（键前缀 post:），按 createdAt 降序、
   按 dream / murmur / awake 分类返回，供首页动态渲染卡片。

   返回：
     { dream: [{slug,title,note,createdAt}], murmur: [...], awake: [...] }
   ========================================================= */
const CATEGORIES = ['dream', 'murmur', 'awake'];

export async function onRequestGet({ env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: 'server not configured' }, { status: 500 });
  }

  const list = await kv.list({ prefix: 'post:' });
  const records = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await kv.get(k.name);
      if (!raw) return null;
      try {
        const r = JSON.parse(raw);
        return {
          slug: r.slug || k.name.slice(5),
          title: String(r.title || ''),
          note: String(r.note || ''),
          category: CATEGORIES.includes(r.category) ? r.category : 'dream',
          createdAt: Number(r.createdAt) || 0,
        };
      } catch (e) {
        return null;
      }
    })
  );

  const out = { dream: [], murmur: [], awake: [] };
  records
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((p) => out[p.category].push(p));

  return Response.json(out);
}
