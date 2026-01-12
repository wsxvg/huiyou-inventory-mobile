const CACHE_NAME = 'huiyou-inventory-v3';
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
  // 强制激活新的Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 立即控制所有页面
  return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // 对于数据文件，使用网络优先策略，但要处理时间戳参数
  if (event.request.url.includes('encrypted_products.json')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          // 网络请求成功，更新缓存（去掉时间戳参数）
          const responseClone = response.clone();
          const urlWithoutTimestamp = event.request.url.split('?')[0];
          const requestWithoutTimestamp = new Request(urlWithoutTimestamp);
          
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(requestWithoutTimestamp, responseClone);
            });
          return response;
        })
        .catch(function() {
          // 网络失败，尝试从缓存获取（去掉时间戳参数）
          const urlWithoutTimestamp = event.request.url.split('?')[0];
          const requestWithoutTimestamp = new Request(urlWithoutTimestamp);
          return caches.match(requestWithoutTimestamp)
            .then(function(cachedResponse) {
              if (cachedResponse) {
                console.log('从缓存返回数据文件');
                return cachedResponse;
              }
              // 如果缓存也没有，尝试匹配原始文件名
              return caches.match('/encrypted_products.json');
            });
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