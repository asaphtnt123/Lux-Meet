// =======================================
// FIREBASE INIT
// =======================================
let auth, db, storage
let currentUser = null
let userData = null
let livesUnsubscribe = null

// =======================================
// INIT APP
// =======================================
async function initializeApp() {
    try {
        console.log('Iniciando Live App...')

        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
                authDomain: "connectfamilia-312dc.firebaseapp.com",
                projectId: "connectfamilia-312dc",
                storageBucket: "connectfamilia-312dc.appspot.com",
                messagingSenderId: "797817838649",
                appId: "1:797817838649:web:1aa7c54abd97661f8d81e8"
            })
        }

        auth = firebase.auth()
        db = firebase.firestore()
        storage = firebase.storage()

        auth.onAuthStateChanged(handleAuthStateChange)


        

    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error)
        alert('Erro ao inicializar aplicação')
    }
}

// =======================================
// AUTH STATE
// =======================================
async function handleAuthStateChange(user) {
    if (!user) {
        window.location.href = '/login.html'
        return
    }

    currentUser = user
    console.log('Usuário autenticado:', user.uid)

    const loaded = await loadUserData()
    if (!loaded) {
        alert('Erro ao carregar dados do usuário')
        return
    }

    onUserReady()
}
// =======================================
// LOAD USER DATA
// =======================================
async function loadUserData() {
  try {
    const userRef = db.collection('users').doc(currentUser.uid)
    const snap = await userRef.get()

    if (snap.exists) {
      userData = snap.data()
    } else {
      userData = {
        name: currentUser.displayName || 'Usuário',
        profilePhotoURL:
          currentUser.photoURL ||
          'https://via.placeholder.com/150',
        balance: 0,
        earnings: 0
      }

      await userRef.set({
        ...userData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      })
    }

    // 🔥 Atualiza header (saldo + ganhos)
    updateUserHeader(userData)

    return true
  } catch (error) {
    console.error('Erro ao carregar usuário:', error)
    return false
  }
}


function updateUserHeader(userData) {
  // saldo normal
  document.getElementById("userBalance").textContent =
    userData.balance || 0

  // ganhos (earnings)
  const earnings = userData.earnings || 0
  const earningsEl = document.getElementById("userEarnings")
  const earningsValueEl =
    document.getElementById("userEarningsValue")

  if (earnings > 0) {
    earningsValueEl.textContent = earnings
    earningsEl.classList.remove("hidden")
  } else {
    earningsEl.classList.add("hidden")
  }
}

// =======================================
// USER READY
// =======================================
function onUserReady() {
    document.getElementById('loading').classList.add('hidden')
    document.getElementById('app').classList.remove('hidden')

    updateUserUI()
    setupEvents()
    loadLives()
}

// =======================================
// UPDATE USER UI
// =======================================
function updateUserUI() {
    document.getElementById('userName').textContent =
        userData.name || 'Usuário'

    document.getElementById('userAvatar').src =
        userData.profilePhotoURL ||
        'https://via.placeholder.com/40'

    document.getElementById('userBalance').textContent =
        (userData.balance || 0).toFixed(2)
}

// =======================================
// EVENTS
function setupEvents() {
    document
        .getElementById('createLiveBtn')
        .addEventListener('click', openCreateLiveModal)

    document
        .getElementById('cancelCreateLive')
        .addEventListener('click', closeCreateLiveModal)

    document
        .getElementById('confirmCreateLive')
        .addEventListener('click', createLive)

    document
        .getElementById('liveType')
        .addEventListener('change', handleLiveTypeChange)
}
async function createLive() {
    try {
        const title =
            document.getElementById('liveTitle').value.trim()

        const description =
            document.getElementById('liveDescription').value.trim()

        const type =
            document.getElementById('liveType').value

        const price =
            Number(document.getElementById('livePrice').value) || 0

        if (!title) {
            alert('Informe o nome da live')
            return
        }

        const liveData = {
            hostId: currentUser.uid,

            title,
            description,

            type, // public | private
            price: type === 'private' ? price : 0,

            status: 'active',

            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }

        const liveRef =
            await db.collection('lives').add(liveData)

        closeCreateLiveModal()

        window.location.href =
            `live-room.html?liveId=${liveRef.id}`

    } catch (error) {
        console.error('Erro ao criar live:', error)
        alert('Erro ao criar live')
    }
}



function openCreateLiveModal() {
    document
        .getElementById('createLiveModal')
        .classList.remove('hidden')
}

function closeCreateLiveModal() {
    document
        .getElementById('createLiveModal')
        .classList.add('hidden')
}

function handleLiveTypeChange(e) {
    const wrapper =
        document.getElementById('privatePriceWrapper')

    if (e.target.value === 'private') {
        wrapper.classList.remove('hidden')
    } else {
        wrapper.classList.add('hidden')
    }
}


// =======================================
// LOAD LIVES
// =======================================
function loadLives() {
    if (livesUnsubscribe) livesUnsubscribe()

    livesUnsubscribe = db
        .collection('lives')
        .where('status', '==', 'active')
        .onSnapshot(snapshot => {
            renderLiveList(snapshot.docs)
        })
}

// =======================================
// RENDER LIVE LIST
// =======================================
async function renderLiveList(docs) {
    const list = document.getElementById('liveList')
    list.innerHTML = ''

    if (docs.length === 0) {
        list.innerHTML =
            '<p style="color:#888">Nenhuma live ao vivo</p>'
        return
    }

    for (const doc of docs) {
        const live = doc.data()
        if (!live.hostId) continue

        try {
            const userSnap = await db
                .collection('users')
                .doc(live.hostId)
                .get()

            if (!userSnap.exists) continue

            const user = userSnap.data()

            const card = document.createElement('div')
            card.className = 'live-card'

            card.innerHTML = `
    <img class="live-avatar"
         src="${user.profilePhotoURL || 'https://via.placeholder.com/80'}">

    <div class="live-info">
        <span class="live-host-name">
            ${user.name || 'Usuário'}
        </span>

        <span class="live-balance">
            💰 ${(user.balance || 0).toFixed(2)}
        </span>

        <span class="live-status">🔴 Ao vivo</span>
    </div>

    <button type="button" class="btn-secondary">
        Entrar
    </button>
`


            card.querySelector('button').onclick = () => {
                enterLive(doc.id)
            }

            list.appendChild(card)

        } catch (error) {
            console.error('Erro ao renderizar live:', error)
        }
    }
}
async function enterLive(liveId) {
    try {
        console.log('Tentando entrar na live:', liveId)

        if (!liveId) {
            alert('Live inválida (ID vazio)')
            return
        }

        if (!currentUser || !userData) {
            alert('Usuário não autenticado')
            return
        }

        const liveRef = db.collection('lives').doc(liveId)
        const liveSnap = await liveRef.get()

        if (!liveSnap.exists) {
            alert('Live não encontrada')
            return
        }

        const live = liveSnap.data()

        // 🔓 LIVE PÚBLICA
        if (live.type === 'public') {
            window.location.href =
                `live-room.html?liveId=${liveId}`
            return
        }

        // 🔒 LIVE PRIVADA
        const price = live.price || 0

        const viewerRef = liveRef
            .collection('viewers')
            .doc(currentUser.uid)

        const viewerSnap = await viewerRef.get()

        // Já pagou antes
        if (viewerSnap.exists) {
            window.location.href =
                `live-room.html?liveId=${liveId}`
            return
        }

        // Verificar saldo
        if ((userData.balance || 0) < price) {
            alert(`Saldo insuficiente. Valor: ${price}`)
            return
        }

        // 🔥 TRANSAÇÃO ATÔMICA
        await db.runTransaction(async transaction => {
            const userRef =
                db.collection('users').doc(currentUser.uid)

            const userSnap =
                await transaction.get(userRef)

            const balance = userSnap.data().balance || 0

            if (balance < price) {
                throw new Error('Saldo insuficiente')
            }

            transaction.update(userRef, {
                balance: balance - price
            })

            transaction.set(viewerRef, {
                joinedAt:
                    firebase.firestore.FieldValue.serverTimestamp(),
                paid: true
            })
        })

        // Atualizar UI local
        userData.balance -= price
        updateUserUI()

        // ✅ REDIRECIONA SÓ NO FINAL
        window.location.href =
            `live-room.html?liveId=${liveId}`

    } catch (error) {
        console.error('Erro ao entrar na live:', error)
        alert(error.message || 'Erro ao entrar na live')
    }
}


// =======================================
// START
// =======================================
document.addEventListener('DOMContentLoaded', initializeApp)
