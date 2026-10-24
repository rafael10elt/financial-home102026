import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { useAuth } from '../../auth/context'
import { useAgendaData } from '../../agenda/useAgenda'
import { useFinanceData } from '../../finance/useFinance'
import { useDiaryData } from '../../diary/useDiary'
import { buildDigest } from '../../assistant/digest'
import { useAssistantData } from '../../assistant/useAssistant'
import { useVoice } from '../../assistant/useVoice'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../../ui/Button'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Field, Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'
import { useToast } from '../../ui/toastContext'
import type { PendingConfirmation } from '../../assistant/tools'

type Tab = 'chat' | 'memory' | 'automations'

const assistantMarkdownComponents: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-2 leading-6 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-primary">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-primary">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-primary/60 pl-3 text-muted-foreground">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{children}</a>,
  table: ({ children }) => <div className="my-3 max-w-full overflow-hidden rounded-md border border-border"><table className="w-full table-fixed border-collapse text-left text-xs">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-background/70">{children}</thead>,
  th: ({ children }) => <th className="break-words border-b border-border px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="break-words border-b border-border px-2 py-1.5 align-top">{children}</td>,
  code: ({ children, className }) => <code className={className ?? 'rounded bg-background/70 px-1 py-0.5 font-mono text-xs'}>{children}</code>,
  pre: ({ children }) => <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-background/70 p-3 text-xs">{children}</pre>,
  hr: () => <hr className="my-3 border-border" />,
}

function hideInternalIds(content: string): string {
  return content.replace(/\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\b/gi, '')
}

export function AssistantPage() {
  const { t } = useI18n()
  const assistant = useAssistantData()
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('chat')
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [input, setInput] = useState('')
  const [chatError, setChatError] = useState<string | null>(null)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editingMemory, setEditingMemory] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [webhookName, setWebhookName] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedConversations, setSelectedConversations] = useState<string[]>([])
  const [confirmConversationDelete, setConfirmConversationDelete] = useState<'selected' | 'all' | null>(null)
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
      let message = t('ai.error.unknown')
      if (kind === 'no-key') message = t('ai.noKey')
      else if (kind === 'invalid') message = t('ai.error.invalid')
      else if (kind === 'quota') message = t('ai.error.quota')
      else if (kind === 'model') message = t('ai.error.model')
      else if (kind === 'session') message = t('ai.error.session')
      else if (result.code === 'FUNCTIONS_UNCONFIGURED' || result.code === 'CONVERSATION_FAILED') {
        message = t('ai.backendMissing')
      }
      setChatError(message)
      notify('error', 'Não consegui concluir a solicitação', message)
    } else if (result.confirmations.length > 0) {
      notify('info', 'Ação aguardando sua confirmação', 'Revise a prévia antes de autorizar a alteração.')
    }
  }

  async function handleDeleteConversations() {
    if (!confirmConversationDelete) return
    const ids = confirmConversationDelete === 'all' ? null : selectedConversations
    const result = await assistant.deleteConversations(ids)
    setConfirmConversationDelete(null)
    if (result.error) {
      notify('error', t('ai.deleteConversations'), result.error)
      return
    }
    setSelectedConversations([])
    notify('success', t('ai.deleteConversations'), t('ai.conversationsDeleted', { count: result.deleted }))
  }

  const keyMissing = assistant.keyStatus.checked && !assistant.keyStatus.configured

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t('ai.title')}</h1>
        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={() => void assistant.newConversation().then((id) => {
            if (id) notify('success', 'Nova conversa iniciada')
            else notify('error', 'Não foi possível iniciar uma conversa')
          }).catch((error: unknown) => notify('error', 'Não foi possível iniciar uma conversa', error instanceof Error ? error.message : String(error)))}>
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
          {assistant.conversations.length > 0 && (
            <Card>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{t('ai.conversations')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedConversations(
                    selectedConversations.length === assistant.conversations.length
                      ? []
                      : assistant.conversations.map((conversation) => conversation.id),
                  )}>
                    {selectedConversations.length === assistant.conversations.length ? t('ai.deselectAll') : t('ai.selectAll')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmConversationDelete('all')}>
                    {t('ai.deleteAll')}
                  </Button>
                  {selectedConversations.length > 0 && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmConversationDelete('selected')}>
                      {t('ai.deleteSelected', { count: selectedConversations.length })}
                    </Button>
                  )}
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {assistant.conversations.map((conversation) => (
                  <li key={conversation.id} className="flex items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedConversations.includes(conversation.id)}
                      onChange={(event) => setSelectedConversations((current) => event.target.checked
                        ? [...new Set([...current, conversation.id])]
                        : current.filter((id) => id !== conversation.id))}
                      aria-label={t('ai.selectConversation', { title: conversation.title || t('ai.tabs.chat') })}
                    />
                    <button
                      type="button"
                      onClick={() => assistant.setActiveId(conversation.id)}
                      aria-pressed={assistant.activeId === conversation.id}
                      className={`min-w-0 flex-1 truncate text-left text-sm ${assistant.activeId === conversation.id ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                    >
                      {(conversation.title || t('ai.tabs.chat')).slice(0, 48)}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
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
                    {message.role === 'assistant'
                      ? <div className="max-w-full break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantMarkdownComponents}>{hideInternalIds(message.content)}</ReactMarkdown></div>
                      : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
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
                          onClick={() => setPendingConfirmation(pending)}
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
          {pendingConfirmation && (
            <Modal title={t('ai.confirmTitle')} onClose={() => setPendingConfirmation(null)}>
              <p className="text-sm text-muted-foreground">{t('ai.confirmBody')}</p>
              <p className="mt-3 break-words rounded-md bg-muted p-3 text-sm">{pendingConfirmation.preview}</p>
              <p className="mt-2 text-xs text-muted-foreground">Ação: {pendingConfirmation.tool}</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPendingConfirmation(null)}>{t('common.cancel')}</Button>
                <Button disabled={assistant.sending} onClick={() => void assistant.confirmAction(pendingConfirmation.action_id).then((result) => {
                  setPendingConfirmation(null)
                  if (result.ok) {
                    notify('success', 'Ação concluída', result.reply)
                    assistant.reload()
                  } else {
                    notify('error', 'A ação não foi concluída', result.detail ?? result.code)
                  }
                }).catch((error: unknown) => {
                  setPendingConfirmation(null)
                  notify('error', 'A ação não foi concluída', error instanceof Error ? error.message : String(error))
                })}>{t('ai.confirmYes')}</Button>
              </div>
            </Modal>
          )}
          {confirmConversationDelete && (
            <Modal title={t('ai.deleteConversations')} onClose={() => setConfirmConversationDelete(null)}>
              <p className="text-sm text-muted-foreground">
                {confirmConversationDelete === 'all'
                  ? t('ai.deleteAllConfirm')
                  : t('ai.deleteSelectedConfirm', { count: selectedConversations.length })}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmConversationDelete(null)}>{t('common.cancel')}</Button>
                <Button variant="destructive" onClick={() => void handleDeleteConversations()}>{t('ai.deleteConversations')}</Button>
              </div>
            </Modal>
          )}
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
  const { notify } = useToast()
  const [deletingMemory, setDeletingMemory] = useState<{ id: string; content: string } | null>(null)

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
                      onClick={() => void assistant.updateMemory(memory.id, { content: editingContent.slice(0, 1000) }).then((result) => {
                        if (result.error) notify('error', 'Não foi possível atualizar a memória', result.error)
                        else {
                          notify('success', 'Memória atualizada')
                          setEditingMemory(null)
                          assistant.reload()
                        }
                      }).catch((error: unknown) => notify('error', 'Não foi possível atualizar a memória', error instanceof Error ? error.message : String(error)))}
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
                    onClick={() => void assistant.updateMemory(memory.id, { active: !memory.active }).then((result) => {
                      if (result.error) notify('error', 'Não foi possível alterar a memória', result.error)
                      else {
                        notify('success', memory.active ? 'Memória desativada' : 'Memória ativada')
                        assistant.reload()
                      }
                    }).catch((error: unknown) => notify('error', 'Não foi possível alterar a memória', error instanceof Error ? error.message : String(error)))}
                  >
                    {memory.active ? t('ai.memoryDisable') : t('ai.memoryEnable')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingMemory({ id: memory.id, content: memory.content })}
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
                ? void assistant.saveMemory(memoryDraft.trim()).then((result) => {
                    if (result.error) notify('error', 'Não foi possível salvar a memória', result.error)
                    else {
                      setMemoryDraft('')
                      assistant.reload()
                      notify('success', 'Memória salva')
                    }
                  }).catch((error: unknown) => notify('error', 'Não foi possível salvar a memória', error instanceof Error ? error.message : String(error)))
                : undefined
            }
          >
            {t('ai.memoryAdd')}
          </Button>
        </div>
      </Card>
      {deletingMemory && (
        <Modal title="Excluir memória?" onClose={() => setDeletingMemory(null)}>
          <p className="break-words text-sm text-muted-foreground">{deletingMemory.content}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingMemory(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => void assistant.deleteMemory(deletingMemory.id).then((result) => {
              setDeletingMemory(null)
              if (result.error) notify('error', 'Não foi possível excluir a memória', result.error)
              else {
                assistant.reload()
                notify('success', 'Memória excluída')
              }
            }).catch((error: unknown) => {
              setDeletingMemory(null)
              notify('error', 'Não foi possível excluir a memória', error instanceof Error ? error.message : String(error))
            })}>{t('ai.memoryDelete')}</Button>
          </div>
        </Modal>
      )}
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
  const { notify } = useToast()
  const [deletingWebhook, setDeletingWebhook] = useState<string | null>(null)

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
        const detail = t('ai.webhookFailed', { message: `HTTP ${response.status}` })
        setWebhookMsg(detail)
        notify('error', 'Falha ao enviar o resumo', detail)
        return
      }
      const detail = t('ai.webhookSent', { status: response.status })
      setWebhookMsg(detail)
      notify('success', 'Resumo enviado', detail)
    } catch (error) {
      const detail = t('ai.webhookFailed', { message: error instanceof Error ? error.message : String(error) })
      setWebhookMsg(detail)
      notify('error', 'Falha ao enviar o resumo', detail)
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
                .then((result) => {
                  if (result.error) notify('error', 'Não foi possível salvar a automação', result.error)
                  else {
                    setWebhookName('')
                    setWebhookUrl('')
                    assistant.reload()
                    notify('success', 'Automação salva')
                  }
                }).catch((error: unknown) => notify('error', 'Não foi possível salvar a automação', error instanceof Error ? error.message : String(error)))
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
                notify('success', 'Resumo copiado')
              }).catch((error: unknown) => notify('error', 'Não foi possível copiar o resumo', error instanceof Error ? error.message : String(error)))
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
                <Button size="sm" variant="ghost" onClick={() => setDeletingWebhook(hook.id)}>
                  {t('agenda.delete')}
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}

      {deletingWebhook && (
        <Modal title="Excluir automação?" onClose={() => setDeletingWebhook(null)}>
          <p className="text-sm text-muted-foreground">Esta ação removerá o webhook salvo. O workflow no n8n não será apagado.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletingWebhook(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => void assistant.deleteWebhook(deletingWebhook).then((result) => {
              setDeletingWebhook(null)
              if (result.error) notify('error', 'Não foi possível excluir a automação', result.error)
              else {
                assistant.reload()
                notify('success', 'Automação excluída')
              }
            }).catch((error: unknown) => {
              setDeletingWebhook(null)
              notify('error', 'Não foi possível excluir a automação', error instanceof Error ? error.message : String(error))
            })}>{t('agenda.delete')}</Button>
          </div>
        </Modal>
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
