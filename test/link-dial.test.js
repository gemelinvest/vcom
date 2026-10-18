"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const LINK = path.join(ROOT, "link.js");

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
    window: {},
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
    Audio: function () { return { setAttribute: function () {}, preload: "", loop: false, play: function () { return Promise.resolve(); } }; },
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
  const src = fs.readFileSync(LINK, "utf8");
  vm.runInNewContext(src, sandbox, { filename: "link.js" });
  return sandbox;
}

function guestBook() {
  return {
    "020578412": {
      code: "Ab3dEf",
      name: "אור",
      phone: "020578412",
      status: "waiting",
      expiresAt: Date.now() + 600000
    }
  };
}

test("keypad Dial still uses vcomGuestCode, not a drawer WebRTC shortcut", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /window\.vcomGuestCode/);
  assert.match(src, /window\.vcomStartGuestCall/);
  const render = src.match(/function render\(\) \{[\s\S]*?\n    function /);
  assert.ok(render);
  assert.equal(render[0].includes("vcomStartGuestCall(code"), false);
});

test("vcomGuestCode matches only the exact guest temp phone", function () {
  const w = loadLink();
  w.__vcomGuestBook = guestBook();
  assert.equal(w.vcomGuestCode("020578412"), "Ab3dEf");
  assert.equal(w.vcomGuestCode("020-578412"), "Ab3dEf");
});

test("vcomGuestCode does not hijack another subscriber number", function () {
  const w = loadLink();
  w.__vcomGuestBook = guestBook();
  w.__vcomGuestBook["020578412"].status = "ringing";
  assert.equal(w.vcomGuestCode("020701104"), "");
  assert.equal(w.vcomGuestCode("020479807"), "");
  assert.equal(w.vcomGuestCode("אוריה"), "");
  assert.equal(w.vcomGuestCode("guest"), "");
  assert.equal(w.vcomGuestCode(""), "");
});

test("ended guest links are not dialable via vcomGuestCode", function () {
  const w = loadLink();
  w.__vcomGuestBook = guestBook();
  w.__vcomGuestBook["020578412"].status = "ended";
  assert.equal(w.vcomGuestCode("020578412"), "");
});

test("expired waiting and ringing links leave the side menu copy card", function () {
  const w = loadLink();
  const now = Date.now();
  const live = guestBook()["020578412"];
  assert.equal(w.vcomLinkStillVisible(live, now), true);
  const expiredWaiting = Object.assign({}, live, { expiresAt: now - 1000, status: "waiting" });
  const expiredRinging = Object.assign({}, live, { expiresAt: now - 1000, status: "ringing" });
  const expiredEnded = Object.assign({}, live, { expiresAt: now - 1000, status: "ended" });
  assert.equal(w.vcomLinkStillVisible(expiredWaiting, now), false);
  assert.equal(w.vcomLinkStillVisible(expiredRinging, now), false);
  assert.equal(w.vcomLinkStillVisible(expiredEnded, now), false);
});

test("an active call stays on the side menu even after the share link expires", function () {
  const w = loadLink();
  const now = Date.now();
  const active = Object.assign({}, guestBook()["020578412"], { expiresAt: now - 1000, status: "active" });
  assert.equal(w.vcomLinkStillVisible(active, now), true);
});

test("expired ringing numbers are not hijacked onto guest WebRTC", function () {
  const w = loadLink();
  w.__vcomGuestBook = guestBook();
  w.__vcomGuestBook["020578412"].status = "ringing";
  w.__vcomGuestBook["020578412"].expiresAt = Date.now() - 5000;
  assert.equal(w.vcomGuestCode("020578412"), "");
  assert.equal(w.vcomPlaceLinkCall(w.__vcomGuestBook["020578412"], {
    dialPress: function () {}
  }).reason, "expired");
});

test("placeLinkCall closes the drawer and presses keypad Dial with the guest number", function () {
  const w = loadLink();
  const calls = [];
  const row = guestBook()["020578412"];
  const result = w.vcomPlaceLinkCall(row, {
    isOnCall: function () { return false; },
    fy: function () { return false; },
    closeDrawer: function () { calls.push("close"); },
    pasteDigits: function (phone) { calls.push("paste:" + phone); },
    dialPress: function () { calls.push("dial"); },
    startGuestDirect: function () { calls.push("guest-direct"); }
  });
  assert.equal(result.ok, true);
  assert.equal(result.via, "keypad");
  assert.deepEqual(calls, ["close", "paste:020578412", "dial"]);
});

test("placeLinkCall never starts guest WebRTC directly", function () {
  const w = loadLink();
  const calls = [];
  w.vcomPlaceLinkCall(guestBook()["020578412"], {
    closeDrawer: function () {},
    pasteDigits: function () {},
    dialPress: function () { calls.push("dial"); },
    startGuestDirect: function () { calls.push("guest-direct"); }
  });
  assert.equal(calls.indexOf("guest-direct"), -1);
  assert.equal(calls.indexOf("dial"), 0);
});

test("placeLinkCall does not steal a real subscriber call already in progress", function () {
  const w = loadLink();
  const calls = [];
  const busy = w.vcomPlaceLinkCall(guestBook()["020578412"], {
    fy: function () { return true; },
    closeDrawer: function () { calls.push("close"); },
    dialPress: function () { calls.push("dial"); }
  });
  assert.equal(busy.ok, false);
  assert.equal(busy.reason, "busy");
  assert.deepEqual(calls, []);
  const onCall = w.vcomPlaceLinkCall(guestBook()["020578412"], {
    isOnCall: function () { return true; },
    closeDrawer: function () { calls.push("close"); },
    dialPress: function () { calls.push("dial"); }
  });
  assert.equal(onCall.ok, false);
  assert.deepEqual(calls, []);
});

test("owner does not auto-start from the drawer when a guest is ringing", function () {
  const w = loadLink();
  assert.equal(w.vcomShouldAutoStartGuest({ status: "ringing", offer: null }, { fy: function () { return false; }, isOnCall: function () { return false; } }), false);
  assert.equal(w.vcomShouldAutoStartGuest({ status: "ringing", offer: { sdp: "x" } }, { fy: function () { return false; }, isOnCall: function () { return false; } }), false);
});

test("קבל לינק חדש is emphasized, not faint caption gray", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /קבל לינק חדש/);
  assert.match(src, /#vcom-link-open\{[^}]*font:600 17px/);
  assert.match(src, /#vcom-link-open\{[^}]*color:#1C1C1E/);
  assert.doesNotMatch(src, /#vcom-link-open\{[^}]*color:#8E8E93/);
});

test("guest name on the link card is not clipped", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /\.vcom-link-guest\{[^}]*overflow:visible/);
  assert.match(src, /\.vcom-link-guest\{[^}]*unicode-bidi:isolate/);
});
