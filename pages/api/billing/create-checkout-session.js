import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { stripe } from '../../../lib/stripe'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  // リクエスト元ホストから base URL を動的に構築（ローカル開発 / 本番両対応）
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers['host']
  const baseUrl = `${proto}://${host}`

  const { plan_type } = req.body || {}
  const priceId = plan_type === 'yearly'
    ? process.env.STRIPE_PRO_PRICE_ID_YEARLY
    : process.env.STRIPE_PRO_PRICE_ID_MONTHLY

  if (!priceId) return res.status(500).json({ error: 'Price ID が設定されていません' })

  const params = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings/profile?upgrade=success`,
    cancel_url: `${baseUrl}/settings/profile`,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
  }

  if (profile?.stripe_customer_id) {
    params.customer = profile.stripe_customer_id
  } else {
    params.customer_email = user.email
  }

  try {
    const session = await stripe.checkout.sessions.create(params)
    res.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
