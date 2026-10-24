import { exportApplicationServerKey, exportVapidKeys, generateVapidKeys } from 'jsr:@negrel/webpush@0.5.0'

const pair = await generateVapidKeys({ extractable: true })
const privateConfig = await exportVapidKeys(pair)
const publicKey = await exportApplicationServerKey(pair)

console.log('VITE_VAPID_PUBLIC_KEY=' + publicKey)
console.log('VAPID_KEYS=' + JSON.stringify(privateConfig))
console.log('VAPID_SUBJECT=mailto:seu-email@exemplo.com')
