'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { loginUser } from '@/lib/auth';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Por favor, completa todos los campos');
      return;
    }
    setLoading(true);
    try {
      await loginUser(email.trim(), password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'NO_ADMIN_ACCESS') {
        setError('Acceso denegado. Tu cuenta no tiene permisos de administrador.');
      } else if (message.includes('auth/user-not-found')) {
        setError('Usuario no encontrado');
      } else if (message.includes('auth/wrong-password')) {
        setError('Contraseña incorrecta');
      } else if (message.includes('auth/invalid-email')) {
        setError('Correo electrónico inválido');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Demasiados intentos. Intenta más tarde.');
      } else if (message.includes('auth/invalid-credential')) {
        setError('Credenciales inválidas. Verifica tu correo y contraseña.');
      } else {
        setError('Error al iniciar sesión. Verifica tus credenciales.');
      }
      setLoading(false);
    }
  };

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
              htmlFor="email"
              className="absolute -top-2.5 left-4 bg-white px-2 text-sm text-[#666] z-10"
            >
              Usuario
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full py-4 px-5 border border-[#d0d0d0] rounded-lg text-base text-[#333] bg-white focus:outline-none focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20 transition-all"
            />
          </div>

          <div className="relative mb-8">
            <label
              htmlFor="password"
              className="absolute -top-2.5 left-4 bg-white px-2 text-sm text-[#666] z-10"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
  );
}
