// sw.js - 缓存 face-api 模型文件
const CACHE_NAME = 'face-models-v4.1';

// 匹配所有 face-api 模型文件的正则
const MODEL_PATTERNS = [
    'tiny_face_detector_model',
    'face_landmark_68_model',
    'face_recognition_model'
];

self.addEventListener('install', event => {
    console.log('Service Worker 安装中...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log('🗑️ 删除旧缓存:', key);
                    return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // 只拦截 face-api 模型文件
    if (url.includes('face-api') && url.includes('/model/')) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    console.log('📦 缓存命中:', url.split('/').pop());
                    return response;
                }
                
                console.log('🌐 下载并缓存:', url.split('/').pop());
                return fetch(event.request).then(response => {
                    if (response && response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                });
            })
        );
    }
});