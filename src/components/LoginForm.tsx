'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { loginWithPin } from '@/lib/auth'

export default function LoginForm() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!pin.trim()) {
      setError('Introduce tu PIN')
      return
    }
    setLoading(true)
    try {
      await loginWithPin(pin)
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message === 'NO_ADMIN_ACCESS') {
        setError('Acceso denegado. Tu cuenta no tiene permisos de administrador.')
      } else if (message.includes('PIN incorrecto') || message.includes('incorrecto')) {
        setError('PIN incorrecto')
      } else {
        setError(message || 'Error al iniciar sesión. Verifica tu PIN.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-8">
      <div className="w-full max-w-[480px] bg-white p-10 rounded-lg shadow-md">
        <div className="flex justify-center mb-12">
          <Image
            src="/sollte_negro_full.png"
            alt="Sollte Logo"
            width={200}
            height={60}
            className="h-auto w-auto max-w-[200px]"
            unoptimized
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-8">
            <label
              htmlFor="pin"
              className="absolute -top-2.5 left-4 bg-white px-2 text-sm text-[#666] z-10"
            >
              PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
              autoComplete="one-time-code"
              placeholder="5 dígitos"
              className="w-full py-4 px-5 border border-[#d0d0d0] rounded-lg text-base text-[#333] bg-white focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20 transition-all"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#fee] text-[#c33] text-sm border-l-4 border-[#c33]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-10 h-10 border-4 border-[#f3f3f3] border-t-[#4A90E2] rounded-full animate-spin" />
              <p className="mt-4 text-[#666] text-sm">Iniciando sesión...</p>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-4 bg-[#4A90E2] text-white rounded-[50px] text-sm font-semibold tracking-wide uppercase hover:bg-[#3A7BC8] hover:-translate-y-px hover:shadow-lg hover:shadow-[#4A90E2]/30 transition-all disabled:bg-[#ccc] disabled:cursor-not-allowed disabled:transform-none"
            >
              INICIAR SESIÓN
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
