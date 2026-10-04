import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { stat, open } from 'node:fs/promises';
import { createWebsiteServer } from '../server.mjs';

test('the new team portrait is available in both responsive sizes', async () => {
  for (const width of [480, 960]) {
    const { size } = await stat(new URL(`../assets/portrait-03-${width}.webp`, import.meta.url));
    assert.ok(size > 0 && size < 25 * 1024 * 1024);
  }
});

test('all imported photo variants and videos fit the static asset limit', async () => {
  const files = ['site-film-1.mp4', 'site-film-2.mp4'];
  for (let number = 1; number <= 39; number++) {
    const id = String(number).padStart(2, '0');
    files.push(`photo-${id}-480.webp`, `photo-${id}-1600.webp`);
  }
  for (const file of files) {
    const { size } = await stat(new URL(`../assets/site-media/${file}`, import.meta.url));
    assert.ok(size > 0 && size <= 25 * 1024 * 1024, `${file} must be a nonempty, deployable asset`);
  }
});

test('serves video metadata and seekable byte ranges', async () => {
  const file = new URL('../assets/site-media/site-film-1.mp4', import.meta.url);
  const { size } = await stat(file);
  const handle = await open(file);
  const expected = Buffer.alloc(1024);
  await handle.read(expected, 0, 1024, 0);
  await handle.close();
  const server = createWebsiteServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/assets/site-media/site-film-1.mp4`;
  try {
    const metadata = await fetch(url, { method: 'HEAD' });
    assert.equal(metadata.status, 200);
    assert.equal(metadata.headers.get('content-type'), 'video/mp4');
    assert.equal(metadata.headers.get('content-length'), String(size));
    assert.equal(metadata.headers.get('accept-ranges'), 'bytes');
    const part = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 0-1023/${size}`);
    assert.deepEqual(Buffer.from(await part.arrayBuffer()), expected);
    const suffix = await fetch(url, { headers: { Range: 'bytes=-128' } });
    assert.equal(suffix.status, 206);
    assert.equal((await suffix.arrayBuffer()).byteLength, 128);
    const invalid = await fetch(url, { headers: { Range: `bytes=${size}-` } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), `bytes */${size}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
