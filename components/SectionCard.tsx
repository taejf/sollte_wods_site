export default function SectionCard({ label, lines }: { label: string; lines: string[] }) {
  const items = lines
    .filter((line) => line.trim())
    .map((line) => line.trim().replace(/^[•\-]\s*/, ''));
  if (items.length === 0) return null;

  const firstLine = items[0];
  const restLines = items.slice(1);

  const isMetcon = label.toUpperCase().startsWith('METCON');
  const labelBg = isMetcon ? '!bg-black' : 'bg-[#6E6E6E]';

  return (
    <div className="mb-6 flex rounded-lg overflow-hidden border border-[#c4c4c4] bg-white">
      <div
        className={`flex flex-shrink-0 min-w-[50px] items-center justify-center ${labelBg} py-4 px-3 text-white text-xs font-bold uppercase tracking-wider`}
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)'
        }}
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
