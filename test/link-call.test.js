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

test("answered video is attached above the Flutter canvas so both sides can see it", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomAttachCallVideo, "function");
  const el = {
    style: {},
    hidden: true,
    srcObject: null,
    setAttribute: function () {},
    removeAttribute: function () {},
    play: function () { return Promise.resolve(); }
  };
  const stream = { getVideoTracks: function () { return [{ kind: "video" }]; } };
  const remote = w.vcomAttachCallVideo(el, stream, "remote");
  assert.equal(remote.ok, true);
  assert.equal(el.hidden, false);
  assert.equal(Number(el.style.zIndex) >= 10020, true);
  assert.equal(el.srcObject, stream);
  const localEl = {
    style: {},
    hidden: true,
    srcObject: null,
    setAttribute: function () {},
    removeAttribute: function () {},
    play: function () { return Promise.resolve(); }
  };
  const local = w.vcomAttachCallVideo(localEl, stream, "local");
  assert.equal(local.ok, true);
  assert.equal(Number(localEl.style.zIndex) >= 10021, true);
});

test("remote picture still attaches when WebRTC delivers a track without streams", function () {
  const w = loadLink();
  assert.equal(typeof w.vcomMergeTrackStream, "function");
  const holder = {};
  const track = { kind: "video", id: "v1" };
  const stream = w.vcomMergeTrackStream(holder, { track: track, streams: [] });
  assert.ok(stream);
  assert.equal(w.vcomCallHasVideo(stream), true);
});

test("owner and guest ontrack attach video through vcomAttachCallVideo", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /pc\.ontrack = function[\s\S]*vcomAttachCallVideo/);
  assert.match(src, /vcomMergeTrackStream/);
  assert.match(src, /z-index:10020/);
  assert.match(src, /vcomAttachCallVideo\(nodes\.localVideo, stream, "local"\)/);
});

test("vcomLiftCallVideos keeps Flutter video in place and shows a stable copy", function () {
  const w = loadLink();
  const body = w.document.body;
  const moved = [];
  body.appendChild = function (node) {
    node.parentElement = body;
    moved.push(node);
    return node;
  };
  const remote = {
    id: "video_RTCVideoRenderer-remote",
    srcObject: { getVideoTracks: function () { return [{ kind: "video", id: "remote-v" }]; } },
    style: {},
    hidden: false,
    parentElement: { tagName: "FLT-PLATFORM-VIEW" },
    attrs: {},
    setAttribute: function (name, value) { this.attrs[name] = String(value); },
    removeAttribute: function (name) { delete this.attrs[name]; },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    play: function () { return Promise.resolve(); }
  };
  const local = {
    id: "video_RTCVideoRenderer-local",
    srcObject: { getVideoTracks: function () { return [{ kind: "video", id: "local-v" }]; } },
    style: {},
    hidden: false,
    parentElement: { tagName: "FLT-PLATFORM-VIEW" },
    attrs: { "data-vcom-local": "1" },
    setAttribute: function (name, value) { this.attrs[name] = String(value); },
    removeAttribute: function (name) { delete this.attrs[name]; },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    play: function () { return Promise.resolve(); }
  };
  w.document.querySelectorAll = function () { return [remote, local]; };
  const result = w.vcomLiftCallVideos();
  assert.equal(result.shown, 2);
  assert.equal(remote.parentElement.tagName, "FLT-PLATFORM-VIEW");
  assert.equal(local.parentElement.tagName, "FLT-PLATFORM-VIEW");
  assert.equal(remote.style.opacity, "0");
  assert.equal(local.style.opacity, "0");
  const stageRemote = w.__vcomStageVideos.remote;
  const stageLocal = w.__vcomStageVideos.local;
  assert.equal(stageRemote.parentElement, body);
  assert.equal(stageLocal.parentElement, body);
  assert.equal(Number(stageRemote.style.zIndex) >= 10020, true);
  assert.equal(Number(stageLocal.style.zIndex) >= 10021, true);
  assert.equal(stageRemote.srcObject, remote.srcObject);
  assert.equal(stageLocal.srcObject, local.srcObject);
  assert.equal(stageRemote.style.bottom, "168px");
  assert.equal(stageLocal.style.width, "min(168px, 40vw)");
  assert.equal(stageLocal.style.height, "min(292px, 36vh)");
  let plays = 0;
  stageRemote.play = function () { plays += 1; return Promise.resolve(); };
  stageLocal.play = function () { plays += 1; return Promise.resolve(); };
  const again = w.vcomLiftCallVideos();
  assert.equal(again.shown, 2);
  assert.equal(plays, 0);
  assert.equal(stageRemote.style.width, "100%");
  assert.equal(stageLocal.style.width, "min(168px, 40vw)");
  assert.equal(moved.indexOf(remote), -1);
  assert.equal(moved.indexOf(local), -1);
});

test("repeat video attach does not restart a playing picture", function () {
  const w = loadLink();
  let plays = 0;
  let assigns = 0;
  let src = null;
  const el = {
    style: {},
    hidden: true,
    paused: true,
    set srcObject(value) { assigns += 1; src = value; },
    get srcObject() { return src; },
    setAttribute: function () {},
    removeAttribute: function () {},
    play: function () { plays += 1; return Promise.resolve(); }
  };
  const stream = { getVideoTracks: function () { return [{ kind: "video", id: "v" }]; } };
  const first = w.vcomAttachCallVideo(el, stream, "remote");
  el.paused = false;
  const second = w.vcomAttachCallVideo(el, stream, "remote");
  assert.equal(first.ok, true);
  assert.equal(second.stable, true);
  assert.equal(assigns, 1);
  assert.equal(plays, 1);
  assert.equal(el.style.top, "108px");
  assert.equal(el.style.bottom, "168px");
  assert.equal(el.style.height, "auto");
});

test("local preview fills its frame and remote video leaves the call buttons visible", function () {
  const w = loadLink();
  w.innerWidth = 400;
  w.innerHeight = 800;
  const body = w.document.body;
  body.appendChild = function (node) {
    node.parentElement = body;
    return node;
  };
  function video(id, track, rect, local) {
    return {
      id: id,
      srcObject: { getVideoTracks: function () { return [{ kind: "video", id: track, readyState: "live" }]; } },
      style: {},
      hidden: false,
      parentElement: {
        tagName: "FLT-PLATFORM-VIEW",
        getBoundingClientRect: function () { return rect; },
        parentElement: null
      },
      attrs: local ? { "data-vcom-local": "1" } : {},
      setAttribute: function (name, value) { this.attrs[name] = String(value); },
      removeAttribute: function (name) { delete this.attrs[name]; },
      getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
      play: function () { return Promise.resolve(); }
    };
  }
  const local = video("video_RTCVideoRenderer-local", "cam", { top: 48, left: 8, width: 160, height: 292 }, true);
  const remote = video("video_RTCVideoRenderer-remote", "far", { top: 0, left: 0, width: 400, height: 800 }, false);
  w.document.querySelectorAll = function () { return [remote, local]; };
  const result = w.vcomLiftCallVideos();
  assert.equal(result.shown, 2);
  const stageLocal = w.__vcomStageVideos.local;
  const stageRemote = w.__vcomStageVideos.remote;
  assert.equal(stageLocal.style.width, "160px");
  assert.equal(stageLocal.style.height, "292px");
  assert.equal(stageLocal.style.top, "48px");
  assert.equal(stageLocal.style.left, "8px");
  assert.equal(stageLocal.style.objectFit, "cover");
  const remoteTop = Number.parseFloat(stageRemote.style.top);
  const remoteHeight = Number.parseFloat(stageRemote.style.height);
  assert.equal(remoteTop >= 96, true);
  assert.equal(remoteTop + remoteHeight <= 800 - 148, true);
  let plays = 0;
  stageLocal.play = function () { plays += 1; return Promise.resolve(); };
  stageRemote.play = function () { plays += 1; return Promise.resolve(); };
  w.vcomLiftCallVideos();
  assert.equal(plays, 0);
  assert.equal(stageLocal.style.width, "160px");
  assert.equal(local.parentElement.tagName, "FLT-PLATFORM-VIEW");
});

test("camera tracks stay on the small preview so the remote picture does not swap", function () {
  const w = loadLink();
  const stream = { getVideoTracks: function () { return [{ kind: "video", id: "cam", readyState: "live" }]; } };
  assert.equal(w.vcomNoteLocalVideo(stream), true);
  const preview = { id: "video_RTCVideoRenderer-0", srcObject: stream, style: {} };
  const remote = { id: "video_RTCVideoRenderer-1", srcObject: { getVideoTracks: function () { return [{ kind: "video", id: "far", readyState: "live" }]; } }, style: {} };
  assert.equal(w.vcomVideoIsLocal(preview), true);
  assert.equal(w.vcomVideoIsLocal(remote), false);
});

test("ended call videos are hidden so they do not cover the app", function () {
  const w = loadLink();
  const el = {
    id: "video_RTCVideoRenderer-done",
    srcObject: null,
    style: { zIndex: "10020", width: "100%", height: "100dvh" },
    hidden: false,
    parentElement: {},
    attrs: { "data-vcom-lifted": "1" },
    setAttribute: function (name, value) { this.attrs[name] = String(value); },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; }
  };
  w.document.querySelectorAll = function () { return [el]; };
  const result = w.vcomLiftCallVideos();
  assert.equal(result.shown, 0);
  assert.equal(el.hidden, true);
  assert.equal(el.style.zIndex, "0");
});
