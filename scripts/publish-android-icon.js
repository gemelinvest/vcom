#!/usr/bin/env node
"use strict";

// Publishes the browser-install icon, call screen, and link status onto the
// existing Flutter hosting release. It clones every current file hash, then
// replaces only the icon, manifest, link.js, index cache queries, and the
// answer hook in main.dart.js. It never uploads a fresh public folder,
// because that would delete the rest of the live app.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const SITE = "voip-call-app-7d0c3";
const API = "https://firebasehosting.googleapis.com/v1beta1";
const REPLACEMENTS = {
  "/manifest.json": path.join(ROOT, "manifest.json"),
  "/icons/vcom-splash-plain-192.png": path.join(ROOT, "icons/vcom-splash-plain-192.png"),
  "/icons/vcom-splash-plain-512.png": path.join(ROOT, "icons/vcom-splash-plain-512.png"),
  "/link.js": path.join(ROOT, "link.js"),
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function gzipHash(buf) {
  const gz = zlib.gzipSync(buf, { level: 9 });
  return {
    hash: crypto.createHash("sha256").update(gz).digest("hex"),
    gz,
  };
}

function serviceAccountToken(file) {
  const sa = JSON.parse(fs.readFileSync(file, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
      "https://www.googleapis.com/auth/firebase.hosting",
    ].join(" "),
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(header + "." + payload);
  sign.end();
  const jwt = header + "." + payload + "." + sign.sign(sa.private_key).toString("base64url");
  return fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  }).then(async (res) => {
    const json = await res.json();
    if (!res.ok) fail("Service account token exchange failed: " + (json.error || res.status));
    return json.access_token;
  });
}

function readRefreshToken() {
  if (process.env.FIREBASE_TOKEN) return process.env.FIREBASE_TOKEN;
  const file = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!fs.existsSync(file)) return "";
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return (data.tokens && data.tokens.refresh_token) || "";
}

function clientCredentials() {
  const id = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
  const secret = "j9iVZfS8kkCEFUPaAeJV0sAi";
  return { id, secret };
}

async function accessToken() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (sa) return serviceAccountToken(sa);
  const refresh = readRefreshToken();
  if (!refresh) {
    fail("Firebase CLI is not logged in on this machine, so the live site cannot be updated. Run `npx firebase-tools@13 login` and then node scripts/publish-android-icon.js");
  }
  const { id, secret } = clientCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) fail("Firebase token refresh failed: " + (json.error || res.status));
  return json.access_token;
}

async function api(token, method, urlPath, body) {
  const res = await fetch(API + urlPath, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  }
  if (!res.ok) {
    fail(method + " " + urlPath + " failed (" + res.status + "): " + text.slice(0, 500));
  }
  return json;
}

async function listFiles(token, versionName) {
  const files = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) q.set("pageToken", pageToken);
    const json = await api(token, "GET", "/" + versionName + "/files?" + q.toString());
    files.push(...(json.files || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return files;
}

function hostingConfig(config) {
  const keep = {};
  for (const key of ["headers", "redirects", "rewrites", "cleanUrls", "trailingSlashBehavior", "appAssociation", "i18n"]) {
    if (config[key] !== undefined) keep[key] = config[key];
  }
  return keep;
}

function once(html, from, to, label) {
  const count = html.split(from).length - 1;
  if (count !== 1) fail("Expected exactly one " + label + " in the live file, found " + count);
  return html.replace(from, to);
}

function patchedIndex(html) {
  return once(html, "link.js?v=vid22", "link.js?v=vid23", "link.js cache query");
}

function patchedDial(src) {
  const limit = [
    ["if(r.length>=9)return", "if(r.length>=15)return"],
    ["if(d.length>9)d=d.substring(0,9)", "if(d.length>15)d=d.substring(0,15)"],
    ["p=q.length>9?B.c.ag(q,0,9):q", "p=q.length>15?B.c.ag(q,0,15):q"],
    ["q=r.length>9?B.c.ag(r,0,9):r", "q=r.length>15?B.c.ag(r,0,15):r"],
  ];
  let next = src;
  for (const pair of limit) {
    if (next.includes(pair[1])) continue;
    next = once(next, pair[0], pair[1], "dial length");
  }
  const gate = 'if(!p.c.gz8()){o=p.c.lp("\\u05d4\\u05d6\\u05df \\u05de\\u05e1\\u05e4\\u05e8 \\u05d8\\u05dc\\u05e4\\u05d5\\u05df \\u05de\\u05dc\\u05d0 (020XXXXXX).",B.iF)';
  const handoff = 'if(window.vcomDialKind&&window.vcomDialKind(p.c.c)==="whatsapp"){if(window.vcomOpenWhatsAppCall)window.vcomOpenWhatsAppCall(p.c.c);s=1;break}if(!p.c.gz8()){o=p.c.lp("\\u05d4\\u05d6\\u05df \\u05de\\u05e1\\u05e4\\u05e8 VCOM \\u05de\\u05dc\\u05d0 \\u05d0\\u05d5 \\u05de\\u05e1\\u05e4\\u05e8 \\u05d8\\u05dc\\u05e4\\u05d5\\u05df \\u05d0\\u05de\\u05d9\\u05ea\\u05d9.",B.iF)';
  if (!next.includes('window.vcomDialKind(p.c.c)==="whatsapp"')) next = once(next, gate, handoff, "dial gate");
  const blocked = "if(!A.azj(q))return!1";
  const opened = 'if(!(A.azj(q)||(window.vcomCallButtonReady&&window.vcomCallButtonReady(q))))return!1';
  if (!next.includes(opened)) next = once(next, blocked, opened, "call button");
  return next;
}

async function linkBody() {
  const disk = fs.readFileSync(path.join(ROOT, "link.js"));
  const src = disk.toString("utf8");
  const placeholder = 'credential: "openrelayproject"';
  if (!src.includes(placeholder)) return disk;
  const live = await fetch("https://" + SITE + ".web.app/link.js", { cache: "no-store" });
  if (!live.ok) fail("Could not read the live link.js");
  const found = (await live.text()).match(/credential:\s*"([^"]+)"/);
  if (!found || found[1] === "openrelayproject") fail("Live link.js has no relay credential to keep");
  return Buffer.from(src.replace(placeholder, 'credential: "' + found[1] + '"'), "utf8");
}

function patchedBundle(buf) {
  let src = buf.toString("utf8");
  const decline = "window.__vcomDecline=function(){q.C(0,B.Vy)}";
  const answer = "window.__vcomAnswer=function(){q.C(0,B.Vx)}";
  if (!src.includes(answer)) src = once(src, decline, decline + ";" + answer, "decline hook");
  src = patchedDial(src);
  return Buffer.from(src, "utf8");
}

async function main() {
  for (const file of Object.values(REPLACEMENTS)) {
    if (!fs.existsSync(file)) fail("Missing " + file);
  }
  const token = await accessToken();
  const channel = await api(token, "GET", "/sites/" + SITE + "/channels/live");
  const versionName = channel.release && channel.release.version && channel.release.version.name;
  if (!versionName) fail("Live channel has no released version");
  const config = hostingConfig((channel.release.version && channel.release.version.config) || {});
  const existing = await listFiles(token, versionName);
  const paths = new Set(existing.map((file) => file.path));
  for (const required of ["/index.html", "/main.dart.js", "/link.js", "/manifest.json"]) {
    if (!paths.has(required)) fail("Refusing to publish: live version is missing " + required);
  }

  const files = {};
  const uploads = new Map();
  for (const file of existing) {
    if (file.status && file.status !== "ACTIVE") continue;
    files[file.path] = file.hash;
  }
  for (const [urlPath, diskPath] of Object.entries(REPLACEMENTS)) {
    const packed = gzipHash(urlPath === "/link.js" ? await linkBody() : fs.readFileSync(diskPath));
    files[urlPath] = packed.hash;
    uploads.set(packed.hash, packed.gz);
  }
  const indexRes = await fetch("https://" + SITE + ".web.app/index.html", { cache: "no-store" });
  if (!indexRes.ok) fail("Could not download the live index.html");
  const indexGz = gzipHash(Buffer.from(patchedIndex(await indexRes.text()), "utf8"));
  files["/index.html"] = indexGz.hash;
  uploads.set(indexGz.hash, indexGz.gz);
  const dartRes = await fetch("https://" + SITE + ".web.app/main.dart.js", { cache: "no-store" });
  if (!dartRes.ok) fail("Could not download the live main.dart.js");
  const dartBuf = Buffer.from(await dartRes.arrayBuffer());
  if (dartBuf.length < 5000000) fail("Refusing to patch main.dart.js: live bundle is unexpectedly small");
  const dartGz = gzipHash(patchedBundle(dartBuf));
  files["/main.dart.js"] = dartGz.hash;
  uploads.set(dartGz.hash, dartGz.gz);

  if (Object.keys(files).length < existing.length) {
    fail("Refusing to publish: the new file list is smaller than the live site");
  }

  const created = await api(token, "POST", "/sites/" + SITE + "/versions", { status: "CREATED" });
  const versionId = created.name.split("/").pop();
  const populated = await api(token, "POST", "/sites/" + SITE + "/versions/" + versionId + ":populateFiles", { files });
  const required = new Set(populated.uploadRequiredHashes || []);
  for (const hash of required) {
    const body = uploads.get(hash);
    if (!body) fail("Hosting asked for an unexpected upload " + hash);
    const upload = await fetch(populated.uploadUrl + "/" + hash, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
    if (!upload.ok) fail("Upload " + hash + " failed (" + upload.status + ")");
  }

  await api(token, "PATCH", "/sites/" + SITE + "/versions/" + versionId + "?updateMask=status,config", {
    status: "FINALIZED",
    config,
  });
  await api(token, "POST", "/sites/" + SITE + "/channels/live/releases?versionName=" + encodeURIComponent(created.name), {
    message: "Enable the keypad call button for a real phone number",
  });
  console.log("Published WhatsApp fallback to https://" + SITE + ".web.app/");
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
