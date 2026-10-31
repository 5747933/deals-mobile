/* 羊毛信息站 Service Worker
 * 策略：
 *   - 页面/资源：网络优先（network-first），确保拿到最新版本
 *   - 离线时才用缓存兜底
 *   - 新版本检测到后，通知页面自动刷新
 */

const VERSION = "20261101075907-11cf7d7e";           // 构建时注入
const CACHE = "dealz-" + VERSION;

// 预缓存静态资源（离线可用）
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();                     // 新 SW 立即接管，不等旧页面关闭
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      // 清掉旧版本缓存
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith("dealz-") && k !== CACHE).map(k => caches.delete(k))
      );
      await self.clients.claim();         // 立即控制所有页面
    })()
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 不打搅第三方请求（比如 smzdm 的 JSONP API）
  if (url.origin !== self.location.origin) return;

  // 网络优先：保证拿到最新版本；失败时回退缓存
  e.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh && fresh.ok) {
          const copy = fresh.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // 页面请求离线兜底到首页
        if (req.mode === "navigate") {
          const home = await caches.match("./index.html");
          if (home) return home;
        }
        throw err;
      }
    })()
  );
});
