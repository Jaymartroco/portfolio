/*
  Work section card swap (inspired by React Bits "Card Swap") + project modal.
  Custom code because Webflow Interactions can't scrub a 3D card stack or clone CMS items into a modal (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code, AFTER the site script
  (the site script fills each card's action buttons, which the modal clones).

  - Reads the .work_card articles in .work_list (the CMS list stays in the page as the no-JS fallback).
  - Builds a skewed 3D stack driven by one continuous position `p`:
    every card's place in the stack is (its index - p), so changing p by 0.3 moves every card 30% of the way
    to its next slot. The card passing the front slides off and fades, then rejoins at the back.
  - Drag sideways to scrub through the stack: how far you drag decides how many projects you pass,
    and a flick carries on with momentum before settling on the nearest card.
  - Autoplay, the arrow buttons and the arrow keys animate p by one card.
  - Clicking any card (or "View project details") opens that project's full card in #project-modal.
  - Pauses on hover, on focus, while dragging, while the modal is open and when off screen.
    No autoplay for reduced motion (moves jump instead of animating).
*/
(function () {
  "use strict";

  var list = document.querySelector(".work_list");
  var cards = list ? Array.prototype.slice.call(list.querySelectorAll(".work_card")) : [];
  var modal = document.getElementById("project-modal");
  if (cards.length < 2 || !modal) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cfg = {
    delay: 5000,        // ms between autoplay moves
    depth: 4,           // cards visible in the stack
    skew: 4,            // deg
    stepMs: 1000,       // ms for one autoplay / button move
    dragStep: 0.34,     // fraction of the stage width you drag to pass one card
    momentum: 220,      // ms of flick velocity carried after letting go
    clickSlop: 6        // px of movement before a press counts as a drag
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  var next = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---------- Read project data from the CMS cards ---------- */
  var data = cards.map(function (card) {
    var img = card.querySelector(".work_image");
    var meta = card.querySelector(".work_meta .text-color-muted");
    return {
      card: card,
      id: card.id,
      title: (card.querySelector("h3") || {}).textContent || "",
      number: (card.querySelector(".work_number") || {}).textContent || "",
      meta: meta ? meta.textContent : "",
      desc: (card.querySelector(".work_content > p") || {}).textContent || "",
      img: img ? img.getAttribute("src") : ""
    };
  });
  var total = data.length;

  /* ---------- Build the swap layout ---------- */
  var wrap = document.createElement("div");
  wrap.className = "work_swap";
  wrap.innerHTML =
    '<div class="work_swap-info" aria-live="polite">' +
      '<div class="work_swap-count text-size-small text-style-mono"><span class="work_number" data-swap-number></span><span class="text-color-muted"> / ' + String(total).padStart(2, "0") + "</span></div>" +
      '<div class="spacer-small"></div>' +
      '<h3 class="heading-style-h2" data-swap-title></h3>' +
      '<div class="spacer-xsmall"></div>' +
      '<p class="text-size-small text-style-mono text-color-muted" data-swap-meta></p>' +
      '<div class="spacer-small"></div>' +
      '<p class="text-color-muted" data-swap-desc></p>' +
      '<div class="spacer-medium"></div>' +
      '<div class="button-group">' +
        '<button class="button" type="button" data-swap-open><span class="button_text">View project details</span><span class="button_icon is-plus" aria-hidden="true">' + plus + "</span></button>" +
        '<div class="work_swap-nav">' +
          '<button class="work_swap-arrow is-prev" type="button" data-swap-prev aria-label="Previous project">' + next + "</button>" +
          '<button class="work_swap-arrow" type="button" data-swap-next aria-label="Next project">' + next + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="spacer-small"></div>' +
      '<p class="text-size-small text-color-muted">Drag the cards to explore, or click one to open the full breakdown.</p>' +
    "</div>" +
    '<div class="work_swap-stage"></div>';

  var stage = wrap.querySelector(".work_swap-stage");
  var info = wrap.querySelector(".work_swap-info");
  var lastDragEnd = -1e9;
  var els = data.map(function (d, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "swap_card";
    b.setAttribute("aria-label", "Open " + d.title + " project details");
    b.innerHTML =
      '<span class="swap_card-image"><img src="' + esc(d.img) + '" alt="" width="1200" height="750" loading="lazy"></span>' +
      '<span class="swap_card-bar">' +
        '<span class="swap_card-text"><span class="swap_card-title">' + esc(d.title) + '</span><span class="swap_card-meta">' + esc(d.meta) + "</span></span>" +
        '<span class="swap_card-number">' + esc(d.number) + "</span>" +
        '<span class="swap_card-icon" aria-hidden="true">' + arrow + "</span>" +
      "</span>";
    b.querySelector("img").draggable = false;
    b.addEventListener("click", function (e) {
      if (performance.now() - lastDragEnd < 350) { e.preventDefault(); return; } // a drag isn't a click
      openProject(i);
    });
    stage.appendChild(b);
    return b;
  });

  list.parentNode.insertBefore(wrap, list);
  list.classList.add("is-enhanced");

  /* ---------- Stack geometry ---------- */
  var p = 0;                       // continuous stack position; the front card is mod(round(p), total)
  var leaveDir = { x: 0, y: 1 };   // where the card passing the front slides off to
  var dx = 0, dy = 0, stageW = 0, stageH = 0, cardH = 0, frontShown = -1;

  function measure() {
    var w = els[0].offsetWidth;
    cardH = els[0].offsetHeight;
    stageW = stage.offsetWidth;
    stageH = stage.offsetHeight;
    dx = w * 0.11;
    dy = w * 0.12;
  }
  // Slot k (can be fractional) in the visible stack: 0 = front, depth-1 = back
  function slotAt(k) {
    var ox = -(cfg.depth - 1) * dx / 2, oy = (cfg.depth - 1) * dy / 2; // center the visible stack
    return { x: ox + k * dx, y: oy - k * dy, z: -k * dx * 1.5 };
  }
  function tf(s, offX, offY, rot) {
    return "translate(-50%, -50%) translate3d(" + (s.x + offX).toFixed(1) + "px, " + (s.y + offY).toFixed(1) + "px, " + s.z.toFixed(1) + "px)" +
      " rotate(" + rot.toFixed(2) + "deg) skewY(" + cfg.skew + "deg)";
  }

  function render() {
    var front = mod(Math.round(p), total);
    var away = Math.max(stageW * 0.55, stageH * 0.6 + cardH * 0.4);
    els.forEach(function (el, idx) {
      var r = mod(idx - p, total); // this card's place in the stack, 0 = front
      var t, op, z;
      if (r > total - 1) {
        // passing the front: slides off along leaveDir and fades, then rejoins at the back
        var leave = total - r; // 0 at the front .. 1 gone
        t = tf(slotAt(0), leaveDir.x * leave * away, leaveDir.y * leave * away, leaveDir.x * leave * 10);
        op = 1 - leave;
        z = total * 10 + 5;
      } else {
        t = tf(slotAt(Math.min(r, cfg.depth - 1)), 0, 0, 0);
        op = clamp(cfg.depth - r, 0, 1); // the card coming into view at the back fades in
        z = Math.round((total - r) * 10);
      }
      el.style.transform = t;
      el.style.opacity = op.toFixed(3);
      el.style.zIndex = z;
    });
    if (front !== frontShown) {
      els.forEach(function (el, idx) {
        var isFront = idx === front;
        el.classList.toggle("is-front", isFront);
        el.tabIndex = isFront ? 0 : -1;
        el.setAttribute("aria-hidden", isFront ? "false" : "true");
      });
      if (frontShown !== -1) showInfo(front); else showInfo(front, true);
      frontShown = front;
    }
  }

  function showInfo(i, quiet) {
    var d = data[i];
    info.querySelector("[data-swap-number]").textContent = d.number;
    info.querySelector("[data-swap-title]").textContent = d.title;
    info.querySelector("[data-swap-meta]").textContent = d.meta;
    info.querySelector("[data-swap-desc]").textContent = d.desc;
    if (!reduced && !quiet) {
      info.classList.remove("is-changing");
      void info.offsetWidth;
      info.classList.add("is-changing");
    }
  }

  /* ---------- Animation loop ---------- */
  var anim = null, raf = 0, drag = null;

  function tick(now) {
    if (anim) {
      var e = clamp((now - anim.t0) / anim.dur, 0, 1);
      p = anim.from + (anim.to - anim.from) * anim.ease(e);
      if (e >= 1) { p = mod(anim.to, total); anim = null; }
    }
    render();
    raf = anim || drag ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }

  function goTo(target, dur, ease) {
    if (reduced) { p = mod(target, total); anim = null; render(); return; }
    anim = { from: p, to: target, t0: performance.now(), dur: dur, ease: ease };
    kick();
  }
  function target() { return anim ? anim.to : Math.round(p); }
  function step(n) {
    leaveDir = n > 0 ? { x: 0, y: 1 } : { x: -1, y: 0.15 };
    goTo(target() + n, cfg.stepMs, easeInOutCubic);
  }

  /* ---------- Drag to scrub ---------- */
  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: p, moved: false, samples: [] };
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(mx, my) < cfg.clickSlop) return;
      drag.moved = true;
      anim = null;                 // grab the stack mid-animation
      drag.p0 = p;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* pointer already released */ }
      stage.classList.add("is-dragging");
      leaveDir = { x: -1, y: 0 };  // cards follow the pointer sideways
      schedule();
    }
    p = drag.p0 - mx / (stageW * cfg.dragStep);
    drag.samples.push({ t: performance.now(), x: e.clientX });
    if (drag.samples.length > 6) drag.samples.shift();
    kick();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    stage.classList.remove("is-dragging");
    if (!d.moved) { schedule(); return; }
    lastDragEnd = performance.now(); // swallow the click that follows this pointerup

    // flick velocity from the last few samples, in px per ms
    var v = 0, s = d.samples;
    if (s.length > 1) {
      var a = s[0], b = s[s.length - 1];
      if (performance.now() - b.t < 80 && b.t > a.t) v = (b.x - a.x) / (b.t - a.t);
    }
    var carry = clamp((v * cfg.momentum) / (stageW * cfg.dragStep), -3, 3); // a hard flick passes 3 more cards at most
    var projected = p - carry;
    var to = Math.round(projected);
    goTo(to, 450 + Math.min(Math.abs(to - p), 4) * 120, easeOutCubic);
    schedule();
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  /* Arrow keys while the stack has focus */
  wrap.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  });

  /* ---------- Autoplay with pauses ---------- */
  var timer = 0, hovering = false, focused = false, onScreen = false;
  function canPlay() { return !reduced && onScreen && !hovering && !focused && !drag && !modal.open && !document.hidden; }
  function schedule() {
    clearInterval(timer);
    if (canPlay()) timer = setInterval(function () { step(1); }, cfg.delay);
  }
  stage.addEventListener("mouseenter", function () { hovering = true; schedule(); });
  stage.addEventListener("mouseleave", function () { hovering = false; schedule(); });
  wrap.addEventListener("focusin", function () { focused = true; schedule(); });
  wrap.addEventListener("focusout", function () { focused = false; schedule(); });
  document.addEventListener("visibilitychange", schedule);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; schedule(); }, { threshold: 0.25 }).observe(stage);
  } else { onScreen = true; }

  info.querySelector("[data-swap-next]").addEventListener("click", function () { step(1); schedule(); });
  info.querySelector("[data-swap-prev]").addEventListener("click", function () { step(-1); schedule(); });
  info.querySelector("[data-swap-open]").addEventListener("click", function () { openProject(mod(target(), total)); });

  /* ---------- Project modal ---------- */
  var modalTitle = modal.querySelector("[data-project-title]");
  var modalBody = modal.querySelector("[data-project-body]");

  function openProject(i) {
    var d = data[i];
    var clone = d.card.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("data-anim");
    clone.classList.add("is-modal");
    clone.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    var h = clone.querySelector("h3");
    if (h) h.remove(); // title moves to the modal header
    modalTitle.textContent = d.title;
    modalBody.innerHTML = "";
    modalBody.appendChild(clone);
    modalBody.scrollTop = 0;
    if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
    schedule();
  }
  function closeProject() { if (modal.open) modal.close(); }
  modal.querySelector(".modal_close").addEventListener("click", closeProject);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeProject(); });
  modal.addEventListener("close", function () { modalBody.innerHTML = ""; schedule(); });

  /* Links to a project (#work-…) open its modal instead of jumping to the hidden list */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#work-"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    for (var i = 0; i < data.length; i++) {
      if (data[i].id === id) { e.preventDefault(); openProject(i); return; }
    }
  });

  /* ---------- Init ---------- */
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { measure(); render(); }, 120);
  });
  measure();
  render();
  // measure again once the first image has its real height
  var firstImg = els[0].querySelector("img");
  if (firstImg && !firstImg.complete) firstImg.addEventListener("load", function () { measure(); render(); }, { once: true });
  requestAnimationFrame(function () { wrap.classList.add("is-ready"); });
  schedule();
})();
