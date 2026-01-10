let currentUser = null
let earningsByLiveChart = null
let earningsOverTimeChart = null
let earningsByTypeChart = null
let efficiencyChart = null

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

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html'
    return
  }

  currentUser = user

  // aqui você pode carregar dados financeiros básicos
  loadFinanceData()
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



//GRAFICOS DE BARRAS 
function buildEfficiencyData(lives) {
  const labels = []
  const values = []

  lives.forEach(live => {
    if (!live.startedAt || !live.endedAt) return

    const durationMin =
      (live.endedAt.toDate() - live.startedAt.toDate()) / 60000

    if (durationMin <= 0) return

    const total =
      (live.total_invite_earnings || 0) +
      (live.totalGiftsValue || 0)

    labels.push(live.title || 'Live')
    values.push((total / durationMin).toFixed(2))
  })

  return { labels, values }
}

const ctx = document
  .getElementById('efficiencyChart')
  .getContext('2d')

efficiencyChart = new Chart(ctx, {
  type: 'scatter',
  data: {
    datasets: [{
      label: 'Tempo de live × Faturamento',
      data: efficiencyData
    }]
  }
})



//RANKING DAS LIVES MAIS LUCRATIVAS Tipo Tabela + gráfico horizontal

function buildRanking(lives) {
  return lives
    .map(l => ({
      title: l.title || 'Live',
      total:
        (l.total_invite_earnings || 0) +
        (l.totalGiftsValue || 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
}


ranking.forEach((l, i) => {
  rankingList.innerHTML += `
    <li>
      <strong>#${i + 1} ${l.title}</strong>
      <span>${l.total} coins</span>
    </li>
  `
})

// EXPORTAR RELATORIO 
function exportCSV(data) {
  const rows = [
    ['Live', 'Total ganhos', 'Presentes', 'Entradas']
  ]

  data.forEach(l => {
    rows.push([
      l.title,
      l.total,
      l.totalGiftsValue || 0,
      l.total_invite_earnings || 0
    ])
  })

  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })

  downloadFile(blob, 'relatorio-lives.csv')
}


function exportPDF(data) {
  const doc = new jsPDF()

  doc.text('Relatório financeiro do host', 14, 16)

  doc.autoTable({
    startY: 24,
    head: [['Live', 'Total', 'Presentes', 'Entradas']],
    body: data.map(l => [
      l.title,
      l.total,
      l.totalGiftsValue || 0,
      l.total_invite_earnings || 0
    ])
  })

  doc.save('relatorio-financeiro.pdf')
}


// GRAFICOS DE PREVISAO DE GANHOS

function buildForecast(dailyEarnings) {
  const avg =
    dailyEarnings.reduce((a, b) => a + b, 0) /
    dailyEarnings.length

  return Array(7).fill(avg)
}

new Chart(forecastChart, {
  type: 'line',
  data: {
    labels: ['D+1','D+2','D+3','D+4','D+5','D+6','D+7'],
    datasets: [{
      label: 'Previsão de ganhos',
      data: forecast
    }]
  }
})



const openChartsBtn = document.getElementById('openChartsBtn')
const closeChartsBtn = document.getElementById('closeChartsBtn')

openChartsBtn.addEventListener('click', () => {
  chartsModal.classList.remove('hidden')

  // ⏱️ Espera o modal aparecer antes de desenhar
  setTimeout(() => {
    renderCharts()
  }, 100)
})

closeChartsBtn.addEventListener('click', () => {
  chartsModal.classList.add('hidden')
})



async function renderCharts() {
  const snap = await db
    .collection('transactions')
    .where('to', '==', auth.currentUser.uid)
    .orderBy('createdAt')
    .get()

  if (snap.empty) return

  const byLive = {}
  const byType = { gift: 0, private_entry: 0 }
  const byDate = {}

  snap.forEach(doc => {
    const t = doc.data()
    const date = t.createdAt?.toDate().toLocaleDateString()

    // por live
    byLive[t.liveId] = (byLive[t.liveId] || 0) + t.amount

    // por tipo
    byType[t.type] = (byType[t.type] || 0) + t.amount

    // por data
    byDate[date] = (byDate[date] || 0) + t.amount
  })

  drawEarningsByLive(byLive)
  drawEarningsOverTime(byDate)
  drawEarningsByType(byType)
}


//GRAFICOS DE GANHOS POR LIVE 
function drawEarningsByLive(data) {
  const ctx = document
    .getElementById('earningsByLiveChart')
    .getContext('2d')

  if (earningsByLiveChart) earningsByLiveChart.destroy()

  earningsByLiveChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: 'Ganhos por live',
        data: Object.values(data)
      }]
    },
    options: { responsive: true }
  })
}

// GANHOS AO LONGO DO TEMPO
function drawEarningsOverTime(data) {
  const ctx = document
    .getElementById('earningsOverTimeChart')
    .getContext('2d')

  if (earningsOverTimeChart) earningsOverTimeChart.destroy()

  earningsOverTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: 'Ganhos por dia',
        data: Object.values(data),
        tension: 0.3
      }]
    }
  })
}


//GANHOS POR Tipo
function drawEarningsByType(data) {
  const ctx = document
    .getElementById('earningsByTypeChart')
    .getContext('2d')

  if (earningsByTypeChart) earningsByTypeChart.destroy()

  earningsByTypeChart = new Chart(ctx, {
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
  })
}
