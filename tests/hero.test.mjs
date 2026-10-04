import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../script.js', import.meta.url), 'utf8');

function heroHarness(reducedMotion = false, decode = () => Promise.resolve()) {
  const classes = new Set();
  const events = new Map();
  const preferenceEvents = new Map();
  const preference = {
    matches: reducedMotion,
    addEventListener: (name, handler) => preferenceEvents.set(name, handler),
  };
  let restarts = 0;
  const hero = {
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
    },
    querySelectorAll: () => [{ decode }, { decode }],
    get offsetWidth() { restarts++; return 1440; },
  };
  runInNewContext(source, {
    document: {
      documentElement: { classList: { add() {} } },
      querySelector: selector => selector === '[data-hero-reveal]' ? hero : null,
      querySelectorAll: () => [],
    },
    window: {
      matchMedia: () => preference,
      addEventListener: (name, handler) => events.set(name, handler),
    },
  });
  return { classes, events, preferenceEvents, preference, restarts: () => restarts };
}

test('hero starts after the photos decode and replays on each pageshow', async () => {
  const hero = heroHarness();
  assert.ok(hero.classes.has('is-preparing'));
  await hero.events.get('pageshow')({ persisted: false });
  assert.ok(hero.classes.has('is-revealing'));
  assert.ok(!hero.classes.has('is-preparing'));
  await hero.events.get('pageshow')({ persisted: true });
  assert.ok(hero.classes.has('is-revealing'));
  assert.equal(hero.restarts(), 2);
});

test('reduced-motion visitors receive the finished hero without animation', async () => {
  const hero = heroHarness(true);
  await hero.events.get('pageshow')({ persisted: false });
  assert.equal(hero.classes.size, 0);
  assert.equal(hero.restarts(), 0);
});

test('enabling reduced motion cancels a pending reveal', async () => {
  let finishDecode;
  const pending = new Promise(resolve => { finishDecode = resolve; });
  const hero = heroHarness(false, () => pending);
  const reveal = hero.events.get('pageshow')({ persisted: false });
  hero.preference.matches = true;
  hero.preferenceEvents.get('change')();
  finishDecode();
  await reveal;
  assert.equal(hero.classes.size, 0);
  assert.equal(hero.restarts(), 0);
});

test('responsive before and after hero assets are present', async () => {
  for (const stage of ['before', 'after']) {
    for (const width of [640, 1280, 1672]) {
      const { size } = await stat(new URL(`../assets/hero/${stage}-${width}.webp`, import.meta.url));
      assert.ok(size > 0 && size < 25 * 1024 * 1024);
    }
  }
});
