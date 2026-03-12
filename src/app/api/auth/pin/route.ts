import bcrypt from 'bcryptjs'
import { type NextRequest, NextResponse } from 'next/server'
import { ADMINS_COLLECTION_PATH, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
    if (!pin) {
      return NextResponse.json({ error: 'PIN requerido' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const adminsRef = db
      .collection(ADMINS_COLLECTION_PATH[0])
      .doc(ADMINS_COLLECTION_PATH[1])
      .collection(ADMINS_COLLECTION_PATH[2])
    const snapshot = await adminsRef.get()

    let matched: { firebaseUID: string; headquarter?: string } | null = null
    for (const doc of snapshot.docs) {
      const data = doc.data()
      const pinHash = data.pinHash
      if (typeof pinHash === 'string' && (await bcrypt.compare(pin, pinHash))) {
        if (data.firebaseUID) {
          matched = {
            firebaseUID: data.firebaseUID,
            headquarter: typeof data.headquarter === 'string' ? data.headquarter : undefined,
          }
          break
        }
      }
    }

    if (!matched) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    const auth = getAdminAuth()
    const token = await auth.createCustomToken(matched.firebaseUID)
    return NextResponse.json({
      token,
      headquarter: matched.headquarter ?? null,
    })
  } catch (_err) {
    return NextResponse.json({ error: 'Error al validar el PIN' }, { status: 500 })
  }
}
