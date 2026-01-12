const CACHE_NAME = 'huiyou-inventory-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/logo.png',
  '/manifest.json',
  '/encrypted_products.json'  // 缓存数据文件
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  // 对于数据文件，使用网络优先策略
  if (event.request.url.includes('encrypted_products.json')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // 网络请求成功，更新缓存
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(function() {
          // 网络失败，返回缓存
          return caches.match(event.request);
        })
    );
  } else {
    // 其他文件使用缓存优先策略
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          if (response) {
            return response;
          }
          return fetch(event.request);
        }
      )
    );
  }
});