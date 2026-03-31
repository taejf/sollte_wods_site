'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, getSavedTheme } from '@/components/ThemeInit'
import { checkIsAdmin, logoutUser, onAuthChange } from '@/lib/auth'
import type { WodDoc, WodsApiResponse } from '@/lib/wod'

const labelStripStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  transform: 'rotate(180deg)',
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
  if (isEnduranceSection || isFuerza || isWarmup) return 'single'
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

/** Borde inferior entre líneas dentro de una sola columna. */
function exerciseGridItemBottomBorderClasses(
  index: number,
  total: number,
  item?: string,
  nextItem?: string
): string {
  if (total <= 0) return ''
  const basePad = 'py-2 sm:py-3 min-w-0 break-words'
  const notePad = 'pt-0.5 pb-1.5 sm:pt-1 sm:pb-2 min-w-0 break-words'
  const beforeNotePad = 'pt-2 pb-0.5 sm:pt-3 sm:pb-1 min-w-0 break-words'
  const b = 'border-b-2 border-b-[#d0d0d0] dark:border-b-gray-500'
  if (nextItem && isSpecialStyledLine(nextItem)) return `${beforeNotePad} border-b-0`
  if (item && isSpecialStyledLine(item)) return `${notePad} border-b-0`
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

function getLineTextClasses(item: string): string {
  if (isRoundLine(item)) return SUBTITLE_LINE_TEXT
  if (isNoteLine(item)) return NOTE_LINE_TEXT
  return EXERCISE_LINE_TEXT
}

const COL_BORDER_MD = 'md:border-l-2 md:border-l-[#d0d0d0] md:dark:border-l-gray-500 md:pl-3'
const COL_BORDER_XL = 'xl:border-l-2 xl:border-l-[#d0d0d0] xl:dark:border-l-gray-500 xl:pl-3'
const COL_BORDER_SM = 'sm:border-l-2 sm:border-l-[#d0d0d0] sm:dark:border-l-gray-500 sm:pl-3'

function ExerciseColumnItems({
  items,
  lineHeight,
  extraLiClass,
}: {
  items: string[]
  lineHeight: number
  extraLiClass?: (item: string) => string
}) {
  return (
    <ul className="list-none p-0 m-0 flex flex-col">
      {items.map((item, i) => (
        <li
          key={`${item}-${items.length}`}
          className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1])} ${extraLiClass?.(item) ?? ''}`}
          style={{ lineHeight }}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

function ExerciseMultiColumnGrid({
  items,
  layout,
  lineHeight,
  extraLiClass,
}: {
  items: string[]
  layout: ExerciseGridLayout
  lineHeight: number
  extraLiClass?: (item: string) => string
}) {
  const gapRow = 'mt-2 sm:mt-3 md:mt-4'

  if (layout === 'single') {
    return (
      <ul className={`list-none m-0 grid grid-cols-1 gap-y-0 p-0 ${gapRow}`}>
        {items.map((item, i) => (
          <li
            key={`${item}-${items.length}`}
            className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1])} ${extraLiClass?.(item) ?? ''}`}
            style={{ lineHeight }}
          >
            {item}
          </li>
        ))}
      </ul>
    )
  }

  const col2 = splitIntoColumns(items, 2)

  if (layout === 'twoCol') {
    return (
      <>
        <ul className={`list-none m-0 flex flex-col p-0 md:hidden ${gapRow}`}>
          {items.map((item, i) => (
            <li
              key={`${item}-${items.length}`}
              className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1])} ${extraLiClass?.(item) ?? ''}`}
              style={{ lineHeight }}
            >
              {item}
            </li>
          ))}
        </ul>
        <div
          className={`hidden md:flex md:flex-row md:items-stretch gap-x-3 sm:gap-x-4 md:gap-x-6 ${gapRow}`}
        >
          <div className="min-w-0 flex-1">
            <ExerciseColumnItems
              items={col2[0]}
              lineHeight={lineHeight}
              extraLiClass={extraLiClass}
            />
          </div>
          <div className={`min-w-0 flex-1 ${COL_BORDER_MD}`}>
            <ExerciseColumnItems
              items={col2[1]}
              lineHeight={lineHeight}
              extraLiClass={extraLiClass}
            />
          </div>
        </div>
      </>
    )
  }

  const col3 = splitIntoColumns(items, 3)
  return (
    <>
      <ul className={`list-none m-0 flex flex-col p-0 md:hidden ${gapRow}`}>
        {items.map((item, i) => (
          <li
            key={`${item}-${items.length}`}
            className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, items.length, item, items[i + 1])} ${extraLiClass?.(item) ?? ''}`}
            style={{ lineHeight }}
          >
            {item}
          </li>
        ))}
      </ul>
      <div
        className={`hidden md:flex xl:hidden md:flex-row md:items-stretch gap-x-3 sm:gap-x-4 md:gap-x-6 ${gapRow}`}
      >
        <div className="min-w-0 flex-1">
          <ExerciseColumnItems
            items={col2[0]}
            lineHeight={lineHeight}
            extraLiClass={extraLiClass}
          />
        </div>
        <div className={`min-w-0 flex-1 ${COL_BORDER_MD}`}>
          <ExerciseColumnItems
            items={col2[1]}
            lineHeight={lineHeight}
            extraLiClass={extraLiClass}
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
            <ExerciseColumnItems items={col} lineHeight={lineHeight} extraLiClass={extraLiClass} />
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

function SectionSlide({
  label,
  lines,
  lineHeight = LINE_HEIGHT_DEFAULT,
  fontSize = FONT_SIZE_DEFAULT,
  className = '',
}: {
  label: string
  lines: string[]
  lineHeight?: number
  fontSize?: number
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
  const isFuerza = label === 'STRENGTH'
  const labelBg = 'bg-black'
  const blocks = buildBlocks(restLines)
  const isEnduranceSection =
    isMetcon &&
    (/\bEndurance\b/i.test(firstLine) ||
      (blocks.length === 1 && blocks[0].title === BLOCK_TITLE_ENDURANCE))

  return (
    <div
      className={`flex rounded-lg overflow-hidden border border-[#c4c4c4] dark:border-gray-600 bg-white dark:bg-[#3C3C3C] min-h-0 max-w-[96%] mx-auto ${isWarmup ? 'sm:max-w-4xl' : ''} ${isEnduranceSection ? 'sm:max-w-5xl' : ''} ${className}`}
    >
      <div
        className={`flex flex-shrink-0 self-stretch w-10 sm:w-14 md:w-20 lg:w-24 min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[5rem] lg:min-w-24 items-center justify-center py-2 sm:py-3 md:py-4 px-1 sm:px-2 md:px-3 text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold uppercase tracking-wider ${labelBg}`}
        style={labelStripStyle}
      >
        {label}
      </div>
      <div
        className={`flex-1 min-h-0 border-l p-3 sm:p-4 md:p-5 lg:p-6 overflow-y-auto flex flex-col ${isMetcon ? 'border-black dark:border-gray-500' : 'border-[#e0e0e0] dark:border-gray-600'}`}
        style={{ fontSize: `${fontSize}rem` }}
      >
        {restLines.length > 0 ? (
          <>
            {!isMetcon && (
              <p className="font-semibold mb-2 sm:mb-3 md:mb-4 text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
                {firstLine}
              </p>
            )}
            {isMetcon ? (
              <>
                {isEnduranceSection ? (
                  <div className="mb-2 sm:mb-3 md:mb-4">
                    <p className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
                      {firstLine}
                    </p>
                    {restLines[0] && (
                      <p className="text-[#666] dark:text-gray-400 text-[0.95em] sm:text-[1em] md:text-[1.25em] lg:text-[1.75em] mt-0.5 font-medium">
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
                      return (
                        <div
                          key={`${block.title ?? 'Crossfit'}-${titleLine}`}
                          className="mb-2 sm:mb-3 md:mb-4"
                        >
                          <p className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
                            Crossfit
                          </p>
                          <p className="text-[#333] dark:text-gray-200 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.25em] mt-0.5">
                            {firstLine}
                          </p>
                        </div>
                      )
                    }
                    if (block.title === 'Sollte funcional') {
                      return (
                        <div
                          key={`${block.title ?? 'Sollte funcional'}-${titleLine}`}
                          className="mb-2 sm:mb-3 md:mb-4"
                        >
                          <p className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
                            Sollte funcional
                          </p>
                          <p className="text-[#333] dark:text-gray-200 text-[1em] sm:text-[1.125em] md:text-[1.5em] lg:text-[2.25em] mt-0.5">
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
                      {chunks.map((chunk) => (
                        <ul
                          key={`${chunk.join('|')}-${chunk.length}`}
                          className="list-none p-0 m-0 flex flex-col"
                        >
                          {chunk.map((item, i) => (
                            <li
                              key={`${item}-${chunk.length}`}
                              className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, chunk.length, item, chunk[i + 1])} ${i === 0 ? 'font-bold' : ''}`}
                              style={{ lineHeight: lineHeight }}
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      ))}
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
                const warmupColumns = isWarmup ? splitWarmupIntoTwoColumns(listLines) : [listLines]
                const listGridLayout = getExerciseGridLayout(listLines.length, {
                  isEnduranceSection: false,
                  isFuerza,
                  isWarmup,
                })
                return (
                  <div
                    key={`${block.title ?? 'block'}-${listLines.join('|')}`}
                    className={bi > 0 ? 'mt-2 sm:mt-3 md:mt-4' : ''}
                  >
                    {block.title && (
                      <p className="font-semibold text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em] mb-1 sm:mb-2">
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

  if (crossfitItems.length === 0 && functionalItems.length === 0) return null

  const labelBg = 'bg-black'

  return (
    <div
      className={`flex w-full max-w-[96%] mx-auto items-stretch gap-2 sm:gap-3 md:gap-4 min-h-0 ${className}`}
    >
      {crossfitItems.length > 0 && (
        <div className="flex min-h-0 min-w-0 flex-1 self-stretch overflow-hidden rounded-lg border border-[#c4c4c4] bg-white dark:border-gray-600 dark:bg-[#3C3C3C]">
          <div
            className={`flex flex-shrink-0 w-10 sm:w-14 md:w-20 lg:w-24 min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[5rem] lg:min-w-24 items-center justify-center self-stretch py-2 sm:py-3 md:py-4 px-1 sm:px-2 md:px-3 text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold uppercase tracking-wider ${labelBg}`}
            style={labelStripStyle}
          >
            {label}
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col justify-start border-l border-black p-3 sm:p-4 md:p-5 lg:p-6 dark:border-gray-500"
            style={{ fontSize: `${fontSize}rem` }}
          >
            <p className="font-semibold mb-2 sm:mb-3 md:mb-4 text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
              Crossfit
            </p>
            <ul className="list-none p-0 m-0 flex flex-col">
              {crossfitItems.map((item, i) => (
                <li
                  key={`${item}-${crossfitItems.length}`}
                  className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, crossfitItems.length, item, crossfitItems[i + 1])}`}
                  style={{ lineHeight: lineHeight }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {functionalItems.length > 0 && (
        <div className="flex min-h-0 min-w-0 flex-1 self-stretch overflow-hidden rounded-lg border border-[#c4c4c4] bg-white dark:border-gray-600 dark:bg-[#3C3C3C]">
          <div
            className={`flex flex-shrink-0 w-10 sm:w-14 md:w-20 lg:w-24 min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[5rem] lg:min-w-24 items-center justify-center self-stretch py-2 sm:py-3 md:py-4 px-1 sm:px-2 md:px-3 text-white text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold uppercase tracking-wider ${labelBg}`}
            style={labelStripStyle}
          >
            {label}
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col justify-start border-l border-black p-3 sm:p-4 md:p-5 lg:p-6 dark:border-gray-500"
            style={{ fontSize: `${fontSize}rem` }}
          >
            <p className="font-semibold mb-2 sm:mb-3 md:mb-4 text-[#333] dark:text-gray-200 text-[1.125em] sm:text-[1.25em] md:text-[1.875em] lg:text-[3em]">
              Funcional
            </p>
            <ul className="list-none p-0 m-0 flex flex-col">
              {functionalItems.map((item, i) => (
                <li
                  key={`${item}-${functionalItems.length}`}
                  className={`${getLineTextClasses(item)} ${exerciseGridItemBottomBorderClasses(i, functionalItems.length, item, functionalItems[i + 1])}`}
                  style={{ lineHeight: lineHeight }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

type WodSection =
  | { type: 'header'; title: string; description: string }
  | { type: 'section'; label: string; lines: string[] }
  | { type: 'dual-section'; label: string; crossfitLines: string[]; functionalLines: string[] }

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
      label: 'STRENGHT',
      crossfitLines: strength.split('\n').filter((l) => l.trim()),
      functionalLines: functionalStrength.split('\n').filter((l) => l.trim()),
    })
  } else if (strength.trim()) {
    sections.push({
      type: 'section',
      label: 'STRENGHT',
      lines: strength.split('\n').filter((l) => l.trim()),
    })
  } else if (functionalStrength.trim()) {
    sections.push({
      type: 'section',
      label: 'STRENGHT',
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
  const [isDark, setIsDark] = useState(true)
  const [lineHeightList, setLineHeightList] = useState(LINE_HEIGHT_DEFAULT)
  const [cardScale, setCardScale] = useState(CARD_SCALE_DEFAULT)
  const [fontSizeScale, setFontSizeScale] = useState(FONT_SIZE_DEFAULT)
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
      const storedFont = localStorage.getItem(STORAGE_KEY_FONT_SIZE)
      if (storedFont !== null) {
        const f = parseFloat(storedFont)
        if (!Number.isNaN(f) && f >= FONT_SIZE_MIN && f <= FONT_SIZE_MAX) setFontSizeScale(f)
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
    applyTheme(isDark)
  }, [isDark])

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
  const sectionsLengthRef = useRef(carouselSections.length)
  const currentIndexRef = useRef(0)
  sectionsLengthRef.current = carouselSections.length
  currentIndexRef.current = currentIndex
  const len = carouselSections.length
  const useInfinite = len > 1
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

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#1a1a1a] flex flex-col">
      <header className="bg-white dark:bg-[#3C3C3C] py-2 sm:py-3 md:py-4 px-3 sm:px-4 md:px-6 shadow-sm shrink-0">
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

      <div
        className={`fixed bottom-4 sm:bottom-6 left-3 sm:left-6 z-50 flex flex-row gap-3 transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <fieldset
          className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#3C3C3C] shadow-lg border border-gray-200 dark:border-gray-600 px-4 py-4 sm:px-5 sm:py-5 min-w-[200px] sm:min-w-[260px]"
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
          className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#3C3C3C] shadow-lg border border-gray-200 dark:border-gray-600 px-4 py-4 sm:px-5 sm:py-5 min-w-[200px] sm:min-w-[260px]"
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
        <fieldset
          className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-[#3C3C3C] shadow-lg border border-gray-200 dark:border-gray-600 px-4 py-4 sm:px-5 sm:py-5 min-w-[200px] sm:min-w-[260px]"
          aria-label="Tamaño de fuente"
        >
          <legend className="text-base sm:text-lg font-semibold text-[#333] dark:text-gray-200">
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
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Reducir tamaño de fuente"
            >
              −
            </button>
            <span className="tabular-nums text-xl sm:text-2xl font-semibold text-[#4A90E2] dark:text-[#60a5fa] min-w-[3rem] text-center">
              {fontSizeScale.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() =>
                setFontSizeScale((v) =>
                  Math.min(FONT_SIZE_MAX, Math.round((v + FONT_SIZE_STEP) * 1000) / 1000)
                )
              }
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#4A90E2] hover:bg-[#3A7BC8] active:scale-95 text-white text-2xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90E2] focus-visible:ring-offset-2"
              aria-label="Aumentar tamaño de fuente"
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
                    className="flex w-full"
                    style={{
                      transform: `translateX(-${currentIndex * 100}%)`,
                      transition:
                        useInfinite && !skipTransition ? 'transform 0.4s ease-out' : 'none',
                    }}
                    onTransitionEnd={handleTransitionEnd}
                  >
                    {slidesToRender.map((slideSection, index) => {
                      if (slideSection.type === 'dual-section') {
                        return (
                          <section
                            key={slideSection.renderKey}
                            className="flex-[0_0_100%] min-w-0 h-full px-2 sm:px-3 md:px-4 flex items-center justify-center"
                            aria-label={
                              useInfinite ? `Sección ${(index % len) + 1} de ${len}` : undefined
                            }
                            aria-hidden={useInfinite ? index !== currentIndex : undefined}
                          >
                            <div
                              className="flex max-h-full min-h-0 w-full max-w-[98%] flex-col items-center justify-center overflow-y-auto py-1 sm:py-2"
                              style={{
                                transform: `scale(${cardScale})`,
                                transformOrigin: 'center center',
                              }}
                            >
                              <DualSectionSlide
                                label={slideSection.label}
                                crossfitLines={slideSection.crossfitLines}
                                functionalLines={slideSection.functionalLines}
                                lineHeight={lineHeightList}
                                fontSize={fontSizeScale}
                                className="w-full shrink-0"
                              />
                            </div>
                          </section>
                        )
                      }

                      const isMetcon = slideSection.label.toUpperCase().startsWith('METCON')
                      const isFuerza = slideSection.label === 'STRENGHT'
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
                          className="flex-[0_0_100%] min-w-0 h-full px-2 sm:px-3 md:px-4 flex items-center justify-center"
                          aria-label={
                            useInfinite ? `Sección ${(index % len) + 1} de ${len}` : undefined
                          }
                          aria-hidden={useInfinite ? index !== currentIndex : undefined}
                        >
                          <div
                            className="flex max-h-full min-h-0 w-full max-w-[98%] flex-col items-center justify-center overflow-y-auto py-1 sm:py-2"
                            style={{
                              transform: `scale(${cardScale})`,
                              transformOrigin: 'center center',
                            }}
                          >
                            {singleEnduranceCard ? (
                              <div className="mx-auto flex w-full max-w-[96%] shrink-0 flex-col sm:max-w-5xl">
                                <SectionSlide
                                  label={singleEnduranceCard.label}
                                  lines={singleEnduranceCard.lines}
                                  lineHeight={lineHeightList}
                                  fontSize={fontSizeScale}
                                  className="w-full shrink-0"
                                />
                              </div>
                            ) : twoCards ? (
                              <div className="mx-auto flex w-full max-w-[96%] shrink-0 items-stretch gap-2 sm:gap-3 md:gap-4">
                                {twoCards.map((card) => (
                                  <div
                                    key={`${card.label}-${card.lines.join('|')}`}
                                    className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
                                  >
                                    <SectionSlide
                                      label={card.label}
                                      lines={card.lines}
                                      lineHeight={lineHeightList}
                                      fontSize={fontSizeScale}
                                      className="h-full min-h-0 w-full min-w-0 flex-1 self-stretch"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : isFuerzaFortalecimientoSingle || isMetconRoundSingle ? (
                              <div className="mx-auto flex w-full max-w-[96%] shrink-0 flex-col sm:max-w-4xl">
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
                                  lineHeight={lineHeightList}
                                  fontSize={fontSizeScale}
                                  className="w-full shrink-0"
                                />
                              </div>
                            ) : slideSection.type === 'section' ? (
                              <SectionSlide
                                label={slideSection.label}
                                lines={slideSection.lines}
                                lineHeight={lineHeightList}
                                fontSize={fontSizeScale}
                                className="w-full shrink-0"
                              />
                            ) : null}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
