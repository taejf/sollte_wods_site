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
  wodDate?: string | number | null
}

export interface WodsApiResponse {
  wods: WodDoc[]
  headquarter: string | null
}
