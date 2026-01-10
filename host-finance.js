
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
auth.onAuthStateChanged(async user => {
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

  // ✅ AGORA SIM
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
async function loadGiftHistory(hostId) {
  const list = document.getElementById('giftHistoryList')
  list.innerHTML = ''

  const snap = await db
    .collection('users')
    .doc(hostId)
    .collection('gift_history')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  if (snap.empty) {
    list.innerHTML = '<p class="empty">Nenhum presente recebido</p>'
    return
  }

  snap.forEach(doc => {
    const g = doc.data()

    const item = document.createElement('div')
    item.className = 'gift-item'

    item.innerHTML = `
      <div>
        <strong>${g.senderName}</strong>
        <small>🎁 ${g.giftName}</small>
      </div>
      <div>
        <strong>+${g.value}</strong>
        <small>${formatDate(g.createdAt)}</small>
      </div>
    `

    list.appendChild(item)
  })
}
async function loadInviteEarnings(hostId) {
  const list = document.getElementById('inviteEarningsList')
  list.innerHTML = ''

  const snap = await db
    .collection('lives')
    .where('hostId', '==', hostId)
    .where('type', '==', 'private')
    .orderBy('createdAt', 'desc')
    .get()

  if (snap.empty) {
    list.innerHTML =
      '<p class="empty">Nenhuma live privada</p>'
    return
  }

  snap.forEach(doc => {
    const live = doc.data()

    const item = document.createElement('div')
    item.className = 'live-earnings-item'

    item.innerHTML = `
      <div>
        <strong>${live.title || 'Live privada'}</strong>
        <small>👥 ${live.paid_viewers || 0} pagantes</small>
      </div>
      <div>
        <strong>+${live.total_invite_earnings || 0}</strong>
        <small>Entrada</small>
      </div>
    `

    list.appendChild(item)
  })
}



// CONTROLE DO MODAL
const chartsModal = document.getElementById('chartsModal')

document
  .getElementById('openChartsBtn')
  .onclick = () => {
    chartsModal.classList.remove('hidden')
    loadCharts()
  }

document
  .getElementById('closeChartsBtn')
  .onclick = () => {
    chartsModal.classList.add('hidden')
  }


  //CARREGA FONTE DE DADOS
  async function loadCharts() {
  const snap = await db
    .collection('transactions')
    .where('to', '==', currentUser.uid)
    .orderBy('createdAt')
    .get()

  const byLive = {}
  const byDate = {}
  let gifts = 0
  let invites = 0

  snap.forEach(doc => {
    const t = doc.data()
    const date = t.createdAt?.toDate().toLocaleDateString()

    // por live
    byLive[t.liveId] = (byLive[t.liveId] || 0) + t.amount

    // por tempo
    byDate[date] = (byDate[date] || 0) + t.amount

    // por tipo
    if (t.type === 'gift') gifts += t.amount
    if (t.type === 'private_entry') invites += t.amount
  })

  renderCharts(byLive, byDate, gifts, invites)
}


// RENDERIZAÇAO DE GRAFICOS 

function renderCharts(byLive, byDate, gifts, invites) {

  // 💰 Ganhos por live
  new Chart(document.getElementById('earningsByLiveChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(byLive),
      datasets: [{
        label: 'Ganhos por live',
        data: Object.values(byLive)
      }]
    }
  })

  // ⏱️ Ganhos ao longo do tempo
  new Chart(document.getElementById('earningsOverTimeChart'), {
    type: 'line',
    data: {
      labels: Object.keys(byDate),
      datasets: [{
        label: 'Ganhos ao longo do tempo',
        data: Object.values(byDate)
      }]
    }
  })

  // 🎁 Origem dos ganhos
  new Chart(document.getElementById('earningsByTypeChart'), {
    type: 'doughnut',
    data: {
      labels: ['Presentes', 'Entradas privadas'],
      datasets: [{
        data: [gifts, invites]
      }]
    }
  })
}
