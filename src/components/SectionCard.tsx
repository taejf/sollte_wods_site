export default function SectionCard({ label, lines }: { label: string; lines: string[] }) {
  const items = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•-]\s*/, ''))
  if (items.length === 0) return null

  const firstLine = items[0]
  const restLines = items.slice(1)

  const isMetcon = label.toUpperCase().startsWith('METCON')
  const labelBg = 'bg-black'

  const labelStripClass =
    'flex flex-shrink-0 w-14 min-w-14 items-center justify-center py-4 px-3 text-white text-xs font-bold uppercase tracking-wider'
  return (
    <div className="mb-6 flex rounded-lg overflow-hidden border border-[#c4c4c4] dark:border-gray-600 bg-white dark:bg-[#3C3C3C]">
      <div
        className={`${labelStripClass} ${labelBg}`}
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
        }}
      >
        {label}
      </div>
      <div
        className={`flex-1 border-l p-5 ${isMetcon ? 'border-black dark:border-gray-500' : 'border-[#e0e0e0] dark:border-gray-600'}`}
      >
        {restLines.length > 0 ? (
          <>
            <p className="font-semibold mb-3 text-[#333] dark:text-gray-200">{firstLine}</p>
            <ul className="list-none p-0 m-0 flex flex-col divide-y-2 divide-[#d0d0d0] dark:divide-gray-500">
              {restLines.map((item, i) => (
                <li
                  key={i}
                  className="text-[#333] dark:text-gray-200 text-sm leading-relaxed py-2 first:pt-0 last:pb-0 before:content-['•_'] before:text-[#4A90E2] before:font-bold before:mr-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[#333] dark:text-gray-200 text-sm">{firstLine}</p>
        )}
      </div>
    </div>
  )
}
