import { stripe } from '../../../lib/stripe'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export const config = { api: { bodyParser: false } }

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  let event

  try {
    const buf = await getRawBody(req)
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.user_id
        if (!userId) break
        await supabaseAdmin.from('profiles').update({
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan: 'pro',
        }).eq('id', userId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle()
        if (!profile) break
        await supabaseAdmin.from('profiles').update({
          plan: sub.status === 'active' ? 'pro' : 'free',
        }).eq('id', profile.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle()
        if (!profile) break
        await supabaseAdmin.from('profiles').update({
          plan: 'free',
          stripe_subscription_id: null,
        }).eq('id', profile.id)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }

  res.json({ received: true })
}
