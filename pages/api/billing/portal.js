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

  if (!profile?.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer found' })
  }

  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers['host']
  const baseUrl = `${proto}://${host}`

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/settings/profile`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('Stripe portal error:', err)
    res.status(500).json({ error: err.message })
  }
}
