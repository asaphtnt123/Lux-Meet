// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
  authDomain: "connectfamilia-312dc.firebaseapp.com",
  projectId: "connectfamilia-312dc",
  storageBucket: "connectfamilia-312dc.appspot.com",
  messagingSenderId: "797817838649",
  appId: "1:797817838649:web:1aa7c54abd97661f8d81e8",
  measurementId: "G-QKN9NFXZZQ"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Variáveis globais
let currentUser = null;
let userData = null;

/****************************
 * HANDLERS DE CICLO DE VIDA *
 ****************************/
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o Firebase primeiro
  
  // Configura o observador de autenticação
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    
    console.log('Usuário autenticado:', user.uid); // Debug
    
    try {
      currentUser = user;
      await loadUserData();
      setupUI();
      setupNavListeners();
      loadDiscoverUsers();
    } catch (error) {
      console.error('Erro ao inicializar:', error);
      // Mostra mensagem de erro para o usuário
      document.getElementById('userName').textContent = 'Erro ao carregar';
    }
  });
});

async function loadUserData() {
  try {
    console.log('Carregando dados para:', currentUser.uid); // Debug
    const doc = await db.collection('users').doc(currentUser.uid).get();
    
    if (!doc.exists) {
      throw new Error('Usuário não encontrado no Firestore');
    }
    
    userData = doc.data();
    console.log('Dados carregados:', userData); // Debug
    updateProfileUI();
  } catch (e) {
    console.error('Erro ao buscar dados do usuário:', e);
    // Fallback UI
    document.getElementById('userName').textContent = 'Usuário LuxMeet';
    document.getElementById('userTitle').textContent = 'Membro';
  }
}


// Monitorar estado de autenticação
auth.onAuthStateChanged(user => {
  if (user) {
    // Carregar dados do usuário do Firestore
    db.collection('users').doc(user.uid).get()
      .then(doc => {
        if (doc.exists) {
          const userData = doc.data();
          
          // Atualizar foto do perfil
          if (userData.profilePhotoURL) {
            document.getElementById('userAvatar').src = userData.profilePhotoURL;
          }
          
          // Outras atualizações de UI podem ser feitas aqui
        }
      })
      .catch(error => {
        console.error("Erro ao carregar dados do usuário:", error);
      });
  } else {
    // Usuário não logado - resetar para placeholder
    document.getElementById('userAvatar').src = 'https://via.placeholder.com/150';
  }
});
/*************************
 * ATUALIZAÇÃO DE INTERFACE*
 *************************/
async function uploadProfilePhoto(file) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Usuário não autenticado!");

  // Gera um nome de arquivo consistente (evita problemas de cache)
  const fileExtension = file.name.split('.').pop();
  const fileName = `profile_${Date.now()}.${fileExtension}`;
  
  const storageRef = firebase.storage()
    .ref(`profile_photos/${user.uid}/${fileName}`);

  await storageRef.put(file);
  const downloadURL = await storageRef.getDownloadURL();
  
  // Atualiza tanto no Auth quanto no Firestore
  await user.updateProfile({
    photoURL: downloadURL
  });
  
  await firebase.firestore().collection('users').doc(user.uid).update({
    profilePhotoURL: downloadURL,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  return downloadURL;
}
/*************************
 * ATUALIZAÇÃO DE INTERFACE*
 *************************/
function updateProfileUI() {
  if (!userData) {
    userData = {
      name: 'Usuário LuxMeet',
      tipouser: 'member',
      matches: 0,
      views: 0,
      likes: [], // Array vazio como padrão
      profilePhotoURL: ''
    };
  }

  // Extrai dados com fallbacks
  const {
    profilePhotoURL = '',
    name = 'Usuário LuxMeet',
    tipouser = 'member',
    matches = 0,
    views = 0,
    likes = [] // Garante que likes será um array
  } = userData;

  // Calcula o número de curtidas
  const likesCount = likes.length;

  // Atualiza foto de perfil
  const avatarElement = document.getElementById('userAvatar');
  if (avatarElement) {
    if (profilePhotoURL) {
      avatarElement.src = `${profilePhotoURL}?timestamp=${Date.now()}`;
      avatarElement.onerror = function() {
        this.src = 'https://via.placeholder.com/150';
      };
    } else {
      avatarElement.src = 'https://via.placeholder.com/150';
    }
  }

  // Atualiza os elementos da interface
  const userNameElement = document.getElementById('userName');
  if (userNameElement) userNameElement.textContent = name;

  const matchCountElement = document.getElementById('matchCount');
  if (matchCountElement) matchCountElement.textContent = matches;

  const viewCountElement = document.getElementById('viewCount');
  if (viewCountElement) viewCountElement.textContent = views;

  const likesCountElement = document.getElementById('likesCount');
  if (likesCountElement) {
    likesCountElement.textContent = likesCount;
    // Armazena os IDs dos usuários que curtiram como atributo data
    likesCountElement.dataset.likes = JSON.stringify(likes);
    // Adiciona estilo e tooltip
    likesCountElement.style.cursor = 'pointer';
    likesCountElement.title = 'Clique para ver quem curtiu';
  }

  // Atualiza título do usuário
  const titles = {
    sugar_daddy: 'Sugar Daddy',
    sugar_mommy: 'Sugar Mommy',
    sugar_baby: 'Sugar Baby',
    member: 'Membro LuxMeet'
  };
  
  const userTitleElement = document.getElementById('userTitle');
  if (userTitleElement) {
    userTitleElement.textContent = titles[tipouser] || 'Membro';
  }

  // Debug (pode remover depois)
  console.log("Dados do usuário:", { 
    profilePhotoURL, 
    name, 
    tipouser, 
    matches, 
    views, 
    likesCount
  });
}
function updateUserAvatar() {
  const user = firebase.auth().currentUser;
  const avatarElement = document.getElementById('userAvatar');
  
  if (user && user.photoURL) {
    // Adiciona timestamp para evitar cache
    avatarElement.src = `${user.photoURL}?timestamp=${Date.now()}`;
  } else {
    // Tenta obter do Firestore se não estiver no Auth
    if (user) {
      firebase.firestore().collection('users').doc(user.uid).get()
        .then(doc => {
          if (doc.exists && doc.data().profilePhotoURL) {
            avatarElement.src = `${doc.data().profilePhotoURL}?timestamp=${Date.now()}`;
          }
        });
    } else {
      avatarElement.src = 'https://via.placeholder.com/150';
    }
  }
}

// Função para atualizar o perfil do usuário com as curtidas
async function updateUserProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    // Obter dados do usuário incluindo as curtidas
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Atualizar foto do perfil
      if (userData.profilePhotoURL) {
        document.getElementById('userAvatar').src = `${userData.profilePhotoURL}?timestamp=${Date.now()}`;
      }
      
      // Atualizar contagem de curtidas (se existir no seu sistema)
      if (userData.likesCount !== undefined) {
        document.getElementById('likesCount').textContent = userData.likesCount;
      }
      
      // Atualizar outros dados do perfil conforme necessário
      if (userData.name) {
        document.getElementById('userName').textContent = userData.name;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
  }
}

// Função para atualizar o perfil do usuário com as curtidas
async function updateUserProfile() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    // Obter dados do usuário incluindo as curtidas
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      
      // Atualizar foto do perfil
      if (userData.profilePhotoURL) {
        document.getElementById('userAvatar').src = `${userData.profilePhotoURL}?timestamp=${Date.now()}`;
      }
      
      // Atualizar contagem de curtidas (se existir no seu sistema)
      if (userData.likesCount !== undefined) {
        document.getElementById('likesCount').textContent = userData.likesCount;
      }
      
      // Atualizar outros dados do perfil conforme necessário
      if (userData.name) {
        document.getElementById('userName').textContent = userData.name;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
  }
}

// Monitorar estado de autenticação
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    updateUserProfile();
  } else {
    // Resetar para valores padrão quando não logado
    document.getElementById('userAvatar').src = 'https://via.placeholder.com/150';
    document.getElementById('likesCount').textContent = '0';
  }
});
// Função para curtir usuário (atualizada para retornar apenas a contagem)
async function likeUser(userId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para curtir', 'error');
      return;
    }

    // Verifica se já curtiu antes
    const likeQuery = await db.collection('likes')
      .where('fromUserId', '==', currentUser.uid)
      .where('toUserId', '==', userId)
      .limit(1)
      .get();

    if (!likeQuery.empty) {
      showToast('Você já curtiu este usuário', 'warning');
      return;
    }

    // Registrar like no Firestore
    await db.collection('likes').add({
      fromUserId: currentUser.uid,
      toUserId: userId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Atualiza o array de curtidas no documento do usuário curtido
    await db.collection('users').doc(userId).update({
      likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });

    // Atualiza a contagem de likes localmente
    const userDoc = await db.collection('users').doc(userId).get();
    const updatedLikes = userDoc.data().likes || [];
    document.getElementById('likesCount').textContent = updatedLikes.length;

    showToast('Curtida enviada com sucesso!');
    
  } catch (error) {
    console.error("Erro ao curtir usuário:", error);
    showToast('Erro ao enviar curtida', 'error');
  }
}


function setupUI() {
  // Botão VIP dummy
  document.getElementById('upgradeBtn').addEventListener('click', () => {
    alert('Funcionalidade VIP em breve!');
  });
  document.getElementById('editProfileBtn').addEventListener('click', () => {
    window.location.href = 'editar-perfil.html';
  });

    document.getElementById('likesCount').addEventListener('click', showLikesModal);



  document.querySelectorAll('.lux-comment-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const postId = this.dataset.postId;
        const commentsContainer = document.getElementById(`comments-${postId}`);
        
        // Alternar visibilidade
        if (commentsContainer.style.display === 'none') {
            commentsContainer.style.display = 'block';
            loadComments(postId);
        } else {
            commentsContainer.style.display = 'none';
        }
    });
});

}

/******************
 * NAVEGAÇÃO TOP *
 ******************/

function setupNavListeners() {
  document.querySelectorAll('.lux-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.lux-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showSection(item.dataset.section);
    });
  });
}

/* ---------- ajuste no switch de navegação ---------- */
function showSection(section) {
  document.querySelectorAll('.lux-section').forEach(sec => sec.style.display = 'none');

  switch (section) {
    case 'discover':
      document.getElementById('discoverSection').style.display = 'block';
      loadDiscoverUsers();
      break;
    case 'matches':
      document.getElementById('matchesSection').style.display = 'block';
      loadMatches();
      break;
    case 'messages':
      document.getElementById('messagesSection').style.display = 'block';
      loadMessages();
      break;
    case 'news':                                   // ⬅️ ADICIONE ISTO
      document.getElementById('newsSection').style.display = 'block';
      loadNewsPosts();                              // ⬅️ carrega o feed
      break;
    case 'profile':
      document.getElementById('profileSection').style.display = 'block';
      break;
    default:
      document.getElementById('discoverSection').style.display = 'block';
  }
}
/**
 * Cria um post em timelineLux e na pasta pessoal do usuário
 * @param {Object} param0 {title,text,imageFile}
 */
async function postNews({ title, text, imageFile }) {
  if (!currentUser) {
    alert('Você precisa estar logado.');
    return;
  }
  if (!title && !text && !imageFile) {
    alert('Preencha algo para postar.');
    return;
  }

  try {
    // 1) upload da imagem (se houver)
    let imageUrl = '';
    if (imageFile) {
      const storageRef = storage.ref().child(`newsImages/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
      await storageRef.put(imageFile);
      imageUrl = await storageRef.getDownloadURL();
    }

    // 2) dados do post
    const postData = {
      uid: currentUser.uid,
      authorName: userData?.name || 'Usuário LuxMeet',
      authorPhoto: userData?.profilePhotoURL || '',
      title,
      text,
      imageUrl,
      likes: 0,
      dislikes: 0,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 3) adiciona a timeline global
    const globalRef = await db.collection('timelineLux').add(postData);

    // 4) salva também na pasta do usuário
    await db.collection('users')
            .doc(currentUser.uid)
            .collection('posts')
            .doc(globalRef.id)       // usa o mesmo ID
            .set({ ...postData, postId: globalRef.id });

    toast('Post publicado!');
    loadNewsPosts(); // recarrega feed
  } catch (err) {
    console.error('Erro ao publicar:', err);
    alert('Falha ao publicar. Tente novamente.');
  }
}
// Coloque perto das outras rotinas de seção Novidades
async function loadNewsPosts() {
  const feed = document.getElementById('newsFeed');
  feed.innerHTML = loadingHTML('Carregando posts...');

  try {
    const snap = await db.collection('timelineLux')
                         .orderBy('timestamp','desc')
                         .get();

    feed.innerHTML = '';
    if (snap.empty) {
      feed.innerHTML = emptyHTML('Nenhum post ainda.');
      return;
    }

    snap.forEach(doc => feed.appendChild(renderNewsCard({ id: doc.id, ...doc.data() })));
  } catch (e) {
    console.error('Erro ao carregar posts:', e);
    feed.innerHTML = emptyHTML('Erro ao carregar posts');
  }
}

function renderNewsCard(post) {
  const card = document.createElement('div');
  card.className = 'lux-news-card';
  card.innerHTML = `
    <div class="lux-news-header">
      <img src="${post.authorPhoto || 'https://via.placeholder.com/40'}" class="lux-news-avatar">
      <div>
        <h4>${post.authorName}</h4>
        <span class="lux-news-date">${post.timestamp?.toDate?.().toLocaleString() || ''}</span>
      </div>
    </div>

    ${post.imageUrl ? `<img src="${post.imageUrl}" class="lux-news-image">` : ''}
    ${post.title   ? `<h3 class="lux-news-title">${post.title}</h3>` : ''}
    <p class="lux-news-text">${post.text}</p>

    <div class="lux-news-actions">
      <button onclick="reactToPost('${post.id}', true)">
        <i class="fas fa-thumbs-up"></i> <span id="like-${post.id}">${post.likes||0}</span>
      </button>
      <button onclick="reactToPost('${post.id}', false)">
        <i class="fas fa-thumbs-down"></i> <span id="dislike-${post.id}">${post.dislikes||0}</span>
      </button>
      <button class="lux-btn lux-btn-secondary" onclick="toggleComments('${post.id}')">
        <i class="fas fa-comment"></i> Comentários
        <span class="lux-count" id="commentCount-${post.id}">0</span>
      </button>
    </div>

    <!-- BLOCO DE COMENTÁRIOS -->
    <div class="lux-comments" id="commentsWrap-${post.id}" style="display:none;">
      <div class="lux-existing-comments" id="comments-${post.id}"></div>
      <form class="lux-comment-form" onsubmit="return addComment('${post.id}', this)">
        <input type="text" class="lux-input lux-comment-input" placeholder="Escreva um comentário…" required>
        <button class="lux-btn lux-btn-primary lux-comment-btn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  `;
  return card;
}

function toggleComments(postId){
  const block = document.getElementById(`commentsWrap-${postId}`);
  if(!block) return;

  const isHidden = block.style.display === 'none';
  block.style.display = isHidden ? 'block' : 'none';

  if(isHidden) loadComments(postId);   // carrega só na primeira abertura
}



/* Like / dislike */
async function reactToPost(postId, isLike=true){
  const field = isLike ? 'likes' : 'dislikes';
  const ref = db.collection('timelineLux').doc(postId);
  await ref.update({ [field]: firebase.firestore.FieldValue.increment(1) });

  // atualiza contador no card
  const span = document.getElementById(`${isLike?'like':'dislike'}-${postId}`);
  span.textContent = (+span.textContent + 1);
}


/************************
 * DISCOVER / CARDS MOCK *
 ************************/
async function loadDiscoverUsers() {
  try {
    const discoverGrid = document.getElementById('discoverGrid');
    discoverGrid.innerHTML = '<div class="loading">Carregando usuários...</div>';

    // Busca usuários no Firestore (excluindo o usuário atual)
    const currentUserId = firebase.auth().currentUser?.uid;
    let query = db.collection('users').where('userId', '!=', currentUserId);

    // Aplica filtro se existir
    const filter = document.getElementById('discoverFilter').value;
    if (filter && filter !== 'all') {
      query = query.where('tipouser', '==', filter);
    }

    const querySnapshot = await query.limit(20).get();

    discoverGrid.innerHTML = '';

    if (querySnapshot.empty) {
      discoverGrid.innerHTML = '<div class="no-results">Nenhum usuário encontrado</div>';
      return;
    }

    querySnapshot.forEach(doc => {
      const user = doc.data();
      discoverGrid.appendChild(createUserCard(user));
    });

  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    document.getElementById('discoverGrid').innerHTML = 
      '<div class="error">Erro ao carregar usuários</div>';
  }
}
function createUserCard(user) {
  const card = document.createElement('div');
  card.className = 'lux-user-card';
  
  // Função para verificar URL da foto
  const getProfilePhoto = (url) => {
    if (!url) return 'https://via.placeholder.com/300';
    
    // Verifica se é uma URL do Firebase Storage
    if (url.startsWith('gs://')) {
      const path = url.split('gs://')[1];
      return `https://firebasestorage.googleapis.com/v0/b/${path}?alt=media`;
    }
    
    // Verifica se é um caminho relativo do Storage
    if (url.startsWith('profile_photos/')) {
      return `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(url)}?alt=media`;
    }
    
    return url; // Retorna URL normal se for válida
  };

  card.innerHTML = `
    ${user.isVip ? '<span class="lux-user-card-vip">VIP</span>' : ''}
    <img src="${getProfilePhoto(user.profilePhotoURL)}" 
         alt="${user.name}" 
         class="lux-user-card-img"
         loading="lazy"
         onerror="this.src='https://via.placeholder.com/300'">
    <div class="lux-user-card-body">
      <h3 class="lux-user-card-name">${user.name}</h3>
      <p class="lux-user-card-info">
        ${user.age ? user.age + ' anos • ' : ''}
        ${user.cidade || ''}
      </p>
      <div class="lux-user-card-actions">
        <button class="lux-btn lux-btn-primary" onclick="likeUser('${user.userId}')">
          <i class="fas fa-heart"></i> Curtir
        </button>
        <button class="lux-btn lux-btn-secondary" onclick="viewProfile('${user.userId}')">
          <i class="fas fa-eye"></i> Ver
        </button>
      </div>
    </div>
  `;
  
  return card;
}



async function getUserLikes(userId) {
  const doc = await db.collection('users').doc(userId).get();
  return doc.data().likes || [];
}

// Função para visualizar perfil
// Declare a função viewProfile no escopo global
async function viewProfile(userId) {
  try {
    // Fecha todos os modais abertos
    document.querySelectorAll('.lux-modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      openProfileModal(userDoc.data());
    } else {
      showToast('Perfil não encontrado', 'error');
    }
  } catch (error) {
    console.error("Erro ao visualizar perfil:", error);
    showToast('Erro ao carregar perfil', 'error');
  }
}
// Função para recarregar a lista
function refreshDiscover() {
  loadDiscoverUsers();
  showToast('Lista atualizada');
}

/**
 * Mostra uma notificação toast
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de toast (success, error, warning)
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `lux-toast lux-toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Mostra o toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove o toast após 3 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
/****************
 * MATCHES MOCK *
 ****************/

async function loadMatches() {
  const container = document.getElementById('matchesContainer');
  container.innerHTML = loadingHTML('Carregando matches...');
  const matches = await mockMatches();
  container.innerHTML = '';
  if (!matches.length) {
    container.innerHTML = emptyHTML('Você ainda não tem matches');
    return;
  }
  matches.forEach(m => container.appendChild(createMatchElement(m)));
}

function createMatchElement(match) {
  const el = document.createElement('div');
  el.className = 'lux-match';
  el.innerHTML = `
    <img src="${match.photo}" alt="${match.name}" class="lux-match-img">
    <div class="lux-match-info"><h3>${match.name}</h3><p>Match ${match.matchedOn}</p></div>
    <button class="lux-btn lux-btn-icon" onclick="startChat('${match.id}')"><i class="fas fa-comment"></i></button>`;
  return el;
}

/*****************
 * MENSAGENS MOCK *
 *****************/

async function loadMessages() {
  const list = document.getElementById('messagesList');
  list.innerHTML = loadingHTML('Carregando mensagens...');
  const msgs = await mockMessages();
  list.innerHTML = '';
  if (!msgs.length) {
    list.innerHTML = emptyHTML('Nenhuma mensagem encontrada');
    return;
  }
  msgs.forEach(m => list.appendChild(createMessageElement(m)));
}

function createMessageElement(msg) {
  const el = document.createElement('div');
  el.className = `lux-message ${msg.unread ? 'unread' : ''}`;
  el.innerHTML = `
    <img src="${msg.photo}" alt="${msg.name}" class="lux-message-img">
    <div class="lux-message-body"><h4>${msg.name}</h4><p>${msg.lastMessage}</p></div>
    <span class="lux-message-time">${msg.time}</span>`;
  el.addEventListener('click', () => startChat(msg.userId));
  return el;
}

function startChat(userId) {
  alert(`Abrindo chat com usuário ${userId} (em construção)`);
}

/*********************
 * PERFIL / MODAL UI *
 *********************/

function openProfileModal(profile) {
  const modal = document.getElementById('profileModal');
  const content = document.getElementById('profileModalContent');
  
  content.innerHTML = `
    <div class="lux-profile-modal">
      <div class="lux-profile-modal-header">
        <img src="${profile.profilePhotoURL || 'https://via.placeholder.com/150'}" 
             class="lux-profile-modal-img" 
             alt="${profile.name}"
             onerror="this.src='https://via.placeholder.com/150'">
        <h2>${profile.name}</h2>
        <p>${profile.tipouser || 'Membro'} • ${profile.age || ''} anos • ${profile.cidade || ''}</p>
      </div>
      <div class="lux-profile-modal-body">
        <h3>Sobre</h3>
        <p>${profile.bio || 'Nenhuma biografia fornecida.'}</p>
        
        ${profile.interestIn ? `
        <h3>Interessado em</h3>
        <p>${profile.interestIn}</p>
        ` : ''}
      </div>
      <div class="lux-profile-actions">
        <button class="lux-btn lux-btn-primary" onclick="startChat('${profile.userId || ''}')">
          <i class="fas fa-envelope"></i> Mensagem
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  modal.onclick = e => (e.target === modal) && (modal.style.display = 'none');
  document.querySelector('.lux-modal-close').onclick = () => modal.style.display = 'none';
}

/*******************
 * HELPERS VISUAIS *
 *******************/

function loadingHTML(text) {
  return `<div class='lux-loading'><i class='fas fa-spinner fa-spin'></i><p>${text}</p></div>`;
}
function emptyHTML(text) {
  return `<div class='lux-no-results'><p>${text}</p></div>`;
}
function toast(text) {
  const n = document.createElement('div');
  n.className = 'lux-notification';
  n.innerHTML = `<i class='fas fa-heart'></i> ${text}`;
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('show'), 10);
  setTimeout(() => n.classList.remove('show'), 2010);
  setTimeout(() => document.body.removeChild(n), 2300);
}

/****************
 * MOCK DATA    *
 ****************/

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mockDiscover() {
  await sleep(600);
  return [
    { id:'1', name:'Ana Silva', age:28, city:'São Paulo', photo:'https://randomuser.me/api/portraits/women/44.jpg', type:'sugar_baby', isVip:true },
    { id:'2', name:'Carlos Oliveira', age:45, city:'Rio de Janeiro', photo:'https://randomuser.me/api/portraits/men/32.jpg', type:'sugar_daddy', isVip:false },
    { id:'3', name:'Mariana Costa', age:35, city:'Belo Horizonte', photo:'https://randomuser.me/api/portraits/women/63.jpg', type:'sugar_mommy', isVip:true },
    { id:'4', name:'Roberto Santos', age:50, city:'Porto Alegre', photo:'https://randomuser.me/api/portraits/men/75.jpg', type:'sugar_daddy', isVip:true },
    { id:'5', name:'Juliana Pereira', age:25, city:'Recife', photo:'https://randomuser.me/api/portraits/women/85.jpg', type:'sugar_baby', isVip:false }
  ];
}
async function mockMatches() {
  await sleep(400);
  return [
    { id:'1', name:'Ana Silva', photo:'https://randomuser.me/api/portraits/women/44.jpg', matchedOn:'Hoje' },
    { id:'2', name:'Carlos Oliveira', photo:'https://randomuser.me/api/portraits/men/32.jpg', matchedOn:'Ontem' },
    { id:'3', name:'Mariana Costa', photo:'https://randomuser.me/api/portraits/women/63.jpg', matchedOn:'3 dias atrás' }
  ];
}
async function mockMessages() {
  await sleep(400);
  return [
    { id:'1', userId:'1', name:'Ana Silva', photo:'https://randomuser.me/api/portraits/women/44.jpg', lastMessage:'Oi, como você está?', time:'10:30', unread:true },
    { id:'2', userId:'2', name:'Carlos Oliveira', photo:'https://randomuser.me/api/portraits/men/32.jpg', lastMessage:'Vamos marcar aquela viagem?', time:'Ontem', unread:false },
    { id:'3', userId:'3', name:'Mariana Costa', photo:'https://randomuser.me/api/portraits/women/63.jpg', lastMessage:'Obrigada pelo jantar!', time:'Seg', unread:false }
  ];
}document.getElementById('newsPostBtn').addEventListener('click', async ()=>{
  const title=document.getElementById('newsTitle').value;
  const text =document.getElementById('newsText').value;
  const file =document.getElementById('newsImage').files[0];
  await postNews({title,text,imageFile:file});
  // limpar campos
  document.getElementById('newsTitle').value='';
  document.getElementById('newsText').value='';
  document.getElementById('newsImage').value='';
});
/* === COMENTÁRIOS ============================================ */
// cole após inicializar Firebase e já ter currentUser

// Detecta touch devices e adiciona classe ao body
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints;
}

if (isTouchDevice()) {
  document.body.classList.add('touch-device');
}

// Evita hover em dispositivos móveis
document.addEventListener('DOMContentLoaded', function() {
  if (isTouchDevice()) {
    document.querySelectorAll('[hover-class]').forEach(el => {
      el.classList.remove(el.getAttribute('hover-class'));
    });
  }
});

// Fecha modais ao tocar fora (melhor para mobile)
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('lux-modal')) {
    e.target.style.display = 'none';
  }
});

/**
 * Carrega os comentários de um post específico
 * @param {string} postId - ID do post
 */
async function loadComments(postId) {
    try {
        const commentsContainer = document.getElementById(`comments-container-${postId}`);
        if (!commentsContainer) return;

        // Mostrar estado de carregamento
        commentsContainer.innerHTML = '<div class="loading-comments">Carregando comentários...</div>';

        // Buscar comentários no Firestore
        const querySnapshot = await db.collection('posts')
            .doc(postId)
            .collection('comments')
            .orderBy('timestamp', 'asc')
            .get();

        // Limpar container
        commentsContainer.innerHTML = '';

        if (querySnapshot.empty) {
            commentsContainer.innerHTML = '<p class="no-comments">Nenhum comentário ainda</p>';
            return;
        }

        // Adicionar cada comentário ao container
        querySnapshot.forEach(doc => {
            const comment = doc.data();
            commentsContainer.appendChild(createCommentElement(comment));
        });

    } catch (error) {
        console.error("Erro ao carregar comentários:", error);
        const commentsContainer = document.getElementById(`comments-container-${postId}`);
        if (commentsContainer) {
            commentsContainer.innerHTML = '<p class="error-comments">Erro ao carregar comentários</p>';
        }
    }
}

/**
 * Cria o elemento HTML para um comentário
 * @param {Object} comment - Dados do comentário
 */
function createCommentElement(comment) {
    const commentEl = document.createElement('div');
    commentEl.className = 'lux-comment';
    
    commentEl.innerHTML = `
        <img src="${comment.userPhoto}" alt="${comment.userName}" class="lux-comment-avatar">
        <div class="lux-comment-content">
            <div class="lux-comment-header">
                <span class="lux-comment-author">${comment.userName}</span>
                <span class="lux-comment-time">${formatCommentTime(comment.timestamp)}</span>
            </div>
            <p class="lux-comment-text">${comment.text}</p>
        </div>
    `;
    
    return commentEl;
}

/**
 * Formata a data do comentário
 * @param {firebase.firestore.Timestamp} timestamp 
 */
function formatCommentTime(timestamp) {
    if (!timestamp || !timestamp.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Alterna a visibilidade dos comentários
 * @param {string} postId - ID do post
 */
function toggleComments(postId) {
    const commentsContainer = document.getElementById(`comments-container-${postId}`);
    const commentForm = document.getElementById(`comment-form-${postId}`);
    
    if (!commentsContainer || !commentForm) return;

    if (commentsContainer.style.display === 'none') {
        commentsContainer.style.display = 'block';
        commentForm.style.display = 'flex';
        loadComments(postId); // Carrega os comentários quando exibidos
    } else {
        commentsContainer.style.display = 'none';
        commentForm.style.display = 'none';
    }
}

/*************************
 * MODAL DE CURTIDAS *
 *************************/
// Função atualizada para mostrar o modal de curtidas
async function showLikesModal() {
  const likesModal = document.getElementById('likesModal');
  if (!likesModal) return;

  try {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Mostrar estado de carregamento
    const modalContent = likesModal.querySelector('.lux-modal-content');
    modalContent.innerHTML = '<div class="loading">Carregando curtidas...</div>';
    
    likesModal.style.display = 'flex';
    document.body.classList.add('lux-modal-open');

    // Buscar dados do usuário para obter a lista de curtidas
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      modalContent.innerHTML = '<div class="no-likes">Nenhum dado de usuário encontrado</div>';
      return;
    }

    const userData = userDoc.data();
    const likes = userData.likes || [];

    // Se não houver curtidas
    if (likes.length === 0) {
      modalContent.innerHTML = `
        <div class="lux-modal-header">
          <h3>Curtidas</h3>
          <span class="lux-modal-close">&times;</span>
        </div>
        <div class="lux-likes-list">
          <p class="no-likes-message">Ninguém curtiu seu perfil ainda</p>
        </div>
      `;
      return;
    }

    // Buscar informações dos usuários que curtiram
    const likesPromises = likes.map(userId => 
      db.collection('users').doc(userId).get().then(doc => ({
        id: userId,
        ...doc.data()
      }))
    );

    const usersWhoLiked = await Promise.all(likesPromises);

    // Construir o HTML do modal
    modalContent.innerHTML = `
      <div class="lux-modal-header">
        <h3>${likes.length} ${likes.length === 1 ? 'pessoa curtiu' : 'pessoas curtiram'}</h3>
        <span class="lux-modal-close">&times;</span>
      </div>
      <div class="lux-likes-list"></div>
    `;

    const likesList = modalContent.querySelector('.lux-likes-list');
    
    // Adicionar cada usuário à lista
    usersWhoLiked.forEach(user => {
      const likeItem = document.createElement('div');
      likeItem.className = 'lux-like-item';
      likeItem.dataset.userId = user.id;

      likeItem.innerHTML = `
        <img src="${user.profilePhotoURL || 'https://via.placeholder.com/50'}" 
             alt="${user.name}" 
             class="lux-like-avatar"
             onerror="this.src='https://via.placeholder.com/50'">
        <span class="lux-like-name">${user.name || 'Usuário'}</span>
      `;

      likeItem.addEventListener('click', () => {
        viewProfile(user.id);
      });

      likesList.appendChild(likeItem);
    });

  } catch (error) {
    console.error('Erro ao carregar curtidas:', error);
    const modalContent = likesModal.querySelector('.lux-modal-content');
    if (modalContent) {
      modalContent.innerHTML = '<div class="error">Erro ao carregar curtidas</div>';
    }
  }
}

function handleLikeUserClick(e) {
  // Verifica se o clique/toque foi no nome do usuário
  const userElement = e.target.closest('.lux-like-user');
  if (userElement) {
    e.preventDefault();
    e.stopPropagation();
    
    const userId = userElement.dataset.userid;
    if (userId) {
      viewProfile(userId);
    }
  }
}
// Fecha o modal quando clicar no X ou fora
document.querySelector('#likesModal .lux-modal-close').addEventListener('click', () => {
  document.getElementById('likesModal').style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target === document.getElementById('likesModal')) {
    document.getElementById('likesModal').style.display = 'none';
  }
});

