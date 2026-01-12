const CACHE_NAME = 'huiyou-inventory-v5';
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
        // 分别缓存静态文件和数据文件
        const staticFiles = [
          './',
          './index.html',
          './style.css',
          './script.js',
          './logo.png',
          './manifest.json'
        ];
        
        return cache.addAll(staticFiles)
          .then(function() {
            // 单独尝试缓存数据文件
            return fetch('./encrypted_products.json')
              .then(function(response) {
                if (response.ok) {
                  return cache.put('/encrypted_products.json', response);
                }
              })
              .catch(function(error) {
                console.log('初始缓存数据文件失败，将在首次访问时缓存:', error);
              });
          });
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
    console.log('Service Worker: 拦截到数据文件请求:', event.request.url);
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          console.log('Service Worker: 网络请求成功，状态:', response.status);
          // 网络请求成功，更新缓存（去掉时间戳参数）
          const responseClone = response.clone();
          const urlWithoutTimestamp = event.request.url.split('?')[0];
          const requestWithoutTimestamp = new Request(urlWithoutTimestamp);
          
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(requestWithoutTimestamp, responseClone);
              console.log('Service Worker: 已更新缓存');
            });
          return response;
        })
        .catch(function(error) {
          console.log('Service Worker: 网络请求失败，尝试从缓存获取:', error);
          // 网络失败，尝试从缓存获取（去掉时间戳参数）
          const urlWithoutTimestamp = event.request.url.split('?')[0];
          const requestWithoutTimestamp = new Request(urlWithoutTimestamp);
          return caches.match(requestWithoutTimestamp)
            .then(function(cachedResponse) {
              if (cachedResponse) {
                console.log('Service Worker: 从缓存返回数据文件');
                return cachedResponse;
              }
              // 如果缓存也没有，尝试匹配原始文件名
              console.log('Service Worker: 尝试匹配原始文件名');
              return caches.match('./encrypted_products.json')
                .then(function(fallbackResponse) {
                  if (fallbackResponse) {
                    console.log('Service Worker: 从原始文件名缓存返回');
                    return fallbackResponse;
                  } else {
                    console.error('Service Worker: 缓存中没有找到数据文件');
                    throw new Error('缓存中没有数据文件');
                  }
                });
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
