/**
 * Núcleo do diário: busca de memórias, tags e validação de upload.
 * Funções puras — a UI e os testes compartilham as mesmas regras.
 */

export type MemoryPost = {
  id: string
  title: string | null
  body: string
  memory_date: string
  category_id: string | null
  category_name?: string | null
  tags: string[]
  visibility: 'shared' | 'personal'
  author_id: string | null
}

export type MemoryFilter = {
  query: string
  tags: string[]
  categoryId: string
  from: string
  to: string
}

export const SUGGESTED_TAGS = ['viagem', 'conquista', 'engraçado', 'ideia', 'importante'] as const

/** Normaliza tag: minúscula, sem acento, sem espaços extras, máx. 30. */
export function normalizeTag(raw: string): string | null {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 30)
  return cleaned === '' ? null : cleaned
}

export function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const tag = normalizeTag(part)
    if (tag) seen.add(tag)
    if (seen.size >= 10) break
  }
  return [...seen]
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Busca textual (título + corpo, sem acento) combinada com filtros. */
export function searchMemories(posts: MemoryPost[], filter: MemoryFilter): MemoryPost[] {
  const query = normalizeText(filter.query.trim())
  const words = query === '' ? [] : query.split(/\s+/)

  return posts
    .filter((post) => {
      if (filter.categoryId && post.category_id !== filter.categoryId) return false
      if (filter.from && post.memory_date < filter.from) return false
      if (filter.to && post.memory_date > filter.to) return false
      if (filter.tags.length > 0 && !filter.tags.every((tag) => post.tags.includes(tag))) {
        return false
      }
      if (words.length > 0) {
        const haystack = normalizeText(`${post.title ?? ''} ${post.body}`)
        if (!words.every((word) => haystack.includes(word))) return false
      }
      return true
    })
    .sort((a, b) => (a.memory_date < b.memory_date ? 1 : a.memory_date > b.memory_date ? -1 : 0))
}

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export type UploadCheck = { ok: true } | { ok: false; reason: string }

/** Validação de arquivo antes do upload (MIME + tamanho). */
export function checkUpload(file: { type: string; size: number }): UploadCheck {
  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'Tipo de arquivo não permitido (use JPG, PNG, WebP ou GIF).' }
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'Arquivo maior que 5 MB.' }
  }
  return { ok: true }
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Caminho no bucket: sempre dentro da pasta da casa. */
export function postMediaPath(householdId: string, randomId: string, mime: string): string {
  const extension = EXTENSION_BY_MIME[mime] ?? 'bin'
  return `posts/${householdId}/${randomId}.${extension}`
}

export function slotMediaPath(householdId: string, userId: string, slot: number, mime: string): string {
  const extension = EXTENSION_BY_MIME[mime] ?? 'bin'
  return `slots/${householdId}/${userId}-${slot}.${extension}`
}
