/* =============================================================
   carterscoding.com: service worker (offline support)
   -------------------------------------------------------------
   Keeps a copy of the homepage, its CSS/JS, the font, the icons and
   every card image, so the page still opens with no connection.

   Network first: while online, every file comes from the site as
   usual (and the saved copy is refreshed). The saved copy is only
   used when the network fails. So a deploy shows up exactly as it
   would without this file.

   The card images to save come from projects.js, so adding a
   project there is all it takes. Browsers re-check sw.js and
   projects.js for changes on each visit and update this worker
   when either one changes.
   ============================================================= */

"use strict";

// Change this only if the way files are saved changes; old caches
// with any other name are deleted when a new worker takes over.
const CACHE = "carterscoding-v1";

// Paths are relative to this file, so the site works from a subfolder too
// (e.g. cksarge.github.io/Homepage/). "./" is the homepage itself.
const CORE_FILES = [
  "./",
  "styles.css",
  "script.js",
  "projects.js",
  "fonts/jetbrains-mono-latin-400.woff2",
  "fonts/jetbrains-mono-latin-700.woff2",
  "favicon.ico",
  "apple-touch-icon.png",
];

// Defines PROJECTS. If projects.js has a mistake in it, carry on without
// the card images rather than not working offline at all.
try {
  importScripts("projects.js");
} catch (error) {
  console.error("carterscoding: service worker couldn't read projects.js", error);
}

const IMAGE_FILES =
  typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS)
    ? PROJECTS.map((project) => project && project.image).filter((image) => typeof image === "string")
    : [];

// Saved copies are keyed by path only: the ?v=… cache-busters in index.html
// and the ?effects=… test option don't change what the file is.
const keyFor = (url) => {
  const key = new URL(url, self.location.href);
  key.search = "";
  key.hash = "";
  return key.href;
};

const HOME = keyFor("./");
const SAVED = new Set([...CORE_FILES, ...IMAGE_FILES].map(keyFor));

// Responses worth keeping: a real file (not an error page or a redirect,
// which browsers refuse to use for a page load)
const keepable = (response) => response && response.ok && !response.redirected && response.type === "basic";

/* ---------- Install: save everything up front ---------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: "reload" skips the browser's own cache, so these are the live files
      const save = async (url) => {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!keepable(response)) throw new Error(`${url}: ${response.status}`);
        await cache.put(keyFor(url), response);
      };
      // The page can't work offline without these, so any failure stops the install
      // (the old worker, if any, keeps going, and the browser tries again next visit)
      await Promise.all(CORE_FILES.map(save));
      // A missing card image just falls back to the green pattern, so don't let one stop it
      await Promise.allSettled(IMAGE_FILES.map(save));
      await self.skipWaiting();
    })()
  );
});

/* ---------- Activate: tidy up ---------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Old caches from an earlier CACHE name
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      // Images of projects that have been removed from projects.js
      const cache = await caches.open(CACHE);
      const requests = await cache.keys();
      await Promise.all(requests.filter((request) => !SAVED.has(request.url)).map((request) => cache.delete(request)));
      await self.clients.claim();
    })()
  );
});

/* ---------- Fetch: network first, saved copy when offline ---------- */

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only this site's own files. Project links go to other sites, and
  // the browser handles those (and anything that isn't a GET) as normal.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === "navigate";
  // Any page load offline gets the homepage (a bad URL would otherwise
  // get 404.html, which isn't saved, since all it does is redirect home)
  const key = isPage ? HOME : keyFor(request.url);
  if (!isPage && !SAVED.has(key)) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // Refresh the saved copy (only the homepage itself, not other pages)
        if (keepable(response) && (!isPage || keyFor(request.url) === HOME)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(key, copy)));
        }
        return response;
      } catch (error) {
        const saved = await caches.match(key);
        if (saved) return saved;
        throw error;
      }
    })()
  );
});
