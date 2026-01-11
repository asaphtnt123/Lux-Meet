let selectedPack = null

document.querySelectorAll('.coin-pack').forEach(pack => {
  pack.addEventListener('click', () => {
    document.querySelectorAll('.coin-pack')
      .forEach(p => p.classList.remove('selected'))

    pack.classList.add('selected')

    selectedPack = {
      coins: Number(pack.dataset.coins),
      price: Number(pack.dataset.price)
    }
  })
})

document
  .getElementById('closeCoinsAlert')
  .onclick = () => {
    document.getElementById('coinsAlert')
      .classList.add('hidden')
  }

document
  .getElementById('buyCoinsBtn')
  .onclick = async () => {
    if (!selectedPack) {
      alert('Selecione um pacote')
      return
    }

    await startStripeCheckout(selectedPack)
  }


  async function startStripeCheckout(pack) {
  try {
    const res = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coins: pack.coins,
        price: pack.price
      })
    })

    const data = await res.json()

    if (!data.sessionId) {
      throw new Error('Erro ao iniciar pagamento')
    }

    const stripe = Stripe(STRIPE_PUBLIC_KEY)
    await stripe.redirectToCheckout({
      sessionId: data.sessionId
    })

  } catch (err) {
    console.error(err)
    alert('Erro ao processar pagamento')
  }
}
