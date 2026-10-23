#!/usr/bin/env node
"use strict";

// Publishes only the Android home-screen icon onto the existing Flutter
// hosting release. It clones every current file hash, then replaces the
// maskable PNGs and manifest.json. It never uploads a fresh public folder,
// because that would delete main.dart.js and the rest of the live app.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const SITE = "voip-call-app-7d0c3";
const API = "https://firebasehosting.googleapis.com/v1beta1";
const CACHE_BUST = "vid19";

const REPLACEMENTS = {
  "/manifest.json": path.join(ROOT, "manifest.json"),
  "/icons/vcom-splash-plain-192.png": path.join(ROOT, "icons/vcom-splash-plain-192.png"),
  "/icons/vcom-splash-plain-512.png": path.join(ROOT, "icons/vcom-splash-plain-512.png"),
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

function patchedIndex(html) {
  const from = 'manifest.json?v=vid18';
  const to = "manifest.json?v=" + CACHE_BUST;
  const count = html.split(from).length - 1;
  if (count !== 1) fail("Expected exactly one manifest cache query in the live index, found " + count);
  return html.replace(from, to);
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
    const packed = gzipHash(fs.readFileSync(diskPath));
    files[urlPath] = packed.hash;
    uploads.set(packed.hash, packed.gz);
  }
  const indexRes = await fetch("https://" + SITE + ".web.app/index.html", { cache: "no-store" });
  if (!indexRes.ok) fail("Could not download the live index.html");
  const indexGz = gzipHash(Buffer.from(patchedIndex(await indexRes.text()), "utf8"));
  files["/index.html"] = indexGz.hash;
  uploads.set(indexGz.hash, indexGz.gz);

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
    message: "Show the VCOM handset on the Android home icon",
  });
  console.log("Published Android icon to https://" + SITE + ".web.app/manifest.json?v=" + CACHE_BUST);
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
