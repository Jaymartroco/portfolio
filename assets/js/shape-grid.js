/*
  Hero shape grid: an animated canvas grid behind the hero (inspired by React Bits "Shape Grid").
  Custom code because Webflow has no native animated canvas background (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code, before the site script.

  Markup: <div class="hero_grid" data-shape-grid aria-hidden="true"></div>
  The CSS grid on .hero_grid stays as the no-JS fallback; it's switched off once the canvas runs.
*/
(function () {
  "use strict";

  var host = document.querySelector("[data-shape-grid]");
  if (!host) return;
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  /* Settings, matched to the portfolio palette (--colors--bone lines, --colors--lime hover) */
  var cfg = {
    cellSize: 80,                       // 5rem, same rhythm as the old static grid
    lineWidth: 1,
    lineColor: "rgba(244, 244, 240, 0.08)",
    hoverRGB: "212, 255, 58",           // lime #d4ff3a
    fillOpacity: 0.14,
    strokeOpacity: 0.7,
    glow: 14,                           // shadow blur in px on lit cells
    trail: 0.9,                         // seconds a lit cell takes to fade out
    speed: 14,                          // px per second
    dirX: 1, dirY: 1,                   // diagonal drift
    cascadeSpeed: 520,                  // px per second for the click ripple
    cascadeLife: 1.1                    // seconds
  };

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var section = host.closest(".section_hero") || host.parentElement;
  var w = 0, h = 0, dpr = 1;
  var offX = 0, offY = 0;              // accumulated drift
  var lit = {};                         // "i,j" -> intensity 0..1
  var hover = null;                     // { x, y } in canvas px
  var cascades = [];                    // { x, y, t }
  var running = false, visible = true, last = 0, raf = 0;

  host.appendChild(canvas);
  host.classList.add("is-canvas");

  function resize() {
    var r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(0);
  }

  function cellAt(x, y) {
    var s = cfg.cellSize;
    return { i: Math.floor((x - offX) / s), j: Math.floor((y - offY) / s) };
  }

  function draw(dt) {
    var s = cfg.cellSize;
    ctx.clearRect(0, 0, w, h);

    /* Fade lit cells, then light the hovered one */
    for (var k in lit) {
      lit[k] -= dt / cfg.trail;
      if (lit[k] <= 0) delete lit[k];
    }
    if (hover) {
      var c = cellAt(hover.x, hover.y);
      lit[c.i + "," + c.j] = 1;
    }

    var i0 = Math.floor(-offX / s) - 1, i1 = Math.ceil((w - offX) / s);
    var j0 = Math.floor(-offY / s) - 1, j1 = Math.ceil((h - offY) / s);

    /* Grid lines */
    ctx.beginPath();
    ctx.lineWidth = cfg.lineWidth;
    ctx.strokeStyle = cfg.lineColor;
    var sx = ((offX % s) + s) % s, sy = ((offY % s) + s) % s;
    for (var x = sx - s; x <= w + s; x += s) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (var y = sy - s; y <= h + s; y += s) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();

    /* Lit cells: hover trail plus click ripples */
    var now = performance.now() / 1000;
    cascades = cascades.filter(function (r) { return now - r.t < cfg.cascadeLife; });
    ctx.shadowColor = "rgba(" + cfg.hoverRGB + ", 0.6)";
    ctx.shadowBlur = cfg.glow;
    for (var i = i0; i <= i1; i++) {
      for (var j = j0; j <= j1; j++) {
        var v = lit[i + "," + j] || 0;
        var px = i * s + offX, py = j * s + offY;
        for (var n = 0; n < cascades.length; n++) {
          var r = cascades[n], age = now - r.t;
          var dist = Math.hypot(px + s / 2 - r.x, py + s / 2 - r.y);
          var band = 1 - Math.abs(dist - age * cfg.cascadeSpeed) / s;
          if (band > 0) v = Math.max(v, band * 0.55 * (1 - age / cfg.cascadeLife));
        }
        if (v <= 0.01) continue;
        ctx.fillStyle = "rgba(" + cfg.hoverRGB + ", " + (cfg.fillOpacity * v).toFixed(3) + ")";
        ctx.strokeStyle = "rgba(" + cfg.hoverRGB + ", " + (cfg.strokeOpacity * v).toFixed(3) + ")";
        ctx.fillRect(px, py, s, s);
        ctx.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, s - 1, s - 1);
      }
    }
    ctx.shadowBlur = 0;
  }

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    if (!reduced) {
      offX += cfg.dirX * cfg.speed * dt;
      offY += cfg.dirY * cfg.speed * dt;
    }
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* Pointer: hover lights a cell, click sends a ripple */
  section.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var r = canvas.getBoundingClientRect();
    hover = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  section.addEventListener("pointerleave", function () { hover = null; });
  section.addEventListener("pointerdown", function (e) {
    if (reduced || e.target.closest("a, button")) return;
    var r = canvas.getBoundingClientRect();
    cascades.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() / 1000 });
  });

  /* Only animate while the hero is on screen and the tab is visible */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(host);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(host);
  else window.addEventListener("resize", resize);

  resize();
  start();
  requestAnimationFrame(function () { host.classList.add("is-ready"); });
})();
