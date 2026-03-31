import SectionCard from './SectionCard'

export interface WodDoc {
  id?: string
  title?: string
  description?: string
  warmup?: string
  warmUp?: string
  strength?: string | { description?: string; functionalDescription?: string }
  functionalDescription?: string
  metcoes?: { description?: string; functionalDescription?: string }[]
  metcoms?: { description?: string; functionalDescription?: string }[]
  additional?: string
  wodDate?: unknown
}

export default function WodCard({ wod }: { wod: WodDoc }) {
  const title = wod.title || 'WOD'
  const description = wod.description || ''
  const metcoes = wod.metcoes || wod.metcoms || []
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

  const additional = wod.additional || ''

  return (
    <div className="mb-6">
      <div className="bg-white rounded-lg border border-[#e0e0e0] p-6 mb-6 hidden">
        <h2 className="font-bold text-xl text-[#333] mb-1">{title}</h2>
        {description && <p className="text-[#666] text-sm leading-relaxed m-0">{description}</p>}
      </div>

      {warmup && <SectionCard label="WARM UP" lines={warmup.split('\n').filter((l) => l.trim())} />}
      {strength && (
        <SectionCard label="STRENGTH" lines={strength.split('\n').filter((l) => l.trim())} />
      )}
      {functionalStrength && (
        <SectionCard
          label="STRENGTH"
          lines={functionalStrength.split('\n').filter((l) => l.trim())}
        />
      )}
      {metcoes && metcoes.length > 0 && (
        <div className="w-screen relative left-1/2 -translate-x-1/2 bg-black py-3 px-4 my-6">
          <p className="text-white font-bold text-sm uppercase tracking-wider text-center m-0">
            METCON WOD
          </p>
        </div>
      )}
      {metcoes?.map((metcon, index) => {
        const descRaw = metcon?.description || ''
        const desc = typeof descRaw === 'string' ? descRaw : ''
        const funcDescRaw = metcon?.functionalDescription || ''
        const funcDesc = typeof funcDescRaw === 'string' ? funcDescRaw : ''

        return (
          <>
            {desc.trim() && (
              <SectionCard
                key={`${index}-desc`}
                label={`METCON ${index + 1}`}
                lines={desc.split('\n').filter((l) => l.trim())}
              />
            )}
            {funcDesc.trim() && (
              <SectionCard
                key={`${index}-func`}
                label={`METCON ${index + 1}`}
                lines={funcDesc.split('\n').filter((l) => l.trim())}
              />
            )}
          </>
        )
      })}
      {additional && (
        <>
          <div className="w-screen relative left-1/2 -translate-x-1/2 bg-[#5A5A5A] py-3 px-4 my-6">
            <p className="text-white font-bold text-sm uppercase tracking-wider text-center m-0">
              COMPLEMENTARIOS WOD
            </p>
          </div>
          <SectionCard label="ACCESORIOS" lines={additional.split('\n').filter((l) => l.trim())} />
        </>
      )}
    </div>
  )
}
