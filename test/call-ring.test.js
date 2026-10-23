"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("vm");

const LINK = path.join(__dirname, "..", "link.js");
const OLD_RING = "B.rk=new A.aU(2e7)";
const OLD_RACE = "A.vcomRace=function(fut,ms){var zone=$.ad,comp=new A.bi(new A.au(zone,t.U),t.R),done=!1\nfunction finish(){if(done)return\ndone=!0\nvar prev=$.ad\n$.ad=zone\ntry{J.b4x(comp)}catch(e){}finally{$.ad=prev}}\nif(fut&&typeof fut.a===\"number\"&&fut.a>3){finish()\nreturn comp.a}var left=ms\nfunction watch(){if(done)return\nif(fut&&typeof fut.a===\"number\"&&fut.a>3){finish()\nreturn}left-=200\nif(left>0)setTimeout(watch,200)\nelse finish()}setTimeout(watch,200)\nreturn comp.a}";

function el() {
  const node = {
    tagName: "DIV",
    style: {},
    classList: { add: function () {}, remove: function () {} },
    hidden: true,
    innerHTML: "",
    textContent: "",
    id: "",
    value: "",
    isConnected: true,
    children: [],
    listeners: {},
    setAttribute: function () {},
    getAttribute: function () { return ""; },
    appendChild: function (c) { this.children.push(c); return c; },
    replaceChildren: function () { this.children = []; },
    querySelector: function () { return el(); },
    querySelectorAll: function () { return []; },
    addEventListener: function (t, fn) {
      (this.listeners[t] || (this.listeners[t] = [])).push(fn);
    },
    remove: function () {}
  };
  return node;
}

function loadLink() {
  const sandbox = {
    location: { search: "", pathname: "/", href: "https://voip-call-app-7d0c3.web.app/" },
    navigator: { clipboard: null, mediaDevices: { getUserMedia: function () { return Promise.resolve({ getTracks: function () { return []; } }); } } },
    document: {
      documentElement: el(),
      head: el(),
      body: el(),
      visibilityState: "visible",
      createElement: function () { return el(); },
      getElementById: function () { return null; },
      addEventListener: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; }
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    URLSearchParams: URLSearchParams,
    Audio: function () { return { setAttribute: function () {}, preload: "", loop: false, play: function () { return Promise.resolve(); }, pause: function () {} }; },
    crypto: { getRandomValues: function (a) { for (var i = 0; i < a.length; i++) a[i] = 1; return a; } },
    RTCPeerConnection: function () { this.addEventListener = function () {}; this.addTrack = function () {}; },
    Date: Date,
    Math: Math,
    Number: Number,
    String: String,
    Object: Object,
    Array: Array,
    Promise: Promise,
    JSON: JSON,
    DataView: DataView,
    Blob: Blob,
    URL: URL,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: function () { return 0; },
    clearInterval: function () {},
    console: console,
    Uint8Array: Uint8Array
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document.documentElement.getAttribute = function () { return "rtl"; };
  vm.runInNewContext(fs.readFileSync(LINK, "utf8"), sandbox, { filename: "link.js" });
  return sandbox;
}

test("subscriber ring lasts one minute and an idle lock does not add a wait", async function () {
  const w = loadLink();
  assert.equal(w.vcomCallRingMs, 60000);
  const source = "prefix " + OLD_RING + " middle " + OLD_RACE + " suffix";
  const patched = w.vcomPatchCallBundle(source);
  assert.equal(patched.includes(OLD_RING), false);
  assert.equal(patched.includes("B.rk=new A.aU(60000000)"), true);
  assert.equal(patched.includes("fut instanceof A.au"), true);
  assert.equal(patched.includes("setTimeout(watch,200)"), false);
  assert.equal(patched.includes("prefix "), true);
  assert.equal(patched.includes(" suffix"), true);
  assert.equal(w.vcomPatchCallBundle(patched), patched);

  const raceSrc = patched.slice(patched.indexOf("A.vcomRace=function"), patched.indexOf(" suffix"));
  const finishes = [];
  const raceBox = {
    A: { au: function Au() {}, bi: function () { return { a: {} }; } },
    $: { ad: {} },
    t: { U: {}, R: {} },
    J: { b4x: function () { finishes.push(Date.now()); } },
    setTimeout: setTimeout
  };
  vm.runInNewContext(raceSrc + "\nthis.race = A.vcomRace;", raceBox);
  const started = Date.now();
  raceBox.race(null, 8000);
  raceBox.race({}, 8000);
  raceBox.race({ a: 8 }, 8000);
  assert.equal(finishes.length, 3);
  assert.ok(Date.now() - started < 50, "idle lock must not wait out the 8s cap");
  const pending = new raceBox.A.au();
  pending.a = 1;
  raceBox.race(pending, 8000);
  assert.equal(finishes.length, 3, "a live future is not released before it completes");
  pending.a = 8;
  await new Promise(function (resolve) { setTimeout(resolve, 80); });
  assert.equal(finishes.length, 4);
});

test("a bundle without the call markers is left unchanged", function () {
  const w = loadLink();
  const source = "B.a_w=new A.aU(6e7) untouched";
  assert.equal(w.vcomPatchCallBundle(source), source);
});
