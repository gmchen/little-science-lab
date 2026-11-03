import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

export type OfflineStatus = 'checking' | 'ready' | 'not-ready' | 'unsupported'

let status: OfflineStatus = 'checking'
const listeners = new Set<() => void>()

function set(next: OfflineStatus) {
  if (next === status) return
  status = next
  listeners.forEach((l) => l())
}

/** Offline-ready means a service worker controls this page and the precache is filled. */
async function check() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) return set('unsupported')
  try {
    const names = (await caches.keys()).filter((n) => n.includes('precache'))
    let entries = 0
    for (const n of names) entries += (await (await caches.open(n)).keys()).length
    set(navigator.serviceWorker.controller && entries > 0 ? 'ready' : 'not-ready')
  } catch {
    set('not-ready')
  }
}

/** Register the service worker (updates apply on next launch) and track whether it is cached. */
export function startOffline() {
  if (!('serviceWorker' in navigator)) return set('unsupported')
  registerSW({ immediate: true, onOfflineReady: check })
  navigator.serviceWorker.addEventListener('controllerchange', check)
  void check()
}

export function useOfflineStatus(): OfflineStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      void check()
      return () => listeners.delete(l)
    },
    () => status,
  )
}
