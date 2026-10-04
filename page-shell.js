const page = document.body.dataset.page;
const root = document.body.dataset.root || "";
const link = (path) => `${root}${path}`;
const navItems = [
  ["Home", "index.html", "home"],
  ["About Us", "about.html", "about"],
  ["Services", "services.html", "services"],
  ["Projects", "projects.html", "projects"],
  ["Contact", "contact.html", "contact"],
];

document.querySelector("[data-shell-header]")?.insertAdjacentHTML("afterend", `
  <header class="site-header" data-header>
    <a class="brand" href="${link("index.html")}" aria-label="L3 Group home"><img src="${link("assets/l3-logo-clean.png")}" alt="L3 Group" /></a>
    <nav class="site-nav" id="site-nav" aria-label="Main navigation" data-nav>
      ${navItems.map(([label, path, key]) => `<a href="${link(path)}" ${key === page || (page === "project-detail" && key === "projects") ? 'class="is-active" aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>
    <a class="phone-link" href="tel:+27844983650" aria-label="Call L3 Group on +27 84 498 3650"><span aria-hidden="true"></span><strong>+27 84 498 3650</strong></a>
    <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span></span><span></span><span></span></button>
  </header>
`);
document.querySelector("[data-shell-header]")?.remove();

document.querySelector("[data-shell-footer]")?.insertAdjacentHTML("afterend", `
  <section class="credentials-band" aria-labelledby="credentials-title">
    <div class="container credentials-band__inner">
      <div class="credentials-band__copy">
        <p class="section-kicker">L3 Group credentials</p>
        <h2 id="credentials-title">Certifications &amp; registrations</h2>
      </div>
      <img src="${link("assets/certifications.png")}?v=logo-collection" alt="Certification and registration artwork supplied by L3 Group" width="1464" height="1075" loading="lazy" decoding="async" />
    </div>
  </section>
  <footer class="contact-footer" aria-labelledby="contact-title">
    <div class="container footer-main">
      <div class="footer-intro">
        <a class="footer-logo" href="${link("index.html")}" aria-label="L3 Group home"><img src="${link("assets/l3-logo-clean.png")}" alt="L3 Group" /></a>
        <h2 id="contact-title">Let's talk about your next build.</h2>
        <p>Construction, consulting and project coordination from early planning through handover.</p>
        <a class="footer-primary-link" href="${link("contact.html")}">Start your project <span aria-hidden="true">↗</span></a>
      </div>
      <nav class="footer-links" aria-label="Explore"><h3>Explore</h3>
        <a href="${link("about.html")}">About Us</a><a href="${link("services.html")}">Services</a><a href="${link("projects.html")}">Projects</a><a href="${link("contact.html")}">Contact</a>
      </nav>
      <nav class="footer-links" aria-label="Services"><h3>Services</h3>
        <a href="${link("services.html#construction")}">Construction</a><a href="${link("services.html#renovations")}">Renovations</a><a href="${link("services.html#civil")}">Civil / Building Works</a><a href="${link("services.html#planning")}">Design / Planning</a>
      </nav>
      <div class="footer-links footer-contact"><h3>Get in touch</h3>
        <a href="tel:+27844983650">+27 84 498 3650</a><a href="mailto:INQUIRY@L3GROUP.CO.ZA">INQUIRY@L3GROUP.CO.ZA</a><p>Western Cape, South Africa. Projects elsewhere by arrangement.</p>
      </div>
    </div>
    <div class="container footer-bottom"><p>© L3 Group</p><p>Construction | Consulting | Innovation</p></div>
  </footer>
  <button class="back-to-top" type="button" aria-label="Back to top" data-back-to-top>↑</button>
`);
document.querySelector("[data-shell-footer]")?.remove();
