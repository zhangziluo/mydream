/* =========================================================
   _shared/auth.js —— 发布/删除共用的鉴权（一次性 nonce + HMAC-SHA256）

   调用方（/api/publish、/api/post DELETE）已先从 /api/challenge
   领取一次性 nonce；这里负责：
   1) nonce 存在性 / 过期校验（用后即删，防重放）
   2) digest 是否为 HMAC-SHA256(env.PUBLISH_PASSWORD, nonce)（常量时间）

   返回：{ ok:true } 或 { ok:false, status, error }
   ========================================================= */

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

/* 校验并消费一次性 nonce + HMAC 签名 */
export async function verifyChallenge(env, kv, nonce, digest) {
  if (!env.PUBLISH_PASSWORD) {
    return { ok: false, status: 500, error: '服务器未配置发布密钥' };
  }
  if (!/^[0-9a-f]{32}$/i.test(String(nonce))) {
    return { ok: false, status: 400, error: '发布凭证无效或已过期，请重试' };
  }

  const key = 'challenge:' + nonce;
  const raw = await kv.get(key);
  if (raw) await kv.delete(key);        // 无论成败均作废，防重放

  let valid = false;
  if (raw) {
    try {
      const c = JSON.parse(raw);
      valid = c && typeof c.exp === 'number' && Date.now() < c.exp;
    } catch (e) { /* ignore */ }
  }
  if (!valid) {
    return { ok: false, status: 400, error: '发布凭证无效或已过期，请重试' };
  }

  if (!(await verifyDigest(env.PUBLISH_PASSWORD, nonce, String(digest)))) {
    return { ok: false, status: 401, error: '密码错误' };
  }
  return { ok: true };
}
