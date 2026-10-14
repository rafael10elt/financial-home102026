import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceState = {
  supportedRecognition: boolean
  supportedSynthesis: boolean
  listening: boolean
  speaking: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  speak: (text: string, lang?: string) => void
  stopSpeaking: () => void
}

type RecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionConstructor(): (new () => RecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  const ctor = w['SpeechRecognition'] ?? w['webkitSpeechRecognition']
  return (ctor ?? null) as (new () => RecognitionInstance) | null
}

/**
 * Voz: reconhecimento e síntese quando o navegador suporta.
 * Microfone SEMPRE ativado manualmente, com indicador visível.
 * Sem escuta permanente.
 */
export function useVoice(onFinalTranscript?: (text: string) => void): VoiceState {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const callbackRef = useRef(onFinalTranscript)

  useEffect(() => {
    callbackRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const supportedRecognition = getRecognitionConstructor() !== null
  const supportedSynthesis =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
      } catch {
        // Já parado.
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // Já parado.
    }
    setListening(false)
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getRecognitionConstructor()
    if (!Ctor) return
    stopListening()
    setTranscript('')
    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.onresult = (event) => {
      const results = event.results as unknown as { isFinal: boolean; 0: { transcript: string } }[]
      let interim = ''
      let final = ''
      for (const result of results) {
        if (result.isFinal) final += result[0]?.transcript ?? ''
        else interim += result[0]?.transcript ?? ''
      }
      setTranscript((final || interim).trim())
      if (final.trim()) callbackRef.current?.(final.trim())
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [stopListening])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string, lang = 'pt-BR') => {
      if (!supportedSynthesis) return
      stopSpeaking()
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 500))
      utterance.lang = lang
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
    },
    [supportedSynthesis, stopSpeaking],
  )

  return {
    supportedRecognition,
    supportedSynthesis,
    listening,
    speaking,
    transcript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
