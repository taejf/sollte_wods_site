'use client'

import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'

const dividerSx = {
  borderTopWidth: 2,
  borderColor: 'rgba(0, 0, 0, 0.12)',
  '.dark &': {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
} as const

export default function DividedExerciseLines({
  items,
  className = '',
  lineClassName = '',
  lineStyle,
  firstLineBold = false,
}: {
  items: string[]
  className?: string
  lineClassName?: string
  lineStyle?: React.CSSProperties
  firstLineBold?: boolean
}) {
  const filtered = items.filter((line) => line.trim())
  if (filtered.length === 0) return null
  const keyCount = new Map<string, number>()

  return (
    <Stack
      className={className}
      divider={<Divider component="div" flexItem sx={dividerSx} />}
      spacing={0}
    >
      {filtered.map((item, i) => (
        <div
          key={`${item}-${(() => {
            const count = (keyCount.get(item) ?? 0) + 1
            keyCount.set(item, count)
            return count
          })()}`}
          className={lineClassName}
          style={lineStyle}
          data-first-line-bold={firstLineBold && i === 0 ? true : undefined}
        >
          {item}
        </div>
      ))}
    </Stack>
  )
}
