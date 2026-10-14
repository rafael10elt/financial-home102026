import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useAgendaData } from '../../agenda/useAgenda'
import { useFinanceData } from '../../finance/useFinance'
import { useDiaryData } from '../../diary/useDiary'
import { buildDigest } from '../../assistant/digest'
import { useAssistantData } from '../../assistant/useAssistant'
import { useVoice } from '../../assistant/useVoice'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'

type Tab = 'chat' | 'memory' | 'automations'

export function AssistantPage() {
  const { t } = useI18n()
  const assistant = useAssistantData()
  const [tab, setTab] = useState<Tab>('chat')
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editingMemory, setEditingMemory] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [webhookName, setWebhookName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const voice = useVoice((text) => setInput((current) => (current ? `${current} ${text}` : text)))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [assistant.messages.length, tab])

  async function handleSend() {
    const text = voice.transcript.trim() || input.trim()
    if (!text || assistant.sending) return
    voice.stopListening()
    setInput('')
    setChatError(null)
    const result = await assistant.sendMessage(text)
    if (!result.ok) {
      const kind = assistant.errorKind(result.code)
      if (kind === 'no-key') setChatError(t('ai.noKey'))
      else if (kind === 'invalid') setChatError(t('ai.error.invalid'))
      else if (kind === 'quota') setChatError(t('ai.error.quota'))
      else if (kind === 'model') setChatError(t('ai.error.model'))
      else if (kind === 'session') setChatError(t('ai.error.session'))
      else if (result.code === 'FUNCTIONS_UNCONFIGURED' || result.code === 'CONVERSATION_FAILED') {
        setChatError(t('ai.backendMissing'))
      } else setChatError(t('ai.error.unknown'))
    }
  }

  const keyMissing = assistant.keyStatus.checked && !assistant.keyStatus.configured

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('ai.title')}</h1>
        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={() => void assistant.newConversation()}>
            {t('ai.newChat')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('ai.title')}>
        {(['chat', 'memory', 'automations'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-md border border-primary bg-accent px-3 py-1.5 text-sm font-medium'
                : 'rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
            }
          >
            {t(`ai.tabs.${value}`)}
          </button>
        ))}
      </div>

      {keyMissing && (
        <Card>
          <p className="text-sm text-muted-foreground" role="status">
            {assistant.isOwner ? t('ai.noKeyOwner') : t('ai.noKeyMember')}
          </p>
        </Card>
      )}

      {tab === 'chat' && (
        <div className="flex flex-col gap-3">
          {assistant.conversations.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {assistant.conversations.slice(0, 10).map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => assistant.setActiveId(conversation.id)}
                  aria-pressed={assistant.activeId === conversation.id}
                  className={
                    assistant.activeId === conversation.id
                      ? 'rounded-md border border-primary bg-accent px-2.5 py-1 text-xs font-medium'
                      : 'rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground'
                  }
                >
                  {(conversation.title || 'Conversa').slice(0, 24)}
                </button>
              ))}
            </div>
          )}

          <Card>
            <div className="flex max-h-[50dvh] flex-col gap-3 overflow-y-auto" aria-live="polite">
              {assistant.messages.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('ai.inputPlaceholder')}</p>
              )}
              {assistant.messages.map((message) => (
                <div key={message.id} className="flex flex-col gap-1.5">
                  <div
                    className={
                      message.role === 'user'
                        ? 'self-end rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                        : 'self-start rounded-lg border border-border bg-muted px-3 py-2 text-sm'
                    }
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === 'assistant' && (
                      <button
                        type="button"
                        className="mt-1 text-xs underline opacity-70 hover:opacity-100"
                        onClick={() => voice.speak(message.content)}
                        disabled={!voice.supportedSynthesis || voice.speaking}
                      >
                        {voice.speaking ? t('ai.stop') : t('ai.speak')}
                      </button>
                    )}
                  </div>
                  {message.pending?.map((pending) => (
                    <div key={pending.action_id} className="self-start rounded-lg border border-primary/50 bg-card p-3 text-sm">
                      <p className="font-medium">{t('ai.confirmTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('ai.confirmBody')}</p>
                      <p className="mt-1 rounded bg-muted px-2 py-1 font-mono text-xs">{pending.preview}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{pending.tool}</p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          disabled={assistant.sending}
                          onClick={() => void assistant.confirmAction(pending.action_id).then(() => assistant.reload())}
                        >
                          {t('ai.confirmYes')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {chatError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {chatError}
              </p>
            )}

            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="ai-input" className="sr-only">
                  {t('ai.inputPlaceholder')}
                </label>
                <textarea
                  id="ai-input"
                  value={voice.transcript || input}
                  rows={2}
                  placeholder={t('ai.inputPlaceholder')}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  className="h-auto w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                {voice.supportedRecognition ? (
                  <Button
                    size="sm"
                    variant={voice.listening ? 'destructive' : 'secondary'}
                    onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
                    aria-pressed={voice.listening}
                    aria-label={t('ai.mic')}
                  >
                    {voice.listening ? '●' : '🎤'}
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => void handleSend()} disabled={assistant.sending}>
                  {assistant.sending ? t('common.loading') : t('ai.send')}
                </Button>
              </div>
            </div>
            {voice.listening && (
              <p className="mt-1 text-xs text-destructive" role="status">
                {t('ai.listening')}
              </p>
            )}
            {!voice.supportedRecognition && !voice.supportedSynthesis && (
              <p className="mt-1 text-xs text-muted-foreground">{t('ai.voiceUnsupported')}</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'memory' && (
        <MemoryTab
          memoryDraft={memoryDraft}
          setMemoryDraft={setMemoryDraft}
          editingMemory={editingMemory}
          setEditingMemory={setEditingMemory}
          editingContent={editingContent}
          setEditingContent={setEditingContent}
        />
      )}

      {tab === 'automations' && (
        <AutomationsTab
          webhookName={webhookName}
          setWebhookName={setWebhookName}
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          webhookMsg={webhookMsg}
          setWebhookMsg={setWebhookMsg}
          copied={copied}
          setCopied={setCopied}
        />
      )}
    </div>
  )
}

function MemoryTab({
  memoryDraft,
  setMemoryDraft,
  editingMemory,
  setEditingMemory,
  editingContent,
  setEditingContent,
}: {
  memoryDraft: string
  setMemoryDraft: (value: string) => void
  editingMemory: string | null
  setEditingMemory: (value: string | null) => void
  editingContent: string
  setEditingContent: (value: string) => void
}) {
  const { t } = useI18n()
  const assistant = useAssistantData()

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardTitle className="mb-2">{t('ai.memoryTitle')}</CardTitle>
        {assistant.memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ai.memoryEmpty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {assistant.memories.map((memory) => (
              <li key={memory.id} className={`flex items-start justify-between gap-2 py-2 text-sm ${memory.active ? '' : 'opacity-50'}`}>
                <div className="flex flex-col gap-1">
                  {editingMemory === memory.id ? (
                    <Input
                      value={editingContent}
                      maxLength={1000}
                      onChange={(e) => setEditingContent(e.target.value)}
                      aria-label={t('ai.memoryEdit')}
                    />
                  ) : (
                    <span>{memory.content}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {memory.user_id ? t('fin.unassigned') : t('agenda.visibility.shared')}
                    {!memory.active ? ` · ${t('ai.memoryDisable')}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  {editingMemory === memory.id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void assistant.updateMemory(memory.id, { content: editingContent.slice(0, 1000) }).then(() => {
                          setEditingMemory(null)
                          assistant.reload()
                        })
                      }
                    >
                      {t('common.save')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingMemory(memory.id)
                        setEditingContent(memory.content)
                      }}
                    >
                      {t('ai.memoryEdit')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void assistant.updateMemory(memory.id, { active: !memory.active }).then(() => assistant.reload())
                    }
                  >
                    {memory.active ? t('ai.memoryDisable') : t('ai.memoryEnable')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void assistant.deleteMemory(memory.id).then(() => assistant.reload())}
                  >
                    {t('ai.memoryDelete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex gap-2">
          <Input
            value={memoryDraft}
            maxLength={1000}
            placeholder={t('ai.memoryPlaceholder')}
            onChange={(e) => setMemoryDraft(e.target.value)}
            aria-label={t('ai.memoryAdd')}
          />
          <Button
            size="sm"
            onClick={() =>
              memoryDraft.trim()
                ? void assistant.saveMemory(memoryDraft.trim()).then(() => {
                    setMemoryDraft('')
                    assistant.reload()
                  })
                : undefined
            }
          >
            {t('ai.memoryAdd')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function AutomationsTab({
  webhookName,
  setWebhookName,
  webhookUrl,
  setWebhookUrl,
  webhookMsg,
  setWebhookMsg,
  copied,
  setCopied,
}: {
  webhookName: string
  setWebhookName: (value: string) => void
  webhookUrl: string
  setWebhookUrl: (value: string) => void
  webhookMsg: string | null
  setWebhookMsg: (value: string | null) => void
  copied: boolean
  setCopied: (value: boolean) => void
}) {
  const { t } = useI18n()
  const assistant = useAssistantData()
  const agenda = useAgendaData()
  const finance = useFinanceData()
  const diary = useDiaryData()
  const { user } = useAuth()

  const digest = buildDigest({
    date: new Date().toISOString().slice(0, 10),
    tasksOpen: agenda.tasks.filter((task) => task.status === 'open').length,
    tasksOverdue: agenda.tasks
      .filter((task) => task.status === 'open' && task.due_at && task.due_at < new Date().toISOString())
      .slice(0, 10)
      .map((task) => ({ title: task.title, dueAt: task.due_at })),
    eventsToday: [],
    remindersToday: [],
    finance: {
      incomeMinor: 0,
      expenseMinor: 0,
      pending: finance.transactions.filter((tx) => tx.status === 'pendente' || tx.status === 'previsto').length,
      overdue: 0,
      currency: 'EUR',
    },
    moods: diary.userMoods.slice(0, 5).map((entry) => ({
      user: entry.user_id === user?.id ? 'você' : entry.user_id.slice(0, 8),
      mood: entry.mood?.name ?? '?',
    })),
    unreadNotifications: agenda.notifications.filter((n) => !n.read_at).length,
  })
  const digestJson = JSON.stringify(digest, null, 2)

  async function sendToWebhook(url: string) {
    setWebhookMsg(null)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: digestJson,
      })
      if (!response.ok) {
        setWebhookMsg(t('ai.webhookFailed', { message: `HTTP ${response.status}` }))
        return
      }
      setWebhookMsg(t('ai.webhookSent', { status: response.status }))
    } catch (error) {
      setWebhookMsg(
        t('ai.webhookFailed', { message: error instanceof Error ? error.message : String(error) }),
      )
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardTitle className="mb-1">{t('ai.n8nTitle')}</CardTitle>
        <CardDescription className="mb-1">{t('ai.n8nHint')}</CardDescription>
        <CardDescription>{t('ai.digestNote')}</CardDescription>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('ai.webhookName')}>
            {(aria) => <Input {...aria} value={webhookName} maxLength={60} onChange={(e) => setWebhookName(e.target.value)} />}
          </Field>
          <Field label={t('ai.webhookUrl')}>
            {(aria) => (
              <Input
                {...aria}
                value={webhookUrl}
                inputMode="url"
                placeholder="https://n8n.exemplo.com/webhook/…"
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!webhookName.trim() || !webhookUrl.startsWith('https://') || !assistant.isOwner}
            onClick={() =>
              void assistant
                .saveWebhook({ name: webhookName.trim(), url: webhookUrl.trim(), events: ['digest'], active: true }, null)
                .then(() => {
                  setWebhookName('')
                  setWebhookUrl('')
                  assistant.reload()
                })
            }
          >
            {t('ai.webhookSave')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(digestJson).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? t('ai.webhookCopied') : t('ai.webhookCopy')}
          </Button>
        </div>
        {!assistant.isOwner && (
          <p className="mt-2 text-xs text-muted-foreground">{t('ai.keyOwnerOnly')}</p>
        )}
      </Card>

      {assistant.webhooks.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">{t('ai.webhookEmpty')}</p>
        </Card>
      ) : (
        assistant.webhooks.map((hook) => (
          <Card key={hook.id}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{hook.name}</span>
                <span className="break-all text-xs text-muted-foreground">{hook.url}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="secondary" onClick={() => void sendToWebhook(hook.url)}>
                  {t('ai.webhookSend')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void assistant.deleteWebhook(hook.id).then(() => assistant.reload())}>
                  {t('agenda.delete')}
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      {webhookMsg && (
        <p role="status" className="text-sm text-muted-foreground">
          {webhookMsg}
        </p>
      )}

      <Card>
        <CardTitle className="mb-2">digest.json</CardTitle>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px]">{digestJson}</pre>
      </Card>
    </div>
  )
}
