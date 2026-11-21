/*
  Scroll velocity marquee (inspired by React Bits "Scroll Velocity").
  Custom code because the speed follows the page's scroll velocity, which Webflow Interactions can't read (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code.

  Markup: .tools_component[data-scroll-velocity="1|-1"] > .tools_track > .tools_group (x2 or more)
  - Each row drifts at a base speed in its own direction (1 = left, -1 = right).
  - Scrolling speeds the rows up in proportion to how fast you scroll, and scrolling up flips both directions.
  - Without this script the CSS marquee animation runs instead. Off for reduced motion.
*/
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var rows = Array.prototype.slice.call(document.querySelectorAll("[data-scroll-velocity]"));
  if (!rows.length) return;

  var cfg = {
    baseSpeed: 45,        // px per second at rest
    maxBoost: 5,          // extra speed multiplier at full scroll speed
    fullVelocity: 1000,   // px/s of scroll that counts as "full speed"
    smoothing: 9          // how quickly the boost follows scroll speed (per second)
  };

  var state = rows.map(function (row) {
    var track = row.querySelector(".tools_track");
    return { row: row, track: track, dir: parseFloat(row.getAttribute("data-scroll-velocity")) || 1, x: 0, groupW: 0 };
  });

  // Enough copies of the group to cover the row twice over, so the wrap is never visible
  function fill(s) {
    var groups = s.track.querySelectorAll(".tools_group");
    var first = groups[0];
    s.groupW = first.getBoundingClientRect().width;
    if (!s.groupW) return;
    var need = Math.ceil(s.row.clientWidth / s.groupW) + 1;
    for (var n = groups.length; n < need; n++) {
      var c = first.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      s.track.appendChild(c);
    }
  }
  function measure() { state.forEach(fill); }

  state.forEach(function (s) { s.row.classList.add("is-velocity"); });
  measure();
  window.addEventListener("resize", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  var lastY = window.scrollY, smoothV = 0, direction = 1, last = 0, raf = 0, visible = true;

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60;
    last = t;

    var y = window.scrollY;
    var v = (y - lastY) / dt;       // scroll velocity in px/s
    lastY = y;
    smoothV += (v - smoothV) * (1 - Math.exp(-dt * cfg.smoothing));
    if (smoothV < -1) direction = -1; else if (smoothV > 1) direction = 1;
    var boost = Math.min(Math.abs(smoothV) / cfg.fullVelocity, 1) * cfg.maxBoost;

    state.forEach(function (s) {
      if (!s.groupW) return;
      var move = s.dir * direction * cfg.baseSpeed * dt * (1 + boost);
      s.x -= move;
      // wrap within one group width
      s.x = ((s.x % s.groupW) - s.groupW) % s.groupW;
      s.track.style.transform = "translate3d(" + s.x.toFixed(2) + "px, 0, 0)";
    });

    raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function start() { if (!raf && visible && !document.hidden) { lastY = window.scrollY; raf = requestAnimationFrame(frame); } }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) { return e.isIntersecting; });
      if (visible) start();
    }).observe(rows[0].parentElement);
  }
  document.addEventListener("visibilitychange", start);
  start();
})();
