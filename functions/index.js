const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const Stripe = require('stripe')

admin.initializeApp()

const STRIPE_SECRET = defineSecret('STRIPE_SECRET')

const PACKAGES = {
  coins_100:  { coins: 100,  price: 990 },
  coins_300:  { coins: 300,  price: 2490 },
  coins_1000: { coins: 1000, price: 6990 },
  coins_2000: { coins: 2000, price: 12990 },
  coins_5000: { coins: 5000, price: 29990 },
  coins_10000:{ coins: 10000,price: 54990 }
}

exports.createCheckout = onRequest(
  { secrets: [STRIPE_SECRET] },
  async (req, res) => {
    try {
      const { packId, uid, liveId } = req.body

      if (!PACKAGES[packId]) {
        return res.status(400).json({ error: 'Pacote inválido' })
      }

      if (!uid) {
        return res.status(401).json({ error: 'Usuário não autenticado' })
      }

      const stripe = new Stripe(STRIPE_SECRET.value())

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: `Pacote de ${PACKAGES[packId].coins} moedas`
              },
              unit_amount: PACKAGES[packId].price
            },
            quantity: 1
          }
        ],
        metadata: {
          uid,
          packId,
          coins: PACKAGES[packId].coins,
          liveId: liveId || ''
        },
        success_url: `https://seusite.com/live-room.html?liveId=${liveId}&payment=success`,
        cancel_url: `https://seusite.com/live-room.html?liveId=${liveId}&payment=cancel`
      })

      res.json({ url: session.url })

    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Erro ao criar checkout' })
    }
  }
)


const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')

exports.stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
    rawBody: true
  },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET.value())

    let event
    try {
      const sig = req.headers['stripe-signature']
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      )
    } catch (err) {
      console.error('Webhook inválido', err.message)
      return res.status(400).send(`Webhook Error`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const { uid, coins, packId } = session.metadata

      const userRef = admin.firestore().collection('users').doc(uid)

      await admin.firestore().runTransaction(async tx => {
        const snap = await tx.get(userRef)
        if (!snap.exists) return

        tx.update(userRef, {
          balance: admin.firestore.FieldValue.increment(Number(coins))
        })

        tx.set(admin.firestore().collection('coin_purchases').doc(session.id), {
          uid,
          packId,
          coins: Number(coins),
          amount: session.amount_total,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        })
      })
    }

    res.json({ received: true })
  }
)


async function startStripeCheckout(packId) {
  const res = await fetch(
    'https://us-central1-connectfamilia-312dc.cloudfunctions.net/createCheckout',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packId,
        uid: currentUser.uid,
        liveId: new URLSearchParams(window.location.search).get('liveId')
      })
    }
  )

  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  }
}

const params = new URLSearchParams(window.location.search)

if (params.get('payment') === 'success') {
  showAppAlert(
    'success',
    '🎉 Pagamento confirmado!',
    'Suas moedas já estão disponíveis. Aproveite a live! 💎🔥'
  )
}
