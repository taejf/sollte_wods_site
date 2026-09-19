import { NextResponse } from 'next/server'
import { getAdminAuth, hasFirebaseAdminCredentialsConfigured } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasFirebaseAdminCredentialsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        firebaseAdmin: 'missing',
        hint: 'Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Vercel (Production).',
      },
      { status: 503 }
    )
  }

  try {
    getAdminAuth()
    return NextResponse.json({ ok: true, firebaseAdmin: 'ready' })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        firebaseAdmin: 'invalid',
        hint: 'Las credenciales existen pero no son válidas. Revisa FIREBASE_PRIVATE_KEY o FIREBASE_SERVICE_ACCOUNT_JSON.',
      },
      { status: 503 }
    )
  }
}
