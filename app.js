(function () {
  "use strict";

  var USERS_KEY = "vcom.users.v1";
  var SESSION_KEY = "vcom.session.v1";
  var RECENTS_KEY = "vcom.recents.v1";
  var MEDIA_KEY = "vcom.media.granted.v1";
  var REVISION_KEY = "vcom_revision";

  var DEMO_CONTACTS = [
    { name: "דמו VCOM", subtitle: "שיחת הדגמה במכשיר", peer: "demo", kind: "sim" },
    { name: "אבי כהן", subtitle: "050-123-4567", peer: "sim-avi", kind: "sim" },
    { name: "נועה לוי", subtitle: "052-987-6543", peer: "sim-noa", kind: "sim" }
  ];

  var TAB_TITLES = { recents: "אחרונות", contacts: "אנשי קשר", keypad: "מקשים", me: "החשבון" };

  var state = {
    screen: "register",
    tab: "recents",
    user: null,
    dial: "",
    call: null,
    peer: null,
    localStream: null,
    currentCall: null,
    timer: null,
    startedAt: 0,
    incoming: null,
    captureGen: 0,
    callTimers: []
  };

  function $(id) { return document.getElementById(id); }
  function show(el, on) { if (el) el.hidden = !on; }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(bytesToHex);
  }

  function displayName(email) {
    var part = String(email || "").split("@")[0] || "משתמש";
    try { part = decodeURIComponent(part); } catch (e) {}
    return part.charAt(0).toUpperCase() + part.slice(1);
  }

  function initials(name) {
    return String(name || "V").trim().charAt(0).toUpperCase();
  }

  function formatCode(hex) {
    var s = hex.slice(0, 8).toUpperCase();
    return s.slice(0, 4) + "-" + s.slice(4);
  }

  function peerIdFromHex(hex) {
    return "vcom" + hex.slice(0, 16);
  }

  function go(screen) {
    state.screen = screen;
    ["welcome", "register", "login", "app", "pending"].forEach(function (name) {
      show($("screen-" + name), name === screen);
    });
    if (screen === "app") renderApp();
  }

  function setSession(user) {
    state.user = user;
    if (user) saveJson(SESSION_KEY, { email: user.email });
    else localStorage.removeItem(SESSION_KEY);
  }

  function restoreSession() {
    var session = loadJson(SESSION_KEY, null);
    if (!session) return null;
    var users = loadJson(USERS_KEY, []);
    return users.find(function (u) { return u.email === session.email; }) || null;
  }

  function setError(id, msg) {
    var el = $(id);
    if (!msg) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  function bindEyes() {
    document.querySelectorAll(".eye").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = $(btn.getAttribute("data-toggle"));
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
      });
    });
  }

  document.querySelectorAll("[data-go]").forEach(function (btn) {
    btn.addEventListener("click", function () { go(btn.getAttribute("data-go")); });
  });
  bindEyes();

  $("form-register").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("reg-email").value.trim().toLowerCase();
    var pass = $("reg-pass").value;
    var pass2 = $("reg-pass2").value;
    setError("reg-error", "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("reg-error", "כתובת אימייל לא תקינה");
    if (pass.length < 6) return setError("reg-error", "הסיסמה חייבת 6 תווים לפחות");
    if (pass !== pass2) return setError("reg-error", "הסיסמאות אינן תואמות");
    var users = loadJson(USERS_KEY, []);
    if (users.some(function (u) { return u.email === email; })) {
      return setError("reg-error", "האימייל כבר רשום במכשיר זה. התחברו.");
    }
    sha256(pass).then(function (passHash) {
      return sha256(email).then(function (emailHash) {
        var user = {
          email: email,
          name: displayName(email),
          passHash: passHash,
          code: formatCode(emailHash),
          peerId: peerIdFromHex(emailHash),
          pending: true
        };
        users.push(user);
        saveJson(USERS_KEY, users);
        setSession(user);
        go("pending");
      });
    }).catch(function () {
      setError("reg-error", "לא ניתן להשלים הרשמה כרגע");
    });
  });

  $("form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("login-email").value.trim().toLowerCase();
    var pass = $("login-pass").value;
    setError("login-error", "");
    var users = loadJson(USERS_KEY, []);
    var user = users.find(function (u) { return u.email === email; });
    if (!user) return setError("login-error", "לא נמצא חשבון במכשיר זה. הירשמו קודם.");
    sha256(pass).then(function (hash) {
      if (hash !== user.passHash) return setError("login-error", "סיסמה שגויה");
      setSession(user);
      if (user.pending) go("pending");
      else {
        go("app");
        connectPeer();
      }
    });
  });

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-tab") === tab);
    });
    document.querySelectorAll(".tab-page").forEach(function (p) {
      p.hidden = p.getAttribute("data-tab-page") !== tab;
    });
    $("header-title").textContent = TAB_TITLES[tab];
    if (tab === "recents") renderRecents();
    if (tab === "contacts") renderContacts();
    if (tab === "me") renderMe();
  }

  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () { setTab(btn.getAttribute("data-tab")); });
  });

  function renderApp() {
    var user = state.user;
    $("hello").textContent = "שלום, " + user.name;
    $("my-id").textContent = user.code;
    setTab(state.tab);
    renderContacts();
    renderRecents();
    renderMe();
  }

  function renderMe() {
    var user = state.user;
    $("me-name").textContent = user.name;
    $("me-email").textContent = user.email;
    $("me-code").textContent = user.code;
  }

  function renderContacts() {
    var ul = $("contacts-list");
    ul.innerHTML = "";
    DEMO_CONTACTS.forEach(function (c) { ul.appendChild(contactRow(c)); });
  }

  function contactRow(c) {
    var li = document.createElement("li");
    li.className = "row";
    li.innerHTML =
      '<div class="avatar">' + initials(c.name) + "</div>" +
      '<div class="grow"><h3></h3><p></p></div>' +
      '<button type="button" class="call-mini" aria-label="חייג"></button>';
    li.querySelector("h3").textContent = c.name;
    li.querySelector("p").textContent = c.subtitle;
    li.querySelector(".call-mini").innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C12.4 21 3 11.6 3 1c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>';
    li.querySelector(".call-mini").addEventListener("click", function () {
      startCall({ name: c.name, peer: c.peer, kind: c.kind || "sim" });
    });
    return li;
  }

  function recents() { return loadJson(RECENTS_KEY, []); }

  function pushRecent(entry) {
    var list = recents();
    list.unshift({
      name: entry.name,
      subtitle: entry.kind === "out" ? "יוצאת" : "נכנסת",
      at: Date.now(),
      peer: entry.peer,
      kind: "sim"
    });
    saveJson(RECENTS_KEY, list.slice(0, 30));
  }

  function renderRecents() {
    var list = recents();
    var ul = $("recents-list");
    var empty = $("recents-empty");
    ul.innerHTML = "";
    empty.hidden = list.length > 0;
    list.forEach(function (c) {
      var when = new Date(c.at);
      var label = when.toLocaleString("he-IL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
      ul.appendChild(contactRow({
        name: c.name,
        subtitle: (c.subtitle || "") + " · " + label,
        peer: c.peer || "demo",
        kind: c.kind || "sim"
      }));
    });
  }

  var KEYS = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["*", ""], ["0", "+"], ["#", ""]
  ];
  (function buildKeypad() {
    var box = $("keypad");
    KEYS.forEach(function (pair) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "key";
      b.innerHTML = pair[0] + (pair[1] ? "<small>" + pair[1] + "</small>" : "");
      b.addEventListener("click", function () {
        state.dial += pair[0];
        $("dial-display").textContent = state.dial;
      });
      box.appendChild(b);
    });
  })();
  $("dial-clear").addEventListener("click", function () {
    state.dial = state.dial.slice(0, -1);
    $("dial-display").textContent = state.dial || " ";
  });
  $("dial-call").addEventListener("click", function () {
    var target = state.dial.trim();
    if (!target) return toast("חייגו מספר או מזהה");
    startCall({ name: target, peer: target, kind: "auto" });
  });

  $("copy-id").addEventListener("click", function () {
    var code = state.user && state.user.code;
    if (!code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { toast("המזהה הועתק"); }).catch(function () {
        toast(code);
      });
    } else toast(code);
  });
  $("logout").addEventListener("click", function () {
    hangup();
    if (state.peer) try { state.peer.destroy(); } catch (e) {}
    state.peer = null;
    setSession(null);
    go("welcome");
  });

  function ringTone(on) {
    if (!on) {
      if (ringTone.timer) clearInterval(ringTone.timer);
      ringTone.timer = null;
      if (ringTone.ctx) try { ringTone.ctx.close(); } catch (e) {}
      ringTone.ctx = null;
      return;
    }
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [659.25, 987.77, 830.61, 1174.66];
    var play = function () {
      if (!ringTone.ctx) return;
      var t0 = ctx.currentTime + 0.02;
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var start = t0 + i * 0.28;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(start); osc.stop(start + 0.26);
      });
    };
    play();
    ringTone.ctx = ctx;
    ringTone.timer = setInterval(play, 2600);
  }

  function stopTracks(stream) {
    if (!stream || !stream.getTracks) return;
    stream.getTracks().forEach(function (track) {
      try { track.stop(); } catch (e) {}
    });
  }

  function clearCallTimers() {
    (state.callTimers || []).forEach(function (id) { clearTimeout(id); });
    state.callTimers = [];
    clearInterval(state.timer);
    state.timer = null;
  }

  function stopPeerSenders(call) {
    var pc = call && (call.peerConnection || call._pc || call.pc);
    if (!pc || !pc.getSenders) return;
    try {
      pc.getSenders().forEach(function (sender) {
        if (sender && sender.track) {
          try { sender.track.stop(); } catch (e) {}
        }
      });
    } catch (e) {}
  }

  function releaseCapture() {
    state.captureGen += 1;
    stopTracks(state.localStream);
    state.localStream = null;
    stopPeerSenders(state.currentCall);
    document.querySelectorAll("audio, video").forEach(function (el) {
      stopTracks(el.srcObject);
      el.srcObject = null;
      try { el.pause(); } catch (e) {}
    });
  }

  function ensureMic() {
    var gen = state.captureGen;
    if (state.localStream) {
      var live = state.localStream.getTracks().some(function (track) {
        return track.readyState !== "ended";
      });
      if (live) return Promise.resolve(state.localStream);
      state.localStream = null;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("אין גישה למיקרופון בדפדפן זה"));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
      if (gen !== state.captureGen) {
        stopTracks(stream);
        return Promise.reject(new Error("call-ended"));
      }
      rememberMedia(stream);
      state.localStream = stream;
      return stream;
    });
  }

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

  (function wrapGetUserMedia() {
    var devices = navigator.mediaDevices;
    if (!devices || !devices.getUserMedia) return;
    var raw = devices.getUserMedia.bind(devices);
    devices.getUserMedia = function (constraints) {
      var gen = state.captureGen;
      var askedAudio = !!(constraints && constraints.audio);
      var askedVideo = !!(constraints && constraints.video);
      var mem = mediaGranted();
      var gestured = !navigator.userActivation || navigator.userActivation.isActive;
      var run = function (spec) {
        return raw(spec).then(function (stream) {
          if (gen !== state.captureGen) {
            stopTracks(stream);
            return Promise.reject(new Error("call-ended"));
          }
          rememberMedia(stream);
          return stream;
        });
      };
      if (askedAudio && gestured && !mem.video) {
        return run({ audio: constraints.audio, video: { facingMode: "user" } }).then(function (stream) {
          rememberMedia(stream);
          stopTracks(stream);
          return run(constraints);
        }).catch(function () { return run(constraints); });
      }
      return run(constraints);
    };
  })();

  setInterval(function () {
    var callOn = $("call-layer") && !$("call-layer").hidden;
    var incomingOn = $("incoming-layer") && !$("incoming-layer").hidden;
    if (callOn || incomingOn || state.currentCall || state.incoming) return;
    if (state.localStream) releaseCapture();
  }, 1000);

  function setMute(on) {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(function (t) { t.enabled = !on; });
    }
    $("btn-mute").classList.toggle("is-on", on);
    $("btn-mute").querySelector("span").textContent = on ? "מושתק" : "השתק";
  }

  $("btn-mute").addEventListener("click", function () {
    var on = !$("btn-mute").classList.contains("is-on");
    setMute(on);
  });
  $("btn-speaker").addEventListener("click", function () {
    $("btn-speaker").classList.toggle("is-on");
    var audio = $("remote-audio");
    audio.setAttribute("playsinline", "");
    try { audio.play(); } catch (e) {}
  });
  $("btn-hangup").addEventListener("click", hangup);
  $("btn-decline").addEventListener("click", hangup);
  $("btn-accept").addEventListener("click", function () {
    var inc = state.incoming;
    state.incoming = null;
    show($("incoming-layer"), false);
    ringTone(false);
    if (!inc) return;
    var gen = state.captureGen;
    ensureMic().then(function (stream) {
      if (gen !== state.captureGen) {
        stopTracks(stream);
        return;
      }
      inc.call.answer(stream);
      bindMediaCall(inc.call, inc.name || "שיחה נכנסת", "in");
    }).catch(function (err) {
      if (err && err.message === "call-ended") return;
      toast(err.message || "לא ניתן לענות");
    });
  });

  function openCallUi(name, label) {
    $("call-name").textContent = name;
    $("call-avatar").textContent = initials(name);
    $("call-state").textContent = label;
    $("call-timer").textContent = "00:00";
    setMute(false);
    show($("call-layer"), true);
  }

  function startTimer() {
    state.startedAt = Date.now();
    clearInterval(state.timer);
    state.timer = setInterval(function () {
      var s = Math.floor((Date.now() - state.startedAt) / 1000);
      var m = String(Math.floor(s / 60)).padStart(2, "0");
      var r = String(s % 60).padStart(2, "0");
      $("call-timer").textContent = m + ":" + r;
    }, 500);
  }

  function hangup() {
    if (hangup._busy) return;
    hangup._busy = true;
    try {
      clearCallTimers();
      ringTone(false);
      var incoming = state.incoming;
      state.incoming = null;
      var call = state.currentCall;
      state.currentCall = null;
      state.call = null;
      if (incoming && incoming.call && incoming.call !== call) {
        try { incoming.call.close(); } catch (e) {}
      }
      releaseCapture();
      if (call) try { call.close(); } catch (e) {}
      show($("call-layer"), false);
      show($("incoming-layer"), false);
      $("btn-mute").classList.remove("is-on");
      $("btn-mute").querySelector("span").textContent = "השתק";
    } finally {
      hangup._busy = false;
    }
  }

  function bindMediaCall(call, name, dir) {
    state.currentCall = call;
    openCallUi(name, "מתחבר…");
    call.on("stream", function (remote) {
      $("remote-audio").srcObject = remote;
      $("call-state").textContent = "שיחה פעילה";
      startTimer();
    });
    call.on("close", hangup);
    call.on("error", function () { toast("השיחה נקטעה"); hangup(); });
    pushRecent({ name: name, peer: name, kind: dir === "in" ? "in" : "out" });
    renderRecents();
  }

  function simulateCall(name) {
    var gen = state.captureGen;
    openCallUi(name, "מחייג…");
    ringTone(true);
    pushRecent({ name: name, peer: name, kind: "out" });
    renderRecents();
    state.callTimers.push(setTimeout(function () {
      if (gen !== state.captureGen) return;
      ringTone(false);
      ensureMic().then(function () {
        if (gen !== state.captureGen) return;
        $("call-state").textContent = "שיחת הדגמה · המיקרופון פעיל";
        startTimer();
      }).catch(function () {
        if (gen !== state.captureGen) return;
        $("call-state").textContent = "שיחת הדגמה";
        startTimer();
      });
    }, 1600));
  }

  function lookupPeerId(target) {
    var t = String(target || "").trim();
    if (!t) return Promise.resolve(null);
    if (t.indexOf("@") !== -1) {
      return sha256(t.toLowerCase()).then(peerIdFromHex);
    }
    var compact = t.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (compact.length >= 8) return Promise.resolve("vcom" + compact.slice(0, 16));
    return Promise.resolve(null);
  }

  function startCall(target) {
    if (target.kind === "sim" || target.peer === "demo" || String(target.peer).indexOf("sim-") === 0) {
      simulateCall(target.name);
      return;
    }
    lookupPeerId(target.peer).then(function (pid) {
      if (!pid || !state.peer) {
        simulateCall(target.name);
        return;
      }
      var gen = state.captureGen;
      ensureMic().then(function (stream) {
        if (gen !== state.captureGen) {
          stopTracks(stream);
          return;
        }
        openCallUi(target.name, "מחייג…");
        ringTone(true);
        var call = state.peer.call(pid, stream);
        call.on("stream", function () { ringTone(false); });
        bindMediaCall(call, target.name, "out");
        state.callTimers.push(setTimeout(function () {
          if (gen !== state.captureGen) return;
          if ($("call-state").textContent === "מחייג…" || $("call-state").textContent === "מתחבר…") {
            ringTone(false);
            $("call-state").textContent = "לא נענה · עובר להדגמה";
            ensureMic().then(function () {
              if (gen !== state.captureGen) return;
              $("call-state").textContent = "שיחת הדגמה · המיקרופון פעיל";
              startTimer();
            }).catch(function () {});
          }
        }, 8000));
      }).catch(function (err) {
        if (err && err.message === "call-ended") return;
        toast(err.message || "לא ניתן לפתוח מיקרופון");
        simulateCall(target.name);
      });
    });
  }

  function connectPeer() {
    if (typeof Peer === "undefined" || !state.user) return;
    try {
      if (state.peer) try { state.peer.destroy(); } catch (e) {}
      var peer = new Peer(state.user.peerId, { debug: 0 });
      state.peer = peer;
      peer.on("call", function (call) {
        state.incoming = { call: call, name: call.peer || "שיחה נכנסת" };
        $("in-name").textContent = "שיחה נכנסת";
        $("in-avatar").textContent = "V";
        show($("incoming-layer"), true);
        ringTone(true);
        call.on("close", function () {
          if (state.incoming && state.incoming.call === call) hangup();
        });
        call.on("error", function () {
          if (state.incoming && state.incoming.call === call) hangup();
        });
      });
      peer.on("error", function (err) {
        if (err && err.type === "unavailable-id") {
          state.peer = new Peer(undefined, { debug: 0 });
        }
      });
    } catch (e) {}
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=v7").catch(function () {});
  }

  function callOpen() {
    return ($("call-layer") && !$("call-layer").hidden) || ($("incoming-layer") && !$("incoming-layer").hidden);
  }
  var SEEN_KEY = "vcom_update_seen";
  var PENDING_KEY = "vcom_pending_revision";
  var pendingUpdate = 0;
  function seenUpdateRevision() {
    try { return Number(localStorage.getItem(SEEN_KEY) || 0) || 0; } catch (e) { return 0; }
  }
  function showUpdate(revision) {
    revision = Number(revision || 0);
    if (!revision || revision <= seenUpdateRevision()) return;
    pendingUpdate = revision;
    try { localStorage.setItem(PENDING_KEY, String(revision)); } catch (e) {}
    if (callOpen()) return;
    show($("vcom-update"), true);
  }
  function applyUpdate() {
    var revision = pendingUpdate || Date.now();
    try {
      localStorage.setItem(REVISION_KEY, String(revision));
      localStorage.setItem(SEEN_KEY, String(revision));
      localStorage.removeItem(PENDING_KEY);
    } catch (e) {}
    var done = function () { location.replace("./?upd=" + revision); };
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
  if ($("vcom-update-go")) {
    $("vcom-update-go").addEventListener("click", function (event) {
      event.stopPropagation();
      applyUpdate();
    });
  }
  function restorePendingUpdateNow() {
    var storedPending = 0;
    try { storedPending = Number(localStorage.getItem(PENDING_KEY) || 0) || 0; } catch (e) {}
    if (storedPending) showUpdate(storedPending);
  }
  setInterval(function () {
    if ((pendingUpdate || pendingUpdateRevisionSafe()) && !callOpen() && $("vcom-update") && $("vcom-update").hidden) {
      restorePendingUpdateNow();
      show($("vcom-update"), true);
    }
  }, 700);
  function pendingUpdateRevisionSafe() {
    try { return Number(localStorage.getItem(PENDING_KEY) || 0) || 0; } catch (e) { return 0; }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") restorePendingUpdateNow();
  });
  window.addEventListener("pageshow", restorePendingUpdateNow);

  if ($("pending-logout")) {
    $("pending-logout").addEventListener("click", function () {
      setSession(null);
      go("welcome");
    });
  }

  (function demoGuestDead() {
    var params = new URLSearchParams(location.search);
    var panel = $("demo-guest-dead");
    if (!panel) return;
    if (params.get("signup") === "1") {
      go("register");
      return;
    }
    var after = params.get("aftercall") === "1" || params.get("declined") === "1";
    var expired = params.get("expired") === "1";
    if (!after && !expired) return;
    ["welcome", "register", "login", "app", "pending"].forEach(function (name) {
      show($("screen-" + name), false);
    });
    panel.hidden = false;
    panel.classList.toggle("after-call", after);
    if ($("demo-expired")) $("demo-expired").hidden = after;
    if ($("demo-join")) {
      $("demo-join").addEventListener("click", function () { go("register"); panel.hidden = true; });
    }
  })();

  (function restorePendingUpdate() {
    var params = new URLSearchParams(location.search);
    if (params.get("demoUpdate") === "1") {
      showUpdate(Date.now());
      return;
    }
    var storedPending = 0;
    try { storedPending = Number(localStorage.getItem(PENDING_KEY) || 0) || 0; } catch (e) {}
    if (storedPending) showUpdate(storedPending);
  })();

  var existing = restoreSession();
  if (existing) {
    setSession(existing);
    if (existing.pending) go("pending");
    else {
      go("app");
      connectPeer();
    }
  } else if (new URLSearchParams(location.search).get("signup") === "1") {
    go("register");
  } else if (new URLSearchParams(location.search).get("aftercall") !== "1" && new URLSearchParams(location.search).get("declined") !== "1" && new URLSearchParams(location.search).get("expired") !== "1") {
    go("register");
  }
})();
