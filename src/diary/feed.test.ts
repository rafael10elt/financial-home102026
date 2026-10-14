import { describe, expect, it } from 'vitest'
import {
  checkUpload,
  normalizeTag,
  parseTags,
  postMediaPath,
  searchMemories,
  slotMediaPath,
  type MemoryPost,
} from './feed'

function post(partial: Partial<MemoryPost> & { id: string }): MemoryPost {
  return {
    title: null,
    body: '',
    memory_date: '2026-10-01',
    category_id: null,
    tags: [],
    visibility: 'shared',
    author_id: null,
    ...partial,
  }
}

describe('tags', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizeTag('  Engraçado! ')).toBe('engracado')
    expect(normalizeTag('viagem em família')).toBe('viagem-em-familia')
    expect(normalizeTag('!!!')).toBeNull()
  })

  it('extrai até 10 tags únicas', () => {
    expect(parseTags('viagem, Viagem, ideia, , conquista')).toEqual(['viagem', 'ideia', 'conquista'])
  })
})

describe('searchMemories', () => {
  const posts = [
    post({ id: 'a', title: 'Praia em Dublin', body: 'Dia incrível', memory_date: '2026-08-01', tags: ['viagem'] }),
    post({ id: 'b', title: 'Jantar', body: 'Receita nova de bacalhau', memory_date: '2026-10-01', tags: ['ideia'] }),
    post({ id: 'c', title: 'Mudança', body: 'Caixas por toda parte', memory_date: '2026-09-01', tags: ['viagem', 'importante'] }),
  ]

  it('busca sem acento e ordena por data (recentes primeiro)', () => {
    const result = searchMemories(posts, { query: 'incrivel', tags: [], categoryId: '', from: '', to: '' })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('combina tags + período', () => {
    const result = searchMemories(posts, {
      query: '',
      tags: ['viagem'],
      categoryId: '',
      from: '2026-09-01',
      to: '2026-10-31',
    })
    expect(result.map((p) => p.id)).toEqual(['c'])
  })

  it('exige todas as palavras', () => {
    const result = searchMemories(posts, { query: 'receita bacalhau', tags: [], categoryId: '', from: '', to: '' })
    expect(result.map((p) => p.id)).toEqual(['b'])
  })
})

describe('upload', () => {
  it('aceita imagens comuns até 5 MB', () => {
    expect(checkUpload({ type: 'image/jpeg', size: 1024 })).toEqual({ ok: true })
    expect(checkUpload({ type: 'image/png', size: 5 * 1024 * 1024 })).toEqual({ ok: true })
  })

  it('rejeita tipo e tamanho inválidos', () => {
    expect(checkUpload({ type: 'application/pdf', size: 100 }).ok).toBe(false)
    expect(checkUpload({ type: 'image/jpeg', size: 6 * 1024 * 1024 }).ok).toBe(false)
    expect(checkUpload({ type: 'image/jpeg', size: 0 }).ok).toBe(false)
  })

  it('gera caminhos sempre dentro da pasta da casa', () => {
    expect(postMediaPath('casa-1', 'abc', 'image/png')).toBe('posts/casa-1/abc.png')
    expect(slotMediaPath('casa-1', 'user-9', 3, 'image/jpeg')).toBe('slots/casa-1/user-9-3.jpg')
  })
})
