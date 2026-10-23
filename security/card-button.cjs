// Isolated DOM regression; no browser, account or outbound requests.
// npm install --prefix /tmp/lampa-domtest --ignore-scripts jsdom@26.1.0
// NODE_PATH=/tmp/lampa-domtest/node_modules node security/card-button.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/full-card.html'), 'utf8');
const dom = new JSDOM('<!doctype html><body><main>' + fixture + '</main></body>', { url: 'https://test.invalid/lampa/', runScripts: 'outside-only' });
const w = dom.window;
w.eval(fs.readFileSync(path.join(__dirname, '../../lampa-security-review/vender/jquery/jquery.js'), 'utf8'));
let full, Component, currentFilter;
const sourceCalls = [];
const noopSource = { searchByTitle() {}, extendChoice() {}, filter(...args) { sourceCalls.push(args); } };
const storage = {};
const noop = () => {};
w.Lampa = {
  Manifest: { app_digital: 338 },
  Storage: { get: (k, d) => k in storage ? storage[k] : d, set: (k, v) => { storage[k] = v; }, cache: (k, t, d) => d },
  Utils: { uid: () => 'test', hash: String },
  Platform: { is: () => false },
  Lang: { add: noop, translate: x => x },
  Template: { add: noop, get: () => '' }, Component: { add: (name, cls) => { if (name === 'online_kp') Component = cls; } },
  Reguest: function () { this.clear = noop; this.timeout = noop; this.silent = noop; },
  Arrays: { extend: (target, source) => Object.assign(target, source) },
  Scroll: function () { this.render = () => w.$('<div>'); this.body = this.render; this.minus = noop; },
  Explorer: function () { this.appendFiles = noop; this.appendHead = noop; this.render = () => w.$('<div>'); },
  Filter: function () { currentFilter = this; this.items = []; this.set = (name, items) => { this.items = items; }; this.render = () => w.$('<div>'); this.chosen = noop; },
  Listener: { follow: (name, cb) => { if (name === 'full') full = cb; } },
  SettingsApi: { addComponent: noop, addParam: noop }
};
w.eval(fs.readFileSync(path.join(__dirname, '../docs/kp.js'), 'utf8'));
assert.equal(typeof full, 'function');
const event = { type: 'complite', data: { movie: { id: 30984, name: 'Bleach' } }, body: w.$('main'), link: { activity: { render: () => w.$('main') } }, object: { id: 30984, method: 'tv' } };
full(event);
let button = [...w.document.querySelectorAll('.full-start__button')].find(x => x.textContent.trim() === 'KinoPub');
assert.ok(button, 'KinoPub source button exists');
for (let node = button; node && node.nodeType === 1; node = node.parentElement) {
  assert.notEqual(w.getComputedStyle(node).display, 'none', 'KinoPub must not be inserted into the hidden source group');
}
full(event);
assert.equal([...w.document.querySelectorAll('.full-start__button')].filter(x => x.textContent.trim() === 'KinoPub').length, 1, 'repeated full event must not duplicate the button');
const instance = new Component({ movie: { id: 30984, name: 'Bleach' } });
instance.activity = { loader: noop, toggle: noop };
instance.createSource = () => noopSource;
instance.initialize();
instance.filter({ season: ['Season 1'], voice: ['RUS · DUB · Mega-Anime', 'JPN · Orig'], voice_keys: ['ru', 'jp'] }, { season: 0, voice: 0 });
const japanese = currentFilter.items.find(item => item.voice_pick && item.title.includes('JPN'));
assert.ok(japanese, 'Japanese track must be reachable in the pre-play filter UI');
currentFilter.onSelect('filter', japanese);
assert.equal(sourceCalls.length, 1);
assert.equal(sourceCalls[0][1].stype, 'voice');
assert.equal(sourceCalls[0][2].index, 1);
console.log('KinoPub has one visible primary card button, and Japanese audio can be selected before playback.');
w.close();
