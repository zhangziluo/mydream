/* =========================================================
   window-manager.js —— 应用窗口管理
   打开（单实例）/ 拖拽 / 最小化 / 最大化 / 关闭 / 层级焦点。
   状态广播：OS.bus.emit('windows', list) 供任务栏渲染。
   窗口位置尺寸持久化在 os.winState。
   ========================================================= */
(function () {
  'use strict';

  var desktop = null;
  var layer = null;
  var zTop = 1000;
  var windows = []; // { key, app, el, x, y, w, h, min, max, restore }

  function area() {
    var r = desktop.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function clampX(x, w) { return clamp(x, 4, Math.max(4, area().w - w - 4)); }
  function clampY(y, h) {
    var H = area().h;
    return clamp(y, 4, Math.max(4, H - Math.min(h, Math.max(40, H - 40))));
  }

  function save(entry) {
    if (entry.max) return;
    var all = OS.store.get('winState', {});
    all[entry.key] = { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
    OS.store.set('winState', all);
  }

  function emit() {
    OS.bus.emit('windows', windows.map(function (e) {
      return {
        key: e.key, appId: e.app.id, name: e.app.name, glyph: e.app.glyph,
        min: e.min, active: e.el.classList.contains('active')
      };
    }));
  }

  function focusEntry(entry) {
    windows.forEach(function (w) { w.el.classList.remove('active'); });
    entry.el.classList.add('active');
    entry.z = ++zTop;
    entry.el.style.zIndex = entry.z;
    emit();
  }

  /* 找到层级最高的普通窗口（关闭当前焦点窗口后把焦点还给下一个） */
  function topmost() {
    var top = null;
    windows.forEach(function (w) { if (!top || w.z > top.z) top = w; });
    return top;
  }

  function open(app) {
    if (!app) return;
    var i;
    for (i = 0; i < windows.length; i++) {
      if (windows[i].key === app.id) {
        var ex = windows[i];
        if (ex.min) setMin(ex, false);
        focusEntry(ex);
        return;
      }
    }

    var r = area();
    var saved = OS.store.get('winState', {})[app.id] || null;
    var w = saved ? saved.w : clamp(app.w || 780, 320, r.w - 16);
    var h = saved ? saved.h : clamp(app.h || 560, 200, r.h - 24);
    var x, y;
    if (saved) {
      x = clamp(saved.x, 4, Math.max(4, r.w - w - 4));
      y = clamp(saved.y, 4, Math.max(4, r.h - h - 4));
    } else {
      x = clamp((r.w - w) / 2 + (windows.length % 5) * 24, 4, r.w - w - 4);
      y = clamp((r.h - h) / 2.6 + (windows.length % 5) * 20, 4, r.h - h - 4);
    }

    var entry = {
      key: app.id, app: app,
      x: x, y: y, w: w, h: h,
      min: false, max: false, restore: null
    };

    /* ---- DOM ---- */
    var el = document.createElement('section');
    el.className = 'win';
    el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;z-index:' + (++zTop);

    var bar = document.createElement('header');
    bar.className = 'win-bar';

    var title = document.createElement('div');
    title.className = 'win-title';
    var g = document.createElement('span'); g.className = 'glyph'; g.textContent = app.glyph;
    var t = document.createElement('span'); t.className = 't'; t.textContent = app.name;
    title.appendChild(g); title.appendChild(t);

    var ctrl = document.createElement('div');
    ctrl.className = 'win-ctrl';

    function mkBtn(cls, text, fn, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wbtn ' + cls;
      b.textContent = text;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
      return b;
    }

    if (app.url) {
      var ext = mkBtn('wbtn-ext', '↗ 外部打开', function () { window.open(app.url, '_blank', 'noopener'); }, '在新标签页打开');
      ctrl.appendChild(ext);
    }
    var mb = mkBtn('', '−', function () { setMin(entry, true); }, '最小化');
    var xb = mkBtn('', '▢', function () { toggleMax(entry); }, '最大化');
    var cb = mkBtn('close', '✕', function () { close(entry); }, '关闭');
    ctrl.appendChild(mb); ctrl.appendChild(xb); ctrl.appendChild(cb);

    bar.appendChild(title);
    bar.appendChild(ctrl);

    var body = document.createElement('div');
    body.className = 'win-body';

    var spin = document.createElement('div');
    spin.className = 'win-spin';
    spin.textContent = '载入中…';

    if (app.inline) {
      body.classList.add('inline-body');
      if (app.doc) body.innerHTML = app.doc;
    } else if (app.url) {
      var fr = document.createElement('iframe');
      fr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      fr.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write; geolocation');
      fr.src = app.url;
      fr.addEventListener('load', function () { spin.classList.add('hide'); });
      body.appendChild(spin);
      body.appendChild(fr);
      // 兜底：加载过慢或被站点拒绝嵌入时也把“载入中”撤下
      setTimeout(function () { spin.classList.add('hide'); }, 9000);
    }

    el.appendChild(bar);
    el.appendChild(body);

    /* 点击窗口任意处置顶 */
    el.addEventListener('pointerdown', function () { focusEntry(entry); });

    entry.el = el;
    entry.bar = bar;
    windows.push(entry);
    layer.appendChild(el);
    attachBar(entry);
    focusEntry(entry);
    emit();
  }
  /* ---- 拖拽（Pointer Events，鼠标+触屏） ---- */
  function attachBar(entry) {
    var bar = entry.bar;
    var moving = false;
    var offX = 0, offY = 0;

    bar.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      ev.preventDefault();
      if (entry.max) toggleMax(entry);          // 最大化时直接拖动 → 先还原
      var r = desktop.getBoundingClientRect();
      offX = ev.clientX - r.left - entry.x;
      offY = ev.clientY - r.top - entry.y;
      moving = true;
      bar.classList.add('dragging');
      try { bar.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    });

    bar.addEventListener('pointermove', function (ev) {
      if (!moving) return;
      var r = desktop.getBoundingClientRect();
      var nx = clampX(ev.clientX - r.left - offX, entry.w);
      var ny = clampY(ev.clientY - r.top - offY, entry.h);
      entry.x = nx; entry.y = ny;
      entry.el.style.left = nx + 'px';
      entry.el.style.top = ny + 'px';
    });

    function stopDrag(ev) {
      if (!moving) return;
      moving = false;
      bar.classList.remove('dragging');
      try { bar.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      save(entry);
    }
    bar.addEventListener('pointerup', stopDrag);
    bar.addEventListener('pointercancel', stopDrag);

    bar.addEventListener('dblclick', function (ev) {
      ev.stopPropagation();
      toggleMax(entry);
    });
  }

  function applyRect(entry) {
    entry.el.style.left = entry.x + 'px';
    entry.el.style.top = entry.y + 'px';
    entry.el.style.width = entry.w + 'px';
    entry.el.style.height = entry.h + 'px';
  }

  function setMin(entry, flag) {
    entry.min = flag;
    entry.el.classList.toggle('min', flag);
    emit();
  }

  function toggleMax(entry) {
    var r = area();
    if (entry.max) {
      entry.max = false;
      entry.el.classList.remove('max');
      var res = entry.restore || { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
      entry.restore = null;
      entry.x = clamp(res.x, 4, Math.max(4, r.w - res.w - 4));
      entry.y = clamp(res.y, 4, Math.max(4, r.h - res.h - 4));
      entry.w = res.w; entry.h = res.h;
      applyRect(entry);
      save(entry);
    } else {
      entry.restore = { x: entry.x, y: entry.y, w: entry.w, h: entry.h };
      entry.max = true;
      entry.el.classList.add('max');
      entry.x = 0; entry.y = 0;
      entry.w = r.w; entry.h = r.h;
      applyRect(entry);
    }
    emit();
  }

  function close(entry) {
    if (!entry) return;
    var idx = windows.indexOf(entry);
    if (idx < 0) return;
    windows.splice(idx, 1);
    entry.el.remove();
    var t = topmost();
    if (t) focusEntry(t);
    emit();
  }

  function findByKey(key) {
    for (var i = 0; i < windows.length; i++) {
      if (windows[i].key === key) return windows[i];
    }
    return null;
  }

  function taskClick(key) {
    var e = findByKey(key);
    if (!e) return;
    if (e.min) { setMin(e, false); focusEntry(e); }
    else if (e.el.classList.contains('active')) { setMin(e, true); }
    else { focusEntry(e); }
  }

  OS.wm = {
    init: function () {
      desktop = document.getElementById('desktop');
      layer = document.getElementById('windowsLayer');
    },
    open: function (appId) {
      var a = OS.apps.byId(appId);
      if (a) open(a);
    },
    openApp: open,
    taskClick: taskClick,
    minimize: function (appId) { var e = findByKey(appId); if (e) setMin(e, true); },
    close: function (appId) { var e = findByKey(appId); if (e) close(e); },
    closeAll: function () {
      windows.slice().forEach(function (w) { close(w); });
    },
    list: function () { return windows.slice(); }
  };
})();

