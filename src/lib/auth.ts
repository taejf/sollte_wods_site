import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from './firebase'

const ADMINS_PATH = ['crossfitconnect-app', 'nuevaVersion', 'admins'] as const

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const adminsQuery = query(collection(db, ...ADMINS_PATH), where('firebaseUID', '==', uid))
    const querySnapshot = await getDocs(adminsQuery)
    return !querySnapshot.empty
  } catch (_error) {
    return false
  }
}

export async function getAdminHeadquarterByUid(uid: string): Promise<string | null> {
  try {
    const adminsQuery = query(collection(db, ...ADMINS_PATH), where('firebaseUID', '==', uid))
    const querySnapshot = await getDocs(adminsQuery)
    const doc = querySnapshot.docs[0]
    if (!doc) return null
    const headquarter = doc.data().headquarter
    return typeof headquarter === 'string' ? headquarter : null
  } catch (_error) {
    return null
  }
}

export async function loginUser(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  const user = userCredential.user
  const isAdmin = await checkIsAdmin(user.uid)
  if (!isAdmin) {
    await signOut(auth)
    throw new Error('NO_ADMIN_ACCESS')
  }
  return user
}

const ADMIN_HEADQUARTER_KEY = 'adminHeadquarter'
const EXPLICIT_LOGOUT_INTENT_KEY = 'explicitLogoutIntent'
/** PIN guardado tras login correcto para reautenticación en TV/dashboard (riesgo: acceso físico al dispositivo). */
const STORED_PIN_RECOVERY_KEY = 'sollteWods_dashboardPinRecovery'

export function getAdminHeadquarter(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ADMIN_HEADQUARTER_KEY)
}

export function markExplicitLogoutIntent(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(EXPLICIT_LOGOUT_INTENT_KEY, String(Date.now()))
}

export function consumeExplicitLogoutIntent(): boolean {
  if (typeof window === 'undefined') return false
  const hasIntent = sessionStorage.getItem(EXPLICIT_LOGOUT_INTENT_KEY) != null
  if (hasIntent) sessionStorage.removeItem(EXPLICIT_LOGOUT_INTENT_KEY)
  return hasIntent
}

function persistDashboardPinForRecovery(pin: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORED_PIN_RECOVERY_KEY, pin.trim())
  } catch {
    // cuota / modo privado
  }
}

export function getStoredDashboardPin(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORED_PIN_RECOVERY_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

export function clearStoredDashboardPin(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORED_PIN_RECOVERY_KEY)
  } catch {
    // ignore
  }
}

/** Tras fallo de `loginWithPin` en recuperación automática: quita el PIN solo si ya no vale (no ante fallos de red). */
export function invalidateStoredDashboardPinIfAuthRejected(reason: unknown): void {
  if (!(reason instanceof Error)) return
  const m = reason.message
  if (
    m === 'NO_ADMIN_ACCESS' ||
    m.includes('PIN incorrecto') ||
    m.includes('PIN requerido') ||
    /\bincorrecto\b/i.test(m)
  ) {
    clearStoredDashboardPin()
  }
}

export async function loginWithPin(pin: string): Promise<User> {
  const res = await fetch('/api/auth/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.trim() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'PIN incorrecto')
  }
  if (!data.token) {
    throw new Error('Error al obtener sesión')
  }
  const userCredential = await signInWithCustomToken(auth, data.token)
  const user = userCredential.user
  const isAdmin = await checkIsAdmin(user.uid)
  if (!isAdmin) {
    await signOut(auth)
    throw new Error('NO_ADMIN_ACCESS')
  }
  if (typeof data.headquarter === 'string' && data.headquarter) {
    sessionStorage.setItem(ADMIN_HEADQUARTER_KEY, data.headquarter)
  }
  consumeExplicitLogoutIntent()
  persistDashboardPinForRecovery(pin)
  return user
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_HEADQUARTER_KEY)
    clearStoredDashboardPin()
  }
  await signOut(auth)
}

export function getCurrentUser(): User | null {
  return auth.currentUser
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
