import {
  signInWithEmailAndPassword,
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

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
