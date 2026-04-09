import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Sesión remota para sincronizar TV + móvil (mismo admin).
 * Ruta Firestore: crossfitconnect-app/nuevaVersion/controlSessions/{firebaseUID}
 */
export const CONTROL_SESSION_COLLECTION = [
  'controlSessions',
] as const

/** Debe coincidir con los límites del dashboard. */
export const SESSION_LINE_HEIGHT_MIN = 1
export const SESSION_LINE_HEIGHT_MAX = 2

export const SESSION_CARD_SCALE_MIN = 0.5
export const SESSION_CARD_SCALE_MAX = 2

export const SESSION_FONT_SIZE_MIN = 0.75
export const SESSION_FONT_SIZE_MAX = 1.5

export type ControlSessionState = {
  currentIndex: number
  isPaused: boolean
  lineHeight: number
  cardScale: number
  fontSize: number
  denseLineHeight: number
  denseCardScale: number
  denseFontSize: number
  isDark: boolean
}

function controlSessionDocRef(uid: string) {
  return doc(db, ...CONTROL_SESSION_COLLECTION, uid)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function clampSessionLineHeight(n: number): number {
  return clamp(n, SESSION_LINE_HEIGHT_MIN, SESSION_LINE_HEIGHT_MAX)
}

export function clampSessionCardScale(n: number): number {
  return clamp(n, SESSION_CARD_SCALE_MIN, SESSION_CARD_SCALE_MAX)
}

export function clampSessionFontSize(n: number): number {
  return clamp(n, SESSION_FONT_SIZE_MIN, SESSION_FONT_SIZE_MAX)
}

export function clampSessionCurrentIndex(
  index: number,
  slideCount: number,
  useInfinite: boolean
): number {
  if (slideCount <= 0) return 0
  const maxIdx = useInfinite ? slideCount : Math.max(0, slideCount - 1)
  return clamp(Math.round(index), 0, maxIdx)
}

function parseSessionData(raw: Record<string, unknown>): Partial<ControlSessionState> {
  const out: Partial<ControlSessionState> = {}

  if (typeof raw.currentIndex === 'number' && Number.isFinite(raw.currentIndex)) {
    out.currentIndex = Math.round(raw.currentIndex)
  }
  if (typeof raw.isPaused === 'boolean') {
    out.isPaused = raw.isPaused
  }
  if (typeof raw.lineHeight === 'number' && Number.isFinite(raw.lineHeight)) {
    out.lineHeight = clampSessionLineHeight(raw.lineHeight)
  }
  if (typeof raw.cardScale === 'number' && Number.isFinite(raw.cardScale)) {
    out.cardScale = clampSessionCardScale(raw.cardScale)
  }
  if (typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)) {
    out.fontSize = clampSessionFontSize(raw.fontSize)
  }
  if (typeof raw.denseLineHeight === 'number' && Number.isFinite(raw.denseLineHeight)) {
    out.denseLineHeight = clampSessionLineHeight(raw.denseLineHeight)
  }
  if (typeof raw.denseCardScale === 'number' && Number.isFinite(raw.denseCardScale)) {
    out.denseCardScale = clampSessionCardScale(raw.denseCardScale)
  }
  if (typeof raw.denseFontSize === 'number' && Number.isFinite(raw.denseFontSize)) {
    out.denseFontSize = clampSessionFontSize(raw.denseFontSize)
  }
  if (typeof raw.isDark === 'boolean') {
    out.isDark = raw.isDark
  }

  return out
}

/**
 * Escucha cambios remotos. Si el documento no existe, `callback(null)`.
 */
export function subscribeControlSession(
  uid: string,
  callback: (data: Partial<ControlSessionState> | null) => void
): () => void {
  const ref = controlSessionDocRef(uid)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null)
        return
      }
      callback(parseSessionData(snap.data() as Record<string, unknown>))
    },
    () => {
      callback(null)
    }
  )
}

/**
 * Actualización parcial; no sobrescribe campos omitidos.
 */
export async function updateControlSession(
  uid: string,
  patch: Partial<ControlSessionState>
): Promise<void> {
  const sanitized: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (patch.currentIndex !== undefined) {
    sanitized.currentIndex = Math.round(patch.currentIndex)
  }
  if (patch.isPaused !== undefined) {
    sanitized.isPaused = patch.isPaused
  }
  if (patch.lineHeight !== undefined) {
    sanitized.lineHeight = clampSessionLineHeight(patch.lineHeight)
  }
  if (patch.cardScale !== undefined) {
    sanitized.cardScale = clampSessionCardScale(patch.cardScale)
  }
  if (patch.fontSize !== undefined) {
    sanitized.fontSize = clampSessionFontSize(patch.fontSize)
  }
  if (patch.denseLineHeight !== undefined) {
    sanitized.denseLineHeight = clampSessionLineHeight(patch.denseLineHeight)
  }
  if (patch.denseCardScale !== undefined) {
    sanitized.denseCardScale = clampSessionCardScale(patch.denseCardScale)
  }
  if (patch.denseFontSize !== undefined) {
    sanitized.denseFontSize = clampSessionFontSize(patch.denseFontSize)
  }
  if (patch.isDark !== undefined) {
    sanitized.isDark = patch.isDark
  }

  await setDoc(controlSessionDocRef(uid), sanitized, { merge: true })
}
