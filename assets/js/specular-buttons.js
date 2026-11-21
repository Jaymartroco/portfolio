/*
  Specular buttons: a thin streak of light on each .button's rim that slides to the point nearest the
  pointer and brightens as the pointer gets close (inspired by React Bits "Specular Button").
  Custom code because the light follows the pointer, which CSS alone can't do (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code.

  CSS draws the light (see "Specular buttons" in style.css); this script only moves it by setting
  --spec-x / --spec-y (the lit point on the rim, in px) and --spec-level (brightness) on each button.
  Without this script, or on touch devices, every button keeps the idle light on its top-left corner.
*/
(function () {
  "use strict";

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cfg = {
    proximity: 220,   // px: the light starts reacting inside this distance
    idle: 0.35,       // brightness when the pointer is far away
    follow: 8,        // spot easing rate (per second)
    fade: 7,          // brightness easing rate (per second)
    pressBoost: 0.8
  };

  var states = new WeakMap();
  var pointer = null, raf = 0, last = 0;

  function restSpot(w, h) {
    // 45deg point on the top-left corner arc
    var r = Math.min(h / 2, w / 2);
    return { x: r - r * Math.SQRT1_2, y: r - r * Math.SQRT1_2 };
  }

  // Nearest point on a pill outline to (px, py), all relative to the button's top-left
  function nearestOnRim(px, py, w, h) {
    var r = Math.min(h / 2, w / 2);
    var cx = Math.min(Math.max(px, r), w - r), cy = h / 2;
    var dx = px - cx, dy = py - cy, len = Math.hypot(dx, dy);
    if (len < 0.001) { dx = 0; dy = -1; len = 1; }
    return { x: cx + dx / len * r, y: cy + dy / len * r };
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;
    var moving = false;
    var vh = window.innerHeight, vw = window.innerWidth;

    document.querySelectorAll(".button").forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || !r.width) return;
      var s = states.get(b);
      var rest = restSpot(r.width, r.height);
      if (!s) { s = { x: rest.x, y: rest.y, level: cfg.idle, press: 0 }; states.set(b, s); }

      var target = rest, near = 0;
      if (pointer) {
        var ox = Math.max(r.left - pointer.x, 0, pointer.x - r.right);
        var oy = Math.max(r.top - pointer.y, 0, pointer.y - r.bottom);
        near = smooth(Math.min(Math.max(1 - Math.hypot(ox, oy) / cfg.proximity, 0), 1));
        if (near > 0) target = nearestOnRim(pointer.x - r.left, pointer.y - r.top, r.width, r.height);
      }
      var tLevel = cfg.idle + (1 - cfg.idle) * near;

      var kf = 1 - Math.exp(-dt * cfg.follow), kl = 1 - Math.exp(-dt * cfg.fade);
      s.x += (target.x - s.x) * kf;
      s.y += (target.y - s.y) * kf;
      s.level += (tLevel - s.level) * kl;
      s.press *= Math.exp(-dt * 5);

      if (Math.abs(target.x - s.x) + Math.abs(target.y - s.y) > 0.2 || Math.abs(tLevel - s.level) > 0.004 || s.press > 0.01) moving = true;

      b.style.setProperty("--spec-x", s.x.toFixed(1) + "px");
      b.style.setProperty("--spec-y", s.y.toFixed(1) + "px");
      b.style.setProperty("--spec-level", Math.min(1, s.level * (1 + s.press * cfg.pressBoost)).toFixed(3));
    });

    raf = moving ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }

  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  }, { passive: true });
  window.addEventListener("scroll", wake, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () { pointer = null; wake(); });
  document.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".button");
    if (!b) return;
    var s = states.get(b);
    if (s) { s.press = 1; wake(); }
  });
})();
