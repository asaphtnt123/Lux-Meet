// =======================================
// FIREBASE
// =======================================
let auth, db
let currentUser = null
let userData = null
let liveId = null
let liveData = null

// =======================================
// LIVEKIT
// =======================================
let room = null

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

    const role =
        liveData.hostId === currentUser.uid ? 'host' : 'viewer'

    await joinLive(role)

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
    if (liveData.hostId === currentUser.uid) return

    const viewerSnap = await db
        .collection('lives')
        .doc(liveId)
        .collection('viewers')
        .doc(currentUser.uid)
        .get()

    if (!viewerSnap.exists) {
        alert('Acesso não autorizado')
        window.location.href = 'lux-meet-live.html'
    }
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
// JOIN LIVE (LIVEKIT)
// =======================================
async function joinLive(role) {
    if (!window.LiveKit) {
        alert('LiveKit não carregado')
        return
    }

    const idToken = await currentUser.getIdToken()

    const res = await fetch('/.netlify/functions/getLiveToken', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ liveId, role })
    })

    if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt)
    }

    const { token, url } = await res.json()

    room = new LiveKit.Room()

    room.on(
        LiveKit.RoomEvent.TrackSubscribed,
        (track) => {
            if (track.kind === 'video') {
                const el = track.attach()
                el.autoplay = true
                el.playsInline = true
                document
                    .getElementById('videoContainer')
                    .appendChild(el)
            }
        }
    )

    await room.connect(url, token)

    if (role === 'host') {
        const track = await LiveKit.createLocalVideoTrack()
        await room.localParticipant.publishTrack(track)

        const el = track.attach()
        el.muted = true
        el.autoplay = true
        el.playsInline = true

        document
            .getElementById('videoContainer')
            .appendChild(el)
    }
}



// =======================================
// LEAVE
// =======================================
function leaveLive() {
    if (room) room.disconnect()

    db.collection('lives')
        .doc(liveId)
        .collection('viewers')
        .doc(currentUser.uid)
        .delete()

    window.location.href = 'lux-meet-live.html'
}
