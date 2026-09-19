import fs from 'node:fs'
import path from 'node:path'
import * as admin from 'firebase-admin'

const PROJECT_ROOT = path.resolve(process.cwd())

function normalizePrivateKey(privateKey: string): string {
  const trimmed = privateKey.trim()
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return trimmed.replace(/\\n/g, '\n')
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
    if (decoded.includes('BEGIN PRIVATE KEY')) {
      return decoded.replace(/\\n/g, '\n')
    }
  } catch {
    // no es base64
  }
  return trimmed.replace(/\\n/g, '\n')
}

function normalizeServiceAccount(key: admin.ServiceAccount): admin.ServiceAccount {
  const legacyKey = key as admin.ServiceAccount & { private_key?: string }
  const rawPrivate =
    typeof key.privateKey === 'string'
      ? key.privateKey
      : typeof legacyKey.private_key === 'string'
        ? legacyKey.private_key
        : null

  if (!rawPrivate) return key

  const privateKey = normalizePrivateKey(rawPrivate)
  return {
    ...key,
    privateKey,
    private_key: privateKey,
  } as admin.ServiceAccount
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
  const privateKeyRaw =
    process.env.FIREBASE_PRIVATE_KEY?.trim() || process.env.FIREBASE_PRIVATE_KEY_B64?.trim()

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
    throw new Error('FIREBASE_ADMIN_CREDENTIALS_MISSING')
  }

  const key = normalizeServiceAccount(
    JSON.parse(fs.readFileSync(credPath, 'utf8')) as admin.ServiceAccount
  )
  return admin.initializeApp({ credential: admin.credential.cert(key) })
}

export function isFirebaseAdminCredentialsMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message === 'FIREBASE_ADMIN_CREDENTIALS_MISSING' ||
    error.message.includes('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido') ||
    error.message.includes('Credenciales de Firebase Admin no configuradas') ||
    /invalid.*private key/i.test(error.message) ||
    /error parsing pem/i.test(error.message)
  )
}

/** Comprueba credenciales sin inicializar Firebase (útil para health checks). */
export function hasFirebaseAdminCredentialsConfigured(): boolean {
  if (loadServiceAccountFromEnv()) return true
  return fs.existsSync(path.join(PROJECT_ROOT, 'serviceAccountKey.json'))
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
