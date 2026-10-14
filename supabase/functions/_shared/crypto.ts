// Utilidades criptográficas das Edge Functions (Deno).
// A chave Groq em repouso usa AES-256-GCM. A chave de criptografia
// (GROQ_ENC_KEY, 32 bytes em base64) vive SOMENTE nos segredos da função.

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function importEncKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('GROQ_ENC_KEY') ?? ''
  const bytes = base64ToBytes(raw.trim())
  if (bytes.length !== 32) {
    throw new Error('GROQ_ENC_KEY ausente ou inválida (esperados 32 bytes em base64).')
  }
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

/** Criptografa texto. Saída: "iv_base64:cipher_base64". */
export async function encryptText(plain: string): Promise<string> {
  const key = await importEncKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`
}

/** Descriptografa "iv_base64:cipher_base64". */
export async function decryptText(payload: string): Promise<string> {
  const key = await importEncKey()
  const separator = payload.indexOf(':')
  if (separator < 0) throw new Error('Formato criptografado inválido.')
  const iv = base64ToBytes(payload.slice(0, separator))
  const cipher = base64ToBytes(payload.slice(separator + 1))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}
