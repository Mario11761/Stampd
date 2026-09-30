import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import worker from "../src/index.mjs";

const expectedFingerprint =
  "D6:0F:A9:94:5A:4E:FA:99:E9:C5:46:6F:11:E7:81:0F:CB:87:30:5A:4A:72:E9:CC:9C:CA:4D:FC:EB:EC:8F:7B";
const iconBytes = await readFile(
  new URL("../public/stampd-icon.png", import.meta.url),
);
const testEnvironment = {
  ASSETS: {
    async fetch(request) {
      assert.equal(new URL(request.url).pathname, "/stampd-icon.png");

      return new Response(iconBytes, {
        headers: { "Content-Type": "image/png" },
      });
    },
  },
};

const dalResponse = await worker.fetch(
  new Request("https://stampd-identity.example/.well-known/assetlinks.json"),
);

assert.equal(dalResponse.status, 200);
assert.equal(dalResponse.headers.get("content-type"), "application/json");

const statements = await dalResponse.json();
assert.deepEqual(statements, [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "com.stampd.app",
      sha256_cert_fingerprints: [expectedFingerprint],
    },
  },
]);

const rootResponse = await worker.fetch(
  new Request("https://stampd-identity.example/"),
);
assert.equal(rootResponse.status, 200);
assert.match(await rootResponse.text(), /Stampd/);

const missingResponse = await worker.fetch(
  new Request("https://stampd-identity.example/not-found"),
);
assert.equal(missingResponse.status, 404);
assert.equal(missingResponse.headers.get("location"), null);

const iconResponse = await worker.fetch(
  new Request("https://stampd-identity.example/stampd-icon.png"),
  testEnvironment,
);
assert.equal(iconResponse.status, 200);
assert.equal(iconResponse.headers.get("content-type"), "image/png");
assert.equal(iconResponse.headers.get("location"), null);
assert.equal(iconResponse.headers.get("set-cookie"), null);
assert.equal(
  iconResponse.headers.get("cache-control"),
  "public, max-age=86400",
);

const returnedIcon = Buffer.from(await iconResponse.arrayBuffer());
assert.deepEqual(
  returnedIcon.subarray(0, 8),
  Buffer.from("89504e470d0a1a0a", "hex"),
);
assert.equal(returnedIcon.readUInt32BE(16), 512);
assert.equal(returnedIcon.readUInt32BE(20), 512);

const iconHeadResponse = await worker.fetch(
  new Request("https://stampd-identity.example/stampd-icon.png", {
    method: "HEAD",
  }),
  testEnvironment,
);
assert.equal(iconHeadResponse.status, 200);
assert.equal(iconHeadResponse.headers.get("content-type"), "image/png");
assert.equal((await iconHeadResponse.arrayBuffer()).byteLength, 0);

console.log("Stampd identity Worker validation passed.");
