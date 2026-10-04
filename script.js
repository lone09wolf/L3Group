document.documentElement.classList.add("js");

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const header = document.querySelector("[data-header]");
const revealItems = document.querySelectorAll("[data-reveal]");
const backToTop = document.querySelector("[data-back-to-top]");
const tabs = document.querySelector("[data-tabs]");
const galleryMarquee = document.querySelector("[data-gallery-marquee]");
const galleryToggle = document.querySelector("[data-gallery-toggle]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const heroReveal = document.querySelector("[data-hero-reveal]");
if (heroReveal) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let revealRun = 0;
  const replayHero = async () => {
    const run = ++revealRun;
    heroReveal.classList.remove("is-preparing", "is-revealing");
    if (motionPreference.matches) return;
    heroReveal.classList.add("is-preparing");
    await Promise.all([...heroReveal.querySelectorAll(".hero-single__image")].map((image) => image.decode().catch(() => {})));
    if (run !== revealRun || motionPreference.matches) return;
    heroReveal.classList.remove("is-preparing");
    // Restart the reveal on fresh loads and back-forward cache restores.
    void heroReveal.offsetWidth;
    heroReveal.classList.add("is-revealing");
  };
  if (!motionPreference.matches) heroReveal.classList.add("is-preparing");
  window.addEventListener("pageshow", replayHero);
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) {
      revealRun++;
      heroReveal.classList.remove("is-preparing", "is-revealing");
    }
  });
}

function closeMenu() {
  if (!navToggle || !nav) return;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
  nav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    nav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("nav-open", !isOpen);
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      closeMenu();
    }
  });
}

if (header || backToTop) {
  const updateScrollState = () => {
    const hasScrolled = window.scrollY > 12;
    header?.classList.toggle("has-shadow", hasScrolled);
    header?.classList.toggle("is-scrolled", hasScrolled);
    backToTop?.classList.toggle("is-visible", window.scrollY > 480);
  };

  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });
}

if (galleryMarquee) {
  const track = galleryMarquee.querySelector(".archive-marquee__track");
  const group = galleryMarquee.querySelector("[data-gallery-group]");

  if (track && group) {
    const copy = group.cloneNode(true);
    copy.removeAttribute("data-gallery-group");
    copy.setAttribute("aria-hidden", "true");
    copy.querySelectorAll("img").forEach((image) => { image.alt = ""; });
    track.append(copy);
    galleryMarquee.classList.add("is-ready");

    const setGalleryPaused = (isPaused) => {
      galleryMarquee.classList.toggle("is-paused", isPaused);
      galleryMarquee.classList.toggle("is-user-playing", prefersReducedMotion && !isPaused);
      if (!galleryToggle) return;
      const label = isPaused ? "Resume gallery motion" : "Pause gallery motion";
      galleryToggle.setAttribute("aria-label", label);
      galleryToggle.title = label;
      const icon = galleryToggle.querySelector("img");
      if (icon) icon.src = isPaused ? "assets/play.svg" : "assets/pause.svg";
    };

    setGalleryPaused(prefersReducedMotion);
    galleryToggle?.addEventListener("click", () => {
      setGalleryPaused(!galleryMarquee.classList.contains("is-paused"));
    });
  }
}

if (tabs) {
  const tabButtons = Array.from(tabs.querySelectorAll("[data-tab]"));
  const tabPanels = Array.from(tabs.querySelectorAll("[data-tab-panel]"));

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.tab;

      tabButtons.forEach((tabButton) => {
        const isActive = tabButton === button;
        tabButton.classList.toggle("is-active", isActive);
        tabButton.setAttribute("aria-selected", String(isActive));
      });

      tabPanels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === selected);
      });
    });
  });
}

backToTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
