// sw.js - Service Worker

const CACHE_NAME = 'dosage-calculator-cache-v1.3'; // Increment version if you change cached files
const urlsToCache = [
  './', // Cache the root (often index.html if your server is set up for it)
  './index.html', // Explicitly cache your main HTML file
  // Add paths to any other critical local assets (CSS, JS, images) if they are not inlined
  // and not loaded from CDNs. For this app, most are CDN or inline.
  // Example: './style.css', './app.js'
];

// Install event: open cache and add core files
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        // Use {cache: 'reload'} to bypass HTTP cache when populating service worker cache
        const cachePromises = urlsToCache.map(urlToCache => {
          return cache.add(new Request(urlToCache, {cache: 'reload'})).catch(err => {
            console.warn(`[ServiceWorker] Failed to cache ${urlToCache}:`, err);
          });
        });
        return Promise.all(cachePromises);
      })
      .catch(error => {
        console.error('[ServiceWorker] Failed to cache during install:', error);
      })
  );
  self.skipWaiting(); // Activate new service worker immediately
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of uncontrolled clients
});

// Fetch event: serve from cache if available, otherwise fetch from network (Cache-First for app shell)
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (HTML), try network first, then cache.
  // This ensures users get the latest HTML if online, but can still load if offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // If network fails, try to serve from cache
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('[ServiceWorker] Serving from cache (navigate - network failed):', event.request.url);
                    return cachedResponse;
                }
                // If not in cache either, it will fail (expected for offline if not cached)
                console.log('[ServiceWorker] Network and cache failed for navigate:', event.request.url);
                return response; // Return original failed response
            });
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('[ServiceWorker] Caching new response (navigate):', event.request.url);
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // Network request failed, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[ServiceWorker] Serving from cache (navigate - network error):', event.request.url);
                return cachedResponse;
              }
              // If not in cache, and network failed, there's nothing to serve.
              // The browser will show its default offline page.
              console.log('[ServiceWorker] No cache match for navigate after network error:', event.request.url);
              // You could return a custom offline.html page here if you had one cached.
              // return caches.match('./offline.html');
            });
        })
    );
  } else {
    // For non-navigation requests (e.g., images, CSS, JS if hosted locally)
    // Cache-first strategy:
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // console.log('[ServiceWorker] Serving from cache (asset):', event.request.url);
            return response; // Cache hit
          }
          // console.log('[ServiceWorker] Fetching from network (asset):', event.request.url);
          return fetch(event.request).then(
            networkResponse => {
              // Check if we received a valid response to cache
              if(!networkResponse || networkResponse.status !== 200 /*|| networkResponse.type !== 'basic'*/) {
                // Don't cache error responses or opaque responses unless you intend to
                return networkResponse;
              }
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              return networkResponse;
            }
          ).catch(error => {
            console.warn('[ServiceWorker] Fetch failed for asset:', event.request.url, error);
            // You could return a fallback placeholder image/style here if appropriate
          });
        }
      )
    );
  }
});
```

**To make this work:**

1.  **Save the Files:**
    * Save the main HTML content as `index.html` (or whatever your main file is named – ensure `start_url` in `manifest.json` matches).
    * Create a file named `manifest.json` in the *same directory* and paste the JSON content into it.
    * Create a file named `sw.js` in the *same directory* and paste the JavaScript service worker content into it.
2.  **Create Icons:** You **must** create two icon files:
    * `icon-192x192.png`
    * `icon-512x512.png`
    Place these in the same directory as your HTML, `manifest.json`, and `sw.js` files. These are referenced in the `manifest.json`. If they are missing, PWA installation might fail.
3.  **Host on HTTPS:** Upload all these files (`index.html`, `manifest.json`, `sw.js`, and your icon files) to your hosting provider (like GitHub Pages).
4.  **Test Installability:**
    * Open your site in Brave (or Chrome).
    * Open Developer Tools (usually F12).
    * Go to the "Application" tab.
        * Check the "Manifest" section: It should show your manifest details and report any errors.
        * Check the "Service Workers" section: Your `sw.js` should be listed as activated and running.
    * Go to the "Lighthouse" tab and run an audit, specifically checking the "Progressive Web App" category. This will give you detailed feedback on what criteria are met or not.

The "download" option you saw in Brave might be a feature for creating a desktop shortcut or a basic packaged app if full PWA criteria aren't met. After these changes, and once the service worker has successfully registered and cached the app shell, Brave should offer a more standard "Install app" or "Add to Home Screen" prompt. This prompt can sometimes take a visit or two to appear as the browser verifies the PWA criter
