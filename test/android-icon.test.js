"use strict";

const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LIVE_BLUE_512 = "5bf5f127ea4cc10644b44526293aef04bbab475addd9c48b0653acab69d655f6";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("maskable icons are the handset logo, not the flat blue tile", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const maskable = manifest.icons.filter((icon) => icon.purpose === "maskable");
  assert.deepEqual(maskable.map((icon) => icon.src), [
    "icons/vcom-splash-plain-192.png?v=vid19",
    "icons/vcom-splash-plain-512.png?v=vid19",
  ]);
  for (const icon of maskable) {
    const file = path.join(ROOT, icon.src.split("?")[0]);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 10000, file + " is too small to contain the logo");
    assert.notEqual(sha256(file), LIVE_BLUE_512);
    const report = execFileSync("python3", ["-c", `
from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert("RGB")
colors = im.getcolors(im.size[0] * im.size[1])
print(0 if colors is None else len(colors))
print(im.getpixel((0, 0)))
print(im.getpixel((im.size[0] // 2, im.size[1] // 2)))
`, file], { encoding: "utf8" }).trim().split("\n");
    const unique = Number(report[0]);
    assert.ok(unique > 100, file + " has only " + unique + " colors");
  }
});
