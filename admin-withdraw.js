


// =====================================================
// FIREBASE INIT
// =====================================================
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
    authDomain: "connectfamilia-312dc.firebaseapp.com",
    projectId: "connectfamilia-312dc"
  })
}

const auth = firebase.auth()
const db = firebase.firestore()
const listEl = document.getElementById('withdrawList')
function formatBRL(value) {
  const safeValue = Number(value)

  if (!safeValue || isNaN(safeValue)) {
    return 'R$ 0,00'
  }

  return safeValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}


// 🔄 carregar saques pendentes
async function loadWithdraws() {
  const snap = await db
    .collection('withdraw_requests')
    .where('status', '==', 'pending_review')
    .orderBy('createdAt', 'desc')
    .get()

  if (snap.empty) {
    listEl.innerHTML = '<p>Nenhuma solicitação pendente</p>'
    return
  }

  listEl.innerHTML = ''

  snap.forEach(doc => {
    const d = doc.data()

    const div = document.createElement('div')
    div.className = 'withdraw-card'

    div.innerHTML = `
      <p><strong>Host:</strong> ${d.userId}</p>
      <p>🪙 Coins: ${d.coins}</p>
      <p>💰 Bruto: ${formatBRL(d.grossAmount || 0)}</p>
      <p>🏦 Taxa: ${formatBRL(d.platformFee || 0)}</p>
      <p>✅ Líquido: ${formatBRL(d.netAmount || 0)}</p>


      <div class="actions">
        <button class="approve">Aprovar</button>
        <button class="reject">Recusar</button>
      </div>
    `

    // ✅ aprovar
    div.querySelector('.approve').onclick = () =>
      updateWithdraw(doc.id, 'approved')

    // ❌ recusar
    div.querySelector('.reject').onclick = () =>
      updateWithdraw(doc.id, 'rejected')

    listEl.appendChild(div)
  })
}

// 🔧 atualizar status
async function updateWithdraw(id, status) {
  if (!confirm(`Confirmar ${status === 'approved' ? 'aprovação' : 'rejeição'}?`)) return

  await db.collection('withdraw_requests').doc(id).update({
    status,
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    reviewedBy: 'admin'
  })

  loadWithdraws()
}

loadWithdraws()


