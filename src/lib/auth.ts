import {
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function checkIsAdmin(uid: string): Promise<boolean> {
  try {
    const adminsQuery = query(
      collection(db, 'crossfitconnect-app', 'nuevaVersion', 'admins'),
      where('firebaseUID', '==', uid)
    );
    const querySnapshot = await getDocs(adminsQuery);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error al verificar admin:', error);
    return false;
  }
}

export async function loginUser(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const isAdmin = await checkIsAdmin(user.uid);
  if (!isAdmin) {
    await signOut(auth);
    throw new Error('NO_ADMIN_ACCESS');
  }
  return user;
}

export async function loginWithPin(pin: string): Promise<User> {
  const res = await fetch('/api/auth/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.trim() })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'PIN incorrecto');
  }
  if (!data.token) {
    throw new Error('Error al obtener sesión');
  }
  const userCredential = await signInWithCustomToken(auth, data.token);
  const user = userCredential.user;
  const isAdmin = await checkIsAdmin(user.uid);
  if (!isAdmin) {
    await signOut(auth);
    throw new Error('NO_ADMIN_ACCESS');
  }
  return user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
