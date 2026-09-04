/* =========================================================
   store.js —— 本地存储封装 + 极简事件总线 + toast
   统一前缀 os.*；所有读写都 try/catch（隐私模式静默降级）。
   ========================================================= */
(function () {
  'use strict';

  var PREFIX = 'os.';

  function get(key, fallback) {
    try {
      var v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function set(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }
  function del(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  }

  /* 极简事件总线：OS.bus.on(ev, fn) → 返回取消函数；OS.bus.emit(ev, data) */
  var bus = (function () {
    var handlers = {};
    return {
      on: function (ev, fn) {
        (handlers[ev] = handlers[ev] || []).push(fn);
        return function () {
          handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; });
        };
      },
      emit: function (ev, data) {
        (handlers[ev] || []).slice().forEach(function (fn) {
          try { fn(data); } catch (e) { /* 单点异常不影响其它监听 */ }
        });
      }
    };
  })();

  /* 轻提示 */
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  window.OS = window.OS || {};
  OS.store = { get: get, set: set, del: del };
  OS.bus = bus;
  OS.toast = toast;
})();
