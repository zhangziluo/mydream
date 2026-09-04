/* =========================================================
   Mydream 主页脚本
   1) 标记 JS 可用（启用卡片进场动画）
   2) 栏目进场渐显（IntersectionObserver）
   3) 页脚年份
   作品卡片由根目录 build.js 扫描 dream/ whisper/ awake/
   三目录的 HTML 文件，构建时静态写入 index.html（勿在 JS 重复渲染）。
   ========================================================= */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ---------------- 栏目进场渐显 ---------------- */
  var cols = document.querySelectorAll('.col');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    cols.forEach(function (col) { io.observe(col); });
  } else {
    cols.forEach(function (col) { col.classList.add('in'); });
  }

  /* ---------------- 页脚年份 ---------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

