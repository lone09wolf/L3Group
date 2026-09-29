document.documentElement.classList.add('js');

const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');
const header = document.querySelector('[data-header]');
const main = document.querySelector('main');
const backToTop = document.querySelector('[data-back-to-top]');
const mobileContactBar = document.querySelector('.mobile-contact-bar');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileLayout = window.matchMedia('(max-width: 1100px)');

function setMenu(open, restoreFocus = false) {
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  nav.classList.toggle('is-open', open);
  nav.inert = mobileLayout.matches && !open;
  main.inert = open;
  backToTop.inert = open;
  mobileContactBar.inert = open;
  document.body.classList.toggle('nav-open', open);
  if (open) nav.querySelector('a').focus();
  else if (restoreFocus) navToggle.focus();
}

navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));
nav.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || !mobileLayout.matches) return;
  setMenu(false);
  const target = document.querySelector(link.hash || '#main');
  target?.setAttribute('tabindex', '-1');
  target?.focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (navToggle.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') { setMenu(false, true); return; }
  if (event.key !== 'Tab') return;
  const controls = [...nav.querySelectorAll('a'), navToggle];
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});
document.addEventListener('click', event => {
  if (!header.contains(event.target) && navToggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
});
mobileLayout.addEventListener('change', () => setMenu(false));
setMenu(false);

const sectionLinks = [...nav.querySelectorAll('a')];
const sections = sectionLinks.map(link => link.hash ? document.querySelector(link.hash) : main);
let scrollScheduled = false;
function updateScrollState() {
  const hasScrolled = window.scrollY > 12;
  header.classList.toggle('is-scrolled', hasScrolled);
  const showBackToTop = window.scrollY > 480;
  backToTop.classList.toggle('is-visible', showBackToTop);
  backToTop.tabIndex = showBackToTop ? 0 : -1;
  let activeIndex = 0;
  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= header.offsetHeight + 100) activeIndex = index;
  });
  sectionLinks.forEach((link, index) => {
    link.classList.toggle('is-active', index === activeIndex);
    if (index === activeIndex) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scrollScheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScrollState); }
}, { passive: true });
updateScrollState();
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: motionPreference.matches ? 'instant' : 'smooth' });
  document.querySelector('.brand').focus({ preventScroll: true });
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('[data-reveal]').forEach(item => revealObserver.observe(item));
}

const enquiryForm = document.querySelector('[data-enquiry]');
document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    enquiryForm.elements.service.value = link.dataset.service;
  });
});

function openEmailDraft(values) {
  const subject = 'L3 Group enquiry: ' + values.get('service');
  const body = 'Name: ' + values.get('name') + '\r\nEmail: ' + values.get('email') + '\r\nLocation: ' + values.get('location') + '\r\nService: ' + values.get('service') + '\r\n\r\n' + values.get('message');
  window.location.href = 'mailto:inquiry@i3group.co.za?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

enquiryForm.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  const status = document.querySelector('[data-form-status]');
  button.disabled = true;
  button.textContent = 'Sending…';
  status.textContent = '';

  try {
    const response = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(values)),
    });
    if (!response.ok) throw new Error('Delivery is not configured');
    form.reset();
    status.textContent = 'Thank you. Your enquiry has been sent to L3 Group.';
    status.className = 'form-status is-success';
  } catch {
    openEmailDraft(values);
    status.textContent = 'Online delivery is not connected yet. A draft has been prepared in your email app for you to review and send.';
    status.className = 'form-status is-fallback';
  } finally {
    button.disabled = false;
    button.innerHTML = 'Send Enquiry <img class="icon" src="assets/arrow-up-right.svg" alt="" width="20" height="20" />';
  }
});

const photoSeries = [{"year":"2022","title":"Structure taking shape","intro":"Slab preparation, concrete work, masonry and site coordination, documented across the work areas.","initial":0,"photos":[["20220714_120517.jpg","14 Jul 2022","Slab preparation","Formwork, reinforcement, void formers and service pipes set out ahead of concreting."],["20220730_115717.jpg","30 Jul 2022","Concrete slab","Fresh concrete around service penetrations, with masonry rising in the adjoining work area."],["20220823_082534.jpg","23 Aug 2022","Masonry across the site","A wider view of brick walls, openings, stored materials and site access."],["20220824_172109.jpg","24 Aug 2022","Site coordination","Ready-mix trucks and a mobile crane supporting work across the site."],["20220831_081213.jpg","31 Aug 2022","Openings and stair access","Brick walls, concrete lintels, a wide opening and an internal stair visible from the street."],["20220831_081233.jpg","31 Aug 2022","Structural shell","A front view of the brick shell, window opening and concrete beam above the entrance."],["20220831_081237.jpg","31 Aug 2022","Street-facing masonry","A wider elevation showing the stepped building forms and different window openings."]]},{"year":"2021","title":"Details that bring spaces together","intro":"Residential exteriors, groundworks and interior fit-out. The dated views show work at different stages and across different units.","initial":6,"photos":[["20210426_170038.jpg","26 Apr 2021","Kitchen fit-out","Dark cabinetry, light worktops and a central island, with electrical and plumbing fit-off still in progress."],["20210510_121006.jpg","10 May 2021","Exterior works","Rendered two-storey facades, roof finishes and entrance frames, with groundworks still underway."],["Screenshot_20210513-170648_Gallery.jpg","Archive copy","Exterior reference","An additional archive copy of the exterior works view, not a separate progress milestone."],["20210513_171422.jpg","13 May 2021","Foundation work","The site team placing concrete in excavated foundation trenches beside existing structures."],["20210524_115830.jpg","24 May 2021","Paving preparation","Ground preparation and materials being coordinated along the townhouse frontages."],["20210527_160927.jpg","27 May 2021","External finishes","Rendered facades, entrance frames, paving and lawn areas along a row of homes."],["20210527_160940.jpg","27 May 2021","Residential streetscape","A street-level view of the two-storey homes, garage doors, paved driveways and planted verges."]]}];

document.querySelectorAll('[data-journal]').forEach(journal => {
  const series = photoSeries[Number(journal.dataset.journal)];
  journal.querySelectorAll('[data-photo-index]').forEach(button => {
    button.addEventListener('click', () => {
      const photo = series.photos[Number(button.dataset.photoIndex)];
      const image = journal.querySelector('[data-photo-image]');
      const link = journal.querySelector('[data-photo-link]');
      const source = 'assets/projects/' + photo[0];
      image.src = source;
      const base = photo[0].replace(/\.jpg$/i, '');
      image.srcset = 'assets/projects/web/' + base + '-640.webp 640w, assets/projects/web/' + base + '-1280.webp 1280w, assets/projects/web/' + base + '-1920.webp 1920w';
      image.sizes = '(max-width: 760px) calc(100vw - 44px), 1220px';
      image.alt = photo[3];
      link.href = source;
      link.setAttribute('aria-label', 'Open full photograph: ' + photo[2]);
      journal.querySelector('[data-photo-date]').textContent = photo[1];
      journal.querySelector('[data-photo-title]').textContent = photo[2];
      journal.querySelector('[data-photo-description]').textContent = photo[3];
      journal.querySelectorAll('[data-photo-index]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    });
  });
});

document.querySelectorAll('a[href^="#record-"]').forEach(link => {
  link.addEventListener('click', () => {
    const record = document.querySelector(link.getAttribute('href'));
    if (record instanceof HTMLDetailsElement) record.open = true;
  });
});
