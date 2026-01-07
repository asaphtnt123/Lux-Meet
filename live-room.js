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

// =======================================
// AGORA
// =======================================
let client = null
let localTracks = []
let joined = false

// =======================================
// CHAT
// =======================================
let chatUnsub = null



// =======================================
// GIFTS CATALOG (FRONTEND)
// =======================================
const GIFTS = [
  {
    id: "rose",
    name: "Rosa",
    emoji: "🌹",
    value: 5
  },
  {
    id: "heart",
    name: "Coração",
    emoji: "❤️",
    value: 10
  },
  {
    id: "diamond",
    name: "Diamante",
    emoji: "💎",
    value: 50
  },
  {
    id: "crown",
    name: "Coroa",
    emoji: "👑",
    value: 100
  }
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
    return (location.href = "lux-meet-live.html")
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
// AUTH
// =======================================
async function handleAuth(user) {
  if (!user) return (location.href = "/login.html")

  currentUser = user

  await loadUser()
  await loadLive()
  await validateAccess()
  await setupUI()
  renderGifts()
  bindLeaveButton()



  const role =
    liveData.hostId === currentUser.uid ? "host" : "viewer"

  await startAgora(role)
  await registerViewer()
  initChat()
  watchViewerCount()

  db.collection("lives")
  .doc(liveId)
  .onSnapshot(doc => {
    if (!doc.exists) return
    if (doc.data().status === "ended") {
      showLiveEndedForViewer()
    }
  })


  document.getElementById("loading").classList.add("hidden")
  document.getElementById("app").classList.remove("hidden")
}

// =======================================
// LOAD USER
// =======================================
async function loadUser() {
  const snap = await db.collection("users").doc(currentUser.uid).get()
  if (!snap.exists) {
    alert("Usuário inválido")
    location.href = "lux-meet-live.html"
  }
  userData = snap.data()
}

// =======================================
// LOAD LIVE
// =======================================
async function loadLive() {
  const snap = await db.collection("lives").doc(liveId).get()
  if (!snap.exists || snap.data().status !== "active") {
    alert("Live encerrada")
    location.href = "lux-meet-live.html"
  }
  liveData = snap.data()
}

// =======================================
// VALIDATE ACCESS
// =======================================
async function validateAccess() {
  if (liveData.type === "public") return
  if (liveData.hostId === currentUser.uid) return

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

  document.getElementById("hostName").textContent =
    host.name || "Host"

  document.getElementById("hostAvatar").src =
    host.profilePhotoURL || "https://via.placeholder.com/50"

  document.getElementById("liveTitle").textContent =
    liveData.title || ""

document.getElementById("leaveBtn").onclick = () => {
  if (liveData.hostId === currentUser.uid) {
    openEndLiveModal()
  } else {
    leaveLive()
  }
}
}

// =======================================
// AGORA START
// =======================================
async function startAgora(role) {
  const response = await fetch("/.netlify/functions/getAgoraToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelName: liveId,
      role
    })
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const { token, uid } = await response.json()
  if (!token) throw new Error("Token inválido")

  client = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8"
  })

  await client.setClientRole(
    role === "host" ? "host" : "audience"
  )

  await client.join(
    AGORA_APP_ID,
    liveId,
    token,
    uid || null
  )

  joined = true

  // 🎥 HOST
  if (role === "host") {
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
    localTracks[1].play("videoContainer")
    await client.publish(localTracks)
  }

  // 👀 VIEWERS
  client.on("user-published", async (user, mediaType) => {
    await client.subscribe(user, mediaType)

    if (mediaType === "video") {
      user.videoTrack.play("videoContainer")
    }
    if (mediaType === "audio") {
      user.audioTrack.play()
    }
  })
}

// =======================================
// VIEWERS
// =======================================
async function registerViewer() {
  await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)
    .set(
      {
        uid: currentUser.uid,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
}

function watchViewerCount() {
  db.collection("lives")
    .doc(liveId)
    .collection("viewers")
    .onSnapshot(snap => {
      document.getElementById(
        "viewerCount"
      ).textContent = `👁 ${snap.size}`
    })
}

// =======================================
// CHAT
// =======================================
let giftsUnsub = null

function initChat() {
  // ================= CHAT TEXTO =================
  const chatRef = db
    .collection("lives")
    .doc(liveId)
    .collection("chat")
    .orderBy("createdAt", "asc")
    .limit(100)

  chatUnsub = chatRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        renderMessage(change.doc.data())
      }
    })
  })

  document
    .getElementById("chatForm")
    .addEventListener("submit", sendMessage)

  // ================= GIFTS =================
  const giftsRef = db
    .collection("lives")
    .doc(liveId)
    .collection("gifts")
    .orderBy("createdAt", "desc")
    .limit(20)

  giftsUnsub = giftsRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const g = change.doc.data()

        // Mostra no chat
        renderMessage({
          name: "🎁 Sistema",
          text: `${g.senderName} enviou ${g.giftName} (${g.value})`
        })

        // Animação (se quiser)
        showGiftAnimation({
          emoji: getGiftEmoji(g.giftId),
          name: g.giftName
        })
      }
    })
  })
}


function getGiftEmoji(giftId) {
  const gift = GIFTS.find(g => g.id === giftId)
  return gift ? gift.emoji : "🎁"
}


async function sendMessage(e) {
  e.preventDefault()

  const input = document.getElementById("chatInput")
  const text = input.value.trim()
  if (!text) return

  input.value = ""

  await db
    .collection("lives")
    .doc(liveId)
    .collection("chat")
    .add({
      uid: currentUser.uid,
      name: userData.name || "Usuário",
      photo: userData.profilePhotoURL || "",
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
}

function renderMessage(msg) {
  const container = document.getElementById("chatMessages")

  const div = document.createElement("div")
  div.className = "chat-message"

  div.innerHTML = `
    <strong>${msg.name}:</strong> ${msg.text}
  `

  container.appendChild(div)
  container.scrollTop = container.scrollHeight
}

// =======================================
// LEAVE
// =======================================
async function leaveLive() {
  if (chatUnsub) chatUnsub()
  if (giftsUnsub) giftsUnsub()

  localTracks.forEach(track => {
    track.stop()
    track.close()
  })

  if (client) await client.leave()

  await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)
    .delete()

  location.href = "lux-meet-live.html"
}


// gifts

function renderGifts() {
  const container = document.getElementById("giftsList")
  container.innerHTML = ""

  GIFTS.forEach(gift => {
    const btn = document.createElement("button")
    btn.className = "gift-btn"
    btn.innerHTML = `
      ${gift.emoji}
      <span>${gift.value}</span>
    `
    btn.onclick = () => sendGift(gift)
    container.appendChild(btn)
  })
}



async function sendGift(gift) {
  if (currentUser.uid === liveData.hostId) {
    alert("Você não pode enviar gift para si mesmo")
    return
  }

  const userRef = db.collection("users").doc(currentUser.uid)
  const hostRef = db.collection("users").doc(liveData.hostId)
  const liveRef = db.collection("lives").doc(liveId)

  try {
    await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef)
      const hostSnap = await tx.get(hostRef)

      const balance = userSnap.data().balance || 0
      if (balance < gift.value) {
        throw new Error("Saldo insuficiente")
      }

      // Desconta do viewer
      tx.update(userRef, {
        balance: balance - gift.value
      })

      // Credita ao host
      tx.update(hostRef, {
        earnings:
          (hostSnap.data().earnings || 0) + gift.value
      })

      // Soma na live
      tx.update(liveRef, {
        totalGiftsValue:
          firebase.firestore.FieldValue.increment(gift.value)
      })

      // Registra gift
      tx.set(
        liveRef.collection("gifts").doc(),
        {
          senderId: currentUser.uid,
          senderName: userData.name,
          giftId: gift.id,
          giftName: gift.name,
          value: gift.value,
          createdAt:
            firebase.firestore.FieldValue.serverTimestamp()
        }
      )
    })

    showGiftAnimation(gift)
  } catch (e) {
    alert(e.message)
  }
}

function showGiftAnimation(gift) {
  const div = document.createElement("div")
  div.className = "gift-animation"
  div.innerHTML = `${gift.emoji} ${gift.name}!`

  document.body.appendChild(div)

  setTimeout(() => div.remove(), 2000)
}


function showGiftAnimation({ emoji, name }) {
  const el = document.createElement("div")
  el.className = "gift-animation"
  el.textContent = emoji + " " + name

  document.body.appendChild(el)

  setTimeout(() => el.remove(), 3000)
}



async function openEndLiveModal() {
  const snap = await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .get()

  document.getElementById("modalViewerCount").textContent = snap.size
  document.getElementById("endLiveModal").classList.remove("hidden")
}

document.getElementById("cancelEndLive").onclick = () => {
  document.getElementById("endLiveModal").classList.add("hidden")
}

document.getElementById("confirmEndLive").onclick = async () => {
  await endLiveAsHost()
}

async function endLiveAsHost() {
  // Atualiza status da live
  await db.collection("lives").doc(liveId).update({
    status: "ended",
    endedAt: firebase.firestore.FieldValue.serverTimestamp()
  })

  showLiveSummary()
}


async function showLiveSummary() {
  document.getElementById("app").classList.add("hidden")
  document.getElementById("liveSummary").classList.remove("hidden")

  const viewersSnap = await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .get()

  document.getElementById("sumViewers").textContent = viewersSnap.size

  const giftsSnap = await db
    .collection("lives")
    .doc(liveId)
    .collection("gifts")
    .get()

  let total = 0
  const ranking = {}

  giftsSnap.forEach(doc => {
    const g = doc.data()
    total += g.value

    ranking[g.senderName] =
      (ranking[g.senderName] || 0) + g.value

    const gift = GIFTS.find(x => x.id === g.giftId)
    if (gift) {
      const el = document.createElement("span")
      el.textContent = gift.emoji
      document.getElementById("giftThumbs").appendChild(el)
    }
  })

  document.getElementById("sumTotal").textContent = total

  const sorted = Object.entries(ranking)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const ul = document.getElementById("topGifters")
  sorted.forEach(([name, val]) => {
    const li = document.createElement("li")
    li.textContent = `${name} — ${val} coins`
    ul.appendChild(li)
  })

  await leaveLive(true)
}



function showLiveEndedForViewer() {
  document.getElementById("app").innerHTML = `
    <div class="ended-viewer">
      <h2>🔴 Live finalizada</h2>
      <p>O host encerrou a transmissão</p>

      <button onclick="followHost()">⭐ Tornar Fã</button>
      <button onclick="addFriend()">➕ Adicionar amigo</button>
      <button onclick="openGiftPanel()">🎁 Enviar presente</button>
    </div>
  `
}



function bindLeaveButton() {
  const btn = document.getElementById("leaveBtn")

  if (!btn) {
    console.warn("leaveBtn não encontrado")
    return
  }

  btn.addEventListener("click", () => {
    if (liveData.hostId === currentUser.uid) {
      openEndLiveModal()
    } else {
      leaveLive()
    }
  })
}



document.addEventListener("DOMContentLoaded", () => {
  const cancel = document.getElementById("cancelEndLive")
  const confirm = document.getElementById("confirmEndLive")

  if (cancel) {
    cancel.onclick = () => {
      document.getElementById("endLiveModal").classList.add("hidden")
    }
  }

  if (confirm) {
    confirm.onclick = async () => {
      await endLiveAsHost()
    }
  }
})

