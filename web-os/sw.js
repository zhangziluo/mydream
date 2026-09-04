/* =========================================================
   sw.js —— Mydream OS Service Worker
   策略：外壳资源预缓存（cache-first）；运行时同源静态资源
   stale-while-revalidate；跨域请求（wttr.in / iframe 应用）
   一律不拦截，直接走网络。
   更新方式：改下面 VERSION 后重新注册即可（install→activate
   会自动清理旧缓存）。
   ========================================================= */

'use strict';

const VERSION = 'webos-v2';
const CACHE = 'mydream-os-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/store.js',
  './js/apps.js',
  './js/window-manager.js',
  './js/taskbar.js',
  './js/desktop.js',
  './js/widgets.js',
  './js/main.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* 把成功响应写入运行时缓存 */
function putCache(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copy));
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scope = new URL('./', self.location.href).href;      // 以 / 结尾
  const shellHtml = scope + 'index.html';                     // OS 外壳入口

  if (req.mode === 'navigate') {
    if (url.href === shellHtml || url.href === scope) {
      // OS 外壳：缓存优先，保证离线可开桌面
      event.respondWith(
        caches.match(shellHtml).then((hit) => hit || fetch(req).then((res) => putCache(req, res)))
      );
    } else {
      // 同源其它页面（如 ../index.html、../html-writer/）：绝不回退到外壳，
      // 网络优先并顺手运行时缓存，失败再尝试缓存
      event.respondWith(
        fetch(req).then((res) => (res && res.ok ? putCache(req, res) : res))
          .catch(() => caches.match(req))
      );
    }
    return;
  }

  // 静态资源：stale-while-revalidate
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => (res && res.ok ? putCache(req, res) : res))
        .catch(() => hit);
      return hit || network;
    })
  );
});
