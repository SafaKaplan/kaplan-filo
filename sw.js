/* Kaplan Filo - basit çevrimdışı önbellek: önce internet, olmazsa son kaydedilen kopya. */
const ONBELLEK = 'filo-v7';
const DOSYALAR = ['./', 'index.html', 'app.js', 'splash.js', 'logo.png', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== ONBELLEK).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const istek = e.request;
  const adres = new URL(istek.url);
  if (istek.method !== 'GET' || adres.origin !== self.location.origin) return;   // veri istekleri (Supabase) hiç önbelleğe girmez
  e.respondWith(
    fetch(istek, { cache: 'no-cache' }).then((yanit) => {
      const kopya = yanit.clone();
      caches.open(ONBELLEK).then((c) => c.put(istek, kopya));
      return yanit;
    }).catch(() => caches.match(istek).then((r) => r || caches.match('index.html')))
  );
});
