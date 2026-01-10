
// =======================================
// FIREBASE INIT
// =======================================
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
    authDomain: "connectfamilia-312dc.firebaseapp.com",
    projectId: "connectfamilia-312dc"
  })
}

const auth = firebase.auth()
const db = firebase.firestore()

firebase.auth().onAuthStateChanged(async user => {
  if (!user) return

  const userRef = db.collection('users').doc(user.uid)
  const userSnap = await userRef.get()

  if (!userSnap.exists) return

  const data = userSnap.data()

  const available = data.earnings_available || 0
  const pending = data.earnings_pending || 0
  const total = data.total_earnings || 0

  document.getElementById('availableAmount').textContent = available
  document.getElementById('pendingAmount').textContent = pending
  document.getElementById('totalAmount').textContent = total

  const withdrawBtn = document.getElementById('withdrawBtn')
  if (available > 0) {
    withdrawBtn.classList.remove('hidden')
    withdrawBtn.onclick = () => {
      alert('Solicitação de saque enviada (manual)')
    }
  }

  loadTransactions(user.uid)
})

async function loadTransactions(hostId) {
  const list = document.getElementById('transactionsList')
  list.innerHTML = ''

  const snap = await db
    .collection('transactions')
    .where('to', '==', hostId)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()

  if (snap.empty) {
    list.innerHTML = '<p class="empty">Nenhuma transação encontrada</p>'
    return
  }

  snap.forEach(doc => {
    const t = doc.data()

    const item = document.createElement('div')
    item.className = 'transaction-item'

    item.innerHTML = `
      <div class="transaction-left">
        <strong>${formatType(t.type)}</strong>
        <small>${formatDate(t.createdAt)}</small>
      </div>

      <div class="transaction-right">
        <strong>+${t.amount}</strong>
        <small class="status-${t.status}">
          ${t.status}
        </small>
      </div>
    `

    list.appendChild(item)
  })
}

function formatType(type) {
  if (type === 'gift') return '🎁 Presente'
  if (type === 'private_entry') return '🔒 Live privada'
  return type
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate()
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}
