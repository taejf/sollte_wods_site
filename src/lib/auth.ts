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

export function getAdminHeadquarter(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ADMIN_HEADQUARTER_KEY)
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
  return user
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_HEADQUARTER_KEY)
  }
  await signOut(auth)
}

export function getCurrentUser(): User | null {
  return auth.currentUser
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
