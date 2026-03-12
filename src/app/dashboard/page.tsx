'use client'

import { collection, getDocs, orderBy, query, type QuerySnapshot } from 'firebase/firestore'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { applyTheme, getSavedTheme } from '@/components/ThemeInit'
import type { WodDoc } from '@/components/WodCard'
import { checkIsAdmin, logoutUser, onAuthChange } from '@/lib/auth'
import { db } from '@/lib/firebase'

const labelStripStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  transform: 'rotate(180deg)',
}

function buildBlocks(lines: string[]): { title: string | null; lines: string[] }[] {
  const blocks: { title: string | null; lines: string[] }[] = []
  let currentLines: string[] = []
  let currentTitle: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    const isSollte = /^sollte\s+functional:?/i.test(t) || /^sollte\s+funcional:?/i.test(t)
    const isAccesorios = /^accesorios:?/i.test(t)

    if (isSollte) {
      if (currentLines.length > 0) {
        blocks.push({
          title: currentTitle === null ? 'Crossfit' : currentTitle,
          lines: currentLines,
        })
        currentLines = []
      }
      currentTitle = /^sollte\s+funcional:?/i.test(t) ? 'Sollte funcional' : 'Sollte funcional'
    } else if (isAccesorios) {
      if (currentLines.length > 0) {
        blocks.push({ title: currentTitle, lines: currentLines })
        currentLines = []
      }
      currentTitle = 'Accesorios:'
    } else {
      currentLines.push(t)
    }
  }
  if (currentLines.length > 0) {
    blocks.push({ title: currentTitle, lines: currentLines })
  }
  return blocks
}

function blocksToLines(blocks: { title: string | null; lines: string[] }[]): string[] {
  const out: string[] = []
  for (const block of blocks) {
    if (block.title === 'Sollte funcional') out.push('Sollte funcional:')
    else if (block.title === 'Accesorios:') out.push('Accesorios:')
    out.push(...block.lines)
  }
  return out
}

const LINE_HEIGHT_MIN = 1
const LINE_HEIGHT_MAX = 2
const LINE_HEIGHT_STEP = 0.1
const LINE_HEIGHT_DEFAULT = 1.2
const STORAGE_KEY_LINE_HEIGHT = 'dashboard-line-height'

const CARD_SCALE_MIN = 0.5
const CARD_SCALE_MAX = 1
const CARD_SCALE_STEP = 0.05
const CARD_SCALE_DEFAULT = 1
const STORAGE_KEY_CARD_SCALE = 'dashboard-card-scale'

function SectionSlide({
  label,
  lines,
  lineHeight = LINE_HEIGHT_DEFAULT,
  className = '',
}: {
  label: string
  lines: string[]
  lineHeight?: number
  className?: string
}) {
  const items = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•-]\s*/, ''))
  if (items.length === 0) return null
  const firstLine = items[0]
  const restLines = items.slice(1)
  const isMetcon = label.toUpperCase().startsWith('METCON')
  const isWarmup = label.toUpperCase().startsWith('WARM')
  const labelBg = isMetcon ? 'bg-black' : 'bg-[#6E6E6E]'
  const blocks = buildBlocks(restLines)

  return (
    <div
      className={`flex rounded-lg overflow-hidden border border-[#c4c4c4] dark:border-gray-600 bg-white dark:bg-gray-800 min-h-0 ${isWarmup ? 'max-w-4xl w-full mx-auto' : ''} ${className}`}
    >
      <div
        className={`flex flex-shrink-0 w-10 sm:w-14 md:w-20 lg:w-24 min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[5rem] lg:min-w-24 items-center justify-center py-2 sm:py-3 md:py-4 px-1 sm:px-2 md:px-3 text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold uppercase tracking-wider ${labelBg}`}
        style={labelStripStyle}
      >
        {label}
      </div>
      <div
        className={`flex-1 min-h-0 border-l p-3 sm:p-4 md:p-5 lg:p-6 overflow-y-auto flex flex-col ${isMetcon ? 'border-black dark:border-gray-500' : 'border-[#e0e0e0] dark:border-gray-600'}`}
      >
        {restLines.length > 0 ? (
          <>
            {!isMetcon && (
              <p className="font-semibold mb-2 sm:mb-3 md:mb-4 text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl">
                {firstLine}
              </p>
            )}
            {isMetcon ? (
              <>
                {blocks.map((block, bi) => {
                  const isSollteBlock = block.title === 'Sollte funcional'
                  const titleLine =
                    isSollteBlock && block.lines.length > 0 ? block.lines[0] : firstLine
                  if (block.title === 'Crossfit' || block.title === null) {
                    return (
                      <div key={bi} className="mb-2 sm:mb-3 md:mb-4">
                        <p className="font-semibold text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl">
                          Crossfit
                        </p>
                        <p className="text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-4xl mt-0.5">
                          {firstLine}
                        </p>
                      </div>
                    )
                  }
                  if (block.title === 'Sollte funcional') {
                    return (
                      <div key={bi} className="mb-2 sm:mb-3 md:mb-4">
                        <p className="font-semibold text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl">
                          Sollte funcional
                        </p>
                        <p className="text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-4xl mt-0.5">
                          {titleLine}
                        </p>
                      </div>
                    )
                  }
                  if (block.title) {
                    return (
                      <p
                        key={bi}
                        className="font-semibold text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl mb-1 sm:mb-2"
                      >
                        {block.title}
                      </p>
                    )
                  }
                  return null
                })}
                {(() => {
                  const allListLines = blocks.flatMap((block) => {
                    const isSollteBlock = block.title === 'Sollte funcional'
                    return isSollteBlock && block.lines.length > 0
                      ? block.lines.slice(1)
                      : block.lines
                  })
                  const useGroupsOfFour = allListLines.length >= 4 && allListLines.length % 4 === 0
                  const useGroupsOfThree =
                    !useGroupsOfFour && allListLines.length >= 3 && allListLines.length % 3 === 0
                  const groupSize = useGroupsOfFour ? 4 : useGroupsOfThree ? 3 : 0
                  const chunks =
                    groupSize > 0
                      ? Array.from({ length: allListLines.length / groupSize }, (_, i) =>
                          allListLines.slice(i * groupSize, i * groupSize + groupSize)
                        )
                      : [allListLines]
                  const useGrouped = useGroupsOfFour || useGroupsOfThree
                  if (allListLines.length > 0) {
                  }
                  return useGrouped ? (
                    <div
                      className="grid gap-x-4 sm:gap-x-6 md:gap-x-8 gap-y-4 sm:gap-y-6 mt-2 sm:mt-3 md:mt-4"
                      style={{ gridTemplateColumns: `repeat(${chunks.length}, minmax(0, 1fr))` }}
                    >
                      {chunks.map((chunk, ci) => (
                        <ul key={ci} className="list-none p-0 m-0 flex flex-col gap-y-1 sm:gap-y-2">
                          {chunk.map((item, i) => (
                            <li
                              key={i}
                              className={`text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-[2.5rem] py-0.5 ${i === 0 ? 'font-bold' : ''}`}
                              style={{ lineHeight: lineHeight }}
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  ) : (
                    <ul
                      className={`list-none p-0 m-0 grid gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-0.5 mt-2 sm:mt-3 md:mt-4 ${
                        allListLines.length <= 4
                          ? 'grid-cols-1'
                          : allListLines.length < 8
                            ? 'grid-cols-1 md:grid-cols-2'
                            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                      }`}
                    >
                      {allListLines.map((item, i) => (
                        <li
                          key={i}
                          className="text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-[2.5rem] py-0.5"
                          style={{ lineHeight: lineHeight }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </>
            ) : (
              blocks.map((block, bi) => {
                const listLines = block.lines
                return (
                  <div key={bi} className={bi > 0 ? 'mt-2 sm:mt-3 md:mt-4' : ''}>
                    {block.title && (
                      <p className="font-semibold text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl mb-1 sm:mb-2">
                        {block.title}
                      </p>
                    )}
                    {listLines.length > 0 && (
                      <ul
                        className={`list-none p-0 m-0 grid gap-x-3 sm:gap-x-4 md:gap-x-6 gap-y-0.5 ${
                          isWarmup
                            ? 'grid-cols-1'
                            : listLines.length <= 4
                              ? 'grid-cols-1'
                              : listLines.length < 8
                                ? 'grid-cols-1 md:grid-cols-2'
                                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                        }`}
                      >
                        {listLines.map((item, i) => (
                          <li
                            key={i}
                            className="text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-[2.5rem] py-0.5"
                            style={{ lineHeight: lineHeight }}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })
            )}
          </>
        ) : (
          <p className="text-[#333] dark:text-gray-200 text-lg sm:text-xl md:text-3xl lg:text-5xl">
            {firstLine}
          </p>
        )}
      </div>
    </div>
  )
}

type WodSection =
  | { type: 'header'; title: string; description: string }
  | { type: 'section'; label: string; lines: string[] }

function getSections(wod: WodDoc | undefined): WodSection[] {
  if (!wod) return []
  const title = wod.title || 'WOD'
  const description = wod.description || ''
  const warmup = wod.warmup || wod.warmUp || ''
  const strength = wod.strength || ''
  const metcoes = wod.metcoes || wod.metcoms || []
  const additional = wod.additional || ''
  const sections: WodSection[] = []

  sections.push({ type: 'header', title, description })

  if (warmup.trim()) {
    sections.push({
      type: 'section',
      label: 'WARM UP',
      lines: warmup.split('\n').filter((l) => l.trim()),
    })
  }
  if (strength.trim()) {
    sections.push({
      type: 'section',
      label: 'FUERZA',
      lines: strength.split('\n').filter((l) => l.trim()),
    })
  }
  metcoes.forEach((metcon, index) => {
    const lines = metcon?.description?.split('\n').filter((l) => l.trim()) ?? []
    if (lines.length > 0) {
      sections.push({
        type: 'section',
        label: `METCON ${index + 1}`,
        lines,
      })
    }
  })
  if (additional.trim()) {
    sections.push({
      type: 'section',
      label: 'ACCESORIOS',
      lines: additional.split('\n').filter((l) => l.trim()),
    })
  }
  return sections
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wods, setWods] = useState<WodDoc[]>([])
  const [showFallbackMessage, setShowFallbackMessage] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [dateLabel, setDateLabel] = useState({ weekday: '', datePart: '', full: '' })
  const [isDark, setIsDark] = useState(true)
  const [lineHeightList, setLineHeightList] = useState(LINE_HEIGHT_DEFAULT)
  const [cardScale, setCardScale] = useState(CARD_SCALE_DEFAULT)
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsDark(getSavedTheme())
    try {
      const storedLine = localStorage.getItem(STORAGE_KEY_LINE_HEIGHT)
      if (storedLine !== null) {
        const n = parseFloat(storedLine)
        if (!Number.isNaN(n) && n >= LINE_HEIGHT_MIN && n <= LINE_HEIGHT_MAX) setLineHeightList(n)
      }
      const storedScale = localStorage.getItem(STORAGE_KEY_CARD_SCALE)
      if (storedScale !== null) {
        const s = parseFloat(storedScale)
        if (!Number.isNaN(s) && s >= CARD_SCALE_MIN && s <= CARD_SCALE_MAX) setCardScale(s)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LINE_HEIGHT, String(lineHeightList))
    } catch {
      // ignore
    }
  }, [lineHeightList])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CARD_SCALE, String(cardScale))
    } catch {
      // ignore
    }
  }, [cardScale])

  useEffect(() => {
    applyTheme(isDark)
  }, [isDark])
  const currentWod = wods[0]
  const sections = getSections(currentWod)
  const carouselSections = sections.filter(
    (s): s is Extract<WodSection, { type: 'section' }> => s.type === 'section'
  )
  const sectionsLengthRef = useRef(carouselSections.length)
  const currentIndexRef = useRef(0)
  sectionsLengthRef.current = carouselSections.length
  currentIndexRef.current = currentIndex
  const len = carouselSections.length
  const useInfinite = len > 1
  const slidesToRender = useInfinite ? [...carouselSections, carouselSections[0]] : carouselSections
  const [skipTransition, setSkipTransition] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        router.replace('/')
        return
      }
      try {
        const isAdmin = await checkIsAdmin(user.uid)
        if (!isAdmin) {
          await logoutUser()
          router.replace('/?error=no_admin')
          return
        }
      } catch {
        router.replace('/')
        return
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      try {
        const wodsRef = collection(db, 'crossfitconnect-app', 'nuevaVersion', 'wods')
        let snapshot: QuerySnapshot
        try {
          const q = query(wodsRef, orderBy('wodDate', 'desc'))
          snapshot = await getDocs(q)
        } catch {
          snapshot = await getDocs(wodsRef)
        }

        if (snapshot.empty) {
          setError(
            'No se encontraron WODs en Firestore. Asegúrate de tener documentos en la ruta: /crossfitconnect-app/nuevaVersion/wods/'
          )
          setLoading(false)
          return
        }

        const allWods = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WodDoc[]

        const sorted = [...allWods].sort((a, b) => {
          const getTime = (w: WodDoc) => {
            const d = w.wodDate as { toDate?: () => Date } | undefined
            if (!d) return 0
            const date = d.toDate ? d.toDate() : new Date(d as unknown as string)
            return date.getTime()
          }
          return getTime(b) - getTime(a)
        })

        const todayWods = sorted.filter((wod) => {
          const d = wod.wodDate as { toDate?: () => Date } | undefined
          if (!d) return false
          const wodDate = d.toDate ? d.toDate() : new Date(d as unknown as string)
          wodDate.setHours(0, 0, 0, 0)
          return wodDate.getTime() === today.getTime()
        })

        const toShow =
          todayWods.length > 0 ? todayWods : sorted.length > 0 ? sorted.slice(0, 5) : []
        setWods(toShow)
        setShowFallbackMessage(todayWods.length === 0 && sorted.length > 0)
      } catch (_err) {
        setError(
          `Error al cargar WODs. Verifica tu configuración de Firebase y las reglas de seguridad.`
        )
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (!skipTransition) return
    if (currentIndex === len && useInfinite) {
      const id = setTimeout(() => {
        setSkipTransition(false)
        setCurrentIndex(len - 1)
      }, 20)
      return () => clearTimeout(id)
    }
    const id = requestAnimationFrame(() => setSkipTransition(false))
    return () => cancelAnimationFrame(id)
  }, [skipTransition, currentIndex, len, useInfinite])

  useEffect(() => {
    if (isPaused || !useInfinite) return
    const interval = setInterval(() => {
      const n = sectionsLengthRef.current
      if (n <= 1) return
      setCurrentIndex((i) => {
        if (i === n) return i
        if (i === n - 1) return n
        return i + 1
      })
    }, 5500)
    return () => clearInterval(interval)
  }, [isPaused, useInfinite])

  useEffect(() => {
    if (carouselSections.length > 0) {
      const maxIdx = useInfinite ? carouselSections.length : carouselSections.length - 1
      setCurrentIndex((i) => Math.min(i, maxIdx))
    }
  }, [carouselSections.length, useInfinite])

  useEffect(() => {
    const HIDE_DELAY_MS = 2500

    const scheduleHide = () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current)
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
        hideControlsTimeoutRef.current = null
      }, HIDE_DELAY_MS)
    }

    const show = () => {
      setShowControls(true)
      scheduleHide()
    }

    window.addEventListener('mousemove', show)
    window.addEventListener('touchstart', show)
    window.addEventListener('touchmove', show)

    return () => {
      window.removeEventListener('mousemove', show)
      window.removeEventListener('touchstart', show)
      window.removeEventListener('touchmove', show)
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUser()
      router.replace('/')
    } catch {
      setError('Error al cerrar sesión')
    }
  }

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return
    if (useInfinite && currentIndex === len) {
      setSkipTransition(true)
      setCurrentIndex(0)
    }
  }

  const goPrev = () => {
    if (!useInfinite) return
    if (currentIndex === 0) {
      setSkipTransition(true)
      setCurrentIndex(len)
    } else {
      setCurrentIndex((i) => i - 1)
    }
  }
  const goNext = () => {
    if (!useInfinite) return
    if (currentIndex === len) {
      setSkipTransition(true)
      setCurrentIndex(0)
    } else if (currentIndex === len - 1) {
      setCurrentIndex(len)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const locale = 'es-ES'
      const weekday = now.toLocaleDateString(locale, { weekday: 'long' })
      const datePart = now.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      setCurrentTime(
        now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
      setDateLabel({
        weekday,
        datePart,
        full: `${weekday}, ${datePart}`,
      })
    }
    updateDateTime()
    const id = setInterval(updateDateTime, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goPrev()
      } else if (e.key === 'ArrowRight') {
        goNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goPrev, goNext])

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#1a1a1a] flex flex-col">
      <header className="bg-white dark:bg-gray-900 py-2 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 shadow-sm shrink-0">
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center w-full max-w-full sm:max-w-[900px] mx-auto gap-2 sm:gap-4 min-w-0">
          <p
            className="text-[#333] dark:text-gray-200 text-sm sm:text-base md:text-xl lg:text-2xl font-medium text-center sm:text-left order-2 sm:order-1 min-w-0 overflow-hidden"
            title={dateLabel.full}
          >
            <span className="hidden sm:block truncate">
              {dateLabel.weekday}
              <br />
              {dateLabel.datePart}
            </span>
            <span className="sm:hidden block truncate">
              {dateLabel.weekday}, {dateLabel.datePart}
            </span>
          </p>
          <div className="flex justify-center items-center order-1 sm:order-2 min-w-0 shrink-0 overflow-hidden">
            <Image
              src="/sollte_negro_full.png"
              alt="Sollte Logo"
              width={180}
              height={72}
              className="h-10 sm:h-12 md:h-14 lg:h-16 w-auto max-w-[45vw] sm:max-w-[200px] dark:invert object-contain"
              unoptimized
            />
          </div>
          <p className="text-[#333] dark:text-gray-200 text-sm sm:text-base md:text-xl lg:text-2xl font-medium text-center sm:text-right tabular-nums order-3 min-w-0 overflow-hidden truncate">
            {currentTime}
          </p>
        </div>
      </header>

      <div
        className={`fixed bottom-4 sm:bottom-6 left-3 sm:left-6 z-50 flex flex-row gap-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <fieldset
          className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 px-4 py-4 sm:px-5 sm:py-5 min-w-[200px] sm:min-w-[260px]"
          aria-label="Tamaño de tarjetas"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
            Tamaño tarjetas
          </legend>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setCardScale((v) =>
                  Math.max(CARD_SCALE_MIN, Math.round((v - CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de tarjetas"
            >
              −
            </button>
            <span className="tabular-nums text-xl sm:text-2xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[3rem] text-center">
              {cardScale.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setCardScale((v) =>
                  Math.min(CARD_SCALE_MAX, Math.round((v + CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de tarjetas"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 px-4 py-4 sm:px-5 sm:py-5 min-w-[200px] sm:min-w-[260px]"
          aria-label="Ajuste de interlineado"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
            Interlineado
          </legend>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setLineHeightList((v) =>
                  Math.max(LINE_HEIGHT_MIN, Math.round((v - LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir interlineado"
            >
              −
            </button>
            <span className="tabular-nums text-xl sm:text-2xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[3rem] text-center">
              {lineHeightList.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={() =>
                setLineHeightList((v) =>
                  Math.min(LINE_HEIGHT_MAX, Math.round((v + LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar interlineado"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>

      <button
        type="button"
        onClick={() => setIsDark((d) => !d)}
        className={`fixed bottom-4 sm:bottom-6 right-16 sm:right-24 z-50 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 pointer-events-none ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
        aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {isDark ? (
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={handleLogout}
        className={`fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 pointer-events-none ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
        aria-label="Cerrar sesión"
      >
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>

      {useInfinite && (
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className={`fixed top-20 sm:top-24 right-3 sm:right-6 z-50 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-label={isPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}
          aria-pressed={isPaused}
        >
          {isPaused ? (
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          )}
        </button>
      )}

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <main className="flex-1 flex flex-col min-h-0 w-full max-w-[98vw] sm:max-w-[95vw] mx-auto p-1 sm:p-[0.3rem] overflow-hidden relative">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center min-h-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f3f3f3] dark:border-gray-700 border-t-[#4A90E2] rounded-full animate-spin" />
              <p className="mt-3 sm:mt-4 text-[#666] dark:text-gray-400 text-base sm:text-xl md:text-2xl lg:text-3xl">
                Cargando WODs...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-[#fee] dark:bg-red-900/30 text-[#c33] dark:text-red-300 p-3 sm:p-4 rounded-lg mb-3 sm:mb-4 border-l-4 border-[#c33] dark:border-red-500 text-sm sm:text-base md:text-xl lg:text-3xl">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center w-full overflow-hidden p-1 sm:p-[0.3rem]">
              {showFallbackMessage && (
                <div className="bg-[#fff3cd] dark:bg-amber-900/30 text-[#856404] dark:text-amber-200 p-2 sm:p-3 md:p-4 rounded-lg mb-2 sm:mb-3 md:mb-4 text-center text-xs sm:text-sm md:text-xl lg:text-3xl">
                  ⚠️ No hay WOD programado para hoy.{' '}
                  {wods.length > 1 ? 'Mostrando WODs recientes.' : 'Mostrando el WOD más reciente.'}
                </div>
              )}
              {currentWod && (
                <div className="bg-white rounded-lg border border-[#c4c4c4] p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-6 hidden">
                  <h2 className="font-bold text-2xl sm:text-4xl md:text-6xl lg:text-9xl text-[#333] mb-1 sm:mb-2">
                    {currentWod.title || 'WOD'}
                  </h2>
                  {currentWod.description && (
                    <p className="text-[#666] text-xl sm:text-3xl md:text-5xl lg:text-8xl leading-relaxed m-0">
                      {currentWod.description}
                    </p>
                  )}
                </div>
              )}
              <section
                className="relative overflow-hidden w-full max-w-9xl mx-auto flex flex-col items-center justify-center"
                aria-roledescription="carrusel"
                aria-label="Carrusel de secciones del WOD del día"
              >
                {useInfinite && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-28 h-56 sm:w-32 sm:h-64 md:w-40 md:h-80 rounded-lg bg-white/25 dark:bg-black/25 text-[#333] dark:text-gray-100 border border-white/30 dark:border-white/10 shadow-sm hover:bg-white/45 dark:hover:bg-black/45 hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 active:scale-[0.98] transition-all duration-200 ${
                        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                      aria-label="Sección anterior"
                    >
                      <svg
                        className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] md:w-20 md:h-20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-28 h-56 sm:w-32 sm:h-64 md:w-40 md:h-80 rounded-lg bg-white/25 dark:bg-black/25 text-[#333] dark:text-gray-100 border border-white/30 dark:border-white/10 shadow-sm hover:bg-white/45 dark:hover:bg-black/45 hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 active:scale-[0.98] transition-all duration-200 ${
                        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`}
                      aria-label="Sección siguiente"
                    >
                      <svg
                        className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] md:w-20 md:h-20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </>
                )}
                <div
                  className="flex"
                  style={{
                    transform: `translateX(-${currentIndex * 100}%)`,
                    transition: useInfinite && !skipTransition ? 'transform 0.4s ease-out' : 'none',
                  }}
                  onTransitionEnd={handleTransitionEnd}
                >
                  {slidesToRender.map((slideSection, index) => {
                    const isMetcon = slideSection.label.toUpperCase().startsWith('METCON')
                    const isFuerza = slideSection.label === 'FUERZA'
                    const metconCards = isMetcon
                      ? (() => {
                          const items = slideSection.lines
                            .map((l) => l.trim().replace(/^[•-]\s*/, ''))
                            .filter(Boolean)
                          if (items.length === 0) return null
                          const firstLine = items[0]
                          const restLines = items.slice(1)
                          const blocks = buildBlocks(restLines)
                          if (blocks.length === 0) return null
                          if (blocks.length === 1) {
                            const b = blocks[0]
                            const mid = Math.ceil(b.lines.length / 2)
                            const titleLine =
                              b.title === 'Sollte funcional'
                                ? ['Sollte funcional:']
                                : b.title === 'Accesorios:'
                                  ? ['Accesorios:']
                                  : []
                            return [
                              {
                                label: slideSection.label,
                                lines: [firstLine, ...titleLine, ...b.lines.slice(0, mid)],
                              },
                              {
                                label: slideSection.label,
                                lines: [firstLine, ...titleLine, ...b.lines.slice(mid)],
                              },
                            ]
                          }
                          const mid = Math.ceil(blocks.length / 2)
                          return [
                            {
                              label: slideSection.label,
                              lines: [firstLine, ...blocksToLines(blocks.slice(0, mid))],
                            },
                            {
                              label: slideSection.label,
                              lines: [firstLine, ...blocksToLines(blocks.slice(mid))],
                            },
                          ]
                        })()
                      : null
                    const fuerzaCards = isFuerza
                      ? (() => {
                          const items = slideSection.lines
                            .map((l) => l.trim().replace(/^[•-]\s*/, ''))
                            .filter(Boolean)
                          if (items.length === 0) return null
                          const firstLine = items[0]
                          const restLines = items.slice(1)
                          const blocks = buildBlocks(restLines)
                          const crossfitBlock = blocks.find(
                            (b) => b.title === 'Crossfit' || b.title === null
                          )
                          const sollteBlock = blocks.find((b) => b.title === 'Sollte funcional')
                          return [
                            {
                              label: slideSection.label,
                              lines: [
                                firstLine,
                                ...(crossfitBlock?.lines ?? []),
                              ],
                            },
                            {
                              label: slideSection.label,
                              lines: [
                                'Sollte Funcional',
                                ...(sollteBlock?.lines ?? []),
                              ],
                            },
                          ]
                        })()
                      : null
                    const twoCards =
                      metconCards && metconCards.length === 2
                        ? metconCards
                        : fuerzaCards && fuerzaCards.length === 2
                          ? fuerzaCards
                          : null
                    return (
                      <section
                        key={index}
                        className="flex-[0_0_100%] min-w-0 h-full px-1 sm:px-0 flex items-center justify-center"
                        aria-label={
                          useInfinite ? `Sección ${(index % len) + 1} de ${len}` : undefined
                        }
                        aria-hidden={useInfinite ? index !== currentIndex : undefined}
                      >
                        <div
                          className="w-full h-full flex flex-col min-h-0"
                          style={{
                            transform: `scale(${cardScale})`,
                            transformOrigin: 'center center',
                          }}
                        >
                          {twoCards ? (
                            <div className="flex gap-2 sm:gap-3 md:gap-4 w-full h-full min-h-0 flex-1 items-stretch">
                              {twoCards.map((card, ci) => (
                                <div key={ci} className="flex-1 min-w-0 min-h-0 flex flex-col">
                                  <SectionSlide
                                    label={card.label}
                                    lines={card.lines}
                                    lineHeight={lineHeightList}
                                    className="flex-1 min-h-0 h-full"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <SectionSlide
                              label={slideSection.label}
                              lines={slideSection.lines}
                              lineHeight={lineHeightList}
                            />
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
