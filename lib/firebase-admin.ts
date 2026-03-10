import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(process.cwd());

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();

  let key: admin.ServiceAccount;

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson && envJson.trim()) {
    try {
      key = JSON.parse(envJson) as admin.ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido');
    }
  } else {
    const credPath = path.join(PROJECT_ROOT, 'serviceAccountKey.json');
    if (!fs.existsSync(credPath)) {
      throw new Error(
        `No se encontró serviceAccountKey.json en ${PROJECT_ROOT} ni variable FIREBASE_SERVICE_ACCOUNT_JSON`
      );
    }
    key = JSON.parse(fs.readFileSync(credPath, 'utf8')) as admin.ServiceAccount;
  }

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
