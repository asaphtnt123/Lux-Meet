// =======================================
// CONFIG
// =======================================
const AGORA_APP_ID = "c44b5f29eeca4848b3c5ba4c3c9a5d8d"

// =======================================
// FIREBASE
// =======================================
let auth, db
let currentUser = null
let userData = null
let liveId = null
let liveData = null

let isHost = false
let liveEnded = false

let viewerCount = 0
let viewerUnsub = null
let chatUnsub = null
let giftsUnsub = null

// =======================================
// AGORA
// =======================================
let client = null
let localTracks = []

// =======================================
// GIFTS
// =======================================
const GIFTS = [
  {
    id: 'rose',
    name: 'Rosa',
    emoji: '🌹',
    value: 10
  },
  {
    id: 'fire',
    name: 'Fogo',
    emoji: '🔥',
    value: 50
  },
  {
    id: 'diamond',
    name: 'Diamante',
    emoji: '💎',
    value: 100
  },
  {
    id: 'crown',
    name: 'Coroa',
    emoji: '👑',
    value: 300
  }
]

const params = new URLSearchParams(window.location.search)

if (params.get('payment') === 'success') {
  showAppAlert(
    'success',
    '🎉 Pagamento confirmado!',
    'Suas moedas já estão disponíveis. Aproveite a live 💎🔥'
  )

  // limpa URL
  window.history.replaceState({}, document.title, window.location.pathname + '?liveId=' + params.get('liveId'))
}



const COIN_INTERNAL_VALUE = 0.035 // valor real por moeda (host)
const PLATFORM_USE_FEE = 0.10     // 10% na entrada/gift

// =======================================
// INIT
// =======================================
document.addEventListener("DOMContentLoaded", init)

function init() {
  const params = new URLSearchParams(window.location.search)
  liveId = params.get("liveId")

  if (!liveId) {
    alert("Live inválida")
    location.href = "lux-meet-live.html"
    return
  }

  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
      authDomain: "connectfamilia-312dc.firebaseapp.com",
      projectId: "connectfamilia-312dc"
    })
  }

  auth = firebase.auth()
  db = firebase.firestore()

  auth.onAuthStateChanged(handleAuth)

if (currentUser.uid === hostId) {
  addFriendBtn.style.display = 'none'
}


}

// =======================================
// AUTH FLOW
// =======================================
async function handleAuth(user) {
  if (!user) {
    location.href = "/login.html"
    return
  }

  currentUser = user

  await loadUser()
  await loadLive()

  isHost = liveData.hostId === currentUser.uid
  toggleGiftsForRole()
  


  await validateAccess()
  await setupUI()
  bindLeaveButton()
bindExtraUI()

  renderGifts()
  initGiftsUI() // 👈 TEM que ser aqui

  bindLeaveButton()

  await startAgora(isHost ? "host" : "viewer")

  if (!isHost) {
    await registerViewer()
  }
listenToGifts()

  initChat()
  listenViewerCount()
  listenLiveStatus()
renderGifts()

  document.getElementById("loading").classList.add("hidden")
  document.getElementById("app").classList.remove("hidden")
}



function toggleGiftsForRole() {
  const openGiftsBtn = document.getElementById("openGiftsBtn")
  const giftsPanel = document.getElementById("giftsPanel")

  if (!openGiftsBtn || !giftsPanel) return

  if (isHost) {
    openGiftsBtn.style.display = "none"
    giftsPanel.classList.add("hidden")
  } else {
    openGiftsBtn.style.display = "flex"
  }
}

// =======================================
// LOAD DATA
// =======================================
async function loadUser() {
  const snap = await db.collection("users").doc(currentUser.uid).get()
  if (!snap.exists) {
    alert("Usuário inválido")
    location.href = "lux-meet-live.html"
  }
  userData = snap.data()
}

async function loadLive() {
  const snap = await db.collection("lives").doc(liveId).get()
  if (!snap.exists || snap.data().status !== "active") {
    alert("Live encerrada")
    location.href = "lux-meet-live.html"
  }
  liveData = snap.data()
}

// =======================================
// ACCESS
// =======================================
async function validateAccess() {
  if (liveData.type === "public" || isHost) return

  const viewerSnap = await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)
    .get()

  if (!viewerSnap.exists) {
    alert("Acesso não autorizado")
    location.href = "lux-meet-live.html"
  }
}

// =======================================
// UI
// =======================================
async function setupUI() {
  const hostSnap = await db
    .collection("users")
    .doc(liveData.hostId)
    .get()

  if (!hostSnap.exists) return

  const host = hostSnap.data()

  const hostNameEl = document.getElementById("hostName")
  const hostAvatarEl = document.getElementById("hostAvatar")
  const liveTitleEl = document.getElementById("liveTitle")

  if (hostNameEl) {
    hostNameEl.textContent = host.name || "Host"
  }

  if (hostAvatarEl) {
    hostAvatarEl.src =
      host.profilePhotoURL || "https://via.placeholder.com/50"
  }

  if (liveTitleEl) {
    liveTitleEl.textContent = liveData.title || ""
  }
}


// =======================================
// AGORA
// =======================================
async function startAgora(role) {
  const res = await fetch("/.netlify/functions/getAgoraToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelName: liveId, role })
  })

  const { token, uid } = await res.json()

  client = AgoraRTC.createClient({ mode: "live", codec: "vp8" })
  await client.setClientRole(role === "host" ? "host" : "audience")
  await client.join(AGORA_APP_ID, liveId, token, uid || null)

  if (role === "host") {
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
    localTracks[1].play("videoContainer")
    await client.publish(localTracks)
  }

  client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType)
    if (mediaType === "video") user.videoTrack.play("videoContainer")
    if (mediaType === "audio") user.audioTrack.play()
  })
}

// =======================================
// VIEWERS
// =======================================
async function registerViewer() {
  if (!currentUser) return

  const viewerRef = db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)

  await viewerRef.set(
    {
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      paid: false
    },
    { merge: true }
  )
}


function listenViewerCount() {
  viewerUnsub = db.collection("lives").doc(liveId)
    .collection("viewers")
    .onSnapshot(snap => {
      viewerCount = snap.size
      const el = document.getElementById("viewerCount")
      if (el && !liveEnded) {
        el.textContent = `👁 ${viewerCount}`
      }
    })
}

// =======================================
// LIVE STATUS
// =======================================
function listenLiveStatus() {
  db.collection("lives").doc(liveId)
    .onSnapshot(doc => {
      if (!doc.exists) return
      if (doc.data().status !== "finished") return

      liveEnded = true

      if (isHost) {
        showLiveSummary()
      } else {
        showViewerEndedScreen()
      }
    })
}

// =======================================
// CHAT + GIFTS
// =======================================
function initChat() {
  chatUnsub = db.collection("lives").doc(liveId)
    .collection("chat")
    .orderBy("createdAt", "asc")
    .limit(100)
    .onSnapshot(snap => {
      snap.docChanges().forEach(c => {
        if (c.type === "added") renderMessage(c.doc.data())
      })
    })

  document.getElementById("chatForm")
    .addEventListener("submit", sendMessage)
}

async function sendMessage(e) {
  e.preventDefault()
  const input = document.getElementById("chatInput")
  if (!input.value.trim()) return

  await db.collection("lives").doc(liveId)
    .collection("chat").add({
      name: userData.name,
      text: input.value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

  input.value = ""
}

function renderMessage(msg) {
  const box = document.getElementById("chatMessages")
  const div = document.createElement("div")
  div.className = "chat-message"
  div.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`
  box.appendChild(div)
  box.scrollTop = box.scrollHeight
}

// =======================================
// GIFTS UI
// =======================================
function renderGifts() {
  const container = document.getElementById("giftsList")
  if (!container || !Array.isArray(GIFTS)) return

  container.innerHTML = ""

  GIFTS.forEach(gift => {
    if (!gift || !gift.id) return

    const btn = document.createElement("button")
    btn.className = "gift-btn"
    btn.innerHTML = `
      <span class="gift-emoji">${gift.emoji}</span>
      <span class="gift-name">${gift.name}</span>
      <span class="gift-price">${gift.value} coins</span>
    `
    btn.onclick = () => sendGift(gift)
    container.appendChild(btn)
  })
}

async function sendGift(gift) {
  if (!currentUser || !liveData) return
  if (currentUser.uid === liveData.hostId) return

  const userRef = db.collection('users').doc(currentUser.uid)
  const hostRef = db.collection('users').doc(liveData.hostId)
  const liveRef = db.collection('lives').doc(liveId)

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      const hostSnap = await tx.get(hostRef)
      const liveSnap = await tx.get(liveRef)

      if (!userSnap.exists) throw new Error('Usuário não encontrado')
      if (!hostSnap.exists) throw new Error('Host não encontrado')
      if (!liveSnap.exists) throw new Error('Live não encontrada')

      const balance = userSnap.data().balance || 0
      if (balance < gift.value) {
        throw new Error('Saldo insuficiente')
      }

      // 💰 MODELO HÍBRIDO
      const gross = gift.value * COIN_INTERNAL_VALUE
      const platformCut = gross * PLATFORM_USE_FEE
      const hostNet = gross - platformCut

      // 🔻 desconta moedas do espectador
      tx.update(userRef, {
        balance: firebase.firestore.FieldValue.increment(-gift.value)
      })

      // 🔺 host recebe (PENDENTE)
      tx.update(hostRef, {
        earnings_pending:
          firebase.firestore.FieldValue.increment(hostNet),
        total_earnings:
          firebase.firestore.FieldValue.increment(hostNet)
      })

      // 📊 ATUALIZA LIVE (ESSENCIAL PARA O SUMMARY)
      tx.update(liveRef, {
        totalCoins:
          firebase.firestore.FieldValue.increment(gift.value)
      })

      // 🎁 salva gift na live (realtime + histórico)
      tx.set(
        liveRef.collection('gifts').doc(),
        {
          giftId: gift.id,
          giftName: gift.name,
          emoji: gift.emoji,
          value: gift.value,
          senderId: currentUser.uid,
          senderName: userData.name || 'Usuário',
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()
        }
      )

      // 💰 histórico global
      tx.set(db.collection('transactions').doc(), {
        type: 'gift',
        coins: gift.value,
        grossAmount: gross,
        netAmount: hostNet,
        platformFee: platformCut,
        from: currentUser.uid,
        to: liveData.hostId,
        liveId,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      })

      // 💎 lucro da plataforma
      tx.set(db.collection('platform_earnings').doc(), {
        type: 'gift',
        amount: platformCut,
        liveId,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      })

      // 🎁 histórico do host
      tx.set(
        hostRef.collection('gift_history').doc(),
        {
          liveId,
          senderId: currentUser.uid,
          senderName: userData.name || 'Usuário',
          giftId: gift.id,
          giftName: gift.name,
          coins: gift.value,
          netAmount: hostNet,
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()
        }
      )

      // 💬 mensagem no chat
      tx.set(liveRef.collection('chat').doc(), {
        system: true,
        name: '🎁 Sistema',
        text: `${userData.name} enviou ${gift.emoji} ${gift.name} (${gift.value} coins)`,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      })
    })

    showGiftAnimation(gift)

  } catch (err) {
    console.error(err)
    showAppAlert('error', 'Erro ao enviar presente', err.message)
  }
}


function listenToGifts() {
  giftsUnsub = db
  .collection("lives")
  .doc(liveId)
  .collection("gifts")
  .orderBy("createdAt", "desc")
  .limit(20)
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const g = change.doc.data() || {}


        // mensagem no chat
       renderMessage({
  name: "🎁 Presente",
  text: `
    <span class="gift-msg">
      ${g.senderName || 'Alguém'} enviou 
      <strong>${g.emoji || '🎁'} ${g.giftName || 'Presente'}</strong>
      (${g.value || 0} coins)
    </span>
  `
})




        // animação global
        showGiftAnimation({
          emoji: getGiftEmoji(g.giftId),
          name: g.giftName
        })
      }
    })
  })

}

function showGiftAnimation({ emoji, name }) {
  const el = document.createElement("div")
  el.className = "gift-animation"
  el.textContent = `${emoji} ${name}`

  document.body.appendChild(el)

  setTimeout(() => {
    el.remove()
  }, 3000)
}

// =======================================
// LEAVE / END
// =======================================
function bindLeaveButton() {
  const leaveBtn = document.getElementById("leaveBtn")

  if (!leaveBtn) {
    console.warn("❌ leaveBtn não encontrado no DOM")
    return
  }

  leaveBtn.onclick = () => {
    if (isHost) endLiveAsHost()
    else leaveLive()
  }
}


async function leaveLive() {
  if (chatUnsub) chatUnsub()
  if (viewerUnsub) viewerUnsub()

  if (client) await client.leave()

  await db.collection("lives").doc(liveId)
    .collection("viewers").doc(currentUser.uid).delete()

  location.href = "lux-meet-live.html"
}

async function endLiveAsHost() {
  if (!confirm(`Finalizar live?\n👁 ${viewerCount} espectadores`)) return

  await db.collection("lives").doc(liveId).update({
    status: "finished",
    endedAt: firebase.firestore.FieldValue.serverTimestamp()
  })

  if (localTracks.length) {
    localTracks.forEach(t => { t.stop(); t.close() })
  }

  if (client) await client.leave()
}

// =======================================
// SCREENS
// =======================================

async function showLiveSummary() {
  const liveRef = db.collection('lives').doc(liveId)

  const liveSnap = await liveRef.get()
  if (!liveSnap.exists) return

  const live = liveSnap.data()

  const totalViewers =
    live.unique_viewers_count || 0

  const totalCoins =
    live.totalCoins || 0

  // ⏱️ duração REAL
  let durationMinutes = 0
  if (live.startedAt) {
    const end = new Date()
    const start = live.startedAt.toDate()
    durationMinutes = Math.max(
      1,
      Math.floor((end - start) / 60000)
    )
  }

  // 🔚 fecha live
  await liveRef.update({
    status: 'finished',
    endedAt:
      firebase.firestore.FieldValue.serverTimestamp()
  })

  // 🎁 ranking
  const giftsSnap =
    await liveRef.collection('gifts').get()

  const ranking = {}
  giftsSnap.forEach(doc => {
    const g = doc.data()
    ranking[g.senderName] =
      (ranking[g.senderName] || 0) + g.value
  })

  const topGifters = Object.entries(ranking)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // 🖥️ UI
  document.body.insertAdjacentHTML(
    'beforeend',
    `
    <div class="host-summary-overlay">
      <div class="host-summary-box">

        <h2>📊 Live Finalizada</h2>

        <div class="summary-cards">
          <div class="summary-card">
            <span>👁</span>
            <strong>${totalViewers}</strong>
            <small>Pessoas que entraram</small>
          </div>

          <div class="summary-card">
            <span>💰</span>
            <strong>${totalCoins}</strong>
            <small>Coins ganhos</small>
          </div>

          <div class="summary-card">
            <span>⏱</span>
            <strong>${durationMinutes} min</strong>
            <small>Duração</small>
          </div>
        </div>

        <div class="summary-section">
          <h3>🏆 Top apoiadores</h3>
          ${
            topGifters.length === 0
              ? '<p>Nenhum apoiador</p>'
              : topGifters
                  .map(
                    g =>
                      `<div class="summary-row">
                        ${g[0]}
                        <span>${g[1]} coins</span>
                      </div>`
                  )
                  .join('')
          }
        </div>

        <button class="summary-ok"
          onclick="location.href='lux-meet-live.html'">
          Finalizar
        </button>

      </div>
    </div>
    `
  )
}



function showViewerEndedScreen() {
  liveEnded = true

  document.body.innerHTML = `
    <div class="viewer-ended">
      <div class="viewer-ended-box">
        <h2>📴 Live encerrada</h2>
        <p>O host finalizou a transmissão</p>

        <div class="viewer-actions">
          <button onclick="followHost()">⭐ Tornar fã</button>
          <button onclick="addFriend()">👤 Adicionar amigo</button>
          <button onclick="openGiftPanel()">🎁 Enviar presente</button>
        </div>

        <button class="viewer-back"
          onclick="location.href='lux-meet-live.html'">
          Voltar
        </button>
      </div>
    </div>
  `
}


function followHost() {
  alert("⭐ Agora você é fã do host!")
}

function addFriend() {
  alert("👤 Pedido de amizade enviado!")
}

function openGiftPanel() {
  alert("🎁 Envio de presentes disponível na próxima versão")
}






// =======================================
// GIFT HELPERS
// =======================================
function getGiftEmoji(giftId) {
  const gift = GIFTS.find(g => g.id === giftId)
  return gift ? gift.emoji : "🎁"
}

function initGiftsUI() {
  const openBtn = document.getElementById("openGiftsBtn")
  const closeBtn = document.getElementById("closeGiftsBtn")
  const panel = document.getElementById("giftsPanel")

  console.log("🎁 initGiftsUI", { openBtn, closeBtn, panel })

  if (!openBtn || !closeBtn || !panel) {
    console.warn("❌ Gifts UI não encontrada no DOM")
    return
  }

  openBtn.addEventListener("click", () => {
    console.log("🎁 Abrindo painel de gifts")
    panel.classList.remove("hidden")
  })

  closeBtn.addEventListener("click", () => {
    console.log("❌ Fechando painel de gifts")
    panel.classList.add("hidden")
  })
}

function bindExtraUI() {
  const addFriendBtn = document.getElementById("addFriendBtn")
  if (addFriendBtn) {
    addFriendBtn.onclick = () => {
      alert("Pedido de amizade enviado 💛")
    }
  }

  const privateBtn = document.getElementById("privateChatBtn")
  if (privateBtn) {
    privateBtn.onclick = () => alert("Abrir chat privado 💬")
  }

  const moreBtn = document.getElementById("moreOptionsBtn")
  if (moreBtn) {
    moreBtn.onclick = () => alert("Opções: Reportar / Compartilhar")
  }
}




document.getElementById('privateChatBtn').addEventListener('click', () => {
  alert('Abrir chat privado 💬')
})

document.getElementById('moreOptionsBtn').addEventListener('click', () => {
  alert('Opções: Reportar / Compartilhar')
})


// buy coins 

function showCoinsAlert() {
  document.getElementById('coinsAlert').classList.remove('hidden')
}

document
  .getElementById('closeCoinsAlert')
  ?.addEventListener('click', () => {
    document.getElementById('coinsAlert').classList.add('hidden')
  })

// selecionar pacote
let selectedPackage = null

document.querySelectorAll('.coin-pack').forEach(pack => {
  pack.addEventListener('click', () => {

    // remove seleção de todos
    document.querySelectorAll('.coin-pack').forEach(p =>
      p.classList.remove('selected')
    )

    // adiciona no clicado
    pack.classList.add('selected')

    selectedPackage = {
      coins: pack.dataset.coins,
      price: pack.dataset.price
    }

    console.log('Pacote selecionado:', selectedPackage)
  })
})

// comprar moedas


document.querySelectorAll('.coin-pack').forEach(pack => {
  pack.addEventListener('click', () => {
    document
      .querySelectorAll('.coin-pack')
      .forEach(p => p.classList.remove('selected'))

    pack.classList.add('selected')
    selectedPackage = pack.dataset.pack
  })
})

document.getElementById('buyCoinsBtn')?.addEventListener('click', async () => {
  if (!selectedPackage) {
    showAppAlert(
      'warning',
      'Selecione um pacote',
      'Escolha um pacote de moedas para continuar 💎'
    )
    return
  }

  try {
    const liveId = new URLSearchParams(window.location.search).get('liveId')

    const res = await fetch(
      'https://us-central1-connectfamilia-312dc.cloudfunctions.net/createCheckout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: selectedPackage,
          uid: currentUser.uid,
          liveId
        })
      }
    )

    const data = await res.json()

    if (!data.url) {
      throw new Error('Erro ao iniciar pagamento')
    }

    window.location.href = data.url

  } catch (err) {
    console.error(err)
    showAppAlert(
      'error',
      'Erro no pagamento',
      'Não foi possível iniciar a compra. Tente novamente.'
    )
  }
})


document.getElementById('closeCoinsAlert')?.addEventListener('click', () => {
  document.getElementById('coinsAlert').classList.add('hidden')
})

async function registerViewerPresence() {
  if (!currentUser || !liveId) return

  const viewerRef = db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)

  await viewerRef.set(
    {
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      paid: false
    },
    { merge: true }
  )
}
