import { useState } from 'react'
import { useAuth } from '../../auth/context'
import { useHousehold } from '../../household/context'
import { useToast } from '../../ui/toastContext'
import { Card, CardDescription, CardTitle } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { Modal } from '../../ui/Modal'

export function HouseholdSettingsSection() {
  const { state, refresh, renameHousehold } = useHousehold()
  const { user } = useAuth()
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function copyCode() {
    if (state.kind !== 'ready' || !state.household.join_code) return
    try {
      await navigator.clipboard.writeText(state.household.join_code)
      notify('success', 'Código copiado', 'Envie esse código para a pessoa que vai entrar na casa.')
    } catch {
      notify('error', 'Não foi possível copiar', 'Selecione o código e copie manualmente.')
    }
  }

  async function saveName() {
    setBusy(true)
    const result = await renameHousehold(name)
    setBusy(false)
    if (result.error) {
      notify('error', 'Não foi possível salvar', result.error)
      return
    }
    notify('success', 'Casa atualizada', 'O nome da casa foi salvo.')
    setEditing(false)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="mb-1">Gerenciar casa</CardTitle>
          <CardDescription>Nome, convite e pessoas vinculadas a esta casa.</CardDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refresh()}>Atualizar</Button>
      </div>

      {state.kind === 'loading' && <p className="mt-4 text-sm text-muted-foreground" role="status">Carregando dados da casa…</p>}
      {state.kind === 'error' && <p className="mt-4 text-sm text-destructive" role="alert">{state.message}</p>}
      {state.kind === 'none' && <p className="mt-4 text-sm text-muted-foreground">Nenhuma casa vinculada a este perfil.</p>}
      {state.kind === 'ready' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Nome da casa</p>
            <p className="mt-1 font-medium">{state.household.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">Seu perfil: {state.household.created_by === user?.id ? 'Administrador' : 'Membro'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.household.created_by === user?.id && (
                <Button size="sm" variant="secondary" onClick={() => { setName(state.household.name); setEditing(true) }}>Renomear</Button>
              )}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">Código para convidar</p>
            {state.household.join_code ? (
              <>
                <p className="mt-1 break-all font-mono text-lg font-semibold tracking-wider">{state.household.join_code}</p>
                <Button className="mt-3" size="sm" variant="secondary" onClick={() => void copyCode()}>Copiar código</Button>
              </>
            ) : <p className="mt-1 text-sm text-muted-foreground">Código não disponível.</p>}
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-medium">Pessoas ({state.members.length})</h3>
            {state.members.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {state.members.map((member) => (
                  <li key={member.user_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <span>{member.display_name || 'Perfil sem nome'}{member.user_id === user?.id ? ' (você)' : ''}</span>
                    <span className="text-xs text-muted-foreground">{member.role === 'owner' ? 'Administrador' : 'Membro'}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Não foi possível carregar a lista de pessoas.</p>}
          </div>
        </div>
      )}

      {editing && (
        <Modal title="Renomear casa" onClose={() => setEditing(false)}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nome da casa
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void saveName()} disabled={busy || !name.trim()}>{busy ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </Modal>
      )}
    </Card>
  )
}
