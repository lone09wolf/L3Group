(() => {
  const form = document.querySelector('[data-enquiry-form]');
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  const verificationStatus = form.querySelector('[data-verification-status]');
  const container = form.querySelector('[data-form-verification]');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'verification-retry';
  retry.textContent = 'Retry security check';
  retry.hidden = true;
  verificationStatus.after(retry);
  let token = '';
  let sending = false;
  let widgetId;
  let initialization;
  const service = form.elements.namedItem('service');
  const requested = new URLSearchParams(window.location.search).get('service');
  if (requested && [...service.options].some(option => option.value === requested)) service.value = requested;

  const updateSubmit = () => { submit.disabled = sending || !token; };
  const verificationFailed = (message) => {
    token = '';
    updateSubmit();
    verificationStatus.textContent = message;
    retry.hidden = false;
  };
  const resetVerification = () => {
    token = '';
    updateSubmit();
    if (widgetId !== undefined && window.turnstile) {
      verificationStatus.textContent = 'Refreshing security check...';
      retry.hidden = true;
      try { window.turnstile.reset(widgetId); }
      catch { verificationFailed('Please retry the security check.'); }
    }
  };

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Security check did not load. Please retry or contact us directly.'));
      }, 15_000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
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
    token = '';
    updateSubmit();
    retry.hidden = true;
    verificationStatus.textContent = 'Loading security check...';
    try {
      const response = await fetch('/api/enquiry/config', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const config = await response.json().catch(() => {
        throw new Error('Online enquiries are unavailable. Please email or call us directly.');
      });
      if (!response.ok || !config.siteKey) throw new Error(config.error || 'Online enquiries are unavailable. Please email or call us directly.');
      await loadTurnstile();
      if (widgetId !== undefined) window.turnstile.remove(widgetId);
      widgetId = window.turnstile.render(container, {
        sitekey: config.siteKey, action: 'enquiry', theme: 'dark',
        size: window.matchMedia('(max-width: 380px)').matches ? 'compact' : 'flexible',
        'response-field': false,
        callback: (value) => {
          token = value;
          updateSubmit();
          verificationStatus.textContent = 'Security check complete.';
          retry.hidden = true;
        },
        'expired-callback': () => verificationFailed('Security check expired. Please verify again.'),
        'timeout-callback': () => verificationFailed('Security check timed out. Please verify again.'),
        'error-callback': () => {
          verificationFailed('Security check could not be completed. Please retry or contact us directly.');
          return true;
        },
      });
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
    if (!token) {
      verificationFailed('Please complete the security check before sending.');
      return;
    }
    const fields = Object.fromEntries(new FormData(form));
    fields['cf-turnstile-response'] = token;
    sending = true;
    updateSubmit();
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Sending your enquiry...';
    try {
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
      resetVerification();
    }
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && !sending) resetVerification();
  });
  initialization = initialize().finally(() => { initialization = undefined; });
})();
