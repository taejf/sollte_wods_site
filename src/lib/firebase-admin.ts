import fs from 'node:fs'
import path from 'node:path'
import * as admin from 'firebase-admin'

const PROJECT_ROOT = path.resolve(process.cwd())

function normalizePrivateKey(privateKey: string): string {
  return privateKey.replace(/\\n/g, '\n')
}

function normalizeServiceAccount(key: admin.ServiceAccount): admin.ServiceAccount {
  if (typeof key.privateKey === 'string') {
    return { ...key, privateKey: normalizePrivateKey(key.privateKey) }
  }
  const legacyKey = key as admin.ServiceAccount & { private_key?: string }
  if (typeof legacyKey.private_key === 'string') {
    return {
      ...key,
      privateKey: normalizePrivateKey(legacyKey.private_key),
    }
  }
  return key
}

function parseServiceAccountJson(raw: string): admin.ServiceAccount {
  const trimmed = raw.trim()
  const attempts = [
    () => JSON.parse(trimmed) as admin.ServiceAccount,
    () => JSON.parse(JSON.parse(trimmed)) as admin.ServiceAccount,
    () => JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8')) as admin.ServiceAccount,
  ]

  for (const attempt of attempts) {
    try {
      return normalizeServiceAccount(attempt())
    } catch {
      // siguiente formato
    }
  }

  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido')
}

function loadServiceAccountFromEnv(): admin.ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim()

  if (projectId && clientEmail && privateKeyRaw) {
    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKeyRaw),
    }
  }

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (envJson?.trim()) {
    return parseServiceAccountJson(envJson)
  }

  return null
}

function initFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app()

  const fromEnv = loadServiceAccountFromEnv()
  if (fromEnv) {
    return admin.initializeApp({ credential: admin.credential.cert(fromEnv) })
  }

  const credPath = path.join(PROJECT_ROOT, 'serviceAccountKey.json')
  if (!fs.existsSync(credPath)) {
    throw new Error(
      'Credenciales de Firebase Admin no configuradas. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY, o FIREBASE_SERVICE_ACCOUNT_JSON, o serviceAccountKey.json en local.'
    )
  }

  const key = normalizeServiceAccount(
    JSON.parse(fs.readFileSync(credPath, 'utf8')) as admin.ServiceAccount
  )
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
