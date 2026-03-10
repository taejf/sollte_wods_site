import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminAuth, getAdminFirestore, ADMINS_COLLECTION_PATH } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';
    if (!pin) {
      return NextResponse.json(
        { error: 'PIN requerido' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const adminsRef = db
      .collection(ADMINS_COLLECTION_PATH[0])
      .doc(ADMINS_COLLECTION_PATH[1])
      .collection(ADMINS_COLLECTION_PATH[2]);
    const snapshot = await adminsRef.get();

    let matched: { firebaseUID: string } | null = null;
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const pinHash = data.pinHash;
      if (typeof pinHash === 'string' && await bcrypt.compare(pin, pinHash)) {
        if (data.firebaseUID) {
          matched = { firebaseUID: data.firebaseUID };
          break;
        }
      }
    }

    if (!matched) {
      return NextResponse.json(
        { error: 'PIN incorrecto' },
        { status: 401 }
      );
    }

    const auth = getAdminAuth();
    const token = await auth.createCustomToken(matched.firebaseUID);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('Error en /api/auth/pin:', err);
    return NextResponse.json(
      { error: 'Error al validar el PIN' },
      { status: 500 }
    );
  }
}
