(function () {
  var list = document.getElementById("projects");
  var modal = document.getElementById("video-modal");
  var modalBody = document.getElementById("modal-body");
  var modalTitle = document.getElementById("modal-title");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Turn a YouTube / Loom / Vimeo link into an embeddable URL. Returns null for local files.
  function embedUrl(v) {
    var m;
    if ((m = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/))) return "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0";
    if ((m = v.match(/loom\.com\/(?:share|embed)\/([\w-]+)/))) return "https://www.loom.com/embed/" + m[1];
    if ((m = v.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return "https://player.vimeo.com/video/" + m[1];
    return null;
  }

  var playIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l11-6.5z"/></svg>';
  var extIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';

  (window.PROJECTS || []).forEach(function (p, i) {
    var hasVideo = !!(p.video && p.video.trim());
    var el = document.createElement("article");
    el.className = "project";
    el.innerHTML =
      '<a class="project__media" href="' + esc(p.url) + '" target="_blank" rel="noopener" aria-label="Open the ' + esc(p.name) + ' export in a new tab">' +
        '<img src="' + esc(p.image) + '" alt="Homepage of the ' + esc(p.name) + ' Webflow build" loading="' + (i ? "lazy" : "eager") + '" width="1200" height="750">' +
        '<span class="project__badge">Webflow export · NDA-safe duplicate</span>' +
      "</a>" +
      '<div class="project__body">' +
        '<p class="project__cat">' + esc(p.category) + " · " + esc(p.pages) + " pages</p>" +
        "<h3>" + esc(p.name) + "</h3>" +
        "<p>" + esc(p.summary) + "</p>" +
        '<ul class="project__list">' + p.highlights.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" +
        '<ul class="chips chips--small">' + p.tags.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
        '<div class="project__actions">' +
          '<a class="btn" href="' + esc(p.url) + '" target="_blank" rel="noopener">View live export ' + extIcon + "</a>" +
          (hasVideo
            ? '<button class="btn btn--ghost" type="button" data-video="' + esc(p.video) + '" data-name="' + esc(p.name) + '">' + playIcon + " Watch Designer walkthrough</button>"
            : '<span class="video-soon" title="Recording of this build inside the Webflow Designer">' + playIcon + " Designer walkthrough coming soon</span>") +
        "</div>" +
      "</div>";
    list.appendChild(el);
  });

  list.addEventListener("click", function (e) {
    var b = e.target.closest("[data-video]");
    if (!b) return;
    var v = b.getAttribute("data-video");
    var src = embedUrl(v);
    modalTitle.textContent = b.getAttribute("data-name") + ": Webflow Designer walkthrough";
    modalBody.innerHTML = src
      ? '<iframe src="' + esc(src) + '" title="' + esc(modalTitle.textContent) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>'
      : '<video src="' + esc(v) + '" controls autoplay playsinline></video>';
    if (modal.showModal) modal.showModal(); else modal.setAttribute("open", "");
  });

  function closeModal() { modalBody.innerHTML = ""; if (modal.open) modal.close(); }
  modal.querySelector(".modal__close").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  modal.addEventListener("close", function () { modalBody.innerHTML = ""; });

  var li = document.getElementById("linkedin-link");
  if (window.SITE && SITE.linkedin) { li.href = SITE.linkedin; li.hidden = false; }
  document.getElementById("year").textContent = new Date().getFullYear();
})();
