import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'
import { controlSessionDocRef } from '@/lib/controlSession'

const PRESENCE_SUBCOLLECTION = 'presence'
const DEVICE_ID_STORAGE_KEY = 'dashboard-session-device-id'
/** Si no hay latido en este tiempo, el cliente deja de mostrar al par. */
export const SESSION_PRESENCE_STALE_MS = 75_000
const HEARTBEAT_MS = 20_000

export type SessionPresenceMode = 'tv' | 'control'

export type SessionPresencePeer = {
  deviceId: string
  mode: SessionPresenceMode
  label: string
  lastSeenMs: number
}

function presenceDocRef(uid: string, deviceId: string) {
  return doc(collection(controlSessionDocRef(uid), PRESENCE_SUBCOLLECTION), deviceId)
}

export function getOrCreateSessionDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `d-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
    }
    return id
  } catch {
    return `d-${Date.now()}`
  }
}

export function shortSessionDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Dispositivo'
  const ua = navigator.userAgent
  if (
    /(smart-tv|smarttv|hbbtv|appletv|googletv|tizen|webos|netcast|bravia|playstation|xbox|\btv\b)/i.test(
      ua
    ) ||
    (ua.includes('Android') && !ua.includes('Mobile'))
  ) {
    return 'TV'
  }
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return 'Móvil'
  return 'Escritorio'
}

function lastSeenToMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const t = value as Timestamp
    if (typeof t.toMillis === 'function') return t.toMillis()
  }
  return 0
}

function parsePeer(deviceId: string, raw: Record<string, unknown>): SessionPresencePeer | null {
  const modeRaw = raw.mode
  const mode: SessionPresenceMode | null =
    modeRaw === 'control' ? 'control' : modeRaw === 'tv' ? 'tv' : null
  if (!mode) return null
  const label =
    typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : 'Dispositivo'
  const ms = lastSeenToMs(raw.lastSeen)
  const lastSeenMs = ms > 0 ? ms : Date.now()
  return { deviceId, mode, label, lastSeenMs }
}

export function subscribeSessionPresence(
  uid: string,
  onPeers: (peers: SessionPresencePeer[]) => void
): () => void {
  const col = collection(controlSessionDocRef(uid), PRESENCE_SUBCOLLECTION)
  return onSnapshot(
    col,
    (snap) => {
      const now = Date.now()
      const list: SessionPresencePeer[] = []
      for (const d of snap.docs) {
        const p = parsePeer(d.id, d.data() as Record<string, unknown>)
        if (p && now - p.lastSeenMs < SESSION_PRESENCE_STALE_MS) list.push(p)
      }
      list.sort((a, b) => a.label.localeCompare(b.label, 'es') || a.deviceId.localeCompare(b.deviceId))
      onPeers(list)
    },
    () => {
      onPeers([])
    }
  )
}

export async function touchSessionPresence(
  uid: string,
  deviceId: string,
  mode: SessionPresenceMode
): Promise<void> {
  if (!deviceId) return
  await setDoc(
    presenceDocRef(uid, deviceId),
    {
      mode,
      label: shortSessionDeviceLabel(),
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function removeSessionPresence(uid: string, deviceId: string): Promise<void> {
  if (!deviceId) return
  try {
    await deleteDoc(presenceDocRef(uid, deviceId))
  } catch {
    // permisos o red
  }
}

/**
 * Mantiene vivo el registro del dispositivo en Firestore. Limpia al desmontar o al cerrar pestaña.
 */
export function registerSessionPresenceHeartbeat(
  uid: string,
  getDeviceId: () => string,
  getMode: () => SessionPresenceMode
): () => void {
  const tick = () => {
    void touchSessionPresence(uid, getDeviceId(), getMode())
  }
  tick()
  const interval = setInterval(tick, HEARTBEAT_MS)
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVisibility)
  const onPageHide = () => {
    void removeSessionPresence(uid, getDeviceId())
  }
  window.addEventListener('pagehide', onPageHide)
  return () => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    void removeSessionPresence(uid, getDeviceId())
  }
}
