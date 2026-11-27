/* ConvertIt service worker: offline app shell, long-lived asset cache, and the
 * Web Share Target endpoint. Plain JS on purpose; it is served as-is from /sw.js. */

const SHELL_CACHE = "convertit-shell-v1";
// Hashed build files (/assets) and versioned vendor files (/vendor/<pkg>/<version>) never change.
const ASSET_CACHE = "convertit-assets-v1";
// Must match SHARE_CACHE in src/features/share/shareInbox.ts.
const SHARE_CACHE = "convertit-share";
const KEEP = [SHELL_CACHE, ASSET_CACHE, SHARE_CACHE];
const MAX_BUILD_ASSETS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
  } else if (
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/vendor/")) &&
    !request.headers.has("range")
  ) {
    event.respondWith(cacheFirst(request, url));
  }
});

/** Pages: always try the network (fresh deploys), fall back to the cached shell offline. */
async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/", response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match("/", { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, url) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) {
    await cache.put(request, response.clone());
    await prune(cache, url);
  }
  return response;
}

/** Drop other versions of a vendor package, and cap the number of old build chunks. */
async function prune(cache, url) {
  const keys = await cache.keys();
  const vendor = url.pathname.match(/^\/vendor\/([^/]+)\/([^/]+)\//);
  if (vendor) {
    const [, pkg, version] = vendor;
    await Promise.all(
      keys
        .filter((key) => {
          const m = new URL(key.url).pathname.match(
            /^\/vendor\/([^/]+)\/([^/]+)\//,
          );
          return m && m[1] === pkg && m[2] !== version;
        })
        .map((key) => cache.delete(key)),
    );
    return;
  }
  const builds = keys.filter((key) =>
    new URL(key.url).pathname.startsWith("/assets/"),
  );
  const excess = builds.length - MAX_BUILD_ASSETS;
  if (excess > 0)
    await Promise.all(builds.slice(0, excess).map((key) => cache.delete(key)));
}

/** "Share → ConvertIt": stash the shared files and text, then open /share to route them. */
async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter((f) => typeof f === "object" && "name" in f);
    const text = ["title", "text", "url"]
      .map((k) => form.get(k))
      .filter((v) => typeof v === "string" && v)
      .join(" ");

    await caches.delete(SHARE_CACHE);
    const cache = await caches.open(SHARE_CACHE);
    const entries = files.map((file, i) => ({
      key: `/share-inbox/file-${i}`,
      name: file.name,
      type: file.type,
    }));
    await Promise.all(
      files.map((file, i) =>
        cache.put(
          entries[i].key,
          new Response(file, { headers: { "Content-Type": file.type } }),
        ),
      ),
    );
    await cache.put(
      "/share-inbox/meta",
      new Response(JSON.stringify({ text, files: entries }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {
    // Fall through: /share shows the home page if nothing was stored.
  }
  return Response.redirect("/share", 303);
}
