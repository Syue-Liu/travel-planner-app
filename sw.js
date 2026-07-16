/* 旅遊行程規劃器 Service Worker
 * 策略：
 * - 頁面本身（index.html）：network-first —— 有網路時永遠拿最新版，離線時用快取
 * - CDN 靜態資源（Leaflet、Firebase SDK、Tesseract）：cache-first —— 版本固定，快取後離線可用
 * - OpenStreetMap 圖磚：cache-first + 上限 300 張，避免佔爆儲存空間
 * - Firestore / 匯率 / Nominatim API：不攔截，維持即時性
 */
const VERSION = 'v4';
const SHELL_CACHE = 'shell-' + VERSION;
const CDN_CACHE = 'cdn-' + VERSION;
const TILE_CACHE = 'tiles-' + VERSION;
const TILE_LIMIT = 300;

const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'www.gstatic.com'];
const SKIP_HOSTS = ['firestore.googleapis.com', 'open.er-api.com', 'nominatim.openstreetmap.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL_CACHE, CDN_CACHE, TILE_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (SKIP_HOSTS.some(h => url.hostname.endsWith(h))) return;

  // 頁面導覽：network-first
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // firebase-config.js：network-first（使用者可能更新設定）
  if (url.pathname.endsWith('firebase-config.js')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 地圖圖磚：cache-first + 上限
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(TILE_CACHE).then(c => c.put(req, copy)).then(() => trimCache(TILE_CACHE, TILE_LIMIT));
        }
        return res;
      }))
    );
    return;
  }

  // CDN 靜態資源：cache-first
  if (CDN_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CDN_CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // 同源其他檔案：cache-first
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
