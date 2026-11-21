/*
  Tilted cards (inspired by React Bits "Tilted Card"): the Process and Toolkit cards tilt toward the pointer,
  lift slightly and catch a soft glare. Project cards are left alone (they have their own card stack).
  Custom code because the tilt follows the pointer position (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code.

  Applies to: .services_card, .skills_card
  - rotateX/rotateY = pointer offset from the card centre x amplitude (12deg at the edges, like the original)
  - spring: omega 7.6 rad/s, damping 0.82 (React Bits defaults at smoothness 0.6)
  - scale 1.03 on hover, 2% press-in on mouse down
  - glare: --tilt-glare-x/-y/-o drive the ::after highlight in style.css
  Only for fine pointers; reduced motion keeps 30% of the tilt.
*/
(function () {
  "use strict";

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cfg = {
    selector: ".services_card, .skills_card",
    amplitude: reduced ? 3.6 : 12, // deg at the card edge
    scale: 1.03,
    perspective: 800,
    omega: 7.6,
    zeta: 0.82
  };

  var cards = Array.prototype.slice.call(document.querySelectorAll(cfg.selector));
  if (!cards.length) return;

  var active = new Set(), raf = 0, last = 0;

  function spring(s, key, target, dt) {
    var v = s[key + "V"] || 0, x = s[key];
    var a = cfg.omega * cfg.omega * (target - x) - 2 * cfg.zeta * cfg.omega * v;
    v += a * dt; x += v * dt;
    s[key] = x; s[key + "V"] = v;
    return Math.abs(target - x) > 0.001 || Math.abs(v) > 0.01;
  }

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;
    active.forEach(function (s) {
      var moving = false, steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
      for (var i = 0; i < steps; i++) {
        moving = spring(s, "rx", s.trx, h) | spring(s, "ry", s.try_, h) | spring(s, "lift", s.tlift, h) | spring(s, "press", s.tpress, h);
      }
      var scale = 1 + (cfg.scale - 1) * s.lift - 0.02 * s.press;
      var el = s.el;
      el.style.transform = "perspective(" + cfg.perspective + "px) rotateX(" + s.rx.toFixed(3) + "deg) rotateY(" + s.ry.toFixed(3) + "deg) scale(" + scale.toFixed(4) + ")";
      // glare sits on the side tilted toward the viewer
      el.style.setProperty("--tilt-glare-x", (50 + (s.ry / cfg.amplitude) * 40).toFixed(1) + "%");
      el.style.setProperty("--tilt-glare-y", (50 - (s.rx / cfg.amplitude) * 40).toFixed(1) + "%");
      el.style.setProperty("--tilt-glare-o", Math.max(0, s.lift).toFixed(3));
      el.style.setProperty("--tilt-lift", Math.max(0, s.lift).toFixed(3));
      if (!moving && !s.hover) {
        // settled back flat: hand the element back to the stylesheet
        el.style.transform = "";
        el.classList.remove("is-tilting");
        active.delete(s);
      }
    });
    raf = active.size ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function wake(s) { active.add(s); if (!raf) raf = requestAnimationFrame(frame); }

  cards.forEach(function (el) {
    var s = { el: el, rx: 0, ry: 0, lift: 0, press: 0, trx: 0, try_: 0, tlift: 0, tpress: 0, hover: false };
    function aim(e) {
      var r = el.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      var ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      s.trx = -ny * cfg.amplitude;
      s.try_ = nx * cfg.amplitude;
    }
    el.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      // wait until the scroll reveal has finished, so the tilt doesn't fight its transform
      if (parseFloat(getComputedStyle(el).opacity) < 0.99) return;
      s.hover = true; s.tlift = 1;
      el.classList.add("is-tilting");
      aim(e); wake(s);
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      if (!s.hover && parseFloat(getComputedStyle(el).opacity) >= 0.99) { s.hover = true; s.tlift = 1; el.classList.add("is-tilting"); }
      if (s.hover) { aim(e); wake(s); }
    });
    el.addEventListener("pointerleave", function () {
      s.hover = false; s.trx = 0; s.try_ = 0; s.tlift = 0; s.tpress = 0;
      wake(s);
    });
    el.addEventListener("pointerdown", function () { s.tpress = 1; wake(s); });
    el.addEventListener("pointerup", function () { s.tpress = 0; wake(s); });
  });
})();
