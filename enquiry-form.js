(() => {
  const form = document.querySelector('[data-enquiry-form]');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const verificationStatus = form.querySelector('[data-verification-status]');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'verification-retry';
  retry.textContent = 'Retry security check';
  retry.hidden = true;
  verificationStatus.after(retry);
  let siteKey = '';
  let sending = false;
  let initialization;
  const service = form.elements.namedItem('service');
  const requested = new URLSearchParams(window.location.search).get('service');
  if (requested && [...service.options].some(option => option.value === requested)) service.value = requested;

  const updateSubmit = () => { submit.disabled = sending || !siteKey; };
  const verificationFailed = (message) => {
    siteKey = '';
    updateSubmit();
    verificationStatus.textContent = message;
    retry.hidden = false;
  };
  function loadRecaptcha(key) {
    if (window.grecaptcha) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Security check did not load. Please retry or contact us directly.'));
      }, 15_000);
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
      script.async = true;
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Security check could not load. Please retry or contact us directly.'));
      };
      document.head.append(script);
    });
  }

  async function initialize() {
    siteKey = '';
    updateSubmit();
    retry.hidden = true;
    verificationStatus.textContent = 'Preparing secure form...';
    try {
      const response = await fetch('/api/enquiry/config', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const config = await response.json().catch(() => {
        throw new Error('Online enquiries are unavailable. Please email or call us directly.');
      });
      if (!response.ok || !config.siteKey) throw new Error(config.error || 'Online enquiries are unavailable. Please email or call us directly.');
      await loadRecaptcha(config.siteKey);
      if (!window.grecaptcha?.ready || !window.grecaptcha?.execute) throw new Error('Security check could not start. Please retry.');
      await new Promise(resolve => window.grecaptcha.ready(resolve));
      siteKey = config.siteKey;
      verificationStatus.textContent = '';
      updateSubmit();
    } catch (error) {
      verificationFailed(error.name === 'TimeoutError' ? 'The form is taking too long to load. Please retry or contact us directly.' : error.message);
    }
  }

  retry.addEventListener('click', () => {
    if (sending || initialization) return;
    initialization = initialize().finally(() => { initialization = undefined; });
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    if (!siteKey) return;
    sending = true;
    updateSubmit();
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your enquiry...';
    try {
      // v3 tokens are short-lived; request one only after the visitor submits.
      const token = await window.grecaptcha.execute(siteKey, { action: 'enquiry' });
      if (!token) throw new Error('Security check could not be completed. Please try again.');
      const fields = Object.fromEntries(new FormData(form));
      fields['g-recaptcha-response'] = token;
      const response = await fetch('/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields), signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json().catch(() => {
        throw new Error('We could not confirm your enquiry was sent. Please retry or contact us directly.');
      });
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'We could not confirm your enquiry was sent. Please retry or contact us directly.');
      status.textContent = 'Thanks. Your enquiry has been sent to L3 Group.';
      form.reset();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error.name === 'TypeError'
        ? 'We could not confirm your enquiry was sent. Your details are still here. Please retry or email inquiries@l3group.co.za.'
        : error.message;
    } finally {
      sending = false;
      form.removeAttribute('aria-busy');
      updateSubmit();
    }
  });
  initialization = initialize().finally(() => { initialization = undefined; });
})();
