import { type NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import type { WodsApiResponse } from '@/lib/wod'
import { getDashboardWods } from '@/server/wods/get-dashboard-wods'

function readBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (!scheme || !token) return null
  if (scheme.toLowerCase() !== 'bearer') return null
  return token.trim() || null
}

export async function GET(request: NextRequest) {
  try {
    const token = readBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const decoded = await getAdminAuth().verifyIdToken(token)
    const result = await getDashboardWods({ uid: decoded.uid })

    return NextResponse.json<WodsApiResponse>({
      wods: result.wods,
      headquarter: result.headquarter,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_ADMIN_ACCESS') {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Error al cargar los WODs' }, { status: 500 })
  }
}
