// Gera ícones PNG do PWA sem dependências externas (zlib nativo do Node).
// Uso: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function setPixel(rgba, width, x, y, color, alpha = 1) {
  if (alpha <= 0) return
  const i = (y * width + x) * 4
  const a = Math.min(1, alpha)
  rgba[i] = Math.round(rgba[i] * (1 - a) + color[0] * a)
  rgba[i + 1] = Math.round(rgba[i + 1] * (1 - a) + color[1] * a)
  rgba[i + 2] = Math.round(rgba[i + 2] * (1 - a) + color[2] * a)
  rgba[i + 3] = 255
}

function fillRect(rgba, width, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(rgba, width, x, y, color)
  }
}

function fillCircle(rgba, width, size, cx, cy, radius, color, ring = 0) {
  const inner = ring > 0 ? radius - ring : 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (ring > 0) {
        if (d <= radius && d >= inner) setPixel(rgba, width, x, y, color)
      } else if (d <= radius) {
        setPixel(rgba, width, x, y, color)
      }
    }
  }
}

const BLUE = [29, 78, 216]
const LIGHT = [147, 197, 253]
const WHITE = [255, 255, 255]

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4)
  // fundo
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = BLUE[0]
    rgba[i * 4 + 1] = BLUE[1]
    rgba[i * 4 + 2] = BLUE[2]
    rgba[i * 4 + 3] = 255
  }

  const scale = size / 512
  const inset = maskable ? 0.72 : 1 // zona segura do maskable
  const unit = (v) => Math.round(v * scale * inset + (size * (1 - inset)) / 2)

  // "F"
  fillRect(rgba, size, unit(112), unit(144), unit(56), unit(224), WHITE)
  fillRect(rgba, size, unit(112), unit(144), unit(176), unit(56), WHITE)
  fillRect(rgba, size, unit(112), unit(244), unit(140), unit(52), WHITE)
  // anel do "H" estilizado
  fillCircle(rgba, size, size, unit(356), unit(316), unit(88), LIGHT, unit(40))
  fillCircle(rgba, size, size, unit(356), unit(316), unit(24), WHITE)
  return encodePng(size, size, rgba)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }))
console.log('Ícones gerados em', outDir)
