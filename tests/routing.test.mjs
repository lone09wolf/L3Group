import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createWebsiteServer } from '../server.mjs';

test('clean routes, legacy links and contact query strings remain usable', async () => {
  const server = createWebsiteServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const slug of ['/', '/about', '/services', '/projects', '/portfolio', '/contact', '/projects/residential', '/projects/building-works', '/projects/civil-works']) {
      const response = await fetch(base + slug, { redirect: 'manual' });
      assert.equal(response.status, 200, slug);
      assert.match(response.headers.get('content-type'), /text\/html/);
    }
    for (const [from, to, status] of [
      ['/index.html', '/', 301], ['/contact.html?service=Renovations', '/contact?service=Renovations', 301],
      ['/projects/2021.html', '/projects/residential', 301], ['/projects/2022', '/projects/building-works', 301],
      ['/services/', '/services', 301],
    ]) {
      const response = await fetch(base + from, { redirect: 'manual' });
      assert.equal(response.status, status, from);
      assert.equal(response.headers.get('location'), to);
    }
    for (const missing of ['/missing-page', '/assets/missing.webp', '/.git/config', '/tests/routing.test.mjs']) {
      const response = await fetch(base + missing);
      assert.equal(response.status, 404, missing);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    }
    for (const [asset, type] of [['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml'], ['/assets/hero/before-640.avif', 'image/avif'], ['/assets/fonts/manrope-latin.woff2', 'font/woff2'], ['/assets/l3-group-company-portfolio.pdf', 'application/pdf']]) {
      const response = await fetch(base + asset, { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type').startsWith(type));
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
