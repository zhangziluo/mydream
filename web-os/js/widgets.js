/* =========================================================
   widgets.js —— 桌面角落挂件：时钟 / 天气 / 待办
   天气数据源：wttr.in（format=j1，免费无需 Key）。
   显示状态存 os.widgets；位置存 os.widgetPos；待办存 os.todos。
   ========================================================= */
(function () {
  'use strict';

  var desktop = null;
  var layer = null;
  var widgets = {}; // id -> { el, body }

  var W = 240, GAP = 12, EDGE = 14;
  var CITY_KEY = 'weatherCity';

  /* ---------- 通用小工具 ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function makeCard(id, cls, title) {
    var card = el('div', 'widget ' + cls);
    var head = el('header', 'w-head');
    var t = el('span', 't', title);
    var x = el('button', 'w-x', '✕');
    x.type = 'button';
    x.title = '隐藏挂件';
    x.setAttribute('aria-label', '隐藏' + title);
    head.appendChild(t);
    head.appendChild(x);
    var body = el('div', 'w-body');
    card.appendChild(head);
    card.appendChild(body);
    x.addEventListener('click', function () {
      if (OS.taskbar && OS.taskbar.updateWidget) OS.taskbar.updateWidget(id, false);
      OS.widgets.setVisible(id, false);
    });
    attachDrag(card, head, id);
    widgets[id] = { el: card, body: body, head: head };
    return card;
  }

  /* 挂件拖拽：位置存 os.widgetPos */
  function attachDrag(card, handle, id) {
    var moving = false, offX = 0, offY = 0;
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      var r = desktop.getBoundingClientRect();
      offX = ev.clientX - r.left - card.offsetLeft;
      offY = ev.clientY - r.top - card.offsetTop;
      moving = true;
      handle.classList.add('dragging');
      try { handle.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    });
    handle.addEventListener('pointermove', function (ev) {
      if (!moving) return;
      var r = desktop.getBoundingClientRect();
      var nx = Math.min(Math.max(ev.clientX - r.left - offX, 4), desktop.clientWidth - card.offsetWidth - 4);
      var ny = Math.min(Math.max(ev.clientY - r.top - offY, 4), desktop.clientHeight - 30);
      card.style.left = nx + 'px';
      card.style.top = ny + 'px';
    });
    function stop(ev) {
      if (!moving) return;
      moving = false;
      handle.classList.remove('dragging');
      try { handle.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      var all = OS.store.get('widgetPos', {});
      all[id] = { x: card.offsetLeft, y: card.offsetTop };
      OS.store.set('widgetPos', all);
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  function placeAt(id, x, y) {
    widgets[id].el.style.left = x + 'px';
    widgets[id].el.style.top = y + 'px';
  }

  /* ================= 时钟 ================= */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function buildClock() {
    var card = makeCard('clock', 'w-clock', '时 钟');
    var body = widgets.clock.body;
    var time = el('div', 'time', '--:--:--');
    var date = el('div', 'date', '');
    body.appendChild(time);
    body.appendChild(date);

    function update() {
      var d = new Date();
      time.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      date.textContent = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'
        + ' · 星期' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    }
    update();
    setInterval(update, 1000);
    return card;
  }
  /* ================= 天气（wttr.in format=j1） ================= */
  var GLYPH = { sun: '☀️', part: '⛅', cloud: '☁️', rain: '🌧', snow: '❄️', storm: '⛈', fog: '🌫' };
  var CODE_RAIN  = [176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359, 362, 365, 386];
  var CODE_SNOW  = [179, 182, 185, 227, 230, 320, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377];
  var CODE_STORM = [200, 389, 395];
  function codeGlyph(c) {
    if (c === 113) return GLYPH.sun;
    if (c === 116 || c === 119) return GLYPH.part;
    if (c === 122) return GLYPH.cloud;
    if (CODE_STORM.indexOf(c) >= 0) return GLYPH.storm;
    if (CODE_RAIN.indexOf(c) >= 0) return GLYPH.rain;
    if (CODE_SNOW.indexOf(c) >= 0) return GLYPH.snow;
    if (c === 248 || c === 260) return GLYPH.fog;
    return GLYPH.part;
  }
  function pickZh(arr) {
    if (!arr || !arr.length) return '';
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].lang === 'zh') return arr[i].value;
    }
    return arr[0].value;
  }

  var weather = { inflight: false };
  function buildWeather() {
    var card = makeCard('weather', 'w-weather', '天 气');
    var body = widgets.weather.body;

    var top = el('div', 'weather-top');
    var ico = el('div', 'weather-ico', '…');
    var temp = el('div', 'weather-temp', '--°');
    var desc = el('div', 'weather-desc', '');
    top.appendChild(ico);
    var right = el('div');
    right.appendChild(temp); right.appendChild(desc);
    top.appendChild(right);
    body.appendChild(top);

    var meta = el('div', 'weather-meta');
    body.appendChild(meta);
    var days = el('div', 'weather-days');
    body.appendChild(days);
    var err = el('div', 'weather-err');
    body.appendChild(err);

    var cityInput = document.createElement('input');
    cityInput.type = 'text';
    cityInput.className = 'weather-city';
    cityInput.placeholder = '城市名（留空 = 按 IP 定位）';
    cityInput.autocomplete = 'off';
    body.appendChild(cityInput);

    var tools = el('div', 'wtools');
    var refresh = el('button', null, '⟳ 刷新');
    var gear = el('button', null, '⚙ 城市');
    tools.appendChild(refresh); tools.appendChild(gear);
    body.appendChild(tools);

    function commitCity() {
      var v = cityInput.value.trim();
      OS.store.set(CITY_KEY, v);
      cityInput.classList.remove('show');
      loadWeather();
    }
    refresh.addEventListener('click', loadWeather);
    gear.addEventListener('click', function () {
      cityInput.value = OS.store.get(CITY_KEY, '');
      cityInput.classList.add('show');
      cityInput.focus();
    });
    cityInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') commitCity();
      if (ev.key === 'Escape') cityInput.classList.remove('show');
    });

    function render(j) {
      var cur = j.current_condition && j.current_condition[0];
      if (!cur) throw new Error('无天气数据');
      var code = Number(cur.weatherCode);
      ico.textContent = codeGlyph(code);
      temp.textContent = cur.temp_C + '°';
      var area = (j.nearest_area && pickZh(j.nearest_area[0].areaName)) || '';
      desc.textContent = (area ? area + ' · ' : '') + pickZh(cur.weatherDesc);

      meta.innerHTML = '';
      var bits = [
        ['体感', cur.FeelsLikeC + '°'],
        ['湿度', (cur.humidity || '--') + '%'],
        ['风速', cur.windspeedKmph ? cur.windspeedKmph + 'km/h' : '--']
      ];
      bits.forEach(function (b) {
        var s = el('span');
        s.appendChild(document.createTextNode(b[0] + ' '));
        var strong = el('b', null, b[1]);
        s.appendChild(strong);
        meta.appendChild(s);
      });

      days.innerHTML = '';
      var list = (j.weather || []).slice(0, 3);
      var labels = ['今天', '明天', '后天'];
      list.forEach(function (d, i) {
        var day = el('div', 'wday');
        day.appendChild(el('div', 'd', labels[i] || ''));
        var h = (d.hourly && d.hourly[0]) || {};
        day.appendChild(el('div', 'g', codeGlyph(Number(h.weatherCode))));
        day.appendChild(el('div', 'deg', d.mintempC + '° / ' + d.maxtempC + '°'));
        days.appendChild(day);
      });
      err.textContent = '';
    }

    function fail(msg) {
      ico.textContent = GLYPH.part;
      err.textContent = '天气暂不可用' + (msg ? '：' + msg : '');
    }

    function loadWeather() {
      if (weather.inflight) return;
      weather.inflight = true;
      err.textContent = '更新中…';
      var city = OS.store.get(CITY_KEY, '');
      var url = 'https://wttr.in/' + (city ? encodeURIComponent(city.trim()) : '') + '?format=j1';
      var ac = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (ac) ac.abort(); }, 9000);
      fetch(url, ac ? { signal: ac.signal } : {})
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(render)
        .catch(function (e) {
          if (e && e.name === 'AbortError') fail('请求超时');
          else fail(e && e.message ? e.message : '');
        })
        .then(function () {
          clearTimeout(timer);
          weather.inflight = false;
        });
    }

    weather.refresh = loadWeather;
    loadWeather();
    setInterval(loadWeather, 10 * 60 * 1000); // 10 分钟自动刷新
    return card;
  }
  /* ================= 待办（localStorage） ================= */
  function buildTodo() {
    var card = makeCard('todo', 'w-todo', '待 办');
    var body = widgets.todo.body;
    var todoList = OS.store.get('todos', []);

    var row = el('div', 'todo-input');
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '写下一件小事…';
    input.maxLength = 120;
    input.autocomplete = 'off';
    var add = el('button', 'add', '＋');
    add.type = 'button';
    add.title = '添加';
    row.appendChild(input); row.appendChild(add);
    body.appendChild(row);

    var ul = el('ul', 'todo-list');
    body.appendChild(ul);

    function save() { OS.store.set('todos', todoList); }

    function render() {
      ul.innerHTML = '';
      if (!todoList.length) {
        ul.appendChild(el('li', 'todo-empty', '静候落笔……'));
        return;
      }
      todoList.forEach(function (item) {
        var li = el('li', 'todo-item' + (item.done ? ' done' : ''));
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!item.done;
        cb.setAttribute('aria-label', '完成');
        var txt = el('span', 'txt', item.t);
        var del = el('button', 'del', '✕');
        del.type = 'button';
        del.title = '删除';
        cb.addEventListener('change', function () {
          item.done = cb.checked;
          li.classList.toggle('done', item.done);
          save();
        });
        del.addEventListener('click', function () {
          todoList.splice(todoList.indexOf(item), 1);
          save();
          render();
        });
        li.appendChild(cb); li.appendChild(txt); li.appendChild(del);
        ul.appendChild(li);
      });
    }

    function addTodo() {
      var v = input.value.trim();
      if (!v) return;
      todoList.push({ id: Date.now() + Math.random(), t: v, done: false });
      input.value = '';
      save();
      render();
      input.focus();
    }
    add.addEventListener('click', addTodo);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') addTodo();
    });

    render();
    return card;
  }

  /* ================= 布局与可见性 ================= */
  function defaultLayout() {
    var stored = OS.store.get('widgetPos', {});
    var rightX = desktop.clientWidth - W - EDGE;
    var y = EDGE;

    ['clock', 'weather'].forEach(function (id) {
      var wdt = widgets[id];
      if (!wdt) return;
      var p = stored[id];
      if (p) { placeAt(id, p.x, p.y); }
      else {
        placeAt(id, rightX, y);
        stored[id] = { x: rightX, y: y };
      }
      y += wdt.el.offsetHeight + GAP;
    });

    var t = widgets.todo;
    if (t) {
      var p = stored.todo;
      if (p) {
        placeAt('todo', p.x, p.y);
      } else {
        var ty = Math.max(EDGE, desktop.clientHeight - t.el.offsetHeight - EDGE);
        placeAt('todo', rightX, ty);
        stored.todo = { x: rightX, y: ty };
      }
    }
    OS.store.set('widgetPos', stored);
  }

  OS.widgets = {
    init: function () {
      desktop = document.getElementById('desktop');
      layer = document.getElementById('widgetLayer');
      var cards = [buildClock(), buildWeather(), buildTodo()];
      cards.forEach(function (c) { layer.appendChild(c); });
      defaultLayout();
      var p = OS.taskbar.prefs();
      ['clock', 'weather', 'todo'].forEach(function (id) {
        OS.widgets.setVisible(id, p[id]);
      });
    },
    setVisible: function (id, v) {
      var w = widgets[id];
      if (!w) return;
      w.el.hidden = !v;
    },
    refreshWeather: function () {
      if (weather.refresh) weather.refresh();
    }
  };
})();


