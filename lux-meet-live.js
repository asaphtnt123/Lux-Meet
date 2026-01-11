// =======================================
// FIREBASE INIT
// =======================================
let auth, db, storage
let currentUser = null
let userData = null
let livesUnsubscribe = null


const COIN_INTERNAL_VALUE = 0.035 // valor real por moeda (host)
const PLATFORM_USE_FEE = 0.10     // 10% na entrada/gift


// ================= COUNTRIES =================
const COUNTRIES = [
  { code: 'all', name: 'Todos', flag: '🌍' },
  { code: 'BR', name: 'Brasil', flag: 'https://flagcdn.com/br.svg' },
  { code: 'US', name: 'USA', flag: 'https://flagcdn.com/us.svg' },
  { code: 'PT', name: 'Portugal', flag: 'https://flagcdn.com/pt.svg' },
  { code: 'ES', name: 'Espanha', flag: 'https://flagcdn.com/es.svg' },
  { code: 'FR', name: 'França', flag: 'https://flagcdn.com/fr.svg' }
]

let selectedCountry = 'all'


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
  const balanceEl = document.getElementById("userBalance")
  if (balanceEl) {
    balanceEl.textContent = userData.balance || 0
  }

  const earnings = userData.earnings || 0
  const earningsEl = document.getElementById("userEarnings")
  const earningsValueEl =
    document.getElementById("userEarningsValue")

  if (!earningsEl || !earningsValueEl) return

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

  // 🌍 navbar de países
  renderCountryNavbar(userData.country || 'all')

  // 🔴 carrega lives do país selecionado
  loadLives(userData.country || 'all')
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

    // 🔹 Buscar país do usuário
    const userSnap = await db
      .collection('users')
      .doc(currentUser.uid)
      .get()

    if (!userSnap.exists) {
      alert('Usuário inválido')
      return
    }

    const userData = userSnap.data()
    const country = userData.country || 'BR' // fallback seguro

    // 🔹 Dados da live
    const liveData = {
  hostId: currentUser.uid,
  hostName: userData.name,
  hostAvatar: userData.profilePhotoURL,

  title,
  description,

  type,
  price: type === 'private' ? price : 0,

  country,
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
async function loadLives(country) {
  if (!country) {
    console.warn('Country indefinido, usando BR')
    country = 'BR'
  }

  const liveList = document.getElementById('liveList')
  liveList.innerHTML = ''

  let query = db
    .collection('lives')
    .where('status', '==', 'active')

  if (country !== 'all') {
    query = query.where('country', '==', country)
  }

  query = query.orderBy('createdAt', 'desc')

  const snap = await query.get()

  if (snap.empty) {
    liveList.innerHTML = `
      <p class="empty-state">
        Nenhuma live ao vivo neste país
      </p>
    `
    return
  }

  snap.forEach(doc => {
    const live = doc.data()
    const isPrivate = live.type === 'private'

    liveList.innerHTML += `
      <div class="live-card ${isPrivate ? 'private-live' : ''}">

        <img class="live-avatar"
          src="${live.hostAvatar || 'https://via.placeholder.com/80'}">

        <div class="live-info">
          <span class="live-host-name">
            ${live.hostName || 'Host'}
          </span>

          <span class="live-title">
            ${live.title || 'Live'}
          </span>

          ${
            live.description
              ? `<span class="live-description">${live.description}</span>`
              : ''
          }

          ${
            isPrivate
              ? `<span class="live-private">
                   🔒 Live privada • ${live.price} coins
                 </span>`
              : `<span class="live-status">🔴 Ao vivo</span>`
          }
        </div>

        <button class="btn-secondary"
          onclick="enterLive('${doc.id}')">
          Entrar
        </button>
      </div>
    `
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

    const isPrivate = live.type === 'private'

    const card = document.createElement('div')
    card.className = `live-card ${isPrivate ? 'private-live' : ''}`

    card.innerHTML = `
      <img class="live-avatar"
        src="${live.hostAvatar || 'https://via.placeholder.com/80'}">

      <div class="live-info">
        <span class="live-host-name">
          ${live.hostName || 'Usuário'}
        </span>

        <span class="live-title">
          ${live.title || 'Live'}
        </span>

        ${
          live.description
            ? `<span class="live-description">${live.description}</span>`
            : ''
        }

        ${
          isPrivate
            ? `<span class="live-private">
                 🔒 Live privada • ${live.price} coins
               </span>`
            : `<span class="live-status">🔴 Ao vivo</span>`
        }
      </div>

      <button type="button" class="btn-secondary">
        Entrar
      </button>
    `

    card.querySelector('button').onclick = () => {
      enterLive(doc.id)
    }

    list.appendChild(card)
  }
}


async function enterLive(liveId) {
  try {
    if (!currentUser) {
      throw new Error('Usuário não autenticado')
    }

    const liveRef = db.collection('lives').doc(liveId)
    const viewerRef = liveRef
      .collection('viewers')
      .doc(currentUser.uid)

    await db.runTransaction(async (tx) => {
      const liveSnap = await tx.get(liveRef)
      if (!liveSnap.exists) {
        throw new Error('Live inválida')
      }

      const live = liveSnap.data()
      const viewerSnap = await tx.get(viewerRef)

      const updates = {}

      // ⏱️ inicia live se ainda não iniciou
      if (!live.startedAt) {
        updates.startedAt =
          firebase.firestore.FieldValue.serverTimestamp()
      }

      // 👁️ PRIMEIRA VEZ DO USUÁRIO
      if (!viewerSnap.exists) {
        tx.set(viewerRef, {
          uid: currentUser.uid,
          joinedAt:
            firebase.firestore.FieldValue.serverTimestamp()
        })

        updates.unique_viewers_count =
          firebase.firestore.FieldValue.increment(1)
      }

      // aplica updates da live
      if (Object.keys(updates).length > 0) {
        tx.update(liveRef, updates)
      }
    })

    // redireciona
    window.location.href =
      `live-room.html?liveId=${liveId}`

  } catch (err) {
    console.error(err)
    showAppAlert(
      'error',
      'Erro ao entrar na live',
      err.message
    )
  }
}


// =======================================
// START
// =======================================
document.addEventListener('DOMContentLoaded', initializeApp)


function renderCountryNavbar(defaultCountry) {
  const navbar = document.getElementById('countryNavbar')

  if (!navbar) {
    console.error('Navbar de países não encontrada')
    return
  }

  navbar.innerHTML = ''

  COUNTRIES.forEach(country => {
    const div = document.createElement('div')
    div.className = 'country-item'
    if (country.code === defaultCountry) {
      div.classList.add('active')
      selectedCountry = country.code
    }

    div.innerHTML = `
  <img
    class="country-flag"
    src="${country.flag}"
    alt="${country.name}"
  />
  <span class="country-name">${country.name}</span>
`


    div.onclick = () => {
      document
        .querySelectorAll('.country-item')
        .forEach(el => el.classList.remove('active'))

      div.classList.add('active')
      selectedCountry = country.code

      loadLives(country.code)
    }

    navbar.appendChild(div)
  })
}




async function releaseTransactionManually(transactionId) {
  const txRef = db.collection("transactions").doc(transactionId)

  await db.runTransaction(async (transaction) => {
    const txSnap = await transaction.get(txRef)
    if (!txSnap.exists) throw new Error("Transação não existe")

    const txData = txSnap.data()
    if (txData.status !== "pending") return

    const userRef = db.collection("users").doc(txData.hostId)
    const userSnap = await transaction.get(userRef)

    const pending = userSnap.data().earnings_pending || 0
    const available = userSnap.data().earnings_available || 0

    transaction.update(userRef, {
      earnings_pending: pending - txData.amount,
      earnings_available: available + txData.amount
    })

    transaction.update(txRef, {
      status: "available",
      releasedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
  })
}


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

document.querySelectorAll('.coin-pack').forEach((pack) => {
  pack.addEventListener('click', () => {
    document.querySelectorAll('.coin-pack').forEach(p =>
      p.classList.remove('highlight')
    )
    pack.classList.add('highlight')
    selectedPackage = {
      coins: Number(pack.dataset.coins),
      price: Number(pack.dataset.price)
    }
  })
})

// comprar moedas
document.getElementById('buyCoinsBtn')?.addEventListener('click', () => {
  if (!selectedPackage) {
    alert('Selecione um pacote')
    return
  }

  console.log('Comprar pacote:', selectedPackage)

  // 👉 aqui você conecta com Stripe / Mercado Pago
  // createCheckout(selectedPackage)
})
