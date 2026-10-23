/**
 * Smoke-test: pretends to be a real Lampa runtime, loads kp.js, and verifies
 * that startup runs to completion without throwing. Catches missing methods
 * and incorrect API usage at boot.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(process.env.KP_TEST_PLUGIN || path.join(__dirname, 'docs', 'kp.js'), 'utf8').replace('  startPlugin();', '  window.__reviewVoiceChips = voiceChipsHtml;\n  startPlugin();');

// jQuery-ish sham — the plugin only uses $('<...>'), .on, .find, .append, .text,
// and as a function that returns a thenable-free wrapper.
function makeJq() {
  function $$(input) {
    const o = {
      _children: [],
      length: 1,
      0: {},
      find: () => $$(),
      on: function () { return this; },
      append: function () { return this; },
      after: function () { return this; },
      remove: () => undefined,
      addClass: function () { return this; },
      hasClass: () => false,
      text: function () { return this; },
      first: function () { return this; },
      trigger: function () { return this; }
    };
    return o;
  }
  return $$;
}

const $ = makeJq();

let kpComponentRegistered = null;
let manifestSet = null;
let langKeys = [];
let listenerFollow = null;
let settingsAdded = [];
let storage = { kp_token: 'review-token', kp_log_url: 'https://untrusted.example', kp_proxy: 'https://untrusted.example' };
const apiRequests = [];
const xhrRequests = [];
const syncKeys = [];

const Lampa = {
  Manifest: {
    app_digital: 200,
    set plugins(v) { manifestSet = v; },
    get plugins() { return [manifestSet].filter(Boolean); }
  },
  Storage: {
    get: (k, d) => (k in storage ? storage[k] : d),
    set: (k, v) => { storage[k] = v; },
    cache: (k, _life, def) => { if (!(k in storage)) storage[k] = def; return storage[k]; },
    sync: (key) => { syncKeys.push(key); },
    field: (k) => storage[k],
    remove: () => {}
  },
  Reguest: function () {
    this.silent = function (url, ok, err, body, params) {
      apiRequests.push({ url, body, headers: params && params.headers });
      if (url.endsWith('/v1/user')) ok({ user: { username: 'review-user' } });
      else ok({});
    };
    this.quiet = function () {};
    this.native = function () {};
    this.timeout = function () {};
    this.clear = function () {};
    this.errorDecode = function () { return ''; };
  },
  Utils: {
    uid: (n) => 'u'.repeat(n || 8),
    hash: (s) => 'h_' + (s || '').length,
    addUrlComponent: (url, c) => url + (url.includes('?') ? '&' : '?') + c,
    secondsToTime: () => '0:00',
    parseTime: () => ({ full: '' }),
    capitalizeFirstLetter: (s) => s,
    cardImgBackgroundBlur: () => '',
    copyTextToClipboard: () => {}
  },
  Lang: {
    add: (obj) => { langKeys = langKeys.concat(Object.keys(obj)); },
    translate: (k) => k
  },
  Listener: { follow: (name, cb) => { if (name === 'full') listenerFollow = { name, cb }; } },
  Manifest_set: null,
  Component: {
    add: (name, cls) => { if (name === 'online_kp') kpComponentRegistered = cls; },
    create: () => ({})
  },
  Activity: {
    push: () => {},
    replace: () => {},
    active: () => ({ activity: {} })
  },
  Modal: { open: () => {}, close: () => {} },
  Controller: { enabled: () => ({ name: 'content' }), toggle: () => {}, add: () => {}, enable: () => {}, collectionSet: () => {}, collectionFocus: () => {} },
  Background: { immediately: () => {} },
  Template: { add: () => {}, get: () => $('<div></div>') },
  TMDB: { key: () => 'k', api: (u) => u, image: () => '' },
  Player: { play: () => {}, playlist: () => {}, runas: () => {}, callback: () => {} },
  Platform: { is: (n) => n === 'browser', tv: () => false, mouse: () => true, screen: () => 'mobile', any: () => true },
  Scroll: function () { this.render = () => $(); this.body = () => $(); this.minus = () => {}; this.append = () => {}; this.update = () => {}; this.clear = () => {}; this.destroy = () => {}; },
  Explorer: function () { this.render = () => $(); this.appendFiles = () => {}; this.appendHead = () => {}; this.destroy = () => {}; },
  Filter: function () { this.render = () => $(); this.onSearch = null; this.onBack = null; this.onSelect = null; this.set = () => {}; this.chosen = () => {}; this.show = () => {}; this.addButtonBack = () => {}; },
  Arrays: { extend: (a, b) => Object.assign(a, b), remove: (a, v) => { const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); } },
  Select: { show: () => {}, close: () => {} },
  Helper: { show: () => {} },
  Timeline: { view: () => ({ percent: 0, time: 0, duration: 0 }), render: () => $(), update: () => {} },
  Account: { logged: () => false, subscribeToTranslation: () => {} },
  Favorite: { add: () => {} },
  Noty: { show: () => {} },
  SettingsApi: {
    addComponent: (c) => { settingsAdded.push({ kind: 'component', ...c }); },
    addParam: (p) => { settingsAdded.push({ kind: 'param', name: p.param.name }); }
  }
};

const Navigator = { canmove: () => false, move: () => {} };

const sandbox = {
  window: { addEventListener: () => {} },
  document: {},
  navigator: { userAgent: 'node-smoke' },
  console: { ...console },
  setTimeout, clearTimeout, setInterval, clearInterval,
  $, Lampa, Navigator,
  XMLHttpRequest: function () {
    this.open = (method, url) => { xhrRequests.push({ method, url }); };
    this.setRequestHeader = () => {};
    this.send = () => { this.status = 200; this.responseText = '{}'; if (this.onload) this.onload(); };
    this.abort = () => {};
  }
};
sandbox.window.Lampa = Lampa;
sandbox.window.navigator = sandbox.navigator;
sandbox.global = sandbox;

const ctx = vm.createContext(sandbox);

let ok = true;
try {
  vm.runInContext(code, ctx, { filename: 'kp.js' });
} catch (e) {
  console.error('!!! kp.js threw at boot:', e && e.stack || e);
  ok = false;
}

const maliciousVoiceHtml = sandbox.window.__reviewVoiceChips([{ lang: 'rus', type: { short_title: '<img src=x onerror=alert(1)>', title: 'Dub' } }], '', '', false);
const checks = [
  ['voice labels cannot inject HTML tags', maliciousVoiceHtml.includes('&lt;img') && !maliciousVoiceHtml.includes('<img')],
  ['no background author proxy or remote logging requests', xhrRequests.length === 0],
  ['no credential-bearing API calls via a saved third-party proxy', apiRequests.length > 0 && apiRequests.every(r => r.url.startsWith('https://api.service-kp.com/'))],
  ['Bearer token only in header', apiRequests.every(r => !r.url.includes('review-token') && r.headers.Authorization === 'Bearer review-token')],
  ['no CUB voice sync registration', !syncKeys.includes('online_choice_kpapi')],
  ['manifest set', !!manifestSet],
  ['manifest type=video', manifestSet && manifestSet.type === 'video'],
  ['manifest component=online_kp', manifestSet && manifestSet.component === 'online_kp'],
  ['onContextMenu fn', manifestSet && typeof manifestSet.onContextMenu === 'function'],
  ['onContextLauch fn', manifestSet && typeof manifestSet.onContextLauch === 'function'],
  ['component registered', !!kpComponentRegistered],
  ['component is constructor', typeof kpComponentRegistered === 'function'],
  ['lang keys >= 10', langKeys.length >= 10],
  ['kp_watch translation present', langKeys.includes('kp_watch')],
  ['listener follow=full', listenerFollow && listenerFollow.name === 'full'],
  ['listener has cb', listenerFollow && typeof listenerFollow.cb === 'function'],
  ['settings component added', settingsAdded.some((s) => s.kind === 'component')],
  ['remote logging control removed', !settingsAdded.some((s) => s.kind === 'param' && s.name === 'kp_log_url')],
  ['settings has max quality', settingsAdded.some((s) => s.kind === 'param' && s.name === 'kp_max_quality')],
  ['settings has format', settingsAdded.some((s) => s.kind === 'param' && s.name === 'kp_format')],
  ['settings has login', settingsAdded.some((s) => s.kind === 'param' && s.name === 'kp_action_login')],
  ['default max_quality stored', storage['kp_max_quality'] === '1080'],
  ['default format stored', storage['kp_format'] === 'auto']
];

let pass = 0, fail = 0;
for (const [name, val] of checks) {
  if (val) { pass++; console.log('OK  ', name); }
  else     { fail++; console.error('FAIL', name); }
}

// Try invoking the listener with a fake card to ensure button mount path runs
if (listenerFollow && listenerFollow.cb) {
  try {
    listenerFollow.cb({
      type: 'complite',
      data: { movie: { id: 1, title: 'Movie', original_title: 'Movie', name: '' } },
      object: { activity: { render: () => $() } }
    });
    console.log('OK   listener.cb runs without throwing');
    pass++;
  } catch (e) {
    console.error('FAIL listener.cb threw:', e.stack || e);
    fail++;
  }
}

// Try instantiating the component class
if (kpComponentRegistered) {
  try {
    const inst = new kpComponentRegistered({ movie: { id: 1, title: 'X', original_title: 'X' } });
    inst.activity = { loader: () => {}, toggle: () => {} };
    console.log('OK   component instantiates');
    pass++;
  } catch (e) {
    console.error('FAIL component ctor threw:', e.stack || e);
    fail++;
  }
}

if (xhrRequests.length !== 0) { console.error('FAIL remote requests after card open'); fail++; }

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail ? 1 : 0);
