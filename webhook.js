app.post(
  '/stripe-webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {

    const sig = req.headers['stripe-signature']
    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      return res.status(400).send(`Webhook Error`)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object

      const userId = session.metadata.userId
      const coins = Number(session.metadata.coins)

      const userRef =
        db.collection('users').doc(userId)

      await userRef.update({
        balance:
          firebase.firestore.FieldValue.increment(coins)
      })

      // 💎 lucro da plataforma
      await db.collection('platform_earnings').add({
        type: 'coin_purchase',
        amount: session.amount_total / 100,
        coins,
        userId,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      })
    }

    res.json({ received: true })
  }
)
