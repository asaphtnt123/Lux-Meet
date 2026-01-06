// =======================================
// FIREBASE
// =======================================
let auth, db
let currentUser = null
let userData = null
let liveId = null
let liveData = null
let viewersUnsub = null


let localStream = null
let peerConnection = null

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
}

// =======================================
// INIT
// =======================================
document.addEventListener('DOMContentLoaded', init)

function init() {
    const params = new URLSearchParams(window.location.search)
    liveId = params.get('liveId')

    if (!liveId) {
        alert('Live inválida')
        window.location.href = 'lux-meet-live.html'
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
// AUTH
// =======================================
async function handleAuth(user) {
    if (!user) {
        window.location.href = '/login.html'
        return
    }

    currentUser = user

    await loadUser()
    await loadLive()
    await validateAccess()

    setupUI()
    watchViewers()

    if (liveData.hostId === currentUser.uid) {
    await startHostStream()
    await startHostRTC()
} else {
    await startViewerRTC()
}

    document.getElementById('loading').classList.add('hidden')
    document.getElementById('app').classList.remove('hidden')
}

// =======================================
// LOAD USER
// =======================================
async function loadUser() {
    const snap = await db
        .collection('users')
        .doc(currentUser.uid)
        .get()

    if (!snap.exists) {
        alert('Usuário inválido')
        window.location.href = 'lux-meet-live.html'
        return
    }

    userData = snap.data()
}

// =======================================
// LOAD LIVE
// =======================================
async function loadLive() {
    const snap = await db
        .collection('lives')
        .doc(liveId)
        .get()

    if (!snap.exists || snap.data().status !== 'active') {
        alert('Live encerrada')
        window.location.href = 'lux-meet-live.html'
        return
    }

    liveData = snap.data()
}

// =======================================
// VALIDATE ACCESS
// =======================================
async function validateAccess() {
    if (liveData.type === 'public') return

    // Host entra direto
    if (liveData.hostId === currentUser.uid) return

    const viewerRef = db
        .collection('lives')
        .doc(liveId)
        .collection('viewers')
        .doc(currentUser.uid)

    // 🔁 ESPERA O VIEWER EXISTIR (sync delay)
    const start = Date.now()
    const timeout = 5000 // 5s

    while (Date.now() - start < timeout) {
        const snap = await viewerRef.get()
        if (snap.exists) return
        await new Promise(r => setTimeout(r, 300))
    }

    alert('Acesso não autorizado')
    window.location.href = 'lux-meet-live.html'
}


// =======================================
// UI
// =======================================
async function setupUI() {
    const hostSnap = await db
        .collection('users')
        .doc(liveData.hostId)
        .get()

    const host = hostSnap.data()

    document.getElementById('hostName').textContent =
        host.name || 'Host'

    document.getElementById('hostAvatar').src =
        host.profilePhotoURL || 'https://via.placeholder.com/50'

    document.getElementById('liveTitle').textContent =
        liveData.title || ''

    document.getElementById('leaveBtn').onclick = leaveLive
}

// =======================================
// VIEWERS
// =======================================

function watchViewers() {
    const viewersRef = db
        .collection('lives')
        .doc(liveId)
        .collection('viewers')

    // Registrar presença ANTES
    viewersRef
        .doc(currentUser.uid)
        .set({
            joinedAt:
                firebase.firestore.FieldValue.serverTimestamp(),
            active: true
        }, { merge: true })

    viewersUnsub = viewersRef.onSnapshot(snap => {
        document.getElementById('viewerCount').textContent =
            `👁 ${snap.size}`
    })
}


// =======================================
// LEAVE
// =======================================
function leaveLive() {
    if (viewersUnsub) viewersUnsub()

    db.collection('lives')
        .doc(liveId)
        .collection('viewers')
        .doc(currentUser.uid)
        .delete()

    window.location.href = 'lux-meet-live.html'
}


async function startHostStream() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    })

    document.getElementById('liveVideo').srcObject = localStream
}

async function startHostRTC() {
    peerConnection = new RTCPeerConnection(rtcConfig)

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            db.collection('lives')
                .doc(liveId)
                .collection('signals')
                .add({
                    type: 'host-ice',
                    candidate: e.candidate.toJSON()
                })
        }
    }

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    await db.collection('lives')
        .doc(liveId)
        .set({
            offer: offer.toJSON()
        }, { merge: true })
}


async function startViewerRTC() {
    peerConnection = new RTCPeerConnection(rtcConfig)

    peerConnection.ontrack = e => {
        document.getElementById('liveVideo').srcObject = e.streams[0]
    }

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            db.collection('lives')
                .doc(liveId)
                .collection('signals')
                .add({
                    type: 'viewer-ice',
                    uid: currentUser.uid,
                    candidate: e.candidate.toJSON()
                })
        }
    }

    const liveRef = db.collection('lives').doc(liveId)

    liveRef.onSnapshot(async snap => {
        const data = snap.data()
        if (data?.offer && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.offer)
            )

            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)

            await liveRef.set({
                answer: answer.toJSON()
            }, { merge: true })
        }
    })
}


