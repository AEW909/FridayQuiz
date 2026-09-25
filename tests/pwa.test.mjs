import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the install manifest defines a standalone Friday Quiz League app", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));

  assert.equal(manifest.name, "Friday Quiz League");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.src === "/assets/lrgs-quiz-crest.png"));
});

test("the page and client register the installable app shell", async () => {
  const [html, client, worker] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(client, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
});
