/*
  Gooey nav (inspired by React Bits "Gooey Nav"): a lime pill marks the current section and springs between
  links with a wobble, and clicking a link sends a burst of droplets that blob together on their way to it.
  Custom code because the pill follows clicks and the scroll position, and the droplets need a script (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code, after the site script.

  The original draws the goo in WebGL; here it's an SVG "goo" filter (blur + alpha threshold) over a layer
  holding the pill and droplets, so overlapping shapes melt into each other.
  - Active link: set on click, and kept in sync with the site script's scroll spy (.w--current).
  - Pill: each edge is its own spring (omega 26, damping 0.64); the leading edge is quicker, so the pill
    stretches toward where it's going and snaps back with a wobble.
  - Droplets: 12 per click, flying along random curved paths from the old pill to the new one.
  - Hover: a faint pill follows the hovered link.
  Desktop only (the mobile dropdown keeps its normal style). Reduced motion: the pill jumps, no droplets.
*/
(function () {
  "use strict";

  var menu = document.querySelector(".nav_menu");
  if (!menu) return;
  var links = Array.prototype.slice.call(menu.querySelectorAll(".nav_link"));
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 992px)");

  var cfg = {
    omega: 26, zeta: 0.64,      // pill spring
    leadBoost: 1.35,            // leading edge spring is this much stiffer, which stretches the pill
    drops: 12,
    spread: 26,                 // px, how far droplets bow out on their way
    flight: 0.6,                // s, base flight time
    variance: 0.3,              // s
    colors: ["#d4ff3a", "#bce51f", "#e4ff7a"],
    pad: 40                     // px of room around the menu for the goo layer
  };

  /* SVG goo filter */
  var svgNS = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<filter id="nav-goo" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>' +
      '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo"/>' +
      '<feComposite in="SourceGraphic" in2="goo" operator="atop"/>' +
    "</filter>";
  document.body.appendChild(svg);

  /* Layers */
  var goo = document.createElement("span");
  goo.className = "nav_goo";
  goo.setAttribute("aria-hidden", "true");
  var pill = document.createElement("span");
  pill.className = "nav_goo-pill";
  goo.appendChild(pill);
  var hover = document.createElement("span");
  hover.className = "nav_hover";
  hover.setAttribute("aria-hidden", "true");
  menu.insertBefore(hover, menu.firstChild);
  menu.insertBefore(goo, menu.firstChild);
  menu.classList.add("is-gooey");

  /* State */
  var active = null;                                  // active link element
  var L = { x: 0, v: 0 }, R = { x: 0, v: 0 };          // pill edges
  var S = { x: 0, v: 0 };                              // pill presence 0..1
  var Y = 0, H = 0, placed = false;
  var hov = { el: null, x: 0, w: 0, y: 0, h: 0, a: 0 };
  var drops = [];
  var raf = 0, last = 0;

  function rect(el) { return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }; }

  function springStep(s, target, omega, zeta, dt) {
    var a = omega * omega * (target - s.x) - 2 * zeta * omega * s.v;
    s.v += a * dt; s.x += s.v * dt;
  }
  function settled(s, target) { return Math.abs(target - s.x) < 0.05 && Math.abs(s.v) < 0.05; }

  function bez(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randDir() { var a = Math.random() * Math.PI * 2; return { x: Math.cos(a), y: Math.sin(a) }; }

  function burst(from, to) {
    if (reduced) return;
    var src = from ? rect(from) : null, dst = rect(to);
    for (var i = 0; i < cfg.drops; i++) {
      var s = src || dst;
      var p0 = { x: s.x + s.w / 2 + rand(-0.3, 0.3) * s.w, y: s.y + s.h / 2 + rand(-0.15, 0.15) * s.h };
      var p3 = { x: dst.x + dst.w / 2 + rand(-0.225, 0.225) * dst.w, y: dst.y + dst.h / 2 + rand(-0.1, 0.1) * dst.h };
      var d1 = randDir(), d2 = randDir(), k1 = cfg.spread * rand(0.7, 1.3) * 1.6, k2 = cfg.spread * rand(0.55, 1.15) * 1.5;
      var el = document.createElement("span");
      el.className = "nav_goo-drop";
      el.style.background = cfg.colors[i % cfg.colors.length];
      goo.appendChild(el);
      drops.push({
        el: el,
        p0: p0, p1: { x: p0.x + d1.x * k1, y: p0.y + d1.y * k1 }, p2: { x: p3.x + d2.x * k2, y: p3.y + d2.y * k2 }, p3: p3,
        r: 0.26 * dst.h * rand(0.8, 1.2),
        delay: rand(0, cfg.flight * 0.16),
        dur: Math.max(0.15, cfg.flight * rand(0.62, 0.94) + (Math.random() - 0.5) * cfg.variance * 0.6),
        t: 0
      });
    }
  }

  function setActive(link, withBurst) {
    if (link === active) return;
    var prev = active;
    active = link;
    links.forEach(function (l) { l.classList.toggle("is-goo-active", l === link); });
    if (link && desktop.matches) {
      if (withBurst) burst(prev, link);
      if (!placed || reduced) { var r = rect(link); L.x = r.x; R.x = r.x + r.w; L.v = R.v = 0; placed = true; }
    }
    wake();
  }

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;
    var busy = false;

    // pill
    var tl = L.x, tr = R.x, ts = 0;
    if (active) {
      var r = rect(active);
      tl = r.x; tr = r.x + r.w; ts = 1; Y = r.y; H = r.h;
    }
    if (reduced) { L.x = tl; R.x = tr; S.x = ts; L.v = R.v = S.v = 0; }
    else {
      var dir = (tl + tr) / 2 - (L.x + R.x) / 2;
      var leadL = dir < 0, steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
      for (var i = 0; i < steps; i++) {
        springStep(L, tl, cfg.omega * (leadL ? cfg.leadBoost : 1), cfg.zeta, h);
        springStep(R, tr, cfg.omega * (leadL ? 1 : cfg.leadBoost), cfg.zeta, h);
        springStep(S, ts, cfg.omega, 0.9, h);
      }
      busy = !(settled(L, tl) && settled(R, tr) && settled(S, ts));
    }
    var w = Math.max(H, R.x - L.x), sc = Math.max(0, S.x);
    pill.style.width = w.toFixed(2) + "px";
    pill.style.height = H + "px";
    pill.style.transform = "translate(" + (L.x + cfg.pad).toFixed(2) + "px, " + (Y + cfg.pad) + "px) scale(" + sc.toFixed(3) + ")";

    // droplets
    drops = drops.filter(function (d) {
      d.t += dt;
      var e = (d.t - d.delay) / d.dur;
      if (e < 0) { d.el.style.transform = "scale(0)"; return true; }
      if (e >= 1) { d.el.remove(); return false; }
      var k = easeInOut(e);
      var x = bez(d.p0.x, d.p1.x, d.p2.x, d.p3.x, k), y = bez(d.p0.y, d.p1.y, d.p2.y, d.p3.y, k);
      var emerge = Math.min(1, (d.t - d.delay) / 0.09), absorb = Math.max(0, (d.t - d.delay - (d.dur - 0.12)) / 0.12);
      var r = d.r * Math.min(emerge, 1 - absorb);
      d.el.style.width = d.el.style.height = (r * 2).toFixed(2) + "px";
      d.el.style.transform = "translate(" + (x - r + cfg.pad).toFixed(2) + "px, " + (y - r + cfg.pad).toFixed(2) + "px)";
      return true;
    });
    if (drops.length) busy = true;

    // hover pill: exponential follow (tau 0.06s), fade (tau 0.08s)
    var goal = hov.el && hov.el !== active ? 1 : 0;
    if (hov.el) {
      var hr = rect(hov.el), kf = 1 - Math.exp(-dt / 0.06);
      if (hov.a < 0.01) { hov.x = hr.x; hov.w = hr.w; }
      hov.x += (hr.x - hov.x) * kf; hov.w += (hr.w - hov.w) * kf; hov.y = hr.y; hov.h = hr.h;
      if (Math.abs(hr.x - hov.x) > 0.1 || Math.abs(hr.w - hov.w) > 0.1) busy = true;
    }
    hov.a += (goal - hov.a) * (1 - Math.exp(-dt / 0.08));
    if (Math.abs(goal - hov.a) > 0.01) busy = true;
    hover.style.width = hov.w.toFixed(2) + "px";
    hover.style.height = hov.h + "px";
    hover.style.transform = "translate(" + hov.x.toFixed(2) + "px, " + hov.y + "px)";
    hover.style.opacity = hov.a.toFixed(3);

    raf = busy ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  /* Clicks: same-page links become active with a burst (the résumé link opens a file, so it never holds the pill) */
  links.forEach(function (l) {
    var inPage = (l.getAttribute("href") || "").charAt(0) === "#";
    if (inPage) l.addEventListener("click", function () { lockUntil = performance.now() + 1600; setActive(l, true); });
    l.addEventListener("mouseenter", function () { hov.el = l; wake(); });
    l.addEventListener("mouseleave", function () { if (hov.el === l) { hov.el = null; wake(); } });
  });

  /* Follow the scroll spy in main.js (it toggles .w--current) */
  // After a click the page smooth-scrolls past other sections; ignore the spy until it reaches the clicked one.
  var lastSpy, lockUntil = 0;
  function syncFromSpy() {
    var cur = null;
    links.forEach(function (l) { if (l.classList.contains("w--current")) cur = l; });
    if (cur === lastSpy) return;          // only react to changes in .w--current, not our own class edits
    lastSpy = cur;
    if (performance.now() < lockUntil && cur !== active) return;
    lockUntil = 0;
    if (cur !== active) setActive(cur, false);
  }
  var mo = new MutationObserver(syncFromSpy);
  links.forEach(function (l) { mo.observe(l, { attributes: true, attributeFilter: ["class"] }); });

  window.addEventListener("resize", wake);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(wake);
  syncFromSpy();
  wake();
})();
