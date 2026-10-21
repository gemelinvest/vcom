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

test("a regular audio call stays on the earpiece when the other side answers", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.equal(src.includes('__VCOM_LINK_BUILD = "vid11"'), true);
  const apply = src.match(/window\.vcomApplyEarpieceNow = function[\s\S]*?\n    \};/);
  assert.ok(apply, "earpiece apply exists");
  assert.equal(apply[0].includes(".muted"), false);
  assert.match(src, /addEventListener\("play", onCallMedia, true\)/);
  assert.match(src, /addEventListener\("playing", onCallMedia, true\)/);
  const w = loadLink();
  const sinks = [];
  const session = { type: "playback" };
  w.navigator.audioSession = session;
  w.__vcomSpeaker = true;
  w.__vcomSpeakerTouched = true;
  w.__vcomUserSpeaker = false;
  w.__vcomRinging = false;
  w.__vcomGuestVideo = false;
  const remote = {
    id: "audio_RTCVideoRenderer-1",
    tagName: "AUDIO",
    srcObject: {
      getAudioTracks: function () { return [{ readyState: "live" }]; },
      getVideoTracks: function () { return []; }
    },
    setSinkId: function (id) {
      sinks.push(id);
      this.sinkId = id;
      return Promise.resolve();
    }
  };
  w.document.querySelectorAll = function () { return [remote]; };
  assert.equal(w.vcomAudioCallWantsEarpiece(), true);
  assert.equal(w.vcomHoldEarpiece(remote), "earpiece");
  assert.equal(session.type, "play-and-record");
  assert.equal(w.__vcomSpeaker, false);
  assert.equal(sinks.indexOf("communications") >= 0, true);
  w.vcomSetSpeaker(true);
  assert.equal(w.__vcomUserSpeaker, true);
  assert.equal(session.type, "auto");
  session.type = "play-and-record";
  assert.equal(w.vcomHoldEarpiece(remote), "skip");
  assert.equal(session.type, "play-and-record");
  w.__vcomUserSpeaker = false;
  w.__vcomGuestVideo = true;
  assert.equal(w.vcomAudioCallWantsEarpiece(), false);
  w.__vcomGuestVideo = false;
  w.__vcomRinging = true;
  assert.equal(w.vcomAudioCallWantsEarpiece(), false);
  w.__vcomRinging = false;
  w.__vcomSpeakerTouched = true;
  w.__vcomSpeaker = true;
  w.vcomSetEarpieceDefault();
  assert.equal(w.__vcomSpeakerTouched, false);
  assert.equal(session.type, "play-and-record");
});

test("the side menu drops the handset and closes the link form with the drawer", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.equal(src.includes("logo.style.left"), false);
  assert.match(src, /logo\.hidden = true/);
  assert.match(src, /previous > 0\.2 && x < 0\.05 && !busy/);
  assert.match(src, /nameInput\.value = ""/);
  const w = loadLink();
  w.__vcomDrawerX = 1;
  w.__vcomDrawerWidth = 304;
  assert.equal(w.vcomDrawerTapShouldClose({ x: 20, viewWidth: 400, rtl: true, insideMenu: false }), true);
  assert.equal(w.vcomDrawerTapShouldClose({ x: 360, viewWidth: 400, rtl: true, insideMenu: false }), false);
  assert.equal(w.vcomDrawerTapShouldClose({ x: 20, viewWidth: 400, rtl: true, insideMenu: true }), false);
  w.__vcomDrawerX = 0;
  assert.equal(w.vcomDrawerTapShouldClose({ x: 20, viewWidth: 400, rtl: true, insideMenu: false }), false);
  let closed = false;
  w.__vcomDrawerState = { aJ: function () { closed = true; } };
  w.__vcomDrawerX = 1;
  assert.equal(w.vcomCloseSideMenu(), true);
  assert.equal(closed, true);
});

test("chat messages can carry a voice note, a photo, or a video", function () {
  const src = fs.readFileSync(LINK, "utf8");
  assert.match(src, /data-mic aria-label="הקלטה"/);
  assert.match(src, /data-options aria-label="אפשרויות"/);
  assert.match(src, /data-gallery>שליחת תמונה מהגלריה/);
  assert.match(src, /data-capture>צילום תמונה \/ סרטון/);
  assert.equal(src.includes('data-camera'), false);
  assert.equal(src.includes("vcom-chat-tools"), false);
  assert.match(src, /textContent = "מחק"/);
  assert.match(src, /dataset\.delete/);
  assert.equal(src.includes("vcom-chat-media-tray"), false);
  assert.match(src, /setAttribute\("capture", "environment"\)/);
  assert.match(src, /accept = "image\/\*,video\/\*"/);
  assert.match(src, /new MediaRecorder\(stream\)/);
  assert.match(src, /pointerdown/);
  assert.match(src, /plain \? " plain"/);
  assert.match(src, /\.vcom-bubble\.plain,/);
  const w = loadLink();
  assert.equal(w.vcomChatSurfaceOpen("abc", 0, 2, false), false);
  assert.equal(w.vcomChatSurfaceOpen("abc", 2, 2, false), true);
  assert.equal(w.vcomChatSurfaceOpen("", 2, 2, false), false);
  assert.equal(w.vcomChatSurfaceOpen("abc", 2, 2, true), false);
  assert.equal(w.vcomChatSurfaceOpen("abc", 2, "", false), false);
  assert.equal(w.vcomComposerOnScreen(null), null);
  assert.equal(w.vcomComposerOnScreen([]), false);
  assert.equal(w.vcomComposerOnScreen([{ label: "הודעות", visible: true }]), false);
  assert.equal(w.vcomComposerOnScreen([{ label: "הודעה קולית", visible: true }]), false);
  assert.equal(w.vcomComposerOnScreen([{ label: "הודעה", visible: false }]), false);
  assert.equal(w.vcomComposerOnScreen([{ label: "הודעה", visible: true }]), true);
  assert.equal(w.vcomComposerOnScreen([{ label: "", role: "textbox", visible: true, bottom: true }]), true);
  assert.equal(w.vcomComposerOnScreen([{ label: "", role: "textbox", visible: true, bottom: false }]), false);
  assert.equal(w.vcomMediaLabel(w.vcomEncodeMedia("image", "https://example.com/a.jpg")), "תמונה");
  assert.equal(w.vcomMediaLabel(w.vcomEncodeMedia("audio", "https://example.com/a.webm")), "הודעה קולית");
  assert.equal(w.vcomMediaLabel(w.vcomEncodeMedia("video", "https://example.com/a.mp4")), "סרטון");
  assert.equal(w.vcomMediaLabel("שלום"), "");
  assert.equal(w.vcomParseMedia("vcom-media\nimage\nhttp://example.com/a.jpg"), null);
  assert.equal(w.vcomParseMedia("vcom-media\nimage\ndata:image/jpeg;base64,abc").kind, "image");
  assert.equal(w.vcomParseMedia("vcom-media\naudio\ndata:audio/webm;base64,abc").kind, "audio");
  assert.equal(w.vcomParseMedia("vcom-media\nimage\njavascript:alert(1)"), null);
});

test("answering or a new audio capture clears a leftover loudspeaker latch", async function () {
  const w = loadLink();
  w.__vcomUserSpeaker = true;
  w.__vcomSpeaker = true;
  w.__vcomSpeakerTouched = true;
  w.navigator.audioSession = { type: "auto" };
  w.vcomStopRing();
  assert.equal(w.__vcomUserSpeaker, true);
  w.__vcomUserSpeaker = false;
  w.__vcomSpeaker = true;
  w.__vcomSpeakerTouched = true;
  const stream = await w.navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  assert.equal(w.vcomCallHasVideo(stream), false);
  assert.equal(w.__vcomUserSpeaker, false);
  assert.equal(w.__vcomSpeaker, false);
  assert.equal(w.__vcomSpeakerTouched, false);
  assert.equal(w.navigator.audioSession.type, "play-and-record");
  const answered = w.vcomOnRemoteAnswer({
    stopRingback: function () {},
    setCallPhase: function () {}
  });
  assert.equal(answered.phase, "connecting");
  assert.equal(w.navigator.audioSession.type, "play-and-record");
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

test("vcomLiftCallVideos pins the local preview to its frame and keeps the remote picture above the buttons", function () {
  const w = loadLink();
  w.innerWidth = 400;
  w.innerHeight = 800;
  const body = w.document.body;
  body.appendChild = function (node) {
    node.parentElement = body;
    return node;
  };
  function video(id, track, local) {
    const host = {
      tagName: "FLT-PLATFORM-VIEW",
      style: {},
      getBoundingClientRect: function () {
        return local
          ? { top: 16, left: 16, width: 112, height: 156 }
          : { top: 0, left: 0, width: 400, height: 800 };
      }
    };
    return {
      id: id,
      srcObject: { getVideoTracks: function () { return [{ kind: "video", id: track }]; } },
      style: {},
      hidden: false,
      paused: false,
      parentElement: host,
      attrs: local ? { "data-vcom-local": "1" } : {},
      setAttribute: function (name, value) { this.attrs[name] = String(value); },
      removeAttribute: function (name) { delete this.attrs[name]; },
      getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
      play: function () { return Promise.resolve(); }
    };
  }
  const remote = video("video_RTCVideoRenderer-remote", "remote-v", false);
  const local = video("video_RTCVideoRenderer-local", "local-v", true);
  w.document.querySelectorAll = function () { return [remote, local]; };
  const result = w.vcomLiftCallVideos();
  assert.equal(result.shown, 2);
  assert.equal(local.parentElement, body);
  assert.equal(remote.parentElement, body);
  assert.equal(local.style.position, "fixed");
  assert.equal(local.style.top, "16px");
  assert.equal(local.style.left, "16px");
  assert.equal(local.style.width, "112px");
  assert.equal(local.style.height, "156px");
  assert.equal(local.style.objectFit, "cover");
  assert.equal(local.style.transform, "scaleX(-1)");
  assert.equal(local.style.borderRadius, "16px");
  assert.equal(local.style.zIndex, "10030");
  assert.equal(local.style.pointerEvents, "none");
  assert.equal(remote.style.position, "fixed");
  assert.equal(remote.style.objectFit, "cover");
  assert.equal(remote.style.transform, "none");
  assert.equal(remote.style.zIndex, "10020");
  assert.equal(remote.style.pointerEvents, "none");
  const remoteTop = parseInt(remote.style.top, 10);
  const remoteHeight = parseInt(remote.style.height, 10);
  assert.equal(remoteTop >= 88, true);
  assert.equal(remoteTop + remoteHeight <= w.innerHeight - 136, true);
  assert.equal(w.__vcomStageVideos, undefined);
  let plays = 0;
  remote.play = function () { plays += 1; return Promise.resolve(); };
  local.play = function () { plays += 1; return Promise.resolve(); };
  remote.style.width = "100%";
  remote.style.height = "100dvh";
  remote.style.top = "0px";
  local.style.width = "100%";
  local.style.height = "100%";
  local.style.top = "72px";
  const again = w.vcomLiftCallVideos();
  assert.equal(again.shown, 2);
  assert.equal(plays, 0);
  assert.equal(local.style.top, "16px");
  assert.equal(local.style.width, "112px");
  assert.equal(local.style.height, "156px");
  assert.equal(remote.style.top, remoteTop + "px");
  assert.equal(remote.style.height, remoteHeight + "px");
  assert.equal(local.parentElement, body);
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

test("local preview is drawn on top of its rounded frame", function () {
  const w = loadLink();
  const body = w.document.body;
  body.appendChild = function (node) {
    node.parentElement = body;
    return node;
  };
  const frame = {
    tagName: "FLT-PLATFORM-VIEW",
    style: {},
    children: [],
    getBoundingClientRect: function () { return { top: 30, left: 12, width: 112, height: 156 }; },
    appendChild: function (node) {
      node.parentElement = frame;
      this.children = [node];
      return node;
    },
    querySelector: function () { return this.children[0] || null; }
  };
  const local = {
    id: "video_RTCVideoRenderer-local",
    srcObject: { getVideoTracks: function () { return [{ kind: "video", id: "cam", readyState: "live" }]; } },
    style: { position: "fixed", top: "72px", left: "16px", width: "112px", height: "156px", zIndex: "10021" },
    hidden: false,
    paused: true,
    parentElement: body,
    attrs: { "data-vcom-local": "1", "data-vcom-lifted": "1" },
    setAttribute: function (name, value) { this.attrs[name] = String(value); },
    removeAttribute: function (name) { delete this.attrs[name]; },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    play: function () { this.paused = false; return Promise.resolve(); }
  };
  w.document.querySelectorAll = function (sel) {
    if (String(sel).indexOf("flt-platform-view") >= 0) return [frame];
    return [local];
  };
  const result = w.vcomLiftCallVideos();
  assert.equal(result.shown, 1);
  assert.equal(local.parentElement, body);
  assert.equal(local.style.position, "fixed");
  assert.equal(local.style.top, "30px");
  assert.equal(local.style.left, "12px");
  assert.equal(local.style.width, "112px");
  assert.equal(local.style.height, "156px");
  assert.equal(local.style.objectFit, "cover");
  assert.equal(local.style.transform, "scaleX(-1)");
  assert.equal(local.style.borderRadius, "16px");
  assert.equal(local.attrs["data-vcom-local"], "1");
  assert.equal(local.attrs["data-vcom-pinned"], "1");
  let plays = 0;
  local.play = function () { plays += 1; return Promise.resolve(); };
  local.style.width = "100%";
  w.vcomLiftCallVideos();
  assert.equal(plays, 0);
  assert.equal(local.style.width, "112px");
  assert.equal(local.style.top, "30px");
  assert.equal(local.parentElement, body);
});

test("hangup stops the dial tone even if the loopback connects afterwards", async function () {
  const w = loadLink();
  const plays = [];
  let ontrack = null;
  let pcs = 0;
  const el = {
    id: "vcom-ringback",
    style: {},
    hidden: true,
    paused: true,
    autoplay: true,
    muted: false,
    srcObject: null,
    src: "",
    currentSrc: "",
    setAttribute: function () {},
    removeAttribute: function () {},
    play: function () { plays.push("play"); this.paused = false; return Promise.resolve(); },
    pause: function () { plays.push("pause"); this.paused = true; }
  };
  const guest = {
    id: "vcom-guest-caller",
    srcObject: { tag: "call" },
    muted: false,
    paused: false,
    pause: function () { this.paused = true; }
  };
  w.document.getElementById = function (id) {
    if (id === "vcom-ringback") return el;
    if (id === "vcom-guest-caller") return guest;
    return null;
  };
  w.document.querySelectorAll = function () { return []; };
  w.setInterval = function () { return 7; };
  w.clearInterval = function () {};
  w.RTCPeerConnection = function () {
    pcs += 1;
    this.addTrack = function () {};
    this.addIceCandidate = function () { return Promise.resolve(); };
    this.close = function () {};
    this.createOffer = function () { return new Promise(function () {}); };
    this.setLocalDescription = function () { return Promise.resolve(); };
    this.setRemoteDescription = function () { return Promise.resolve(); };
    this.createAnswer = function () { return Promise.resolve({}); };
    this.localDescription = { type: "offer", sdp: "x" };
    if (pcs === 2) {
      Object.defineProperty(this, "ontrack", {
        set: function (fn) { ontrack = fn; },
        get: function () { return ontrack; }
      });
    }
  };
  w.AudioContext = function () {
    this.state = "running";
    this.currentTime = 0;
    this.resume = function () {};
    this.close = function () { this.state = "closed"; };
    this.createGain = function () { return { gain: { value: 0 }, connect: function () {} }; };
    this.createOscillator = function () {
      return { type: "", frequency: { value: 0 }, connect: function () {}, start: function () {}, stop: function () {} };
    };
    this.createMediaStreamDestination = function () {
      return { stream: { getAudioTracks: function () { return [{}]; }, getTracks: function () { return [{ stop: function () {} }]; } } };
    };
  };
  w.vcomStartRingback();
  assert.equal(w.__vcomRingbackOn, true);
  assert.equal(typeof ontrack, "function");
  const during = plays.length;
  w.vcomStartRingback();
  assert.equal(plays.length, during);
  assert.equal(w.__vcomRingbackPlays, 1);
  w.vcomStopRingback();
  const afterStop = plays.slice();
  assert.equal(w.__vcomRingbackOn, false);
  assert.equal(el.paused, true);
  assert.equal(el.muted, true);
  assert.equal(el.srcObject, null);
  ontrack({
    track: { stop: function () { plays.push("track-stop"); } },
    streams: [{ getTracks: function () { return []; } }]
  });
  assert.deepEqual(plays, afterStop.concat(["track-stop"]));
  assert.equal(el.srcObject, null);
  assert.equal(el.paused, true);
  assert.equal(guest.muted, false);
  assert.equal(guest.srcObject.tag, "call");
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
