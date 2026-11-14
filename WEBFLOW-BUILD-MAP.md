# Webflow build map

This static site is structured so it can be rebuilt 1:1 in Webflow following
`GLOBAL-WEBFLOW-DEVELOPMENT-GUIDE.md`.

## Brand

| File | Use |
|---|---|
| `assets/img/brand/logo-mark.svg` | Primary mark: lime tile, ink "ja" monogram. Nav, favicon, avatars |
| `assets/img/brand/logo-mark-dark.svg` | Ink tile, lime monogram. For light backgrounds |
| `assets/img/brand/logo-mark-mono.svg` | Monogram only, `currentColor`. For embeds and single-colour use |
| `assets/img/brand/logo-lockup-light.svg` / `-dark.svg` | Mark + "Jaymart Alayon / Webflow Developer". Text uses Inter Tight; outline it in Figma before sending to print |

Colours: Ink `#0B0B0D`, Bone `#F4F4F0`, Lime `#D4FF3A` (hover `#BCE51F`), Stone `#8C8C86`.
Fonts: Inter Tight (400/500/600), Instrument Serif Italic (accent words), JetBrains Mono (taglines, meta).

## Variables (Appendix C)

`:root` in `assets/css/style.css` uses Webflow-style names: `--size--80-48` = `Size/80-48`,
`--font-sizes--h1-72-44` = `Font Sizes/H1 72-44`, `--color-scheme-1--text` = `Color Scheme 1/Text`.
Project additions: `Font Sizes/Display 128-52`, and a **Light** mode on Color Scheme 1
(applied by `section-style-light`).

## Page structure (guide 1.3)

```text
page-wrapper
  Nav (component)                 nav_component > padding-global > container-large > nav_container
  main-wrapper
    section_hero (<header>)       padding-section-large is-nav-clearance is-bottom-reduced > hero_component
    section_showcase              image marquee (showcase_component > showcase_group x2)
    section_tools                 text marquee (tools_component > tools_group x2)
    section_work                  section-header_component, work_note, work_list > work_card
    section_services              section-style-light; services_list > services_card
    section_about                 about_component > about_content (sticky) + about_list > about_item
    section_skills                padding-section-large is-top-none; skills_list > skills_card
    section_cta                   container-medium > cta_component
  Footer (component)              footer_top, footer_wordmark, footer_bottom
  modal_component (<dialog>)
```

Recorded exception: `is-nav-clearance` on the hero clears the fixed nav.

## Components to create

`Nav`, `Footer`, `button` (Text, Link, Show Icon, Combo Class props: `is-secondary`, `is-small`, `is-large`),
`tagline` (`is-pill`), `work_card` (CMS: Projects), `services_card`, `skills_card`.

## CMS: Projects collection

Name, Slug, Category, Page count, Summary, Highlights (Rich Text list), Tags (multi-ref), Thumbnail (alt text),
Export URL, Walkthrough video URL, Order. `work_card` binds to these; the "coming soon" label shows when
Walkthrough video URL is empty (conditional visibility).

## Interactions (guide 6.5)

Site-scoped attribute interactions, one per value: `data-anim="hero" | "hero-side" | "slide-up" | "card" | "stagger" | "display"`.
Hero heading uses Split Text (words, masked). Hovers are CSS in Global Styles (button icon nudge,
link underline, card image scale, work_image-cta pop). Marquees are CSS keyframes, paused on hover,
off for reduced motion. In this static version `assets/js/main.js` plays the role of those interactions.
