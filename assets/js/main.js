/*
  Site script. In a Webflow build this lives in Project Settings > Footer code (guide 9.4),
  never in an HTML Embed. Each block says why it's custom code (guide 3.1).
*/
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Work card actions (stands in for CMS fields) ---------- */
  var arrowIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  var playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';
  var projects = window.PROJECTS || {};

  document.querySelectorAll("[data-project]").forEach(function (card) {
    var p = projects[card.getAttribute("data-project")];
    var slot = card.querySelector("[data-actions]");
    if (!p || !slot) return;
    var hasVideo = !!(p.video && p.video.trim());
    slot.innerHTML =
      '<a class="button" href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
        '<span class="button_text">View live export</span><span class="button_icon" aria-hidden="true">' + arrowIcon + "</span></a>" +
      (hasVideo
        ? '<button class="button is-secondary" type="button" data-video="' + esc(p.video) + '" data-name="' + esc(p.name) + '">' +
            '<span class="button_icon" aria-hidden="true">' + playIcon + '</span><span class="button_text">Designer walkthrough</span></button>'
        : '<span class="work_soon">' + playIcon + " Designer walkthrough coming soon</span>");
  });

  /* ---------- Video modal (native <dialog>) ---------- */
  var modal = document.getElementById("video-modal");
  var modalBody = document.getElementById("modal-body");
  var modalTitle = document.getElementById("modal-title");

  function embedUrl(v) {
    var m;
    if ((m = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/))) return "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0";
    if ((m = v.match(/loom\.com\/(?:share|embed)\/([\w-]+)/))) return "https://www.loom.com/embed/" + m[1];
    if ((m = v.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return "https://player.vimeo.com/video/" + m[1];
    return null;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-video]");
    if (!b || !modal) return;
    var v = b.getAttribute("data-video");
    var src = embedUrl(v);
    modalTitle.textContent = b.getAttribute("data-name") + ": Webflow Designer walkthrough";
    modalBody.innerHTML = src
      ? '<iframe src="' + esc(src) + '" title="' + esc(modalTitle.textContent) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>'
      : '<video src="' + esc(v) + '" controls autoplay playsinline></video>';
    if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
  });
  if (modal) {
    var closeModal = function () { modalBody.innerHTML = ""; if (modal.open) modal.close(); };
    modal.querySelector(".modal_close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener("close", function () { modalBody.innerHTML = ""; });
  }

  /* ---------- Nav: mobile menu (ARIA state needs a script) and hide-on-scroll ---------- */
  var nav = document.querySelector("[data-nav]");
  var toggle = document.querySelector("[data-nav-toggle]");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  if (nav && toggle) {
    toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest(".nav_link")) setMenu(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
  }
  var lastY = window.scrollY;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    if (nav && !nav.classList.contains("is-open")) nav.classList.toggle("is-hidden", y > lastY && y > 400);
    lastY = y;
  }, { passive: true });

  /* Current section highlight (Webflow adds w--current for same-page anchors) */
  var links = document.querySelectorAll(".nav_link[href^='#']");
  if ("IntersectionObserver" in window && links.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.toggle("w--current", l.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (l) { var t = document.querySelector(l.getAttribute("href")); if (t) spy.observe(t); });
  }

  /* ---------- Split text: wrap each word for a masked reveal (guide 6.6) ---------- */
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement("span"); w.className = "split_word";
            var inner = document.createElement("span"); inner.className = "split_inner";
            inner.style.setProperty("--i", i++); inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  });

  /* ---------- Site-wide reveals: data-anim (guide 6.5) ----------
     Webflow does this with one site-scoped Interaction per data-anim value.
     Here an IntersectionObserver adds .is-in once (one-shot). */
  document.querySelectorAll('[data-anim="stagger"]').forEach(function (parent) {
    var n = 0;
    Array.prototype.forEach.call(parent.children, function (c) {
      if (!/spacer/.test(c.className)) c.style.setProperty("--i", n++);
    });
  });
  var heroDelay = { hero: 0.15, "hero-side": 0.3 };
  var targets = document.querySelectorAll("[data-anim], [data-split]");
  targets.forEach(function (el) {
    var d = heroDelay[el.getAttribute("data-anim")];
    if (d) el.style.setProperty("--anim-delay", d + "s");
  });

  if (reduced || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -15% 0px" });
    targets.forEach(function (el) {
      var a = el.getAttribute("data-anim");
      // Heroes start at "top 100%" so nothing low on a short screen stays hidden
      if (a === "hero" || a === "hero-side" || el.hasAttribute("data-split")) {
        requestAnimationFrame(function () { el.classList.add("is-in"); });
      } else {
        io.observe(el);
      }
    });
  }
  root.classList.add("anim-ready");

  /* ---------- Footer: year and local time ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  var timeEl = document.querySelector("[data-local-time]");
  function tick() {
    try {
      timeEl.textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date()) + " PHT";
    } catch (e) { /* keep fallback text */ }
  }
  if (timeEl) { tick(); setInterval(tick, 30000); }

  /* LinkedIn URL from projects.js */
  if (window.SITE && SITE.linkedin) {
    document.querySelectorAll("[data-linkedin], #linkedin-link").forEach(function (a) { a.href = SITE.linkedin; });
  }
})();
