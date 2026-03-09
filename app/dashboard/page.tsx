'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onAuthChange, logoutUser, checkIsAdmin } from '@/lib/auth';
import type { WodDoc } from '@/components/WodCard';

const labelStripStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  transform: 'rotate(180deg)'
};

function SectionSlide({ label, lines }: { label: string; lines: string[] }) {
  const items = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•\-]\s*/, ''));
  if (items.length === 0) return null;
  const firstLine = items[0];
  const restLines = items.slice(1);
  const isMetcon = label.toUpperCase().startsWith('METCON');
  const labelBg = isMetcon ? 'bg-black' : 'bg-[#6E6E6E]';
  return (
    <div className="mb-6 flex rounded-lg overflow-hidden border border-[#c4c4c4] bg-white">
      <div
        className={`flex flex-shrink-0 w-14 min-w-14 items-center justify-center py-4 px-3 text-white text-xs font-bold uppercase tracking-wider ${labelBg}`}
        style={labelStripStyle}
      >
        {label}
      </div>
      <div className={`flex-1 border-l p-5 ${isMetcon ? 'border-black' : 'border-[#e0e0e0]'}`}>
        {restLines.length > 0 ? (
          <>
            <p className="font-semibold mb-3 text-[#333]">{firstLine}</p>
            <ul className="list-none p-0 m-0">
              {restLines.map((item, i) => (
                <li
                  key={i}
                  className="text-[#333] text-sm leading-relaxed py-1 before:content-['•_'] before:text-[#4A90E2] before:font-bold before:mr-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[#333] text-sm">{firstLine}</p>
        )}
      </div>
    </div>
  );
}

type WodSection =
  | { type: 'header'; title: string; description: string }
  | { type: 'section'; label: string; lines: string[] };

function getSections(wod: WodDoc | undefined): WodSection[] {
  if (!wod) return [];
  const title = wod.title || 'WOD';
  const description = wod.description || '';
  const warmup = wod.warmup || wod.warmUp || '';
  const strength = wod.strength || '';
  const metcoes = wod.metcoes || wod.metcoms || [];
  const additional = wod.additional || '';
  const sections: WodSection[] = [];

  sections.push({ type: 'header', title, description });

  if (warmup.trim()) {
    sections.push({
      type: 'section',
      label: 'WARM UP',
      lines: warmup.split('\n').filter((l) => l.trim())
    });
  }
  if (strength.trim()) {
    sections.push({
      type: 'section',
      label: 'FUERZA',
      lines: strength.split('\n').filter((l) => l.trim())
    });
  }
  metcoes.forEach((metcon, index) => {
    const lines = metcon?.description?.split('\n').filter((l) => l.trim()) ?? [];
    if (lines.length > 0) {
      sections.push({
        type: 'section',
        label: `METCON ${index + 1}`,
        lines
      });
    }
  });
  if (additional.trim()) {
    sections.push({
      type: 'section',
      label: 'ACCESORIOS',
      lines: additional.split('\n').filter((l) => l.trim())
    });
  }
  return sections;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wods, setWods] = useState<WodDoc[]>([]);
  const [showFallbackMessage, setShowFallbackMessage] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentWod = wods[0];
  const sections = getSections(currentWod);
  const carouselSections = sections.filter((s): s is Extract<WodSection, { type: 'section' }> => s.type === 'section');
  const sectionsLengthRef = useRef(carouselSections.length);
  const currentIndexRef = useRef(0);
  sectionsLengthRef.current = carouselSections.length;
  currentIndexRef.current = currentIndex;
  const len = carouselSections.length;
  const useInfinite = len > 1;
  const slidesToRender = useInfinite ? [...carouselSections, carouselSections[0]] : carouselSections;
  const [skipTransition, setSkipTransition] = useState(false);

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

        const toShow =
          todayWods.length > 0 ? todayWods : (sorted.length > 0 ? sorted.slice(0, 5) : []);
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

  useEffect(() => {
    if (!skipTransition) return;
    if (currentIndex === len && useInfinite) {
      const id = setTimeout(() => {
        setSkipTransition(false);
        setCurrentIndex(len - 1);
      }, 20);
      return () => clearTimeout(id);
    }
    const id = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(id);
  }, [skipTransition, currentIndex, len, useInfinite]);

  useEffect(() => {
    if (isPaused || !useInfinite) return;
    const interval = setInterval(() => {
      const n = sectionsLengthRef.current;
      if (n <= 1) return;
      setCurrentIndex((i) => {
        if (i === n) return i;
        if (i === n - 1) return n;
        return i + 1;
      });
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused, useInfinite]);

  useEffect(() => {
    if (carouselSections.length > 0) {
      const maxIdx = useInfinite ? carouselSections.length : carouselSections.length - 1;
      setCurrentIndex((i) => Math.min(i, maxIdx));
    }
  }, [carouselSections.length, useInfinite]);

  useEffect(() => {
    const HIDE_DELAY_MS = 2500;

    const scheduleHide = () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        hideControlsTimeoutRef.current = null;
      }, HIDE_DELAY_MS);
    };

    const show = () => {
      setShowControls(true);
      scheduleHide();
    };

    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    window.addEventListener('touchmove', show);

    return () => {
      window.removeEventListener('mousemove', show);
      window.removeEventListener('touchstart', show);
      window.removeEventListener('touchmove', show);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace('/');
    } catch {
      setError('Error al cerrar sesión');
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (useInfinite && currentIndex === len) {
      setSkipTransition(true);
      setCurrentIndex(0);
    }
  };

  const goPrev = () => {
    if (!useInfinite) return;
    if (currentIndex === 0) {
      setSkipTransition(true);
      setCurrentIndex(len);
    } else {
      setCurrentIndex((i) => i - 1);
    }
  };
  const goNext = () => {
    if (!useInfinite) return;
    if (currentIndex === len) {
      setSkipTransition(true);
      setCurrentIndex(0);
    } else if (currentIndex === len - 1) {
      setCurrentIndex(len);
    } else {
      setCurrentIndex((i) => i + 1);
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
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 pointer-events-none ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
        aria-label="Cerrar sesión"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      <main className="max-w-[600px] mx-auto p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-normal leading-tight text-[#333] mb-1">
              <span className="font-extrabold text-3xl">WOD del día💪</span>
            </h1>
            <p className="text-[#999] text-sm font-light">{currentDate}</p>
          </div>
          {useInfinite && (
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-[#4A90E2] text-white hover:bg-[#3A7BC8] active:scale-95 transition-all duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label={isPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
              aria-pressed={isPaused}
            >
              {isPaused ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>
          )}
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
                ⚠️ No hay WOD programado para hoy.{' '}
                {wods.length > 1
                  ? 'Mostrando WODs recientes.'
                  : 'Mostrando el WOD más reciente.'}
              </div>
            )}
            {currentWod && (
              <div className="bg-white rounded-lg border border-[#c4c4c4] p-6 mb-6">
                <h2 className="font-bold text-xl text-[#333] mb-1">{currentWod.title || 'WOD'}</h2>
                {currentWod.description && (
                  <p className="text-[#666] text-sm leading-relaxed m-0">{currentWod.description}</p>
                )}
              </div>
            )}
            <div
              className="relative overflow-hidden w-full"
              role="region"
              aria-roledescription="carrusel"
              aria-label="Carrusel de secciones del WOD del día"
            >
              {useInfinite && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 text-[#333] shadow-md hover:bg-white active:scale-95 transition-all duration-300 ${
                      showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    aria-label="Sección anterior"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 text-[#333] shadow-md hover:bg-white active:scale-95 transition-all duration-300 ${
                      showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    aria-label="Sección siguiente"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </>
              )}
              <div
                className="flex"
                style={{
                  transform: `translateX(-${currentIndex * 100}%)`,
                  transition:
                    useInfinite && !skipTransition
                      ? 'transform 0.4s ease-out'
                      : 'none'
                }}
                onTransitionEnd={handleTransitionEnd}
              >
                {slidesToRender.map((section, index) => (
                  <div
                    key={index}
                    className="flex-[0_0_100%] min-w-0 px-0"
                    role="group"
                    aria-label={
                      useInfinite
                        ? `Sección ${(index % len) + 1} de ${len}`
                        : undefined
                    }
                    aria-hidden={useInfinite ? index !== currentIndex : undefined}
                  >
                    <SectionSlide label={section.label} lines={section.lines} />
                  </div>
                ))}
              </div>
              {useInfinite && (
                <div
                  className={`flex justify-center gap-2 mt-4 transition-opacity duration-300 ${
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  role="tablist"
                  aria-label="Indicadores de sección"
                >
                  {carouselSections.map((_, i) => {
                    const isActive = currentIndex === i || (currentIndex === len && i === 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentIndex(i)}
                        role="tab"
                        aria-selected={isActive}
                        aria-label={`Ver sección ${i + 1} de ${len}`}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          isActive
                            ? 'bg-[#4A90E2] scale-110'
                            : 'bg-[#ccc] hover:bg-[#999]'
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
