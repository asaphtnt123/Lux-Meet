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

  const role =
    liveData.hostId === currentUser.uid ? "host" : "viewer"

  await startAgora(role)
  await registerViewer()
  initChat()
  watchViewerCount()

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

  document.getElementById("leaveBtn").onclick = leaveLive
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
function initChat() {
  const chatRef = db
    .collection("lives")
    .doc(liveId)
    .collection("chat")
    .orderBy("createdAt", "asc")
    .limit(150)

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
  try {
    if (chatUnsub) chatUnsub()

    localTracks.forEach(track => {
      track.stop()
      track.close()
    })

    if (client && joined) {
      await client.leave()
    }

    await db
      .collection("lives")
      .doc(liveId)
      .collection("viewers")
      .doc(currentUser.uid)
      .delete()
  } catch (e) {
    console.warn(e)
  }

  location.href = "lux-meet-live.html"
}
