/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_FIREBASE_API_KEY: string
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string
    NEXT_PUBLIC_FIREBASE_APP_ID: string
    /** JSON completo de la cuenta de servicio de Firebase (solo servidor). En local puede usarse serviceAccountKey.json en su lugar. */
    FIREBASE_SERVICE_ACCOUNT_JSON?: string
    /** Alternativa recomendada en Vercel: credenciales por separado (solo servidor). */
    FIREBASE_PROJECT_ID?: string
    FIREBASE_CLIENT_EMAIL?: string
    FIREBASE_PRIVATE_KEY?: string
    /** Clave privada en base64 (alternativa en Vercel si los saltos de línea fallan). */
    FIREBASE_PRIVATE_KEY_B64?: string
  }
}
