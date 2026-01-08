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
  { id: "rose", name: "Rosa", emoji: "🌹", value: 5 },
  { id: "heart", name: "Coração", emoji: "❤️", value: 10 },
  { id: "diamond", name: "Diamante", emoji: "💎", value: 50 },
  { id: "crown", name: "Coroa", emoji: "👑", value: 100 }
]

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

  await validateAccess()
  await setupUI()

  renderGifts()
  bindLeaveButton()

  await startAgora(isHost ? "host" : "viewer")

  if (!isHost) {
    await registerViewer()
  }

  initChat()
  listenViewerCount()
  listenLiveStatus()

  document.getElementById("loading").classList.add("hidden")
  document.getElementById("app").classList.remove("hidden")
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
  const hostSnap = await db.collection("users").doc(liveData.hostId).get()
  const host = hostSnap.data()

  document.getElementById("hostName").textContent = host.name || "Host"
  document.getElementById("hostAvatar").src =
    host.profilePhotoURL || "https://via.placeholder.com/50"
  document.getElementById("liveTitle").textContent =
    liveData.title || ""
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
  await db.collection("lives").doc(liveId)
    .collection("viewers").doc(currentUser.uid).set({
      uid: currentUser.uid,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
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
  const box = document.getElementById("giftsList")
  if (!box) return

  box.innerHTML = ""
  GIFTS.forEach(g => {
    const btn = document.createElement("button")
    btn.innerHTML = `${g.emoji} ${g.value}`
    btn.onclick = () => sendGift(g)
    box.appendChild(btn)
  })
}

async function sendGift(gift) {
  if (isHost) return alert("Host não envia presente")

  const userRef = db.collection("users").doc(currentUser.uid)
  const hostRef = db.collection("users").doc(liveData.hostId)

  await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef)
    if ((userSnap.data().balance || 0) < gift.value) {
      throw new Error("Saldo insuficiente")
    }

    tx.update(userRef, {
      balance: firebase.firestore.FieldValue.increment(-gift.value)
    })

    tx.update(hostRef, {
      earnings: firebase.firestore.FieldValue.increment(gift.value)
    })

    tx.set(
      db.collection("lives").doc(liveId).collection("gifts").doc(),
      {
        senderName: userData.name,
        giftName: gift.name,
        value: gift.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    )
  })
}

// =======================================
// LEAVE / END
// =======================================
function bindLeaveButton() {
  document.getElementById("leaveBtn").onclick = () => {
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
  liveEnded = true

  // Busca espectadores
  const viewersSnap = await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .get()

  const totalViewers = viewersSnap.size

  // Busca gifts
  const giftsSnap = await db
    .collection("lives")
    .doc(liveId)
    .collection("gifts")
    .get()

  let totalCoins = 0
  const giftCount = {}
  const ranking = {}

  giftsSnap.forEach(doc => {
    const g = doc.data()
    totalCoins += g.value

    giftCount[g.giftName] =
      (giftCount[g.giftName] || 0) + 1

    ranking[g.senderName] =
      (ranking[g.senderName] || 0) + g.value
  })

  const topGifters = Object.entries(ranking)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="host-summary-overlay">
      <div class="host-summary-box">

        <h2>📊 Live Finalizada</h2>

        <div class="summary-cards">
          <div class="summary-card">
            <span>👁</span>
            <strong>${totalViewers}</strong>
            <small>Espectadores</small>
          </div>

          <div class="summary-card">
            <span>💰</span>
            <strong>${totalCoins}</strong>
            <small>Coins ganhos</small>
          </div>
        </div>

        <div class="summary-section">
          <h3>🎁 Presentes recebidos</h3>
          ${
            Object.keys(giftCount).length === 0
              ? "<p>Nenhum presente recebido</p>"
              : Object.entries(giftCount)
                  .map(
                    g =>
                      `<div class="summary-row">${g[0]} <span>${g[1]}x</span></div>`
                  )
                  .join("")
          }
        </div>

        <div class="summary-section">
          <h3>🏆 Top apoiadores</h3>
          ${
            topGifters.length === 0
              ? "<p>Nenhum apoiador</p>"
              : topGifters
                  .map(
                    g =>
                      `<div class="summary-row">${g[0]} <span>${g[1]} coins</span></div>`
                  )
                  .join("")
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




