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

test("side-menu card copies the number instead of dialing from the drawer", function () {
  const src = fs.readFileSync(LINK, "utf8");
  const render = src.match(/function render\(\) \{[\s\S]*?\n    function linkCallIo/);
  assert.ok(render, "render exists");
  assert.equal(render[0].includes('textContent = "חייג"'), false, "no חייג on the card");
  assert.equal(render[0].includes("startOwnerGuestCall"), false, "card must not start a call");
  assert.equal(render[0].includes("העתק מספר"), true);
  assert.equal(render[0].includes("העתק קישור שיחה"), true);
});

test("owner does not auto-start a guest call; keypad Dial remains the path", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomShouldAutoStartGuest, "function");
  assert.equal(w.vcomShouldAutoStartGuest({ status: "ringing", offer: null }, { fy: function () { return false; }, isOnCall: function () { return false; } }), false);
  assert.equal(typeof w.vcomGuestCode, "function");
});

test("remote answer uses WebRTC answer SDP and stops caller ringback", function () {
  const w = loadLink();
  const payload = w.vcomGuestAnswerPayload({ type: "answer", sdp: "v=0" });
  assert.ok(payload);
  assert.equal(payload.answer.type, "answer");
  assert.equal(payload.answer.sdp, "v=0");
  const calls = [];
  const result = w.vcomOnRemoteAnswer({
    stopRingback: function () { calls.push("stop-ringback"); },
    setCallPhase: function (phase) { calls.push("phase:" + phase); }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["stop-ringback", "phase:connecting"]);
});

test("caller stays on earpiece until speaker is pressed", function () {
  const w = loadLink();
  assert.equal(w.vcomCallAudioRoute(false), "earpiece");
  assert.equal(w.vcomCallAudioRoute(true), "speaker");
  assert.equal(w.vcomCallAudioRoute(w.vcomDefaultSpeakerOn), "earpiece");
});

test("guest answer session starts on earpiece, not speaker", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /function openAnswer\(/);
  assert.match(src, /speaker: !!window\.vcomDefaultSpeakerOn/);
  assert.doesNotMatch(src, /speaker: true/);
});

test("outgoing ringback waits for the local mic before playing", function () {
  const src = fs.readFileSync(LINK, "utf8");
  const start = src.match(/function startCaller\([\s\S]*?mediaPromise\.then/);
  assert.ok(start, "startCaller exists");
  assert.equal(start[0].includes("startBack()"), false, "must not ring before getUserMedia");
  assert.match(src, /pc\.addTrack\(track, stream\);[\s\S]{0,80}startBack\(\)/);
});

test("wait-tone uses a WebRTC voice loopback, not a loudspeaker media file", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /window\.vcomStartRingback = startVoiceRingback/);
  assert.match(src, /function attachVoiceLoopback[\s\S]{0,500}RTCPeerConnection/);
  assert.match(src, /createMediaStreamDestination/);
  assert.equal(src.includes("el.srcObject = dest.stream"), false);
  const impl = src.match(/function startVoiceRingback\([\s\S]*?window\.vcomStartRingback = startVoiceRingback/);
  assert.ok(impl, "voice ringback is defined in link.js");
  assert.equal(impl[0].includes("ctx.destination"), false);
  assert.equal(impl[0].includes("audio/wav"), false);
  assert.match(impl[0], /play-and-record/);
});

test("earpiece is a route change, not a quieter speaker", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.doesNotMatch(src, /el\.volume = speaker \? 1 : 0\.45/);
  const w = loadLink();
  const el = { volume: 0, setSinkId: function (id) { this.sink = id; return Promise.resolve(); } };
  w.__vcomSpeaker = false;
  assert.equal(w.vcomApplyCallAudioRoute(el), "earpiece");
  assert.equal(el.volume, 1);
  assert.equal(w.__vcomRingbackSink, "communications");
  w.__vcomSpeaker = true;
  assert.equal(w.vcomApplyCallAudioRoute(el), "speaker");
  assert.equal(el.volume, 1);
});

test("Android earpiece sink prefers receiver, never default speaker", function () {
  const w = loadLink();
  assert.equal(w.vcomPickAudioSink([
    { kind: "audiooutput", deviceId: "default", label: "Default" },
    { kind: "audiooutput", deviceId: "sp", label: "Speaker" },
    { kind: "audiooutput", deviceId: "ear", label: "Earpiece" }
  ], false), "ear");
  assert.equal(w.vcomPickAudioSink([
    { kind: "audiooutput", deviceId: "default", label: "" },
    { kind: "audiooutput", deviceId: "communications", label: "" }
  ], false), "communications");
  assert.equal(w.vcomPickAudioSink([
    { kind: "audiooutput", deviceId: "sp", label: "Speaker" }
  ], true), "sp");
  assert.notEqual(w.vcomPickAudioSink([], false), "default");
  assert.notEqual(w.vcomPickAudioSink([], false), "");
});

test("hangup from either side writes ended and closes both UIs", function () {
  const w = loadLink();
  const calls = [];
  const result = w.vcomOnHangup({
    stopRingback: function () { calls.push("stop-ringback"); },
    closeLocal: function () { calls.push("close-local"); },
    setCallPhase: function (phase) { calls.push("phase:" + phase); },
    writeEnded: function (patch) { calls.push("write:" + patch.status); }
  });
  assert.equal(result.ok, true);
  assert.equal(result.patch.status, "ended");
  assert.deepEqual(calls, ["stop-ringback", "close-local", "phase:ended", "write:ended"]);
});

test("a new dial ignores a leftover ended snapshot until the offer is written", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomIgnoreStaleEnded, "function");
  assert.equal(w.vcomIgnoreStaleEnded({ status: "ended" }, false), true);
  assert.equal(w.vcomIgnoreStaleEnded(null, false), true);
  assert.equal(w.vcomIgnoreStaleEnded({ status: "ended" }, true), false);
  assert.equal(w.vcomIgnoreStaleEnded({ status: "ringing", offer: { sdp: "x" } }, false), false);
  assert.equal(w.vcomIgnoreStaleEnded({ status: "active" }, true), false);
});

test("guest page reopens a later ringing offer after the previous call ended", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomGuestResumeFromEnded, "function");
  assert.equal(w.vcomGuestResumeFromEnded({ status: "ringing", offer: { sdp: "x" } }, true), true);
  assert.equal(w.vcomGuestResumeFromEnded({ status: "waiting", offer: { sdp: "x" } }, true), true);
  assert.equal(w.vcomGuestResumeFromEnded({ status: "ended", offer: { sdp: "x" } }, true), false);
  assert.equal(w.vcomGuestResumeFromEnded({ status: "ringing" }, true), false);
  assert.equal(w.vcomGuestResumeFromEnded({ status: "ringing", offer: { sdp: "x" } }, false), false);
});

test("caller snapshot is unsubscribed on hangup so redial does not leak listeners", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /current\.unsub = fs\.onSnapshot\(ref/);
  assert.match(src, /if \(current\.unsub\) \{[\s\S]{0,120}current\.unsub\(\)/);
});

test("audio-only getUserMedia does not prime the camera", function () {
  const src = fs.readFileSync(LINK, "utf8");
  const persist = src.match(/function wireMediaPersist\(\) \{[\s\S]*?\n  \}/);
  assert.ok(persist, "wireMediaPersist exists");
  assert.equal(persist[0].includes("facingMode"), false);
  assert.equal(persist[0].includes("video: {"), false);
});

test("startCaller retries locally if Firestore is not ready instead of dropping the dial", function () {
  const src = fs.readFileSync(LINK, "utf8");
  const start = src.match(/function startCaller\(token, code, mediaPromise, video\) \{[\s\S]*?finishCaller\(false\)/);
  assert.ok(start, "startCaller exists");
  assert.match(start[0], /if \(!fs\) \{/);
  assert.match(start[0], /setTimeout/);
  assert.equal(start[0].includes("enableNetwork"), false);
});

test("video call media falls back to a simpler camera instead of dropping the dial", async function () {
  const w = loadLink();
  assert.equal(typeof w.vcomOpenCallMedia, "function");
  const calls = [];
  w.navigator.mediaDevices.getUserMedia = function (spec) {
    calls.push(spec && spec.video);
    if (spec && spec.video && spec.video.facingMode) return Promise.reject(new Error("overconstrained"));
    if (spec && spec.video === true) {
      return Promise.resolve({
        getTracks: function () { return [{ kind: "video", stop: function () {} }]; },
        getAudioTracks: function () { return [{}]; },
        getVideoTracks: function () { return [{}]; }
      });
    }
    return Promise.reject(new Error("fail"));
  };
  const stream = await w.vcomOpenCallMedia(true);
  assert.equal(w.vcomCallHasVideo(stream), true);
  assert.equal(calls[0] && calls[0].facingMode, "user");
  assert.equal(calls.indexOf(true) >= 0, true);
});

test("video dial still sends a call if the camera is refused", async function () {
  const w = loadLink();
  w.navigator.mediaDevices.getUserMedia = function (spec) {
    if (spec && spec.video) return Promise.reject(new Error("notallowed"));
    return Promise.resolve({
      getTracks: function () { return [{ kind: "audio", stop: function () {} }]; },
      getAudioTracks: function () { return [{}]; },
      getVideoTracks: function () { return []; }
    });
  };
  const stream = await w.vcomOpenCallMedia(true);
  assert.equal(w.vcomCallHasVideo(stream), false);
  assert.equal(stream.getAudioTracks().length, 1);
});

test("owner and guest video paths open media through vcomOpenCallMedia", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /vcomStartGuestCall = function[\s\S]{0,500}vcomOpenCallMedia\(wantVideo\)/);
  assert.match(src, /current\.video = window\.vcomCallHasVideo\(stream\)/);
  assert.match(src, /vcomOpenCallMedia\(wantVideo\)/);
});

test("installed browser app uses a full-viewport PWA layout", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomApplyPwaLayout, "function");
  w.navigator.standalone = true;
  w.vcomApplyPwaLayout();
  assert.equal(w.__vcomPwa, true);
});
