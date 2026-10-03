document.documentElement.classList.add("js");

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const header = document.querySelector("[data-header]");
const revealItems = document.querySelectorAll("[data-reveal]");
const backToTop = document.querySelector("[data-back-to-top]");
const slides = Array.from(document.querySelectorAll("[data-slide]"));
const dots = Array.from(document.querySelectorAll("[data-slide-dot]"));
const nextButton = document.querySelector("[data-slide-next]");
const prevButton = document.querySelector("[data-slide-prev]");
const tabs = document.querySelector("[data-tabs]");
const galleryMarquee = document.querySelector("[data-gallery-marquee]");
const galleryToggle = document.querySelector("[data-gallery-toggle]");
const enquiryForm = document.querySelector("[data-enquiry-form]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let activeSlide = 0;
let slideTimer;

function closeMenu() {
  if (!navToggle || !nav) return;
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open navigation");
  nav.classList.remove("is-open");
  document.body.classList.remove("nav-open");
}

function showSlide(index) {
  if (!slides.length) return;
  activeSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeSlide);
  });

  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeSlide);
  });
}

function restartSlider() {
  window.clearInterval(slideTimer);
  slideTimer = window.setInterval(() => showSlide(activeSlide + 1), 6500);
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

if (slides.length) {
  nextButton?.addEventListener("click", () => {
    showSlide(activeSlide + 1);
    restartSlider();
  });

  prevButton?.addEventListener("click", () => {
    showSlide(activeSlide - 1);
    restartSlider();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      restartSlider();
    });
  });

  if (!prefersReducedMotion) {
    restartSlider();
  }
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

if (enquiryForm) {
  const requestedService = new URLSearchParams(window.location.search).get("service");
  const serviceSelect = enquiryForm.elements.namedItem("service");
  if (requestedService && serviceSelect instanceof HTMLSelectElement) {
    const match = Array.from(serviceSelect.options).find((option) => option.value === requestedService);
    if (match) serviceSelect.value = match.value;
  }

  enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!enquiryForm.reportValidity()) return;

    const status = enquiryForm.querySelector("[data-form-status]");
    const submit = enquiryForm.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(enquiryForm));
    submit.disabled = true;
    status.textContent = "Sending your enquiry...";

    try {
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`Delivery failed (${response.status})`);
      status.textContent = "Thanks. Your enquiry has been sent.";
      enquiryForm.reset();
    } catch {
      const subject = encodeURIComponent(`L3 Group enquiry: ${data.service}`);
      const body = encodeURIComponent(`Name: ${data.name}\nEmail: ${data.email}\nLocation: ${data.location}\nService: ${data.service}\n\nProject:\n${data.message}`);
      const fallback = document.createElement("a");
      fallback.href = `mailto:INQIURY@L3GROUP.CO.ZA?subject=${subject}&body=${body}`;
      fallback.textContent = "Open an email draft";
      fallback.className = "inline-link";
      status.replaceChildren("The online form is unavailable. ", fallback, " to send your enquiry directly.");
    } finally {
      submit.disabled = false;
    }
  });
}

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
