// =====================================================
// VARIÁVEIS GLOBAIS
// =====================================================
let currentUser = null
// ===============================
// CONFIGURAÇÃO FINANCEIRA GLOBAL
// ===============================
const COIN_VALUE_BRL = 0.05        // R$ 0,05 por moeda
const PLATFORM_FEE = 0.10          // 10% de taxa
const MIN_WITHDRAW_COINS = 100     // mínimo para saque

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

const withdrawModal = document.getElementById('withdrawModal')
const closeWithdrawBtn = document.getElementById('closeWithdrawBtn')
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn')

const withdrawAvailable = document.getElementById('withdrawAvailable')

const coinsInput = document.getElementById('coinsInput')
const grossValueEl = document.getElementById('grossValue')
const feeValueEl = document.getElementById('feeValue')
const netValueEl = document.getElementById('netValue')



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
  loadWithdrawHistory()
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
// ==========================
// 💸 SAQUE
// ==========================


// --------------------------
// Abrir modal de saque
// --------------------------
withdrawBtn?.addEventListener('click', () => {
  withdrawAvailable.textContent =
    document.getElementById('availableAmount')?.textContent || 0

  coinsInput.value = ''
  grossValueEl.textContent = 'R$ 0,00'
  feeValueEl.textContent = 'R$ 0,00'
  netValueEl.textContent = 'R$ 0,00'

  withdrawModal.classList.remove('hidden')
})

// --------------------------
// Fechar modal
// --------------------------
closeWithdrawBtn?.addEventListener('click', () => {
  withdrawModal.classList.add('hidden')
})

// --------------------------
// Utils
// --------------------------
function formatBRL(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function getAvailableCoins() {
  return Number(withdrawAvailable.textContent) || 0
}

// --------------------------
// Calculadora de saque
// --------------------------
function calculateWithdraw() {
  const coins = Number(coinsInput.value) || 0

  const gross = coins * COIN_VALUE_BRL
  const fee = gross * PLATFORM_FEE
  const net = gross - fee

  grossValueEl.textContent = formatBRL(gross)
  feeValueEl.textContent = formatBRL(fee)
  netValueEl.textContent = formatBRL(net)
}

coinsInput?.addEventListener('input', calculateWithdraw)
calculateWithdrawBtn?.addEventListener('click', calculateWithdraw)

// --------------------------
// Confirmar saque
// --------------------------
// =======================
// 💸 SAQUE (VERSÃO FINAL)
// =======================

confirmWithdrawBtn?.addEventListener('click', async () => {
  const coins = Number(coinsInput.value) || 0
  const available = Number(withdrawAvailable.textContent) || 0

  // ❌ validações
  if (!coins || coins <= 0) {
    showAppAlert(
      'warning',
      '⚠️ Valor inválido',
      'Informe a quantidade de moedas.'
    )
    return
  }

  if (available <= 0 || coins > available) {
    showAppAlert(
      'error',
      '❌ Saldo insuficiente',
      getRandomMotivationalMessage()
    )
    return
  }

  if (coins < MIN_WITHDRAW_COINS) {
    showAppAlert(
      'warning',
      '⚠️ Saque mínimo',
      `O mínimo para saque é ${MIN_WITHDRAW_COINS} moedas.`
    )
    return
  }

  // 💰 cálculos
  const gross = coins * COIN_VALUE_BRL
  const fee = gross * PLATFORM_FEE
  const net = gross - fee

  // 🔗 referências CORRETAS
  const userRef = db.collection('users').doc(currentUser.uid)
  const withdrawRef = db.collection('withdraw_requests').doc()

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)

      if (!userDoc.exists) {
        throw new Error('Usuário não encontrado')
      }

      const currentAvailable =
        Number(userDoc.data().earnings_available) || 0

      if (coins > currentAvailable) {
        throw new Error('Saldo insuficiente')
      }

      // 🔻 desconta saldo
      transaction.update(userRef, {
        earnings_available: currentAvailable - coins
      })

      // 💾 registra saque
      transaction.set(withdrawRef, {
        userId: currentUser.uid,
        coins,
        grossAmount: gross,
        platformFee: fee,
        netAmount: net,
        status: 'pending_review',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
    })

    // ✅ UI
    withdrawModal.classList.add('hidden')

    showAppAlert(
      'success',
      '✅ Saque solicitado!',
      'O valor foi descontado do seu saldo e está em análise.'
    )

    // 🔄 Atualiza valores na tela
    withdrawAvailable.textContent = available - coins
    document.getElementById('availableAmount').textContent =
      available - coins

  } catch (error) {
    console.error(error)

    showAppAlert(
      'error',
      '❌ Erro ao solicitar saque',
      error.message || 'Tente novamente.'
    )
  }
})

// --------------------------
// 🎯 Gatilhos motivacionais
// --------------------------
function getRandomMotivationalMessage() {
  const messages = [
    '🚀 Cada live é uma nova chance de faturar alto. Continue ao vivo!',
    '🔥 Hosts consistentes são os que mais lucram. A próxima live pode surpreender!',
    '💎 Quanto mais tempo ao vivo, maior a confiança do público — e os ganhos.',
    '📈 Seus números crescem live após live. Continue transmitindo!',
    '🎯 Grandes resultados vêm de quem insiste. Faça mais uma live hoje!',
    '💰 O público certo aparece para quem continua. Sua próxima live pode explodir!',
    '🌟 Hosts de sucesso não desistem. Continue transmitindo!',
    '⏱️ Mais tempo ao vivo = mais moedas.',
    '📊 Seu potencial é maior que este saldo. Continue!',
    '🏆 Os hosts que mais ganham são os que mais aparecem.'
  ]

  return messages[Math.floor(Math.random() * messages.length)]
}


  function showAppAlert(type, title, message) {
  const alertBox = document.getElementById('appAlert')
  const icon = document.getElementById('appAlertIcon')
  const titleEl = document.getElementById('appAlertTitle')
  const messageEl = document.getElementById('appAlertMessage')
  const btn = document.getElementById('appAlertBtn')

  alertBox.className = `app-alert ${type}`
  titleEl.textContent = title
  messageEl.textContent = message

  icon.textContent =
    type === 'success' ? '✅' :
    type === 'error' ? '❌' :
    '⚠️'

  alertBox.classList.remove('hidden')

  btn.onclick = () => {
    alertBox.classList.add('hidden')
  }
}




async function loadWithdrawHistory() {
  if (!currentUser) return

  const list = document.getElementById('withdrawHistoryList')
  if (!list) return

  list.innerHTML = ''

  let snap

  try {
    snap = await db
      .collection('withdraw_requests')
      .where('userId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
  } catch (err) {
    console.error('Erro ao buscar saques:', err)

    list.innerHTML =
      '<p class="empty">Erro ao carregar histórico</p>'
    return
  }

  if (snap.empty) {
    list.innerHTML =
      '<p class="empty">Nenhum saque realizado</p>'
    return
  }

  snap.forEach(doc => {
    const d = doc.data()

    const item = document.createElement('div')
    item.className = 'withdraw-item'

    item.innerHTML = `
      <div class="withdraw-left">
        <strong>🪙 ${d.coins || 0} moedas</strong>
        <small>Solicitado em ${formatDate(d.createdAt)}</small>
        ${
          d.reviewedAt
            ? `<small>Aprovado em ${formatDate(d.reviewedAt)}</small>`
            : ''
        }
      </div>

      <div class="withdraw-right">
        <strong>${formatBRL(d.netAmount)}</strong>
        <div class="withdraw-status ${d.status}">
          ${formatWithdrawStatus(d.status)}
        </div>
      </div>
    `

    list.appendChild(item)
  })
}

async function loadWithdrawHistory() {
  if (!currentUser) return

  const list = document.getElementById('withdrawHistoryList')
  if (!list) return

  list.innerHTML = ''

  let snap

  try {
    snap = await db
      .collection('withdraw_requests')
      .where('userId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
  } catch (err) {
    console.error('Erro ao buscar saques:', err)

    list.innerHTML =
      '<p class="empty">Erro ao carregar histórico</p>'
    return
  }

  if (snap.empty) {
    list.innerHTML =
      '<p class="empty">Nenhum saque realizado</p>'
    return
  }

  snap.forEach(doc => {
    const d = doc.data()

    const item = document.createElement('div')
    item.className = 'withdraw-item'

    item.innerHTML = `
      <div class="withdraw-left">
        <strong>🪙 ${d.coins || 0} moedas</strong>
        <small>Solicitado em ${formatDate(d.createdAt)}</small>
        ${
          d.reviewedAt
            ? `<small>Aprovado em ${formatDate(d.reviewedAt)}</small>`
            : ''
        }
      </div>

      <div class="withdraw-right">
        <strong>${formatBRL(d.netAmount)}</strong>
        <div class="withdraw-status ${d.status}">
          ${formatWithdrawStatus(d.status)}
        </div>
      </div>
    `

    list.appendChild(item)
  })
}


function formatWithdrawStatus(status) {
  if (status === 'pending_review') return '⏳ Em análise'
  if (status === 'approved') return '✅ Aprovado'
  if (status === 'rejected') return '❌ Rejeitado'
  return status
}

function formatDate(ts) {
  if (!ts) return '-'
  return ts.toDate().toLocaleDateString('pt-BR')
}

function formatBRL(value) {
  const v = Number(value)
  if (!v || isNaN(v)) return 'R$ 0,00'

  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}
