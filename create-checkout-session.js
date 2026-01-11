const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { coins, price } = req.body

    if (!coins || !price) {
      return res.status(400).json({ error: 'Pacote inválido' })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',

      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${coins} moedas`,
              description: 'Pacote de moedas LuxMeet'
            },
            unit_amount: price * 100
          },
          quantity: 1
        }
      ],

      success_url:
        'https://seusite.com/checkout-success.html',
      cancel_url:
        'https://seusite.com/checkout-cancel.html',

      metadata: {
        coins,
        userId: req.user.uid // se estiver autenticado
      }
    })

    res.json({ sessionId: session.id })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Stripe error' })
  }
})
