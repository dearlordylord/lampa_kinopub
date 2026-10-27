/**
 * Smoke-test: pretends to be a real Lampa runtime, loads kp.js, and verifies
 * that startup runs to completion without throwing. Catches missing methods
 * and incorrect API usage at boot.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(process.env.KP_TEST_PLUGIN || path.join(__dirname, 'docs', 'kp.js'), 'utf8').replace('    /* ---------- public API expected by component ---------- */', '    window.__reviewBuildPlay = toPlayElement; window.__reviewSourceChoice = choice;').replace('  startPlugin();', '  window.__reviewVoiceChips = voiceChipsHtml; window.__reviewCreateSource = kpapi; window.__reviewHlsAudioUrl = hlsAudioUrl; window.__reviewVoiceVisible = isVoiceVisible; window.__reviewVoiceLabel = voiceLabel; window.__reviewFormatForVoice = formatForVoice; window.__reviewVoiceKey = voiceKey;\n  startPlugin();');

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

const videoEvents = {}; const playerEvents = {};
function events(store) { return { follow(name, cb) { (store[name] ||= []).push(cb); } }; }
function emit(store, name, event) { (store[name] || []).forEach(cb => cb(event)); }
let kpComponentRegistered = null;
let manifestSet = null;
let langKeys = [];
let listenerFollow = null;
let settingsAdded = [];
let storage = { kp_token: 'review-token', kp_log_url: 'https://untrusted.example', kp_proxy: 'https://untrusted.example' };
const apiRequests = [];
const xhrRequests = [];
const syncKeys = [];
const mediaRequests = [];
const appliedSubtitles = [];
let activePlay = null;

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
      if (url.includes('/v1/items/media-links?')) { mediaRequests.push({ url, ok, err, network: this }); return; }
      if (url.endsWith('/v1/user')) ok({ user: { username: 'review-user' } });
      else ok({});
    };
    this.quiet = function () {};
    this.native = function () {};
    this.timeout = function () {};
    this.clear = function () { this.cleared = true; };
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
  PlayerVideo: { listener: events(videoEvents) },
  Player: { playdata: () => activePlay, subtitles: subs => appliedSubtitles.push(subs), listener: events(playerEvents), play: () => {}, playlist: () => {}, runas: () => {}, callback: () => {} },
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
const japanese = { index: 2, lang: 'jpn', type: { short_title: 'Original', title: 'Оригинал' }, author: { title: '' } };
const english = { index: 3, lang: 'eng', type: { short_title: '', title: 'Original audio' }, author: { title: '' } };
const russian = { index: 1, lang: 'rus', type: { short_title: 'Dub' } };
const audioFixture = [russian, japanese];
const formatFixture = [{ urls: { hls2: 'https://cdn2cdn.com/single.m3u8', hls: 'https://cdn2cdn.com/multi.m3u8' } }];
// Use the real Lampa hls.js track wrapper: setting enabled calls its private backend.
const appCode = fs.readFileSync(path.join(__dirname, '../lampa-security-review/app.min.js'), 'utf8');
const setupMatch = appCode.match(/  function setupAudioTracks\$1\(\) \{[\s\S]*?\n  \}/);
const hlsBackend = { audioTrack: 0 };
const realTracks = [{ id: 0, lang: 'rus', name: '01. Russian' }, { id: 1, lang: 'jpn', name: '02. Japanese' }];
const trackCtx = vm.createContext({ _hls: hlsBackend, audioTracks$1: () => realTracks });
vm.runInContext(setupMatch[0] + '; setupAudioTracks$1();', trackCtx);
new sandbox.window.__reviewCreateSource({}, { movie: { title: 'Bleach' } });
sandbox.window.__reviewSourceChoice.voice_key = sandbox.window.__reviewVoiceKey(japanese);
const playFixture = { title: 'Bleach', kp: { kind: 'episode', audios: [japanese, russian], files: [{ quality: 720, urls: formatFixture[0].urls }] } };
const japanesePlay = sandbox.window.__reviewBuildPlay(playFixture);
sandbox.window.__reviewSourceChoice.voice_key = sandbox.window.__reviewVoiceKey(russian);
const russianPlay = sandbox.window.__reviewBuildPlay(playFixture);
// Building the remaining playlist must not overwrite the clicked episode's voice.
emit(playerEvents, 'start', japanesePlay);
emit(videoEvents, 'tracks', { tracks: realTracks });
const japaneseActuallySelected = hlsBackend.audioTrack === 1;
emit(playerEvents, 'start', russianPlay);
emit(videoEvents, 'tracks', { tracks: realTracks });
const nextEpisodeRestoresItsVoice = hlsBackend.audioTrack === 0;
emit(playerEvents, 'start', japanesePlay);
hlsBackend.audioTrack = -1;
emit(videoEvents, 'tracks', { tracks: [realTracks[0]] });
const missingJapaneseNotReportedSelected = hlsBackend.audioTrack === -1;
// Real play.error path: a failed multi-audio stream must not fall back to
// the single/default-audio HLS2 URL while keeping Japanese selected in the UI.
const fallbackFixture = { title: 'Bleach', kp: { kind: 'episode', audios: [russian, japanese], files: [{ quality: 720, urls: {
  hls4: 'https://cdn2cdn.com/multi4.m3u8', hls2: 'https://cdn2cdn.com/default-russian.m3u8', hls: 'https://cdn2cdn.com/master-v1a1.m3u8?loc=de'
} }] } };
storage.kp_format = 'hls4';
sandbox.window.__reviewSourceChoice.voice_key = sandbox.window.__reviewVoiceKey(japanese);
const fallbackPlay = sandbox.window.__reviewBuildPlay(fallbackFixture);
const fallbackUrls = [];
fallbackPlay.error(fallbackPlay, url => fallbackUrls.push(url));
const noDefaultAudioFallback = !fallbackUrls.includes(fallbackFixture.kp.files[0].urls.hls2);
const fallbackFormatRecorded = fallbackPlay._kpFormat === 'hls';
const fallbackKeepsJapaneseUrl = fallbackUrls[0] === 'https://cdn2cdn.com/master-v1a2.m3u8?loc=de';
fallbackPlay.error(fallbackPlay, url => fallbackUrls.push(url));
const noFalseUrlAfterExhaustion = fallbackUrls.length === 1;
const singleOnlyFixture = { title: 'Bleach', kp: { kind: 'episode', audios: [russian, japanese], files: [{ quality: 720, urls: { hls2: 'https://cdn2cdn.com/russian.m3u8' } }] } };
const refusesWrongInitialStream = sandbox.window.__reviewBuildPlay(singleOnlyFixture) === null;
sandbox.window.__reviewSourceChoice.voice_key = sandbox.window.__reviewVoiceKey(russian);
const defaultPlay = sandbox.window.__reviewBuildPlay(fallbackFixture);
const defaultFallbacks = [];
defaultPlay.error(defaultPlay, url => defaultFallbacks.push(url));
const russianFallbackPreserved = defaultFallbacks[0] === fallbackFixture.kp.files[0].urls.hls2;
storage.kp_format = 'auto';
// CDNServices' published legacy-HLS protocol selects audio in the pathname.
// A player track setter cannot select a second audio inside a one-audio URL.
storage.kp_format = 'hls';
sandbox.window.__reviewSourceChoice.voice_key = sandbox.window.__reviewVoiceKey(japanese);
const directFixture = { title: 'Bleach', kp: { kind: 'episode', audios: [russian, japanese], files: [
  { quality: 720, urls: { hls: 'https://cdn2cdn.com/signed-path/master-v1a1.m3u8?access=TEST&loc=de' } },
  { quality: 480, urls: { hls: 'https://cdn2cdn.com/low/master-v1a1.m3u8?access=TEST&loc=de' } }
] } };
const directJapanese = sandbox.window.__reviewBuildPlay(directFixture);
const dedicatedJapaneseUrl = directJapanese.url === 'https://cdn2cdn.com/signed-path/master-v1a2.m3u8?access=TEST&loc=de';
const qualityKeepsJapanese = Object.values(directJapanese.quality).every(url => url.includes('/master-v1a2.m3u8?'));
storage.kp_format = 'auto';
const checks = [
  ['Fallback HLS URL also carries selected Japanese audio', fallbackKeepsJapaneseUrl],
  ['Dedicated HLS audio bypasses opaque native track toggling', directJapanese._kpVoice.viaUrl === true],
  ['Audio URL selection never rewrites a signed query value', sandbox.window.__reviewHlsAudioUrl('https://cdn2cdn.com/video.m3u8?next=/master-v1a1.m3u8', 2) === 'https://cdn2cdn.com/video.m3u8?next=/master-v1a1.m3u8'],
  ['Invalid audio indices leave stream URLs unchanged', sandbox.window.__reviewHlsAudioUrl('https://cdn2cdn.com/master-v1a1.m3u8', 0) === 'https://cdn2cdn.com/master-v1a1.m3u8'],
  ['Legacy HLS requests Japanese by changing only the audio pathname', dedicatedJapaneseUrl],
  ['Every quality URL preserves selected Japanese audio', qualityKeepsJapanese],
  ['Diagnostic stream format follows actual fallback', fallbackFormatRecorded],
  ['No false URL is loaded after fallback exhaustion', noFalseUrlAfterExhaustion],
  ['Initial stream cannot silently substitute default Russian for Japanese', refusesWrongInitialStream],
  ['Default Russian still has its working HLS2 fallback', russianFallbackPreserved],
  ['Japanese playback cannot silently fall back to default Russian HLS2', noDefaultAudioFallback],
  ['Play element uses multi-audio stream and carries Japanese metadata', japanesePlay.url === formatFixture[0].urls.hls && japanesePlay._kpVoice.lang === 'jpn' && japanesePlay._kpVoice.index === 2],
  ['Player receives actual tracks rather than a synthetic Japanese label', !japanesePlay.voiceovers && !japanesePlay.translate],
  ['Each episode applies its own pending voice on actual player start', nextEpisodeRestoresItsVoice],
  ['Missing Japanese cannot switch a Russian-only stream', missingJapaneseNotReportedSelected],
  ['Reordered API audio still chooses multi-audio HLS', sandbox.window.__reviewFormatForVoice('hls2', formatFixture, [japanese, russian], sandbox.window.__reviewVoiceKey(japanese)) === 'hls'],
  ['Selecting Japanese invokes real Lampa track setter even when API order differs', japaneseActuallySelected],
  ['Selecting Japanese uses available multi-audio HLS instead of HLS2', sandbox.window.__reviewFormatForVoice('hls2', formatFixture, audioFixture, sandbox.window.__reviewVoiceKey(japanese)) === 'hls'],
  ['Default Russian keeps stable HLS2', sandbox.window.__reviewFormatForVoice('hls2', formatFixture, audioFixture, sandbox.window.__reviewVoiceKey(russian)) === 'hls2'],
  ['Explicit HLS4 preference is preserved', sandbox.window.__reviewFormatForVoice('hls4', formatFixture, audioFixture, sandbox.window.__reviewVoiceKey(japanese)) === 'hls4'],
  ['Japanese original remains selectable without exact Orig marker', sandbox.window.__reviewVoiceVisible(japanese, 'sidebar')],
  ['English audio remains selectable without exact Orig marker', sandbox.window.__reviewVoiceVisible(english, 'sidebar')],
  ['Japanese original appears on episode cards', sandbox.window.__reviewVoiceVisible(japanese, 'card')],
  ['Audio labels identify the language', /JPN/.test(sandbox.window.__reviewVoiceLabel(japanese)) && /ENG/.test(sandbox.window.__reviewVoiceLabel(english))],
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


try {
  const assert = require('node:assert/strict');
  const urls = Array.from({ length: 5 }, (_, i) => ({ lang: i < 3 ? 'eng' : 'rus', url: 'https://cdn2cdn.com/episode2-' + i + '.srt' }));
  function episode(mediaId, subtitles) {
    return sandbox.window.__reviewBuildPlay(Object.assign({}, playFixture, {
      kp: Object.assign({}, playFixture.kp, { mediaId, subtitles: subtitles || [] })
    }));
  }
  function ready(play) { activePlay = play; emit(playerEvents, 'ready', play); }
  storage.kp_subtitles_enabled = true;
  const second = episode(1037632);
  const originalUrl = second.url;
  const originalVoice = second._kpVoice;
  ready(second);
  assert.equal(mediaRequests.length, 1, 'empty episode metadata must request canonical media subtitles');
  assert.equal(second._kpMediaId, 1037632, 'real media ID reaches the play item');
  assert.equal(mediaRequests[0].url, 'https://api.service-kp.com/v1/items/media-links?mid=1037632');
  mediaRequests[0].ok({ subtitles: urls });
  assert.equal(appliedSubtitles.at(-1).length, 5, 'Ludwig episode 2 exposes all five canonical subtitle tracks');
  assert.equal(second.subtitles.length, 5);
  assert.equal(second.url, originalUrl, 'subtitle hydration never changes the stream URL');
  assert.equal(second._kpVoice, originalVoice, 'subtitle hydration never changes audio selection');
  pass++;
  console.log('OK   empty episode-2 metadata resolves five canonical subtitle tracks');

  const first = episode(1037581);
  ready(first);
  const stale = mediaRequests.at(-1);
  const next = episode(1037632);
  ready(next);
  const current = mediaRequests.at(-1);
  const before = appliedSubtitles.length;
  stale.ok({ subtitles: urls });
  assert.equal(appliedSubtitles.length, before, 'late episode-1 response cannot overwrite episode 2');
  assert.equal(stale.network.cleared, true);
  current.ok({ subtitles: urls });
  assert.equal(appliedSubtitles.length, before + 1, 'next-episode ready resolves its own tracks');
  pass++;
  console.log('OK   next-episode hydration rejects stale responses');

  ready(episode(1037632));
  const destroyed = mediaRequests.at(-1);
  emit(playerEvents, 'destroy', {});
  const count = appliedSubtitles.length;
  destroyed.ok({ subtitles: urls });
  assert.equal(appliedSubtitles.length, count);
  assert.equal(destroyed.network.cleared, true);
  const requestsBeforeSkip = mediaRequests.length;
  ready(episode(1037581, urls.slice(0, 2)));
  ready({ url: 'https://cdn2cdn.com/other.m3u8' });
  ready(episode('1_2'));
  storage.kp_subtitles_enabled = false;
  ready(episode(1037632));
  assert.equal(mediaRequests.length, requestsBeforeSkip, 'existing subtitles, non-KP items, synthetic IDs and disabled setting skip requests');
  storage.kp_subtitles_enabled = true;
  ready(episode(1037632));
  storage.kp_subtitles_enabled = false;
  mediaRequests.at(-1).ok({ subtitles: urls });
  assert.equal(appliedSubtitles.length, count, 'setting is checked again after the response');
  storage.kp_subtitles_enabled = true;
  for (const invalid of [{}, { subtitles: [] }, { subtitles: 'not an array' }, { subtitles: [null, { lang: 'eng' }] }]) {
    ready(episode(1037632));
    mediaRequests.at(-1).ok(invalid);
    assert.equal(appliedSubtitles.length, count, 'empty or malformed replies leave playback alone');
  }
  ready(episode(1037632));
  mediaRequests.at(-1).err({ status: 500 }, 'error');
  assert.equal(appliedSubtitles.length, count, 'failed request leaves playback alone');
  assert(apiRequests.every(r => r.url.startsWith('https://api.service-kp.com/') && r.headers.Authorization === 'Bearer review-token'));
  pass++;
  console.log('OK   hydration respects destroy, setting, existing tracks, invalid IDs and API failures');
} catch (error) {
  fail++;
  console.error('FAIL episode subtitle hydration:', error.stack || error);
}

console.log(`\n=== ${pass} pass, ${fail} fail ===`);
process.exit(fail ? 1 : 0);
