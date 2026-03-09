'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onAuthChange, logoutUser, checkIsAdmin } from '@/lib/auth';
import WodCard, { type WodDoc } from '@/components/WodCard';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wods, setWods] = useState<WodDoc[]>([]);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }
      try {
        const isAdmin = await checkIsAdmin(user.uid);
        if (!isAdmin) {
          await logoutUser();
          router.replace('/?error=no_admin');
          return;
        }
      } catch {
        router.replace('/');
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        const wodsRef = collection(db, 'crossfitconnect-app', 'nuevaVersion', 'wods');
        let snapshot;
        try {
          const q = query(wodsRef, orderBy('wodDate', 'desc'));
          snapshot = await getDocs(q);
        } catch {
          snapshot = await getDocs(wodsRef);
        }

        if (snapshot.empty) {
          setError(
            'No se encontraron WODs en Firestore. Asegúrate de tener documentos en la ruta: /crossfitconnect-app/nuevaVersion/wods/'
          );
          setLoading(false);
          return;
        }

        const allWods = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as WodDoc[];

        const sorted = [...allWods].sort((a, b) => {
          const getTime = (w: WodDoc) => {
            const d = w.wodDate as { toDate?: () => Date } | undefined;
            if (!d) return 0;
            const date = d.toDate ? d.toDate() : new Date(d as unknown as string);
            return date.getTime();
          };
          return getTime(b) - getTime(a);
        });

        const todayWods = sorted.filter((wod) => {
          const d = wod.wodDate as { toDate?: () => Date } | undefined;
          if (!d) return false;
          const wodDate = d.toDate ? d.toDate() : new Date(d as unknown as string);
          wodDate.setHours(0, 0, 0, 0);
          return wodDate.getTime() === today.getTime();
        });

        const toShow = todayWods.length > 0 ? todayWods : (sorted.length > 0 ? [sorted[0]] : []);
        setWods(toShow);
        setShowFallbackMessage(todayWods.length === 0 && sorted.length > 0);
      } catch (err) {
        console.error(err);
        setError(
          `Error al cargar WODs. Verifica tu configuración de Firebase y las reglas de seguridad.`
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace('/');
    } catch {
      setError('Error al cerrar sesión');
    }
  };

  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="bg-white py-4 px-6 shadow-sm">
        <div className="flex justify-center items-center max-w-[600px] mx-auto">
          <Image
            src="/sollte_negro_full.png"
            alt="Sollte Logo"
            width={120}
            height={48}
            className="h-12 w-auto"
            unoptimized
          />
        </div>
      </header>

      <button
        type="button"
        onClick={handleLogout}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all"
        aria-label="Cerrar sesión"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      <main className="max-w-[600px] mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-normal leading-tight text-[#333] mb-1">
            <span className="font-extrabold text-3xl">WOD del día💪</span>
          </h1>
          <p className="text-[#999] text-sm font-light">{currentDate}</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-[#f3f3f3] border-t-[#4A90E2] rounded-full animate-spin" />
            <p className="mt-4 text-[#666] text-sm">Cargando WODs...</p>
          </div>
        )}

        {error && (
          <div className="bg-[#fee] text-[#c33] p-4 rounded-lg mb-4 border-l-4 border-[#c33]">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {showFallbackMessage && (
              <div className="bg-[#fff3cd] text-[#856404] p-4 rounded-lg mb-4 text-center">
                ⚠️ No hay WOD programado para hoy. Mostrando el WOD más reciente.
              </div>
            )}
            {wods.map((wod) => (
              <WodCard key={wod.id ?? wod.title} wod={wod} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
