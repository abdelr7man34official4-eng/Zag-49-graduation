/* Service Worker — دفعة 49
   الهدف: أول زيارة عادية، وكل زيارة بعدها بتفتح فوراً من الكاش.
   لو غيرت أي ملف، غيّر رقم VERSION تحت عشان الزوار ياخدوا النسخة الجديدة. */
const VERSION = 'v1';
const CORE = `core-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

const CORE_FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/script.js',
  'images/logo.png',
  'images/students/default-avatar.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE).then((cache) =>
      // لو ملف ناقص ميبوظش التثبيت كله
      Promise.all(CORE_FILES.map((f) => cache.add(f).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![CORE, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    }))
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return; // الصوت بيروح مباشرة للمتصفح

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      event.respondWith(staleWhileRevalidate(req, RUNTIME));
    }
    return;
  }

  if (/\.(mp3|mp4|wav|ogg)$/i.test(url.pathname)) return;

  if (req.mode === 'navigate' || /\.(html|css|js)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, CORE));
  } else if (/\.(png|jpe?g|webp|avif|gif|svg|ico|otf|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, RUNTIME));
  }
});
