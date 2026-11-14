/*
  PORTFOLIO DATA — edit this file to update the site.

  video: how to add the Webflow Designer walkthrough for a project. Use ONE of:
    - a local file:      "assets/videos/apsis-designer.mp4"   (keep it under ~50 MB; GitHub blocks files over 100 MB)
    - a YouTube link:    "https://www.youtube.com/watch?v=XXXXXXXXXXX"  (unlisted works)
    - a Loom link:       "https://www.loom.com/share/XXXXXXXX"
    - a Vimeo link:      "https://vimeo.com/123456789"
    Leave it as "" and the card shows "Walkthrough coming soon".
*/
window.SITE = {
  linkedin: "https://www.linkedin.com/in/jaymartroco/" // the LinkedIn button in Contact appears when this is filled in
};

window.PROJECTS = [
  {
    slug: "dunebright-solar",
    name: "Dunebright Solar",
    category: "Local services · Lead generation",
    summary: "A 20+ page marketing site for a solar panel cleaning company, built for local SEO and lead capture. Two CMS collections power the blog and case studies, and a custom calculator estimates how much output dirty panels are costing.",
    highlights: [
      "Blog and Case Studies CMS with category filters and load-more (Finsweet Attributes)",
      "Interactive savings / pricing calculator page",
      "Services, service areas, FAQ, reviews and warranty pages",
      "Auto read-time on articles, GSAP ScrollTrigger reveals",
      "Unique meta titles, Open Graph and optimised AVIF imagery"
    ],
    tags: ["Webflow CMS", "Finsweet", "Calculator", "GSAP", "Local SEO"],
    pages: 22,
    url: "projects/dunebright-solar/index.html",
    image: "assets/img/dunebright-solar.webp",
    video: ""
  },
  {
    slug: "apsis-space-intelligence",
    name: "Apsis",
    category: "Aerospace · B2B technology",
    summary: "A 10-page corporate site for a space intelligence company. Product, solution and company pages share one component system, with editorial typography, motion-heavy storytelling and filterable news.",
    highlights: [
      "Mega-menu navigation across Technology, Solutions and Company",
      "GSAP SplitText + ScrollTrigger headline and section animations",
      "Swiper sliders and Finsweet-filtered Stories list",
      "Careers, offices and team sections built from reusable components",
      "Scroll-lock mobile menu and full responsive pass"
    ],
    tags: ["Components", "GSAP SplitText", "Swiper", "Finsweet", "Responsive"],
    pages: 10,
    url: "projects/apsis-space-intelligence/index.html",
    image: "assets/img/apsis-space-intelligence.webp",
    video: ""
  },
  {
    slug: "tessarc-autonomy-testing",
    name: "Tessarc",
    category: "Robotics · Deep tech",
    summary: "A dark, technical landing site for an autonomy testing and validation company. The hero is an animated line-art scene, and long-form manifesto content is paced with scroll-driven motion.",
    highlights: [
      "Animated SVG / canvas hero illustration",
      "Scroll-driven storytelling with GSAP ScrollTrigger",
      "Manifesto long-read and privacy policy pages",
      "Custom consent banner that keeps analytics off until allowed",
      "Lightweight build: under 1.5 MB including assets"
    ],
    tags: ["Animated SVG", "GSAP", "Landing page", "Accessibility"],
    pages: 4,
    url: "projects/tessarc-autonomy-testing/index.html",
    image: "assets/img/tessarc-autonomy-testing.webp",
    video: ""
  }
];
