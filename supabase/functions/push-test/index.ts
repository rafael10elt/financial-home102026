import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  type ExportedVapidKeys,
  type PushSubscription,
  Urgency,
} from 'jsr:@negrel/webpush@0.5.0'
import { HttpError, jsonResponse, requireUser } from '../_shared/auth.ts'

type StoredSubscription = {
  endpoint: string
  keys: { auth?: string; p256dh?: string }
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return jsonResponse({ ok: true })
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const { user, serviceClient } = await requireUser(request)
    const rawKeys = Deno.env.get('VAPID_KEYS')
    const contact = Deno.env.get('VAPID_SUBJECT')
    if (!rawKeys || !contact) throw new HttpError(503, 'PUSH_NOT_CONFIGURED')

    let exportedKeys: ExportedVapidKeys
    try {
      exportedKeys = JSON.parse(rawKeys) as ExportedVapidKeys
    } catch {
      throw new HttpError(503, 'PUSH_KEYS_INVALID')
    }

    const { data, error } = await serviceClient
      .from('push_subscriptions_fh')
      .select('endpoint, keys')
      .eq('user_id', user.id)
    if (error) throw new HttpError(500, 'PUSH_SUBSCRIPTIONS_LOAD_FAILED')

    const subscriptions = (data ?? []) as StoredSubscription[]
    if (subscriptions.length === 0) return jsonResponse({ sent: 0, failed: 0, reason: 'NO_SUBSCRIPTIONS' })

    const vapidKeys = await importVapidKeys(exportedKeys)
    const application = await ApplicationServer.new({ contactInformation: contact, vapidKeys })
    let sent = 0
    let failed = 0

    await Promise.all(subscriptions.map(async (stored) => {
      try {
        const subscription: PushSubscription = {
          endpoint: stored.endpoint,
          keys: {
            auth: stored.keys.auth ?? '',
            p256dh: stored.keys.p256dh ?? '',
          },
        }
        await application.subscribe(subscription).pushTextMessage(
          JSON.stringify({
            title: 'Financial Home',
            body: 'Notificações push configuradas e funcionando neste dispositivo.',
            tag: 'fh-push-test',
            url: '/configuracoes',
          }),
          { ttl: 60, urgency: Urgency.High },
        )
        sent += 1
      } catch (error) {
        failed += 1
        if (error instanceof PushMessageError && error.isGone()) {
          await serviceClient
            .from('push_subscriptions_fh')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', stored.endpoint)
        }
      }
    }))

    return jsonResponse({ sent, failed })
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.code }, error.status)
    return jsonResponse({ error: error instanceof Error ? error.message : 'PUSH_SEND_FAILED' }, 500)
  }
})
