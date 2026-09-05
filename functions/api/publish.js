/* =========================================================
   /api/publish —— 接收发布（Cloudflare Pages Function，POST）

   安全模型：前端先 GET /api/challenge 领取一次性 nonce，再用
   发布密码对 nonce 计算 HMAC-SHA256 得到 digest。本端点只收到
     { title, content, category, nonce, digest }
   —— 发布密码本身**永不明文离开浏览器**，digest 一次性有效、不可重放。

   校验通过后把文章存入 KV，键：post:<slug>。

   上线前需在 Cloudflare 控制台配置：
     · KV namespace 绑定   → 变量名 MYDREAM_KV
     · 环境变量 / 密钥      → PUBLISH_PASSWORD（仅存服务端，作 HMAC 密钥）
   ========================================================= */
const CATEGORIES = ['dream', 'murmur', 'awake'];
const NONCE_TTL_MS = 2 * 60 * 1000;   // 与 /api/challenge 保持一致

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

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/* 常量时间校验：digest(hex) 是否为 HMAC-SHA256(secret, nonce) */
async function verifyDigest(secret, nonce, digestHex) {
  try {
    if (!/^[0-9a-f]{64}$/i.test(digestHex)) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    );
    return await crypto.subtle.verify(
      'HMAC', key, hexToBytes(digestHex).buffer, enc.encode(nonce)
    );
  } catch (e) {
    return false;
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

  if (!title) return Response.json({ error: '标题不能为空' }, { status: 400 });
  if (!content) return Response.json({ error: '内容为空' }, { status: 400 });
  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: '分类无效' }, { status: 400 });
  }
  if (!env.PUBLISH_PASSWORD) {
    return Response.json({ error: '服务器未配置发布密钥' }, { status: 500 });
  }

  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: '服务器未配置存储（MYDREAM_KV）' }, { status: 500 });
  }

  /* ---- 一次性 nonce：不存在 / 过期 / 已被使用 → 拒绝并立即删除 ---- */
  if (!/^[0-9a-f]{32}$/i.test(nonce)) {
    return Response.json({ error: '发布凭证无效或已过期，请重试' }, { status: 400 });
  }
  const nonceKey = 'challenge:' + nonce;
  const rawNonce = await kv.get(nonceKey);
  if (rawNonce) await kv.delete(nonceKey);   // 无论成败均作废，防重放
  let nonceOk = false;
  if (rawNonce) {
    try {
      const c = JSON.parse(rawNonce);
      nonceOk = c && typeof c.exp === 'number' && Date.now() < c.exp;
    } catch (e) { /* ignore */ }
  }
  if (!nonceOk) {
    return Response.json({ error: '发布凭证无效或已过期，请重试' }, { status: 400 });
  }

  /* ---- HMAC 校验（密码从未在线上传输，比对的是签名） ---- */
  if (!(await verifyDigest(env.PUBLISH_PASSWORD, nonce, digest))) {
    return Response.json({ error: '密码错误' }, { status: 401 });
  }

  // slug 唯一化：标题 + 时间戳（同毫秒重复发布时追加序号）
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
    note: extractNote(content),
    createdAt: Date.now(),
  };
  await kv.put(key, JSON.stringify(record));

  return Response.json({ ok: true, slug });
}
