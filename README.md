# Jaymart Alayon — Webflow Developer Portfolio

Static portfolio site (plain HTML/CSS/JS, no build step) that showcases Webflow projects.

> **About the projects:** everything in `projects/` is a site exported from Webflow. Each one is a
> duplicate of an original client build that I updated so no client details are present (NDA).
> Brand names, logos, copy, contact details, people and data are fictional. The structure,
> class system, CMS, components and interactions are my work.

## Structure

```
index.html              Portfolio homepage
assets/css/style.css    Styles
assets/js/projects.js   ← Project data + video links (edit this to update the site)
assets/js/main.js       Renders project cards and the video player
assets/img/             Project thumbnails, favicon
assets/videos/          Optional local walkthrough videos (.mp4)
projects/<name>/        Webflow exports (open index.html)
tools/serve.ps1         Local preview server
```

## Preview locally

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open http://localhost:8095

## Adding the Webflow Designer walkthrough videos

1. Record your screen while you click through the project in the Webflow Designer
   (Navigator, class panel, CMS collections, interactions). Windows: **Win + Alt + R** (Xbox Game Bar)
   or **Snipping Tool → Record**. Loom also works well.
2. Upload it **unlisted** to YouTube, Loom or Vimeo (recommended, keeps the repo small), **or**
   put a compressed `.mp4` (under ~50 MB) in `assets/videos/`.
3. Paste the link or path into that project's `video` field in `assets/js/projects.js`:

```js
video: "https://www.youtube.com/watch?v=XXXXXXXXXXX"
// or
video: "assets/videos/dunebright-designer.mp4"
```

The card then shows a **Watch Designer walkthrough** button that opens the video in a modal.

## Publish on GitHub Pages

1. Create a new **empty** repository on GitHub (no README), e.g. `portfolio`.
2. In this folder:

```bash
git remote add origin https://github.com/<your-username>/portfolio.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. After a minute the site is live at `https://<your-username>.github.io/portfolio/`.

Tip: name the repo `<your-username>.github.io` to get the root URL `https://<your-username>.github.io/`.
