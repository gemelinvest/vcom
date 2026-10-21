(function () {
  window.__VCOM_LINK_BUILD = "vid11";
  var TTL = 600000;
  function readGuest() {
    var q = "";
    try { q = new URLSearchParams(location.search).get("g") || ""; } catch (e) {}
    if (/^[A-Za-z0-9]{6,12}$/.test(q)) return q;
    var m = String(location.pathname || "").match(/^\/vcom\/([A-Za-z0-9]{6,12})\/?$/);
    return m ? m[1] : "";
  }
  var guestCode = readGuest();
  var ICE = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: [
          "turn:openrelay.metered.ca:80?transport=udp",
          "turn:openrelay.metered.ca:80?transport=tcp",
          "turn:openrelay.metered.ca:443?transport=tcp",
          "turns:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ]
  };
  var firebaseConfig = {
    apiKey: "AIzaSyCN7q0RH1uew-Sb4xyl8YNSEPZM-jqaQJI",
    authDomain: "voip-call-app-7d0c3.firebaseapp.com",
    projectId: "voip-call-app-7d0c3",
    appId: "1:307204199533:web:bc64335c5b3ab8ef289b64"
  };

  function digits(value) { return String(value || "").replace(/\D/g, ""); }
  function asMillis(value) {
    if (value == null || value === "") return 0;
    if (typeof value === "number" && isFinite(value)) return value < 1e12 ? value * 1000 : value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    try {
      if (typeof value.toMillis === "function") return Number(value.toMillis()) || 0;
    } catch (e) {}
    if (typeof value.seconds === "number") return value.seconds * 1000;
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }
  function pretty(phone) {
    var d = digits(phone);
    if (d.length === 9) return d.slice(0, 3) + "-" + d.slice(3);
    return d || "";
  }
  function shareUrl(code) { return "https://voip-call-app-7d0c3.web.app/vcom/" + code; }
  function clip(text) {
    var value = String(text || "");
    window.__vcomCopied = value;
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      try { document.execCommand("copy"); } catch (e) {}
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(fallback);
    } else fallback();
  }
  function clock(ms) {
    var left = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(left / 60);
    var s = left % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function untilClock(at) {
    var when = new Date(at);
    var h = when.getHours();
    var m = when.getMinutes();
    return "הלינק בתוקף עד " + (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  window.vcomWithDeadline = function (promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("timeout"));
      }, ms);
      Promise.resolve(promise).then(function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  var ringAudio = new Audio("/assets/assets/sounds/incoming_call.wav");
  ringAudio.id = "vcom-ring";
  ringAudio.preload = "auto";
  ringAudio.loop = true;
  ringAudio.setAttribute("playsinline", "true");
  var ringUnlocked = false;
  function stopOsc() {
    window.__vcomRingOn = false;
    if (window.__vcomRingTimer) {
      clearInterval(window.__vcomRingTimer);
      window.__vcomRingTimer = null;
    }
    if (window.__vcomRingGain) {
      try { window.__vcomRingGain.disconnect(); } catch (e) {}
      window.__vcomRingGain = null;
    }
  }
  function startOsc() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!window.__vcomToneCtx) window.__vcomToneCtx = new Ctx();
    var ctx = window.__vcomToneCtx;
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    stopOsc();
    var master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    window.__vcomRingGain = master;
    window.__vcomRingOn = true;
    var notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
    var step = 0.22;
    var play = function () {
      if (!window.__vcomRingOn) return;
      var t0 = ctx.currentTime + 0.02;
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var start = t0 + i * step;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.85, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + step - 0.02);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + step);
      });
    };
    play();
    window.__vcomRingTimer = setInterval(play, 2400);
  }
  function unlockRing() {
    if (ringUnlocked) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      if (!window.__vcomToneCtx) window.__vcomToneCtx = new Ctx();
      if (window.__vcomToneCtx.resume) window.__vcomToneCtx.resume();
    }
    ringAudio.volume = 0.01;
    var pending = ringAudio.play();
    var done = function () {
      ringAudio.pause();
      try { ringAudio.currentTime = 0; } catch (e) {}
      ringAudio.volume = 1;
      ringUnlocked = true;
    };
    if (pending && pending.then) pending.then(done).catch(function () {});
    else done();
  }
  document.addEventListener("pointerdown", unlockRing, true);
  document.addEventListener("touchend", unlockRing, true);
  document.addEventListener("keydown", unlockRing, true);
  window.vcomStartRing = function () {
    if (window.__vcomRinging) return;
    window.__vcomRinging = true;
    window.__vcomRingPlays = (window.__vcomRingPlays || 0) + 1;
    var menu = document.getElementById("vcom-link-menu");
    if (menu) menu.hidden = true;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    ringAudio.muted = false;
    ringAudio.volume = 1;
    ringAudio.loop = true;
    try { ringAudio.currentTime = 0; } catch (e) {}
    var pending = ringAudio.play();
    if (pending && pending.then) {
      pending.then(function () { window.__vcomRingErr = ""; stopOsc(); }).catch(function (err) {
        window.__vcomRingErr = String(err && err.message || err);
        if (window.__vcomRinging) startOsc();
      });
    } else if (ringAudio.paused) startOsc();
  };
  window.vcomStopRing = function () {
    window.__vcomRinging = false;
    try { ringAudio.pause(); ringAudio.currentTime = 0; } catch (e) {}
    stopOsc();
    if (window.__vcomReleasing) return;
    if (!window.__vcomSpeakerTouched) {
      window.__vcomSpeaker = false;
      try { if (navigator.audioSession) navigator.audioSession.type = "play-and-record"; } catch (e) {}
      if (window.vcomRouteOutputs) window.vcomRouteOutputs();
    }
  };
  var MEDIA_KEY = "vcom.media.granted.v1";
  function mediaGranted() {
    try { return JSON.parse(localStorage.getItem(MEDIA_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function rememberMedia(stream) {
    var prev = mediaGranted();
    var next = {
      audio: !!(prev.audio || (stream && stream.getAudioTracks && stream.getAudioTracks().length)),
      video: !!(prev.video || (stream && stream.getVideoTracks && stream.getVideoTracks().length))
    };
    try { localStorage.setItem(MEDIA_KEY, JSON.stringify(next)); } catch (e) {}
  }
  window.vcomCallHasVideo = function (stream) {
    if (!stream || !stream.getVideoTracks) return false;
    var tracks = stream.getVideoTracks();
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i] && tracks[i].readyState !== "ended") return true;
    }
    return false;
  };
  window.vcomNoteLocalVideo = function (stream) {
    if (!window.vcomCallHasVideo(stream)) return false;
    var ids = window.__vcomLocalVideoIds || (window.__vcomLocalVideoIds = {});
    stream.getVideoTracks().forEach(function (track) {
      if (track && track.id && track.readyState !== "ended") ids[track.id] = 1;
    });
    return true;
  };
  window.vcomStreamIsLocal = function (stream) {
    if (!window.vcomCallHasVideo(stream)) return false;
    var ids = window.__vcomLocalVideoIds || {};
    var tracks = stream.getVideoTracks();
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i] && ids[tracks[i].id]) return true;
    }
    return false;
  };
  window.vcomMergeTrackStream = function (holder, event) {
    holder = holder || {};
    var incoming = event && event.streams && event.streams[0];
    if (incoming) {
      holder.stream = incoming;
      return incoming;
    }
    if (!holder.stream) {
      if (typeof MediaStream === "function") holder.stream = new MediaStream();
      else holder.stream = {
        _tracks: [],
        addTrack: function (track) { this._tracks.push(track); },
        getTracks: function () { return this._tracks.slice(); },
        getVideoTracks: function () {
          return this._tracks.filter(function (track) { return track.kind === "video"; });
        },
        getAudioTracks: function () {
          return this._tracks.filter(function (track) { return track.kind === "audio"; });
        }
      };
    }
    if (event && event.track) {
      try { holder.stream.addTrack(event.track); } catch (eAdd) {}
    }
    return holder.stream;
  };
  window.vcomVideoIsLocal = function (el) {
    if (!el) return false;
    if (el.__vcomKind === "remote") return false;
    if (el.__vcomKind === "local") return true;
    if (el.id === "vcom-guest-local-video" || el.id === "vcom-stage-local") return true;
    if (el.getAttribute && el.getAttribute("data-vcom-local") === "1") return true;
    if (el.getAttribute && el.getAttribute("data-vcom-kind") === "local") return true;
    if (el.getAttribute && el.getAttribute("data-local") != null) return true;
    var id = String(el.id || "");
    if (/local/i.test(id) && !/remote/i.test(id)) return true;
    if (window.vcomStreamIsLocal(el.srcObject)) return true;
    if (el.style && /scaleX\(\s*-1\s*\)/.test(String(el.style.transform || ""))) return true;
    return false;
  };
  function ensureVideoSkin() {
    if (window.__vcomVideoSkin) return;
    window.__vcomVideoSkin = true;
    var skin = document.createElement("style");
    skin.id = "vcom-video-skin";
    skin.textContent = ""
      + "video[id^=\"video_\"].vcom-pip{position:fixed!important;top:var(--vcom-top)!important;left:var(--vcom-left)!important;width:var(--vcom-w)!important;height:var(--vcom-h)!important;right:auto!important;bottom:auto!important;margin:0!important;object-fit:cover!important;object-position:center center!important;pointer-events:none!important;background:#000!important;overflow:hidden!important;opacity:1!important;max-width:none!important;max-height:none!important}"
      + "video[id^=\"video_\"].vcom-pip[data-vcom-local=\"1\"]{z-index:10030!important;border-radius:16px!important;transform:scaleX(-1)!important}"
      + "video[id^=\"video_\"].vcom-pip:not([data-vcom-local=\"1\"]){z-index:10020!important;border-radius:0!important;transform:none!important}"
      + "#vcom-guest-remote-video,#vcom-stage-remote{position:fixed!important;margin:0!important;object-fit:cover!important;object-position:center center!important;z-index:10020!important;background:#000!important;pointer-events:none!important}"
      + "#vcom-guest-local-video,#vcom-stage-local{position:fixed!important;margin:0!important;object-fit:cover!important;object-position:center center!important;z-index:10021!important;background:#111!important;pointer-events:none!important;transform:scaleX(-1)!important}"
      + "[data-vcom-kind][hidden],video[id^=\"video_\"][hidden]{display:none!important}";
    try { document.head.appendChild(skin); } catch (eSkin) {}
  }
  function dockInsets() {
    var vh = window.innerHeight || 0;
    var head = 108;
    var dock = 168;
    if (vh) {
      head = Math.round(Math.max(96, vh * 0.12));
      dock = Math.round(Math.max(148, vh * 0.2));
    }
    return { head: head, dock: dock, vh: vh };
  }
  function snapPx(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.round(n / 2) * 2;
  }
  function placeCallVideo(el, kind, rect) {
    if (!el) return false;
    if (!rect && el.__vcomBox) return false;
    var top, left, width, height, right, bottom, radius;
    if (rect && kind === "local") {
      top = snapPx(rect.top) + "px";
      left = snapPx(rect.left) + "px";
      width = snapPx(rect.width) + "px";
      height = snapPx(rect.height) + "px";
      right = "auto";
      bottom = "auto";
      radius = Math.round(Math.max(18, Math.min(28, rect.width * 0.14))) + "px";
    } else if (rect && kind === "remote") {
      var insets = dockInsets();
      var boxTop = rect.top;
      var boxBottom = rect.top + rect.height;
      if (insets.vh && rect.height > insets.vh * 0.55) {
        if (boxTop < insets.head) boxTop = insets.head;
        if (boxBottom > insets.vh - insets.dock) boxBottom = insets.vh - insets.dock;
      }
      var boxHeight = snapPx(boxBottom - boxTop);
      if (boxHeight < 80) {
        boxTop = rect.top;
        boxHeight = snapPx(rect.height);
      }
      top = snapPx(boxTop) + "px";
      left = snapPx(rect.left) + "px";
      width = snapPx(rect.width) + "px";
      height = boxHeight + "px";
      right = "auto";
      bottom = "auto";
      radius = "0";
    } else if (kind === "local") {
      top = "calc(env(safe-area-inset-top, 0px) + 12px)";
      left = "8px";
      width = "min(168px, 40vw)";
      height = "min(292px, 36vh)";
      right = "auto";
      bottom = "auto";
      radius = "24px";
    } else {
      var fallback = dockInsets();
      top = fallback.head + "px";
      left = "0px";
      width = "100%";
      height = "auto";
      right = "0px";
      bottom = fallback.dock + "px";
      radius = "0";
    }
    var sig = [kind, top, left, width, height, right, bottom, radius].join("|");
    if (el.__vcomBox === sig) return false;
    el.__vcomBox = sig;
    el.style.position = "fixed";
    el.style.top = top;
    el.style.left = left;
    el.style.width = width;
    el.style.height = height;
    el.style.right = right;
    el.style.bottom = bottom;
    el.style.borderRadius = radius;
    el.style.objectFit = "cover";
    el.style.objectPosition = "center center";
    el.style.margin = "0";
    el.style.zIndex = kind === "local" ? "10021" : "10020";
    el.style.pointerEvents = "none";
    el.style.background = kind === "local" ? "#111" : "#000";
    el.style.transform = kind === "local" ? "scaleX(-1)" : "translateZ(0)";
    return true;
  }
  window.vcomAttachCallVideo = function (el, stream, kind, rect) {
    if (!el || !window.vcomCallHasVideo(stream)) return { ok: false, reason: "no-video" };
    if (isFlutterVideo(el)) {
      if (kind === "local") {
        try { el.setAttribute("data-vcom-local", "1"); } catch (eLocal) {}
      }
      if (el.srcObject !== stream) el.srcObject = stream;
      fitFlutterVideo(el);
      return { ok: true, kind: videoIsLocalPreview(el) ? "local" : "remote", slot: true };
    }
    if (kind !== "local" && kind !== "remote") kind = window.vcomVideoIsLocal(el) ? "local" : "remote";
    ensureVideoSkin();
    if (el.__vcomStream === stream && el.__vcomKind === kind && el.__vcomLifted && !el.hidden) {
      placeCallVideo(el, kind, rect);
      return { ok: true, kind: kind, stable: true };
    }
    if (el.srcObject !== stream) el.srcObject = stream;
    el.autoplay = true;
    el.muted = true;
    el.playsInline = true;
    el.hidden = false;
    el.__vcomStream = stream;
    el.__vcomKind = kind;
    el.__vcomLifted = true;
    try { el.removeAttribute("hidden"); } catch (eHid) {}
    try {
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("data-vcom-lifted", "1");
      el.setAttribute("data-vcom-kind", kind);
    } catch (eAttr) {}
    placeCallVideo(el, kind, rect);
    if (el.paused !== false) {
      var play = el.play && el.play();
      if (play && play.catch) play.catch(function () {});
    }
    return { ok: true, kind: kind };
  };
  window.vcomHideLiftedVideo = function (el) {
    if (!el) return;
    el.hidden = true;
    el.__vcomLifted = false;
    el.__vcomBox = "";
    el.__vcomPinSig = "";
    el.__vcomPipRect = null;
    el.__vcomPipFallback = false;
    el.__vcomPlayed = false;
    el.__vcomSlotFit = false;
    try { el.setAttribute("hidden", "true"); } catch (eHid) {}
    try { el.removeAttribute("data-vcom-pinned"); } catch (ePin) {}
    el.style.zIndex = "0";
    el.style.width = "0";
    el.style.height = "0";
  };
  function styleProp(el, prop, value) {
    var camel = prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (!el.style) el.style = {};
    if (el.style.setProperty) {
      try { el.style.setProperty(prop, value, "important"); } catch (eSet) {}
    }
    el.style[camel] = value;
  }
  function clearProp(el, prop) {
    var camel = prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (el.style && el.style.removeProperty) {
      try { el.style.removeProperty(prop); } catch (eClear) {}
    }
    if (el.style) el.style[camel] = "";
  }
  function isFlutterVideo(video) {
    return String(video && video.id || "").indexOf("video_") === 0;
  }
  function videoIsLocalPreview(video) {
    if (!video || !video.getAttribute) return false;
    if (video.getAttribute("data-vcom-local") === "1") return true;
    if (video.getAttribute("data-vcom-kind") === "local") return true;
    return video.id === "vcom-guest-local-video";
  }
  function platformViewOf(video) {
    var node = video && video.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (String(node.tagName || "").toUpperCase() === "FLT-PLATFORM-VIEW") return node;
      node = node.parentElement;
    }
    return null;
  }
  function emptyPlatformView() {
    var views = [];
    try { views = document.querySelectorAll("flt-platform-view"); } catch (eQ) { views = []; }
    for (var i = 0; i < views.length; i++) {
      var view = views[i];
      if (!view || view === document.body) continue;
      if (String(view.tagName || "").toUpperCase() !== "FLT-PLATFORM-VIEW") continue;
      var occupied = false;
      try {
        if (view.querySelector && view.querySelector("video")) occupied = true;
      } catch (eHas) {}
      if (!occupied && view.children && view.children.length) {
        for (var c = 0; c < view.children.length; c++) {
          if (String(view.children[c].tagName || "").toUpperCase() === "VIDEO") occupied = true;
        }
      }
      if (!occupied) return view;
    }
    return null;
  }
  function readBox(node) {
    if (!node || !node.getBoundingClientRect) return null;
    try {
      var rect = node.getBoundingClientRect();
      if (!rect || rect.width < 8 || rect.height < 8) return null;
      return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    } catch (eBox) { return null; }
  }
  function isLocalFrame(box) {
    if (!box) return false;
    if (box.width < 72 || box.width > 200 || box.height < 100 || box.height > 280) return false;
    var ratio = box.height / box.width;
    return ratio >= 1.05 && ratio <= 2.2;
  }
  function styleValue(node, prop) {
    if (!node || !node.style) return "";
    try {
      if (node.style.getPropertyValue) {
        var value = node.style.getPropertyValue(prop);
        if (value) return value;
      }
    } catch (eStyle) {}
    return "";
  }
  function frameFromClip(node) {
    var current = node;
    var guard = 0;
    while (current && guard < 12) {
      var clip = styleValue(current, "clip-path");
      var match = /rect\(\s*([0-9.]+)px\s+([0-9.]+)px\s+([0-9.]+)px\s+([0-9.]+)px/i.exec(clip || "");
      if (match) {
        var insetTop = parseFloat(match[1]);
        var insetRight = parseFloat(match[2]);
        var insetBottom = parseFloat(match[3]);
        var insetLeft = parseFloat(match[4]);
        var width = insetRight - insetLeft;
        var height = insetBottom - insetTop;
        var frame = { top: 0, left: 0, width: width, height: height };
        if (isLocalFrame(frame)) {
          var host = readBox(current);
          if (host) {
            return { top: host.top + insetTop, left: host.left + insetLeft, width: width, height: height };
          }
        }
      }
      current = current.parentElement;
      guard += 1;
    }
    return null;
  }
  function shadowSlot(video) {
    var host = platformViewOf(video);
    if (!host || !host.getAttribute || !document.querySelector) return null;
    var name = "";
    try { name = host.getAttribute("slot") || ""; } catch (eSlot) {}
    if (!name || name.indexOf("\"") >= 0) return null;
    var glass = document.querySelector("flt-glass-pane");
    var shadow = glass && glass.shadowRoot;
    if (!shadow || !shadow.querySelector) return null;
    var slot = shadow.querySelector('slot[name="' + name + '"]');
    return slot ? (slot.parentElement || slot) : null;
  }
  function measuredPip(video) {
    var host = platformViewOf(video);
    var slot = shadowSlot(video);
    var clipped = frameFromClip(slot) || frameFromClip(host);
    if (isLocalFrame(clipped)) return clipped;
    var direct = readBox(slot) || readBox(host);
    if (isLocalFrame(direct)) return direct;
    var empty = emptyPlatformView();
    if (empty && empty !== host) {
      var vacant = readBox(empty);
      if (isLocalFrame(vacant)) return vacant;
    }
    return null;
  }
  function fallbackPip() {
    var view = document.querySelector && document.querySelector("flutter-view");
    var origin = readBox(view) || { top: 0, left: 0, width: 0, height: 0 };
    return { top: origin.top + 18, left: origin.left + 18, width: 108, height: 152 };
  }
  function lockPip(video, box, fallback) {
    var prev = video.__vcomPipRect;
    if (prev && !video.__vcomPipFallback) return prev;
    if (prev && video.__vcomPipFallback && fallback) return prev;
    video.__vcomPipRect = { top: box.top, left: box.left, width: box.width, height: box.height };
    video.__vcomPipFallback = !!fallback;
    return video.__vcomPipRect;
  }
  function farBox() {
    if (window.__vcomFarRect) return window.__vcomFarRect;
    var vh = window.innerHeight || 800;
    var vw = window.innerWidth || 400;
    var head = Math.round(Math.max(88, vh * 0.11));
    var dock = Math.round(Math.max(136, vh * 0.18));
    window.__vcomFarRect = { top: head, left: 0, width: vw, height: Math.max(120, vh - head - dock) };
    return window.__vcomFarRect;
  }
  function pinCallVideo(video, box, local) {
    var top = Math.round(box.top);
    var left = Math.round(box.left);
    var width = Math.round(box.width);
    var height = Math.round(box.height);
    var sig = [local ? "local" : "remote", top, left, width, height].join("|");
    if (video.classList && video.classList.add) {
      try { video.classList.add("vcom-pip"); } catch (eClass) {}
    }
    if (local) {
      try { video.setAttribute("data-vcom-local", "1"); } catch (eLocal) {}
    }
    video.__vcomPinSig = sig;
    styleProp(video, "--vcom-top", top + "px");
    styleProp(video, "--vcom-left", left + "px");
    styleProp(video, "--vcom-w", width + "px");
    styleProp(video, "--vcom-h", height + "px");
    styleProp(video, "position", "fixed");
    styleProp(video, "top", top + "px");
    styleProp(video, "left", left + "px");
    styleProp(video, "width", width + "px");
    styleProp(video, "height", height + "px");
    styleProp(video, "right", "auto");
    styleProp(video, "bottom", "auto");
    styleProp(video, "object-fit", "cover");
    styleProp(video, "object-position", "center center");
    styleProp(video, "border-radius", local ? "16px" : "0px");
    styleProp(video, "z-index", local ? "10030" : "10020");
    styleProp(video, "transform", local ? "scaleX(-1)" : "none");
    styleProp(video, "pointer-events", "none");
    styleProp(video, "margin", "0");
    styleProp(video, "opacity", "1");
    styleProp(video, "background", "#000");
    video.hidden = false;
    video.__vcomPinned = true;
    try { video.removeAttribute("hidden"); } catch (eHid) {}
    try { video.setAttribute("data-vcom-pinned", "1"); } catch (ePin) {}
    try { video.removeAttribute("data-vcom-lifted"); } catch (eLift) {}
    if (document.body && video.parentElement !== document.body && document.body.appendChild) {
      try { document.body.appendChild(video); } catch (eMove) {}
    }
    if (video.paused !== false && !video.__vcomPlayed) {
      video.__vcomPlayed = true;
      var play = video.play && video.play();
      if (play && play.catch) play.catch(function () {});
    }
  }
  function fitFlutterVideo(video) {
    var local = videoIsLocalPreview(video) || (window.vcomVideoIsLocal && window.vcomVideoIsLocal(video));
    if (local) {
      var measured = measuredPip(video);
      var box = lockPip(video, measured || fallbackPip(), !measured);
      pinCallVideo(video, box, true);
      return;
    }
    pinCallVideo(video, farBox(), false);
  }
  window.vcomLiftCallVideos = function () {
    ensureVideoSkin();
    ["vcom-stage-local", "vcom-stage-remote"].forEach(function (id) {
      var stage = document.getElementById(id);
      if (stage) window.vcomHideLiftedVideo(stage);
    });
    var nodes = document.querySelectorAll('video[id^="video_"], #vcom-guest-remote-video, #vcom-guest-local-video, #vcom-guest video[data-remote], #vcom-guest video[data-local]');
    var shown = 0;
    for (var i = 0; i < nodes.length; i++) {
      var video = nodes[i];
      var stream = video.srcObject;
      if (!window.vcomCallHasVideo(stream)) {
        if (video.__vcomPinned || video.__vcomPinSig || video.__vcomLifted || (video.getAttribute && (video.getAttribute("data-vcom-pinned") === "1" || video.getAttribute("data-vcom-lifted") === "1" || video.getAttribute("data-vcom-kind")))) {
          window.vcomHideLiftedVideo(video);
        }
        continue;
      }
      if (isFlutterVideo(video)) {
        fitFlutterVideo(video);
        shown += 1;
        continue;
      }
      if (video.parentElement !== document.body) {
        try { document.body.appendChild(video); } catch (eMove) {}
      }
      window.vcomAttachCallVideo(video, stream, window.vcomVideoIsLocal(video) ? "local" : "remote");
      shown += 1;
    }
    return { ok: true, shown: shown };
  };
  window.vcomOpenCallMedia = function (wantVideo) {
    var devices = navigator.mediaDevices;
    if (!devices || !devices.getUserMedia) return Promise.reject(new Error("no-media"));
    var gum = function (spec) { return devices.getUserMedia(spec); };
    var audio = { echoCancellation: true, noiseSuppression: true };
    if (!wantVideo) return gum({ audio: audio, video: false });
    return gum({ audio: audio, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } }).catch(function () {
      return gum({ audio: audio, video: true });
    }).catch(function () {
      return gum({ audio: true, video: true });
    }).catch(function () {
      return gum({ audio: audio, video: false });
    });
  };
  window.vcomApplyPwaLayout = function () {
    var standalone = false;
    try {
      standalone = !!(navigator.standalone);
      if (!standalone && window.matchMedia) standalone = !!window.matchMedia("(display-mode: standalone)").matches;
    } catch (ePwa) {}
    window.__vcomPwa = !!standalone;
    try {
      if (standalone) document.documentElement.classList.add("vcom-pwa");
      else document.documentElement.classList.remove("vcom-pwa");
    } catch (eClass) {}
    if (document.getElementById("vcom-pwa-skin")) return;
    var skin = document.createElement("style");
    skin.id = "vcom-pwa-skin";
    skin.textContent = "html.vcom-pwa,html.vcom-pwa body{height:100dvh;min-height:100dvh;min-height:-webkit-fill-available}html.vcom-pwa flt-glass-pane,html.vcom-pwa flutter-view{height:100%!important;min-height:100%}";
    document.head.appendChild(skin);
  };
  try { window.addEventListener("pageshow", function () { window.vcomApplyPwaLayout(); }); } catch (eShow) {}
  function isOnCall() {
    try {
      var bloc = window.__vcomBloc;
      if (bloc && bloc.c) {
        if (bloc.c.gnY && bloc.c.gnY()) return true;
        if (bloc.c.b) return true;
      }
    } catch (e) {}
    if (window.__vcomRinging) return true;
    var call = document.getElementById("call-layer");
    if (call && !call.hidden) return true;
    var incoming = document.getElementById("incoming-layer");
    if (incoming && !incoming.hidden) return true;
    var guestCall = document.querySelector("#vcom-guest [data-view=call]");
    if (guestCall && !guestCall.hidden) return true;
    return false;
  }
  function appHomeUrl() {
    try {
      if (/\.web\.app$/.test(location.hostname) || /firebaseapp\.com$/.test(location.hostname)) return "/?signup=1";
    } catch (e) {}
    return "./?signup=1";
  }
  function accountEmailFromName(name) {
    try {
      if (typeof window.vcomAccountEmail === "function") {
        var mapped = window.vcomAccountEmail(name);
        if (mapped) return mapped;
      }
    } catch (e) {}
    var value = String(name || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    if (!value) return "";
    if (value.indexOf("@") >= 0) return value.toLowerCase();
    value = value.toLowerCase();
    var h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x811c9dc5, h4 = 0x9e3779b9;
    for (var i = 0; i < value.length; i++) {
      var c = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ (c >>> 8), 0x01000193);
      h3 = Math.imul(h3 + c, 0x85ebca6b);
      h4 = Math.imul(h4 ^ c, 0xc2b2ae35);
    }
    function hex32(n) { return ("00000000" + (n >>> 0).toString(16)).slice(-8); }
    return "n" + hex32(h1) + hex32(h2) + hex32(h3) + hex32(h4) + "@voip-call-app-7d0c3.web.app";
  }
  function tempSignupPhone() {
    for (var i = 0; i < 10; i++) {
      var n = "020" + String(100000 + Math.floor(Math.random() * 900000));
      if (/^020\d{6}$/.test(n)) return n;
    }
    return "020" + String(Date.now()).slice(-6);
  }
  function wireMediaPersist() {
    var devices = navigator.mediaDevices;
    if (!devices || !devices.getUserMedia || devices.getUserMedia.__vcomPersist) return;
    var raw = devices.getUserMedia.bind(devices);
    devices.getUserMedia = function (constraints) {
      return raw(constraints).then(function (stream) {
        rememberMedia(stream);
        if (window.vcomNoteLocalVideo) window.vcomNoteLocalVideo(stream);
        return stream;
      });
    };
    devices.getUserMedia.__vcomPersist = true;
    if (navigator.permissions && navigator.permissions.query && !navigator.permissions.query.__vcomPersist) {
      var origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function (desc) {
        var name = desc && desc.name;
        var mem = mediaGranted();
        if ((name === "microphone" && mem.audio) || (name === "camera" && mem.video)) {
          return Promise.resolve({
            state: "granted",
            onchange: null,
            addEventListener: function () {},
            removeEventListener: function () {}
          });
        }
        return origQuery(desc);
      };
      navigator.permissions.query.__vcomPersist = true;
    }
  }
  var UPDATE_SEEN_KEY = "vcom_update_seen";
  var UPDATE_PENDING_KEY = "vcom_pending_revision";
  function seenUpdateRevision() {
    try { return Number(localStorage.getItem(UPDATE_SEEN_KEY) || 0) || 0; } catch (e) { return 0; }
  }
  function pendingUpdateRevision() {
    try { return Number(localStorage.getItem(UPDATE_PENDING_KEY) || 0) || 0; } catch (e) { return 0; }
  }
  function rememberPendingRevision(revision) {
    try { localStorage.setItem(UPDATE_PENDING_KEY, String(revision)); } catch (e) {}
  }
  function rememberSeenRevision(revision) {
    try {
      localStorage.setItem(UPDATE_SEEN_KEY, String(revision));
      localStorage.setItem("vcom_revision", String(revision));
      localStorage.removeItem(UPDATE_PENDING_KEY);
    } catch (e) {}
  }
  function applyAppUpdate(revision) {
    revision = Number(revision || window.__vcomPendingRevision || pendingUpdateRevision() || 0);
    if (!revision) return;
    rememberSeenRevision(revision);
    window.__vcomPendingRevision = 0;
    var done = function () { location.replace("/?upd=" + revision); };
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) {
      done();
      return;
    }
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
    }).then(function () {
      if (!window.caches || !caches.keys) return;
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      });
    }).then(done).catch(done);
  }
  function revealUpdateBar() {
    if (guestCode) return;
    var bar = document.getElementById("vcom-update");
    var revision = Number(window.__vcomPendingRevision || pendingUpdateRevision() || 0);
    if (!bar || !revision || revision <= seenUpdateRevision()) return;
    window.__vcomPendingRevision = revision;
    var span = bar.querySelector("span");
    if (span) span.textContent = "קיימת גרסה חדשה לאפליקציה";
    if (isOnCall()) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    try { bar.removeAttribute("hidden"); } catch (e) {}
  }
  function offerUpdate(revision) {
    revision = Number(revision || 0);
    if (!revision || guestCode) return;
    if (revision <= seenUpdateRevision()) {
      if (revision === seenUpdateRevision()) {
        try { localStorage.removeItem(UPDATE_PENDING_KEY); } catch (e) {}
      }
      return;
    }
    window.__vcomPendingRevision = revision;
    rememberPendingRevision(revision);
    revealUpdateBar();
  }
  function revisionFromSnap(snap) {
    try {
      var exists = snap && (typeof snap.exists === "function" ? snap.exists() : !!snap.exists);
      if (!exists) return 0;
      return Number((snap.data() || {}).revision || 0) || 0;
    } catch (e) { return 0; }
  }
  function attachUpdateWatch(fs, db) {
    if (!fs || !db || !fs.doc) return false;
    var ref = fs.doc(db, "app", "update");
    var fromSnap = function (snap) { offerUpdate(revisionFromSnap(snap)); };
    if (fs.getDoc) fs.getDoc(ref).then(fromSnap).catch(function () {});
    if (attachUpdateWatch.attached) return true;
    attachUpdateWatch.attached = true;
    if (fs.onSnapshot) fs.onSnapshot(ref, fromSnap, function () {});
    return true;
  }
  function wireUpdateBar() {
    var bar = document.getElementById("vcom-update");
    if (!bar || bar.__vcomWired) return;
    bar.__vcomWired = true;
    if (!document.getElementById("vcom-update-skin")) {
      var skin = document.createElement("style");
      skin.id = "vcom-update-skin";
      skin.textContent = "#vcom-update{z-index:10050!important}";
      document.head.appendChild(skin);
    }
    var span = bar.querySelector("span");
    if (span) span.textContent = "קיימת גרסה חדשה לאפליקציה";
    var go = document.getElementById("vcom-update-go");
    if (go && !go.__vcomWired) {
      go.__vcomWired = true;
      go.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        applyAppUpdate(window.__vcomPendingRevision || pendingUpdateRevision());
      }, true);
    }
    new MutationObserver(function () {
      if (!(window.__vcomPendingRevision || pendingUpdateRevision())) return;
      if (isOnCall()) {
        bar.hidden = true;
        return;
      }
      if (bar.hidden) bar.hidden = false;
    }).observe(bar, { attributes: true, attributeFilter: ["hidden"] });
    setInterval(function () {
      if (window.__vcomPendingRevision || pendingUpdateRevision()) revealUpdateBar();
    }, 4000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        offerUpdate(pendingUpdateRevision());
        revealUpdateBar();
      }
    });
    window.addEventListener("pageshow", function () {
      offerUpdate(pendingUpdateRevision());
      revealUpdateBar();
    });
    offerUpdate(pendingUpdateRevision());
    watchRemoteUpdate();
  }
  function watchRemoteUpdate() {
    if (guestCode) return;
    offerUpdate(pendingUpdateRevision());
    if (watchRemoteUpdate.started) return;
    function hostFs() {
      var fs = window.firebase_firestore;
      if (!fs || !fs.onSnapshot || !fs.doc || !fs.getFirestore) return null;
      try { return { fs: fs, db: fs.getFirestore() }; } catch (e) { return null; }
    }
    var host = hostFs();
    if (host && attachUpdateWatch(host.fs, host.db)) {
      watchRemoteUpdate.started = true;
      return;
    }
    if (watchRemoteUpdate.pollHost) return;
    var tries = 0;
    watchRemoteUpdate.pollHost = setInterval(function () {
      tries += 1;
      var ready = hostFs();
      if (ready && attachUpdateWatch(ready.fs, ready.db)) {
        clearInterval(watchRemoteUpdate.pollHost);
        watchRemoteUpdate.started = true;
        return;
      }
      if (tries > 150) clearInterval(watchRemoteUpdate.pollHost);
    }, 300);
  }
  function wireApproval() {
    var card = document.querySelector(".vcom-approval-card");
    if (!card || card.__vcomWired) return;
    card.__vcomWired = true;
    var h2 = card.querySelector("h2");
    var p = card.querySelector("p");
    if (h2) h2.textContent = "הבקשה נשלחה בהצלחה";
    if (p) {
      p.innerHTML = 'אנו נעדכן כאן שהמנוי שלך אושר.<br>בברכה, צוות <span class="vcom-word" dir="ltr"><span class="v">V</span><span class="com">COM</span></span>';
    }
    if (!document.getElementById("vcom-approval-skin")) {
      var skin = document.createElement("style");
      skin.id = "vcom-approval-skin";
      skin.textContent = ".vcom-word .v{color:#34C759;font-weight:700}.vcom-word .com{color:#007AFF;font-weight:700}";
      document.head.appendChild(skin);
    }
  }
  function wantsSignup() {
    try { return new URLSearchParams(location.search).get("signup") === "1"; } catch (e) { return false; }
  }
  function wireSignupLanding() {
    if (guestCode || !wantsSignup()) return;
    if (document.getElementById("vcom-signup")) return;
    try {
      var authNow = window.firebase_auth;
      if (authNow && authNow.getAuth && authNow.getAuth().currentUser) return;
    } catch (e) {}
    var wrap = document.createElement("section");
    wrap.id = "vcom-signup";
    wrap.innerHTML = ""
      + '<div class="vcom-signup-card">'
      + '<img class="vcom-signup-logo" src="/icons/vcom-splash.png?v=call11" alt="">'
      + '<h1 class="vcom-signup-brand" dir="ltr"><span class="v">V</span><span class="com">COM</span></h1>'
      + "<h2>הרשמה</h2>"
      + "<p>צור חשבון חדש לשיחות קול</p>"
      + '<form id="vcom-signup-form">'
      + '<input id="vcom-signup-name" type="text" autocomplete="name" placeholder="שם המנוי ב-VCOM" required>'
      + '<input id="vcom-signup-pass" type="password" autocomplete="new-password" placeholder="סיסמה" required minlength="6">'
      + '<input id="vcom-signup-pass2" type="password" autocomplete="new-password" placeholder="אימות סיסמה" required minlength="6">'
      + '<p id="vcom-signup-error" hidden></p>'
      + '<button type="submit">הירשם</button>'
      + "</form></div>";
    var skin = document.createElement("style");
    skin.textContent = ""
      + "#vcom-signup{position:fixed;inset:0;z-index:12000;background:#F2F2F7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1C1E}"
      + ".vcom-signup-card{width:min(420px,100%);text-align:center}"
      + ".vcom-signup-logo{width:88px;height:88px;object-fit:contain}"
      + ".vcom-signup-brand{margin:8px 0 0;font-size:34px;font-weight:700;letter-spacing:0}"
      + ".vcom-signup-brand .v{color:#34C759}.vcom-signup-brand .com{color:#007AFF}"
      + "#vcom-signup h2{margin:18px 0 6px;font-size:28px;font-weight:800}"
      + "#vcom-signup p{margin:0 0 18px;color:#8E8E93}"
      + "#vcom-signup form{display:flex;flex-direction:column;gap:10px}"
      + "#vcom-signup input{border:0;background:#fff;border-radius:14px;padding:14px 16px;font:inherit;text-align:right;box-shadow:0 8px 24px rgba(28,39,61,.08)}"
      + "#vcom-signup button{border:0;background:#007AFF;color:#fff;border-radius:14px;padding:14px;font:700 17px/1 inherit}"
      + "#vcom-signup-error{color:#FF3B30;font-size:14px}";
    document.head.appendChild(skin);
    document.body.appendChild(wrap);
    var form = document.getElementById("vcom-signup-form");
    var err = document.getElementById("vcom-signup-error");
    function fail(msg) {
      err.hidden = false;
      err.textContent = msg;
    }
    function writeProfile(uid, email, displayName) {
      var fs = window.firebase_firestore;
      if (!fs || !fs.getFirestore || !fs.doc || !fs.setDoc || !uid) return Promise.resolve();
      var db = fs.getFirestore();
      var phone = tempSignupPhone();
      var userDoc = {
        email: email,
        phoneNumber: phone,
        createdAt: new Date(),
        approved: false,
        lineActive: false
      };
      if (displayName) userDoc.name = displayName;
      return fs.setDoc(fs.doc(db, "users", uid), userDoc).then(function () {
        if (!fs.doc(db, "phoneNumbers", phone)) return;
        return fs.setDoc(fs.doc(db, "phoneNumbers", phone), { userId: uid });
      }).catch(function () {});
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var rawName = (document.getElementById("vcom-signup-name").value || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
      var pass = document.getElementById("vcom-signup-pass").value || "";
      var pass2 = document.getElementById("vcom-signup-pass2").value || "";
      err.hidden = true;
      if (!rawName) return fail("נא למלא שם מנוי");
      if (pass.length < 6) return fail("הסיסמה חייבת 6 תווים לפחות");
      if (pass !== pass2) return fail("הסיסמאות אינן תואמות");
      var email = accountEmailFromName(rawName);
      if (!email) return fail("לא ניתן ליצור חשבון מהשם הזה");
      try { window.__vcomSignupName = rawName.indexOf("@") >= 0 ? "" : rawName; } catch (e) {}
      function createWith(auth) {
        if (!auth || !auth.getAuth || !auth.createUserWithEmailAndPassword) return Promise.reject(new Error("no-auth"));
        return auth.createUserWithEmailAndPassword(auth.getAuth(), email, pass);
      }
      var run = createWith(window.firebase_auth);
      if (!window.firebase_auth || !window.firebase_auth.createUserWithEmailAndPassword) {
        run = Promise.all([
          import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js")
        ]).then(function (mods) {
          var app;
          try { app = mods[0].getApp(); } catch (e2) { app = mods[0].initializeApp(firebaseConfig); }
          return mods[1].createUserWithEmailAndPassword(mods[1].getAuth(app), email, pass);
        });
      }
      run.then(function (cred) {
        var uid = cred && cred.user && cred.user.uid;
        return writeProfile(uid, email, rawName.indexOf("@") >= 0 ? "" : rawName).then(function () {
          wrap.remove();
        });
      }).catch(function (e) {
        var code = String((e && e.code) || "");
        if (code.indexOf("email-already-in-use") >= 0) return fail("השם כבר רשום. התחברו.");
        fail("לא ניתן להשלים הרשמה כרגע");
      });
    });
  }
    function bootChrome() {
    wireMediaPersist();
    window.vcomApplyPwaLayout();
    if (!window.__vcomLiftTimer) {
      window.__vcomLiftTimer = setInterval(function () {
        if (window.vcomLiftCallVideos) window.vcomLiftCallVideos();
      }, 800);
    }
    wireUpdateBar();
    wireApproval();
    wireSignupLanding();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      wireUpdateBar();
      wireApproval();
      wireSignupLanding();
      if (tries > 40) clearInterval(timer);
    }, 400);
  }
  bootChrome();

  window.vcomLinkStillVisible = function (row, now) {
    now = now == null ? Date.now() : now;
    if (!row || !row.code) return false;
    if (row.status === "ended") return false;
    var exp = asMillis(row.expiresAt);
    if (exp && exp <= now) return row.status === "active";
    return true;
  };

  window.vcomGuestStillDialable = function (row, now) {
    now = now == null ? Date.now() : now;
    if (!row || !row.code) return false;
    var exp = asMillis(row.expiresAt);
    if (exp && exp <= now && row.status !== "active") return false;
    return true;
  };

  window.vcomIgnoreStaleEnded = function (data, offerSent) {
    if (offerSent) return false;
    return !data || data.status === "ended";
  };

  window.vcomGuestResumeFromEnded = function (data, endingVisit) {
    if (!endingVisit || !data || !data.offer) return false;
    return data.status === "ringing" || data.status === "waiting";
  };

  window.vcomGuestCode = function (phone) {
    var key = digits(phone);
    var raw = String(phone || "").replace(/^\s+|\s+$/g, "").toLowerCase();
    window.__vcomGuestLookups = window.__vcomGuestLookups || [];
    if (window.__vcomGuestLookups.length < 20) window.__vcomGuestLookups.push(key || raw);
    var book = window.__vcomGuestBook || {};
    if (!key) return "";
    var row = book[key];
    if (window.vcomGuestStillDialable(row)) return row.code;
    return "";
  };

  window.vcomPlaceLinkCall = function (row, io) {
    io = io || {};
    var phone = digits(row && (row.phone || row.tempPhone));
    var code = row && row.code;
    if (!phone || !code) return { ok: false, reason: "missing" };
    if (!window.vcomLinkStillVisible(row)) return { ok: false, reason: "expired" };
    var busy = false;
    try { busy = !!(io.fy && io.fy()); } catch (eFy) {}
    try { if (io.isOnCall && io.isOnCall()) busy = true; } catch (eOn) {}
    if (busy) return { ok: false, reason: "busy" };
    if (io.closeDrawer) io.closeDrawer();
    if (io.pasteDigits) io.pasteDigits(phone);
    if (typeof io.dialPress === "function") {
      io.dialPress();
      return { ok: true, phone: phone, via: "keypad" };
    }
    return { ok: false, reason: "no-keypad" };
  };

  window.vcomShouldAutoStartGuest = function () {
    return false;
  };

  window.vcomParseMedia = function (text) {
    var raw = String(text || "");
    if (raw.indexOf("vcom-media\n") !== 0) return null;
    var parts = raw.split("\n");
    var kind = parts[1] || "";
    var url = parts.slice(2).join("\n");
    if (kind !== "image" && kind !== "video" && kind !== "audio") return null;
    if (!/^https:\/\//.test(url) && !/^data:(image|audio|video)\//.test(url)) return null;
    return { kind: kind, url: url };
  };
  window.vcomMediaLabel = function (text) {
    var media = window.vcomParseMedia(text);
    if (!media) return "";
    if (media.kind === "audio") return "הודעה קולית";
    if (media.kind === "video") return "סרטון";
    return "תמונה";
  };
  window.vcomEncodeMedia = function (kind, url) {
    return "vcom-media\n" + kind + "\n" + url;
  };
  window.vcomDrawerTapShouldClose = function (point) {
    point = point || {};
    if ((window.__vcomDrawerX || 0) < 0.5) return false;
    if (point.insideMenu) return false;
    var width = window.__vcomDrawerWidth >= 200 ? window.__vcomDrawerWidth : 304;
    var rtl = point.rtl !== false;
    var x = Number(point.x) || 0;
    var view = Number(point.viewWidth) || 0;
    var inDrawer = rtl ? x > view - width : x < width;
    return !inDrawer;
  };
  window.vcomComposerOnScreen = function (labels) {
    if (labels == null) return null;
    for (var i = 0; i < labels.length; i++) {
      var item = labels[i] || {};
      if (!item.visible) continue;
      var label = String(item.label || "").replace(/\s+/g, " ").trim();
      if (label === "הודעה") return true;
      if (item.bottom && item.role === "textbox" && label !== "הודעות") return true;
    }
    return false;
  };
  window.vcomChatSurfaceOpen = function (chat, tab, chatTab, blocked) {
    if (!chat) return false;
    if (blocked) return false;
    if (chatTab == null || chatTab === "") return false;
    return (tab | 0) === (chatTab | 0);
  };
  window.vcomCloseSideMenu = function () {
    var state = window.__vcomDrawerState;
    if (state && typeof state.aJ === "function") {
      try { state.aJ(0); return true; } catch (eClose) {}
    }
    if (typeof window.__vcomDrawerMove === "function") window.__vcomDrawerMove(0);
    return false;
  };
  window.vcomDefaultSpeakerOn = false;
  window.vcomCallAudioRoute = function (speakerOn) {
    return speakerOn ? "speaker" : "earpiece";
  };
  window.vcomPickAudioSink = function (devices, speakerOn) {
    var speaker = "";
    var ear = "";
    var comm = "";
    (devices || []).forEach(function (device) {
      if (!device || device.kind !== "audiooutput") return;
      var id = String(device.deviceId || "");
      var label = String(device.label || "").toLowerCase();
      if (id === "communications" || /communication/.test(label)) comm = id;
      if (/speaker|loud/.test(label)) speaker = id;
      if (/earpiece|receiver|handset|telephony/.test(label) && !/speaker|loud/.test(label)) ear = id;
    });
    if (speakerOn) return speaker || "default";
    return ear || comm || "communications";
  };
  window.vcomApplyCallAudioRoute = function (el) {
    var speaker = !!window.__vcomSpeaker;
    var route = window.vcomCallAudioRoute(speaker);
    window.__vcomRingbackRoute = route;
    try {
      if (navigator.audioSession) navigator.audioSession.type = speaker ? "auto" : "play-and-record";
    } catch (eSess) {}
    if (el) el.volume = 1;
    function applySink(id) {
      window.__vcomRingbackSink = id;
      if (el && typeof el.setSinkId === "function" && id) {
        var pending = el.setSinkId(id);
        if (pending && pending.catch) pending.catch(function () {});
      }
    }
    applySink(speaker ? "default" : "communications");
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(function (devices) {
        applySink(window.vcomPickAudioSink(devices, speaker));
      }).catch(function () {});
    }
    if (window.vcomRouteOutputs) window.vcomRouteOutputs();
    return route;
  };
  function ringbackEl() {
    var el = document.getElementById("vcom-ringback");
    if (el) return el;
    el = document.createElement("audio");
    el.id = "vcom-ringback";
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.autoplay = true;
    el.hidden = true;
    (document.documentElement || document.body).appendChild(el);
    return el;
  }
  function closeRingbackGraph() {
    (window.__vcomRingbackNodes || []).forEach(function (node) {
      try { if (node.stop) node.stop(); } catch (eStop) {}
      try { if (node.disconnect) node.disconnect(); } catch (eDisc) {}
    });
    window.__vcomRingbackNodes = [];
  }
  function closeLoopback() {
    (window.__vcomLoopPcs || []).forEach(function (pc) {
      try { pc.close(); } catch (ePc) {}
    });
    window.__vcomLoopPcs = [];
  }
  function ringbackLive(gen) {
    return !!window.__vcomRingbackOn && gen === window.__vcomRingbackGen;
  }
  function attachVoiceLoopback(localStream, el, gen) {
    closeLoopback();
    if (!el || !localStream) return;
    try { el.removeAttribute("src"); el.src = ""; } catch (eSrc) {}
    if (typeof RTCPeerConnection !== "function") {
      el.srcObject = localStream;
      el.__vcomRingbackStream = localStream;
      window.__vcomRingbackKind = "mediastream";
      return;
    }
    var outgoing = new RTCPeerConnection({ iceServers: [] });
    var incoming = new RTCPeerConnection({ iceServers: [] });
    window.__vcomLoopPcs = [outgoing, incoming];
    (localStream.getAudioTracks ? localStream.getAudioTracks() : []).forEach(function (track) {
      outgoing.addTrack(track, localStream);
    });
    incoming.ontrack = function (event) {
      if (!ringbackLive(gen)) {
        try { if (event.track && event.track.stop) event.track.stop(); } catch (eLate) {}
        return;
      }
      var remote = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      el.srcObject = remote;
      el.__vcomRingbackStream = remote;
      window.__vcomRingbackKind = "webrtc";
      window.vcomApplyCallAudioRoute(el);
      var play = el.play && el.play();
      if (play && play.catch) play.catch(function () {});
    };
    function trickle(from, to) {
      from.onicecandidate = function (event) {
        if (event.candidate) to.addIceCandidate(event.candidate).catch(function () {});
      };
    }
    trickle(outgoing, incoming);
    trickle(incoming, outgoing);
    outgoing.createOffer().then(function (offer) {
      return outgoing.setLocalDescription(offer);
    }).then(function () {
      return incoming.setRemoteDescription(outgoing.localDescription);
    }).then(function () {
      return incoming.createAnswer();
    }).then(function (answer) {
      return incoming.setLocalDescription(answer);
    }).then(function () {
      return outgoing.setRemoteDescription(incoming.localDescription);
    }).catch(function () {
      if (!ringbackLive(gen)) return;
      el.srcObject = localStream;
      el.__vcomRingbackStream = localStream;
      window.__vcomRingbackKind = "mediastream";
      var play = el.play && el.play();
      if (play && play.catch) play.catch(function () {});
    });
  }
  function ensureRingbackStream(el, gen) {
    if (el && el.srcObject && el.__vcomRingbackStream && el.srcObject === el.__vcomRingbackStream && window.__vcomRingbackDest && ringbackLive(gen)) {
      return window.__vcomRingbackDest;
    }
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || !el) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = window.__vcomSpeaker ? "auto" : "play-and-record"; } catch (eSess) {}
    if (window.__vcomToneCtx && window.__vcomToneCtx.close) {
      try { window.__vcomToneCtx.close(); } catch (eOld) {}
      window.__vcomToneCtx = null;
    }
    if (window.__vcomRingbackCtx && window.__vcomRingbackCtx.close) {
      try { window.__vcomRingbackCtx.close(); } catch (eCtx) {}
    }
    closeLoopback();
    var ctx = new Ctx();
    window.__vcomRingbackCtx = ctx;
    if (ctx.resume) {
      try { ctx.resume(); } catch (eRes) {}
    }
    if (typeof ctx.createMediaStreamDestination !== "function") return null;
    var dest = ctx.createMediaStreamDestination();
    window.__vcomRingbackDest = dest;
    attachVoiceLoopback(dest.stream, el, gen);
    return dest;
  }
  function startVoiceRingback() {
    if (window.__vcomRingbackOn && window.__vcomRingbackTimer) return;
    var gen = (window.__vcomRingbackGen || 0) + 1;
    window.__vcomRingbackGen = gen;
    if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
    else if (!window.__vcomSpeakerTouched) {
      window.__vcomSpeaker = false;
      try { if (navigator.audioSession) navigator.audioSession.type = "play-and-record"; } catch (eEar) {}
    }
    window.__vcomRingbackOn = true;
    var el = ringbackEl();
    if (el) {
      el.__vcomRingbackEl = true;
      try { el.muted = false; } catch (eMute) {}
    }
    var dest = ensureRingbackStream(el, gen);
    window.vcomApplyCallAudioRoute(el);
    var play = el && el.play && el.play();
    if (play && play.catch) play.catch(function () {});
    function beep() {
      if (!ringbackLive(gen)) return;
      var ctx = window.__vcomRingbackCtx;
      dest = window.__vcomRingbackDest || dest;
      if (!ctx || !dest) return;
      closeRingbackGraph();
      window.vcomApplyCallAudioRoute(el);
      var gain = ctx.createGain();
      gain.gain.value = 0.22;
      gain.connect(dest);
      var now = ctx.currentTime;
      [440, 480].forEach(function (freq) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 1);
        window.__vcomRingbackNodes.push(osc);
      });
      window.__vcomRingbackNodes.push(gain);
    }
    if (window.__vcomRingbackTimer) clearInterval(window.__vcomRingbackTimer);
    beep();
    window.__vcomRingbackTimer = setInterval(beep, 4000);
    window.__vcomRingbackPlays = (window.__vcomRingbackPlays || 0) + 1;
  }
  window.vcomStartRingback = startVoiceRingback;
  window.__vcomVoiceRingback = startVoiceRingback;
  function silenceRingbackElement(el) {
    if (!el) return;
    var dedicated = !!(el.__vcomRingbackEl || el.id === "vcom-ringback");
    try { el.pause(); } catch (eP) {}
    if (dedicated) {
      try { el.autoplay = false; el.muted = true; } catch (eMute) {}
    }
    var stream = el.__vcomRingbackStream;
    var current = el.srcObject;
    if (stream && current === stream && stream.getTracks) {
      try { stream.getTracks().forEach(function (track) { try { track.stop(); } catch (eTrack) {} }); } catch (eTracks) {}
    }
    if (dedicated || (stream && current === stream)) {
      try { el.srcObject = null; } catch (eSrc) {}
    }
    el.__vcomRingbackStream = null;
  }
  window.vcomStopRingback = function () {
    window.__vcomRingbackOn = false;
    window.__vcomRingbackGen = (window.__vcomRingbackGen || 0) + 1;
    if (window.__vcomRingbackTimer) {
      clearInterval(window.__vcomRingbackTimer);
      window.__vcomRingbackTimer = null;
    }
    closeRingbackGraph();
    closeLoopback();
    silenceRingbackElement(document.getElementById("vcom-ringback"));
    silenceRingbackElement(document.getElementById("vcom-guest-caller"));
    var tones = document.querySelectorAll ? document.querySelectorAll("audio") : [];
    for (var i = 0; i < tones.length; i++) {
      var src = "";
      try { src = String(tones[i].currentSrc || tones[i].src || ""); } catch (eSrc) {}
      if (/ringback|call_waiting/.test(src) || tones[i].__vcomRingbackStream) {
        silenceRingbackElement(tones[i]);
        try { tones[i].pause(); tones[i].currentTime = 0; } catch (eTone) {}
      }
    }
    if (window.__vcomRingbackCtx && window.__vcomRingbackCtx.close) {
      try { window.__vcomRingbackCtx.close(); } catch (eClose) {}
      window.__vcomRingbackCtx = null;
      window.__vcomRingbackDest = null;
    }
    if (window.__vcomToneCtx && window.__vcomToneCtx.close) {
      try { window.__vcomToneCtx.close(); } catch (eToneCtx) {}
      window.__vcomToneCtx = null;
    }
  };
  window.vcomRouteRingback = function () {
    if (!window.__vcomRingbackOn) return;
    window.vcomApplyCallAudioRoute(ringbackEl());
  };
  window.vcomGuestAnswerPayload = function (answer) {
    if (!answer || !answer.sdp) return null;
    return {
      answer: { type: answer.type || "answer", sdp: String(answer.sdp) },
      status: "ringing"
    };
  };
  window.vcomOnRemoteAnswer = function (io) {
    io = io || {};
    if (io.stopRingback) io.stopRingback();
    if (io.setCallPhase) io.setCallPhase("connecting");
    return { ok: true, phase: "connecting" };
  };
  window.vcomOnHangup = function (io) {
    io = io || {};
    var patch = { status: "ended" };
    if (io.stopRingback) io.stopRingback();
    if (io.closeLocal) io.closeLocal();
    if (io.setCallPhase) io.setCallPhase("ended");
    if (io.writeEnded) io.writeEnded(patch);
    return { ok: true, patch: patch };
  };

  // Regular audio calls start on the earpiece and stay there until the
  // speaker button is pressed. The browser puts a new remote stream on the
  // loudspeaker after the one-shot route, so the route is applied again
  // whenever that audio actually starts.
  (function installEarpieceLock() {
    if (window.__vcomEarpieceLock) return;
    window.__vcomEarpieceLock = true;
    window.__vcomEarSink = window.__vcomEarSink || "communications";

    function streamHasLiveVideo(stream) {
      if (!stream || !stream.getVideoTracks) return false;
      var tracks = stream.getVideoTracks();
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i] && tracks[i].readyState !== "ended") return true;
      }
      return false;
    }
    window.vcomLiveCallHasVideo = function () {
      if (window.__vcomGuestVideo) return true;
      var open = window.__vcomOpenStreams || [];
      for (var i = 0; i < open.length; i++) {
        if (streamHasLiveVideo(open[i])) return true;
      }
      var nodes = document.querySelectorAll ? document.querySelectorAll("audio, video") : [];
      for (var n = 0; n < nodes.length; n++) {
        if (nodes[n] && streamHasLiveVideo(nodes[n].srcObject)) return true;
      }
      return false;
    };
    window.vcomAudioCallWantsEarpiece = function () {
      if (window.__vcomRinging) return false;
      if (window.__vcomUserSpeaker === true) return false;
      if (window.vcomLiveCallHasVideo()) return false;
      return true;
    };
    function eachCallMedia(fn) {
      var seen = [];
      var nodes = document.querySelectorAll ? document.querySelectorAll("audio, video") : [];
      for (var i = 0; i < nodes.length; i++) seen.push(nodes[i]);
      for (var n = 0; n < seen.length; n++) {
        var node = seen[n];
        if (!node || node.id === "vcom-ring") continue;
        fn(node);
      }
    }
    function rememberEarSink() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      navigator.mediaDevices.enumerateDevices().then(function (devices) {
        if (!window.vcomAudioCallWantsEarpiece()) return;
        var picked = window.vcomPickAudioSink(devices, false);
        if (picked) window.__vcomEarSink = picked;
      }).catch(function () {});
    }
    function routeEl(node, force) {
      if (!node || node.id === "vcom-ring" || typeof node.setSinkId !== "function") return;
      var want = window.__vcomEarSink || "communications";
      var current = "";
      try { current = node.sinkId || ""; } catch (eSink) {}
      if (!force && current === want) return;
      node.__vcomSink = "";
      var pending = node.setSinkId(want);
      node.__vcomSink = want;
      if (pending && pending.catch) pending.catch(function () { node.__vcomSink = ""; });
    }
    window.vcomApplyEarpieceNow = function (el, force) {
      if (!window.vcomAudioCallWantsEarpiece()) return "skip";
      window.__vcomSpeaker = false;
      try {
        if (navigator.audioSession) navigator.audioSession.type = "play-and-record";
      } catch (eSess) {}
      if (el && el.id !== "vcom-ring") routeEl(el, force !== false);
      eachCallMedia(function (node) { routeEl(node, force !== false); });
      return "earpiece";
    };
    function stopHold() {
      window.__vcomEarpieceHoldUntil = 0;
      if (window.__vcomEarpieceTimer) {
        clearInterval(window.__vcomEarpieceTimer);
        window.__vcomEarpieceTimer = null;
      }
    }
    window.vcomHoldEarpiece = function (el) {
      if (!window.vcomAudioCallWantsEarpiece()) return "skip";
      rememberEarSink();
      window.__vcomEarpieceHoldUntil = Date.now() + 15000;
      var routed = window.vcomApplyEarpieceNow(el, true);
      if (!window.__vcomEarpieceTimer) {
        window.__vcomEarpieceTimer = setInterval(function () {
          if (!window.__vcomEarpieceHoldUntil || Date.now() > window.__vcomEarpieceHoldUntil || !window.vcomAudioCallWantsEarpiece()) {
            stopHold();
            return;
          }
          window.vcomApplyEarpieceNow(null, false);
        }, 400);
      }
      return routed;
    };
    if (!window.__vcomEarpieceWatch) {
      window.__vcomEarpieceWatch = setInterval(function () {
        if (!window.vcomAudioCallWantsEarpiece()) return;
        var live = false;
        eachCallMedia(function (node) {
          var stream = node.srcObject;
          if (!stream || !stream.getAudioTracks) return;
          var tracks = stream.getAudioTracks();
          for (var i = 0; i < tracks.length; i++) {
            if (tracks[i] && tracks[i].readyState !== "ended") live = true;
          }
        });
        if (!live) return;
        window.vcomApplyEarpieceNow(null, false);
      }, 1000);
    }
    function onCallMedia(ev) {
      var node = ev && ev.target;
      if (!node) return;
      var tag = node.tagName;
      if (tag !== "AUDIO" && tag !== "VIDEO") return;
      if (node.id === "vcom-ring" || !node.srcObject) return;
      window.vcomHoldEarpiece(node);
    }
    if (document.addEventListener) {
      document.addEventListener("play", onCallMedia, true);
      document.addEventListener("playing", onCallMedia, true);
    }
    try {
      var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      var desc = proto && Object.getOwnPropertyDescriptor(proto, "srcObject");
      if (desc && desc.set && desc.configurable && !proto.__vcomEarpieceSrc) {
        proto.__vcomEarpieceSrc = true;
        Object.defineProperty(proto, "srcObject", {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: function (value) {
            desc.set.call(this, value);
            if (value) window.vcomHoldEarpiece(this);
          }
        });
      }
    } catch (eSrc) {}
    var origSpeaker = window.vcomSetSpeaker;
    window.vcomSetSpeaker = function (on) {
      window.__vcomUserSpeaker = !!on;
      window.__vcomSpeakerTouched = true;
      window.__vcomSpeaker = !!on;
      if (on) {
        stopHold();
        try { if (navigator.audioSession) navigator.audioSession.type = "auto"; } catch (eOn) {}
      }
      var result;
      if (typeof origSpeaker === "function") result = origSpeaker.apply(this, arguments);
      if (!on) window.vcomHoldEarpiece();
      return result;
    };
    var origEar = window.vcomSetEarpieceDefault;
    window.vcomSetEarpieceDefault = function () {
      if (window.__vcomUserSpeaker === true) {
        if (typeof origEar === "function") return origEar.apply(this, arguments);
        return;
      }
      window.__vcomSpeakerTouched = false;
      window.__vcomSpeaker = false;
      if (typeof origEar === "function") origEar.apply(this, arguments);
      return window.vcomHoldEarpiece();
    };
    var origRoute = window.vcomRouteOutputs;
    window.vcomRouteOutputs = function () {
      if (window.vcomAudioCallWantsEarpiece()) {
        window.__vcomSpeaker = false;
        eachCallMedia(function (node) { node.__vcomSink = ""; });
        try {
          if (navigator.audioSession) navigator.audioSession.type = "play-and-record";
        } catch (eRoute) {}
      }
      if (typeof origRoute === "function") return origRoute.apply(this, arguments);
    };
    var origRelease = window.vcomReleaseCapture;
    window.vcomReleaseCapture = function (keepRoute) {
      if (window.__vcomIgnoreCapture) return;
      if (!keepRoute) {
        window.__vcomUserSpeaker = false;
        stopHold();
      }
      if (typeof origRelease === "function") return origRelease.apply(this, arguments);
    };
    var origStartRing = window.vcomStartRing;
    window.vcomStartRing = function () {
      stopHold();
      if (typeof origStartRing === "function") return origStartRing.apply(this, arguments);
    };
    var origStopRing = window.vcomStopRing;
    window.vcomStopRing = function () {
      var result;
      if (typeof origStopRing === "function") result = origStopRing.apply(this, arguments);
      if (!window.__vcomReleasing && window.__vcomUserSpeaker !== true) window.vcomHoldEarpiece();
      return result;
    };
    var origAnswer = window.vcomOnRemoteAnswer;
    window.vcomOnRemoteAnswer = function (io) {
      var result = typeof origAnswer === "function" ? origAnswer.apply(this, arguments) : { ok: true };
      if (window.__vcomUserSpeaker !== true) window.vcomHoldEarpiece();
      return result;
    };
    var origHang = window.vcomOnHangup;
    window.vcomOnHangup = function (io) {
      window.__vcomUserSpeaker = false;
      stopHold();
      if (typeof origHang === "function") return origHang.apply(this, arguments);
    };
    var origGum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    if (typeof origGum === "function") {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        var video = !!(constraints && constraints.video);
        if (!video && !window.__vcomIgnoreCapture) {
          window.__vcomUserSpeaker = false;
          window.__vcomSpeaker = false;
          window.__vcomSpeakerTouched = false;
          window.__vcomNextCallEarpiece = true;
        }
        return Promise.resolve(origGum.apply(this, arguments)).then(function (stream) {
          if (!window.__vcomIgnoreCapture && !video && !(window.vcomCallHasVideo && window.vcomCallHasVideo(stream))) window.vcomHoldEarpiece();
          return stream;
        });
      };
    }
  })();

  if (guestCode) {
    bootGuest(guestCode);
    return;
  }
  bootIssuer();

  function bootGuest(code) {
    if (!/^[A-Za-z0-9]{6,12}$/.test(code)) code = "";
    var splash = document.getElementById("vcom-splash");
    if (splash) splash.remove();
    var brand = document.getElementById("vcom-brand");
    if (brand) brand.hidden = true;
    document.title = "VCOM";
    var style = document.createElement("style");
    style.textContent = guestCss();
    document.head.appendChild(style);
    var root = document.createElement("div");
    root.id = "vcom-guest";
    root.innerHTML = guestHtml();
    document.body.appendChild(root);
    var remote = document.createElement("audio");
    remote.id = "vcom-guest-remote";
    remote.autoplay = true;
    remote.setAttribute("playsinline", "true");
    remote.hidden = true;
    document.body.appendChild(remote);
    var nodes = {
      wait: root.querySelector("[data-view=wait]"),
      call: root.querySelector("[data-view=call]"),
      dead: root.querySelector("[data-view=dead]"),
      name: root.querySelector("[data-name]"),
      status: root.querySelector("[data-status]"),
      timer: root.querySelector("[data-timer]"),
      stage: root.querySelector("[data-stage]"),
      remoteVideo: root.querySelector("[data-remote]"),
      localVideo: root.querySelector("[data-local]"),
      answer: root.querySelector("[data-answer]"),
      decline: root.querySelector("[data-decline]"),
      hang: root.querySelector("[data-hang]"),
      mute: root.querySelector("[data-mute]"),
      speaker: root.querySelector("[data-speaker]"),
      deadText: root.querySelector("[data-dead]"),
      expired: root.querySelector("[data-expired]"),
      join: root.querySelector("[data-join]"),
      deadView: root.querySelector("[data-view=dead]")
    };
    var session = null;
    var started = 0;
    var sawLiveThisVisit = false;
    function markLive() { sawLiveThisVisit = true; }
    function showDead() {
      if ((session && session.answered) || (nodes.call && !nodes.call.hidden)) markLive();
      var afterCall = sawLiveThisVisit;
      if (nodes.deadView) nodes.deadView.classList.toggle("after-call", afterCall);
      if (nodes.expired) nodes.expired.hidden = afterCall;
      if (nodes.deadText) nodes.deadText.hidden = true;
      if (nodes.join) nodes.join.hidden = false;
      show("dead");
    }
    var endingVisit = false;
    function endVisit(fs, ref) {
      if (endingVisit) return;
      endingVisit = true;
      markLive();
      window.vcomOnHangup({
        stopRingback: function () {
          window.vcomStopRing();
          if (window.vcomStopRingback) window.vcomStopRingback();
        },
        closeLocal: function () {
          if (session) session.close();
          if (window.vcomReleaseCapture) window.vcomReleaseCapture();
        },
        setCallPhase: window.__vcomSetCallPhase,
        writeEnded: function (patch) {
          if (fs && ref && fs.updateDoc) fs.updateDoc(ref, patch).catch(function () {});
        }
      });
      showDead();
    }
    function show(which) {
      nodes.wait.hidden = which !== "wait";
      nodes.call.hidden = which !== "call";
      nodes.dead.hidden = which !== "dead";
    }
    function paint(data) {
      var grace = data && data.status === "ringing" ? 180000 : 0;
      var expired = !data || (data.status !== "active" && data.expiresAt + grace <= Date.now());
      if (data && (data.status === "waiting" || data.status === "ringing" || data.status === "active" || data.offer)) {
        markLive();
      }
      if (!data || data.status === "ended" || expired) {
        window.vcomStopRing();
        if (nodes.stage) nodes.stage.hidden = true;
        if (session) session.close();
        if (window.vcomReleaseCapture) window.vcomReleaseCapture();
        showDead();
        return;
      }
      if (data.status === "waiting" || !data.offer) {
        window.vcomStopRing();
        show("wait");
        return;
      }
      var guestName = data.guestName || data.ownerName || pretty(data.ownerPhone) || "";
      nodes.name.textContent = guestName ? ("שלום " + guestName) : "שלום";
      if (!session || !session.answered) {
        nodes.status.textContent = "שיחה נכנסת";
        nodes.timer.hidden = true;
        nodes.answer.hidden = false;
        nodes.decline.hidden = false;
        nodes.hang.hidden = true;
        nodes.mute.hidden = true;
        nodes.speaker.hidden = true;
        markLive();
        show("call");
        window.vcomStartRing();
        return;
      }
      show("call");
    }
    function load() {
      Promise.all([
        import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js")
      ]).then(function (mods) {
        var appMod = mods[0];
        var fs = mods[1];
        var app = appMod.initializeApp(firebaseConfig);
        var db;
        try {
          db = fs.initializeFirestore(app, {
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: false
          });
        } catch (e) {
          db = fs.getFirestore(app);
        }
        var ref = fs.doc(db, "guestLinks", code);
        window.__vcomGuestEndVisit = function () { endVisit(fs, ref); };
        var markedReady = false;
        fs.onSnapshot(ref, function (snap) {
          var data = snap.exists() ? snap.data() || {} : null;
          window.__vcomGuestData = data;
          if (window.vcomGuestResumeFromEnded(data, endingVisit)) {
            endingVisit = false;
            if (session) {
              try { session.close(); } catch (eClose) {}
            }
            session = null;
            paint(data);
            return;
          }
          if (data && data.status === "waiting" && !data.offer && !markedReady && fs.updateDoc) {
            markedReady = true;
            fs.updateDoc(ref, { status: "ringing" }).catch(function () {});
          }
          if (data && data.status === "ended") {
            endVisit(fs, ref);
            return;
          }
          if (session && session.pc && data) {
            session.take(data);
          }
          if (!session || !session.answered) paint(data);
          else if (data && data.status === "active") {
            nodes.status.textContent = "בשיחה";
            nodes.timer.hidden = false;
          }
        }, function () {
          showDead();
        });
        nodes.answer.addEventListener("click", function () {
          var data = window.__vcomGuestData;
          if (!data || !data.offer || session) return;
          if (data.expiresAt <= Date.now() && data.status !== "ringing" && data.status !== "active") return;
          unlockRing();
          window.vcomStopRing();
          var wantVideo = data.video === true;
          var media = window.vcomOpenCallMedia(wantVideo);
          if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
          session = openAnswer(fs, db, ref, data, media, remote, nodes);
          markLive();
          nodes.answer.hidden = true;
          nodes.decline.hidden = true;
          nodes.hang.hidden = false;
          nodes.mute.hidden = false;
          nodes.speaker.hidden = false;
          nodes.status.textContent = "מתחבר...";
          nodes.timer.hidden = true;
          started = Date.now();
        });
        if (nodes.join) {
          nodes.join.addEventListener("click", function () {
            location.href = appHomeUrl();
          });
        }
        nodes.decline.addEventListener("click", function () {
          endVisit(fs, ref);
        });
        nodes.hang.addEventListener("click", function () {
          endVisit(fs, ref);
        });
        nodes.mute.addEventListener("click", function () {
          if (!session) return;
          session.muted = !session.muted;
          session.applyMute();
          nodes.mute.classList.toggle("on", session.muted);
        });
        nodes.speaker.addEventListener("click", function () {
          if (!session) return;
          session.speaker = !session.speaker;
          nodes.speaker.classList.toggle("on", session.speaker);
          if (window.vcomSetSpeaker) window.vcomSetSpeaker(session.speaker);
          else {
            try { if (navigator.audioSession) navigator.audioSession.type = session.speaker ? "playback" : "play-and-record"; } catch (e) {}
          }
          if (window.vcomRouteOutputs) window.vcomRouteOutputs();
          remote.volume = 1;
        });
        setInterval(function () {
          if (!session || !session.answered || nodes.call.hidden) return;
          var data = window.__vcomGuestData || {};
          var from = data.callStartedAt || started;
          if (!from) return;
          nodes.timer.hidden = false;
          nodes.timer.textContent = clock(Date.now() - from);
        }, 500);
      }).catch(function () {
        showDead();
      });
    }
    if (!code) {
      showDead();
      return;
    }
    show("wait");
    load();
  }

  function openAnswer(fs, db, ref, data, mediaPromise, remote, nodes) {
    var pc = new RTCPeerConnection(ICE);
    var local = null;
    var queued = [];
    var seen = {};
    var sent = {};
    var state = { pc: pc, answered: true, muted: false, speaker: !!window.vcomDefaultSpeakerOn, closed: false };
    state.applyMute = function () {
      if (!local) return;
      local.getAudioTracks().forEach(function (track) { track.enabled = !state.muted; });
    };
    state.close = function () {
      if (state.closed) return;
      state.closed = true;
      try { pc.close(); } catch (e) {}
      if (local) local.getTracks().forEach(function (track) { try { track.stop(); } catch (e) {} });
      local = null;
      try { if (remote) remote.srcObject = null; } catch (e) {}
      ["vcom-guest-remote-video", "vcom-guest-local-video"].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        try { el.srcObject = null; } catch (e) {}
        el.hidden = true;
      });
      if (window.vcomReleaseCapture) window.vcomReleaseCapture();
    };
    state.take = function (next) {
      (next.callerCandidates || []).forEach(function (item) {
        var key = JSON.stringify(item);
        if (seen[key]) return;
        if (!pc.remoteDescription) { queued.push(item); return; }
        seen[key] = true;
        pc.addIceCandidate(item).catch(function () {});
      });
    };
    pc.onicecandidate = function (event) {
      if (!event.candidate) return;
      var item = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      };
      var key = JSON.stringify(item);
      if (sent[key]) return;
      sent[key] = true;
      fs.updateDoc(ref, { guestCandidates: fs.arrayUnion(item) }).catch(function () {});
    };
    function showGuestVideo(el, stream) {
      if (!el || !window.vcomCallHasVideo(stream)) return;
      if (nodes.stage) nodes.stage.hidden = false;
      if (nodes.call) nodes.call.classList.add("video");
    }
    pc.ontrack = function (event) {
      var stream = window.vcomMergeTrackStream(state, event);
      remote.srcObject = stream;
      if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
      window.vcomApplyCallAudioRoute(remote);
      var play = remote.play();
      if (play && play.catch) play.catch(function () {});
      window.vcomAttachCallVideo(nodes.remoteVideo, stream, "remote");
      showGuestVideo(nodes.remoteVideo, stream);
    };
    var wasConnected = false;
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "connected") {
        wasConnected = true;
        nodes.status.textContent = "בשיחה";
        nodes.timer.hidden = false;
        fs.updateDoc(ref, { status: "active", callStartedAt: Date.now() }).catch(function () {});
      }
      if (wasConnected && (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed")) {
        if (window.__vcomGuestEndVisit) window.__vcomGuestEndVisit();
      }
    };
    mediaPromise.then(function (stream) {
      if (state.closed) {
        stream.getTracks().forEach(function (track) { try { track.stop(); } catch (e) {} });
        if (window.vcomReleaseCapture) window.vcomReleaseCapture();
        return Promise.reject(new Error("call-ended"));
      }
      local = stream;
      state.applyMute();
      if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
      try { if (navigator.audioSession) navigator.audioSession.type = "play-and-record"; } catch (e) {}
      if (window.vcomRouteOutputs) window.vcomRouteOutputs();
      window.vcomAttachCallVideo(nodes.localVideo, stream, "local");
      showGuestVideo(nodes.localVideo, stream);
      stream.getTracks().forEach(function (track) { pc.addTrack(track, stream); });
      return pc.setRemoteDescription(data.offer);
    }).then(function () {
      queued.splice(0).forEach(function (item) {
        var key = JSON.stringify(item);
        if (seen[key]) return;
        seen[key] = true;
        pc.addIceCandidate(item).catch(function () {});
      });
      state.take(window.__vcomGuestData || {});
      return pc.createAnswer();
    }).then(function (answer) {
      return pc.setLocalDescription(answer).then(function () { return answer; });
    }).then(function (answer) {
      var patch = window.vcomGuestAnswerPayload(answer);
      if (!patch) throw new Error("no-answer");
      return fs.updateDoc(ref, patch);
    }).catch(function () {
      nodes.status.textContent = "לא הצלחנו להתחבר";
    });
    return state;
  }

  function bootIssuer() {
    var style = document.createElement("style");
    style.textContent = issuerCss();
    document.head.appendChild(style);
    var menu = document.createElement("div");
    menu.id = "vcom-link-menu";
    menu.hidden = true;
    menu.innerHTML = '<button id="vcom-link-open" type="button"><span class="vcom-link-open-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M10.6 13.4a4 4 0 0 1 0-5.6l2.1-2.1a4 4 0 0 1 5.7 5.7l-1 1a.9.9 0 1 1-1.3-1.3l1-1a2.2 2.2 0 1 0-3.1-3.1l-2.1 2.1a2.2 2.2 0 0 0 0 3.1.9.9 0 1 1-1.3 1.2zm2.8-2.8a.9.9 0 0 1 1.3 1.3 4 4 0 0 1-5.7 0L7 13.9A4 4 0 1 1 1.3 8.2l1-1a.9.9 0 1 1 1.3 1.3l-1 1a2.2 2.2 0 1 0 3.1 3.1l2.1-2.1a2.2 2.2 0 0 0 3.1 0z"/></svg></span><span class="vcom-link-open-text">הנפקת קישור שיחה</span></button><form id="vcom-link-form" hidden><input id="vcom-link-name" maxlength="32" autocomplete="name" enterkeyhint="done" placeholder="שם מקבל/ת השיחה"><p class="vcom-link-error" data-error></p><button type="submit" data-ok>אישור</button></form><div id="vcom-link-banner" hidden></div>';
    document.body.appendChild(menu);
    var logo = document.createElement("img");
    logo.id = "vcom-menu-logo";
    logo.alt = "";
    logo.src = "icons/vcom-menu-logo.png?v=call30";
    logo.hidden = true;
    document.body.appendChild(logo);
    var paste = document.createElement("input");
    paste.id = "vcom-dial-paste";
    paste.type = "text";
    paste.inputMode = "none";
    paste.autocomplete = "off";
    paste.setAttribute("aria-label", "הדבקת מספר");
    paste.hidden = true;
    document.body.appendChild(paste);
    function pushDigits(text) {
      if (window.__vcomPasteDigits) window.__vcomPasteDigits(text);
      paste.value = "";
    }
    paste.addEventListener("paste", function (event) {
      var text = event.clipboardData && event.clipboardData.getData("text") || "";
      event.preventDefault();
      pushDigits(text);
    });
    paste.addEventListener("input", function () {
      if (paste.value) pushDigits(paste.value);
    });
    document.addEventListener("paste", function (event) {
      var target = event.target;
      if (target && (target.id === "vcom-link-name" || (target.tagName === "INPUT" && target.id !== "vcom-dial-paste") || target.tagName === "TEXTAREA")) return;
      if ((window.__vcomDrawerX || 0) > 0.2) return;
      var text = event.clipboardData && event.clipboardData.getData("text") || "";
      if (!/\d/.test(text)) return;
      event.preventDefault();
      pushDigits(text);
    });
    var open = menu.querySelector("#vcom-link-open");
    var form = menu.querySelector("#vcom-link-form");
    var banner = menu.querySelector("#vcom-link-banner");
    var nameInput = menu.querySelector("#vcom-link-name");
    var error = menu.querySelector("[data-error]");
    var composing = false;
    window.__vcomGuestBook = window.__vcomGuestBook || {};
    var watched = {};
    var busy = false;
    var remote = document.createElement("audio");
    remote.id = "vcom-guest-caller";
    remote.autoplay = true;
    remote.setAttribute("playsinline", "true");
    remote.setAttribute("webkit-playsinline", "true");
    remote.hidden = true;
    document.body.appendChild(remote);
    function addCallerVideo(id, muted) {
      var el = document.createElement("video");
      el.id = id;
      el.autoplay = true;
      el.muted = muted;
      el.playsInline = true;
      el.setAttribute("playsinline", "true");
      el.hidden = true;
      document.body.appendChild(el);
      return el;
    }
    addCallerVideo("vcom-guest-remote-video", true);
    addCallerVideo("vcom-guest-local-video", true);

    function fsNow() {
      var fs = window.firebase_firestore;
      if (!fs || !fs.getFirestore || !fs.doc || !fs.setDoc || !fs.updateDoc || !fs.getDoc) return null;
      return fs;
    }
    function visibleRows() {
      var now = Date.now();
      return Object.keys(window.__vcomGuestBook).map(function (phone) {
        return window.__vcomGuestBook[phone];
      }).filter(function (row) {
        return window.vcomLinkStillVisible(row, now);
      }).sort(function (a, b) { return asMillis(b.expiresAt) - asMillis(a.expiresAt); });
    }
    function currentRow() {
      var rows = visibleRows();
      for (var i = 0; i < rows.length; i++) if (rows[i].status === "active") return rows[i];
      return rows[0] || null;
    }
    function render() {
      var row = currentRow();
      banner.hidden = !row;
      banner.replaceChildren();
      if (!row) return;
      var card = document.createElement("div");
      card.className = "vcom-link-live";
      var name = document.createElement("div");
      name.className = "vcom-link-guest";
      name.textContent = row.name || "";
      var phone = document.createElement("div");
      phone.className = "vcom-link-phone";
      phone.dir = "ltr";
      phone.textContent = pretty(row.phone);
      var meta = document.createElement("div");
      meta.className = "vcom-link-meta";
      meta.textContent = row.status === "active" ? "בשיחה" : untilClock(row.expiresAt);
      var copyLink = document.createElement("button");
      copyLink.type = "button";
      copyLink.className = "vcom-link-copy";
      copyLink.textContent = "העתק קישור שיחה";
      copyLink.addEventListener("click", function () {
        clip(row.url);
        copyLink.textContent = "הועתק";
        setTimeout(function () { if (copyLink.isConnected) copyLink.textContent = "העתק קישור שיחה"; }, 1500);
      });
      var copyPhoneBtn = document.createElement("button");
      copyPhoneBtn.type = "button";
      copyPhoneBtn.className = "vcom-link-copy";
      copyPhoneBtn.textContent = "העתק מספר";
      copyPhoneBtn.addEventListener("click", function () {
        clip(digits(row.phone));
        copyPhoneBtn.textContent = "הועתק";
        setTimeout(function () { if (copyPhoneBtn.isConnected) copyPhoneBtn.textContent = "העתק מספר"; }, 1500);
      });
      var lastTap = 0;
      function copyPhone() {
        clip(digits(row.phone));
      }
      phone.addEventListener("dblclick", function (event) {
        event.preventDefault();
        copyPhone();
      });
      phone.addEventListener("touchend", function (event) {
        var now = Date.now();
        if (now - lastTap < 350) {
          event.preventDefault();
          lastTap = 0;
          copyPhone();
        } else lastTap = now;
      });
      card.appendChild(name);
      card.appendChild(phone);
      card.appendChild(meta);
      card.appendChild(copyPhoneBtn);
      card.appendChild(copyLink);
      banner.appendChild(card);
    }
    function linkCallIo() {
      return {
        isOnCall: isOnCall,
        fy: function () {
          try { return !!(window.__vcomBloc && window.__vcomBloc.fy); } catch (e) { return false; }
        },
        closeDrawer: function () { applyDrawer(0); },
        pasteDigits: window.__vcomPasteDigits,
        dialPress: window.__vcomDialPress
      };
    }
    function startOwnerGuestCall(code) {
      if (!code || window.__vcomGuestActive === code) return;
      var row = findRow(code);
      if (!row) {
        Object.keys(window.__vcomGuestBook || {}).forEach(function (phone) {
          if (window.__vcomGuestBook[phone].code === code) row = window.__vcomGuestBook[phone];
        });
      }
      if (!row) row = { code: code, phone: "" };
      var tries = 0;
      function attempt() {
        var result = window.vcomPlaceLinkCall(row, linkCallIo());
        if (result && result.ok) return;
        if (result && result.reason === "busy") return;
        tries += 1;
        if (tries < 12 && result && result.reason === "no-keypad") setTimeout(attempt, 200);
      }
      attempt();
    }
    function watch(code) {
      var fs = fsNow();
      if (!fs || watched[code] || !fs.onSnapshot) return;
      watched[code] = fs.onSnapshot(fs.doc(fs.getFirestore(), "guestLinks", code), function (snap) {
        window.__vcomWatchFails = 0;
        var data = snap.exists() ? snap.data() || {} : null;
        var phone = digits(data && data.tempPhone);
        var row = phone && window.__vcomGuestBook[phone];
        if (!row || row.code !== code) {
          Object.keys(window.__vcomGuestBook).forEach(function (key) {
            if (window.__vcomGuestBook[key].code === code) row = window.__vcomGuestBook[key];
          });
        }
        if (!row) return;
        if (!data) row.status = "ended";
        else {
          row.status = data.status || row.status;
          row.expiresAt = asMillis(data.expiresAt) || row.expiresAt;
          row.fromLink = true;
        }
        render();
      }, function () {
        try { if (typeof watched[code] === "function") watched[code](); } catch (e) {}
        delete watched[code];
        var delay = Math.min(15000, 2000 * Math.pow(2, window.__vcomWatchFails = (window.__vcomWatchFails || 0) + 1));
        setTimeout(function () { watch(code); }, delay);
      });
    }
    function forget(row) {
      var fs = fsNow();
      delete window.__vcomGuestBook[row.phone];
      render();
      if (!fs || !window.__vcomUid) return;
      var patch = {};
      patch["guestLinks." + row.code] = fs.deleteField ? fs.deleteField() : { status: "ended", phone: row.phone, expiresAt: row.expiresAt, name: row.name || "" };
      fs.updateDoc(fs.doc(fs.getFirestore(), "users", window.__vcomUid), patch).catch(function () {});
      if (row.status !== "active") {
        fs.updateDoc(fs.doc(fs.getFirestore(), "guestLinks", row.code), { status: "ended" }).catch(function () {});
      }
    }
    function showForm(on) {
      composing = on;
      form.hidden = !on;
      error.textContent = "";
      if (on) nameInput.focus();
    }
    open.addEventListener("click", function () { showForm(!composing); });
    var okButton = form.querySelector("[data-ok]");
    function newestExpiry() {
      var max = 0;
      Object.keys(window.__vcomGuestBook || {}).forEach(function (phone) {
        var row = window.__vcomGuestBook[phone];
        var exp = row ? asMillis(row.expiresAt) : 0;
        if (exp > max) max = exp;
      });
      return max;
    }
    function resetIssueButton() {
      if (okButton) okButton.textContent = "אישור";
    }
    function finishIssue(generation) {
      if (generation !== window.__vcomIssueGen) return;
      if (window.__vcomIssueDone === generation) return;
      window.__vcomIssueDone = generation;
      busy = false;
      showForm(false);
      nameInput.value = "";
      error.textContent = "";
      resetIssueButton();
      render();
    }
    function failIssue(generation, err) {
      if (generation !== window.__vcomIssueGen) return;
      if (window.__vcomIssueDone === generation) return;
      busy = false;
      window.__vcomIssueErr = String(err && (err.code || err.message) || err || "timeout");
      resetIssueButton();
      if (!error.textContent) error.textContent = "לא הצלחנו להנפיק קישור. נסה שוב.";
    }
    function confirmName(event) {
      if (event) event.preventDefault();
      if (busy) return;
      var name = nameInput.value.replace(/^\s+|\s+$/g, "");
      if (!name) {
        error.textContent = "נא לרשום שם";
        return;
      }
      busy = true;
      error.textContent = "";
      okButton.textContent = "רגע";
      var generation = (window.__vcomIssueGen = (window.__vcomIssueGen || 0) + 1);
      window.__vcomIssueDone = 0;
      window.__vcomIssueSeen = newestExpiry();
      var pending;
      try { pending = issue(name, generation); }
      catch (err) { pending = Promise.reject(err); }
      window.vcomWithDeadline(pending, 8000).then(function () {
        finishIssue(generation);
      }).catch(function (err) {
        if (newestExpiry() > window.__vcomIssueSeen) finishIssue(generation);
        else failIssue(generation, err);
      });
    }
    form.addEventListener("submit", confirmName);
    function alphabetCode() {
      var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      var bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      var out = "";
      for (var i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
      return out;
    }
    function phoneTaken(snaps, phone) {
      if (window.__vcomGuestBook[phone]) return true;
      return !!((snaps[0] && snaps[0].exists && snaps[0].exists()) || (snaps[1] && snaps[1].exists && snaps[1].exists()));
    }
    function issue(name, generation) {
      var fs = fsNow();
      var uid = window.__vcomUid;
      var profile = window.__vcomProfile || {};
      if (!fs || !uid) return Promise.reject(new Error("auth"));
      var db = fs.getFirestore();
      var code = alphabetCode();
      function pick(left) {
        var phone = "020" + String(100000 + Math.floor(Math.random() * 900000));
        if (window.__vcomGuestBook[phone]) {
          if (left <= 1) return Promise.reject(new Error("phone"));
          return pick(left - 1);
        }
        return window.vcomWithDeadline(Promise.all([
          fs.getDoc(fs.doc(db, "phoneNumbers", phone)),
          fs.getDoc(fs.doc(db, "guestPhones", phone))
        ]), 2500).then(function (snaps) {
          if (!phoneTaken(snaps, phone)) return phone;
          if (left <= 1) throw new Error("phone");
          return pick(left - 1);
        }, function () {
          if (left <= 1) throw new Error("phone");
          return pick(left - 1);
        });
      }
      return pick(2).then(function (phone) {
        var now = Date.now();
        var data = {
          code: code,
          ownerId: uid,
          ownerPhone: digits(profile.phone),
          ownerName: name,
          guestName: name,
          tempPhone: phone,
          status: "waiting",
          createdAt: now,
          expiresAt: now + TTL,
          offer: null,
          answer: null,
          callerCandidates: [],
          guestCandidates: [],
          callStartedAt: null
        };
        return window.vcomWithDeadline(fs.setDoc(fs.doc(db, "guestPhones", phone), {
          ownerId: uid,
          code: code,
          expiresAt: data.expiresAt
        }), 4000).then(function () {
          return window.vcomWithDeadline(fs.setDoc(fs.doc(db, "guestLinks", code), data), 4000);
        }).then(function () {
          window.__vcomGuestBook[phone] = {
            code: code,
            name: name,
            phone: phone,
            expiresAt: data.expiresAt,
            status: "waiting",
            url: shareUrl(code),
            local: true,
            fromLink: true
          };
          watch(code);
          render();
          var patch = {};
          patch["guestLinks." + code] = { name: name, phone: phone, expiresAt: data.expiresAt, status: "waiting" };
          window.vcomWithDeadline(fs.updateDoc(fs.doc(db, "users", uid), patch), 4000).catch(function () {});
          if (generation) finishIssue(generation);
        });
      });
    }
    function place() {
      var rtl = String(document.documentElement.getAttribute("dir") || "").toLowerCase() === "rtl";
      var width = Math.min((window.__vcomDrawerWidth >= 200 ? window.__vcomDrawerWidth : 304), 304, window.innerWidth);
      var short = window.innerHeight < 560;
      var top = short ? 120 : 170;
      menu.style.width = width + "px";
      menu.style.top = "calc(env(safe-area-inset-top, 0px) + " + top + "px)";
      menu.style.bottom = "auto";
      menu.style.maxHeight = "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - " + (top + 88) + "px)";
      menu.style.right = rtl ? "0px" : "auto";
      menu.style.left = rtl ? "auto" : "0px";
      return { rtl: rtl, width: width };
    }
    function applyDrawer(value) {
      var x = Number(value);
      if (!isFinite(x)) x = 0;
      if (x < 0) x = 0;
      if (x > 1) x = 1;
      var previous = window.__vcomDrawerX || 0;
      window.__vcomDrawerX = x;
      if (previous > 0.2 && x < 0.05 && !busy) {
        showForm(false);
        nameInput.value = "";
        error.textContent = "";
        resetIssueButton();
      }
      var gate = document.getElementById("vcom-approval");
      var blocked = gate && !gate.hidden;
      var onCall = !!window.__vcomRinging;
      try {
        var view = window.__vcomBloc && window.__vcomBloc.c;
        if (view && view.gnY && view.gnY()) onCall = true;
        if (view && view.b) onCall = true;
      } catch (e) {}
      var allow = !!window.__vcomUid && !blocked && !onCall;
      var visible = allow && x > 0.02;
      menu.hidden = !visible;
      paste.hidden = !window.__vcomUid || blocked || onCall || x > 0.02 || (window.__vcomTab | 0) !== 0;
      logo.hidden = true;
      if (visible) {
        var spot = place();
        var shift = (1 - x) * spot.width;
        menu.style.transform = "translate3d(" + (spot.rtl ? shift : -shift) + "px,0,0)";
      } else menu.style.transform = "";
    }
    window.__vcomDrawerMove = applyDrawer;
    applyDrawer(window.__vcomDrawerX || 0);
    window.addEventListener("resize", function () { applyDrawer(window.__vcomDrawerX || 0); });
    document.addEventListener("pointerdown", function (event) {
      var node = event.target;
      var inside = !!(node && node.closest && node.closest("#vcom-link-menu, #vcom-chat-media"));
      var rtl = String(document.documentElement.getAttribute("dir") || "").toLowerCase() === "rtl";
      if (!window.vcomDrawerTapShouldClose({ x: event.clientX, viewWidth: window.innerWidth, rtl: rtl, insideMenu: inside })) return;
      window.vcomCloseSideMenu();
    }, true);
    try {
      var tabNow = window.__vcomTab | 0;
      Object.defineProperty(window, "__vcomTab", {
        configurable: true,
        get: function () { return tabNow; },
        set: function (value) {
          var next = value | 0;
          var changed = next !== tabNow;
          tabNow = next;
          if (!changed) return;
          if ((window.__vcomDrawerX || 0) > 0.2) window.vcomCloseSideMenu();
          var media = document.getElementById("vcom-chat-media");
          if (media && (next !== (window.__vcomChatTab | 0) || !window.__vcomOpenChat)) {
            media.hidden = true;
            var sheetNow = document.getElementById("vcom-chat-sheet");
            if (sheetNow) sheetNow.hidden = true;
          }
        }
      });
    } catch (eTab) {}
    wireChatMedia();
    function tick() {
      var now = Date.now();
      Object.keys(window.__vcomGuestBook).forEach(function (phone) {
        var row = window.__vcomGuestBook[phone];
        if (window.vcomLinkStillVisible(row, now)) return;
        forget(row);
      });
      var row = currentRow();
      var meta = banner.querySelector(".vcom-link-meta");
      if (!row) {
        if (!banner.hidden) render();
      } else if (!meta) render();
      else meta.textContent = row.status === "active" ? "בשיחה" : untilClock(row.expiresAt);
    }
    setInterval(tick, 2000);
    var userUnsub = null;
    var authBound = false;
    function bindUser() {
      var fs = fsNow();
      var auth = window.firebase_auth;
      if (!fs || !auth || !auth.getAuth || !auth.onAuthStateChanged || !fs.onSnapshot) return false;
      if (authBound) return true;
      authBound = true;
      auth.onAuthStateChanged(auth.getAuth(), function (user) {
        window.__vcomUid = user ? user.uid : "";
        if (userUnsub) { try { userUnsub(); } catch (e) {} userUnsub = null; }
        if (!user) {
          window.__vcomGuestBook = {};
          window.__vcomProfile = {};
          render();
          return;
        }
        userUnsub = fs.onSnapshot(fs.doc(fs.getFirestore(), "users", user.uid), function (snap) {
          var data = snap.exists() ? snap.data() || {} : {};
          window.__vcomProfile = {
            name: data.name || data.displayName || "",
            phone: data.phoneNumber || ""
          };
          var links = data.guestLinks || {};
          var livePhones = {};
          Object.keys(links).forEach(function (code) {
            var row = links[code] || {};
            var phone = digits(row.phone);
            if (!phone) return;
            var prev = window.__vcomGuestBook[phone];
            var merged = {
              code: code,
              name: row.name || (prev && prev.name) || "",
              phone: phone,
              expiresAt: prev && prev.fromLink ? prev.expiresAt : (asMillis(row.expiresAt) || (prev && prev.expiresAt) || 0),
              status: prev && prev.fromLink ? prev.status : (row.status || "waiting"),
              url: shareUrl(code),
              fromLink: !!(prev && prev.fromLink)
            };
            if (!window.vcomLinkStillVisible(merged)) return;
            livePhones[phone] = 1;
            window.__vcomGuestBook[phone] = merged;
            watch(code);
          });
          Object.keys(window.__vcomGuestBook).forEach(function (phone) {
            if (livePhones[phone] || window.__vcomGuestBook[phone].local) return;
            var stale = window.__vcomGuestBook[phone];
            delete window.__vcomGuestBook[phone];
            if (stale && stale.code && watched[stale.code]) {
              try { watched[stale.code](); } catch (eUn) {}
              delete watched[stale.code];
            }
          });
          render();
          if (busy && newestExpiry() > (window.__vcomIssueSeen || 0)) finishIssue(window.__vcomIssueGen);
        }, function () {});
      });
      return true;
    }
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (bindUser() || tries > 80) clearInterval(timer);
    }, 400);
    setInterval(function () {
      Object.keys(window.__vcomGuestBook || {}).forEach(function (phone) {
        var row = window.__vcomGuestBook[phone];
        if (row && row.code && !watched[row.code]) watch(row.code);
      });
    }, 15000);

    window.vcomStartGuestCall = function (code, video) {
      window.__vcomGuestStarted = code;
      var token = (window.__vcomGuestToken || 0) + 1;
      window.__vcomGuestToken = token;
      window.__vcomGuestActive = code;
      var wantVideo = !!video;
      window.__vcomGuestVideo = wantVideo;
      var media = window.vcomOpenCallMedia(wantVideo);
      startCaller(token, code, media, wantVideo);
    };
    window.vcomEndGuestCall = function () {
      window.__vcomGuestToken = (window.__vcomGuestToken || 0) + 1;
      var current = caller;
      window.vcomOnHangup({
        stopRingback: stopBack,
        closeLocal: function () { finishCaller(false); },
        setCallPhase: window.__vcomSetCallPhase,
        writeEnded: function (patch) {
          if (current && current.fs && current.ref) {
            current.fs.updateDoc(current.ref, patch).catch(function () {});
          }
        }
      });
      if (window.vcomReleaseCapture) window.vcomReleaseCapture();
    };
  }

  var caller = null;
  function finishCaller(write) {
    stopBack();
    var current = caller;
    caller = null;
    if (!current) return;
    current.closed = true;
    if (current.unsub) {
      try { current.unsub(); } catch (eUn) {}
      current.unsub = null;
    }
    try { current.pc.close(); } catch (e) {}
    if (current.local) current.local.getTracks().forEach(function (track) { try { track.stop(); } catch (e) {} });
    current.local = null;
    if (window.vcomReleaseCapture) window.vcomReleaseCapture();
    var remote = document.getElementById("vcom-guest-caller");
    if (remote) remote.srcObject = null;
    ["vcom-guest-remote-video", "vcom-guest-local-video"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.srcObject = null;
      el.hidden = true;
    });
    if (write && current.fs && current.ref) {
      current.fs.updateDoc(current.ref, { status: "ended" }).catch(function () {});
    }
    var row = null;
    Object.keys(window.__vcomGuestBook || {}).forEach(function (phone) {
      if (window.__vcomGuestBook[phone].code === current.code) row = window.__vcomGuestBook[phone];
    });
    if (row && row.status === "active") row.status = "ended";
  }
  var backTimer = null;
  function stopBack() {
    if (backTimer) clearInterval(backTimer);
    backTimer = null;
    if (window.vcomStopRingback) window.vcomStopRingback();
  }
  function startBack() {
    if (window.vcomStartRingback) window.vcomStartRingback();
  }
  function startCaller(token, code, mediaPromise, video) {
    var fs = window.firebase_firestore;
    if (!fs) {
      startCaller._wait = (startCaller._wait || 0) + 1;
      if (startCaller._wait > 20) {
        startCaller._wait = 0;
        return;
      }
      setTimeout(function () {
        if (token !== window.__vcomGuestToken) return;
        startCaller(token, code, mediaPromise, video);
      }, 250);
      return;
    }
    startCaller._wait = 0;
    finishCaller(false);
    var pc = new RTCPeerConnection(ICE);
    var ref = fs.doc(fs.getFirestore(), "guestLinks", code);
    caller = { pc: pc, fs: fs, ref: ref, code: code, local: null, closed: false, seen: {}, queued: [], remoteSet: false, answerSeen: false, markedLive: false, offerSent: false, unsub: null, video: !!video };
    var current = caller;
    if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
    pc.onicecandidate = function (event) {
      if (!event.candidate || current.closed || token !== window.__vcomGuestToken) return;
      var item = {
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      };
      fs.updateDoc(ref, { callerCandidates: fs.arrayUnion(item) }).catch(function () {});
    };
    pc.ontrack = function (event) {
      var stream = window.vcomMergeTrackStream(current, event);
      stopBack();
      var audio = document.getElementById("vcom-guest-caller");
      if (audio) {
        try { audio.removeAttribute("src"); } catch (eSrc) {}
        audio.srcObject = stream;
        window.vcomApplyCallAudioRoute(audio);
        var play = audio.play();
        if (play && play.catch) play.catch(function () {});
      }
      window.vcomAttachCallVideo(document.getElementById("vcom-guest-remote-video"), stream, "remote");
      if (window.vcomLiftCallVideos) window.vcomLiftCallVideos();
      if (window.vcomRouteOutputs) window.vcomRouteOutputs();
    };
    function markConnected() {
      if (current.closed || token !== window.__vcomGuestToken || current.markedLive) return;
      current.markedLive = true;
      stopBack();
      fs.updateDoc(ref, { status: "active", callStartedAt: Date.now() }).catch(function () {});
      if (window.__vcomSetCallPhase) window.__vcomSetCallPhase("active");
      var row = findRow(code);
      if (row) row.status = "active";
    }
    pc.onconnectionstatechange = function () {
      if (current.closed || token !== window.__vcomGuestToken) return;
      if (pc.connectionState === "connected") markConnected();
    };
    pc.oniceconnectionstatechange = function () {
      if (current.closed || token !== window.__vcomGuestToken) return;
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") markConnected();
    };
    current.unsub = fs.onSnapshot(ref, function (snap) {
      if (current.closed || token !== window.__vcomGuestToken) return;
      var data = snap.exists() ? snap.data() || {} : null;
      if (window.vcomIgnoreStaleEnded(data, current.offerSent)) return;
      if (!data || data.status === "ended") {
        window.vcomOnHangup({
          stopRingback: stopBack,
          closeLocal: function () { finishCaller(false); },
          setCallPhase: window.__vcomSetCallPhase
        });
        return;
      }
      if (data.answer && !current.answerSeen) {
        current.answerSeen = true;
        window.vcomOnRemoteAnswer({
          stopRingback: stopBack,
          setCallPhase: window.__vcomSetCallPhase
        });
      }
      if (data.answer && !current.remoteSet) {
        current.remoteSet = true;
        var desc = data.answer;
        if (!desc.type && desc.sdp) desc = { type: "answer", sdp: desc.sdp };
        pc.setRemoteDescription(desc).then(function () {
          current.queued.splice(0).forEach(addCandidate);
        }).catch(function () {
          current.remoteSet = false;
        });
      }
      (data.guestCandidates || []).forEach(addCandidate);
      if (data.status === "active" && window.__vcomSetCallPhase) window.__vcomSetCallPhase("active");
    }, function () {});
    function addCandidate(item) {
      if (!item) return;
      var key = JSON.stringify(item);
      if (current.seen[key]) return;
      if (!pc.remoteDescription) { current.queued.push(item); return; }
      current.seen[key] = true;
      pc.addIceCandidate(item).catch(function () {});
    }
    var muteTimer = setInterval(function () {
      if (current.closed || !current.local) {
        if (current.closed) clearInterval(muteTimer);
        return;
      }
      var muted = false;
      try { muted = !!(window.__vcomBloc && window.__vcomBloc.at && window.__vcomBloc.at.ay); } catch (e) {}
      current.local.getAudioTracks().forEach(function (track) { track.enabled = !muted; });
    }, 300);
    mediaPromise.then(function (stream) {
      if (current.closed || token !== window.__vcomGuestToken) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        return null;
      }
      current.local = stream;
      current.video = window.vcomCallHasVideo(stream);
      window.__vcomGuestVideo = !!current.video;
      if (window.vcomSetEarpieceDefault) window.vcomSetEarpieceDefault();
      window.vcomAttachCallVideo(document.getElementById("vcom-guest-local-video"), stream, "local");
      if (window.vcomLiftCallVideos) window.vcomLiftCallVideos();
      stream.getTracks().forEach(function (track) { pc.addTrack(track, stream); });
      startBack();
      return pc.createOffer();
    }).then(function (offer) {
      if (!offer || current.closed || token !== window.__vcomGuestToken) return null;
      return pc.setLocalDescription(offer).then(function () { return offer; });
    }).then(function (offer) {
      if (!offer || current.closed || token !== window.__vcomGuestToken) return null;
      var row = findRow(code);
      if (row && row.expiresAt <= Date.now() && row.status !== "active") throw new Error("expired");
      var patch = { status: "ringing", offer: { type: offer.type, sdp: offer.sdp }, video: !!current.video };
      return fs.updateDoc(ref, patch).then(function () {
        current.offerSent = true;
      });
    }).catch(function (err) {
      window.__vcomGuestErr = String(err && (err.code || err.message) || err);
      if (token !== window.__vcomGuestToken) return;
      finishCaller(true);
      if (window.__vcomSetCallPhase) window.__vcomSetCallPhase("ended");
    });
  }
  function findRow(code) {
    var found = null;
    Object.keys(window.__vcomGuestBook || {}).forEach(function (phone) {
      if (window.__vcomGuestBook[phone].code === code) found = window.__vcomGuestBook[phone];
    });
    return found;
  }

  function wireChatMedia() {
    if (document.getElementById("vcom-chat-media")) return;
    var root = document.createElement("div");
    root.id = "vcom-chat-media";
    root.hidden = true;
    root.innerHTML = '<div id="vcom-chat-thread"></div><button type="button" id="vcom-chat-options" data-options aria-label="אפשרויות">אפשרויות</button><div id="vcom-chat-sheet" hidden><button type="button" data-gallery>שליחת תמונה מהגלריה</button><button type="button" data-capture>צילום תמונה / סרטון</button></div><button type="button" id="vcom-chat-mic" data-mic aria-label="הקלטה"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg></button><p id="vcom-chat-media-status"></p><p id="vcom-chat-rec" hidden>מקליט… שחרר לשליחה</p>';
    document.body.appendChild(root);
    var thread = root.querySelector("#vcom-chat-thread");
    var sheet = root.querySelector("#vcom-chat-sheet");
    var options = root.querySelector("[data-options]");
    var status = root.querySelector("#vcom-chat-media-status");
    var recLabel = root.querySelector("#vcom-chat-rec");
    var mic = root.querySelector("[data-mic]");
    var camera = document.createElement("input");
    camera.type = "file";
    camera.accept = "image/*,video/*";
    camera.setAttribute("capture", "environment");
    camera.hidden = true;
    var gallery = document.createElement("input");
    gallery.type = "file";
    gallery.accept = "image/*";
    gallery.hidden = true;
    root.appendChild(camera);
    root.appendChild(gallery);
    var watched = "";
    var unsub = null;
    var sending = false;
    var recorder = null;
    var hold = false;
    var startedAt = 0;
    var messages = [];
    var drawn = "";
    var player = document.createElement("audio");
    var playingId = "";
    function chatOpen() {
      var blocked = !!window.__vcomRinging || (window.__vcomDrawerX || 0) > 0.2;
      try {
        var view = window.__vcomBloc && window.__vcomBloc.c;
        if (view && view.gnY && view.gnY()) blocked = true;
        if (view && view.b) blocked = true;
      } catch (eCall) {}
      return window.vcomChatSurfaceOpen(window.__vcomOpenChat, window.__vcomTab, window.__vcomChatTab, blocked);
    }
    function clock(value) {
      var ms = 0;
      if (value && typeof value.toMillis === "function") ms = value.toMillis();
      else if (value && typeof value.seconds === "number") ms = value.seconds * 1000;
      if (!ms) return "";
      var date = new Date(ms);
      return ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2);
    }
    function mine(senderId) {
      var user = currentUser();
      return !!(user && senderId === user.uid);
    }
    function paint() {
      var parts = [playingId];
      for (var i = 0; i < messages.length; i++) {
        var mark = messages[i];
        var kind = mark.media ? mark.media.kind : "text";
        parts.push(mark.id, mark.time, mark.mine ? "1" : "0", kind, kind === "text" ? (mark.text || "") : ((mark.media && mark.media.url) || ""));
      }
      var signature = parts.join("\u0001");
      if (signature === drawn && thread.childNodes.length === messages.length) return;
      drawn = signature;
      var nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
      thread.replaceChildren();
      messages.forEach(function (item) {
        var bubble = document.createElement("div");
        var mediaKind = item.media && item.media.kind;
        var plain = mediaKind === "image" || mediaKind === "video";
        bubble.className = "vcom-bubble" + (item.mine ? " mine" : "") + (plain ? " plain" : "");
        bubble.dataset.id = item.id;
        bubble.dataset.sender = item.senderId || "";
        var body;
        if (mediaKind === "image") {
          body = document.createElement("img");
          body.alt = "";
          body.decoding = "async";
          body.loading = "lazy";
          body.src = item.media.url;
        } else if (mediaKind === "video") {
          body = document.createElement("video");
          body.controls = true;
          body.playsInline = true;
          body.preload = "metadata";
          body.src = item.media.url;
        } else if (mediaKind === "audio") {
          body = document.createElement("button");
          body.type = "button";
          body.className = "vcom-voice" + (playingId === item.id ? " on" : "");
          body.dataset.voice = item.id;
          body.dataset.url = item.media.url;
          body.textContent = playingId === item.id ? "מנגן" : "נגן הקלטה";
        } else {
          body = document.createElement("p");
          body.textContent = item.text || "";
        }
        var time = document.createElement("time");
        time.textContent = item.time || "";
        var remove = document.createElement("button");
        remove.type = "button";
        remove.dataset.delete = item.id;
        remove.textContent = "מחק";
        bubble.appendChild(body);
        bubble.appendChild(time);
        bubble.appendChild(remove);
        thread.appendChild(bubble);
      });
      if (nearBottom) thread.scrollTop = thread.scrollHeight;
    }
    function readSnap(snap) {
      var next = [];
      var docs = snap && snap.docs ? snap.docs : [];
      docs.forEach(function (docSnap) {
        var data = docSnap.data ? docSnap.data() : {};
        var text = data && data.text || "";
        next.push({
          id: docSnap.id,
          senderId: data && data.senderId || "",
          text: text,
          media: window.vcomParseMedia(text),
          time: clock(data && data.createdAt),
          raw: data && data.createdAt,
          mine: mine(data && data.senderId)
        });
      });
      next.sort(function (a, b) {
        function ms(value) {
          if (!value) return 0;
          if (typeof value.toMillis === "function") return value.toMillis();
          if (typeof value.seconds === "number") return value.seconds * 1000;
          return 0;
        }
        return ms(a.raw) - ms(b.raw);
      });
      messages = next;
      paint();
    }
    function watch(chatId) {
      if (unsub) { try { unsub(); } catch (eUn) {} unsub = null; }
      watched = chatId || "";
      messages = [];
      drawn = "";
      thread.replaceChildren();
      if (!watched) return;
      var fs = window.firebase_firestore;
      if (!fs || !fs.collection || !fs.onSnapshot || !fs.getFirestore) return;
      try {
        unsub = fs.onSnapshot(fs.collection(fs.getFirestore(), "chats", watched, "messages"), function (snap) {
          if (watched !== window.__vcomOpenChat) return;
          readSnap(snap);
        }, function () {});
      } catch (eWatch) {}
    }
    function currentUser() {
      try {
        var auth = window.firebase_auth;
        return auth && auth.getAuth ? auth.getAuth().currentUser : null;
      } catch (eUser) { return null; }
    }
    function fitImage(file) {
      return new Promise(function (resolve) {
        if (typeof Image !== "function") { resolve(file); return; }
        var img = new Image();
        var local = URL.createObjectURL(file);
        img.onload = function () {
          var canvas = document.createElement("canvas");
          var longest = Math.max(img.width || 1, img.height || 1);
          var scale = Math.min(1, 960 / longest);
          canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(local);
          canvas.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", 0.62);
        };
        img.onerror = function () { URL.revokeObjectURL(local); resolve(file); };
        img.src = local;
      });
    }
    function fileUrl(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || "")); };
        reader.onerror = function () { reject(new Error("read")); };
        reader.readAsDataURL(file);
      });
    }
    function uploadFile(file, user, chatId, kind) {
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var ext = kind === "audio" ? "webm" : kind === "video" ? "mp4" : "jpg";
      var path = "chat-media/" + user.uid + "/" + chatId + "/" + id + "." + ext;
      return user.getIdToken().then(function (token) {
        return fetch("https://firebasestorage.googleapis.com/v0/b/voip-call-app-7d0c3.firebasestorage.app/o?uploadType=media&name=" + encodeURIComponent(path), {
          method: "POST",
          headers: { Authorization: "Firebase " + token, "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
      }).then(function (res) {
        if (!res.ok) throw new Error("upload");
        return res.json().then(function (data) {
          return "https://firebasestorage.googleapis.com/v0/b/voip-call-app-7d0c3.firebasestorage.app/o/" + encodeURIComponent(path) + "?alt=media&token=" + (data.downloadTokens || "");
        });
      });
    }
    function sendFile(file, kind) {
      var chatId = window.__vcomOpenChat;
      var user = currentUser();
      if (!chatId || !user || !file || sending) return;
      if (file.size > 20 * 1024 * 1024) {
        status.textContent = "הקובץ גדול מדי";
        return;
      }
      sending = true;
      status.textContent = "שולח...";
      var ready = kind === "image" ? fitImage(file) : Promise.resolve(file);
      ready.then(function (packed) {
        return uploadFile(packed, user, chatId, kind).catch(function () {
          if (packed.size > 500000) throw new Error("big");
          return fileUrl(packed);
        }).then(function (url) {
          var fs = window.firebase_firestore;
          if (!fs || !fs.doc || !fs.setDoc || !fs.getFirestore) throw new Error("no-store");
          var db = fs.getFirestore();
          var text = window.vcomEncodeMedia(kind, url);
          var when = fs.serverTimestamp ? fs.serverTimestamp() : new Date();
          var messageId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          return fs.setDoc(fs.doc(db, "chats", chatId, "messages", messageId), {
            senderId: user.uid,
            text: text,
            type: "text",
            createdAt: when
          }).then(function () {
            return fs.updateDoc(fs.doc(db, "chats", chatId), {
              lastMessage: window.vcomMediaLabel(text),
              lastMessageAt: when,
              updatedAt: when,
              lastSenderId: user.uid
            }).catch(function () {});
          });
        });
      }).then(function () {
        status.textContent = "";
      }).catch(function (err) {
        status.textContent = err && err.message === "big" ? "הקובץ גדול מדי" : "לא הצלחנו לשלוח";
      }).then(function () { sending = false; });
    }
    function takeFile(input, kind) {
      input.value = "";
      input.onchange = function () {
        var file = input.files && input.files[0];
        if (!file) return;
        sendFile(file, typeof kind === "function" ? kind(file) : kind);
      };
      input.click();
    }
    function stopStream(stream) {
      if (!stream) return;
      stream.getTracks().forEach(function (track) { try { track.stop(); } catch (eStop) {} });
    }
    function beginHold(event) {
      if (event.button != null && event.button !== 0) return;
      if (recorder || sending) return;
      event.preventDefault();
      hold = true;
      startedAt = Date.now();
      recLabel.hidden = false;
      mic.classList.add("rec");
      try { mic.setPointerCapture(event.pointerId); } catch (eCap) {}
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder !== "function") {
        hold = false;
        recLabel.hidden = true;
        mic.classList.remove("rec");
        status.textContent = "לא הצלחנו לשלוח";
        return;
      }
      window.__vcomIgnoreCapture = true;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        window.__vcomIgnoreCapture = false;
        if (!hold) { stopStream(stream); return; }
        var chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        recorder.onstop = function () {
          var keep = Date.now() - startedAt >= 450;
          var mime = (recorder && recorder.mimeType) || "audio/webm";
          mic.classList.remove("rec");
          recLabel.hidden = true;
          stopStream(stream);
          recorder = null;
          if (!keep) return;
          sendFile(new Blob(chunks, { type: mime }), "audio");
        };
        recorder.start();
      }).catch(function () {
        window.__vcomIgnoreCapture = false;
        hold = false;
        mic.classList.remove("rec");
        recLabel.hidden = true;
        status.textContent = "לא הצלחנו לשלוח";
      });
    }
    function endHold() {
      hold = false;
      if (recorder && recorder.state === "recording") recorder.stop();
      else {
        mic.classList.remove("rec");
        recLabel.hidden = true;
      }
    }
    mic.addEventListener("pointerdown", beginHold);
    mic.addEventListener("pointerup", endHold);
    mic.addEventListener("pointercancel", endHold);
    options.addEventListener("click", function (event) {
      event.preventDefault();
      sheet.hidden = !sheet.hidden;
    });
    root.querySelector("[data-gallery]").addEventListener("click", function () {
      sheet.hidden = true;
      takeFile(gallery, "image");
    });
    root.querySelector("[data-capture]").addEventListener("click", function () {
      sheet.hidden = true;
      takeFile(camera, function (file) {
        return String(file.type || "").indexOf("video/") === 0 ? "video" : "image";
      });
    });
    document.addEventListener("pointerdown", function (event) {
      if (sheet.hidden) return;
      var target = event.target;
      if (target && target.closest && (target.closest("#vcom-chat-sheet") || target.closest("[data-options]"))) return;
      sheet.hidden = true;
    }, true);
    var pressTimer = 0;
    thread.addEventListener("pointerdown", function (event) {
      var bubble = event.target.closest && event.target.closest(".vcom-bubble");
      if (!bubble) return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () { bubble.classList.add("ask"); }, 480);
    });
    thread.addEventListener("pointerup", function () { clearTimeout(pressTimer); });
    thread.addEventListener("pointermove", function () { clearTimeout(pressTimer); });
    thread.addEventListener("click", function (event) {
      var remove = event.target.closest && event.target.closest("[data-delete]");
      if (remove) {
        var bubble = remove.closest(".vcom-bubble");
        var user = currentUser();
        var fs = window.firebase_firestore;
        var chatId = window.__vcomOpenChat;
        if (!user || !fs || !fs.deleteDoc || !chatId || !bubble || bubble.dataset.sender !== user.uid) {
          status.textContent = "אפשר למחוק רק הודעה שלך";
          return;
        }
        fs.deleteDoc(fs.doc(fs.getFirestore(), "chats", chatId, "messages", remove.dataset.delete)).then(function () {
          status.textContent = "";
        }).catch(function () { status.textContent = "לא הצלחנו למחוק"; });
        return;
      }
      var voice = event.target.closest && event.target.closest("[data-voice]");
      if (!voice) return;
      if (playingId === voice.dataset.voice && !player.paused) {
        player.pause();
        playingId = "";
        paint();
        return;
      }
      playingId = voice.dataset.voice;
      player.src = voice.dataset.url;
      player.play().catch(function () { status.textContent = "לא הצלחנו לשלוח"; });
      paint();
    });
    player.addEventListener("ended", function () { playingId = ""; paint(); });
    function composerLabels() {
      var host = document.querySelector("flt-semantics-host");
      if (!host || !host.querySelectorAll) return null;
      var seen = host.querySelectorAll("[role='button'], [data-semantics-role='text-field'], [aria-label]");
      var real = false;
      for (var n = 0; n < seen.length; n++) {
        var name = seen[n].getAttribute ? (seen[n].getAttribute("aria-label") || "") : "";
        if (name === "Enable accessibility") continue;
        real = true;
        break;
      }
      if (!real) return null;
      var nodes = host.querySelectorAll("[aria-label='הודעה'], [data-semantics-role='text-field']");
      var labels = [];
      var view = window.innerHeight || 0;
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
        var visible = !!(rect && rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.top < view);
        if (visible && rect && typeof document.elementFromPoint === "function") {
          var hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 12));
          var other = hit && hit.closest && hit.closest("flt-semantics");
          if (other && other !== node && !(node.contains && node.contains(other)) && !(other.contains && other.contains(node))) visible = false;
        }
        var role = node.getAttribute ? (node.getAttribute("role") || "") : "";
        if (node.getAttribute && node.getAttribute("data-semantics-role") === "text-field") role = "textbox";
        labels.push({
          label: node.getAttribute ? (node.getAttribute("aria-label") || node.getAttribute("placeholder") || "") : "",
          role: role,
          visible: visible,
          bottom: !!(visible && rect && rect.top > view * 0.5)
        });
      }
      return labels;
    }
    setInterval(function () {
      if (document.hidden) return;
      var composer = window.vcomComposerOnScreen(composerLabels());
      var open = chatOpen() && composer !== false;
      root.hidden = !open;
      if (!open) {
        sheet.hidden = true;
        if (hold) endHold();
        if (playingId) {
          playingId = "";
          try { player.pause(); } catch (ePause) {}
        }
        if (watched) watch("");
        return;
      }
      var id = window.__vcomOpenChat || "";
      if (id !== watched) watch(id);
    }, 700);
  }
  function issuerCss() {
    return ""
      + "#vcom-link-menu{position:fixed;z-index:80;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:0 16px 8px;overflow:visible;direction:rtl;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1C1E;touch-action:manipulation}"
      + "#vcom-menu-logo{position:fixed;z-index:85;width:52px;height:52px;object-fit:contain;pointer-events:none;background:transparent;border:0;border-radius:0;box-shadow:none;padding:0}"
      + "#vcom-link-menu[hidden],#vcom-link-form[hidden],#vcom-link-banner[hidden],#vcom-dial-paste[hidden],#vcom-menu-logo[hidden]{display:none!important}"
      + "#vcom-dial-paste{position:fixed;z-index:30;top:calc(env(safe-area-inset-top,0px) + 44px);left:50%;transform:translateX(-50%);width:min(280px,78vw);height:68px;border:0;border-radius:0;outline:none;box-shadow:none;background:transparent;color:transparent;caret-color:transparent;-webkit-appearance:none;appearance:none;font-size:16px;text-align:center}"
      + "#vcom-dial-paste:focus{outline:none;box-shadow:none;border:0}"
      + "#vcom-link-open{display:flex;flex-direction:row;direction:rtl;align-items:center;justify-content:flex-start;gap:10px;width:100%;box-sizing:border-box;margin:0;padding:12px 2px;border:0;border-radius:0;background:transparent;color:#1C1C1E;text-align:right;font:600 17px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}"
      + ".vcom-link-open-icon{width:22px;height:22px;flex:0 0 22px;display:grid;place-items:center;color:#1C1C1E}"
      + ".vcom-link-open-icon svg{display:block}"
      + ".vcom-link-open-text{font-weight:600}"
      + "#vcom-link-form{display:flex;flex-direction:column;gap:8px;margin:0}"
      + "#vcom-link-name{width:100%;box-sizing:border-box;border:1px solid #E5E5EA;border-radius:12px;background:#fff;color:#1C1C1E;padding:12px 14px;font:16px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}"
      + ".vcom-link-error{min-height:18px;margin:0;color:#C62828;font-size:13px;text-align:right}"
      + "#vcom-link-form [data-ok]{min-height:44px;border:0;border-radius:12px;background:#007AFF;color:#fff;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;touch-action:manipulation}"
      + ".vcom-link-live{background:#F2F2F7;border-radius:16px;padding:12px 14px;text-align:right}"
      + ".vcom-link-guest{font-size:16px;font-weight:700;direction:rtl;unicode-bidi:isolate;overflow:visible;white-space:normal;word-break:break-word}"
      + ".vcom-link-copy{display:block;width:100%;box-sizing:border-box;min-height:44px;margin-top:8px;border:0;border-radius:12px;background:#007AFF;color:#fff;padding:0 12px;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}"
      + ".vcom-link-phone{display:block;width:100%;margin-top:8px;font-size:22px;font-weight:700;letter-spacing:.4px;direction:ltr;unicode-bidi:isolate;text-align:right;white-space:nowrap;touch-action:manipulation}"
      + ".vcom-link-meta{display:block;margin-top:4px;color:#007AFF;font-size:14px;font-weight:600;text-align:right}"
      + "#vcom-guest-remote-video{position:fixed;left:0;right:0;top:108px;bottom:168px;width:100%;height:auto;object-fit:cover;object-position:center;z-index:10020;background:#000;pointer-events:none;transform:translateZ(0)}"
      + "#vcom-guest-local-video{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);left:8px;width:min(168px,40vw);height:min(292px,36vh);object-fit:cover;object-position:center;border-radius:24px;z-index:10021;background:#111;transform:scaleX(-1);pointer-events:none}"
      + "#vcom-guest-remote-video[hidden],#vcom-guest-local-video[hidden]{display:none!important}"
      + "#vcom-chat-media[hidden]{display:none!important}"
      + "#vcom-chat-thread{position:fixed;z-index:36;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 72px);bottom:calc(env(safe-area-inset-bottom,0px) + 78px);overflow:auto;background:#F2F2F7;padding:12px 10px 8px;box-sizing:border-box}"
      + ".vcom-bubble{display:flex;flex-direction:column;align-items:flex-start;max-width:78%;margin:0 0 8px auto;background:#fff;color:#1C1C1E;border-radius:16px 16px 4px 16px;padding:6px;position:relative;content-visibility:auto;contain-intrinsic-size:72px}"
      + ".vcom-bubble.mine{margin:0 auto 8px 0;background:#007AFF;color:#fff;border-radius:16px 16px 16px 4px}"
      + ".vcom-bubble.plain,.vcom-bubble.plain.mine{background:transparent;padding:0;box-shadow:none}"
      + ".vcom-bubble p{margin:0;padding:4px 8px;font:16px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;white-space:pre-wrap;word-break:break-word;direction:rtl}"
      + ".vcom-bubble img,.vcom-bubble video{display:block;width:min(240px,68vw);height:auto;max-height:320px;object-fit:contain;border-radius:14px;background:transparent}"
      + ".vcom-bubble.plain time{color:#8E8E93;opacity:1}"
      + ".vcom-voice{min-height:44px;border:0;border-radius:12px;background:transparent;color:inherit;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:8px 12px}"
      + ".vcom-bubble time{align-self:flex-end;opacity:.75;font-size:11px;padding:2px 6px 0}"
      + ".vcom-bubble [data-delete]{display:none;position:absolute;top:-18px;left:8px;border:0;border-radius:10px;background:#FF3B30;color:#fff;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:32px;padding:0 10px}"
      + ".vcom-bubble.ask [data-delete]{display:block}"
      + "#vcom-chat-options{position:fixed;z-index:38;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);height:36px;padding:0 12px;border:1px solid #E5E5EA;border-radius:18px;background:#fff;color:#3A3A3C;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.06)}"
      + "#vcom-chat-sheet{position:fixed;z-index:39;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 58px);display:flex;flex-direction:column;min-width:220px;background:#fff;border:1px solid #E5E5EA;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden;direction:rtl}"
      + "#vcom-chat-sheet[hidden]{display:none!important}"
      + "#vcom-chat-sheet button{min-height:48px;border:0;border-bottom:1px solid #F2F2F7;background:#fff;color:#1C1C1E;text-align:right;padding:12px 16px;font:600 15px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}"
      + "#vcom-chat-sheet button:last-child{border-bottom:0}"
      + "#vcom-chat-mic{position:fixed;z-index:38;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);width:42px;height:42px;border:0;border-radius:50%;background:#007AFF;color:#fff;display:grid;place-items:center;padding:0;touch-action:none}"
      + "#vcom-chat-mic svg{display:block}"
      + "#vcom-chat-mic.rec{background:#FF3B30}"
      + "#vcom-chat-rec{position:fixed;z-index:38;left:58px;right:108px;bottom:calc(env(safe-area-inset-bottom,0px) + 20px);margin:0;color:#FF3B30;font:600 14px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:right;pointer-events:none}"
      + "#vcom-chat-rec[hidden]{display:none!important}"
      + "#vcom-chat-media-status{position:fixed;z-index:38;left:56px;right:108px;bottom:calc(env(safe-area-inset-bottom,0px) + 58px);margin:0;color:#C62828;font-size:13px;text-align:center;pointer-events:none}";
  }
  function guestCss() {
    return ""
      + "#vcom-guest{position:fixed;inset:0;z-index:10000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1C1E}"
      + "#vcom-guest [hidden]{display:none!important}"
      + ".guest-wait{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,#EAF6FF 0%,#7EC8F8 100%);text-align:center;padding:24px}"
      + ".guest-wait img{width:min(220px,46vw);height:auto;transform-origin:50% 55%;animation:vcom-ring 1.15s ease-in-out infinite}"
      + ".guest-wait h1{margin:18px 0 0;color:#fff;font-size:clamp(40px,8vw,52px)}"
      + ".guest-wait p{margin:14px 0 0;color:#fff;font-size:clamp(22px,5vw,28px);font-weight:600}"
      + ".guest-call{position:relative;box-sizing:border-box;height:100dvh;height:100svh;display:flex;flex-direction:column;overflow:hidden;background:#F2F2F7;padding:calc(env(safe-area-inset-top,0px) + 56px) 24px calc(env(safe-area-inset-bottom,0px) + 84px)}"
      + ".guest-logo{display:flex;justify-content:center;align-items:center;margin:8px 0 0;font-size:28px;font-weight:400;line-height:1;letter-spacing:0}"
      + ".guest-logo .v{color:#34C759}"
      + ".guest-logo .com{color:#007AFF}"
      + ".guest-stage{position:absolute;inset:0;z-index:0;background:#111}"
      + ".guest-stage [data-remote]{position:fixed;left:0;right:0;top:108px;bottom:168px;width:100%;height:auto;object-fit:cover;object-position:center;background:#000;transform:translateZ(0)}"
      + ".guest-stage [data-local]{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);left:8px;width:min(168px,40vw);height:min(292px,36vh);object-fit:cover;object-position:center;border-radius:24px;transform:scaleX(-1);background:#111}"
      + ".guest-call header,.guest-mid,.guest-controls{position:relative;z-index:1}"
      + ".guest-call.video .guest-mid h2,.guest-call.video .guest-mid p{color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.65)}"
      + ".guest-mid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}"
      + ".guest-mid h2{margin:0;font-size:clamp(28px,7vw,40px)}"
      + ".guest-mid p{margin:10px 0 0;color:#8E8E93;font-size:clamp(18px,4vw,22px)}"
      + ".guest-controls{display:flex;justify-content:center;gap:clamp(18px,6vw,36px);align-items:flex-end}"
      + ".guest-controls button{width:74px;height:74px;border:0;border-radius:50%;color:#fff;font-size:15px;font-weight:700}"
      + ".guest-controls .answer{background:#34C759}"
      + ".guest-controls .hang{background:#FF3B30}"
      + ".guest-controls .tool{background:#E5E5EA;color:#1C1C1E}"
      + ".guest-controls .tool.on{background:#007AFF;color:#fff}"
      + ".guest-dead{min-height:100dvh;display:flex;flex-direction:column;align-items:center;background:#F2F2F7;text-align:center;padding:calc(env(safe-area-inset-top,0px) + 36px) 22px calc(env(safe-area-inset-bottom,0px) + 28px)}"
      + ".guest-dead.after-call{justify-content:center}"
      + ".guest-dead:not(.after-call){justify-content:flex-start;padding-top:14vh}"
      + ".guest-dead .guest-logo{margin:0 0 18px;font-size:34px}"
      + ".guest-dead.after-call .guest-logo,.guest-dead.after-call .guest-expired{display:none!important}"
      + ".guest-expired{margin:0 0 22px;color:#3A3A3C;font-size:20px;font-weight:700}"
      + ".guest-join{appearance:none;-webkit-appearance:none;display:flex;flex-direction:column;align-items:center;gap:22px;margin-top:8px;border:0;background:transparent;color:#1C1C1E;padding:0;font:inherit;max-width:min(440px,100%);width:100%;text-align:center}"
      + ".guest-dead:not(.after-call) .guest-join{margin-top:8px}"
      + ".guest-join-title{margin:0;font-size:clamp(30px,8vw,44px);font-weight:800;line-height:1.28;letter-spacing:-.02em;direction:rtl;unicode-bidi:isolate}"
      + ".guest-join-brand{white-space:nowrap;unicode-bidi:isolate}"
      + ".guest-join-cta{display:flex;flex-direction:row;direction:ltr;align-items:center;gap:12px;background:#fff;border-radius:18px;padding:10px 18px 10px 10px;box-shadow:0 8px 24px rgba(28,39,61,.08)}"
      + ".guest-join-sub{direction:rtl;font-size:clamp(17px,4.3vw,21px);font-weight:600;color:#3A3A3C}"
      + ".guest-join-handset{width:56px;height:56px;flex:0 0 56px;object-fit:contain;background:transparent;pointer-events:none}"
      + ".guest-join .vcom-word{display:inline-block;margin:0;unicode-bidi:isolate}"
      + ".guest-join .v{color:#34C759;font-weight:800}"
      + ".guest-join .com{color:#007AFF;font-weight:800}";
  }
  function guestHtml() {
    return ''
      + '<section class="guest-wait" data-view="wait"><img src="/icons/vcom-splash.png?v=call11" alt="VCOM"><h1>VCOM</h1><p>המתן לשיחה</p></section>'
      + '<section class="guest-call" data-view="call" hidden><div class="guest-stage" data-stage hidden><video id="vcom-guest-remote-video" data-remote autoplay playsinline></video><video id="vcom-guest-local-video" data-local autoplay playsinline muted></video></div><header class="guest-logo" aria-label="VCOM"><span class="com">COM</span><span class="v">V</span></header><div class="guest-mid"><h2 data-name></h2><p data-status>שיחה נכנסת</p><p data-timer hidden>0:00</p></div>'
      + '<div class="guest-controls"><button type="button" class="tool" data-speaker hidden>רמקול</button><button type="button" class="answer" data-answer>ענה</button><button type="button" class="hang" data-decline>דחה</button><button type="button" class="hang" data-hang hidden>נתק</button><button type="button" class="tool" data-mute hidden>השתק</button></div></section>'
      + '<section class="guest-dead" data-view="dead" hidden><header class="guest-logo" aria-label="VCOM"><span class="vcom-word" dir="ltr"><span class="v">V</span><span class="com">COM</span></span></header><p class="guest-expired" data-expired>לינק שיחה פג תוקף</p><p data-dead hidden></p><button type="button" class="guest-join" data-join><span class="guest-join-title" dir="rtl">עדיין אין לך <span class="guest-join-brand">מנוי&nbsp;<span class="vcom-word" dir="ltr"><span class="v">V</span><span class="com">COM</span></span></span></span><span class="guest-join-cta"><img class="guest-join-handset" src="/icons/vcom-splash.png?v=call11" alt=""><span class="guest-join-sub" dir="rtl">לחץ כאן להגשת בקשה</span></span></button></section>';
  }
})();
