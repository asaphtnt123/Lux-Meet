// =====================================================
// VARIÁVEIS GLOBAIS
// =====================================================
let currentUser = null

let earningsByLiveChart = null
let earningsOverTimeChart = null
let earningsByTypeChart = null
let efficiencyChart = null

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
const withdrawBtn = document.getElementById('withdrawBtn')
// 💸 CONFIGURAÇÃO FINANCEIRA OFICIAL
const PLATFORM_FEE_PERCENT = 10 // 10%

// =====================================================
// AUTH ÚNICA
// =====================================================
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html'
    return
  }

  currentUser = user
  await loadFinanceCards()
  await loadTransactions(user.uid)
})

// =====================================================
// CARDS FINANCEIROS
// =====================================================
async function loadFinanceCards() {
  const snap = await db
    .collection('users')
    .doc(currentUser.uid)
    .get()

  if (!snap.exists) return

  const d = snap.data()

  document.getElementById('availableAmount').textContent =
    d.earnings_available || 0

  document.getElementById('pendingAmount').textContent =
    d.earnings_pending || 0

  document.getElementById('totalAmount').textContent =
    d.total_earnings || 0

  const withdrawBtn = document.getElementById('withdrawBtn')
  if ((d.earnings_available || 0) > 0) {
    withdrawBtn.classList.remove('hidden')
    withdrawBtn.onclick = () => {
      alert('Solicitação de saque enviada (manual)')
    }
  }
}

// =====================================================
// HISTÓRICO GLOBAL
// =====================================================
async function loadTransactions(hostId) {
  const list = document.getElementById('transactionsList')
  list.innerHTML = ''

  const snap = await db
    .collection('transactions')
    .where('to', '==', hostId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  if (snap.empty) {
    list.innerHTML =
      '<p class="empty">Nenhuma transação encontrada</p>'
    return
  }

  snap.forEach(doc => {
    const t = doc.data()

    const item = document.createElement('div')
    item.className = 'transaction-item'

    item.innerHTML = `
      <div>
        <strong>${formatType(t.type)}</strong>
        <small>${formatDate(t.createdAt)}</small>
      </div>
      <strong>+${t.amount}</strong>
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

// =====================================================
// MODAL DE GRÁFICOS
// =====================================================
const chartsModal = document.getElementById('chartsModal')

document.getElementById('openChartsBtn').onclick = () => {
  chartsModal.classList.remove('hidden')
  setTimeout(loadDashboard, 100)
}

document.getElementById('closeChartsBtn').onclick = () => {
  chartsModal.classList.add('hidden')
}

// =====================================================
// DASHBOARD PRINCIPAL
// =====================================================
async function loadDashboard() {
  const txSnap = await db
    .collection('transactions')
    .where('to', '==', currentUser.uid)
    .orderBy('createdAt')
    .get()

  const liveSnap = await db
    .collection('lives')
    .where('hostId', '==', currentUser.uid)
    .get()

  const byLive = {}
  const byDate = {}
  const byType = { gift: 0, private_entry: 0 }
  const lives = []

  txSnap.forEach(doc => {
    const t = doc.data()
    const date = t.createdAt?.toDate().toLocaleDateString()

    byLive[t.liveId] = (byLive[t.liveId] || 0) + t.amount
    byDate[date] = (byDate[date] || 0) + t.amount
    byType[t.type] += t.amount
  })

  liveSnap.forEach(doc => lives.push(doc.data()))

  drawEarningsByLive(byLive)
  drawEarningsOverTime(byDate)
  drawEarningsByType(byType)
  drawEfficiency(lives)
  drawRanking(lives)
}

// =====================================================
// GRÁFICOS
// =====================================================
function drawEarningsByLive(data) {
  if (earningsByLiveChart) earningsByLiveChart.destroy()

  earningsByLiveChart = new Chart(
    document.getElementById('earningsByLiveChart'),
    {
      type: 'bar',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Ganhos por live',
          data: Object.values(data)
        }]
      },
      options: { responsive: true }
    }
  )
}

function drawEarningsOverTime(data) {
  if (earningsOverTimeChart) earningsOverTimeChart.destroy()

  earningsOverTimeChart = new Chart(
    document.getElementById('earningsOverTimeChart'),
    {
      type: 'line',
      data: {
        labels: Object.keys(data),
        datasets: [{
          label: 'Ganhos ao longo do tempo',
          data: Object.values(data),
          tension: 0.3
        }]
      }
    }
  )
}

function drawEarningsByType(data) {
  if (earningsByTypeChart) earningsByTypeChart.destroy()

  earningsByTypeChart = new Chart(
    document.getElementById('earningsByTypeChart'),
    {
      type: 'doughnut',
      data: {
        labels: ['🎁 Presentes', '🔒 Entradas privadas'],
        datasets: [{
          data: [
            data.gift || 0,
            data.private_entry || 0
          ]
        }]
      }
    }
  )
}

// =====================================================
// EFICIÊNCIA (TEMPO × FATURAMENTO)
// =====================================================

function drawEfficiency(lives) {
  const canvas = document.getElementById('efficiencyChart')
  if (!canvas) return

  const data = []

  lives.forEach(l => {
    if (!l.startedAt || !l.endedAt) return

    const minutes =
      (l.endedAt.toDate() - l.startedAt.toDate()) / 60000

    if (minutes <= 0) return

    const total =
      (l.totalGiftsValue || 0) +
      (l.total_invite_earnings || 0)

    data.push({ x: minutes, y: total })
  })

  if (efficiencyChart) efficiencyChart.destroy()

  efficiencyChart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Tempo × Faturamento',
        data
      }]
    }
  })
}


// =====================================================
// RANKING DAS LIVES
// =====================================================
function drawRanking(lives) {
  const rankingList = document.getElementById('rankingList')
  rankingList.innerHTML = ''

  const ranked = lives
    .map(l => ({
      title: l.title || 'Live',
      total:
        (l.totalGiftsValue || 0) +
        (l.total_invite_earnings || 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  ranked.forEach((l, i) => {
    rankingList.innerHTML += `
      <li>
        <strong>#${i + 1} ${l.title}</strong>
        <span>${l.total} coins</span>
      </li>
    `
  })
}


// SAQUE

const withdrawModal = document.getElementById('withdrawModal')
const closeWithdrawBtn = document.getElementById('closeWithdrawBtn')
const withdrawInput = document.getElementById('withdrawInput')
const feeValue = document.getElementById('feeValue')
const netValue = document.getElementById('netValue')
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn')
const withdrawAvailable = document.getElementById('withdrawAvailable')

const PLATFORM_FEE = 0.10
const MIN_WITHDRAW = 100

// ABRIR MODAL
withdrawBtn.onclick = () => {
  withdrawModal.classList.remove('hidden')
  withdrawAvailable.textContent =
    document.getElementById('availableAmount').textContent
}

// FECHAR MODAL
closeWithdrawBtn.onclick = () => {
  withdrawModal.classList.add('hidden')
}

// CALCULADORA


withdrawInput?.addEventListener('input', () => {
  const value = Number(withdrawInput.value) || 0

  const fee = Math.floor((value * PLATFORM_FEE_PERCENT) / 100)
  const net = value - fee

  feeValue.textContent = fee
  netValue.textContent = net
})


// SOLICITAR SAQUE
confirmWithdrawBtn.onclick = async () => {
  const amount = Number(withdrawInput.value)

  if (amount < MIN_WITHDRAW) {
    alert(`Valor mínimo para saque é ${MIN_WITHDRAW}`)
    return
  }

  if (amount > Number(withdrawAvailable.textContent)) {
    alert('Saldo insuficiente')
    return
  }

  await db.collection('withdraw_requests').add({
    hostId: currentUser.uid,
    amount,
    fee: amount * PLATFORM_FEE,
    netAmount: amount * (1 - PLATFORM_FEE),
    status: 'pending_review',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  })

  alert('✅ Solicitação de saque enviada com sucesso')
  withdrawModal.classList.add('hidden')
}


// 🔘 ABRIR MODAL DE SAQUE
if (withdrawBtn) {
  withdrawBtn.addEventListener('click', () => {
    const available =
      Number(document.getElementById('availableAmount').textContent) || 0

    document.getElementById('withdrawAvailable').textContent = available
    document.getElementById('withdrawInput').value = ''
    document.getElementById('feeValue').textContent = '0'
    document.getElementById('netValue').textContent = '0'

    document
      .getElementById('withdrawModal')
      .classList.remove('hidden')
  })
}

//FECHAR MODAL SAQUE
document
  .getElementById('closeWithdrawBtn')
  ?.addEventListener('click', () => {
    document
      .getElementById('withdrawModal')
      .classList.add('hidden')
  })



  document
  .getElementById('confirmWithdrawBtn')
  ?.addEventListener('click', async () => {
    const amount = Number(withdrawInput.value)

    if (!amount || amount <= 0) {
      alert('Informe um valor válido')
      return
    }

    const fee = Math.floor((amount * PLATFORM_FEE_PERCENT) / 100)
    const netAmount = amount - fee

    try {
      await db.collection('withdraw_requests').add({
        hostId: currentUser.uid,
        requestedAmount: amount,
        platformFee: fee,
        netAmount,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })

      alert('✅ Solicitação de saque enviada!')
      document
        .getElementById('withdrawModal')
        .classList.add('hidden')
    } catch (err) {
      console.error(err)
      alert('Erro ao solicitar saque')
    }
  })
