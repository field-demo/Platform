const CACHE_NAME = "amos-field-interface-v2";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data.json",
  "manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
