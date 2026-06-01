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
            '<button type="button" class="fb__rate" data-value="bad">🤢 Bad</button>' +
            '<button type="button" class="fb__rate" data-value="decent">🙂 Decent</button>' +
            '<button type="button" class="fb__rate" data-value="love">😍 Love it!</button>' +
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
        '<div class="fb__check"><svg viewBox="0 0 52 52">' +
          '<circle class="fb__ring" cx="26" cy="26" r="24"/>' +
          '<path class="fb__mark" pathLength="1" d="M16 27l7 7 13-15"/>' +
        '</svg></div>' +
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
    // 自动消失：成功态停留片刻后变形缩回按钮（Emil：变形作为偶发的惊喜）
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(function () {
      if (fb.dataset.state === 'success') { setState('trigger'); resetForm(); }
    }, 1800);
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
