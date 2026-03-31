import { ADMINS_COLLECTION_PATH, getAdminFirestore } from '@/lib/firebase-admin'
import type { WodDoc } from '@/lib/wod'

const WODS_COLLECTION_PATH = ['crossfitconnect-app', 'nuevaVersion', 'wods'] as const

type AdminIdentity = {
  uid: string
}

function toDateValue(input: unknown): string | number | null {
  if (!input) return null
  if (
    typeof input === 'object' &&
    input !== null &&
    'toDate' in input &&
    typeof (input as { toDate?: unknown }).toDate === 'function'
  ) {
    return (input as { toDate: () => Date }).toDate().toISOString()
  }
  if (typeof input === 'number' || typeof input === 'string') return input
  return null
}

export async function getDashboardWods(admin: AdminIdentity): Promise<{
  headquarter: string | null
  wods: WodDoc[]
}> {
  const db = getAdminFirestore()
  const adminsRef = db
    .collection(ADMINS_COLLECTION_PATH[0])
    .doc(ADMINS_COLLECTION_PATH[1])
    .collection(ADMINS_COLLECTION_PATH[2])

  const adminSnap = await adminsRef.where('firebaseUID', '==', admin.uid).limit(1).get()
  if (adminSnap.empty) {
    throw new Error('NO_ADMIN_ACCESS')
  }

  const adminData = adminSnap.docs[0].data()
  const headquarter = typeof adminData.headquarter === 'string' ? adminData.headquarter : null

  const wodsRef = db
    .collection(WODS_COLLECTION_PATH[0])
    .doc(WODS_COLLECTION_PATH[1])
    .collection(WODS_COLLECTION_PATH[2])

  const wodsSnap = await wodsRef.orderBy('wodDate', 'desc').get()
  const wods: WodDoc[] = wodsSnap.docs.map((snapshot) => {
    const data = snapshot.data()
    return {
      id: snapshot.id,
      title: typeof data.title === 'string' ? data.title : undefined,
      description: typeof data.description === 'string' ? data.description : undefined,
      warmup: typeof data.warmup === 'string' ? data.warmup : undefined,
      warmUp: typeof data.warmUp === 'string' ? data.warmUp : undefined,
      strength:
        typeof data.strength === 'string' ||
        (typeof data.strength === 'object' && data.strength !== null)
          ? (data.strength as WodDoc['strength'])
          : undefined,
      functionalDescription:
        typeof data.functionalDescription === 'string' ? data.functionalDescription : undefined,
      metcoes: Array.isArray(data.metcoes) ? (data.metcoes as WodDoc['metcoes']) : undefined,
      metcoms: Array.isArray(data.metcoms) ? (data.metcoms as WodDoc['metcoms']) : undefined,
      additional: typeof data.additional === 'string' ? data.additional : undefined,
      wodDate: toDateValue(data.wodDate),
    }
  })

  return { headquarter, wods }
}
