// Runs the reviewed socket module against an in-memory socket, never a network.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.argv[2];
if (!root) throw new Error('Pass the path to the reviewed yumata/lampa checkout');
const built = fs.readFileSync(root + '/app.min.js', 'utf8');
const start = built.indexOf('  var terminal_access = false;');
const end = built.indexOf('\n  var Socket =', start);
assert.ok(start > 0 && end > start, 'Expected reviewed build socket layout');
// Keep the original declarations (including terminal_access) and actual handler.
const prefix = built.lastIndexOf('  var socket;', start);
assert.ok(prefix > 0);
const code = built.slice(prefix, end);
const messages = [];
let socket;
const noop = () => {};
const context = vm.createContext({
  window: { lampa_settings: { socket_use: true, socket_methods: true } },
  navigator: { userAgent: 'local-review' }, console: { log: noop },
  setTimeout: noop, clearTimeout: noop,
  WebSocket: class { constructor() { socket = this; this.handlers = {}; this.readyState = 1; } addEventListener(name, fn) { this.handlers[name] = fn; } send(value) { messages.push(JSON.parse(value)); } },
  Utils$1: { uid: () => 'test-device', capitalizeFirstLetter: x => x },
  Subscribe$2: () => ({ send: noop }), Storage: { get: (key, fallback) => fallback, field: () => 'Review TV' },
  Platform: { is: () => false, get: () => 'tizen' }, object$2: { soc_mirrors: ['invalid.example'] },
  Markers: { pass: noop }, Timer: { add: noop }, Arrays: { isObject: x => x && typeof x === 'object', isArray: Array.isArray },
  Account$1: { hasPremium: () => false },
});
vm.runInContext(code, context);
vm.runInContext('connect$1()', context);
assert.ok(socket, 'socket created only in memory');
socket.handlers.message({ data: JSON.stringify({ method: 'terminal_eval', data: { code: '', eval: 'globalThis.reviewMarker = 42' } }) });
assert.equal(context.reviewMarker, 42, 'Empty terminal code permits server-delivered JavaScript in the reviewed upstream build');
assert.ok(messages.some(m => m.method === 'terminal_result'));
console.log('CONFIRMED in reviewed upstream build: server-delivered terminal_eval runs with empty code. No real network, account, filesystem mutation or external code used.');
