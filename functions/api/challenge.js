/* =========================================================
   /api/challenge —— 发布前领取一次性挑战（Cloudflare Pages Function，GET）

   返回随机 nonce（32 位十六进制），并在 KV 里登记，
   120 秒后过期（KV TTL + exp 双重保险），使用后立即作废。
   html-writer 用发布密码对该 nonce 做 HMAC-SHA256 后，
   连同 nonce 一起 POST /api/publish —— 密码本身不离开浏览器。
   ========================================================= */
const NONCE_TTL_S = 120;   // 与 /api/publish 的 NONCE_TTL_MS 保持一致

export async function onRequestGet({ env }) {
  const kv = env.MYDREAM_KV;
  if (!kv) {
    return Response.json({ error: 'server not configured' }, { status: 500 });
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await kv.put(
    'challenge:' + nonce,
    JSON.stringify({ exp: Date.now() + NONCE_TTL_S * 1000 }),
    { expirationTtl: NONCE_TTL_S }
  );

  return Response.json({ nonce, expiresIn: NONCE_TTL_S });
}
