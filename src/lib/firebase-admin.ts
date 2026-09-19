import fs from 'node:fs'
import path from 'node:path'
import * as admin from 'firebase-admin'

const PROJECT_ROOT = path.resolve(process.cwd())

function parseServiceAccountJson(raw: string): admin.ServiceAccount {
  const trimmed = raw.trim()
  const attempts = [
    () => JSON.parse(trimmed) as admin.ServiceAccount,
    () => JSON.parse(JSON.parse(trimmed)) as admin.ServiceAccount,
    () => JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8')) as admin.ServiceAccount,
  ]

  for (const attempt of attempts) {
    try {
      return attempt()
    } catch {
      // siguiente formato
    }
  }

  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido')
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app()

  let key: admin.ServiceAccount

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (envJson?.trim()) {
    key = parseServiceAccountJson(envJson)
  } else {
    const credPath = path.join(PROJECT_ROOT, 'serviceAccountKey.json')
    if (!fs.existsSync(credPath)) {
      throw new Error(
        `No se encontró serviceAccountKey.json en ${PROJECT_ROOT} ni variable FIREBASE_SERVICE_ACCOUNT_JSON`
      )
    }
    key = JSON.parse(fs.readFileSync(credPath, 'utf8')) as admin.ServiceAccount
  }

  return admin.initializeApp({ credential: admin.credential.cert(key) })
}

export function getAdminAuth() {
  initFirebaseAdmin()
  return admin.auth()
}

export function getAdminFirestore() {
  initFirebaseAdmin()
  return admin.firestore()
}

export const ADMINS_COLLECTION_PATH = ['crossfitconnect-app', 'nuevaVersion', 'admins'] as const
