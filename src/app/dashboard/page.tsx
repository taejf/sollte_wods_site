'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  checkIsAdmin,
  consumeExplicitLogoutIntent,
  logoutUser,
  markExplicitLogoutIntent,
  onAuthChange,
} from '@/lib/auth'
import {
  clampSessionCurrentIndex,
  subscribeControlSession,
  updateControlSession,
} from '@/lib/controlSession'
import {
  getOrCreateSessionDeviceId,
  registerSessionPresenceHeartbeat,
  subscribeSessionPresence,
  type SessionPresencePeer,
} from '@/lib/controlSessionPresence'
import type { WodDoc, WodsApiResponse } from '@/lib/wod'

const labelStripStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  transform: 'rotate(180deg)',
}

/** Superficie e icono compartidos: flechas carrusel TV y modo control (mismo aspecto). */
const carouselArrowButtonSurfaceClassName =
  'rounded-lg bg-white/25 dark:bg-black/25 text-[#333] dark:text-gray-100 border border-white/30 dark:border-white/10 shadow-sm hover:bg-white/45 dark:hover:bg-black/45 hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 active:scale-[0.98] transition-all duration-200'

const carouselArrowIconClassNameTv =
  'w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] md:w-20 md:h-20'

/** Icono proporcional al carril estrecho del panel modo control. */
const carouselArrowIconClassNameControl =
  'w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14'

/** Título único encima de dos columnas (METCON / STRENGTH duales). */
function DualColumnSectionHeader({ label }: { label: string }) {
  return (
    <h2 className="m-0 w-full shrink-0 rounded-xl border border-white/15 bg-gradient-to-b from-[#2f2f2f] via-black to-[#0c0c0c] px-3 py-2 text-center text-xl font-bold uppercase tracking-wider text-white shadow-[inset_0_2px_0_0_rgba(255,255,255,0.14),inset_0_-4px_12px_rgba(0,0,0,0.45),0_8px_24px_-6px_rgba(0,0,0,0.5)] dark:border-white/10 sm:px-4 sm:py-3 sm:text-2xl md:py-4 md:text-4xl lg:py-5 lg:text-6xl">
      {label}
    </h2>
  )
}

const BLOCK_TITLE_ENDURANCE = 'Endurance'

function buildBlocks(lines: string[]): { title: string | null; lines: string[] }[] {
  const blocks: { title: string | null; lines: string[] }[] = []
  let currentLines: string[] = []
  let currentTitle: string | null = null

  for (const line of lines) {
    const t = line.trim()
    const isSollte = /^sollte\s+functional:?/i.test(t) || /^sollte\s+funcional:?/i.test(t)
    const isAccesorios = /^accesorios:?/i.test(t)
    const isEndurance = /\bEndurance\b/i.test(t)

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
    } else if (isEndurance) {
      if (currentLines.length > 0) {
        blocks.push({
          title: currentTitle === null ? 'Crossfit' : currentTitle,
          lines: currentLines,
        })
        currentLines = []
      }
      currentTitle = BLOCK_TITLE_ENDURANCE
      currentLines = [t]
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

/** Debe coincidir con las clases grid de las listas de ejercicios. */
type ExerciseGridLayout = 'single' | 'twoCol' | 'threeCol'

function getExerciseGridLayout(
  listLength: number,
  opts: {
    isEnduranceSection?: boolean
    isFuerza?: boolean
    isWarmup?: boolean
  }
): ExerciseGridLayout {
  const { isEnduranceSection, isFuerza, isWarmup } = opts
  if (isFuerza || isWarmup) return 'single'
  if (isEnduranceSection) return 'twoCol'
  if (listLength <= 4) return 'single'
  if (listLength < 8) return 'twoCol'
  return 'threeCol'
}

/** Borde inferior entre líneas dentro de una sola columna. */
function isNoteLine(item: string): boolean {
  return /^\s*nota\b:?/i.test(item)
}

function isRoundLine(item: string): boolean {
  return /^\s*(?:\d+\s+)?rounds?\b/i.test(item)
}

function isFortalecimientoLine(item: string): boolean {
  return /^\s*fortalecimiento\b:?/i.test(item)
}

function isSpecialStyledLine(item: string): boolean {
  return isNoteLine(item) || isRoundLine(item) || isFortalecimientoLine(item)
}

function isForTimeLine(item: string): boolean {
  return /\bfor\s*time\b/i.test(item)
}

function isRpeLine(item: string): boolean {
  return /^\s*rpe\b/i.test(item)
}

/** Borde inferior entre líneas dentro de una sola columna. */
function exerciseGridItemBottomBorderClasses(
  index: number,
  total: number,
  item?: string,
  nextItem?: string,
  ctx?: { isFirstItem?: boolean; compactFirstItemTopSpacing?: boolean }
): string {
  if (total <= 0) return ''
  const basePad = 'py-2 sm:py-3 min-w-0 break-words'
  const basePadCompactFirst = '-mt-0.5 pt-0 pb-2 sm:pt-0 sm:pb-3 min-w-0 break-words'
  const notePad = 'pt-0.5 pb-1.5 sm:pt-1 sm:pb-2 min-w-0 break-words'
  const subtitlePad = 'pt-0 pb-1 sm:pt-0 sm:pb-1.5 min-w-0 break-words'
  const subtitlePadCompactFirst = '-mt-0.5 pt-0 pb-1 sm:pt-0 sm:pb-1.5 min-w-0 break-words'
  const beforeNotePad = 'pt-2 pb-0.5 sm:pt-3 sm:pb-1 min-w-0 break-words'
  /** Surco con relieve: sombra interior + filo claro (modo claro / oscuro). */
  const b =
    'border-b-0 ' +
    'shadow-[inset_0_-2px_0_0_rgba(15,23,42,0.13),inset_0_-1px_0_0_rgba(255,255,255,0.52)] ' +
    'dark:shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.68),inset_0_-1px_0_0_rgba(255,255,255,0.07)]'
  const isCurrentSubtitle = !!item && isSubtitleLine(item, ctx)
  const isCurrentSpecial =
    !!item && (isSpecialStyledLine(item) || (ctx?.isFirstItem && isForTimeLine(item)))
  if (nextItem && isSpecialStyledLine(nextItem)) return `${beforeNotePad} border-b-0`
  if (isCurrentSubtitle) {
    if (ctx?.isFirstItem && ctx.compactFirstItemTopSpacing) {
      return `${subtitlePadCompactFirst} border-b-0`
    }
    return `${subtitlePad} border-b-0`
  }
  if (isCurrentSpecial) return `${notePad} border-b-0`
  if (ctx?.isFirstItem && ctx.compactFirstItemTopSpacing) {
    return index + 1 >= total ? `${basePadCompactFirst} border-b-0` : `${basePadCompactFirst} ${b}`
  }
  return index + 1 >= total ? `${basePad} border-b-0` : `${basePad} ${b}`
}

function splitIntoColumns<T>(items: T[], nCols: 2 | 3): T[][] {
  const cols: T[][] = Array.from({ length: nCols }, () => [])
  for (let i = 0; i < items.length; i++) {
    cols[i % nCols].push(items[i])
  }
  return cols
}

function splitWarmupIntoTwoColumns(items: string[]): string[][] {
  if (items.length < 2) return [items]
  let splitIndex = -1

  for (let i = 0; i < items.length; i++) {
    if (!isRoundLine(items[i])) continue
    if (i === 0) continue
    splitIndex = i
    break
  }

  if (splitIndex <= 0 || splitIndex >= items.length) return [items]
  return [items.slice(0, splitIndex), items.slice(splitIndex)]
}

const EXERCISE_LINE_TEXT =
  'text-[#333] dark:text-gray-200 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.5em]'
const NOTE_LINE_TEXT =
  'text-[#333] dark:text-gray-200 text-[0.95em] sm:text-[1em] md:text-[1.2em] lg:text-[1.7em] font-medium'
const SUBTITLE_LINE_TEXT =
  'text-[#666] dark:text-gray-400 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.5em] font-bold'

/**
 * Mapa de puntos donde se decide la tipografía por línea (y tokens #00FFFF / énfasis).
 *
 * Pipeline unificado: `getLineTextClasses` + `exerciseGridItemBottomBorderClasses` + `renderStyledLineText`.
 * - `ExerciseColumnItems`: listas en columnas (grid 2/3 cols y warmup en dos columnas).
 * - `ExerciseMultiColumnGrid`: modo `single`; modo `twoCol` (lista móvil + columnas desktop);
 *   modo `threeCol` (lista móvil + 2 cols md + 3 cols xl).
 * - `SectionSlide`: METCON con chunks agrupados (`chunk.map` → `<li>`); si no hay grupos,
 *   delega en `ExerciseMultiColumnGrid`; warmup/accesorios/strength vía `ExerciseMultiColumnGrid` / `ExerciseColumnItems`.
 * - `DualSectionSlide`: `<ul>` crossfit y funcional (`crossfitItems` / `functionalItems`).
 *
 * Fuera de ese pipeline (cabeceras fijas, no pasan por getLineTextClasses):
 * - `SectionSlide`: primera línea cuando no es METCON; METCON endurance (`firstLine`, `restLines[0]`);
 *   títulos de bloque (`Crossfit`, `Sollte funcional`, `Endurance`, `block.title`); párrafo solo con `firstLine` si no hay más líneas.
 * - `DualSectionSlide`: textos estáticos "Crossfit" / "Funcional" sobre las listas.
 */
type LineTextContext = {
  isFirstItem?: boolean
}

function isSubtitleLine(item: string, ctx?: LineTextContext): boolean {
  if (ctx?.isFirstItem && isForTimeLine(item)) return true
  if (ctx?.isFirstItem && isRpeLine(item)) return true
  return isRoundLine(item)
}

function getLineTextClasses(item: string, ctx?: LineTextContext): string {
  if (isSubtitleLine(item, ctx)) return SUBTITLE_LINE_TEXT
  if (isNoteLine(item)) return NOTE_LINE_TEXT
  return EXERCISE_LINE_TEXT
}

const HIGHLIGHT_TOKEN_TEXT = 'text-[#00FFFF]'
const EMPHASIS_TOKEN_TEXT = 'text-[#F8F400]'
const LINE_HIGHLIGHT_TOKEN_REGEX =
  /\bRPE\s*\d+(?:\s*-\s*\d+)?\b|\d+(?:[.,]\d+)?%|(?<![A-Za-z])\d+(?:[xX:/+-]\d+)*(?:[%xX:/+-]|:)?(?:["”])?(?![A-Za-z])/gi

/**
 * Parte la línea tras "+ " solo si va seguido de un dígito y el "+" está fuera de paréntesis
 * (p. ej. "5 pull + 5 Muscle"; no "medball + disco"; no "(1 clean + 1 jerk)" dentro del complejo).
 */
function splitExerciseLineAtPlusNumberOutsideParens(line: string): string[] {
  const segments: string[] = []
  let chunkStart = 0
  let depth = 0
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)

    if (
      depth === 0 &&
      c === '+' &&
      line[i + 1] === ' ' &&
      line[i + 2] !== undefined &&
      /\d/.test(line[i + 2])
    ) {
      const splitAfter = i + 2
      segments.push(line.slice(chunkStart, splitAfter))
      chunkStart = splitAfter
      i = splitAfter - 1
    }
  }
  segments.push(line.slice(chunkStart))
  return segments
}

function renderLineHighlightTokens(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const match of line.matchAll(LINE_HIGHLIGHT_TOKEN_REGEX)) {
    const token = match[0]
    const start = match.index ?? -1
    if (start < 0) continue

    if (start > cursor) {
      parts.push(line.slice(cursor, start))
    }

    const isEmphasisToken = /^RPE\s*\d+(?:\s*-\s*\d+)?$/i.test(token) || /%$/.test(token)
    parts.push(
      <span key={`token-${start}`} className={isEmphasisToken ? EMPHASIS_TOKEN_TEXT : HIGHLIGHT_TOKEN_TEXT}>
        {token}
      </span>
    )

    cursor = start + token.length
  }

  if (cursor < line.length) {
    parts.push(line.slice(cursor))
  }

  return <>{parts.length > 0 ? parts : line}</>
}

function renderStyledLineText(
  line: string,
  opts?: {
    highlightTokens?: boolean
  }
): React.ReactNode {
  const segments = splitExerciseLineAtPlusNumberOutsideParens(line)
  if (segments.length <= 1) {
    return opts?.highlightTokens === false ? line : renderLineHighlightTokens(line)
  }
  let segmentStart = 0
  let isFirstSegment = true
  return (
    <>
      {segments.map((seg) => {
        const key = `${segmentStart}:${seg.length}:${line.length}`
        segmentStart += seg.length
        const showBreak = !isFirstSegment
        isFirstSegment = false
        return (
          <Fragment key={key}>
            {showBreak ? <br /> : null}
            {opts?.highlightTokens === false ? seg : renderLineHighlightTokens(seg)}
          </Fragment>
        )
      })}
    </>
  )
}

const COL_BORDER_MD =
  'md:border-l md:border-l-[#9ca3b0] md:dark:border-l-[#3a424c] md:pl-3 ' +
  'md:shadow-[inset_2px_0_0_0_rgba(15,23,42,0.11),inset_1px_0_0_0_rgba(255,255,255,0.48)] ' +
  'md:dark:shadow-[inset_2px_0_0_0_rgba(0,0,0,0.65),inset_1px_0_0_0_rgba(255,255,255,0.06)]'
const COL_BORDER_XL =
  'xl:border-l xl:border-l-[#9ca3b0] xl:dark:border-l-[#3a424c] xl:pl-3 ' +
  'xl:shadow-[inset_2px_0_0_0_rgba(15,23,42,0.11),inset_1px_0_0_0_rgba(255,255,255,0.48)] ' +
  'xl:dark:shadow-[inset_2px_0_0_0_rgba(0,0,0,0.65),inset_1px_0_0_0_rgba(255,255,255,0.06)]'
const COL_BORDER_SM =
  'sm:border-l sm:border-l-[#9ca3b0] sm:dark:border-l-[#3a424c] sm:pl-3 ' +
  'sm:shadow-[inset_2px_0_0_0_rgba(15,23,42,0.11),inset_1px_0_0_0_rgba(255,255,255,0.48)] ' +
  'sm:dark:shadow-[inset_2px_0_0_0_rgba(0,0,0,0.65),inset_1px_0_0_0_rgba(255,255,255,0.06)]'

function ExerciseColumnItems({
  items,
  lineHeight,
  extraLiClass,
  compactFirstItemTopSpacing,
}: {
  items: string[]
  lineHeight: number
  extraLiClass?: (item: string) => string
  compactFirstItemTopSpacing?: boolean
}) {
  const keyCount = new Map<string, number>()
  return (
    <ul className="list-none p-0 m-0 flex flex-col">
      {items.map((item, i) => {
        const occ = (keyCount.get(item) ?? 0) + 1
        keyCount.set(item, occ)
        return (
          <li
            key={`${item}-${occ}`}
            className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1], { isFirstItem: i === 0, compactFirstItemTopSpacing })} ${extraLiClass?.(item) ?? ''}`}
            style={{ lineHeight }}
          >
            {renderStyledLineText(item, {
              highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
            })}
          </li>
        )
      })}
    </ul>
  )
}

function ExerciseMultiColumnGrid({
  items,
  layout,
  lineHeight,
  extraLiClass,
  compactFirstItemTopSpacing,
}: {
  items: string[]
  layout: ExerciseGridLayout
  lineHeight: number
  extraLiClass?: (item: string) => string
  compactFirstItemTopSpacing?: boolean
}) {
  const gapRow = 'mt-2 sm:mt-3 md:mt-4'

  if (layout === 'single') {
    const keyCount = new Map<string, number>()
    return (
      <ul className={`list-none m-0 grid grid-cols-1 gap-y-0 p-0 ${gapRow}`}>
        {items.map((item, i) => {
          const occ = (keyCount.get(item) ?? 0) + 1
          keyCount.set(item, occ)
          return (
            <li
              key={`${item}-${occ}`}
              className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1], { isFirstItem: i === 0, compactFirstItemTopSpacing })} ${extraLiClass?.(item) ?? ''}`}
              style={{ lineHeight }}
            >
              {renderStyledLineText(item, {
                highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
              })}
            </li>
          )
        })}
      </ul>
    )
  }

  const col2 = splitIntoColumns(items, 2)

  if (layout === 'twoCol') {
    const mobileKeyCount = new Map<string, number>()
    return (
      <>
        <ul className={`list-none m-0 flex flex-col p-0 md:hidden ${gapRow}`}>
          {items.map((item, i) => {
            const occ = (mobileKeyCount.get(item) ?? 0) + 1
            mobileKeyCount.set(item, occ)
            return (
              <li
                key={`${item}-${occ}`}
                className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1], { isFirstItem: i === 0, compactFirstItemTopSpacing })} ${extraLiClass?.(item) ?? ''}`}
                style={{ lineHeight }}
              >
                {renderStyledLineText(item, {
                  highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
                })}
              </li>
            )
          })}
        </ul>
        <div
          className={`hidden md:flex md:flex-row md:items-stretch gap-x-3 sm:gap-x-4 md:gap-x-6 ${gapRow}`}
        >
          <div className="min-w-0 flex-1">
            <ExerciseColumnItems
              items={col2[0]}
              lineHeight={lineHeight}
              extraLiClass={extraLiClass}
              compactFirstItemTopSpacing={compactFirstItemTopSpacing}
            />
          </div>
          <div className={`min-w-0 flex-1 ${COL_BORDER_MD}`}>
            <ExerciseColumnItems
              items={col2[1]}
              lineHeight={lineHeight}
              extraLiClass={extraLiClass}
              compactFirstItemTopSpacing={compactFirstItemTopSpacing}
            />
          </div>
        </div>
      </>
    )
  }

  const col3 = splitIntoColumns(items, 3)
  const mobileKeyCount = new Map<string, number>()
  return (
    <>
      <ul className={`list-none m-0 flex flex-col p-0 md:hidden ${gapRow}`}>
        {items.map((item, i) => {
          const occ = (mobileKeyCount.get(item) ?? 0) + 1
          mobileKeyCount.set(item, occ)
          return (
            <li
              key={`${item}-${occ}`}
              className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1], { isFirstItem: i === 0, compactFirstItemTopSpacing })} ${extraLiClass?.(item) ?? ''}`}
              style={{ lineHeight }}
            >
              {renderStyledLineText(item, {
                highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
              })}
            </li>
          )
        })}
      </ul>
      <div
        className={`hidden md:flex xl:hidden md:flex-row md:items-stretch gap-x-3 sm:gap-x-4 md:gap-x-6 ${gapRow}`}
      >
        <div className="min-w-0 flex-1">
          <ExerciseColumnItems
            items={col2[0]}
            lineHeight={lineHeight}
            extraLiClass={extraLiClass}
            compactFirstItemTopSpacing={compactFirstItemTopSpacing}
          />
        </div>
        <div className={`min-w-0 flex-1 ${COL_BORDER_MD}`}>
          <ExerciseColumnItems
            items={col2[1]}
            lineHeight={lineHeight}
            extraLiClass={extraLiClass}
            compactFirstItemTopSpacing={compactFirstItemTopSpacing}
          />
        </div>
      </div>
      <div
        className={`hidden xl:flex xl:flex-row xl:items-stretch gap-x-3 sm:gap-x-4 md:gap-x-6 ${gapRow}`}
      >
        {col3.map((col, ci) => (
          <div
            key={`${col.join('|')}-${col.length}`}
            className={`min-w-0 flex-1 ${ci > 0 ? COL_BORDER_XL : ''}`}
          >
            <ExerciseColumnItems
              items={col}
              lineHeight={lineHeight}
              extraLiClass={extraLiClass}
              compactFirstItemTopSpacing={compactFirstItemTopSpacing}
            />
          </div>
        ))}
      </div>
    </>
  )
}

const LINE_HEIGHT_MIN = 1
const LINE_HEIGHT_MAX = 2
const LINE_HEIGHT_STEP = 0.1
const LINE_HEIGHT_DEFAULT = 1.2
const STORAGE_KEY_LINE_HEIGHT = 'dashboard-line-height'

const CARD_SCALE_MIN = 0.5
const CARD_SCALE_MAX = 2
const CARD_SCALE_STEP = 0.05
const CARD_SCALE_DEFAULT = 1
const STORAGE_KEY_CARD_SCALE = 'dashboard-card-scale'

const FONT_SIZE_MIN = 0.75
const FONT_SIZE_MAX = 1.5
const FONT_SIZE_STEP = 0.125
const FONT_SIZE_DEFAULT = 1
const STORAGE_KEY_FONT_SIZE = 'dashboard-font-size'

const STORAGE_KEY_DENSE_LINE_HEIGHT = 'dashboard-dense-line-height'
const STORAGE_KEY_DENSE_CARD_SCALE = 'dashboard-dense-card-scale'
const STORAGE_KEY_DENSE_FONT_SIZE = 'dashboard-dense-font-size'

const STORAGE_KEY_DISPLAY_MODE = 'dashboard-display-mode'

type DashboardDisplayMode = 'tv' | 'control'

/** Tarjetas de contenido (WOD): volumen con gradiente de luz + sombras en capas (especialmente visibles en TV / oscuro). */
const dashboardSectionCardClassName =
  'rounded-xl sm:rounded-2xl border border-[#9a9aa8]/90 dark:border-gray-400/30 ' +
  'bg-gradient-to-br from-white via-[#fafbfc] to-[#e6e8ed] ' +
  'dark:bg-gradient-to-br dark:from-[#4a4a4a] dark:via-[#383838] dark:to-[#262626] ' +
  'shadow-[inset_0_2px_0_0_rgba(255,255,255,0.75),inset_0_-2px_4px_rgba(15,23,42,0.04),0_2px_4px_-1px_rgba(15,23,42,0.07),0_10px_22px_-6px_rgba(15,23,42,0.11),0_22px_48px_-14px_rgba(15,23,42,0.13)] ' +
  'dark:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.16),inset_0_-6px_14px_rgba(0,0,0,0.42),0_6px_12px_-2px_rgba(0,0,0,0.55),0_16px_36px_-8px_rgba(0,0,0,0.62),0_32px_64px_-16px_rgba(0,0,0,0.5)]'

/** Franja vertical (WARM UP, METCON…): bisel y separación respecto al cuerpo de la tarjeta. */
const dashboardSectionLabelStripClassName =
  'bg-gradient-to-b from-[#2a2a2a] via-black to-[#0a0a0a] ' +
  'border-r border-white/[0.1] dark:border-white/[0.05] ' +
  'shadow-[inset_2px_0_6px_rgba(255,255,255,0.1),inset_-6px_0_16px_rgba(0,0,0,0.55)]'

const dashboardControlMainCardClassName = dashboardSectionCardClassName
  .replace('rounded-xl sm:rounded-2xl', 'rounded-2xl')

/** Paneles flotantes del modo control: relieve acorde a las tarjetas de sección. */
const dashboardControlPanel3dClassName =
  'rounded-xl border border-gray-200/90 dark:border-gray-400/30 ' +
  'bg-gradient-to-br from-white via-[#fafbfc] to-[#e8eaef] ' +
  'dark:bg-gradient-to-br dark:from-[#454545] dark:via-[#3a3a3a] dark:to-[#2c2c2c] ' +
  'shadow-[inset_0_2px_0_0_rgba(255,255,255,0.7),0_2px_6px_-1px_rgba(15,23,42,0.08),0_12px_28px_-8px_rgba(15,23,42,0.12)] ' +
  'dark:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.12),inset_0_-4px_10px_rgba(0,0,0,0.35),0_6px_14px_-2px_rgba(0,0,0,0.5),0_18px_40px_-10px_rgba(0,0,0,0.48)]'

const dashboardControlPanel3dBlueClassName =
  'rounded-xl border border-blue-200/95 dark:border-blue-800/90 ' +
  'bg-gradient-to-br from-white via-[#f8faff] to-[#e8ecf5] ' +
  'dark:bg-gradient-to-br dark:from-[#404858] dark:via-[#353d4d] dark:to-[#2a3140] ' +
  'shadow-[inset_0_2px_0_0_rgba(255,255,255,0.7),0_2px_6px_-1px_rgba(30,58,138,0.08),0_12px_28px_-8px_rgba(15,23,42,0.12)] ' +
  'dark:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.11),inset_0_-4px_10px_rgba(0,0,0,0.38),0_6px_14px_-2px_rgba(0,0,0,0.52),0_18px_40px_-10px_rgba(0,0,0,0.5)]'

function nearlyEqualSessionNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function getCardWidthPercent(opts: {
  cardScale: number
  lineHeight: number
  fontSizeScale: number
  dual?: boolean
}): number {
  const { lineHeight, fontSizeScale, dual = false } = opts
  // El ajuste de ancho depende del contenido tipográfico.
  const fitFactor = Math.max(fontSizeScale, lineHeight / LINE_HEIGHT_DEFAULT)
  const base = dual ? 98 : 96
  const computed = base / Math.max(0.6, fitFactor)
  return clamp(computed, dual ? 66 : 58, 98)
}

function SectionSlide({
  label,
  lines,
  lineHeight = LINE_HEIGHT_DEFAULT,
  fontSize = FONT_SIZE_DEFAULT,
  className = '',
  hideVerticalLabel = false,
}: {
  label: string
  lines: string[]
  lineHeight?: number
  fontSize?: number
  className?: string
  /** Cuando hay dos columnas, el título va en {@link DualColumnSectionHeader} y no en la franja. */
  hideVerticalLabel?: boolean
}) {
  const items = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•-]\s*/, ''))
  if (items.length === 0) return null
  const firstLine = items[0]
  const restLines = items.slice(1)
  const isMetcon = label.toUpperCase().startsWith('METCON')
  const isWarmup = label.toUpperCase().startsWith('WARM')
  const isAccesorios = label.toUpperCase().startsWith('ACCESORIOS')
  const isFuerza = label === 'STRENGTH'
  const blocks = buildBlocks(restLines)
  const isEnduranceSection =
    isMetcon &&
    (/\bEndurance\b/i.test(firstLine) ||
      (blocks.length === 1 && blocks[0].title === BLOCK_TITLE_ENDURANCE))

  return (
    <div
      className={`flex overflow-hidden ${dashboardSectionCardClassName} min-h-0 max-w-[96%] mx-auto ${isWarmup ? 'sm:max-w-4xl' : ''} ${isEnduranceSection ? 'sm:max-w-5xl' : ''} ${className}`}
    >
      {!hideVerticalLabel && (
        <div
          className={`flex flex-shrink-0 self-stretch w-10 sm:w-14 md:w-20 lg:w-24 min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[5rem] lg:min-w-24 items-center justify-center py-2 sm:py-3 md:py-4 px-1 sm:px-2 md:px-3 text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold uppercase tracking-wider ${dashboardSectionLabelStripClassName}`}
          style={labelStripStyle}
        >
          {label}
        </div>
      )}
      <div
        className={`flex-1 min-h-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-y-auto flex flex-col ${hideVerticalLabel ? '' : `border-l ${isMetcon ? 'border-black dark:border-gray-800' : 'border-[#c8c8c8] dark:border-gray-800'}`}`}
        style={{ fontSize: `${fontSize}rem` }}
      >
        {restLines.length > 0 ? (
          <>
            {!isMetcon && (
              <p
                className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                  isAccesorios ? 'mb-0 leading-tight' : 'mb-2 sm:mb-3 md:mb-4'
                }`}
              >
                {firstLine}
              </p>
            )}
            {isMetcon ? (
              <>
                {isEnduranceSection ? (
                  <div className="mb-2 sm:mb-3 md:mb-4">
                    <p
                      className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                        restLines[0] && isSubtitleLine(restLines[0], { isFirstItem: true })
                          ? 'mb-0 leading-tight'
                          : ''
                      }`}
                    >
                      {firstLine}
                    </p>
                    {restLines[0] && (
                      <p className="text-[#666] dark:text-gray-400 text-[0.95em] sm:text-[1em] md:text-[1.25em] lg:text-[1.75em] -mt-0.5 leading-tight font-medium">
                        {restLines[0]}
                      </p>
                    )}
                  </div>
                ) : (
                  blocks.map((block) => {
                    const isSollteBlock = block.title === 'Sollte funcional'
                    const isEnduranceBlock = block.title === BLOCK_TITLE_ENDURANCE
                    const titleLine =
                      isSollteBlock && block.lines.length > 0
                        ? block.lines[0]
                        : isEnduranceBlock && block.lines.length > 0
                          ? block.lines[0]
                          : firstLine
                    if (block.title === 'Crossfit' || block.title === null) {
                      const hasSubtitleTitleLine = isSubtitleLine(firstLine, { isFirstItem: true })
                      return (
                        <div
                          key={`${block.title ?? 'Crossfit'}-${titleLine}`}
                          className="mb-2 sm:mb-3 md:mb-4"
                        >
                          <p
                            className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                              hasSubtitleTitleLine ? 'mb-0 leading-tight' : ''
                            }`}
                          >
                            Crossfit
                          </p>
                          <p className="text-[#333] dark:text-gray-200 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.25em] -mt-0.5 leading-tight">
                            {firstLine}
                          </p>
                        </div>
                      )
                    }
                    if (block.title === 'Sollte funcional') {
                      const hasSubtitleTitleLine = isSubtitleLine(titleLine, { isFirstItem: true })
                      return (
                        <div
                          key={`${block.title ?? 'Sollte funcional'}-${titleLine}`}
                          className="mb-2 sm:mb-3 md:mb-4"
                        >
                          <p
                            className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                              hasSubtitleTitleLine ? 'mb-0 leading-tight' : ''
                            }`}
                          >
                            Sollte funcional
                          </p>
                          <p className="text-[#333] dark:text-gray-200 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.25em] -mt-0.5 leading-tight">
                            {titleLine}
                          </p>
                        </div>
                      )
                    }
                    if (isEnduranceBlock) {
                      return (
                        <div
                          key={`${block.title ?? BLOCK_TITLE_ENDURANCE}-${titleLine}`}
                          className="mb-2 sm:mb-3 md:mb-4"
                        >
                          <p className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
                            {titleLine}
                          </p>
                        </div>
                      )
                    }
                    if (block.title) {
                      return (
                        <p
                          key={`${block.title}-${block.lines.join('|')}`}
                          className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] mb-1 sm:mb-2"
                        >
                          {block.title}
                        </p>
                      )
                    }
                    return null
                  })
                )}
                {(() => {
                  const allListLines = isEnduranceSection
                    ? restLines.slice(1)
                    : blocks.flatMap((block) => {
                        const isSollteBlock = block.title === 'Sollte funcional'
                        const isEnduranceBlock = block.title === BLOCK_TITLE_ENDURANCE
                        if (isSollteBlock && block.lines.length > 0) return block.lines.slice(1)
                        if (isEnduranceBlock && block.lines.length > 0) return block.lines.slice(1)
                        return block.lines
                      })
                  const useGroupsOfFour =
                    !isEnduranceSection && allListLines.length >= 4 && allListLines.length % 4 === 0
                  const useGroupsOfThree =
                    !useGroupsOfFour &&
                    !isEnduranceSection &&
                    allListLines.length >= 3 &&
                    allListLines.length % 3 === 0
                  const groupSize = useGroupsOfFour ? 4 : useGroupsOfThree ? 3 : 0
                  const chunks =
                    groupSize > 0
                      ? Array.from({ length: allListLines.length / groupSize }, (_, i) =>
                          allListLines.slice(i * groupSize, i * groupSize + groupSize)
                        )
                      : [allListLines]
                  const useGrouped = useGroupsOfFour || useGroupsOfThree
                  const gridLayout = getExerciseGridLayout(allListLines.length, {
                    isEnduranceSection,
                    isFuerza,
                    isWarmup: false,
                  })
                  return useGrouped ? (
                    <div
                      className="grid gap-x-4 sm:gap-x-6 md:gap-x-8 gap-y-4 sm:gap-y-6 mt-2 sm:mt-3 md:mt-4"
                      style={{
                        gridTemplateColumns: `repeat(${chunks.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {chunks.map((chunk) => {
                        const keyCount = new Map<string, number>()
                        return (
                        <ul
                          key={`${chunk.join('|')}-${chunk.length}`}
                          className="list-none p-0 m-0 flex flex-col"
                        >
                          {chunk.map((item, i) => {
                            const occ = (keyCount.get(item) ?? 0) + 1
                            keyCount.set(item, occ)
                            return (
                              <li
                                key={`${item}-${occ}`}
                                className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, chunk.length, item, chunk[i + 1], { isFirstItem: i === 0 })} ${i === 0 ? 'font-bold' : ''}`}
                                style={{ lineHeight: lineHeight }}
                              >
                                {renderStyledLineText(item, {
                                  highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
                                })}
                              </li>
                            )
                          })}
                        </ul>
                        )
                      })}
                    </div>
                  ) : (
                    <ExerciseMultiColumnGrid
                      items={allListLines}
                      layout={gridLayout}
                      lineHeight={lineHeight}
                    />
                  )
                })()}
              </>
            ) : (
              blocks.map((block, bi) => {
                const listLines = block.lines
                const hasSubtitleFirstListItem =
                  listLines.length > 0 && isSubtitleLine(listLines[0], { isFirstItem: true })
                const warmupColumns = isWarmup ? splitWarmupIntoTwoColumns(listLines) : [listLines]
                const listGridLayout = getExerciseGridLayout(listLines.length, {
                  isEnduranceSection: false,
                  isFuerza,
                  isWarmup,
                })
                return (
                  <div
                    key={`${block.title ?? 'block'}-${listLines.join('|')}`}
                    className={bi > 0 ? (isAccesorios ? 'mt-1 sm:mt-1.5 md:mt-2' : 'mt-2 sm:mt-3 md:mt-4') : ''}
                  >
                    {block.title && (
                      <p
                        className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                          isAccesorios
                            ? 'mb-0 leading-tight'
                            : hasSubtitleFirstListItem
                              ? 'mb-0 leading-tight'
                              : 'mb-1 sm:mb-2'
                        }`}
                      >
                        {block.title}
                      </p>
                    )}
                    {listLines.length > 0 && (
                      warmupColumns.length > 1 ? (
                        <>
                          <div className="sm:hidden">
                            <ExerciseMultiColumnGrid
                              items={listLines}
                              layout="single"
                              lineHeight={lineHeight}
                              compactFirstItemTopSpacing={isAccesorios}
                            />
                          </div>
                          <div className="hidden sm:grid sm:grid-cols-2 sm:gap-x-6 mt-2 sm:mt-3 md:mt-4">
                            {warmupColumns.map((columnItems, colIdx) => (
                              <div
                                key={`${block.title ?? 'warmup'}-${columnItems[0] ?? 'empty'}-${columnItems.length}`}
                                className={colIdx > 0 ? COL_BORDER_SM : ''}
                              >
                                <ExerciseColumnItems
                                  items={columnItems}
                                  lineHeight={lineHeight}
                                  compactFirstItemTopSpacing={isAccesorios}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <ExerciseMultiColumnGrid
                          items={listLines}
                          layout={listGridLayout}
                          lineHeight={lineHeight}
                          compactFirstItemTopSpacing={isAccesorios}
                        />
                      )
                    )}
                  </div>
                )
              })
            )}
          </>
        ) : (
          <p className="text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
            {firstLine}
          </p>
        )}
      </div>
    </div>
  )
}

function DualSectionSlide({
  label,
  crossfitLines,
  functionalLines,
  lineHeight = LINE_HEIGHT_DEFAULT,
  fontSize = FONT_SIZE_DEFAULT,
  className = '',
}: {
  label: string
  crossfitLines: string[]
  functionalLines: string[]
  lineHeight?: number
  fontSize?: number
  className?: string
}) {
  const crossfitItems = crossfitLines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•-]\s*/, ''))
  const functionalItems = functionalLines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•-]\s*/, ''))
  const hasCrossfitSubtitleFirstItem =
    crossfitItems.length > 0 && isSubtitleLine(crossfitItems[0], { isFirstItem: true })
  const hasFunctionalSubtitleFirstItem =
    functionalItems.length > 0 && isSubtitleLine(functionalItems[0], { isFirstItem: true })

  if (crossfitItems.length === 0 && functionalItems.length === 0) return null
  const crossfitKeyCount = new Map<string, number>()
  const functionalKeyCount = new Map<string, number>()

  return (
    <div
      className={`mx-auto flex w-full max-w-[96%] min-h-0 flex-col gap-2 sm:gap-3 md:gap-4 ${className}`}
    >
      <DualColumnSectionHeader label={label} />
      <div className="flex min-h-0 flex-1 items-stretch gap-2 sm:gap-3 md:gap-4">
      {crossfitItems.length > 0 && (
        <div
          className={`flex min-h-0 min-w-0 flex-1 self-stretch overflow-hidden ${dashboardSectionCardClassName}`}
        >
          <div
            className="flex min-h-0 flex-1 flex-col justify-start p-3 sm:p-4 md:p-5 lg:p-6"
            style={{ fontSize: `${fontSize}rem` }}
          >
            <p
              className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                hasCrossfitSubtitleFirstItem ? 'mb-0 leading-tight' : 'mb-2 sm:mb-3 md:mb-4'
              }`}
            >
              Crossfit
            </p>
            <ul className="list-none p-0 m-0 flex flex-col">
              {crossfitItems.map((item, i) => (
                (() => {
                  const occ = (crossfitKeyCount.get(item) ?? 0) + 1
                  crossfitKeyCount.set(item, occ)
                  return (
                    <li
                      key={`${item}-${occ}`}
                      className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, crossfitItems.length, item, crossfitItems[i + 1], { isFirstItem: i === 0 })}`}
                      style={{ lineHeight: lineHeight }}
                    >
                      {renderStyledLineText(item, {
                        highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
                      })}
                    </li>
                  )
                })()
              ))}
            </ul>
          </div>
        </div>
      )}
      {functionalItems.length > 0 && (
        <div
          className={`flex min-h-0 min-w-0 flex-1 self-stretch overflow-hidden ${dashboardSectionCardClassName}`}
        >
          <div
            className="flex min-h-0 flex-1 flex-col justify-start p-3 sm:p-4 md:p-5 lg:p-6"
            style={{ fontSize: `${fontSize}rem` }}
          >
            <p
              className={`font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] ${
                hasFunctionalSubtitleFirstItem ? 'mb-0 leading-tight' : 'mb-2 sm:mb-3 md:mb-4'
              }`}
            >
              Funcional
            </p>
            <ul className="list-none p-0 m-0 flex flex-col">
              {functionalItems.map((item, i) => (
                (() => {
                  const occ = (functionalKeyCount.get(item) ?? 0) + 1
                  functionalKeyCount.set(item, occ)
                  return (
                    <li
                      key={`${item}-${occ}`}
                      className={`${getLineTextClasses(item, { isFirstItem: i === 0 })} ${exerciseGridItemBottomBorderClasses(i, functionalItems.length, item, functionalItems[i + 1], { isFirstItem: i === 0 })}`}
                      style={{ lineHeight: lineHeight }}
                    >
                      {renderStyledLineText(item, {
                        highlightTokens: !isSubtitleLine(item, { isFirstItem: i === 0 }),
                      })}
                    </li>
                  )
                })()
              ))}
            </ul>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

type WodSection =
  | { type: 'header'; title: string; description: string }
  | { type: 'section'; label: string; lines: string[] }
  | { type: 'dual-section'; label: string; crossfitLines: string[]; functionalLines: string[] }

type CarouselSlideSection = Extract<WodSection, { type: 'section' | 'dual-section' }>

/**
 * Líneas no vacías: solo para STRENGTH / METCON, a partir de aquí en TV se fijan interlineado, fuente y escala.
 * Dual: máximo por columna. Warm up, accesorios, etc. no aplican umbral (siempre usan sliders).
 */
const DENSE_SECTION_LINE_THRESHOLD = 8
const DENSE_LINE_HEIGHT_DEFAULT = 1.05
const DENSE_FONT_SIZE_DEFAULT = 0.875
const DENSE_CARD_SCALE_DEFAULT = 0.6

function isTvDenseLayoutSection(slide: CarouselSlideSection): boolean {
  const u = slide.label.toUpperCase()
  return slide.label === 'STRENGTH' || u.startsWith('METCON')
}

function countSectionLinesForDensity(slide: CarouselSlideSection): number {
  if (slide.type === 'dual-section') {
    const cf = slide.crossfitLines.filter((l) => l.trim()).length
    const fn = slide.functionalLines.filter((l) => l.trim()).length
    return Math.max(cf, fn)
  }
  return slide.lines.filter((l) => l.trim()).length
}

function resolveTvSlideDensityLayout(
  slide: CarouselSlideSection,
  userLineHeight: number,
  userFontSize: number,
  userCardScale: number,
  denseLineHeight: number,
  denseFontSize: number,
  denseCardScale: number
): { lineHeight: number; fontSize: number; cardScale: number } {
  if (
    !isTvDenseLayoutSection(slide) ||
    countSectionLinesForDensity(slide) < DENSE_SECTION_LINE_THRESHOLD
  ) {
    return {
      lineHeight: userLineHeight,
      fontSize: userFontSize,
      cardScale: userCardScale,
    }
  }
  return {
    lineHeight: denseLineHeight,
    fontSize: denseFontSize,
    cardScale: denseCardScale,
  }
}

function getSections(wod: WodDoc | undefined): WodSection[] {
  if (!wod) return []
  const title = wod.title || 'WOD'
  const description = wod.description || ''
  const warmup = wod.warmup || wod.warmUp || ''

  let strength = ''
  let functionalStrength = ''

  if (typeof wod.strength === 'string') {
    strength = wod.strength
    functionalStrength =
      typeof wod.functionalDescription === 'string' ? wod.functionalDescription : ''
  } else if (typeof wod.strength === 'object' && wod.strength !== null) {
    strength = typeof wod.strength.description === 'string' ? wod.strength.description : ''
    functionalStrength =
      typeof wod.strength.functionalDescription === 'string'
        ? wod.strength.functionalDescription
        : ''
  }

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

  const hasBothStrength = strength.trim() && functionalStrength.trim()
  if (hasBothStrength) {
    sections.push({
      type: 'dual-section',
      label: 'STRENGTH',
      crossfitLines: strength.split('\n').filter((l) => l.trim()),
      functionalLines: functionalStrength.split('\n').filter((l) => l.trim()),
    })
  } else if (strength.trim()) {
    sections.push({
      type: 'section',
      label: 'STRENGTH',
      lines: strength.split('\n').filter((l) => l.trim()),
    })
  } else if (functionalStrength.trim()) {
    sections.push({
      type: 'section',
      label: 'STRENGTH',
      lines: functionalStrength.split('\n').filter((l) => l.trim()),
    })
  }

  metcoes.forEach((metcon, index) => {
    const descRaw = metcon?.description || ''
    const desc = typeof descRaw === 'string' ? descRaw : ''
    const funcDescRaw = metcon?.functionalDescription || ''
    const funcDesc = typeof funcDescRaw === 'string' ? funcDescRaw : ''

    const hasBothMetcon = desc.trim() && funcDesc.trim()

    if (hasBothMetcon) {
      sections.push({
        type: 'dual-section',
        label: `METCON ${index + 1}`,
        crossfitLines: desc.split('\n').filter((l) => l.trim()),
        functionalLines: funcDesc.split('\n').filter((l) => l.trim()),
      })
    } else if (desc.trim()) {
      const lines = desc.split('\n').filter((l) => l.trim())
      if (lines.length > 0) {
        sections.push({
          type: 'section',
          label: `METCON ${index + 1}`,
          lines,
        })
      }
    } else if (funcDesc.trim()) {
      const lines = funcDesc.split('\n').filter((l) => l.trim())
      if (lines.length > 0) {
        sections.push({
          type: 'section',
          label: `METCON ${index + 1}`,
          lines,
        })
      }
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

const SEDE_MAESTRA = 'SedeMaestra'

function filterWodsByDate(wods: WodDoc[], date: Date): WodDoc[] {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return wods.filter((wod) => {
    const d = wod.wodDate
    if (!d) return false
    const wodDate = new Date(d)
    wodDate.setHours(0, 0, 0, 0)
    return wodDate.getTime() === target.getTime()
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [allWods, setAllWods] = useState<WodDoc[]>([])
  const [adminHeadquarter, setAdminHeadquarter] = useState<string | null>(null)
  const [selectedWodDate, setSelectedWodDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [showControls, setShowControls] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [dateLabel, setDateLabel] = useState({
    weekday: '',
    datePart: '',
    full: '',
  })
  const [lineHeightList, setLineHeightList] = useState(LINE_HEIGHT_DEFAULT)
  const [cardScale, setCardScale] = useState(CARD_SCALE_DEFAULT)
  const [fontSizeScale, setFontSizeScale] = useState(FONT_SIZE_DEFAULT)
  const [denseLineHeight, setDenseLineHeight] = useState(DENSE_LINE_HEIGHT_DEFAULT)
  const [denseCardScale, setDenseCardScale] = useState(DENSE_CARD_SCALE_DEFAULT)
  const [denseFontSize, setDenseFontSize] = useState(DENSE_FONT_SIZE_DEFAULT)
  const hideControlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [displayMode, setDisplayMode] = useState<DashboardDisplayMode>('tv')
  const [showLongContentHintModal, setShowLongContentHintModal] = useState(false)
  const [sessionUid, setSessionUid] = useState<string | null>(null)
  const [sessionPresencePeers, setSessionPresencePeers] = useState<SessionPresencePeer[]>([])
  const sessionDeviceIdRef = useRef('')
  const displayModeRef = useRef<DashboardDisplayMode>('tv')
  const applyingRemoteRef = useRef(false)
  const controlNamesStripRef = useRef<HTMLDivElement>(null)
  const controlStripSkipSyncRef = useRef(false)
  const controlNamesScrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestSessionStateRef = useRef({
    currentIndex: 0,
    isPaused: true,
    lineHeightList: LINE_HEIGHT_DEFAULT,
    cardScale: CARD_SCALE_DEFAULT,
    fontSizeScale: FONT_SIZE_DEFAULT,
    denseLineHeight: DENSE_LINE_HEIGHT_DEFAULT,
    denseCardScale: DENSE_CARD_SCALE_DEFAULT,
    denseFontSize: DENSE_FONT_SIZE_DEFAULT,
  })
  const lenRef = useRef(0)
  const useInfiniteRef = useRef(false)
  const hadAuthenticatedSessionRef = useRef(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DISPLAY_MODE)
      if (stored === 'tv' || stored === 'control') setDisplayMode(stored)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DISPLAY_MODE, displayMode)
    } catch {
      // ignore
    }
  }, [displayMode])

  displayModeRef.current = displayMode

  useEffect(() => {
    if (!sessionUid) {
      setSessionPresencePeers([])
      return
    }
    return subscribeSessionPresence(sessionUid, setSessionPresencePeers)
  }, [sessionUid])

  useEffect(() => {
    if (!sessionUid) return
    sessionDeviceIdRef.current = getOrCreateSessionDeviceId()
    return registerSessionPresenceHeartbeat(
      sessionUid,
      () => sessionDeviceIdRef.current,
      () => displayModeRef.current
    )
  }, [sessionUid])

  useEffect(() => {
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
      const storedFont = localStorage.getItem(STORAGE_KEY_FONT_SIZE)
      if (storedFont !== null) {
        const f = parseFloat(storedFont)
        if (!Number.isNaN(f) && f >= FONT_SIZE_MIN && f <= FONT_SIZE_MAX) setFontSizeScale(f)
      }
      const storedDenseLine = localStorage.getItem(STORAGE_KEY_DENSE_LINE_HEIGHT)
      if (storedDenseLine !== null) {
        const n = parseFloat(storedDenseLine)
        if (!Number.isNaN(n) && n >= LINE_HEIGHT_MIN && n <= LINE_HEIGHT_MAX) setDenseLineHeight(n)
      }
      const storedDenseScale = localStorage.getItem(STORAGE_KEY_DENSE_CARD_SCALE)
      if (storedDenseScale !== null) {
        const s = parseFloat(storedDenseScale)
        if (!Number.isNaN(s) && s >= CARD_SCALE_MIN && s <= CARD_SCALE_MAX) setDenseCardScale(s)
      }
      const storedDenseFont = localStorage.getItem(STORAGE_KEY_DENSE_FONT_SIZE)
      if (storedDenseFont !== null) {
        const f = parseFloat(storedDenseFont)
        if (!Number.isNaN(f) && f >= FONT_SIZE_MIN && f <= FONT_SIZE_MAX) setDenseFontSize(f)
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
    try {
      localStorage.setItem(STORAGE_KEY_FONT_SIZE, String(fontSizeScale))
    } catch {
      // ignore
    }
  }, [fontSizeScale])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DENSE_LINE_HEIGHT, String(denseLineHeight))
    } catch {
      // ignore
    }
  }, [denseLineHeight])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DENSE_CARD_SCALE, String(denseCardScale))
    } catch {
      // ignore
    }
  }, [denseCardScale])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DENSE_FONT_SIZE, String(denseFontSize))
    } catch {
      // ignore
    }
  }, [denseFontSize])

  const isSedeMaestra = adminHeadquarter === SEDE_MAESTRA

  const { wods, showFallbackMessage, noWodForSelectedDate } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (isSedeMaestra) {
      const forDate = filterWodsByDate(allWods, selectedWodDate)
      return {
        wods: forDate,
        showFallbackMessage: false,
        noWodForSelectedDate: allWods.length > 0 && forDate.length === 0,
      }
    }
    const todayWods = filterWodsByDate(allWods, today)
    const toShow = todayWods.length > 0 ? todayWods : allWods.length > 0 ? allWods.slice(0, 5) : []
    return {
      wods: toShow,
      showFallbackMessage: todayWods.length === 0 && allWods.length > 0,
      noWodForSelectedDate: false,
    }
  }, [allWods, selectedWodDate, isSedeMaestra])

  const currentWod = wods[0]
  const sections = getSections(currentWod)
  const carouselSections = sections.filter(
    (s): s is Extract<WodSection, { type: 'section' | 'dual-section' }> =>
      s.type === 'section' || s.type === 'dual-section'
  )
  const hasLongMetconOrStrengthSections = carouselSections.some(
    (slide) =>
      isTvDenseLayoutSection(slide) && countSectionLinesForDensity(slide) >= DENSE_SECTION_LINE_THRESHOLD
  )
  const sectionsLengthRef = useRef(carouselSections.length)
  const currentIndexRef = useRef(0)
  sectionsLengthRef.current = carouselSections.length
  currentIndexRef.current = currentIndex
  const len = carouselSections.length
  const useInfinite = len > 1
  lenRef.current = len
  useInfiniteRef.current = useInfinite

  latestSessionStateRef.current = {
    currentIndex,
    isPaused,
    lineHeightList,
    cardScale,
    fontSizeScale,
    denseLineHeight,
    denseCardScale,
    denseFontSize,
  }

  const slidesToRender = useMemo(() => {
    const baseSlides = useInfinite ? [...carouselSections, carouselSections[0]] : carouselSections
    const keyCount = new Map<string, number>()
    return baseSlides.map((slideSection) => {
      const seed =
        slideSection.type === 'section'
          ? `section|${slideSection.label}|${slideSection.lines.join('|')}`
          : `dual|${slideSection.label}|${slideSection.crossfitLines.join('|')}|${slideSection.functionalLines.join('|')}`
      const count = (keyCount.get(seed) ?? 0) + 1
      keyCount.set(seed, count)
      return { ...slideSection, renderKey: `${seed}#${count}` }
    })
  }, [carouselSections, useInfinite])

  const controlNameSlideEntries = useMemo(() => {
    const keyCount = new Map<string, number>()
    return carouselSections.map((slideSection) => {
      const seed =
        slideSection.type === 'section'
          ? `section|${slideSection.label}|${slideSection.lines.join('|')}`
          : `dual|${slideSection.label}|${slideSection.crossfitLines.join('|')}|${slideSection.functionalLines.join('|')}`
      const count = (keyCount.get(seed) ?? 0) + 1
      keyCount.set(seed, count)
      return { slideSection, renderKey: `${seed}#${count}` }
    })
  }, [carouselSections])

  const [skipTransition, setSkipTransition] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        setSessionUid(null)
        const explicitLogout = consumeExplicitLogoutIntent()
        if (explicitLogout || !hadAuthenticatedSessionRef.current) {
          router.replace('/')
          return
        }
        setError(
          'Se bloqueó un cierre de sesión no autorizado. Usa el botón "Cerrar sesión" para finalizar la sesión.'
        )
        return
      }
      try {
        const isAdmin = await checkIsAdmin(user.uid)
        if (!isAdmin) {
          setSessionUid(null)
          await logoutUser()
          router.replace('/?error=no_admin')
          return
        }
      } catch {
        setSessionUid(null)
        router.replace('/')
        return
      }

      hadAuthenticatedSessionRef.current = true
      setSessionUid(user.uid)

      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/wods', {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const payload = (await res.json().catch(() => ({}))) as Partial<WodsApiResponse> & {
          error?: string
        }
        if (!res.ok) {
          throw new Error(payload.error || 'Error al cargar WODs')
        }
        const loadedWods = Array.isArray(payload.wods) ? payload.wods : []

        if (loadedWods.length === 0) {
          setError(
            'No se encontraron WODs en Firestore. Asegúrate de tener documentos en la ruta: /crossfitconnect-app/nuevaVersion/wods/'
          )
          setLoading(false)
          return
        }

        const sorted = [...loadedWods].sort((a, b) => {
          const getTime = (w: WodDoc) => {
            const d = w.wodDate
            if (!d) return 0
            const date = new Date(d)
            return date.getTime()
          }
          return getTime(b) - getTime(a)
        })

        setAllWods(sorted)
        const headquarter = typeof payload.headquarter === 'string' ? payload.headquarter : null
        setAdminHeadquarter(headquarter)
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
    if (displayMode !== 'tv' || isPaused || !useInfinite) return
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
  }, [displayMode, isPaused, useInfinite])

  useEffect(() => {
    if (carouselSections.length > 0) {
      const maxIdx = useInfinite ? carouselSections.length : carouselSections.length - 1
      setCurrentIndex((i) => Math.min(i, maxIdx))
    }
  }, [carouselSections.length, useInfinite])

  useEffect(() => {
    if (!sessionUid) return
    return subscribeControlSession(sessionUid, (data) => {
      if (data == null) return
      const prev = latestSessionStateRef.current
      let delta = false
      const slideCount = lenRef.current
      const infinite = useInfiniteRef.current

      if (data.currentIndex !== undefined) {
        const c = clampSessionCurrentIndex(data.currentIndex, slideCount, infinite)
        if (c !== prev.currentIndex) {
          delta = true
          setCurrentIndex(c)
        }
      }
      if (data.isPaused !== undefined && data.isPaused !== prev.isPaused) {
        delta = true
        setIsPaused(data.isPaused)
      }
      if (
        data.lineHeight !== undefined &&
        !nearlyEqualSessionNumber(data.lineHeight, prev.lineHeightList)
      ) {
        delta = true
        setLineHeightList(data.lineHeight)
      }
      if (
        data.cardScale !== undefined &&
        !nearlyEqualSessionNumber(data.cardScale, prev.cardScale)
      ) {
        delta = true
        setCardScale(data.cardScale)
      }
      if (
        data.fontSize !== undefined &&
        !nearlyEqualSessionNumber(data.fontSize, prev.fontSizeScale)
      ) {
        delta = true
        setFontSizeScale(data.fontSize)
      }
      if (
        data.denseLineHeight !== undefined &&
        !nearlyEqualSessionNumber(data.denseLineHeight, prev.denseLineHeight)
      ) {
        delta = true
        setDenseLineHeight(data.denseLineHeight)
      }
      if (
        data.denseCardScale !== undefined &&
        !nearlyEqualSessionNumber(data.denseCardScale, prev.denseCardScale)
      ) {
        delta = true
        setDenseCardScale(data.denseCardScale)
      }
      if (
        data.denseFontSize !== undefined &&
        !nearlyEqualSessionNumber(data.denseFontSize, prev.denseFontSize)
      ) {
        delta = true
        setDenseFontSize(data.denseFontSize)
      }
      if (delta) applyingRemoteRef.current = true
    })
  }, [sessionUid])

  useEffect(() => {
    if (!sessionUid) return
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }
    void updateControlSession(sessionUid, {
      currentIndex,
      isPaused,
      lineHeight: lineHeightList,
      cardScale,
      fontSize: fontSizeScale,
      denseLineHeight,
      denseCardScale,
      denseFontSize,
    }).catch(() => {
      // permisos Firestore o red; no bloquear UI
    })
  }, [
    sessionUid,
    currentIndex,
    isPaused,
    lineHeightList,
    cardScale,
    fontSizeScale,
    denseLineHeight,
    denseCardScale,
    denseFontSize,
  ])

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
      markExplicitLogoutIntent()
      await logoutUser()
      router.replace('/')
    } catch {
      consumeExplicitLogoutIntent()
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

  const goPrev = useCallback(() => {
    if (!useInfinite) return
    if (currentIndex === 0) {
      setSkipTransition(true)
      setCurrentIndex(len)
    } else {
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex, len, useInfinite])
  const goNext = useCallback(() => {
    if (!useInfinite) return
    if (currentIndex === len) {
      setSkipTransition(true)
      setCurrentIndex(0)
    } else if (currentIndex === len - 1) {
      setCurrentIndex(len)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }, [currentIndex, len, useInfinite])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const locale = 'es-ES'
      setCurrentTime(
        now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
      const dateToShow = isSedeMaestra ? selectedWodDate : now
      const weekday = dateToShow.toLocaleDateString(locale, {
        weekday: 'long',
      })
      const datePart = dateToShow.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      setDateLabel({
        weekday,
        datePart,
        full: `${weekday}, ${datePart}`,
      })
    }
    updateDateTime()
    const id = setInterval(updateDateTime, 1000)
    return () => clearInterval(id)
  }, [isSedeMaestra, selectedWodDate])

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

  const controlsVisible = displayMode === 'control' || showControls

  useEffect(() => {
    if (displayMode === 'control' && hasLongMetconOrStrengthSections) {
      setShowLongContentHintModal(true)
      return
    }
    setShowLongContentHintModal(false)
  }, [displayMode, hasLongMetconOrStrengthSections])

  const controlStripLogicalIndex = useMemo(() => {
    if (len === 0) return 0
    if (useInfinite && currentIndex === len) return 0
    return Math.min(currentIndex, len - 1)
  }, [currentIndex, len, useInfinite])

  const settleControlStripIndex = useCallback(() => {
    const el = controlNamesStripRef.current
    if (!el || len < 2) return
    const w = el.clientWidth
    if (w <= 0) return
    const i = Math.round(el.scrollLeft / w)
    const clamped = Math.max(0, Math.min(len - 1, i))
    setCurrentIndex((prev) => {
      const prevLogical = useInfinite && prev === len ? 0 : Math.min(prev, len - 1)
      if (clamped === prevLogical) return prev
      return clamped
    })
  }, [len, useInfinite])

  const handleControlNamesScroll = useCallback(() => {
    if (controlStripSkipSyncRef.current) return
    if (controlNamesScrollSettleRef.current) clearTimeout(controlNamesScrollSettleRef.current)
    controlNamesScrollSettleRef.current = setTimeout(() => {
      controlNamesScrollSettleRef.current = null
      settleControlStripIndex()
    }, 100)
  }, [settleControlStripIndex])

  useLayoutEffect(() => {
    if (displayMode !== 'control') return
    const el = controlNamesStripRef.current
    if (!el || len < 2) return

    const syncStripScroll = () => {
      const w = el.clientWidth
      if (w <= 0) return
      const target = controlStripLogicalIndex * w
      if (Math.abs(el.scrollLeft - target) <= 2) return
      controlStripSkipSyncRef.current = true
      el.scrollTo({ left: target, behavior: 'instant' })
      requestAnimationFrame(() => {
        controlStripSkipSyncRef.current = false
      })
    }

    syncStripScroll()
    const ro = new ResizeObserver(() => {
      syncStripScroll()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [displayMode, controlStripLogicalIndex, len])

  useEffect(() => {
    return () => {
      if (controlNamesScrollSettleRef.current) clearTimeout(controlNamesScrollSettleRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_50%_32%,#e4ebf5_0%,#f0f2f6_38%,#f5f5f5_65%,#ebebeb_100%)] dark:bg-[radial-gradient(circle_at_50%_28%,#2d3544_0%,#22262e_40%,#1a1a1a_68%,#121212_100%)]">
      <header className="sticky top-0 z-40 shrink-0 border-b border-white/50 py-2 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 bg-gradient-to-b from-white/70 via-white/45 to-white/[0.28] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),0_10px_40px_-12px_rgba(15,23,42,0.18),0_1px_0_0_rgba(255,255,255,0.4)_inset] backdrop-blur-2xl backdrop-saturate-[1.75] dark:border-white/[0.12] dark:from-gray-800/55 dark:via-gray-900/38 dark:to-gray-950/25 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_12px_48px_-16px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center w-full max-w-full sm:max-w-[900px] mx-auto gap-2 sm:gap-4 min-w-0">
          <div className="flex flex-col gap-2 order-2 sm:order-1 min-w-0">
            <p
              className="text-[#333] dark:text-gray-200 text-sm sm:text-base md:text-xl lg:text-2xl font-medium text-center sm:text-left overflow-hidden"
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
            {isSedeMaestra && (
              <label className="flex items-center gap-2 text-[#333] dark:text-gray-200 text-sm sm:text-base">
                <span className="font-medium">Consultar WOD del día:</span>
                <input
                  type="date"
                  value={
                    selectedWodDate.getFullYear() +
                    '-' +
                    String(selectedWodDate.getMonth() + 1).padStart(2, '0') +
                    '-' +
                    String(selectedWodDate.getDate()).padStart(2, '0')
                  }
                  onChange={(e) => {
                    const val = e.target.value
                    if (val) {
                      const d = new Date(`${val}T12:00:00`)
                      d.setHours(0, 0, 0, 0)
                      setSelectedWodDate(d)
                    }
                  }}
                  className="rounded-lg border border-[#d0d0d0] dark:border-gray-500 bg-white dark:bg-[#2a2a2a] text-[#333] dark:text-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </label>
            )}
          </div>
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
          <p className="text-[#333] dark:text-gray-200 text-base sm:text-lg md:text-2xl lg:text-4xl font-medium text-center sm:text-right tabular-nums order-3 min-w-0 overflow-hidden truncate">
            {currentTime}
          </p>
        </div>
      </header>

      {displayMode === 'tv' && (
      <div
        className={`fixed bottom-2 sm:bottom-3 left-2 sm:left-2 z-50 flex flex-row flex-wrap gap-2 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
      >
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dClassName} px-3 py-3 sm:px-3.5 sm:py-3.5 min-w-[150px] sm:min-w-[175px]`}
          aria-label="Tamaño de tarjetas"
        >
          <legend className="text-sm sm:text-base font-semibold text-[#333] dark:text-gray-200">
            Tamaño tarjetas
          </legend>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setCardScale((v) =>
                  Math.max(CARD_SCALE_MIN, Math.round((v - CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de tarjetas"
            >
              −
            </button>
            <span className="tabular-nums text-base sm:text-lg font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.25rem] text-center">
              {cardScale.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setCardScale((v) =>
                  Math.min(CARD_SCALE_MAX, Math.round((v + CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de tarjetas"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dClassName} px-3 py-3 sm:px-3.5 sm:py-3.5 min-w-[150px] sm:min-w-[175px]`}
          aria-label="Ajuste de interlineado"
        >
          <legend className="text-sm sm:text-base font-semibold text-[#333] dark:text-gray-200">
            Interlineado
          </legend>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setLineHeightList((v) =>
                  Math.max(LINE_HEIGHT_MIN, Math.round((v - LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir interlineado"
            >
              −
            </button>
            <span className="tabular-nums text-base sm:text-lg font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.25rem] text-center">
              {lineHeightList.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={() =>
                setLineHeightList((v) =>
                  Math.min(LINE_HEIGHT_MAX, Math.round((v + LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar interlineado"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dClassName} px-3 py-3 sm:px-3.5 sm:py-3.5 min-w-[150px] sm:min-w-[175px]`}
          aria-label="Tamaño de fuente"
        >
          <legend className="text-sm sm:text-base font-semibold text-[#333] dark:text-gray-200">
            Tamaño fuente
          </legend>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setFontSizeScale((v) =>
                  Math.max(FONT_SIZE_MIN, Math.round((v - FONT_SIZE_STEP) * 1000) / 1000)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de fuente"
            >
              −
            </button>
            <span className="tabular-nums text-base sm:text-lg font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.25rem] text-center">
              {fontSizeScale.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setFontSizeScale((v) =>
                  Math.min(FONT_SIZE_MAX, Math.round((v + FONT_SIZE_STEP) * 1000) / 1000)
                )
              }
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-lg font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de fuente"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dBlueClassName} px-3 py-3 sm:px-4 sm:py-4 min-w-[160px] sm:min-w-[190px] ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}
          aria-label="Tamaño de tarjetas para metcon y strength extensos"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
            Tarjetas largas Met/Str
          </legend>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setDenseCardScale((v) =>
                  Math.max(CARD_SCALE_MIN, Math.round((v - CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de tarjetas largas"
            >
              −
            </button>
            <span className="tabular-nums text-lg sm:text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.5rem] text-center">
              {denseCardScale.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setDenseCardScale((v) =>
                  Math.min(CARD_SCALE_MAX, Math.round((v + CARD_SCALE_STEP) * 100) / 100)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de tarjetas largas"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dBlueClassName} px-3 py-3 sm:px-4 sm:py-4 min-w-[160px] sm:min-w-[190px] ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}
          aria-label="Interlineado para metcon y strength extensos"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
            Interlineado largas Met/Str
          </legend>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setDenseLineHeight((v) =>
                  Math.max(LINE_HEIGHT_MIN, Math.round((v - LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir interlineado largas"
            >
              −
            </button>
            <span className="tabular-nums text-lg sm:text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.5rem] text-center">
              {denseLineHeight.toFixed(1)}
            </span>
            <button
              type="button"
              onClick={() =>
                setDenseLineHeight((v) =>
                  Math.min(LINE_HEIGHT_MAX, Math.round((v + LINE_HEIGHT_STEP) * 10) / 10)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar interlineado largas"
            >
              +
            </button>
          </div>
        </fieldset>
        <fieldset
          className={`flex flex-col gap-2 ${dashboardControlPanel3dBlueClassName} px-3 py-3 sm:px-4 sm:py-4 min-w-[160px] sm:min-w-[190px] ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}
          aria-label="Tamaño de fuente para metcon y strength extensos"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
            Fuente largas Met/Str
          </legend>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setDenseFontSize((v) =>
                  Math.max(FONT_SIZE_MIN, Math.round((v - FONT_SIZE_STEP) * 1000) / 1000)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de fuente largas"
            >
              −
            </button>
            <span className="tabular-nums text-lg sm:text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[2.5rem] text-center">
              {denseFontSize.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setDenseFontSize((v) =>
                  Math.min(FONT_SIZE_MAX, Math.round((v + FONT_SIZE_STEP) * 1000) / 1000)
                )
              }
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de fuente largas"
            >
              +
            </button>
          </div>
        </fieldset>
      </div>
      )}

      <div
        className={`fixed bottom-4 sm:bottom-6 z-50 flex flex-row-reverse items-center gap-3 sm:gap-4 transition-opacity duration-300 pointer-events-none ${
          displayMode === 'control' && useInfinite
            ? 'right-[13rem] sm:right-[15rem]'
            : displayMode === 'control'
              ? 'right-[8.5rem] sm:right-40'
              : 'right-16 sm:right-24'
        } ${controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
      >
        {displayMode === 'control' && useInfinite && (
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="flex shrink-0 items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
            aria-label={isPaused ? 'Reanudar carrusel en TV' : 'Pausar carrusel en TV'}
            aria-pressed={isPaused}
          >
            {isPaused ? (
              <svg
                className="h-7 w-7 sm:h-8 sm:w-8"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg
                className="h-7 w-7 sm:h-8 sm:w-8"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDisplayMode((m) => (m === 'tv' ? 'control' : 'tv'))}
          className={`flex shrink-0 items-center justify-center rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 ${
            displayMode === 'control'
              ? 'h-14 w-14 sm:h-16 sm:w-16'
              : 'h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14'
          }`}
          aria-label={
            displayMode === 'tv' ? 'Cambiar a modo control (móvil)' : 'Cambiar a modo TV'
          }
          title={displayMode === 'tv' ? 'Modo control' : 'Modo TV'}
        >
          {displayMode === 'tv' ? (
            <svg
              className="h-5 w-5 sm:h-6 sm:w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="6" y="2" width="12" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
          ) : (
            <svg
              className="h-7 w-7 sm:h-8 sm:w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="4" width="20" height="12" rx="2" ry="2" />
              <path d="M8 20h8" />
              <path d="M12 16v4" />
            </svg>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className={`fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 flex items-center justify-center rounded-full bg-[#4A90E2] text-white shadow-lg hover:bg-[#3A7BC8] hover:shadow-xl active:scale-95 transition-all duration-300 pointer-events-none ${
          displayMode === 'control'
            ? 'h-14 w-14 sm:h-16 sm:w-16'
            : 'h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14'
        } ${controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
        aria-label="Cerrar sesión"
      >
        <svg
          className={displayMode === 'control' ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-5 w-5 sm:h-6 sm:w-6'}
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

      {displayMode === 'tv' && useInfinite && (
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
            <>
              {displayMode === 'control' && (
                <div className="absolute inset-0 flex w-full flex-col items-stretch overflow-y-auto p-4 pb-36 sm:p-6 sm:pb-40">
                  {showLongContentHintModal && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
                      <div className="w-full max-w-md rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl dark:border-blue-800 dark:bg-[#2f2f2f]">
                        <h3 className="text-base font-bold text-[#333] dark:text-gray-100 sm:text-lg">
                          Hay tarjetas con mucho contenido
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#555] dark:text-gray-300">
                          Puedes ajustarlas con los parametros
                          {' '}
                          <span className="font-semibold text-[#333] dark:text-gray-100">
                            &quot;Largas Met/Str&quot;
                          </span>
                          .
                        </p>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowLongContentHintModal(false)}
                            className="rounded-lg bg-[#4A90E2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3A7BC8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#2f2f2f]"
                          >
                            Entendido
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div
                    className={`mx-auto w-full max-w-md flex flex-col gap-4 p-4 sm:p-5 ${dashboardControlMainCardClassName}`}
                  >
                    <div>
                      <h2 className="text-lg font-bold text-[#333] dark:text-gray-100">Modo control</h2>
                      <p className="mt-1 text-xs text-[#666] dark:text-gray-400">
                        Mismo usuario admin que la TV · Flechas o deslizar para cambiar de sección
                      </p>
                      <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-[#f0f4f8] dark:bg-[#2a2a2a]">
                        {len === 0 ? (
                          <p className="px-4 py-8 text-center text-sm text-[#666] dark:text-gray-400">
                            Sin secciones en este WOD
                          </p>
                        ) : len === 1 ? (
                          <div className="flex min-h-[5.5rem] items-center justify-center px-4 py-6">
                            <p className="text-center text-base font-bold uppercase tracking-wide text-[#333] dark:text-gray-100 sm:text-lg">
                              {controlNameSlideEntries[0]?.slideSection.label}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex min-h-[5.5rem] items-stretch gap-1 px-1 py-1 sm:min-h-[5.5rem] sm:gap-1.5 sm:px-1.5">
                              <button
                                type="button"
                                onClick={goPrev}
                                disabled={!useInfinite}
                                className={`flex w-12 shrink-0 items-center justify-center self-stretch sm:w-14 md:w-16 ${carouselArrowButtonSurfaceClassName} disabled:pointer-events-none disabled:opacity-35`}
                                aria-label="Sección anterior"
                              >
                                <svg
                                  className={carouselArrowIconClassNameControl}
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
                              <section
                                ref={controlNamesStripRef}
                                onScroll={handleControlNamesScroll}
                                className="min-w-0 flex-1 touch-pan-x snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                aria-roledescription="Carrusel"
                                aria-label="Secciones del WOD. Flechas o deslizar para cambiar."
                              >
                                <div className="flex min-h-[5rem]">
                                  {controlNameSlideEntries.map(({ slideSection: s, renderKey }, idx) => (
                                    <div
                                      key={renderKey}
                                      className="flex w-full min-w-full shrink-0 snap-center items-center justify-center px-2 py-4 sm:px-4 sm:py-6"
                                    >
                                      <p
                                        className="text-center text-base font-bold uppercase tracking-wide text-[#333] dark:text-gray-100 sm:text-lg"
                                        aria-current={idx === controlStripLogicalIndex ? 'true' : undefined}
                                      >
                                        {s.label}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </section>
                              <button
                                type="button"
                                onClick={goNext}
                                disabled={!useInfinite}
                                className={`flex w-12 shrink-0 items-center justify-center self-stretch sm:w-14 md:w-16 ${carouselArrowButtonSurfaceClassName} disabled:pointer-events-none disabled:opacity-35`}
                                aria-label="Sección siguiente"
                              >
                                <svg
                                  className={carouselArrowIconClassNameControl}
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
                            </div>
                            <p className="pb-2 text-center text-xs tabular-nums text-[#666] dark:text-gray-400">
                              {controlStripLogicalIndex + 1} / {len}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <details className="group rounded-xl border border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-[#353535]/80 open:border-[#4A90E2]/40 dark:open:border-[#60a5fa]/35">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-4 text-base font-semibold text-[#333] dark:text-gray-200 [&::-webkit-details-marker]:hidden">
                        <span>Parámetros de pantalla</span>
                        <svg
                          className="h-7 w-7 shrink-0 text-[#4A90E2] transition-transform duration-200 group-open:rotate-180 dark:text-[#60a5fa]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </summary>
                      <div className="flex flex-col gap-4 border-t border-gray-200 px-2 pb-4 pt-3 dark:border-gray-600">
                        <fieldset className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-3 sm:px-4 sm:py-4">
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
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
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir tamaño de tarjetas"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {cardScale.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCardScale((v) =>
                                  Math.min(CARD_SCALE_MAX, Math.round((v + CARD_SCALE_STEP) * 100) / 100)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar tamaño de tarjetas"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                        <fieldset className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-3 sm:px-4 sm:py-4">
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
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
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir interlineado"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {lineHeightList.toFixed(1)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setLineHeightList((v) =>
                                  Math.min(LINE_HEIGHT_MAX, Math.round((v + LINE_HEIGHT_STEP) * 10) / 10)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar interlineado"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                        <fieldset className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-3 sm:px-4 sm:py-4">
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
                            Tamaño fuente
                          </legend>
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setFontSizeScale((v) =>
                                  Math.max(FONT_SIZE_MIN, Math.round((v - FONT_SIZE_STEP) * 1000) / 1000)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir tamaño de fuente"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {fontSizeScale.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setFontSizeScale((v) =>
                                  Math.min(FONT_SIZE_MAX, Math.round((v + FONT_SIZE_STEP) * 1000) / 1000)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar tamaño de fuente"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                        <fieldset className={`flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800 px-3 py-3 sm:px-4 sm:py-4 ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}>
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
                            Tarjetas largas Met/Str
                          </legend>
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setDenseCardScale((v) =>
                                  Math.max(CARD_SCALE_MIN, Math.round((v - CARD_SCALE_STEP) * 100) / 100)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir tamaño de tarjetas largas"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {denseCardScale.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDenseCardScale((v) =>
                                  Math.min(CARD_SCALE_MAX, Math.round((v + CARD_SCALE_STEP) * 100) / 100)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar tamaño de tarjetas largas"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                        <fieldset className={`flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800 px-3 py-3 sm:px-4 sm:py-4 ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}>
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
                            Interlineado largas Met/Str
                          </legend>
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setDenseLineHeight((v) =>
                                  Math.max(LINE_HEIGHT_MIN, Math.round((v - LINE_HEIGHT_STEP) * 10) / 10)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir interlineado largas"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {denseLineHeight.toFixed(1)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDenseLineHeight((v) =>
                                  Math.min(LINE_HEIGHT_MAX, Math.round((v + LINE_HEIGHT_STEP) * 10) / 10)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar interlineado largas"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                        <fieldset className={`flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800 px-3 py-3 sm:px-4 sm:py-4 ${hasLongMetconOrStrengthSections ? '' : 'hidden'}`}>
                          <legend className="px-1 text-base font-semibold text-[#333] dark:text-gray-200">
                            Fuente largas Met/Str
                          </legend>
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                setDenseFontSize((v) =>
                                  Math.max(FONT_SIZE_MIN, Math.round((v - FONT_SIZE_STEP) * 1000) / 1000)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Reducir tamaño de fuente largas"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-xl font-semibold text-[#4A90E2] dark:text-[#60a5fa]">
                              {denseFontSize.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setDenseFontSize((v) =>
                                  Math.min(FONT_SIZE_MAX, Math.round((v + FONT_SIZE_STEP) * 1000) / 1000)
                                )
                              }
                              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#4A90E2] text-2xl font-bold text-white active:scale-[0.98] sm:h-16 sm:w-16"
                              aria-label="Aumentar tamaño de fuente largas"
                            >
                              +
                            </button>
                          </div>
                        </fieldset>
                      </div>
                    </details>
                  </div>
                </div>
              )}
              {displayMode === 'tv' && (
            <div className="absolute inset-0 flex min-h-0 flex-col items-stretch overflow-hidden p-1 sm:p-[0.3rem]">
              {noWodForSelectedDate && (
                <div className="bg-[#fff3cd] dark:bg-amber-900/30 text-[#856404] dark:text-amber-200 p-4 sm:p-6 md:p-8 rounded-lg max-w-lg text-center text-sm sm:text-base md:text-xl lg:text-2xl">
                  No hay WOD para la fecha seleccionada. Elige otro día.
                </div>
              )}
              {showFallbackMessage && !noWodForSelectedDate && (
                <div className="bg-[#fff3cd] dark:bg-amber-900/30 text-[#856404] dark:text-amber-200 p-2 sm:p-3 md:p-4 rounded-lg mb-2 sm:mb-3 md:mb-4 text-center text-xs sm:text-sm md:text-xl lg:text-3xl">
                  ⚠️ No hay WOD programado para hoy.{' '}
                  {wods.length > 1 ? 'Mostrando WODs recientes.' : 'Mostrando el WOD más reciente.'}
                </div>
              )}
              {currentWod && !noWodForSelectedDate && (
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
              {!noWodForSelectedDate && (
                <section
                  className="relative flex min-h-0 flex-1 flex-col overflow-hidden w-full max-w-9xl mx-auto"
                  aria-roledescription="carrusel"
                  aria-label="Carrusel de secciones del WOD del día"
                >
                  {useInfinite && (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        className={`absolute left-1 top-1/2 z-10 flex h-56 w-28 -translate-y-1/2 items-center justify-center sm:left-2 sm:h-64 sm:w-32 md:h-80 md:w-40 ${carouselArrowButtonSurfaceClassName} ${
                          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
                        }`}
                        aria-label="Sección anterior"
                      >
                        <svg
                          className={carouselArrowIconClassNameTv}
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
                        className={`absolute right-1 top-1/2 z-10 flex h-56 w-28 -translate-y-1/2 items-center justify-center sm:right-2 sm:h-64 sm:w-32 md:h-80 md:w-40 ${carouselArrowButtonSurfaceClassName} ${
                          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
                        }`}
                        aria-label="Sección siguiente"
                      >
                        <svg
                          className={carouselArrowIconClassNameTv}
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
                    className="flex h-full min-h-0 w-full flex-1"
                    style={{
                      transform: `translateX(-${currentIndex * 100}%)`,
                      transition:
                        useInfinite && !skipTransition ? 'transform 0.4s ease-out' : 'none',
                    }}
                    onTransitionEnd={handleTransitionEnd}
                  >
                    {slidesToRender.map((slideSection, index) => {
                      if (slideSection.type === 'dual-section') {
                        const tvLayout = resolveTvSlideDensityLayout(
                          slideSection,
                          lineHeightList,
                          fontSizeScale,
                          cardScale,
                          denseLineHeight,
                          denseFontSize,
                          denseCardScale
                        )
                        return (
                          <section
                            key={slideSection.renderKey}
                            className="flex-[0_0_100%] min-h-0 min-w-0 h-full px-2 sm:px-3 md:px-4 flex items-center justify-center"
                            aria-label={
                              useInfinite ? `Sección ${(index % len) + 1} de ${len}` : undefined
                            }
                            aria-hidden={useInfinite ? index !== currentIndex : undefined}
                          >
                            <div
                              className="flex max-h-full min-h-0 w-full max-w-[98%] flex-1 flex-col items-center justify-center overflow-y-auto py-1 sm:py-2"
                              style={{
                                width: `${clamp(100 / tvLayout.cardScale, 70, 140)}%`,
                                transform: `scale(${tvLayout.cardScale})`,
                                transformOrigin: 'center center',
                              }}
                            >
                              <DualSectionSlide
                                label={slideSection.label}
                                crossfitLines={slideSection.crossfitLines}
                                functionalLines={slideSection.functionalLines}
                                lineHeight={tvLayout.lineHeight}
                                fontSize={tvLayout.fontSize}
                                className="w-full shrink-0"
                              />
                            </div>
                          </section>
                        )
                      }

                      const isMetcon = slideSection.label.toUpperCase().startsWith('METCON')
                      const isFuerza = slideSection.label === 'STRENGTH'
                      const metconCards =
                        isMetcon && slideSection.type === 'section'
                          ? (() => {
                              const items = slideSection.lines
                                .map((l) => l.trim().replace(/^[•-]\s*/, ''))
                                .filter(Boolean)
                              if (items.length === 0) return null
                              const firstLine = items[0]
                              // Si la primera línea contiene "round" se muestra una sola card con ancho reducido
                              if (firstLine.toLowerCase().includes('round')) return null
                              const restLines = items.slice(1)
                              const blocksFromRest = buildBlocks(restLines)
                              const blocksFromAll = buildBlocks(items)
                              const hasEnduranceBlock = blocksFromAll.some(
                                (b) => b.title === BLOCK_TITLE_ENDURANCE
                              )
                              if (hasEnduranceBlock) {
                                const enduranceBlock = blocksFromAll.find(
                                  (b) => b.title === BLOCK_TITLE_ENDURANCE
                                )
                                const lines = enduranceBlock ? enduranceBlock.lines : items
                                return [
                                  {
                                    label: slideSection.label,
                                    lines,
                                    layout: 'endurance' as const,
                                  },
                                ]
                              }
                              const blocks = blocksFromRest
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
                      const fuerzaCards =
                        isFuerza && slideSection.type === 'section'
                          ? (() => {
                              const items = slideSection.lines
                                .map((l) => l.trim().replace(/^[•-]\s*/, ''))
                                .filter(Boolean)
                              if (items.length === 0) return null
                              const firstLine = items[0]
                              // Si el título contiene "Fortalecimiento:" se muestra una sola card con todo el contenido
                              if (firstLine.includes('Fortalecimiento:')) return null
                              const restLines = items.slice(1)
                              const blocks = buildBlocks(restLines)
                              const crossfitBlock = blocks.find(
                                (b) => b.title === 'Crossfit' || b.title === null
                              )
                              const sollteBlock = blocks.find((b) => b.title === 'Sollte funcional')
                              return [
                                {
                                  label: slideSection.label,
                                  lines: [firstLine, ...(crossfitBlock?.lines ?? [])],
                                },
                                {
                                  label: slideSection.label,
                                  lines: ['Sollte Funcional', ...(sollteBlock?.lines ?? [])],
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
                      const singleEnduranceCard =
                        metconCards?.length === 1 &&
                        'layout' in metconCards[0] &&
                        metconCards[0].layout === 'endurance'
                          ? metconCards[0]
                          : null
                      const isFuerzaFortalecimientoSingle =
                        isFuerza &&
                        slideSection.type === 'section' &&
                        slideSection.lines[0]?.trim().includes('Fortalecimiento:')
                      const isMetconRoundSingle =
                        isMetcon &&
                        slideSection.type === 'section' &&
                        slideSection.lines[0]?.trim().toLowerCase().includes('round')
                      return (
                        <section
                          key={slideSection.renderKey}
                          className="flex-[0_0_100%] min-h-0 min-w-0 h-full px-2 sm:px-3 md:px-4 flex items-center justify-center"
                          aria-label={
                            useInfinite ? `Sección ${(index % len) + 1} de ${len}` : undefined
                          }
                          aria-hidden={useInfinite ? index !== currentIndex : undefined}
                        >
                          {(() => {
                            const tvLayout = resolveTvSlideDensityLayout(
                              slideSection,
                              lineHeightList,
                              fontSizeScale,
                              cardScale,
                              denseLineHeight,
                              denseFontSize,
                              denseCardScale
                            )
                            const singleCardWidth = getCardWidthPercent({
                              cardScale: tvLayout.cardScale,
                              lineHeight: tvLayout.lineHeight,
                              fontSizeScale: tvLayout.fontSize,
                              dual: false,
                            })
                            const dualCardWidth = getCardWidthPercent({
                              cardScale: tvLayout.cardScale,
                              lineHeight: tvLayout.lineHeight,
                              fontSizeScale: tvLayout.fontSize,
                              dual: true,
                            })
                            const dynamicGapPx = clamp(8 * tvLayout.cardScale, 6, 20)

                            return (
                          <div
                            className="flex max-h-full min-h-0 w-full max-w-[98%] flex-1 flex-col items-center justify-center overflow-y-auto py-1 sm:py-2"
                            style={{
                              width: `${clamp(100 / tvLayout.cardScale, 70, 140)}%`,
                              transform: `scale(${tvLayout.cardScale})`,
                              transformOrigin: 'center center',
                            }}
                          >
                            {singleEnduranceCard ? (
                              <div
                                className="mx-auto flex w-full shrink-0 flex-col sm:max-w-5xl"
                                style={{ maxWidth: `${singleCardWidth}%` }}
                              >
                                <SectionSlide
                                  label={singleEnduranceCard.label}
                                  lines={singleEnduranceCard.lines}
                                  lineHeight={tvLayout.lineHeight}
                                  fontSize={tvLayout.fontSize}
                                  className="w-full shrink-0"
                                />
                              </div>
                            ) : twoCards ? (
                              <div
                                className="mx-auto flex w-full min-h-0 max-w-full shrink-0 flex-col gap-2 sm:gap-2.5"
                                style={{ maxWidth: `${dualCardWidth}%` }}
                              >
                                <DualColumnSectionHeader label={slideSection.label} />
                                <div
                                  className="flex min-h-0 w-full flex-1 items-stretch"
                                  style={{ gap: `${dynamicGapPx}px` }}
                                >
                                  {twoCards.map((card) => (
                                    <div
                                      key={`${card.label}-${card.lines.join('|')}`}
                                      className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
                                    >
                                      <SectionSlide
                                        label={card.label}
                                        lines={card.lines}
                                        lineHeight={tvLayout.lineHeight}
                                        fontSize={tvLayout.fontSize}
                                        hideVerticalLabel
                                        className="mx-0 h-full min-h-0 w-full min-w-0 max-w-none flex-1 self-stretch"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : isFuerzaFortalecimientoSingle || isMetconRoundSingle ? (
                              <div
                                className="mx-auto flex w-full shrink-0 flex-col sm:max-w-4xl"
                                style={{ maxWidth: `${singleCardWidth}%` }}
                              >
                                <SectionSlide
                                  label={slideSection.label}
                                  lines={
                                    slideSection.type === 'section' &&
                                    isMetconRoundSingle &&
                                    slideSection.lines[0]?.trim() === 'Crossfit'
                                      ? slideSection.lines.slice(1)
                                      : slideSection.type === 'section'
                                        ? slideSection.lines
                                        : []
                                  }
                                  lineHeight={tvLayout.lineHeight}
                                  fontSize={tvLayout.fontSize}
                                  className="w-full shrink-0"
                                />
                              </div>
                            ) : slideSection.type === 'section' ? (
                              <SectionSlide
                                label={slideSection.label}
                                lines={slideSection.lines}
                                lineHeight={tvLayout.lineHeight}
                                fontSize={tvLayout.fontSize}
                                className="w-full shrink-0"
                              />
                            ) : null}
                          </div>
                            )
                          })()}
                        </section>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
              )}
            </>
          )}
        </main>
      </div>

      {sessionUid ? (
        <aside
          aria-live="polite"
          aria-label="Dispositivos en la sesión de control"
          className={`pointer-events-none fixed left-3 z-[55] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-gray-600/90 bg-[#2a2a2a]/95 px-3 py-2 text-left shadow-lg shadow-black/40 backdrop-blur-md transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          } ${
            displayMode === 'tv' && showControls ? 'bottom-28 sm:bottom-32' : 'bottom-3 sm:bottom-4'
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Sesión en vivo
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-100">
            {sessionPresencePeers.length}{' '}
            {sessionPresencePeers.length === 1 ? 'dispositivo' : 'dispositivos'}
          </p>
          {sessionPresencePeers.length > 0 ? (
            <ul className="mt-1.5 space-y-1 border-t border-gray-600/80 pt-1.5 text-xs text-gray-300">
              {sessionPresencePeers.map((p) => (
                <li key={p.deviceId} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <span className="font-medium text-gray-100">{p.label}</span>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-400">
                    {p.mode === 'tv' ? 'Modo TV' : 'Modo control'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-gray-500">Esperando señal…</p>
          )}
        </aside>
      ) : null}
    </div>
  )
}
