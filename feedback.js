/* feedback.js — 居中的 Emil 式变形 feedback 弹层。零依赖，自动挂载。
 *
 * 一个居中的 .fb，三状态 trigger/form/success（data-state）。切状态时 CSS 过渡宽高/
 * 圆角/底色，内层 .fb__layer 交叉淡入 + blur 掩盖叠影（Emil 的变形逻辑）。表单只保留
 * rate experience + share thoughts。提交成功后呈现 Apple 式对勾完成态并自动消失。
 * 关键操作用内联 Vibration API 触发触觉反馈。
 */
(function () {
  'use strict';

  var fb = null;
  var currentRating = null;
  var autoTimer = null;

  var TRIGGER_HTML =
    '<div class="fb__layer" data-for="trigger">' +
      '<button type="button" class="fb__trigger" data-open>💬 Feedback</button>' +
    '</div>';

  var FORM_HTML =
    '<div class="fb__layer" data-for="form">' +
      '<form class="fb__form" novalidate>' +
        '<div class="fb__rate-group" data-field="rating">' +
          '<span class="fb__rate-label">Rate your experience</span>' +
          '<div class="fb__rates">' +
            '<button type="button" class="fb__rate" data-value="bad"><span class="fb__rate-emoji"><span class="fb__emo fb__emo--base">🤢</span><span class="fb__emo fb__emo--hover">🤮</span></span> Bad</button>' +
            '<button type="button" class="fb__rate" data-value="decent"><span class="fb__rate-emoji"><span class="fb__emo fb__emo--base">🙂</span><span class="fb__emo fb__emo--hover">😊</span></span> Decent</button>' +
            '<button type="button" class="fb__rate" data-value="love"><span class="fb__rate-emoji"><span class="fb__emo fb__emo--base">😄</span><span class="fb__emo fb__emo--hover">😍</span></span> Love it!</button>' +
          '</div>' +
        '</div>' +
        '<label class="fb__thoughts" data-field="thoughts">' +
          '<span>Share your thoughts</span>' +
          '<textarea id="fb-thoughts" placeholder="What did you think?"></textarea>' +
        '</label>' +
        '<div class="fb__divider"></div>' +
        '<div class="fb__foot"><button type="submit" class="fb__send">Send feedback</button></div>' +
      '</form>' +
    '</div>';

  var SUCCESS_HTML =
    '<div class="fb__layer" data-for="success">' +
      '<div class="fb__success">' +
        '<div class="fb__party">' +
          '<span class="fb__party-emoji">🥳</span>' +
        '</div>' +
        '<h2>Feedback received!</h2>' +
        '<p>Thanks for helping us improve.</p>' +
      '</div>' +
    '</div>';

  // ---- haptics（web-haptics 语义，内联 Vibration API） ----
  function vibratePattern(type) {
    switch (type) {
      case 'medium':    return [20];
      case 'selection': return [10];
      case 'success':   return [15, 40, 30];
      case 'error':     return [30, 30, 30];
      case 'light':     return [8];
      default:          return [15];
    }
  }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function haptic(type) {
    if (reducedMotion()) return;
    if (!('vibrate' in navigator)) return;
    try { navigator.vibrate(vibratePattern(type)); } catch (e) {}
  }

  // ---- 撒花：满屏从顶部飘落的彩纸雨（body 级粒子，不被卡片裁切） ----
  function blowConfetti() {
    if (reducedMotion()) return;
    var W = window.innerWidth, H = window.innerHeight;
    var colors = ['#f59e0b', '#ec4899', '#22c55e', '#3b82f6', '#a855f7', '#f43f5e', '#10b981', '#eab308', '#06b6d4'];
    var N = 90;
    for (var i = 0; i < N; i++) dropPiece(W, H, i, N, colors);
  }
  function dropPiece(W, H, i, N, colors) {
    var p = document.createElement('div');
    p.className = 'fb-confetti-piece';
    var size = 6 + Math.random() * 7;
    p.style.width = size + 'px';
    p.style.height = (size * (0.45 + Math.random() * 0.7)) + 'px';
    // 按列均匀分布 + 抖动，铺满整屏宽、不扎堆
    var x = ((i + 0.5) / N) * W + (Math.random() - 0.5) * (W / N) * 1.7;
    p.style.left = Math.max(0, Math.min(W - size, x)) + 'px';
    p.style.top = '-24px';
    p.style.background = colors[i % colors.length];
    if (i % 4 === 0) p.style.borderRadius = '50%';
    document.body.appendChild(p);
    var fall = H + 60;
    var sway = (18 + Math.random() * 44) * (Math.random() < 0.5 ? -1 : 1); // 左右飘摆
    var rot = (Math.random() * 900 - 450) | 0;
    var dur = 1300 + Math.random() * 1100;                                  // 更快
    var delay = Math.random() * 1100;                                       // 错峰飘落
    var anim = p.animate([
      { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + sway + 'px, ' + (fall * 0.5) + 'px) rotate(' + (rot * 0.5) + 'deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + (-sway) + 'px, ' + fall + 'px) rotate(' + rot + 'deg)', opacity: 0 } // 后半程渐隐
    ], { duration: dur, delay: delay, easing: 'cubic-bezier(.3,.2,.5,1)', fill: 'forwards' });
    anim.onfinish = function () { if (p.parentNode) p.parentNode.removeChild(p); };
  }

  // ---- 校验（纯函数）：thoughts 必填，rating 可选 ----
  function validate(data) {
    var errors = [];
    if (!data.thoughts || !data.thoughts.trim()) errors.push('thoughts');
    return { valid: errors.length === 0, errors: errors };
  }

  // ---- 状态机 ----
  function setState(next) {
    if (!fb || fb.dataset.state === next) return;
    fb.dataset.state = next;
    fb.dataset.animating = 'true';
    var done = function () { fb.removeAttribute('data-animating'); fb.removeEventListener('transitionend', done); };
    fb.addEventListener('transitionend', done);
    setTimeout(done, 700);
    if (fb._scrim) fb._scrim.dataset.show = (next === 'trigger') ? 'false' : 'true';
  }
  function open()  { setState('form'); haptic('medium'); }
  function close() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } setState('trigger'); haptic('light'); resetForm(); }

  function resetForm() {
    currentRating = null;
    var t = fb.querySelector('#fb-thoughts'); if (t) t.value = '';
    fb.querySelectorAll('.fb__rate').forEach(function (x) { x.removeAttribute('data-selected'); });
    clearErrors();
  }
  function clearErrors() {
    fb.querySelectorAll('[data-invalid]').forEach(function (el) { el.removeAttribute('data-invalid'); el.removeAttribute('data-shake'); });
  }
  function markError(field) {
    var el = fb.querySelector('[data-field="' + field + '"]');
    if (!el) return;
    el.dataset.invalid = 'true';
    el.dataset.shake = 'true';
    el.addEventListener('animationend', function h() { el.removeAttribute('data-shake'); el.removeEventListener('animationend', h); });
  }
  function onSubmit(e) {
    if (e) e.preventDefault();
    var data = { rating: currentRating, thoughts: fb.querySelector('#fb-thoughts').value };
    clearErrors();
    var res = validate(data);
    if (!res.valid) { res.errors.forEach(markError); haptic('error'); return; }
    setState('success'); haptic('success');
    setTimeout(blowConfetti, 220); // 等成功层显示、表情就位后再吹彩纸
    // 自动消失：成功态停留片刻后变形缩回按钮（Emil：变形作为偶发的惊喜）
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (fb.dataset.state === 'success') { setState('trigger'); resetForm(); }
    }, 2000);
  }

  // ---- 挂载 ----
  function build() {
    var scrim = document.createElement('div');
    scrim.className = 'fb-scrim';
    scrim.addEventListener('click', close);
    document.body.appendChild(scrim);

    fb = document.createElement('div');
    fb.className = 'fb';
    fb.dataset.state = 'trigger';
    fb.innerHTML = TRIGGER_HTML + FORM_HTML + SUCCESS_HTML;
    fb._scrim = scrim;
    document.body.appendChild(fb);
    wire();
  }
  function wire() {
    fb.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', open); });
    fb.querySelectorAll('.fb__rate').forEach(function (b) {
      b.addEventListener('click', function () {
        fb.querySelectorAll('.fb__rate').forEach(function (x) { x.removeAttribute('data-selected'); });
        b.dataset.selected = 'true';
        currentRating = b.dataset.value;
        haptic('selection');
      });
    });
    var form = fb.querySelector('.fb__form');
    if (form) form.addEventListener('submit', onSubmit);
  }

  // 测试钩子
  window.__fbTest = { validate: validate, vibratePattern: vibratePattern };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
