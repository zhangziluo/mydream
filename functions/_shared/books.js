/* =========================================================
   _shared/books.js —— 长文（分章作品）共用逻辑

   数据模型（KV）
   -------------
     book:<bookSlug>  { slug, title, category, createdAt, updatedAt,
                        chapters: [{ slug, title, createdAt }] }
     post:<slug>      { slug, title, category, content, md, note,
                        createdAt, updatedAt?, book? }
     · 长文 = 一本书；章节 = 带 book 字段的 post。
     · book.chapters 的数组顺序就是章节顺序（新章追加到末尾）。
     · 不属于长文的单篇文章没有 book 字段（旧数据天然兼容）。

   publish / post / book / books 四个端点共用本文件，避免逻辑重复。
   ========================================================= */

export const CATEGORIES = ['dream', 'murmur', 'awake'];

/* slug 只允许小写字母 / 数字 / 连字符（防路径穿越与奇怪字符） */
export const SAFE_SLUG = /^[a-z0-9-]+$/;

export const POST_PREFIX = 'post:';
export const BOOK_PREFIX = 'book:';

/* ASCII 安全 slug（中文等非 ASCII 一律丢弃，由时间戳保证唯一） */
export function slugify(s) {
  const t = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (t || 'untitled').slice(0, 48);
}

/* 生成 KV 中尚不存在的唯一 slug（标题 + 36 进制时间戳，同毫秒重复时追加序号） */
export async function uniqueSlug(kv, prefix, base) {
  const stamp = Date.now().toString(36);
  let slug, n = 1;
  do {
    slug = base + '-' + stamp + (n > 1 ? '-' + n : '');
    n += 1;
  } while (await kv.get(prefix + slug));
  return slug;
}

/* 读取长文记录；slug 非法 / 不存在 / 记录损坏均返回 null */
export async function readBook(kv, slug) {
  if (!SAFE_SLUG.test(String(slug || ''))) return null;
  const raw = await kv.get(BOOK_PREFIX + slug);
  if (!raw) return null;
  try {
    const b = JSON.parse(raw);
    return (b && typeof b === 'object' && Array.isArray(b.chapters)) ? b : null;
  } catch (e) {
    return null;
  }
}

/* 章节标题拼接：长文卡片在分类页参与「全文检索」用 */
export function bookText(book) {
  return (book.chapters || []).map((c) => String(c.title || '')).join(' ');
}

/* 长文卡片说明：共 N 章 · 最新《…》 */
export function bookNote(book) {
  const list = book.chapters || [];
  if (!list.length) return '还没有章节';
  const last = list[list.length - 1];
  return '共 ' + list.length + ' 章 · 最新《' + String(last.title || '') + '》';
}

/* 新增 / 更新章节：按 slug 就地更新（保持章序），否则追加到末尾。
   返回该章节的序号（1 起）。 */
export function upsertChapter(book, entry) {
  const list = book.chapters;
  const i = list.findIndex((c) => c.slug === entry.slug);
  if (i >= 0) {
    list[i] = Object.assign({}, list[i], entry);
    return i + 1;
  }
  list.push({
    slug: String(entry.slug),
    title: String(entry.title || ''),
    createdAt: Number(entry.createdAt) || Date.now(),
  });
  return list.length;
}

/* 移除章节，返回是否确实移除（不存在则 false） */
export function removeChapter(book, slug) {
  const list = book.chapters;
  const i = list.findIndex((c) => c.slug === slug);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/* 写回长文（顺带刷新 updatedAt；空长文由调用方决定删除） */
export async function saveBook(kv, book) {
  book.updatedAt = Date.now();
  await kv.put(BOOK_PREFIX + book.slug, JSON.stringify(book));
}
