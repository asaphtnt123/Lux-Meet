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

// =======================================
// INIT
// =======================================
document.addEventListener("DOMContentLoaded", init)

function init() {
  const params = new URLSearchParams(window.location.search)
  liveId = params.get("liveId")

  if (!liveId) {
    alert("Live inválida")
    return location.href = "lux-meet-live.html"
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
  if (!user) return location.href = "/login.html"

  currentUser = user

  await loadUser()
  await loadLive()
  await validateAccess()
  setupUI()

  const role =
    liveData.hostId === currentUser.uid
      ? "host"
      : "viewer"

  await startAgora(role)

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

  document.getElementById("hostName").textContent = host.name || "Host"
  document.getElementById("hostAvatar").src =
    host.profilePhotoURL || "https://via.placeholder.com/50"
  document.getElementById("liveTitle").textContent = liveData.title || ""
  document.getElementById("leaveBtn").onclick = leaveLive
}

// =======================================
// AGORA START
// =======================================
async function startAgora(role) {
  const idToken = await currentUser.getIdToken()

  const res = await fetch("/.netlify/functions/getAgoraToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      channel: liveId,
      role
    })
  })

  const { token, uid } = await res.json()

  client = AgoraRTC.createClient({
    mode: "live",
    codec: "vp8"
  })

  client.setClientRole(
    role === "host" ? "host" : "audience"
  )

  await client.join(
    AGORA_APP_ID,
    liveId,
    token,
    uid
  )

  // 🔥 HOST
  if (role === "host") {
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()

    const videoTrack = localTracks[1]
    videoTrack.play("videoContainer")

    await client.publish(localTracks)
  }

  // 👀 VIEWER
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
// LEAVE
// =======================================
async function leaveLive() {
  if (localTracks.length) {
    localTracks.forEach(track => track.stop())
    localTracks.forEach(track => track.close())
  }

  if (client) await client.leave()

  await db
    .collection("lives")
    .doc(liveId)
    .collection("viewers")
    .doc(currentUser.uid)
    .delete()

  location.href = "lux-meet-live.html"
}
