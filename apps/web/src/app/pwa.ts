export function registerPwaServiceWorker(): void {
  if (import.meta.env.DEV) return;
  if (!("serviceWorker" in navigator)) return;

  if (document.readyState === "complete") {
    register();
    return;
  }

  globalThis.addEventListener("load", register, { once: true });
}

function register(): void {
  void navigator.serviceWorker.register("/sw.js").catch(() => {});
}
