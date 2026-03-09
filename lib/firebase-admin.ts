import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(process.cwd());

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();
  const credPath = path.join(PROJECT_ROOT, 'serviceAccountKey.json');
  if (!fs.existsSync(credPath)) {
    throw new Error(`No se encontró serviceAccountKey.json en ${PROJECT_ROOT}`);
  }
  const key = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  return admin.initializeApp({ credential: admin.credential.cert(key) });
}

initFirebaseAdmin();

export function getAdminAuth() {
  return admin.auth();
}

export function getAdminFirestore() {
  return admin.firestore();
}

export const ADMINS_COLLECTION_PATH = ['crossfitconnect-app', 'nuevaVersion', 'admins'] as const;
