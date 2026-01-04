
console.log('Script carregado - Funções disponíveis:', {
  sendGift,
  sendGiftToUser,
  showGratitudeScreen
});
// Configuração de persistência (deve ser chamada uma vez no app)
function initializeFirebase() {
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log('Persistência de autenticação configurada'))
    .catch(error => console.error('Erro na persistência:', error));
}

const imageViewer = setupImageViewer();


// Adicione no início do seu arquivo, antes de qualquer função
const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23CCCCCC"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

// Adicione no topo do seu arquivo, com outras variáveis globais
const pendingAttachments = {
  images: [],
  files: []
};
// Configuração do file input (adicione após as outras variáveis globais)
const fileInputs = {
  image: document.getElementById('chatImageInput'),
  file: document.getElementById('chatFileInput')
};

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
    // Verifica presentes pendentes
    const hasNewGifts = await checkForNewGifts(user.uid);
    
    if (hasNewGifts) {
      // Atualiza a UI para mostrar que há novos presentes
      updateGiftBadge(hasNewGifts);
    }
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
    const user = firebase.auth().currentUser;
    if (!user) return;

    const userDoc = await db.collection('users').doc(user.uid).get();

    if (userDoc.exists) {
      userData = userDoc.data();
      console.log("URL da imagem carregada do Firestore:", userData.profilePhotoURL);


      // Preenche valores padrão caso falte algo
      userData.name = userData.name || 'Usuário LuxMeet';
      userData.tipouser = userData.tipouser || 'member';
      userData.matches = userData.matches || 0;
      userData.views = userData.views || 0;
      userData.likes = Array.isArray(userData.likes) ? userData.likes : [];
      userData.profilePhotoURL = userData.profilePhotoURL || '';

    } else {
      console.warn("Documento do usuário não encontrado. Usando dados padrão.");
      userData = {
        name: 'Usuário LuxMeet',
        tipouser: 'member',
        matches: 0,
        views: 0,
        likes: [],
        profilePhotoURL: ''
      };
    }

    // Atualiza contadores com segurança
updateMatchesCounter(userData.matches ? userData.matches.length : 0);
    const likesCountEl = document.getElementById('likesCount');
    if (likesCountEl) likesCountEl.textContent = userData.likes.length;

    const viewCountEl = document.getElementById('viewCount');
    if (viewCountEl) viewCountEl.textContent = userData.views;

    // Atualiza a interface completa
    updateProfileUI();

  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
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

async function updateProfileUI() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // 1. Primeiro tenta pegar a foto do Firestore
    const profilePhotoURL = await getUserProfilePhoto(user.uid);
    
    // 2. Atualiza o avatar
    const avatarElement = document.getElementById('userAvatar');
    if (avatarElement) {
      if (profilePhotoURL) {
        avatarElement.src = profilePhotoURL;
        // Verifica se a imagem carrega corretamente
        await testImageLoad(avatarElement);
      } else {
        // Fallback para placeholder
        avatarElement.src = 'https://via.placeholder.com/150';
      }
    }} catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    // Garante que algo seja sempre exibido
    document.getElementById('userAvatar').src = 'https://via.placeholder.com/150';
  }
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    const userId = user.uid;

    firebase.firestore().collection('users').doc(userId).get()
      .then(doc => {
        if (doc.exists) {
          userData = doc.data();
        } else {
          console.warn('Documento do usuário não encontrado!');
        }
        updateProfileUI(); // Chama função de atualização da interface
      })
      .catch(error => {
        console.error('Erro ao buscar dados do Firestore:', error);
        updateProfileUI(); // Ainda assim atualiza UI com valores padrão
      });
  } else {
    console.log('Usuário não autenticado');
    updateProfileUI(); // UI com valores padrão
  }
});

function updateUserAvatar() {
  const user = firebase.auth().currentUser;
  const avatarElement = document.getElementById('userAvatar');
  
  if (user && user.photoURL) {
    // Adiciona timestamp para evitar cache
avatarElement.src = profilePhotoURL;
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

async function likeUser(userId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para curtir', 'error');
      return;
    }

    if (currentUser.uid === userId) {
      showToast('Você não pode curtir a si mesmo', 'warning');
      return;
    }

    // Verificar se já curtiu antes
    const likeQuery = await db.collection('likes')
      .where('fromUserId', '==', currentUser.uid)
      .where('toUserId', '==', userId)
      .limit(1)
      .get();

    if (!likeQuery.empty) {
      showToast('Você já curtiu este usuário', 'warning');
      return;
    }

    // 1. Primeiro registrar a curtida
    await db.collection('likes').add({
      fromUserId: currentUser.uid,
      toUserId: userId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Atualizar os arrays de likes nos documentos dos usuários
    const batch = db.batch();
    
    // Usuário que está curtindo (adiciona aos likesGiven)
    const currentUserRef = db.collection('users').doc(currentUser.uid);
    batch.update(currentUserRef, {
      likesGiven: firebase.firestore.FieldValue.arrayUnion(userId)
    });
    
    // Usuário que foi curtido (adiciona aos likes recebidos)
    const likedUserRef = db.collection('users').doc(userId);
    batch.update(likedUserRef, {
      likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });

    await batch.commit();

    // 3. Verificar match ANTES de atualizar a UI
    const isMatch = await checkForMatch(currentUser.uid, userId);
    
    if (isMatch) {
      await createMatch(currentUser.uid, userId);
      showToast('🎉 Novo match! Vocês se curtiram mutuamente', 'success');
    } else {
      showToast('Curtida enviada com sucesso!');
    }

    // 4. Atualizar a contagem de likes
    updateLikesCount();

  } catch (error) {
    console.error("Erro ao curtir usuário:", error);
    showToast('Erro ao enviar curtida', 'error');
  }
}

// Função aprimorada para verificar match
async function checkForMatch(currentUserId, likedUserId) {
  try {
    // Verificar se o usuário curtido já curtiu o atual
    const likedUserDoc = await db.collection('users').doc(likedUserId).get();
    const likedUserData = likedUserDoc.data();
    
    // Verifica se o usuário curtido já deu like no atual
    const hasMutualLike = likedUserData.likesGiven && 
                         likedUserData.likesGiven.includes(currentUserId);
    
    // Verifica se já não são matches
    const alreadyMatched = likedUserData.matches && 
                          likedUserData.matches.includes(currentUserId);
    
    return hasMutualLike && !alreadyMatched;
    
  } catch (error) {
    console.error("Erro ao verificar match:", error);
    return false;
  }
}

// Função para enviar notificações de match
async function sendMatchNotifications(userId1, userId2) {
  try {
    // Buscar dados dos usuários
    const [user1, user2] = await Promise.all([
      db.collection('users').doc(userId1).get(),
      db.collection('users').doc(userId2).get()
    ]);

    const user1Data = user1.data();
    const user2Data = user2.data();

    // Criar notificações
    const batch = db.batch();
    const notificationsRef = db.collection('notifications');

    // Notificação para o usuário 1
    const notif1Ref = notificationsRef.doc();
    batch.set(notif1Ref, {
      userId: userId1,
      type: 'new_match',
      message: `Você deu match com ${user2Data.name || 'um usuário'}!`,
      photoURL: user2Data.profilePhotoURL || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      relatedUserId: userId2
    });

    // Notificação para o usuário 2
    const notif2Ref = notificationsRef.doc();
    batch.set(notif2Ref, {
      userId: userId2,
      type: 'new_match',
      message: `Você deu match com ${user1Data.name || 'um usuário'}!`,
      photoURL: user1Data.profilePhotoURL || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      relatedUserId: userId1
    });

    await batch.commit();

    // Mostrar toast para o usuário atual se estiver logado
    const currentUser = firebase.auth().currentUser;
    if (currentUser && currentUser.uid === userId1) {
      showToast(`🎉 Match com ${user2Data.name || 'um novo usuário'}!`, 'success');
    } else if (currentUser && currentUser.uid === userId2) {
      showToast(`🎉 Match com ${user1Data.name || 'um novo usuário'}!`, 'success');
    }

  } catch (error) {
    console.error("Erro ao enviar notificações de match:", error);
  }
}

async function createMatch(userId1, userId2) {
  try {
    // 1. Atualizar ambos usuários
    const batch = db.batch();
    
    const user1Ref = db.collection('users').doc(userId1);
    batch.update(user1Ref, {
      matches: firebase.firestore.FieldValue.arrayUnion(userId2)
    });
    
    const user2Ref = db.collection('users').doc(userId2);
    batch.update(user2Ref, {
      matches: firebase.firestore.FieldValue.arrayUnion(userId1)
    });

    await batch.commit();

    // 2. Atualizar contador imediatamente
    const currentUser = firebase.auth().currentUser;
    if (currentUser) {
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      const newCount = userDoc.data().matches?.length || 0;
      updateMatchesCounter(newCount);
    }

     // Após criar o match com sucesso:
    const userDoc = await db.collection('users').doc(userId1).get();
    const newCount = userDoc.data().matches?.length || 0;
    updateMatchesCounter(newCount);

    return true;
  } catch (error) {
    console.error("Erro ao criar match:", error);
    return false;
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
      const section = item.dataset.section;
      
      // Se já está na seção clicada, não faz nada
      if (item.classList.contains('active')) return;
      
      document.querySelectorAll('.lux-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showSection(section);
    });
  });
}
document.addEventListener('DOMContentLoaded', function() {
  // Mostra a seção inicial (por exemplo, matches)
  const initialSection = 'matches'; // Altere conforme necessário
  document.querySelector(`.lux-nav-item[data-section="${initialSection}"]`).classList.add('active');
  showSection(initialSection);
  
  // Configura os listeners
  setupNavListeners();
});


function showSection(section) {
  // Primeiro: Esconder todas as seções completamente
  document.querySelectorAll('.lux-section').forEach(sec => {
    sec.style.display = 'none';
    sec.style.opacity = '0';
    sec.style.transform = 'translateX(100%)'; // Animação de saída
    sec.classList.remove('active-section');
  });

  // Mostrar a nova seção
  const sectionElement = document.getElementById(`${section}Section`);
  if (sectionElement) {
    sectionElement.style.display = 'block';
    
    // Pequeno delay para a animação funcionar
    setTimeout(() => {
      sectionElement.style.opacity = '1';
      sectionElement.style.transform = 'translateX(0)';
      sectionElement.classList.add('active-section');
    }, 50);
    
    // Carrega os dados específicos
    switch (section) {
      case 'matches':
        loadMatches();
        break;
      case 'discover':
        loadDiscoverUsers();
        break;
      case 'news':
        loadNewsPosts();
        break;
      case 'messages':
        loadMessages();
        break;
      case 'profile':
        loadUserData2();
        break;
    }
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
    // 1. Upload da imagem (se houver)
    let imageUrl = '';
    if (imageFile) {
      const imageName = `${Date.now()}_${imageFile.name.replace(/\s+/g, '_')}`;
      const storageRef = storage.ref(`newsImages/${currentUser.uid}/${imageName}`);
      await storageRef.put(imageFile);
      imageUrl = await storageRef.getDownloadURL();
    }

    // 2. Criar post
    const postData = {
      uid: currentUser.uid,
      title: title || '',
      text: text || '',
      imageUrl,
      likes: 0,
      dislikes: 0,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 3. Publicar na timeline global
    const globalRef = await db.collection('timelineLux').add(postData);

    // 4. Salvar na subcoleção do usuário
    await db.collection('users')
            .doc(currentUser.uid)
            .collection('posts')
            .doc(globalRef.id)
            .set({
              ...postData,
              postId: globalRef.id,
              globalPath: `timelineLux/${globalRef.id}`
            });

    // 5. Limpar formulário após publicação
    resetPostForm();
    
    toast('Post publicado com sucesso!');
    loadNewsPosts();
    
  } catch (err) {
    console.error('Erro ao publicar:', err);
    alert(err.message || 'Falha ao publicar. Tente novamente.');
  }
}

// Função para limpar o formulário
function resetPostForm() {
  // Limpar campos de texto
  document.getElementById('newsTitle').value = '';
  document.getElementById('newsText').value = '';
  
  // Limpar input de arquivo
  document.getElementById('newsImage').value = '';
  
  // Ocultar pré-visualização
  const previewContainer = document.querySelector('.image-preview');
  previewContainer.style.display = 'none';
  
  // Remover a imagem de preview
  const previewImage = document.getElementById('previewImage');
  previewImage.src = '#';
}
// Função auxiliar com timeout para verificar imagem
async function checkImageExistsWithTimeout(url, timeout) {
  if (!url) return '';
  
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(''), timeout);
    
    fetch(url, { method: 'HEAD' })
      .then(response => {
        clearTimeout(timer);
        resolve(response.ok ? url : '');
      })
      .catch(() => {
        clearTimeout(timer);
        resolve('');
      });
  });
}
// Função auxiliar melhorada para validar URLs de imagem
async function validateImageUrl(url) {
  if (!url) return '';
  
  try {
    // Verifica se é uma URL válida
    new URL(url);
    
    // Verifica se a imagem existe e está acessível
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      console.warn('Imagem não encontrada:', url);
      return '';
    }
    
    // Verifica se é uma imagem
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn('URL não é uma imagem:', url);
      return '';
    }
    
    return url;
  } catch (error) {
    console.warn('Erro ao validar URL da imagem:', url, error);
    return '';
  }
}
// Função auxiliar para verificar se a imagem existe
async function checkImageExists(url) {
  if (!url) return '';
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok ? url : '';
  } catch {
    return '';
  }
}

// Adicione este código após a definição de loadNewsPosts

// Função para atualizar contadores
async function updatePostReaction(postId, action) {
  if (!currentUser) {
    alert('Você precisa estar logado para interagir.');
    return;
  }

  try {
    const postRef = db.collection('timelineLux').doc(postId);
    const userReactionRef = db.collection('postReactions')
                            .doc(`${postId}_${currentUser.uid}`);

    // Usar transação para garantir consistência
    await db.runTransaction(async (transaction) => {
      const postDoc = await transaction.get(postRef);
      const reactionDoc = await transaction.get(userReactionRef);

      const currentReaction = reactionDoc.exists ? reactionDoc.data().reaction : null;
      let likes = postDoc.data().likes || 0;
      let dislikes = postDoc.data().dislikes || 0;

      // Lógica para atualizar reações
      if (action === 'like') {
        if (currentReaction === 'like') {
          likes--;
          transaction.delete(userReactionRef);
        } else {
          if (currentReaction === 'dislike') dislikes--;
          likes++;
          transaction.set(userReactionRef, { 
            reaction: 'like',
            userId: currentUser.uid,
            postId: postId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (action === 'dislike') {
        if (currentReaction === 'dislike') {
          dislikes--;
          transaction.delete(userReactionRef);
        } else {
          if (currentReaction === 'like') likes--;
          dislikes++;
          transaction.set(userReactionRef, { 
            reaction: 'dislike',
            userId: currentUser.uid,
            postId: postId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Atualizar contagens no post
      transaction.update(postRef, {
        likes: likes,
        dislikes: dislikes
      });
    });

    // Recarregar apenas este post
    loadSinglePost(postId);
  } catch (error) {
    console.error('Erro ao atualizar reação:', error);
    alert('Ocorreu um erro ao registrar sua reação.');
  }
}

// Função para carregar um único post
async function loadSinglePost(postId) {
  try {
    const postDoc = await db.collection('timelineLux').doc(postId).get();
    if (postDoc.exists) {
      const post = { id: postDoc.id, ...postDoc.data() };
      const userDoc = await db.collection('users').doc(post.uid).get();
      const userData = userDoc.data();

      const updatedPost = {
        ...post,
        authorName: userData?.name || 'Usuário LuxMeet',
        authorPhoto: userData?.profilePhotoURL || ''
      };

      const postElement = document.querySelector(`.lux-news-card[data-post-id="${postId}"]`);
      if (postElement) {
        const newCard = renderNewsCard(updatedPost);
        postElement.replaceWith(newCard);
        setupPostInteractions(newCard);
      }
    }
  } catch (error) {
    console.error('Erro ao carregar post:', error);
  }
}

async function addComment(postId, commentText) {
  if (!currentUser || !commentText.trim()) return;

  try {
    // Garantir que userData está disponível
    if (!userData) {
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      userData = userDoc.data();
    }

    const commentsRef = db.collection('postComments').doc(postId)
                        .collection('comments').doc();
    
    await commentsRef.set({
      text: commentText,
      userId: currentUser.uid,
      userName: userData?.name || 'Usuário LuxMeet',
      userPhoto: userData?.profilePhotoURL || defaultAvatar,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Atualizar contador de comentários
    await db.collection('timelineLux').doc(postId).update({
      commentsCount: firebase.firestore.FieldValue.increment(1)
    });

    // Recarregar comentários
    await loadComments(postId);
  } catch (error) {
    console.error('Erro ao adicionar comentário:', error);
    alert('Ocorreu um erro ao publicar seu comentário.');
  }
}

async function loadComments(postId) {
  const commentsContainer = document.querySelector(`.lux-news-card[data-post-id="${postId}"] .lux-comments-list`);
  if (!commentsContainer) return;

  try {
    commentsContainer.innerHTML = '<p>Carregando comentários...</p>';
    
    const snapshot = await db.collection('postComments').doc(postId)
                           .collection('comments')
                           .orderBy('timestamp', 'desc')
                           .limit(10)
                           .get();

    if (snapshot.empty) {
      commentsContainer.innerHTML = '<p>Nenhum comentário ainda.</p>';
      return;
    }

    commentsContainer.innerHTML = '';
    snapshot.forEach(doc => {
      const comment = doc.data();
      const commentElement = document.createElement('div');
      commentElement.className = 'lux-comment';
      commentElement.innerHTML = `
        <img src="${comment.userPhoto || defaultAvatar}" 
             class="lux-comment-avatar" 
             alt="Foto de ${comment.userName}"
             onerror="this.src='${defaultAvatar.replace(/'/g, "&#039;")}
        <div class="lux-comment-content">
          <strong>${comment.userName}</strong>
          <p class="lux-comment-text">${comment.text}</p>
          <small class="lux-comment-date">${formatPostDate(comment.timestamp)}</small>
        </div>
      `;
      commentsContainer.appendChild(commentElement);
    });
  } catch (error) {
    console.error('Erro ao carregar comentários:', error);
    commentsContainer.innerHTML = '<p class="lux-comment-error">Erro ao carregar comentários.</p>';
  }
}

// Configurar interações para um post
function setupPostInteractions(postElement) {
  const postId = postElement.dataset.postId;
  
  // Botões de like/dislike
  postElement.querySelector('[data-action="like"]').addEventListener('click', () => {
    updatePostReaction(postId, 'like');
  });
  
  postElement.querySelector('[data-action="dislike"]').addEventListener('click', () => {
    updatePostReaction(postId, 'dislike');
  });
  
  // Botão de comentário
  const commentBtn = postElement.querySelector('[data-action="comment"]');
  const commentsContainer = postElement.querySelector('.lux-comments-container');
  
  commentBtn.addEventListener('click', () => {
    const isVisible = commentsContainer.style.display === 'block';
    commentsContainer.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      loadComments(postId);
    }
  });
  
  // Formulário de comentário
  const commentForm = postElement.querySelector('.lux-comment-form');
  const commentInput = postElement.querySelector('.lux-comment-input');
  const commentSubmit = postElement.querySelector('.lux-btn-comment-submit');
  
  commentSubmit.addEventListener('click', () => {
    const commentText = commentInput.value.trim();
    if (commentText) {
      addComment(postId, commentText);
      commentInput.value = '';
    }
  });
  
  // Permitir enviar comentário com Enter
  commentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commentSubmit.click();
    }
  });
}

// Atualize a função loadNewsPosts para configurar as interações
async function loadNewsPosts() {
  try {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;
    
    postsContainer.innerHTML = '<p>Carregando posts...</p>';
    
    const snapshot = await db.collection('timelineLux')
                           .orderBy('timestamp', 'desc')
                           .limit(20)
                           .get();

    if (snapshot.empty) {
      postsContainer.innerHTML = '<p>Nenhum post encontrado.</p>';
      return;
    }

    postsContainer.innerHTML = '';
    
    const postsPromises = snapshot.docs.map(async (doc) => {
      const post = { id: doc.id, ...doc.data() };
      const userDoc = await db.collection('users').doc(post.uid).get();
      const userData = userDoc.data();
      
      return {
        ...post,
        authorName: userData?.name || 'Usuário LuxMeet',
        authorPhoto: userData?.profilePhotoURL || ''
      };
    });

    const postsWithAuthors = await Promise.all(postsPromises);
    
    postsWithAuthors.forEach(post => {
      const card = renderNewsCard(post);
      postsContainer.appendChild(card);
      setupPostInteractions(card); // Configura as interações para este post
    });
    
  } catch (err) {
    console.error('Erro ao carregar posts:', err);
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
      postsContainer.innerHTML = '<p>Erro ao carregar posts. Recarregue a página.</p>';
    }
  }
}

function showSection(section) {
  // Primeiro: Esconder todas as seções completamente
  document.querySelectorAll('.lux-section').forEach(sec => {
    sec.style.display = 'none';
    sec.style.opacity = '0';
    sec.style.transform = 'translateX(100%)'; // Animação de saída
    sec.classList.remove('active-section');
  });

  // Mostrar a nova seção
  const sectionElement = document.getElementById(`${section}Section`);
  if (sectionElement) {
    sectionElement.style.display = 'block';
    
    // Pequeno delay para a animação funcionar
    setTimeout(() => {
      sectionElement.style.opacity = '1';
      sectionElement.style.transform = 'translateX(0)';
      sectionElement.classList.add('active-section');
    }, 50);
    
    // Carrega os dados específicos
    switch (section) {
      case 'matches':
        loadMatches();
        break;
      case 'discover':
        loadDiscoverUsers();
        break;
      case 'news':
        loadNewsPosts();
        break;
      case 'messages':
        loadMessages();
        break;
      case 'profile':
        loadUserData2();
        break;
    }
  }
}


function renderNewsCard(post) {
  const card = document.createElement('div');
  card.className = 'lux-news-card';
  card.dataset.postId = post.id;

  const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23CCCCCC"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

  card.innerHTML = `
    <div class="lux-news-header">
      <img src="${post.authorPhoto || defaultAvatar}" 
           class="lux-news-avatar clickable-author" 
           alt="Foto de ${post.authorName}"
           data-user-id="${post.uid}"
           onerror="this.src='${defaultAvatar.replace(/'/g, "&#039;")}
      <div>
        <h4 class="lux-news-author clickable-author" data-user-id="${post.uid}">${post.authorName}</h4>
        <span class="lux-news-date">${formatPostDate(post.timestamp)}</span>
      </div>
    </div>

    ${post.imageUrl ? `<img src="${post.imageUrl}" class="lux-news-image" onerror="this.style.display='none'">` : ''}
    ${post.title ? `<h3 class="lux-news-title">${post.title}</h3>` : ''}
    <p class="lux-news-text">${post.text}</p>

    <div class="lux-news-actions">
      <button class="lux-btn-like" data-action="like">
        <i class="fas fa-thumbs-up"></i> 
        <span class="like-count">${post.likes || 0}</span>
      </button>
      
      <button class="lux-btn-dislike" data-action="dislike">
        <i class="fas fa-thumbs-down"></i> 
        <span class="dislike-count">${post.dislikes || 0}</span>
      </button>
      
      <button class="lux-btn-comment" data-action="comment">
        <i class="fas fa-comment"></i> Comentar
      </button>
    </div>

    <div class="lux-comments-container" style="display:none;">
      <div class="lux-comments-list"></div>
      <div class="lux-comment-form">
        <textarea class="lux-comment-input" placeholder="Escreva um comentário..."></textarea>
        <button class="lux-btn lux-btn-primary lux-btn-comment-submit">Enviar</button>
      </div>
    </div>
  `;
 // Adiciona o evento de clique ao nome do autor
 // Adiciona eventos de clique tanto para a imagem quanto para o nome
  const authorElements = card.querySelectorAll('.clickable-author');
  authorElements.forEach(element => {
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = element.getAttribute('data-user-id');
      if (userId) {
        viewProfile(userId);
      }
    });
  });

  return card;
}


const defaultGiftImage = 'https://via.placeholder.com/100?text=Presente';


function getAuthRedirectUrl(targetUrl) {
  const currentUser = firebase.auth().currentUser;
  if (currentUser) {
    return currentUser.getIdToken().then((token) => {
      return `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}auth=${token}`;
    });
  }
  return Promise.resolve(`login.html?redirect=${encodeURIComponent(targetUrl)}`);
}

async function openProfileModal(profileData) {
  const modal = document.getElementById('profileModal');
  if (!modal) {
    console.error('Elemento profileModal não encontrado no DOM');
    return;
  }

  // Mostrar estado de loading
  modal.innerHTML = `
    <div class="lux-modal-content">
      <span class="lux-modal-close">&times;</span>
      <div class="lux-modal-loading">
        <div class="lux-spinner"></div>
        <p>Carregando perfil...</p>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    // Processar dados do perfil
    const interests = profileData.interests ? 
      profileData.interests.split(',').map(i => i.trim()) : [];
    
    const gifts = (profileData.gifts && Array.isArray(profileData.gifts.received)) ? 
      profileData.gifts.received.filter(gift => gift && gift.image) : [];
    const hasGifts = gifts.length > 0;

    // Buscar prévia da galeria
    let galleryPreview = '';
    try {
      const preview = await getGalleryPreview(profileData.userId || profileData.id);
      galleryPreview = preview || '';
    } catch (error) {
      console.error('Erro ao carregar prévia da galeria:', error);
      galleryPreview = '';
    }

    // Construir conteúdo completo do modal
    const modalContent = `
      <div class="lux-profile-modal">
        <!-- Cabeçalho do Perfil -->
        <div class="lux-profile-modal-header">
          <div class="lux-avatar-container">
            <img src="${profileData.profilePhotoURL || defaultAvatar}" 
                 class="lux-profile-modal-img" 
                 alt="${profileData.name || 'Usuário'}"
                 onerror="this.src='${defaultAvatar}'">
            ${profileData.selo ? `<span class="lux-badge">${profileData.selo}</span>` : ''}
          </div>
          <div class="lux-profile-titles">
            <h2>${profileData.name || 'Usuário'}</h2>
            <div class="lux-profile-meta">
              ${profileData.tipouser ? `<span class="lux-user-type">${profileData.tipouser}</span>` : ''}
              ${profileData.age ? `<span><i class="fas fa-birthday-cake"></i> ${profileData.age} anos</span>` : ''}
              ${profileData.cidade ? `<span><i class="fas fa-map-marker-alt"></i> ${profileData.cidade}</span>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Corpo do Perfil -->
        <div class="lux-profile-modal-body">
          ${profileData.bio ? `
          <div class="lux-profile-section">
            <h3><i class="fas fa-quote-left"></i> Sobre</h3>
            <p>${profileData.bio}</p>
          </div>` : ''}
          
          ${profileData.interestIn ? `
          <div class="lux-profile-section">
            <h3><i class="fas fa-heart"></i> Interessado em</h3>
            <p>${profileData.interestIn}</p>
          </div>` : ''}
          
          ${interests.length > 0 ? `
          <div class="lux-profile-section">
            <h3><i class="fas fa-tags"></i> Interesses</h3>
            <div class="lux-interests">
              ${interests.map(i => `<span class="lux-interest-tag">${i}</span>`).join('')}
            </div>
          </div>` : ''}
        </div>
        
        <!-- Prévia da Galeria -->
        <div class="lux-profile-gallery-preview">
          <div class="lux-gallery-header">
            <h3><i class="fas fa-camera-retro"></i> Minha Galeria</h3>
            <a href="#" class="lux-view-all">
              Ver Tudo <i class="fas fa-arrow-right"></i>
            </a>
          </div>
          <div class="lux-gallery-grid" id="galleryPreviewContainer">
            ${galleryPreview || `
              <div class="lux-no-gallery">
                <i class="fas fa-camera"></i>
                <p>Nenhum álbum público disponível</p>
              </div>
            `}
          </div>
        </div>
        
        <!-- Presentes Recebidos -->
        ${hasGifts ? `
        <div class="lux-profile-gifts">
          <h3><i class="fas fa-gifts"></i> Presentes Recebidos (${gifts.length})</h3>
          <div class="lux-gifts-container">
            ${gifts.map(gift => `
              <div class="lux-gift-item" title="${gift.name || 'Presente'} (${formatCurrency(gift.price || 0)})">
                <img src="${gift.image}" alt="${gift.name || 'Presente'}" class="lux-gift-image" 
                     onerror="this.src='${defaultGiftImage || defaultAvatar}'">
                ${gift.category ? `<span class="lux-gift-category">${gift.category}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>` : ''}
        
        <!-- Ações -->
        <div class="lux-profile-actions">
          <button class="lux-btn lux-btn-message" onclick="startChatWithUser('${profileData.userId || profileData.id}')">
            <i class="fas fa-paper-plane"></i> Mensagem
          </button>
          <button class="lux-btn lux-btn-gift" onclick="openGiftModal('${profileData.userId || profileData.id}')">
            <i class="fas fa-gift"></i> Presentear
          </button>
          <button class="lux-btn lux-btn-date" onclick="proposeDate('${profileData.userId || profileData.id}')">
            <i class="fas fa-calendar-star"></i> Encontro
          </button>
          ${profileData.wishlistUrl ? `
          <button class="lux-btn lux-btn-wishlist" onclick="window.open('${profileData.wishlistUrl}', '_blank')">
            <i class="fas fa-heart"></i> Lista de Desejos
          </button>` : ''}
          <button class="lux-btn lux-btn-allowance" onclick="showAllowanceOptions('${profileData.userId || profileData.id}')">
            <i class="fas fa-hand-holding-usd"></i> Apoio
          </button>
        </div>
      </div>
    `;

    // Atualizar o modal com o conteúdo completo
    modal.innerHTML = `
      <div class="lux-modal-content">
        <span class="lux-modal-close">&times;</span>
        ${modalContent}
      </div>
    `;
// Adicionar evento de clique para o botão "Ver tudo"
const viewAllBtn = modal.querySelector('.lux-view-all');
if (viewAllBtn) {
  viewAllBtn.addEventListener('click', function(e) {
    e.preventDefault();
    const profileUserId = profileData.userId || profileData.id;
    
    // Verificar se é o mesmo usuário logado
    const currentUser = firebase.auth().currentUser;
    const isOwnProfile = currentUser && currentUser.uid === profileUserId;
    
    // Armazenar em múltiplos lugares para redundância
    const galleryData = {
      creatorId: profileUserId,
      viewerId: currentUser ? currentUser.uid : '',
      isOwnGallery: isOwnProfile,
      timestamp: Date.now()
    };
    
    // 1. Session Storage (para navegação normal)
    sessionStorage.setItem('galleryData', JSON.stringify(galleryData));
    
    // 2. Local Storage (como fallback)
    localStorage.setItem('tempGalleryData', JSON.stringify(galleryData));
    
    // 3. URL Hash (para GitHub Codespaces)
    const hash = `#gallery-${btoa(JSON.stringify(galleryData))}`;
    
    // Redirecionar com hash
    window.location.href = `minhagaleriaCL.html${hash}`;
  });
}
// Adicionar evento de clique para a galeria
const galleryContainer = document.getElementById('galleryPreviewContainer');
if (galleryContainer) {
    galleryContainer.addEventListener('click', (e) => {
        if (e.target.closest('.lux-view-all') || e.target.closest('.lux-no-gallery')) {
            return;
        }
        const profileUserId = profileData.userId || profileData.id;
        redirectToGallery(profileUserId);
    });
    
    galleryContainer.style.cursor = 'pointer';
}
      
    

    // Configurar eventos para fechar o modal
    const closeModal = () => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    modal.querySelector('.lux-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());
    
    document.addEventListener('keydown', function handleEsc(e) {
      if (e.key === 'Escape') closeModal();
      document.removeEventListener('keydown', handleEsc);
    });

  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    modal.innerHTML = `
      <div class="lux-modal-content">
        <span class="lux-modal-close">&times;</span>
        <div class="lux-modal-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar perfil. Tente novamente.</p>
          <button class="lux-btn lux-btn-retry" onclick="openProfileModal(${JSON.stringify(profileData).replace(/"/g, '&quot;')})">
            <i class="fas fa-sync-alt"></i> Tentar novamente
          </button>
        </div>
      </div>
    `;
    
    const closeModal = () => {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };
    
    modal.querySelector('.lux-modal-close')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());
  }
}

// Atualize também a função redirectToGallery:
window.redirectToGallery = async function(creatorId) {
    try {
        const currentUser = firebase.auth().currentUser;
        const isOwnGallery = currentUser && currentUser.uid === creatorId;
        
        // Usar sessionStorage para evitar problemas com parâmetros
        sessionStorage.setItem('galleryRedirectData', JSON.stringify({
          creatorId: creatorId,
          viewerId: currentUser ? currentUser.uid : '',
          isOwnGallery: isOwnGallery,
          timestamp: Date.now()
        }));
        
        window.location.href = 'minhagaleriaCL.html';
    } catch (error) {
        console.error('Erro no redirecionamento:', error);
        window.location.href = 'login.html';
    }
};

// Função auxiliar para obter usuário autenticado
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

async function getGalleryPreview(userId) {
    try {
        console.log(`Buscando galeria para o usuário: ${userId}`);
        
        const albumsRef = db.collection('users').doc(userId).collection('MinhaGaleria');
        const albumsSnapshot = await albumsRef
            .where('privacy', 'in', ['public', 'paid']) // Mostrar álbuns públicos ou pagos
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();

        if (albumsSnapshot.empty) {
            console.log('Nenhum álbum encontrado');
            return null;
        }

        let previewHtml = '';
        const storage = firebase.storage();
        
        for (const albumDoc of albumsSnapshot.docs) {
            const album = albumDoc.data();
            console.log(`Processando álbum: ${album.name}`);
            
            // Tenta obter a URL da capa
            let coverUrl = album.coverUrl;
            
            // Se não tiver capa, busca a primeira foto
            if (!coverUrl) {
                const firstPhoto = await albumDoc.ref.collection('photos')
                    .orderBy('uploadedAt')
                    .limit(1)
                    .get();
                    
                if (!firstPhoto.empty) {
                    coverUrl = firstPhoto.docs[0].data().url;
                }
            }
            
            // Fallback se não encontrar imagem
            if (!coverUrl) {
                coverUrl = 'https://via.placeholder.com/300x200?text=Sem+Imagem';
            }

            previewHtml += `
                <div class="lux-album-preview" data-album-id="${albumDoc.id}">
                    <div class="lux-album-cover">
                        <img src="${coverUrl}" alt="${album.name}" loading="lazy">
                        <div class="lux-album-overlay">
                            <span class="lux-album-name">${album.name}</span>
                            <span class="lux-album-count">${album.photosCount || 0} foto(s)</span>
                            ${album.privacy === 'paid' ? `
                            <span class="lux-album-premium">
                                <i class="fas fa-crown"></i> Premium
                            </span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        return previewHtml;
    } catch (error) {
        console.error("Erro ao buscar prévia da galeria:", error);
        return null;
    }
}
async function checkGalleryPermission(userId) {
    // Implemente sua lógica de permissão aqui
    // Por exemplo, verificar se é público, se o usuário pagou, etc.
    return true; // Temporariamente retorna true para todos
}



async function loadUserPosts(userId) {
  const postsGrid = document.getElementById('userPostsGrid');
  if (!postsGrid) return;

  try {
    postsGrid.innerHTML = '<p>Carregando publicações...</p>';
    
    const snapshot = await db.collection('users').doc(userId)
                          .collection('posts')
                          .orderBy('timestamp', 'desc')
                          .limit(6)
                          .get();

    if (snapshot.empty) {
      postsGrid.innerHTML = '<p>Nenhuma publicação encontrada.</p>';
      return;
    }

    postsGrid.innerHTML = '';
    snapshot.forEach(doc => {
      const post = doc.data();
      const postElement = document.createElement('div');
      postElement.className = 'lux-post-thumbnail';
      
      if (post.imageUrl) {
        postElement.innerHTML = `
          <img src="${post.imageUrl}" alt="Publicação" 
               onerror="this.style.display='none'">
        `;
      } else {
        postElement.innerHTML = `
          <div class="lux-text-thumbnail">
            <p>${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}</p>
          </div>
        `;
      }
      
      postElement.addEventListener('click', () => {
        // Implemente a visualização completa do post se necessário
        showToast('Clique para ver publicação completa', 'info');
      });
      
      postsGrid.appendChild(postElement);
    });
  } catch (error) {
    console.error('Erro ao carregar publicações:', error);
    postsGrid.innerHTML = '<p>Erro ao carregar publicações.</p>';
  }
}
// Função auxiliar para escapar caracteres HTML
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}




// Função global para tratamento de erro de imagem
window.handleImageError = function(imgElement) {
  const fallback = imgElement.getAttribute('data-fallback');
  
  // Evita loop infinito
  if (imgElement.src !== fallback) {
    imgElement.src = fallback;
    imgElement.onerror = null; // Remove o handler para evitar loops
  }
};
// Função auxiliar para formatar a data
function formatPostDate(timestamp) {
  if (!timestamp?.toDate) return '';
  const date = timestamp.toDate();
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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


let searchTimeout = null;

async function loadDiscoverUsers() {
  const grid = document.getElementById('discoverGrid');
  if (!grid) return;

  // Mostrar estado de carregamento
  grid.innerHTML = `
    <div class="lux-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Buscando perfis...</p>
    </div>
  `;

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Obter dados do usuário atual
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      grid.innerHTML = '<div class="error">Perfil não encontrado</div>';
      return;
    }

    const currentUserData = userDoc.data();
    const isVip = currentUserData.VIP === true;

    // Obter valores dos filtros
    const filters = {
      gender: document.getElementById('filterGender')?.value || '',
      minAge: parseInt(document.getElementById('filterMinAge')?.value) || 18,
      maxAge: parseInt(document.getElementById('filterMaxAge')?.value) || 99,
      city: document.getElementById('filterCity')?.value.toLowerCase().trim() || '',
      userType: document.getElementById('filterUserType')?.value || '',
      onlyVip: document.getElementById('filterOnlyVip')?.checked || false
    };

    // Construir query base
    let query = db.collection('users')
      .where('userId', '!=', user.uid); // Exclui o próprio usuário

    // Aplicar filtros VIP
    if (!isVip) {
      query = query.where('VIP', '==', false);
    } else if (filters.onlyVip) {
      query = query.where('VIP', '==', true);
    }

    // Se houver texto na busca por cidade, usar filtro eficiente
    if (filters.city) {
      query = query
        .orderBy('cidade')
        .startAt(filters.city)
        .endAt(filters.city + '\uf8ff');
    }

    // Executar query
    const snapshot = await query.get();

    // Processar resultados com filtros adicionais
    const today = new Date();
    const currentYear = today.getFullYear();
    let users = [];

    snapshot.forEach(doc => {
      const userData = doc.data();
      
      // Calcular idade
      let age = 0;
      if (userData.dateOfBirth) {
        const birthYear = new Date(userData.dateOfBirth).getFullYear();
        age = currentYear - birthYear;
      }

      // Aplicar filtros que não estão no Firestore query
      const matchesGender = !filters.gender || 
                          (userData.gender || '').toLowerCase() === filters.gender.toLowerCase();
      const matchesAge = age >= filters.minAge && age <= filters.maxAge;
      const matchesUserType = !filters.userType || 
                             (userData.tipouser || '').toLowerCase() === filters.userType.toLowerCase();

      if (matchesGender && matchesAge && matchesUserType) {
        users.push({
          id: doc.id,
          ...userData,
          age: age
        });
      }
    });

    // Ordenar resultados (VIPs primeiro)
    users.sort((a, b) => (b.VIP - a.VIP) || a.name.localeCompare(b.name));

    // Exibir resultados
    grid.innerHTML = '';
    if (users.length === 0) {
      let message = 'Nenhum perfil encontrado';
      if (filters.city) {
        message = `Nenhum usuário encontrado em "${filters.city}"`;
      }
      
      grid.innerHTML = `
        <div class="lux-no-results">
          <i class="fas ${filters.city ? 'fa-map-marker-alt' : 'fa-user-slash'}"></i>
          <h3>${message}</h3>
          <p>Tente ajustar seus filtros de busca</p>
          <button class="lux-btn" onclick="resetFilters()">
            <i class="fas fa-filter"></i> Limpar filtros
          </button>
        </div>
      `;
      return;
    }

    users.forEach(user => {
      const card = createUserCard(user);
      grid.appendChild(card);
    });

  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    grid.innerHTML = `
      <div class="lux-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar perfis</p>
        <button class="lux-btn" onclick="loadDiscoverUsers()">
          <i class="fas fa-sync-alt"></i> Tentar novamente
        </button>
      </div>
    `;
  }
}

// Configurar busca em tempo real para cidade
function setupCitySearch() {
  const cityInput = document.getElementById('filterCity');
  if (!cityInput) return;

  cityInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      loadDiscoverUsers();
    }, 500); // Debounce de 500ms
  });
}

// Função para resetar os filtros
function resetFilters() {
  document.getElementById('filterGender').value = '';
  document.getElementById('filterMinAge').value = '18';
  document.getElementById('filterMaxAge').value = '99';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterUserType').value = '';
  document.getElementById('filterOnlyVip').checked = false;
  loadDiscoverUsers();
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
  setupCitySearch();
});

// Função para criar os cards de usuário (mantendo o estilo anterior)
function createUserCard(user) {
  const card = document.createElement('div');
  card.className = 'lux-user-card';
  
  // Verificar se é VIP para adicionar badge
  const vipBadge = user.VIP ? '<span class="lux-user-card-vip">VIP</span>' : '';

  // Tratar URL da foto de perfil
  const profilePhoto = user.profilePhotoURL || 'https://via.placeholder.com/300';

  card.innerHTML = `
    ${vipBadge}
    <img src="${profilePhoto}" 
         alt="${user.name}" 
         class="lux-user-card-img"
         loading="lazy"
         onerror="this.src='https://via.placeholder.com/300'">
    <div class="lux-user-card-body">
      <h3 class="lux-user-card-name">${user.name || 'Usuário LuxMeet'}</h3>
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

// 2. FUNÇÕES AUXILIARES
function calcularIdade(dateString) {
  const birthDate = new Date(dateString);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function getValue(id, defaultValue = '', toLower = false) {
  const element = document.getElementById(id);
  if (!element) return defaultValue;
  const value = element.value.trim();
  return toLower ? value.toLowerCase() : value || defaultValue;
}

function getNumber(id, defaultValue = 0, min = 0) {
  const value = parseInt(document.getElementById(id)?.value || defaultValue);
  return Math.max(min, isNaN(value) ? defaultValue : value);
}

function getCheckbox(id, defaultValue = false) {
  const element = document.getElementById(id);
  return element ? element.checked : defaultValue;
}

function showEmptyState(isVip) {
  const grid = document.getElementById('discoverGrid');
  grid.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-user-slash"></i>
      <h3>${isVip ? 'Nenhum perfil encontrado' : 'Atualize para VIP para mais opções'}</h3>
      <button onclick="loadDiscoverUsers()">Recarregar</button>
    </div>
  `;
}

function showErrorState() {
  const grid = document.getElementById('discoverGrid');
  grid.innerHTML = `
    <div class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Erro ao carregar perfis</h3>
      <button onclick="loadDiscoverUsers()">Tentar novamente</button>
    </div>
  `;
}

// 3. CONTROLE DE EVENTOS
function setupEventListeners() {

  // Adicionar evento para o item do menu Live
const liveNavItem = document.querySelector('.lux-nav-item[data-section="live"]');
if (liveNavItem) {
    liveNavItem.addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'lux-meet-live.html';
    });
}


  // Elementos de filtro
  const filterElements = [
    'filtroTipo', 'filtroGenero', 'filtroCidade',
    'filtroIdadeMin', 'filtroIdadeMax', 'filtroVip'
  ];
  
  filterElements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => loadDiscoverUsers());
    }
  });

  // Botão limpar filtros
  const limparBtn = document.getElementById('limparFiltros');
  if (limparBtn) {
    limparBtn.addEventListener('click', () => {
      sessionStorage.removeItem('ultimosFiltros');
      filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          if (element.type === 'checkbox') element.checked = false;
          else element.value = '';
        }
      });
      loadDiscoverUsers();
    });
  }
}


// 4. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticação
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      db.collection('users').doc(user.uid).get().then(doc => {
        if (doc.exists) {
          const usuario = doc.data();
          localStorage.setItem('usuario', JSON.stringify(usuario));
          setupEventListeners();
          loadDiscoverUsers(usuario);
        }
      });
    } else {
      window.location.href = 'login.html';
    }
  });
});


// Inicialize o listener quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
  setupCitySearch();
});

async function loadDiscoverUsers() {
  const grid = document.getElementById('discoverGrid');
  if (!grid) return;

  // Mostrar estado de carregamento
  grid.innerHTML = `
    <div class="lux-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Buscando perfis...</p>
    </div>
  `;

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Obter dados do usuário atual
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      grid.innerHTML = '<div class="error">Perfil não encontrado</div>';
      return;
    }

    const currentUserData = userDoc.data();
    const isVip = currentUserData.VIP === true;

    // Obter valores dos filtros
    const filters = {
      gender: document.getElementById('filterGender')?.value || '',
      minAge: parseInt(document.getElementById('filterMinAge')?.value) || 18,
      maxAge: parseInt(document.getElementById('filterMaxAge')?.value) || 99,
      city: document.getElementById('filterCity')?.value.toLowerCase().trim() || '',
      userType: document.getElementById('filterUserType')?.value || '',
      onlyVip: document.getElementById('filterOnlyVip')?.checked || false
    };

    // Construir query base - removemos a desigualdade e filtraremos manualmente
    let query = db.collection('users');

    // Aplicar filtros VIP
    if (!isVip) {
      query = query.where('VIP', '==', false);
    } else if (filters.onlyVip) {
      query = query.where('VIP', '==', true);
    }

    // Se houver texto na busca por cidade, usar filtro eficiente
    if (filters.city) {
      query = query
        .orderBy('cidade')
        .startAt(filters.city)
        .endAt(filters.city + '\uf8ff');
    } else {
      // Ordenação padrão quando não há filtro de cidade
      query = query.orderBy('name');
    }

    // Executar query
    const snapshot = await query.limit(100).get();

    // Processar resultados com filtros adicionais
    const today = new Date();
    const currentYear = today.getFullYear();
    let users = [];

    snapshot.forEach(doc => {
      // Filtro manual para excluir o próprio usuário
      if (doc.id === user.uid) return;

      const userData = doc.data();
      
      // Calcular idade
      let age = 0;
      if (userData.dateOfBirth) {
        const birthYear = new Date(userData.dateOfBirth).getFullYear();
        age = currentYear - birthYear;
      }

      // Aplicar filtros que não estão no Firestore query
      const matchesGender = !filters.gender || 
                          (userData.gender || '').toLowerCase() === filters.gender.toLowerCase();
      const matchesAge = age >= filters.minAge && age <= filters.maxAge;
      const matchesUserType = !filters.userType || 
                             (userData.tipouser || '').toLowerCase() === filters.userType.toLowerCase();

      if (matchesGender && matchesAge && matchesUserType) {
        users.push({
          id: doc.id,
          ...userData,
          age: age
        });
      }
    });

    // Ordenar resultados (VIPs primeiro)
    users.sort((a, b) => (b.VIP - a.VIP) || a.name.localeCompare(b.name));

    // Exibir resultados
    grid.innerHTML = '';
    if (users.length === 0) {
      let message = 'Nenhum perfil encontrado';
      if (filters.city) {
        message = `Nenhum usuário encontrado em "${filters.city}"`;
      }
      
      grid.innerHTML = `
        <div class="lux-no-results">
          <i class="fas ${filters.city ? 'fa-map-marker-alt' : 'fa-user-slash'}"></i>
          <h3>${message}</h3>
          <p>Tente ajustar seus filtros de busca</p>
          <button class="lux-btn" onclick="resetFilters()">
            <i class="fas fa-filter"></i> Limpar filtros
          </button>
        </div>
      `;
      return;
    }

    users.forEach(user => {
      const card = createUserCard(user);
      grid.appendChild(card);
    });

  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    grid.innerHTML = `
      <div class="lux-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar perfis</p>
        <button class="lux-btn" onclick="loadDiscoverUsers()">
          <i class="fas fa-sync-alt"></i> Tentar novamente
        </button>
      </div>
    `;
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

async function viewProfile(userId) {
    try {
        showLoader(); // Mostra um indicador de carregamento
        
        const userDoc = await firebase.firestore().collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            openProfileModal({
                ...userData,
                userId: userId
            });
        } else {
            showToast('Perfil não encontrado', 'error');
        }
    } catch (error) {
        console.error("Erro ao visualizar perfil:", error);
        showToast('Erro ao carregar perfil', 'error');
    } finally {
        hideLoader(); // Esconde o indicador de carregamento
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
/**
 * Carrega e exibe os matches do usuário na seção de matches
 */

// Função auxiliar para atualizar contagem de likes
async function updateLikesCount() {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const likesCount = userDoc.data()?.likes?.length || 0;
    
    const likesCountElement = document.getElementById('likesCount');
    if (likesCountElement) {
      likesCountElement.textContent = likesCount;
    }
  } catch (error) {
    console.error("Erro ao atualizar contagem de likes:", error);
  }
}

// 1. Defina a função corretamente (substitua a existente)
function updateMatchesCounter(count) {
  // Atualiza o badge do menu
  const menuBadge = document.querySelector('.lux-nav-item[data-section="matches"] .lux-badge');
  if (menuBadge) {
    menuBadge.textContent = count;
    menuBadge.style.display = count > 0 ? 'flex' : 'none';
  }
  
  // Atualiza o contador de estatísticas
  const statsCounter = document.getElementById('matchCount');
  if (statsCounter) {
    statsCounter.textContent = count;
    
    // Animação (opcional)
    statsCounter.classList.add('pop');
    setTimeout(() => statsCounter.classList.remove('pop'), 300);
  }
}

// Função para carregar matches e atualizar contagem
async function loadMatches() {
  const container = document.getElementById('matchesContainer');
  if (!container) return;

  // Mostrar loading
  container.innerHTML = '<div class="loading">Carregando matches...</div>';

  try {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Buscar dados do usuário
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const matchesIds = userData.matches || [];
    const matchesCount = matchesIds.length;

    // Atualizar contador (número total)
    updateMatchesCounter(matchesCount);

    if (matchesCount === 0) {
      container.innerHTML = '<div class="no-matches">Nenhum match encontrado</div>';
      return;
    }

    // Exibir matches
    container.innerHTML = `
      <h3>Seus Matches (${matchesCount})</h3>
      <div class="matches-grid" id="matchesGrid"></div>
    `;

    // Preencher com cards de match
    const grid = document.getElementById('matchesGrid');
    matchesIds.forEach(matchId => {
      db.collection('users').doc(matchId).get().then(doc => {
        if (doc.exists) {
          grid.appendChild(createMatchCard(doc.data()));
        }
      });
    });

  } catch (error) {
    console.error("Erro ao carregar matches:", error);
    container.innerHTML = '<div class="error">Erro ao carregar matches</div>';
  }
}


// Chame updateMatchesCount quando o usuário logar
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    updateMatchesCounter();
  }
});


// Função para criar elemento de match
function createMatchElement(match) {
  const element = document.createElement('div');
  element.className = 'lux-match-card';
  
  element.innerHTML = `
    <div class="match-photo-container">
      <img src="${match.profilePhotoURL || 'https://via.placeholder.com/150'}" 
           alt="${match.name}" 
           class="lux-match-photo"
           onerror="this.src='https://via.placeholder.com/150'">
      ${match.VIP ? '<span class="vip-badge">VIP</span>' : ''}
    </div>
    <div class="match-info">
      <h4>${match.name || 'Usuário'}</h4>
      <p>${match.age ? match.age + ' anos' : ''} ${match.city ? ' • ' + match.city : ''}</p>
      <div class="match-actions">
        <button class="lux-btn lux-btn-icon" onclick="startChat('${match.id}')">
          <i class="fas fa-comment"></i> Mensagem
        </button>
      </div>
    </div>
  `;

  return element;
}



// Função para mostrar notificação de match
async function showMatchNotification(userId1, userId2) {
  try {
    // Buscar dados dos usuários para a notificação
    const [user1, user2] = await Promise.all([
      db.collection('users').doc(userId1).get(),
      db.collection('users').doc(userId2).get()
    ]);

    const user1Data = user1.data();
    const user2Data = user2.data();

    // Criar notificação para ambos usuários
    const notificationsCol = db.collection('notifications');
    const batch = db.batch();
    
    // Notificação para o usuário 1
    const notif1Ref = notificationsCol.doc();
    batch.set(notif1Ref, {
      userId: userId1,
      type: 'new_match',
      message: `Você deu match com ${user2Data.name || 'um usuário'}!`,
      photoURL: user2Data.profilePhotoURL || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Notificação para o usuário 2
    const notif2Ref = notificationsCol.doc();
    batch.set(notif2Ref, {
      userId: userId2,
      type: 'new_match',
      message: `Você deu match com ${user1Data.name || 'um usuário'}!`,
      photoURL: user1Data.profilePhotoURL || '',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Mostrar toast para o usuário atual (se estiver logado)
    const currentUser = firebase.auth().currentUser;
    if (currentUser && (currentUser.uid === userId1 || currentUser.uid === userId2)) {
      const matchName = currentUser.uid === userId1 ? user2Data.name : user1Data.name;
      showToast(`🎉 Match com ${matchName || 'um novo usuário'}!`, 'success');
    }

  } catch (error) {
    console.error("Erro ao enviar notificação de match:", error);
  }
}



/**
 * Cria um card de match para a UI
 */function createMatchCard(match) {
  const card = document.createElement('div');
  card.className = 'lux-match-card';
  
  // Garante valores padrão para evitar erros
  const safeMatch = {
    id: match.id || '',
    name: match.name || 'Usuário',
    age: match.age || null,
    cidade: match.cidade || '',
    profilePhotoURL: match.profilePhotoURL || 'https://via.placeholder.com/150',
    VIP: match.VIP || false,
    lastMatch: match.lastMatch || null
  };

  // Formatar data do último match (se disponível)
  let matchDate = '';
  if (safeMatch.lastMatch && safeMatch.lastMatch.toDate) {
    try {
      matchDate = safeMatch.lastMatch.toDate().toLocaleDateString('pt-BR');
    } catch (e) {
      console.error("Erro ao formatar data:", e);
    }
  }

  card.innerHTML = `
    <div class="lux-match-card-header">
      <img src="${safeMatch.profilePhotoURL}" 
           alt="${safeMatch.name}" 
           class="lux-match-avatar"
           onerror="this.src='https://via.placeholder.com/150'">
      ${safeMatch.VIP ? '<span class="lux-match-vip-badge">VIP</span>' : ''}
    </div>
    
    <div class="lux-match-card-body">
      <h3 class="lux-match-name">${safeMatch.name}</h3>
      <p class="lux-match-info">
        ${safeMatch.age ? safeMatch.age + ' anos • ' : ''}
        ${safeMatch.cidade}
      </p>
      ${matchDate ? `<p class="lux-match-date">Match em ${matchDate}</p>` : ''}
    </div>
    
    <div class="lux-match-card-actions">
      <button class="lux-btn lux-btn-icon chat-btn" data-userid="${safeMatch.id}">
        <i class="fas fa-comment-dots"></i>
      </button>
      <button class="lux-btn lux-btn-icon view-btn" data-userid="${safeMatch.id}">
        <i class="fas fa-user"></i>
      </button>
      <button class="lux-btn lux-btn-icon remove-btn" data-userid="${safeMatch.id}">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  // Adiciona event listeners diretamente (mais seguro que onclick no HTML)
  card.querySelector('.chat-btn').addEventListener('click', () => startChat(safeMatch.id));
  card.querySelector('.view-btn').addEventListener('click', () => viewProfile(safeMatch.id));
  card.querySelector('.remove-btn').addEventListener('click', () => confirmRemoveMatch(safeMatch.id));

  return card;
}


// Função para confirmar remoção de match
async function confirmRemoveMatch(matchId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      showToast('Você precisa estar logado para esta ação', 'error');
      return;
    }

    const result = await Swal.fire({
      title: 'Remover match?',
      text: "Você não poderá reverter isso!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, remover!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      await removeMatch(matchId);
    }
  } catch (error) {
    console.error("Erro na confirmação:", error);
  }
}


/**
 * Remove um match
 */
// Função para remover match (atualizada)
async function removeMatch(matchId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Remove o match dos dois usuários atomicamente
    const batch = db.batch();
    
    // Remove do usuário atual
    const currentUserRef = db.collection('users').doc(user.uid);
    batch.update(currentUserRef, {
      matches: firebase.firestore.FieldValue.arrayRemove(matchId)
    });
    
    // Remove do outro usuário
    const matchUserRef = db.collection('users').doc(matchId);
    batch.update(matchUserRef, {
      matches: firebase.firestore.FieldValue.arrayRemove(user.uid)
    });

    await batch.commit();

    // Atualiza a UI
    showToast('Match removido com sucesso', 'success');
    
    // Recarrega os matches
    loadMatches();

  } catch (error) {
    console.error('Erro ao remover match:', error);
    showToast('Erro ao remover match', 'error');
  }
}
async function startChat(userId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    // Verifica se já existe um chat
    const existingChat = await findExistingChat(currentUser.uid, userId);
    
    if (existingChat) {
      openChatbox(userId);
    } else {
      // Cria um novo chat com estrutura correta
      const chatData = {
        participants: [currentUser.uid, userId],
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [userId]: 0
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Verifica se os IDs são válidos
      if (!currentUser.uid || !userId) {
        throw new Error('IDs de usuário inválidos');
      }

      const chatRef = await db.collection('chats').add(chatData);
      openChatbox(userId);
    }
    
    // Mostra a seção de mensagens
    showSection('messages');
    
  } catch (error) {
    console.error('Erro ao iniciar chat:', error);
    showToast('Erro ao iniciar conversa. Por favor, tente novamente.', 'error');
  }
}

// Função auxiliar para encontrar chat existente (atualizada)
async function findExistingChat(currentUserId, partnerId) {
  try {
    const snapshot = await db.collection('chats')
      .where('participants', 'array-contains', currentUserId)
      .get();

    for (const doc of snapshot.docs) {
      const chatData = doc.data();
      
      // Verifica se a estrutura do chat está correta
      if (!chatData.participants || !Array.isArray(chatData.participants)) {
        console.warn('Chat com estrutura inválida:', doc.id);
        continue;
      }
      
      if (chatData.participants.includes(partnerId)) {
        return { 
          id: doc.id,
          ...chatData,
          // Garante que unreadCount existe
          unreadCount: chatData.unreadCount || {
            [currentUserId]: 0,
            [partnerId]: 0
          }
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar chat existente:', error);
    return null;
  }
}
// Adicione este CSS para estilizar os matches
const matchesCSS = `
  .lux-matches-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
    padding: 1rem 0;
  }
  
  .lux-match-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
  }
  
  .lux-match-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
  
  .lux-match-card-header {
    position: relative;
    height: 200px;
    overflow: hidden;
  }
  
  .lux-match-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  
  .lux-match-card:hover .lux-match-avatar {
    transform: scale(1.05);
  }
  
  .lux-match-vip-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--lux-primary);
    color: var(--lux-secondary);
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  }
  
  .lux-match-card-body {
    padding: 1.2rem;
    flex-grow: 1;
  }
  
  .lux-match-name {
    font-family: 'Playfair Display', serif;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    color: var(--lux-secondary);
  }
  
  .lux-match-info {
    color: var(--lux-gray);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
  
  .lux-match-date {
    color: var(--lux-primary);
    font-size: 0.8rem;
    font-style: italic;
  }
  
  .lux-match-card-actions {
    display: flex;
    justify-content: space-around;
    padding: 0.8rem;
    border-top: 1px solid var(--lux-light-gray);
  }
  
  .lux-no-results {
    text-align: center;
    padding: 2rem;
    color: var(--lux-gray);
  }
  
  .lux-no-results i {
    font-size: 2rem;
    color: var(--lux-primary);
    margin-bottom: 1rem;
    display: block;
  }
  
  .lux-no-results h3 {
    margin-bottom: 0.5rem;
  }
`;

// Adiciona o CSS ao documento
const styleElement = document.createElement('style');
styleElement.innerHTML = matchesCSS;
document.head.appendChild(styleElement);



/*****************
 * MENSAGENS MOCK *
 * 
 *****************/


async function loadMessages() {
  const chatsList = document.getElementById('chatsList');
  if (!chatsList) return;
  
  chatsList.innerHTML = '<div class="lux-loading">Carregando conversas...</div>';
  
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      window.location.href = 'index.html';
      return;
    }
    
    const snapshot = await db.collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .orderBy('lastMessageTime', 'desc')
      .get();
    
    chatsList.innerHTML = '';
    
    if (snapshot.empty) {
      chatsList.innerHTML = `
        <div class="lux-conversations-empty">
          <i class="fas fa-comment-slash"></i>
          <p>Nenhuma conversa encontrada</p>
          <button id="startFirstChat" class="lux-btn lux-btn-primary">
            Iniciar uma conversa
          </button>
        </div>
      `;
      return;
    }
    
    const chats = await Promise.all(snapshot.docs.map(async doc => {
      const chatData = doc.data();
      const partnerId = chatData.participants.find(id => id !== currentUser.uid);
      
      // Verificação adicional para garantir que partnerId existe
      if (!partnerId) return null;
      
      try {
        const partnerDoc = await db.collection('users').doc(partnerId).get();
        const partnerData = partnerDoc.data() || {};
        
        return {
          id: doc.id,
          partnerId: partnerId,
          name: partnerData.name || 'Usuário',
          photo: partnerData.profilePhotoURL || defaultAvatar,
          lastMessage: chatData.lastMessage || '',
          time: formatChatTime(chatData.lastMessageTime?.toDate()),
          unread: chatData.unreadCount?.[currentUser.uid] > 0
        };
      } catch (error) {
        console.error(`Erro ao carregar dados do usuário ${partnerId}:`, error);
        return {
          id: doc.id,
          partnerId: partnerId,
          name: 'Usuário',
          photo: defaultAvatar,
          lastMessage: chatData.lastMessage || '',
          time: formatChatTime(chatData.lastMessageTime?.toDate()),
          unread: chatData.unreadCount?.[currentUser.uid] > 0
        };
      }
    }));
    
    // Filtra quaisquer resultados nulos (caso partnerId não exista)
    const validChats = chats.filter(chat => chat !== null);
    
    if (validChats.length === 0) {
      chatsList.innerHTML = `
        <div class="lux-conversations-empty">
          <i class="fas fa-comment-slash"></i>
          <p>Nenhuma conversa válida encontrada</p>
        </div>
      `;
      return;
    }
    
    validChats.forEach(chat => {
      const chatElement = createChatElement(chat);
      chatsList.appendChild(chatElement);
      
      chatElement.addEventListener('click', () => {
        openChat(chat.id, chat.partnerId);
      });
    });
    
    document.getElementById('startFirstChat')?.addEventListener('click', () => {
      showToast('Selecione um usuário para iniciar conversa', 'info');
    });
    
  } catch (error) {
    console.error('Erro ao carregar conversas:', error);
    chatsList.innerHTML = `
      <div class="lux-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar conversas</p>
        <button class="lux-btn" onclick="loadMessages()">
          <i class="fas fa-sync-alt"></i> Tentar novamente
        </button>
      </div>
    `;
  }
}


function createChatElement(chat) {
  const chatElement = document.createElement('div');
  chatElement.className = `lux-conversation ${chat.unread ? 'lux-conversation-unread' : ''}`;
  
  chatElement.innerHTML = `
    <img src="${chat.photo}" 
         class="lux-conversation-avatar" 
         alt="${chat.name}"
         onerror="this.src='https://via.placeholder.com/50'">
    <div class="lux-conversation-info">
      <h4 class="lux-conversation-name">${chat.name}</h4>
      <p class="lux-conversation-preview">${chat.lastMessage}</p>
    </div>
    <div class="lux-conversation-meta">
      <span class="lux-conversation-time">${chat.time}</span>
      ${chat.unread ? '<span class="lux-conversation-badge"></span>' : ''}
    </div>
  `;
  
  return chatElement;
}


function renderMessage(message, currentUserId) {
  const isCurrentUser = message.senderId === currentUserId;
  const messageElement = document.createElement('div');
  messageElement.className = `lux-message ${isCurrentUser ? 'lux-message-sent' : 'lux-message-received'}`;
  
  // Cabeçalho da mensagem (nome e foto do remetente)
  if (!isCurrentUser) {
    messageElement.innerHTML += `
      <div class="lux-message-header">
        <img src="${message.senderPhoto || 'https://via.placeholder.com/30'}" 
             class="lux-message-avatar" 
             alt="${message.senderName}"
             onerror="this.src='https://via.placeholder.com/30'">
        <span class="lux-message-sender">${message.senderName}</span>
      </div>
    `;
  }

  // Corpo da mensagem
  const messageBody = document.createElement('div');
  messageBody.className = 'lux-message-body';

  // Conteúdo de texto (se existir)
  if (message.text) {
    messageBody.innerHTML += `<p class="lux-message-text">${message.text}</p>`;
  }

  // Imagens (se existirem)
  if (message.imageUrls && message.imageUrls.length > 0) {
    messageBody.innerHTML += `
      <div class="lux-message-images">
        ${message.imageUrls.map(url => `
          <img src="${url}" 
               class="lux-message-image" 
               alt="Imagem enviada"
               loading="lazy">
        `).join('')}
      </div>
    `;
  }

  // Arquivos (se existirem)
  if (message.files && message.files.length > 0) {
    messageBody.innerHTML += `
      <div class="lux-message-files">
        ${message.files.map(file => `
          <a href="${file.url}" 
             class="lux-message-file" 
             target="_blank" 
             download="${file.name}">
            <i class="fas fa-file-alt"></i>
            <span>${file.name}</span>
            <small>${formatFileSize(file.size)}</small>
          </a>
        `).join('')}
      </div>
    `;
  }

  messageElement.appendChild(messageBody);

  // Rodapé da mensagem (hora e status)
  const timeString = formatMessageTime(message.timestamp?.toDate());
  messageElement.innerHTML += `
    <div class="lux-message-footer">
      <span class="lux-message-time">${timeString}</span>
      ${isCurrentUser ? `
        <span class="lux-message-status">
          ${message.read ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>'}
        </span>
      ` : ''}
    </div>
  `;

  return messageElement;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
function formatChatTime(date) {
  if (!date) return '';
  
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Ontem';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}
async function loadChatMessages(chatId) {
  const messagesContainer = document.getElementById('messagesContainer');
  if (!messagesContainer) return;

  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    // Mostrar loading enquanto carrega
    messagesContainer.innerHTML = `
      <div class="lux-loading-messages">
        <div class="lux-loading-spinner">
          <div class="lux-spinner-circle"></div>
          <div class="lux-spinner-gold"></div>
        </div>
        <p>Carregando mensagens premium...</p>
      </div>
    `;

    // Carregar de ambas as fontes para garantir compatibilidade
    const [sharedMessages, userMessages] = await Promise.all([
      db.collection('chats').doc(chatId)
        .collection('messages')
        .where('visibleFor', 'array-contains', user.uid)
        .orderBy('timestamp', 'asc')
        .get(),
      
      db.collection('users').doc(user.uid)
        .collection('chats').doc(chatId)
        .collection('messages')
        .where('visibleFor', 'array-contains', user.uid)
        .orderBy('timestamp', 'asc')
        .get()
    ]);

    // Combine e ordene as mensagens
    const allMessages = [
      ...sharedMessages.docs.map(doc => ({...doc.data(), id: doc.id})),
      ...userMessages.docs.map(doc => ({...doc.data(), id: doc.id}))
    ].sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);

    messagesContainer.innerHTML = '';

    // Renderizar cada mensagem
    allMessages.forEach(message => {
      const messageElement = createMessageElement(message, user.uid);
      messageElement.id = `message-${message.id}`;
      
      // Adicionar botão de deletar para mensagens do usuário
      if (message.senderId === user.uid) {
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'lux-message-delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteMessage(chatId, message.id);
        };
        messageElement.appendChild(deleteBtn);
      }
      
      messagesContainer.appendChild(messageElement);
    });

    // Configurar eventos de clique nas imagens
    setupImageClickListeners();
    
    // Rolagem suave para a última mensagem
    setTimeout(() => {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);

  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    messagesContainer.innerHTML = `
      <div class="lux-error-messages">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar mensagens</p>
        <button class="lux-btn-retry" onclick="loadChatMessages('${chatId}')">
          Tentar novamente
        </button>
      </div>
    `;
    showToast('Erro ao carregar mensagens', 'error');
  }
  setupImageClickListeners();
}


document.addEventListener('DOMContentLoaded', function() {
  // Configurar o visualizador de imagens quando o DOM estiver pronto
  imageViewer = setupImageViewer();
});

function setupImageViewer() {
  const imageViewerElement = document.getElementById('image-viewer');
  const viewedImage = document.getElementById('viewed-image');
  const closeBtn = document.querySelector('.lux-image-viewer-close');
  const prevBtn = document.querySelector('.lux-image-viewer-prev');
  const nextBtn = document.querySelector('.lux-image-viewer-next');
  const downloadBtn = document.querySelector('.lux-image-viewer-download');
  const imageInfo = document.getElementById('image-viewer-info');

  let currentImages = [];
  let currentIndex = 0;

  function openViewer(images, index = 0) {
    if (!images || images.length === 0) return;
    
    currentImages = images;
    currentIndex = index;
    viewedImage.src = images[index].url;
    imageInfo.textContent = `Imagem ${index + 1} de ${images.length}`;
    imageViewerElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    imageViewerElement.style.display = 'none';
    document.body.style.overflow = '';
  }

  function showPrev() {
    if (currentImages.length > 1) {
      currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
      updateViewer();
    }
  }

  function showNext() {
    if (currentImages.length > 1) {
      currentIndex = (currentIndex + 1) % currentImages.length;
      updateViewer();
    }
  }

  function updateViewer() {
    viewedImage.src = currentImages[currentIndex].url;
    imageInfo.textContent = `Imagem ${currentIndex + 1} de ${currentImages.length}`;
    viewedImage.style.opacity = '0';
    setTimeout(() => {
      viewedImage.style.opacity = '1';
    }, 100);
  }

  function downloadImage() {
    const link = document.createElement('a');
    link.href = currentImages[currentIndex].url;
    link.download = `luxmeet-image-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Event listeners
  closeBtn.addEventListener('click', closeViewer);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  downloadBtn.addEventListener('click', downloadImage);

  imageViewerElement.addEventListener('click', function(e) {
    if (e.target === imageViewerElement) {
      closeViewer();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (imageViewerElement.style.display === 'flex') {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    }
  });

  viewedImage.style.transition = 'opacity 0.3s ease';

  return {
    openViewer: openViewer,
    closeViewer: closeViewer
  };
}

// Função para configurar os cliques nas imagens das mensagens
function setupImageClickListeners() {
  document.querySelectorAll('.lux-message-image').forEach(img => {
    img.addEventListener('click', function() {
      const allImages = Array.from(document.querySelectorAll('.lux-message-image'))
        .map(el => ({ url: el.src, element: el }));
      
      const clickedIndex = allImages.findIndex(item => item.element === this);
      
      if (imageViewer && imageViewer.openViewer) {
        imageViewer.openViewer(allImages, clickedIndex);
      }
    });
  });
}

async function deleteMessage(chatId, messageId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    // Atualizar em todas as localizações possíveis
    const batch = db.batch();
    
    // 1. Formato antigo (chats collection)
    const sharedMessageRef = db.collection('chats').doc(chatId)
      .collection('messages').doc(messageId);
    batch.update(sharedMessageRef, {
      deletedFor: firebase.firestore.FieldValue.arrayUnion(user.uid),
      visibleFor: firebase.firestore.FieldValue.arrayRemove(user.uid)
    });
    
    // 2. Formato novo (user chats collection)
    const userMessageRef = db.collection('users').doc(user.uid)
      .collection('chats').doc(chatId)
      .collection('messages').doc(messageId);
    batch.update(userMessageRef, {
      deletedFor: firebase.firestore.FieldValue.arrayUnion(user.uid),
      visibleFor: firebase.firestore.FieldValue.arrayRemove(user.uid)
    });
    
    await batch.commit();

    // Atualização visual
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.innerHTML = `
        <div class="lux-message-deleted">
          <i class="fas fa-trash"></i> Mensagem removida
        </div>
      `;
    }
  } catch (error) {
    console.error("[ERRO]", error);
    showToast('Erro ao remover mensagem: ' + error.message, 'error');
  }
}
async function deleteMessageForUser(chatId, messageId) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    // Atualizar a mensagem para remover o usuário do array visibleFor
    await db.collection('users').doc(user.uid)
      .collection('chats').doc(chatId)
      .collection('messages').doc(messageId)
      .update({
        visibleFor: firebase.firestore.FieldValue.arrayRemove(user.uid),
        deletedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Atualização visual imediata
    if (currentChat?.id === chatId) {
      const messageElement = document.getElementById(`message-${messageId}`);
      if (messageElement) {
        messageElement.innerHTML = '<div class="lux-message-deleted">Mensagem removida</div>';
      }
    }

    showToast('Mensagem removida');
  } catch (error) {
    console.error("[ERRO]", error);
    showToast('Erro ao remover mensagem: ' + error.message, 'error');
  }
}
// Função para criar elementos de mensagem (atualizada)
function createMessageElement(message, currentUserId) {
  const isCurrentUser = message.senderId === currentUserId;
  const messageElement = document.createElement('div');
  messageElement.className = `lux-message ${isCurrentUser ? 'lux-message-sent' : 'lux-message-received'}`;
  
  // Cabeçalho para mensagens recebidas
  if (!isCurrentUser) {
    messageElement.innerHTML += `
      <div class="lux-message-header">
        <img src="${message.senderPhoto || 'https://via.placeholder.com/30'}" 
             class="lux-message-avatar" 
             alt="${message.senderName}"
             onerror="this.src='https://via.placeholder.com/30'">
        <span class="lux-message-sender">${message.senderName}</span>
      </div>
    `;
  }

  // Corpo da mensagem
  const messageBody = document.createElement('div');
  messageBody.className = 'lux-message-body';

  // Texto da mensagem
  if (message.text) {
    messageBody.innerHTML += `<p class="lux-message-text">${message.text}</p>`;
  }

  // Imagens (se houver)
  if (message.imageUrls && message.imageUrls.length > 0) {
    messageBody.innerHTML += `
      <div class="lux-message-images">
        ${message.imageUrls.map(url => `
          <img src="${url}" 
               class="lux-message-image" 
               alt="Imagem enviada"
               loading="lazy">
        `).join('')}
      </div>
    `;
  }

  // Arquivos (se houver)
  if (message.files && message.files.length > 0) {
    messageBody.innerHTML += `
      <div class="lux-message-files">
        ${message.files.map(file => `
          <a href="${file.url}" 
             class="lux-message-file" 
             target="_blank" 
             download="${file.name}">
            <i class="fas fa-file-alt"></i>
            <span>${file.name}</span>
            <small>${formatFileSize(file.size)}</small>
          </a>
        `).join('')}
      </div>
    `;
  }

  messageElement.appendChild(messageBody);

  // Rodapé da mensagem
  const timeString = formatMessageTime(message.timestamp?.toDate());
  messageElement.innerHTML += `
    <div class="lux-message-footer">
      <span class="lux-message-time">${timeString}</span>
      ${isCurrentUser ? `
        <span class="lux-message-status">
          ${message.read ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>'}
        </span>
      ` : ''}
    </div>
  `;

  return messageElement;
}


// Função auxiliar para upload de arquivos
async function uploadFile(file, path) {
  try {
    const storageRef = firebase.storage().ref();
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const fileRef = storageRef.child(`${path}/${fileName}`);
    
    await fileRef.put(file);
    return await fileRef.getDownloadURL();
  } catch (error) {
    console.error('Erro no upload:', error);
    throw error;
  }
}

// Função auxiliar para obter ícone de arquivo
function getFileIcon(fileType) {
  if (!fileType) return 'fa-file';
  
  const icons = {
    'application/pdf': 'fa-file-pdf',
    'application/zip': 'fa-file-archive',
    'application/msword': 'fa-file-word',
    'application/vnd.ms-excel': 'fa-file-excel',
    'text/': 'fa-file-alt'
  };
  
  for (const [prefix, icon] of Object.entries(icons)) {
    if (fileType.startsWith(prefix)) return icon;
  }
  
  return 'fa-file';
}





function proposeDate(userId) {
  console.log('Propor encontro para:', userId);
  // Implemente a lógica de agendamento
}

function showAllowanceOptions(userId) {
  console.log('Mostrar opções de apoio para:', userId);
  // Implemente a lógica de apoio mensal
}


function openChatModal(chatData) {
  const modal = document.getElementById('chatModal');
  if (!modal) {
    console.error('Elemento chatModal não encontrado no DOM');
    return;
  }

  const modalContent = `
    <div class="lux-chat-modal">
      <div class="lux-chat-header">
        <img src="${chatData.profilePhotoURL || 'https://via.placeholder.com/150'}" 
             class="lux-chat-avatar"
             alt="${chatData.name || 'Usuário'}"
             onerror="this.src='https://via.placeholder.com/150'">
        <h3>${chatData.name || 'Usuário'}</h3>
        <span class="lux-chat-close">&times;</span>
      </div>
      <div class="lux-chat-body" id="chatMessages">
        <!-- Mensagens serão carregadas aqui -->
        <p class="placeholder">Inicie a conversa com ${chatData.name || 'usuário'}...</p>
      </div>
      <div class="lux-chat-footer">
        <input type="text" id="chatInput" placeholder="Digite sua mensagem...">
        <button onclick="sendMessage('${chatData.id}')">Enviar</button>
      </div>
    </div>
  `;

  modal.innerHTML = `<div class="lux-modal-content">${modalContent}</div>`;
  modal.style.display = 'flex';

  // Fecha o modal
  modal.querySelector('.lux-chat-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Foco no input
  setTimeout(() => {
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  }, 100);
}
// Adicione isso junto com as outras variáveis de modal no início
const profileModal = document.getElementById("profileModal");
const profileBtn = document.getElementById("profileBtn"); // Certifique-se que este botão existe

// Se o botão de perfil existir, adicione o event listener
if (profileBtn) {
  profileBtn.onclick = function() {
    profileModal.style.display = "block";
    // Aqui você pode adicionar código para carregar as informações do perfil
  };
}

// Fechar o modal quando clicar no X
const profileClose = profileModal.querySelector(".close");
if (profileClose) {
  profileClose.onclick = function() {
    profileModal.style.display = "none";
  };
}

async function startChatWithUser(otherUserId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    // Verificar se já existe um chat entre os usuários
    const existingChat = await findExistingChat(currentUser.uid, otherUserId);
    
    if (existingChat) {
      // Se o chat já existe, abra-o
      openChat(existingChat.id, otherUserId);
    } else {
      // Se não existe, crie um novo chat
      const chatRef = await db.collection('chats').add({
        participants: [currentUser.uid, otherUserId],
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [otherUserId]: 0
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      openChat(chatRef.id, otherUserId);
    }

    // Fecha o modal de perfil se estiver aberto
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
      profileModal.style.display = 'none';
    }

    // Mostra a seção de mensagens
    showSection('messages');
    
  } catch (error) {
    console.error('Erro ao iniciar chat:', error);
    showToast('Erro ao iniciar conversa', 'error');
  }
}


function setupMessageSender(chatId, partnerId) {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendMessageBtn');
  const emojiBtn = document.getElementById('emojiBtn');
  
  // Variável para controlar o estado de envio
  let isSending = false;

  // Configurar evento do botão de emoji
  if (emojiBtn) {
    emojiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('emojiPicker').classList.toggle('visible');
    });
  }

  const sendMessage = async () => {
    // Se já estiver enviando, não faz nada
    if (isSending) return;
    
    const text = messageInput.value.trim();
    const hasImages = pendingAttachments.images.length > 0;
    const hasFiles = pendingAttachments.files.length > 0;

    if (!text && !hasImages && !hasFiles) {
      showToast('Digite uma mensagem ou adicione um anexo', 'warning');
      return;
    }

    try {
      // Ativar estado de envio
      isSending = true;
      sendButton.disabled = true;
      sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      
      // Mostrar loading para imagens (se tiver)
      if (hasImages) {
        const uploadLoading = document.getElementById('image-upload-loading');
        const progressBar = document.getElementById('upload-progress-bar');
        uploadLoading.style.display = 'flex';
        progressBar.style.width = '0%';
      }

      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        showToast('Você precisa estar logado para enviar mensagens', 'error');
        return;
      }

      // Array para armazenar todas as promessas de upload
      const uploadPromises = [];

      // Processar imagens
      if (hasImages) {
        pendingAttachments.images.forEach(img => {
          const uploadTask = uploadFileWithProgress(
            img.file, 
            `chats/${chatId}/images`,
            (progress) => {
              const percent = (progress.bytesTransferred / progress.totalBytes) * 100;
              document.getElementById('upload-progress-bar').style.width = `${percent}%`;
            }
          );
          
          uploadPromises.push(
            uploadTask.then(url => ({ type: 'image', url }))
            .catch(error => {
              console.error('Erro no upload de imagem:', error);
              throw error;
            })
          );
        });
      }

      // Processar arquivos
      if (hasFiles) {
        pendingAttachments.files.forEach(file => {
          uploadPromises.push(
            uploadFile(file.file, `chats/${chatId}/files`)
              .then(url => ({
                type: 'file',
                url,
                name: file.file.name,
                fileType: file.file.type,
                size: file.file.size
              }))
              .catch(error => {
                console.error('Erro no upload de arquivo:', error);
                throw error;
              })
          );
        });
      }

      // Aguardar todos os uploads terminarem
      const uploadedAttachments = await Promise.all(uploadPromises);

      // Preparar dados da mensagem
      const messageData = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Usuário',
        senderPhoto: currentUser.photoURL || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
        receiverId: partnerId,
        originalSender: currentUser.uid,
        visibleFor: [currentUser.uid, partnerId],
        deletedFor: []
      };

      // Adicionar texto se existir
      if (text) messageData.text = text;

      // Adicionar imagens se existirem
      const imageUrls = uploadedAttachments
        .filter(a => a.type === 'image')
        .map(a => a.url);

      if (imageUrls.length > 0) {
        messageData.imageUrls = imageUrls;
        messageData.messageType = 'image';
      }

      // Adicionar arquivos se existirem
      const files = uploadedAttachments
        .filter(a => a.type === 'file')
        .map(a => ({
          url: a.url,
          name: a.name,
          type: a.fileType,
          size: a.size
        }));

      if (files.length > 0) {
        messageData.files = files;
        messageData.messageType = 'file';
      }

      // Enviar a mensagem para AMBAS as cópias
      const batch = db.batch();
      
      // Cópia no remetente
      const senderMessageRef = db.collection('users').doc(currentUser.uid)
        .collection('chats').doc(chatId)
        .collection('messages').doc();
      batch.set(senderMessageRef, messageData);
      
      // Cópia no destinatário
      const receiverMessageRef = db.collection('users').doc(partnerId)
        .collection('chats').doc(chatId)
        .collection('messages').doc(senderMessageRef.id);
      batch.set(receiverMessageRef, messageData);
      
      await batch.commit();

      // Atualizar último mensagem no chat
      const lastMessage = hasImages
        ? '📷 Imagem'
        : hasFiles
        ? `📎 ${files[0].name}`
        : text.substring(0, 20) + (text.length > 20 ? '...' : '');

      await db.collection('chats').doc(chatId).update({
        lastMessage,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        [`unreadCount.${partnerId}`]: firebase.firestore.FieldValue.increment(1)
      });

      // Limpar campos
      messageInput.value = '';
      pendingAttachments.images = [];
      pendingAttachments.files = [];
      updateAttachmentsPreview();

      // Recarregar mensagens
      await loadChatMessages(chatId);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showToast('Erro ao enviar mensagem', 'error');
    } finally {
      // Resetar estado de envio
      isSending = false;
      sendButton.disabled = false;
      sendButton.innerHTML = 'Enviar';
      
      // Esconder loading de upload
      document.getElementById('image-upload-loading').style.display = 'none';
    }
  };

  // Função para upload com progresso
  const uploadFileWithProgress = (file, path, onProgress) => {
    return new Promise((resolve, reject) => {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`${path}/${file.name}`);
      const uploadTask = fileRef.put(file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Chamar callback de progresso
          if (onProgress) onProgress(snapshot);
        },
        (error) => {
          reject(error);
        },
        () => {
          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  // Configurar event listeners
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Configurar auto-ajuste da altura do textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
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
}

document.getElementById('newsPostBtn').addEventListener('click', async () => {
  const title = document.getElementById('newsTitle').value.trim();
  const text = document.getElementById('newsText').value.trim();
  const imageFile = document.getElementById('newsImage').files[0];
  
  // Desabilitar botão durante o processamento
  const postBtn = document.getElementById('newsPostBtn');
  postBtn.disabled = true;
  postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
  
  try {
    await postNews({ title, text, imageFile });
  } catch (error) {
    console.error(error);
  } finally {
    // Reabilitar botão após conclusão
    postBtn.disabled = false;
    postBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar';
  }
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

/*************************
 * MODAL DE CURTIDAS *
 *************************/
// Função atualizada para mostrar o modal de curtidas
// Função atualizada para mostrar o modal de curtidas
async function showLikesModal() {
  const likesModal = document.getElementById('likesModal');
  if (!likesModal) return;

  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      showToast('Você precisa estar logado para ver as curtidas', 'error');
      return;
    }

    // Mostrar loading
    likesModal.innerHTML = `
      <div class="lux-modal-content">
        <div class="loading">Carregando curtidas...</div>
      </div>
    `;
    likesModal.style.display = 'flex';

    // Buscar dados do usuário para obter a lista de curtidas
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      likesModal.innerHTML = `
        <div class="lux-modal-content">
          <div class="no-likes">Perfil não encontrado</div>
        </div>
      `;
      return;
    }

    const userData = userDoc.data();
    const likes = userData.likes || [];

    if (likes.length === 0) {
      likesModal.innerHTML = `
        <div class="lux-modal-content">
          <div class="lux-modal-header">
            <h3>Curtidas</h3>
            <span class="lux-modal-close">&times;</span>
          </div>
          <div class="lux-likes-list">
            <p class="no-likes-message">Ninguém curtiu seu perfil ainda</p>
          </div>
        </div>
      `;
      return;
    }

    // Buscar informações dos usuários que curtiram
    const likesPromises = likes.map(userId => 
      db.collection('users').doc(userId).get()
        .then(doc => ({
          id: userId,
          name: doc.data()?.name || 'Usuário',
          profilePhotoURL: doc.data()?.profilePhotoURL || 'https://via.placeholder.com/50'
        }))
        .catch(() => ({
          id: userId,
          name: 'Usuário não encontrado',
          profilePhotoURL: 'https://via.placeholder.com/50'
        }))
    );

    const usersWhoLiked = await Promise.all(likesPromises);

    // Construir o modal
    likesModal.innerHTML = `
      <div class="lux-modal-content">
        <div class="lux-modal-header">
          <h3>${likes.length} ${likes.length === 1 ? 'pessoa curtiu' : 'pessoas curtiram'}</h3>
          <span class="lux-modal-close">&times;</span>
        </div>
        <div class="lux-likes-list"></div>
      </div>
    `;

    const likesList = likesModal.querySelector('.lux-likes-list');
    
    // Adicionar cada usuário à lista
    usersWhoLiked.forEach(user => {
      const likeItem = document.createElement('div');
      likeItem.className = 'lux-like-item';
      likeItem.innerHTML = `
        <img src="${user.profilePhotoURL}" 
             alt="${user.name}" 
             class="lux-like-avatar"
             onerror="this.src='https://via.placeholder.com/50'">
        <span class="lux-like-name" data-userid="${user.id}">${user.name}</span>
      `;

      // Configurar evento de clique diretamente no elemento de nome
      const nameElement = likeItem.querySelector('.lux-like-name');
      nameElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        viewProfile(user.id);
      });

      likesList.appendChild(likeItem);
    });

    // Fechar modal ao clicar no X
    likesModal.querySelector('.lux-modal-close').addEventListener('click', (e) => {
      e.stopPropagation();
      likesModal.style.display = 'none';
    });

    // Fechar modal ao clicar fora (com tratamento especial)
    likesModal.addEventListener('click', (e) => {
      if (e.target === likesModal) {
        likesModal.style.display = 'none';
      }
    });

  } catch (error) {
    console.error('Erro ao carregar curtidas:', error);
    likesModal.innerHTML = `
      <div class="lux-modal-content">
        <div class="error">Erro ao carregar curtidas</div>
      </div>
    `;
  }
}

// Função viewProfile (garanta que está no escopo global)
window.viewProfile = async function(userId) {
  console.log('Tentando visualizar perfil do usuário:', userId);
  
  try {
    // Fecha todos os modais abertos
    document.querySelectorAll('.lux-modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      console.log('Perfil encontrado, abrindo modal...');
      openProfileModal(userDoc.data());
    } else {
      console.log('Perfil não encontrado');
      showToast('Perfil não encontrado', 'error');
    }
  } catch (error) {
    console.error("Erro detalhado ao visualizar perfil:", error);
    showToast('Erro ao carregar perfil', 'error');
  }
};

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
  const likesModal = document.getElementById('likesModal');
  if (e.target === likesModal) {
    likesModal.style.display = 'none';
  }
});

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

document.querySelector('.lux-modal-close').addEventListener('click', function() {
  document.getElementById('likesModal').style.display = 'none';
});

// Fechar modal ao clicar fora do conteúdo
document.getElementById('likesModal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.style.display = 'none';
  }
});





// Pré-visualização da imagem
document.getElementById('newsImage').addEventListener('change', function(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('previewImage');
  const previewContainer = document.querySelector('.image-preview');
  
  if (file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      preview.src = e.target.result;
      previewContainer.style.display = 'block';
    }
    
    reader.readAsDataURL(file);
  } else {
    previewContainer.style.display = 'none';
  }
});

// Remover imagem
document.querySelector('.remove-image').addEventListener('click', function() {
  document.getElementById('newsImage').value = '';
  document.querySelector('.image-preview').style.display = 'none';
});



// Quando a seção de mensagens for aberta
function showMessagesSection() {
  document.getElementById('messagesSection').style.display = 'block';
  initMessages();
}



async function openChat(chatId, otherUserId) {
  try {
    // Busca dados do outro usuário primeiro
    const userDoc = await db.collection('users').doc(otherUserId).get();
    if (!userDoc.exists) {
      console.error('Usuário não encontrado');
      return;
    }

    const userData = userDoc.data();

    // Atualiza o currentChat corretamente usando otherUserId
    currentChat = {
      id: chatId,
      partnerId: otherUserId, // Corrigido - usa o parâmetro otherUserId
      partnerData: userData
    };
    
    // Restante do seu código...
    document.getElementById('chatPartnerAvatar').src = userData.profilePhotoURL || 'https://via.placeholder.com/150';
    document.getElementById('chatPartnerName').textContent = userData.name || 'Usuário';
    document.getElementById('chatPartnerStatus').textContent = 'Online';

    const activeChat = document.getElementById('activeChat');
    activeChat.style.display = 'flex';

    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '<div class="lux-messages-date"><span>HOJE</span></div>';

    await loadChatMessages(chatId);
    setupMessageSender(chatId, otherUserId);

  } catch (error) {
    console.error('Erro ao abrir chat:', error);
    showToast('Erro ao abrir o chat', 'error');
  }
}
// Função para abrir o chatbox com um usuário
async function openChatbox(partnerId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    // Carrega os dados do parceiro de chat
    const partnerDoc = await db.collection('users').doc(partnerId).get();
    const partnerData = partnerDoc.data();
    
    // Verifica se já existe um chat entre os usuários
    const existingChat = await findExistingChat(currentUser.uid, partnerId);
    
    // Atualiza o chat atual
    currentChat = {
      id: existingChat ? existingChat.id : null,
      partnerId: partnerId,
      partnerData: partnerData
    };
    
    // Atualiza a UI do chatbox
    updateChatboxUI(partnerData);
    
    // Se já existe um chat, carrega as mensagens
    if (existingChat) {
      await loadChatboxMessages(existingChat.id);
    } else {
      // Mostra estado vazio para novo chat
      document.getElementById('chatboxMessages').innerHTML = `
        <div class="lux-chatbox-empty">
          <p>Inicie uma nova conversa com ${partnerData.name || 'este usuário'}</p>
        </div>
      `;
    }
    
    // Mostra o chatbox
    document.getElementById('chatboxModal').style.display = 'flex';
    
    // Configura o envio de mensagens
    setupChatboxMessageSender();
    
  } catch (error) {
    console.error('Erro ao abrir chatbox:', error);
    showToast('Erro ao abrir conversa', 'error');
  }

   
  // Limpa anexos pendentes ao abrir novo chat
  pendingAttachments.images = [];
  pendingAttachments.files = [];
  updateAttachmentsPreview();
  
  // Configura listeners para os inputs de arquivo
  setupFileInputs();


}



function setupFileInputs() {
  // Listener para imagens
  document.getElementById('chatImageInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          addAttachment(file, 'image');
        }
      });
    }
  });

  // Listener para arquivos
  document.getElementById('chatFileInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        if (!file.type.startsWith('image/')) {
          addAttachment(file, 'file');
        }
      });
    }
  });
}
function addAttachment(file, type) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (file.size > maxSize) {
    showToast('Arquivo muito grande. Tamanho máximo: 5MB', 'error');
    return;
  }

  const reader = new FileReader();
  
  reader.onload = function(e) {
    const attachment = {
      file: file,
      preview: type === 'image' ? e.target.result : null,
      name: file.name,
      type: file.type,
      size: file.size
    };

    if (type === 'image') {
      pendingAttachments.images.push(attachment);
    } else {
      pendingAttachments.files.push(attachment);
    }

    updateAttachmentsPreview();
  };

  if (type === 'image') {
    reader.readAsDataURL(file);
  } else {
    // Para arquivos não-imagem, só precisamos das informações básicas
    pendingAttachments.files.push({
      file: file,
      name: file.name,
      type: file.type,
      size: file.size
    });
    updateAttachmentsPreview();
  }
}

function updateAttachmentsPreview() {
  const previewContainer = document.getElementById('attachmentsPreview');
  previewContainer.innerHTML = '';

  // Adiciona imagens primeiro
  pendingAttachments.images.forEach((img, index) => {
    const previewElement = document.createElement('div');
    previewElement.className = 'lux-attachment-preview';
    previewElement.innerHTML = `
      <img src="${img.preview}" class="lux-attachment-image">
      <button class="lux-remove-attachment" data-index="${index}" data-type="image">
        <i class="fas fa-times"></i>
      </button>
    `;
    previewContainer.appendChild(previewElement);
  });

  // Adiciona arquivos
  pendingAttachments.files.forEach((file, index) => {
    const previewElement = document.createElement('div');
    previewElement.className = 'lux-attachment-preview';
    previewElement.innerHTML = `
      <div class="lux-file-preview">
        <i class="fas ${getFileIcon(file.type)}"></i>
        <span class="lux-file-name">${file.name}</span>
        <span class="lux-file-size">(${formatFileSize(file.size)})</span>
        <button class="lux-remove-attachment" data-index="${index}" data-type="file">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    previewContainer.appendChild(previewElement);
  });

  // Mostra ou esconde o container conforme necessário
  previewContainer.style.display = 
    (pendingAttachments.images.length > 0 || pendingAttachments.files.length > 0) 
      ? 'block' 
      : 'none';
}

function removeAttachment(index, type) {
  if (type === 'image') {
    pendingAttachments.images.splice(index, 1);
  } else {
    pendingAttachments.files.splice(index, 1);
  }
  updateAttachmentsPreview();
}



// Atualiza a UI do chatbox com os dados do usuário
function updateChatboxUI(partnerData) {
  document.getElementById('chatboxUserName').textContent = partnerData.name || 'Usuário';
  document.getElementById('chatboxAvatar').src = partnerData.profilePhotoURL || 'https://via.placeholder.com/150';
  document.getElementById('chatboxAvatar').onerror = function() {
    this.src = 'https://via.placeholder.com/150';
  };
}

// Carrega as mensagens no chatbox
async function loadChatboxMessages(chatId) {
  const messagesContainer = document.getElementById('chatboxMessages');
  messagesContainer.innerHTML = '<div class="lux-loading">Carregando mensagens...</div>';

  try {
    // Primeiro carrega as mensagens existentes
    const snapshot = await db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    messagesContainer.innerHTML = '';

    if (snapshot.empty) {
      messagesContainer.innerHTML = `
        <div class="lux-chatbox-empty">
          <p>Nenhuma mensagem ainda</p>
        </div>
      `;
      return;
    }

    // Processa cada mensagem
    snapshot.forEach(doc => {
      const message = doc.data();
      const messageElement = createChatboxMessageElement(message);
      messageElement.dataset.messageId = doc.id;
      messagesContainer.appendChild(messageElement);
    });

    // Configura listener para novas mensagens
    messageListener = db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot((querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const message = change.doc.data();
            const messageElement = createChatboxMessageElement(message);
            messageElement.dataset.messageId = change.doc.id;
            messagesContainer.appendChild(messageElement);
          }
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    messagesContainer.innerHTML = '<div class="lux-error">Erro ao carregar mensagens</div>';
  }
}


function createChatboxMessageElement(message) {
  const currentUser = firebase.auth().currentUser;
  const isCurrentUser = message.senderId === currentUser.uid;
  
  const messageElement = document.createElement('div');
  messageElement.className = `lux-chatbox-message ${isCurrentUser ? 'sent' : 'received'}`;
  
  let contentHTML = '';
  
  // Adicionar imagens (se existirem)
  if (message.imageUrls && message.imageUrls.length > 0) {
    contentHTML += '<div class="lux-chatbox-media-container">';
    message.imageUrls.forEach(url => {
      contentHTML += `
        <img src="${url}" class="lux-chatbox-media" 
             onclick="openMediaViewer('${url}')"
             onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">
      `;
    });
    contentHTML += '</div>';
  }
  
  // Adicionar arquivos (se existirem)
  if (message.files && message.files.length > 0) {
    message.files.forEach(file => {
      contentHTML += `
        <div class="lux-chatbox-file-message" onclick="downloadFile('${file.url}', '${file.name}')">
          <div class="lux-chatbox-file-icon">${getFileIcon(file.type)}</div>
          <div class="lux-chatbox-file-info">
            <div class="lux-chatbox-file-name">${file.name}</div>
            <div class="lux-chatbox-file-size">${formatFileSize(file.size)}</div>
          </div>
          <div class="lux-chatbox-download-btn">
            <i class="fas fa-download"></i>
          </div>
        </div>
      `;
    });
  }
  
  // Adicionar texto (se existir)
  if (message.text) {
    contentHTML += `<div class="lux-chatbox-message-text">${message.text}</div>`;
  }
  
  // Adicionar informações da mensagem
  contentHTML += `
    <div class="lux-chatbox-message-time">
      ${formatChatboxTime(message.timestamp?.toDate())}
      ${isCurrentUser && message.read ? '<i class="fas fa-check-double read-icon"></i>' : ''}
    </div>
  `;
  
  messageElement.innerHTML = contentHTML;
  return messageElement;
}
// Formata o tempo para o chatbox
function formatChatboxTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}


const sendMessage = async () => {
  const text = messageInput.value.trim();
  const hasImages = pendingAttachments.images.length > 0;
  const hasFiles = pendingAttachments.files.length > 0;

  if (!text && !hasImages && !hasFiles) {
    showToast('Digite uma mensagem ou adicione um anexo', 'warning');
    return;
  }

  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    const uploadPromises = [];

    // Processar imagens
    if (hasImages) {
      pendingAttachments.images.forEach(img => {
        uploadPromises.push(
          uploadFile(img.file, `chats/${chatId}/images`)
            .then(url => ({ type: 'image', url }))
        );
      });
    }

    // Processar arquivos
    if (hasFiles) {
      pendingAttachments.files.forEach(file => {
        uploadPromises.push(
          uploadFile(file.file, `chats/${chatId}/files`)
            .then(url => ({
              type: 'file',
              url,
              name: file.file.name,
              fileType: file.file.type,
              size: file.file.size
            }))
        );
      });
    }

    // Aguardar todos os uploads
    const uploadedAttachments = await Promise.all(uploadPromises);

    // Criar objeto da mensagem
    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Usuário',
      senderPhoto: currentUser.photoURL || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    };

    if (text) messageData.text = text;

    // Adicionar imagens
    const imageUrls = uploadedAttachments
      .filter(a => a.type === 'image')
      .map(a => a.url);

    if (imageUrls.length > 0) {
      messageData.imageUrls = imageUrls;
      messageData.messageType = 'image';
    }

    // Adicionar arquivos
    const files = uploadedAttachments
      .filter(a => a.type === 'file')
      .map(a => ({
        url: a.url,
        name: a.name,
        type: a.fileType,
        size: a.size
      }));

    if (files.length > 0) {
      messageData.files = files;
      messageData.messageType = files.length > 0 ? 'file' : messageData.messageType;
    }

    // Enviar mensagem
    await db.collection('chats').doc(chatId).collection('messages').add(messageData);

    // Atualizar último mensagem no chat
    const lastMessage = hasImages
      ? '📷 Imagem'
      : hasFiles
      ? `📎 ${files[0].name}`
      : text.substring(0, 20) + (text.length > 20 ? '...' : '');

    await db.collection('chats').doc(chatId).update({
      lastMessage,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      [`unreadCount.${partnerId}`]: firebase.firestore.FieldValue.increment(1)
    });

    // Limpar campos
    messageInput.value = '';
    pendingAttachments.images = [];
    pendingAttachments.files = [];
    updateAttachmentsPreview();

    // Recarregar mensagens
    await loadChatMessages(chatId);

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    showToast('Erro ao enviar mensagem: ' + error.message, 'error');
  }
};


// Fechar o chatbox
function closeChatbox() {
  document.getElementById('chatboxModal').style.display = 'none';
  currentChat = {
    id: null,
    partnerId: null,
    partnerData: null
  };
}

// Configura os listeners do chatbox quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  // Fechar chatbox ao clicar no botão de fechar
  document.querySelector('.lux-chatbox-close').addEventListener('click', closeChatbox);
  
  // Fechar chatbox ao clicar fora (no overlay)
  document.getElementById('chatboxModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeChatbox();
    }
  });
});






// Variáveis globais
let currentChat = {
  id: null,
  partnerId: null,
  partnerData: null
};


let currentUploads = {
  image: null,
  file: null
};

let messageListener = null;
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="%23cccccc"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  setupChatboxButtons();
  setupMediaViewer();
    setupFileInputs();
// Configurar remoção de anexos
  // Listener para remover anexos
  document.getElementById('attachmentsPreview').addEventListener('click', function(e) {
    const removeBtn = e.target.closest('.lux-remove-attachment');
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.index);
      const type = removeBtn.dataset.type;
      removeAttachment(index, type);
    }
  });
  
});

// Configuração dos botões
function setupChatboxButtons() {
  document.getElementById('chatboxImageButton').addEventListener('click', function() {
    document.getElementById('chatboxImageInput').click();
  });
  
  document.getElementById('chatboxAttachButton').addEventListener('click', function() {
    document.getElementById('chatboxFileInput').click();
  });
  
 // Variável para armazenar os arquivos selecionados
let pendingAttachments = {
  images: [],
  files: []
};



  
  document.getElementById('chatboxSendButton').addEventListener('click', sendChatboxMessage);
  
  document.getElementById('chatboxMessageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatboxMessage();
    }
  });
  
  document.getElementById('chatboxMessageInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  document.querySelector('.lux-chatbox-close').addEventListener('click', closeChatbox);
}

// Configuração do visualizador de mídia
function setupMediaViewer() {
  const modal = document.getElementById('mediaViewerModal');
  if (!modal) return;
  
  modal.querySelector('.lux-media-viewer-close').addEventListener('click', function() {
    modal.style.display = 'none';
  });
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Função principal para abrir o chatbox
async function openChatbox(partnerId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    const partnerDoc = await db.collection('users').doc(partnerId).get();
    const partnerData = partnerDoc.data();
    
    const existingChat = await findExistingChat(currentUser.uid, partnerId);
    
    currentChat = {
      id: existingChat ? existingChat.id : null,
      partnerId: partnerId,
      partnerData: partnerData
    };
    
    updateChatboxUI(partnerData);
    
    if (existingChat) {
      await loadChatboxMessages(existingChat.id);
    } else {
      document.getElementById('chatboxMessages').innerHTML = `
        <div class="lux-chatbox-empty">
          <p>Inicie uma nova conversa com ${partnerData.name || 'este usuário'}</p>
        </div>
      `;
    }
    
    document.getElementById('chatboxModal').style.display = 'flex';
    
  } catch (error) {
    console.error('Erro ao abrir chatbox:', error);
    showToast('Erro ao abrir conversa', 'error');
  }
}

// Atualiza a interface do chatbox
function updateChatboxUI(partnerData) {
  document.getElementById('chatboxUserName').textContent = partnerData.name || 'Usuário';
  document.getElementById('chatboxAvatar').src = partnerData.profilePhotoURL || DEFAULT_AVATAR;
  document.getElementById('chatboxAvatar').onerror = function() {
    this.src = DEFAULT_AVATAR;
  };
}

// Carrega as mensagens no chatbox
async function loadChatboxMessages(chatId) {
  const messagesContainer = document.getElementById('chatboxMessages');
  
  if (messageListener) {
    messageListener();
    messageListener = null;
  }

  messagesContainer.innerHTML = '<div class="lux-loading">Carregando mensagens...</div>';
  
  try {
    const snapshot = await db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    
    messagesContainer.innerHTML = '';
    
    if (snapshot.empty) {
      messagesContainer.innerHTML = `
        <div class="lux-chatbox-empty">
          <p>Nenhuma mensagem ainda</p>
        </div>
      `;
    } else {
      snapshot.forEach(doc => {
        const message = doc.data();
        const messageElement = createChatboxMessageElement(message);
        messageElement.dataset.messageId = doc.id;
        messagesContainer.appendChild(messageElement);
      });
    }
    
    messageListener = db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot((querySnapshot) => {
        const currentMessages = Array.from(messagesContainer.children)
          .map(el => el.dataset.messageId)
          .filter(id => id);
        
        querySnapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !currentMessages.includes(change.doc.id)) {
            const message = change.doc.data();
            const messageElement = createChatboxMessageElement(message);
            messageElement.dataset.messageId = change.doc.id;
            messagesContainer.appendChild(messageElement);
          }
        });
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    messagesContainer.innerHTML = '<div class="lux-error">Erro ao carregar mensagens</div>';
  }
}


function showImagePreview(imageData) {
  // Remove qualquer pré-visualização existente primeiro
  removeImagePreview();
  
  const previewContainer = document.createElement('div');
  previewContainer.className = 'lux-chatbox-preview-container';
  previewContainer.innerHTML = `
    <div class="lux-preview-wrapper">
      <img src="${imageData}" class="lux-chatbox-preview-image">
      <button class="lux-chatbox-preview-remove" onclick="removeImagePreview()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  const messagesContainer = document.getElementById('chatboxMessages');
  if (messagesContainer) {
    messagesContainer.appendChild(previewContainer);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}
function showFilePreview(file) {
  removeImagePreview(); // Remove qualquer pré-visualização existente
  
  const previewContainer = document.createElement('div');
  previewContainer.className = 'lux-chatbox-preview-container';
  previewContainer.innerHTML = `
    <div class="lux-file-preview">
      <div class="lux-file-icon">${getFileIcon(file.type)}</div>
      <div class="lux-file-info">
        <div class="lux-file-name">${file.name}</div>
        <div class="lux-file-size">${formatFileSize(file.size)}</div>
      </div>
      <button class="lux-chatbox-preview-remove" onclick="removeFilePreview()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  const inputContainer = document.querySelector('.lux-chatbox-input-container');
  if (inputContainer) {
    inputContainer.parentNode.insertBefore(previewContainer, inputContainer);
  }
}

function removeFilePreview() {
  currentUploads.file = null;
  document.querySelector('.lux-chatbox-preview-container')?.remove();
}

function removeImagePreview() {
  document.querySelector('.lux-chatbox-preview-container')?.remove();
  currentUploads.image = null;
}

function closeChatbox() {
  if (messageListener) {
    messageListener();
    messageListener = null;
  }
  
  document.getElementById('chatboxModal').style.display = 'none';
  currentChat = {
    id: null,
    partnerId: null,
    partnerData: null
  };
  
  currentUploads = {
    image: null,
    file: null
  };
  
  removeImagePreview();
}

// Função para visualizar imagem em tela cheia
function openMediaViewer(imageUrl) {
  const modal = document.createElement('div');
  modal.className = 'lux-media-viewer';
  modal.innerHTML = `
    <div class="lux-media-viewer-content">
      <span class="lux-media-viewer-close">&times;</span>
      <img src="${imageUrl}" class="lux-media-viewer-image">
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fechar ao clicar no X ou fora
  modal.querySelector('.lux-media-viewer-close').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Função para baixar arquivo
function downloadFile(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'arquivo';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Função para formatar hora da mensagem
function formatMessageTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Helper para formatar tamanho de arquivo
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
}


function openMediaViewer(imageUrl) {
  const modal = document.getElementById('mediaViewerModal');
  const img = document.getElementById('mediaViewerImage');
  if (!modal || !img) return;
  
  img.src = imageUrl;
  modal.style.display = 'flex';
}
function formatChatboxTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `lux-toast lux-toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}






// Função para exibir mensagens no chat (incluindo anexos)
function displayMessage(message) {
  const messagesContainer = document.getElementById('messagesContainer');
  const messageElement = document.createElement('div');
  messageElement.className = `lux-message ${message.senderId === firebase.auth().currentUser.uid ? 'sent' : 'received'}`;

  let contentHTML = '';

  // Adiciona imagens à mensagem
  if (message.images && message.images.length > 0) {
    contentHTML += '<div class="lux-message-images">';
    message.images.forEach(imgUrl => {
      contentHTML += `
        <div class="lux-message-image" onclick="openMediaViewer('${imgUrl}')">
          <img src="${imgUrl}" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}'">
        </div>
      `;
    });
    contentHTML += '</div>';
  }

  // Adiciona arquivos à mensagem
  if (message.files && message.files.length > 0) {
    contentHTML += '<div class="lux-message-files">';
    message.files.forEach(file => {
      contentHTML += `
        <div class="lux-message-file" onclick="downloadFile('${file.url}', '${file.name}')">
          <div class="lux-file-icon">${getFileIcon(file.type)}</div>
          <div class="lux-file-info">
            <div class="lux-file-name">${file.name}</div>
            <div class="lux-file-size">${formatFileSize(file.size)}</div>
          </div>
          <div class="lux-download-icon">
            <i class="fas fa-download"></i>
          </div>
        </div>
      `;
    });
    contentHTML += '</div>';
  }

  // Adiciona texto se houver
  if (message.text) {
    contentHTML += `<div class="lux-message-text">${message.text}</div>`;
  }

  // Adiciona informações da mensagem
  contentHTML += `
    <div class="lux-message-time">
      ${formatMessageTime(message.timestamp?.toDate())}
      ${message.senderId === firebase.auth().currentUser.uid && message.read ? 
        '<i class="fas fa-check-double lux-read-icon"></i>' : ''}
    </div>
  `;

  messageElement.innerHTML = contentHTML;
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}





async function sendChatboxMessage() {
  const messageInput = document.getElementById('chatboxMessageInput');
  const text = messageInput.value.trim();
  const hasImages = pendingAttachments.images.length > 0;
  const hasFiles = pendingAttachments.files.length > 0;
  
  // Verifica se há conteúdo para enviar
  if (!text && !hasImages && !hasFiles) {
    showToast('Adicione uma mensagem ou anexo para enviar', 'warning');
    return;
  }

  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser || !currentChat.partnerId) {
      showToast('Você precisa estar logado para enviar mensagens', 'error');
      return;
    }

    // 1. Criar ou obter o chat existente
    let chatId = currentChat.id;
    if (!chatId) {
      const lastMessageText = hasImages ? '📷 Imagem' : 
                           (hasFiles ? `📎 ${pendingAttachments.files[0].file.name}` : 
                           text.substring(0, 20) + (text.length > 20 ? '...' : ''));
      
      const chatRef = await db.collection('chats').add({
        participants: [currentUser.uid, currentChat.partnerId],
        lastMessage: lastMessageText,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [currentChat.partnerId]: 0
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      chatId = chatRef.id;
      currentChat.id = chatId;
    }

    // 2. Fazer upload dos anexos (se houver)
    const uploadPromises = [];
    
    // Upload de imagens
if (hasImages) {
  pendingAttachments.images.forEach(img => {
    uploadPromises.push(
      uploadFile(img.file, `chats/${chatId}/images`)
        .then(url => ({ type: 'image', url }))
        .catch(error => {
          console.error('Erro no upload de imagem:', error);
          throw error;
        })
    ); // <- Aqui está o fechamento correto
  });
}

  // Upload de arquivos
if (hasFiles) {
  pendingAttachments.files.forEach(file => {
    uploadPromises.push(
      uploadFile(file.file, `chats/${chatId}/files`)
        .then(url => ({
          type: 'file',
          url,
          name: file.file.name,
          fileType: file.file.type,
          size: file.file.size
        }))
        .catch(error => {
          console.error('Erro no upload de arquivo:', error);
          throw error;
        })
    ); // <- Fechamento correto do push
  });
}


    // Aguarda todos os uploads terminarem
    const uploadedAttachments = await Promise.all(uploadPromises);
    
    // 3. Preparar os dados da mensagem
    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Usuário',
      senderPhoto: currentUser.photoURL || '',
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      read: false
    };

    // Adicionar texto se existir
    if (text) {
      messageData.text = text;
    }

    // Adicionar imagens se existirem
    const imageUrls = uploadedAttachments
      .filter(a => a.type === 'image')
      .map(a => a.url);
    
    if (imageUrls.length > 0) {
      messageData.imageUrls = imageUrls;
      messageData.messageType = 'image';
    }

    // Adicionar arquivos se existirem
    const files = uploadedAttachments
      .filter(a => a.type === 'file')
      .map(a => ({
        url: a.url,
        name: a.name,
        type: a.fileType,
        size: a.size
      }));
    
    if (files.length > 0) {
      messageData.files = files;
      messageData.messageType = files.length > 0 ? 'file' : messageData.messageType;
    }

    // 4. Enviar a mensagem
    await db.collection('chats').doc(chatId).collection('messages').add(messageData);
    
    // 5. Atualizar o chat
    const lastMessage = hasImages ? '📷 Imagem' : 
                      (hasFiles ? `📎 ${pendingAttachments.files[0].file.name}` : 
                      text.substring(0, 20) + (text.length > 20 ? '...' : ''));
    
    await db.collection('chats').doc(chatId).update({
      lastMessage: lastMessage,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      [`unreadCount.${currentChat.partnerId}`]: firebase.firestore.FieldValue.increment(1)
    });

    // 6. Limpar o formulário
    messageInput.value = '';
    pendingAttachments.images = [];
    pendingAttachments.files = [];
    updateAttachmentsPreview();
    
    // 7. Rolar para a última mensagem
    const messagesContainer = document.getElementById('chatboxMessages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showToast('Mensagem enviada com sucesso', 'success');

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    showToast('Erro ao enviar mensagem', 'error');
  }
}

// Configura os listeners quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  setupChatActionButtons();


});


function setupChatActionButtons() {
  // Botão de Informações
  document.getElementById('chatInfoBtn')?.addEventListener('click', showChatInfo);
  
  // Botão de Mais Opções
  document.getElementById('chatMoreOptionsBtn')?.addEventListener('click', showChatMoreOptions);
  
  // Botão de Voltar - versão para chat flutuante
  const backButton = document.querySelector('.lux-back-btn');
  if (backButton) {
    backButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeFloatingChat();
    });
  }
}

// Função específica para fechar o chat flutuante
function closeFloatingChat() {
  const floatingChat = document.getElementById('activeChat');
  if (floatingChat) {
    // Adiciona animação de fechamento
    floatingChat.style.animation = 'fadeOut 0.3s forwards';
    
    setTimeout(() => {
      floatingChat.style.display = 'none';
      floatingChat.style.animation = '';
      
      // Opcional: Limpar o chat quando fechar
      document.getElementById('messagesContainer').innerHTML = '';
      
      // Opcional: Resetar o input de mensagem
      document.getElementById('messageInput').value = '';
      
      // Remover qualquer preview de anexos
      document.getElementById('attachmentsPreview').innerHTML = '';
    }, 300);
  }
}

// Função para carregar participantes do chat
async function loadChatParticipants(partnerId, container) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    // Busca informações do usuário atual
    const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
    const currentUserData = currentUserDoc.data();
    
    // Busca informações do parceiro de chat
    const partnerDoc = await db.collection('users').doc(partnerId).get();
    const partnerData = partnerDoc.data();
    
    // Limpa o container
    container.innerHTML = '';
    
    // Adiciona o usuário atual
    container.appendChild(createParticipantElement({
      id: currentUser.uid,
      name: currentUserData.name || 'Você',
      photo: currentUserData.profilePhotoURL || '',
      isCurrentUser: true
    }));
    
    // Adiciona o parceiro de chat
    container.appendChild(createParticipantElement({
      id: partnerId,
      name: partnerData.name || 'Usuário',
      photo: partnerData.profilePhotoURL || '',
      isCurrentUser: false
    }));
    
  } catch (error) {
    console.error('Erro ao carregar participantes:', error);
    container.innerHTML = '<p>Erro ao carregar informações</p>';
  }
}

// Cria elemento de participante
function createParticipantElement(participant) {
  const element = document.createElement('div');
  element.className = 'lux-chat-participant';
  element.innerHTML = `
    <img src="${participant.photo || defaultAvatar}" 
         class="lux-participant-avatar"
         alt="${participant.name}"
         onerror="this.src='${defaultAvatar.replace(/'/g, "&#039;")}'">
    <span class="lux-participant-name">${participant.name}</span>
    ${participant.isCurrentUser ? '<span class="lux-participant-you">(Você)</span>' : ''}
  `;
  
  // Adiciona evento de clique para ver perfil (exceto para o usuário atual)
  if (!participant.isCurrentUser) {
    element.addEventListener('click', () => {
      viewProfile(participant.id);
    });
    element.style.cursor = 'pointer';
  }
  
  return element;
}

// Função para mostrar mídias compartilhadas
async function showSharedMedia(chatId) {
  const modal = document.createElement('div');
  modal.className = 'lux-modal';
  modal.innerHTML = `
    <div class="lux-modal-content">
      <span class="lux-modal-close">&times;</span>
      <h3>Mídias Compartilhadas</h3>
      <div class="lux-media-grid" id="sharedMediaGrid">
        <div class="lux-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Carregando mídias...</p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fecha o modal
  modal.querySelector('.lux-modal-close').addEventListener('click', () => {
    modal.remove();
  });
  
  // Fecha ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Carrega as mídias
  try {
    const snapshot = await db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .where('imageUrls', '!=', null)
      .orderBy('timestamp', 'desc')
      .get();
    
    const mediaGrid = modal.querySelector('#sharedMediaGrid');
    mediaGrid.innerHTML = '';
    
    if (snapshot.empty) {
      mediaGrid.innerHTML = '<p class="lux-no-media">Nenhuma mídia compartilhada ainda</p>';
      return;
    }
    
    snapshot.forEach(doc => {
      const message = doc.data();
      message.imageUrls.forEach(url => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'lux-media-item';
        mediaItem.innerHTML = `
          <img src="${url}" 
               class="lux-media-thumbnail"
               onclick="openMediaViewer('${url}')"
               onerror="this.style.display='none'">
        `;
        mediaGrid.appendChild(mediaItem);
      });
    });
    
  } catch (error) {
    console.error('Erro ao carregar mídias:', error);
    modal.querySelector('#sharedMediaGrid').innerHTML = 
      '<p class="lux-error">Erro ao carregar mídias</p>';
  }
}

async function showChatInfo(partnerId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    // Cria o modal
    const modal = document.createElement('div');
    modal.className = 'lux-modal';
    modal.innerHTML = `
      <div class="lux-modal-content">
        <span class="lux-modal-close">&times;</span>
        <h3>Informações do Chat</h3>
        <div id="chatInfoContent" class="lux-chat-info-content">
          <div class="lux-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Carregando informações...</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar modal
    modal.querySelector('.lux-modal-close').addEventListener('click', () => {
      modal.remove();
    });
    
    // Carrega as informações
    const [currentUserDoc, partnerDoc] = await Promise.all([
      db.collection('users').doc(currentUser.uid).get(),
      db.collection('users').doc(partnerId).get()
    ]);
    
    const content = `
      <div class="lux-chat-info-section">
        <h4>Participantes</h4>
        <div class="lux-chat-participants">
          <div class="lux-chat-participant">
            <img src="${currentUserDoc.data().profilePhotoURL || defaultAvatar}" 
                 class="lux-participant-avatar"
                 onerror="this.src='${defaultAvatar}'">
            <span>${currentUserDoc.data().name || 'Você'}</span>
          </div>
          <div class="lux-chat-participant">
            <img src="${partnerDoc.data().profilePhotoURL || defaultAvatar}" 
                 class="lux-participant-avatar"
                 onerror="this.src='${defaultAvatar}'">
            <span>${partnerDoc.data().name || 'Usuário'}</span>
          </div>
        </div>
      </div>
      <button id="viewSharedMediaBtn" class="lux-btn">
        <i class="fas fa-images"></i> Ver mídias compartilhadas
      </button>
    `;
    
    document.getElementById('chatInfoContent').innerHTML = content;
    
    // Configura o botão de mídias
    document.getElementById('viewSharedMediaBtn').addEventListener('click', () => {
      modal.remove();
      showSharedMedia(currentChat.id);
    });
    
  } catch (error) {
    console.error('Erro ao mostrar informações:', error);
    const content = document.getElementById('chatInfoContent');
    if (content) {
      content.innerHTML = '<p class="lux-error">Erro ao carregar informações</p>';
    }
  }
}



function showChatMoreOptions(partnerId) {
  // Fecha o menu se já estiver aberto
  const existingMenu = document.querySelector('.lux-options-menu');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  const optionsMenu = document.createElement('div');
  optionsMenu.className = 'lux-options-menu';
  optionsMenu.innerHTML = `
    <ul class="lux-options-list">
      <li class="lux-option-item" id="clearChatOption">
        <i class="fas fa-trash"></i> Limpar conversa
      </li>
      <li class="lux-option-item" id="deleteChatOption">
        <i class="fas fa-times-circle"></i> Apagar conversa
      </li>
      <li class="lux-option-item" id="blockUserOption">
        <i class="fas fa-ban"></i> Bloquear usuário
      </li>
      <li class="lux-option-item" id="reportUserOption">
        <i class="fas fa-flag"></i> Denunciar usuário
      </li>
    </ul>
  `;

  // Adiciona o menu ao body para evitar problemas de posicionamento
  document.body.appendChild(optionsMenu);

  // Posiciona o menu corretamente em relação ao botão
  const btn = document.getElementById('chatMoreOptionsBtn');
  if (btn) {
    const btnRect = btn.getBoundingClientRect();
    optionsMenu.style.position = 'absolute';
    optionsMenu.style.top = `${btnRect.bottom + window.scrollY}px`;
    optionsMenu.style.left = `${btnRect.left + window.scrollX}px`;
    optionsMenu.style.transform = 'translateX(-50%)';
  }

  // Fecha ao clicar fora
  const closeMenu = (e) => {
    if (!optionsMenu.contains(e.target) ){
      optionsMenu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 100);

  // Configura ações
  document.getElementById('clearChatOption')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja limpar esta conversa?')) {
      clearChat(currentChat.id);
    }
    optionsMenu.remove();
  });

  // Configura ações
// No seu showChatMoreOptions, atualize a chamada para clearChat:
document.getElementById('clearChatOption')?.addEventListener('click', () => {
  if (!currentChat?.id) {
    showToast('Nenhuma conversa selecionada', 'error');
    return;
  }

  if (confirm('Tem certeza que deseja limpar esta conversa?')) {
    clearChat(currentChat.id);
  }
  optionsMenu.remove();
});
  
  // No seu showChatMoreOptions, atualize o listener para:
document.getElementById('deleteChatOption')?.addEventListener('click', async () => {
  if (!currentChat?.id) {
    showToast('Nenhuma conversa selecionada', 'error');
    return;
  }

  try {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: "Isso removerá a conversa apenas para você!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, apagar!'
    });

    if (result.isConfirmed) {
      await clearChat(currentChat.id);
      // Atualiza a UI após apagar
      if (document.getElementById('messagesContainer')) {
        document.getElementById('messagesContainer').innerHTML = '';
      }
    }
  } catch (error) {
    console.error("Erro ao confirmar:", error);
  }
});
  
  document.getElementById('blockUserOption')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja bloquear este usuário?')) {
      blockUser(partnerId);
    }
    optionsMenu.remove();
  });
  
  document.getElementById('reportUserOption')?.addEventListener('click', () => {
    showReportDialog(partnerId);
    optionsMenu.remove();
  });
}

async function clearChat(chatId) {
  try {
    console.log("[DEBUG] Iniciando clearChat com ID:", chatId);
    
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    // Buscar mensagens visíveis para o usuário em AMBAS as localizações
    const [sharedMessages, userMessages] = await Promise.all([
      // Mensagens no formato antigo (chats collection)
      db.collection('chats').doc(chatId)
        .collection('messages')
        .where('visibleFor', 'array-contains', user.uid)
        .get(),
      
      // Mensagens no novo formato (user chats collection)
      db.collection('users').doc(user.uid)
        .collection('chats').doc(chatId)
        .collection('messages')
        .where('visibleFor', 'array-contains', user.uid)
        .get()
    ]);

    const totalMessages = sharedMessages.size + userMessages.size;
    console.log(`[DEBUG] Total de mensagens visíveis: ${totalMessages}`);
    
    if (totalMessages === 0) {
      return showToast('Nenhuma mensagem para limpar');
    }

    // Marcar todas como deletadas para este usuário
    const batch = db.batch();
    
    // Processar mensagens do formato antigo
    sharedMessages.forEach(doc => {
      batch.update(doc.ref, {
        deletedFor: firebase.firestore.FieldValue.arrayUnion(user.uid),
        visibleFor: firebase.firestore.FieldValue.arrayRemove(user.uid)
      });
    });
    
    // Processar mensagens do formato novo
    userMessages.forEach(doc => {
      batch.update(doc.ref, {
        deletedFor: firebase.firestore.FieldValue.arrayUnion(user.uid),
        visibleFor: firebase.firestore.FieldValue.arrayRemove(user.uid)
      });
    });

    await batch.commit();
    showToast('Conversa limpa');

    // Atualização visual imediata
    if (currentChat?.id === chatId) {
      document.getElementById('messagesContainer').innerHTML = 
        '<div class="lux-no-messages">Conversa limpa</div>';
    }

  } catch (error) {
    console.error("[ERRO]", error);
    showToast('Erro ao limpar: ' + error.message, 'error');
  }
}
// Função para apagar completamente o chat
async function deleteChat(chatId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    // Remove o chat da lista do usuário
    await db.collection('users').doc(currentUser.uid).update({
      chats: firebase.firestore.FieldValue.arrayRemove(chatId)
    });
    
    showToast('Conversa apagada com sucesso');
    closeCurrentChat();
    
  } catch (error) {
    console.error('Erro ao apagar chat:', error);
    showToast('Erro ao apagar conversa', 'error');
  }
}

// Função para bloquear um usuário
async function blockUser(userId) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    await db.collection('users').doc(currentUser.uid).update({
      blockedUsers: firebase.firestore.FieldValue.arrayUnion(userId)
    });
    
    showToast('Usuário bloqueado com sucesso');
    closeCurrentChat();
    
  } catch (error) {
    console.error('Erro ao bloquear usuário:', error);
    showToast('Erro ao bloquear usuário', 'error');
  }
}

// Função para mostrar diálogo de denúncia
function showReportDialog(userId) {
  const modal = document.createElement('div');
  modal.className = 'lux-modal';
  modal.innerHTML = `
    <div class="lux-modal-content">
      <span class="lux-modal-close">&times;</span>
      <h3>Denunciar Usuário</h3>
      
      <div class="lux-form-group">
        <label>Motivo da denúncia</label>
        <select id="reportReason" class="lux-form-control">
          <option value="spam">Spam</option>
          <option value="inappropriate">Conteúdo inapropriado</option>
          <option value="harassment">Assédio</option>
          <option value="fake">Perfil falso</option>
          <option value="other">Outro</option>
        </select>
      </div>
      
      <div class="lux-form-group">
        <label>Descrição (opcional)</label>
        <textarea id="reportDescription" class="lux-form-control" rows="3"></textarea>
      </div>
      
      <button id="submitReportBtn" class="lux-btn lux-btn-danger">
        <i class="fas fa-flag"></i> Enviar Denúncia
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fecha o modal
  modal.querySelector('.lux-modal-close').addEventListener('click', () => {
    modal.remove();
  });
  
  // Fecha ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Envia a denúncia
  modal.querySelector('#submitReportBtn').addEventListener('click', async () => {
    const reason = modal.querySelector('#reportReason').value;
    const description = modal.querySelector('#reportDescription').value.trim();
    
    try {
      await submitReport(userId, reason, description);
      modal.remove();
    } catch (error) {
      console.error('Erro ao enviar denúncia:', error);
      showToast('Erro ao enviar denúncia', 'error');
    }
  });
}

// Função para enviar denúncia
async function submitReport(userId, reason, description = '') {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    await db.collection('reports').add({
      reporterId: currentUser.uid,
      reportedUserId: userId,
      reason: reason,
      description: description,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showToast('Denúncia enviada com sucesso. Obrigado!');
    
  } catch (error) {
    console.error('Erro ao enviar denúncia:', error);
    throw error;
  }
}
function closeCurrentChat() {
  // Fecha apenas o chat atual sem afetar o histórico
  const chatContainer = document.getElementById('lux-chat-container');
  const conversationList = document.getElementById('lux-conversation-list');
  
  if (chatContainer && conversationList) {
    // Adiciona animação de fechamento
    chatContainer.style.animation = 'fadeOut 0.3s forwards';
    
    setTimeout(() => {
      chatContainer.style.display = 'none';
      conversationList.style.display = 'block';
      chatContainer.style.animation = '';
      
      // Opcional: Limpa o chat atual
      document.getElementById('lux-floating-chatbox').innerHTML = '';
    }, 300);
  } else {
    console.log('Elementos do chat não encontrados');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleHeaderBtn');
  const profileHeader = document.querySelector('.lux-profile-header');
  
  if (toggleBtn && profileHeader) {
    toggleBtn.addEventListener('click', function() {
      profileHeader.classList.toggle('collapsed');
      
      // Atualiza o ícone
      const icon = this.querySelector('i');
      if (profileHeader.classList.contains('collapsed')) {
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
      } else {
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
      }
    });
  }
});




// Função para verificar se é mobile
function isMobile() {
  return window.innerWidth <= 768;
}


async function getUserProfilePhoto(userId) {
  try {
    const userDoc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.profilePhotoURL) {
        // Adiciona timestamp para evitar cache
        return `${userData.profilePhotoURL}&timestamp=${Date.now()}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar foto do perfil:", error);
    return null;
  }
}


// Função auxiliar para buscar foto no Firestore
async function getFirestoreProfilePhoto(userId) {
  try {
    const doc = await firebase.firestore().collection('users').doc(userId).get();
    return doc.exists ? doc.data().profilePhotoURL : null;
  } catch (error) {
    console.error("Erro ao buscar foto no Firestore:", error);
    return null;
  }
}

// Função para testar carregamento da imagem
function testImageLoad(imgElement) {
  return new Promise((resolve) => {
    imgElement.onload = resolve;
    imgElement.onerror = () => {
      imgElement.src = 'https://via.placeholder.com/150';
      resolve();
    };
    // Timeout de segurança
    setTimeout(resolve, 2000);
  });
}

// Função para atualizar informações do usuário
function updateUserInfo(name, userType) {
  const titles = {
    sugar_daddy: 'Sugar Daddy',
    sugar_mommy: 'Sugar Mommy',
    sugar_baby: 'Sugar Baby',
    member: 'Membro LuxMeet'
  };
  
  const userNameElement = document.getElementById('userName');
  if (userNameElement) userNameElement.textContent = name;
  
  const userTitleElement = document.getElementById('userTitle');
  if (userTitleElement) {
    userTitleElement.textContent = titles[userType] || 'Membro';
  }
}

// Função para atualizar estatísticas
function updateUserStats(matches, views, likesCount) {
const matchCount = Array.isArray(matches) ? matches.length : 0;
const matchCountElement = document.getElementById('matchCount');
if (matchCountElement) matchCountElement.textContent = matchCount;


  
  const viewCountElement = document.getElementById('viewCount');
  if (viewCountElement) viewCountElement.textContent = views;
  
  const likesCountElement = document.getElementById('likesCount');
  if (likesCountElement) {
    likesCountElement.textContent = likesCount;
    likesCountElement.style.cursor = 'pointer';
    likesCountElement.title = 'Clique para ver quem curtiu';
  }
}



document.addEventListener('DOMContentLoaded', function() {
    initProfile();
setupGalleryNavigation();

  
  // Preview da imagem de perfil
  document.getElementById('profileImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('profilePreview').src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  // Envio do formulário
  document.getElementById('profileForm').addEventListener('submit', function(e) {
    e.preventDefault();
    saveUserData2(); // Alterado para a função correta
  });
  
   document.getElementById('profileImage')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('profilePreview').src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  
  // Botão de cancelar
  document.querySelector('.btn-cancel').addEventListener('click', function() {
    loadUserData2(); // Alterado para a função correta
  });
});


async function saveUserData2() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert('Usuário não autenticado. Faça login novamente.');
    return;
  }

  const saveButton = document.querySelector('.btn-save');
  const originalText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="loading-spinner"></i> Salvando...';
  saveButton.disabled = true;

  try {
    const formData = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      bio: document.getElementById('bio').value.trim(),
      city: document.getElementById('city').value.trim(),
      dateOfBirth: document.getElementById('dateOfBirth').value,
      gender: document.getElementById('gender').value,
      income: document.getElementById('income').value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

     if (!formData.name || !formData.email) {
      throw new Error('Nome e e-mail são obrigatórios');
    }

    if (formData.email !== user.email) {
      // Substitua o prompt pelo modal
      const password = await showPasswordModal();
      if (!password) {
        throw new Error('Confirmação de senha cancelada');
      }
      
      await reauthenticateUser(password);
      await user.updateEmail(formData.email);
    }

    // Upload da nova imagem (se foi alterada)
    const fileInput = document.getElementById('profileImage');
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      
      // Referência do Storage - usando user ID e timestamp para nome único
      const storageRef = firebase.storage().ref(`profile_photos/${user.uid}/${Date.now()}_${file.name}`);
      
      // Fazer upload
      const uploadTask = await storageRef.put(file);
      
      // Obter URL de download
      formData.profilePhotoURL = await uploadTask.ref.getDownloadURL();
      
      // Opcional: deletar a imagem antiga se existir
      const oldImageUrl = document.getElementById('profilePreview').src;
      if (oldImageUrl && !oldImageUrl.includes('via.placeholder.com')) {
        try {
          const oldImageRef = firebase.storage().refFromURL(oldImageUrl);
          await oldImageRef.delete();
        } catch (deleteError) {
          console.warn('Não foi possível deletar a imagem antiga:', deleteError);
        }
      }
    }

    // Atualizar Firestore
    await firebase.firestore().collection('users').doc(user.uid).update(formData);

    // Feedback de sucesso
    alert('Perfil atualizado com sucesso!');
    
    // Atualizar visualização (opcional)
    if (formData.profilePhotoURL) {
      document.getElementById('profilePreview').src = formData.profilePhotoURL;
    }

  } catch (error) {
    console.error('Erro ao salvar perfil:', error);
    alert(error.message || 'Erro ao atualizar perfil');
    loadUserData2();
  } finally {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}
function showPasswordModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('passwordModal');
    const modalContent = document.querySelector('.modal-content');
    const passwordInput = document.getElementById('currentPassword');
    const confirmBtn = document.getElementById('confirmPasswordBtn');
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    const closeBtn = document.querySelector('.close-modal');

    // Mostrar modal
    modal.style.display = 'block';
    passwordInput.focus();

    // Função para limpar
    const cleanUp = () => {
      modal.style.display = 'none';
      passwordInput.value = '';
      // Remover event listeners para evitar múltiplas atribuições
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
      modal.onclick = null;
      passwordInput.onkeypress = null;
    };

    // Configurar eventos
    const setupEvents = () => {
      // Confirmar
      confirmBtn.onclick = () => {
        const password = passwordInput.value.trim();
        if (password) {
          cleanUp();
          resolve(password);
        } else {
          passwordInput.focus();
        }
      };

      // Cancelar
      const cancelHandler = () => {
        cleanUp();
        resolve(null);
      };

      cancelBtn.onclick = cancelHandler;
      closeBtn.onclick = cancelHandler;

      // Fechar ao clicar fora do conteúdo
      modal.onclick = (e) => {
        if (e.target === modal) {
          cancelHandler();
        }
      };

      // Enter para confirmar
      passwordInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      };
    };

    setupEvents();
  });
}

async function loadUserData2() {
  console.log("Iniciando loadUserData2");
  
  // Verificar autenticação
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("Usuário não autenticado");
    return;
  }
  console.log("Usuário autenticado:", user.uid);

  try {
    // Buscar dados no Firestore
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("Dados do Firestore:", userData);

      // Preencher campos com verificação de existência
      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
      };

      const setImage = (id, url) => {
        const element = document.getElementById(id);
        if (element) element.src = url || 'https://via.placeholder.com/150';
      };

      // Campos básicos
      setValue('name', userData.name);
      setValue('email', userData.email || user.email);
      setValue('bio', userData.bio);
      setValue('city', userData.city);
      
      // Data de nascimento (com tratamento especial)
      const birthDate = userData.dateOfBirth ? 
                       (userData.dateOfBirth.toDate ? userData.dateOfBirth.toDate().toISOString().split('T')[0] : 
                       userData.dateOfBirth) : '';
      setValue('dateOfBirth', birthDate);

      // Selects
      setValue('gender', userData.gender);
      setValue('income', userData.income);
      setValue('userType', userData.userType);

      // Imagem de perfil
      setImage('profilePreview', userData.profilePhotoURL);

      console.log("Dados carregados com sucesso");
    } else {
      console.log("Documento não encontrado, criando novo...");
      await firebase.firestore().collection('users').doc(user.uid).set({
        name: user.displayName || '',
        email: user.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Recarregar após criar
      await loadUserData2();
    }
  } catch (error) {
    console.error("Erro ao carregar:", error);
    alert("Erro ao carregar perfil: " + error.message);
  }
}


function showProfileSection() {
  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Por favor, faça login para acessar seu perfil");
    return;
  }
  
  const profileSection = document.getElementById('profileSection');
  if (profileSection) {
    // Primeiro carrega os dados, depois mostra a seção
    loadUserData2().then(() => {
      profileSection.style.display = 'block';
      console.log("Perfil carregado e exibido");
    });
  }
}

// Adicione este código para garantir que a função seja chamada quando o usuário estiver autenticado
function initProfile() {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      loadUserData2();
    } else {
      console.log("Usuário não autenticado - redirecionando...");
      // window.location.href = '/login.html'; // Descomente se quiser redirecionar
    }
  });
}
// Função auxiliar para formatar datas do Firestore
function formatFirestoreDate(date) {
  if (!date) return '';
  
  try {
    // Se for Timestamp do Firestore
    if (date.toDate) {
      return date.toDate().toISOString().split('T')[0];
    }
    // Se for string (YYYY-MM-DD)
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    // Se for objeto Date
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    // Tentar converter de qualquer forma
    return new Date(date).toISOString().split('T')[0];
  } catch (e) {
    console.warn("Erro ao formatar data:", e);
    return '';
  }
}
async function reauthenticateUser(currentPassword) {
  const user = firebase.auth().currentUser;
  const credential = firebase.auth.EmailAuthProvider.credential(
    user.email, 
    currentPassword
  );
  
  try {
    await user.reauthenticateWithCredential(credential);
    return true;
  } catch (error) {
    console.error('Erro na reautenticação:', error);
    return false;
  }
}
function initEmojiPicker() {
  // Elementos do DOM
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiGrid = document.getElementById('emojiGrid');
  const messageInput = document.getElementById('messageInput');
  const emojiSearch = document.getElementById('emojiSearch');

  // Verificar se elementos existem
  if (!emojiBtn || !emojiPicker || !emojiGrid || !messageInput) {
    console.error('Elementos do emoji picker não encontrados!');
    return;
  }

  // Limpar campo de busca e garantir que está vazio
  if (emojiSearch) {
    emojiSearch.value = '';
    emojiSearch.placeholder = 'Buscar emoji...';
  }

  // Preencher o grid de emojis
  let emojiHTML = '';
  for (const [category, emojis] of Object.entries(emojiCategories)) {
    emojiHTML += `<div class="lux-emoji-category-title" data-category="${category.toLowerCase()}">${category}</div>`;
    emojis.forEach(emoji => {
      emojiHTML += `<div class="lux-emoji-item" data-emoji="${emoji}">${emoji}</div>`;
    });
  }
  emojiGrid.innerHTML = emojiHTML;

  // Variável para controlar o estado do picker
  let isPickerOpen = false;

  // Função para mostrar o picker
  const showPicker = () => {
    emojiPicker.classList.add('visible');
    isPickerOpen = true;
    
    // Posicionar o picker corretamente
    positionPicker();
    
    // Focar no campo de busca
    if (emojiSearch) {
      setTimeout(() => emojiSearch.focus(), 50);
    }
  };

  // Função para esconder o picker
  const hidePicker = () => {
    emojiPicker.classList.remove('visible');
    isPickerOpen = false;
    
    // Limpar busca quando fechar
    if (emojiSearch) {
      emojiSearch.value = '';
      const event = new Event('input', { bubbles: true });
      emojiSearch.dispatchEvent(event);
    }
  };

  // Função para posicionar o picker corretamente
  const positionPicker = () => {
    const btnRect = emojiBtn.getBoundingClientRect();
    const pickerWidth = emojiPicker.offsetWidth;
    const pickerHeight = emojiPicker.offsetHeight;
    
    // Verificar espaço disponível
    const spaceRight = window.innerWidth - btnRect.right;
    const spaceBottom = window.innerHeight - btnRect.top;
    
    // Posicionar relativo ao botão
    if (spaceRight >= pickerWidth) {
      emojiPicker.style.left = `${btnRect.right}px`;
      emojiPicker.style.right = 'auto';
    } else {
      emojiPicker.style.left = 'auto';
      emojiPicker.style.right = `${window.innerWidth - btnRect.left}px`;
    }
    
    if (spaceBottom >= pickerHeight) {
      emojiPicker.style.top = `${btnRect.top}px`;
      emojiPicker.style.bottom = 'auto';
    } else {
      emojiPicker.style.top = 'auto';
      emojiPicker.style.bottom = `${window.innerHeight - btnRect.bottom}px`;
    }
  };

  // Evento de clique no botão de emoji
  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isPickerOpen) {
      hidePicker();
    } else {
      showPicker();
    }
  });

  // Selecionar emoji
  emojiGrid.addEventListener('click', (e) => {
    const emojiItem = e.target.closest('.lux-emoji-item');
    if (emojiItem) {
      const emoji = emojiItem.getAttribute('data-emoji');
      messageInput.value += emoji;
      messageInput.focus();
      hidePicker();
    }
  });

  // Fechar ao clicar fora
  document.addEventListener('click', (e) => {
    if (isPickerOpen && !emojiPicker.contains(e.target) ){
      hidePicker();
    }
  });

  // Fechar com tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPickerOpen) {
      hidePicker();
    }
  });

  // Busca de emojis
  if (emojiSearch) {
    emojiSearch.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const allEmojis = emojiGrid.querySelectorAll('.lux-emoji-item');
      const categories = emojiGrid.querySelectorAll('.lux-emoji-category-title');
      
      let hasResults = false;
      
      allEmojis.forEach(emojiEl => {
        const emoji = emojiEl.getAttribute('data-emoji');
        const emojiName = getEmojiName(emoji).toLowerCase();
        const isVisible = emojiName.includes(term);
        emojiEl.style.display = isVisible ? 'block' : 'none';
        
        if (isVisible) hasResults = true;
      });

      // Mostrar/ocultar categorias baseado nos resultados
      categories.forEach(category => {
        const categoryName = category.getAttribute('data-category');
        const emojisInCategory = emojiGrid.querySelectorAll(
          `.lux-emoji-item[data-category="${categoryName}"]`
        );
        
        const hasVisible = Array.from(emojisInCategory).some(
          el => el.style.display !== 'none'
        );
        
        category.style.display = hasVisible ? 'block' : 'none';
      });

      // Mostrar mensagem se não houver resultados
      const noResults = emojiGrid.querySelector('.no-results') || 
                       document.createElement('div');
      if (!hasResults && term) {
        noResults.className = 'no-results';
        noResults.textContent = 'Nenhum emoji encontrado';
        if (!noResults.parentNode) {
          emojiGrid.appendChild(noResults);
        }
      } else if (noResults.parentNode) {
        noResults.remove();
      }
    });
  }

  // Reposicionar quando a janela for redimensionada
  window.addEventListener('resize', () => {
    if (isPickerOpen) {
      positionPicker();
    }
  });
}



// Adicione isso ao seu arquivo JavaScript
const emojiCategories = {
  "Frequentes": ["😀", "😂", "😍", "🥰", "😎", "🤩", "😊", "🙂", "😉", "😘"],
  "Pessoas": ["👋", "👍", "👎", "👏", "🙌", "🤝", "👂", "👀", "🧠", "👶"],
  "Natureza": ["🌞", "🌝", "🌚", "🌍", "🌻", "🌹", "🍎", "🍕", "⚽", "🎮"],
  "Objetos": ["📱", "💻", "⌚", "📷", "🎧", "📚", "✏️", "🎁", "💡", "🔑"],
  "Símbolos": ["❤️", "✨", "🔥", "💯", "✅", "❌", "❗", "❓", "➕", "➖"]
};



// Função auxiliar para obter nome do emoji (simplificada)
function getEmojiName(emoji) {
  const emojiNames = {
    "😀": "sorriso", "😂": "risada", "😍": "apaixonado", "🥰": "coração no rosto",
    "😎": "óculos escuros", "🤩": "estrela nos olhos", "😊": "sorriso feliz",
    "🙂": "sorriso leve", "😉": "piscada", "😘": "beijo",
    "👋": "acenando", "👍": "joinha", "👎": "polegar para baixo",
    "👏": "palmas", "🙌": "mãos para cima", "🤝": "aperto de mão",
    "👂": "orelha", "👀": "olhos", "🧠": "cérebro", "👶": "bebê",
    "🌞": "sol com rosto", "🌝": "lua cheia com rosto", "🌚": "lua nova com rosto",
    "🌍": "globo terrestre", "🌻": "girassol", "🌹": "rosa",
    "🍎": "maçã", "🍕": "pizza", "⚽": "bola de futebol", "🎮": "videogame",
    "📱": "celular", "💻": "notebook", "⌚": "relógio", "📷": "câmera",
    "🎧": "fone de ouvido", "📚": "livros", "✏️": "lápis", "🎁": "presente",
    "💡": "lâmpada", "🔑": "chave", "❤️": "coração", "✨": "brilho",
    "🔥": "fogo", "💯": "cem pontos", "✅": "marca de verificação", "❌": "xis",
    "❗": "ponto de exclamação", "❓": "ponto de interrogação", "➕": "mais", "➖": "menos"
  };
  
  return emojiNames[emoji] || emoji;
}

// Chame esta função quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initEmojiPicker);




// Certifique-se que o Firebase está inicializado antes deste código
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verifica se o Firebase está inicializado
        if (!firebase.apps.length) {
            console.error("Firebase não está inicializado");
            showError("Sistema não inicializado");
            return;
        }

        await fetchExclusiveUsers();
    } catch (error) {
        console.error("Erro inicial:", error);
        showError("Erro ao carregar");
    }
});

async function fetchExclusiveUsers() {
    try {
        const container = document.getElementById('exclusive-profiles-container');
        container.innerHTML = '<div class="loading-profiles"><i class="fas fa-spinner fa-spin"></i> Carregando usuários exclusivos...</div>';

        const usersRef = firebase.firestore().collection('users');
        const snapshot = await usersRef
            .where('selo', 'in', ['VIP', 'PREMIUM', 'ELITE', 'DIAMOND', 'GOLD'])
            .limit(12)
            .get();

        if (snapshot.empty) {
            showMessage("Nenhum usuário exclusivo encontrado");
            return;
        }

        const exclusiveUsers = processUsers(snapshot);
        displayExclusiveUsers(exclusiveUsers);
        
    } catch (error) {
        console.error("Erro no fetchExclusiveUsers:", error);
        showError("Erro ao carregar usuários");
    }
}

function processUsers(snapshot) {
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || "Membro Lux",
            photo: data.profilePhotoURL || getDefaultAvatar(data.selo),
            selo: data.selo || 'GOLD'
        };
    }).sort((a, b) => {
        const order = {'DIAMOND': 1, 'ELITE': 2, 'PREMIUM': 3, 'VIP': 4, 'GOLD': 5};
        return order[a.selo] - order[b.selo];
    });
}
function displayExclusiveUsers(users) {
    const container = document.getElementById('exclusive-profiles-container');
    container.innerHTML = '';

    users.forEach(user => {
        const profileDiv = document.createElement('div');
        profileDiv.className = 'exclusive-profile';
        profileDiv.innerHTML = createProfileHTML(user);
        
        // Modificado para usar viewProfile
        profileDiv.addEventListener('click', () => {
            viewProfile(user.id);
        });
        
        container.appendChild(profileDiv);
    });
}
// Funções auxiliares
function createProfileHTML(user) {
    const badgeColors = {
        'VIP': '#ff416c', 
        'PREMIUM': '#4e54c8',
        'ELITE': '#11998e',
        'DIAMOND': '#8e2de2',
        'GOLD': '#f7971e'
    };

    return `
        <div class="profile-image-container">
            <img src="${user.photo}" alt="${user.name}" class="profile-image"
                 onerror="this.src='${getDefaultAvatar(user.selo)}'">
            <span class="profile-badge" style="background: ${badgeColors[user.selo] || '#f7971e'}">
                ${user.selo}
            </span>
            <div class="profile-name-tooltip">${user.name}</div>
        </div>
    `;
}

function getDefaultAvatar(selo) {
    const colors = {
        'DIAMOND': '8e2de2',
        'ELITE': '11998e',
        'PREMIUM': '4e54c8',
        'VIP': 'ff416c',
        'GOLD': 'f7971e'
    };
    return `https://ui-avatars.com/api/?name=LU&background=${colors[selo] || '333'}&color=fff&size=128`;
}

function navigateToProfile(userId) {
    window.location.href = `/perfil.html?id=${userId}`;
}

function showError(message) {
    const container = document.getElementById('exclusive-profiles-container');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function showMessage(message) {
    const container = document.getElementById('exclusive-profiles-container');
    container.innerHTML = `<div class="info-message">${message}</div>`;
}


// Adicione esta função após carregar os usuários
function setupScrollIndicator() {
    const container = document.querySelector('.exclusive-profiles-scroll');
    const track = document.createElement('div');
    track.className = 'exclusive-scroll-track';
    const thumb = document.createElement('div');
    thumb.className = 'exclusive-scroll-thumb';
    track.appendChild(thumb);
    container.after(track);
    
    // Só mostra a track se houver overflow
    if (container.scrollWidth > container.clientWidth) {
        track.style.display = 'block';
        
        // Atualiza a posição do thumb
        container.addEventListener('scroll', () => {
            const scrollable = container.scrollWidth - container.clientWidth;
            const scrolled = container.scrollLeft;
            const thumbWidth = Math.max(50, (container.clientWidth / container.scrollWidth) * 100);
            thumb.style.width = `${thumbWidth}px`;
            thumb.style.left = `${(scrolled / scrollable) * (100 - thumbWidth)}%`;
        });
    }
}

// Chame esta função depois de carregar os usuários
document.addEventListener('DOMContentLoaded', () => {
    fetchExclusiveUsers().then(() => {
        setupScrollIndicator();
        
        // Adiciona navegação por setas (opcional)
        const container = document.querySelector('.exclusive-profiles-scroll');
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        });
    });
});




// Variáveis globais
let selectedGift = null;
let selectedUserId = null;

// Funções de ação para os presentes




let luxuryGifts = [];
async function fetchAvailableGifts() {
  try {
    const snapshot = await firebase.firestore().collection('gifts')
      .where('available', '==', true) // Note que é boolean, não string
      .get();

    if (snapshot.empty) {
      console.warn('Nenhum presente encontrado no Firestore. Verifique:');
      console.warn('1. Se "available" é boolean (não string)');
      console.warn('2. Se as regras de segurança permitem leitura');
      return getDefaultGifts();
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.nome || data.name || 'Presente sem nome', // Note "nome" em vez de "name"
        price: data.price || 0,
        image: data.image || defaultGiftImage,
        category: data.category || 'other',
        available: true
      };
    });

  } catch (error) {
    console.error('Erro ao buscar presentes:', error);
    return getDefaultGifts();
  }
}

// Variável global para armazenar os presentes


// Função para exibir os presentes (atualizada)
function displayGiftsInModal(gifts) {
  const container = document.querySelector('#giftShopSection .lux-gifts-container');
  
  if (!gifts || gifts.length === 0) {
    container.innerHTML = `
      <div class="lux-no-gifts" style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <i class="fas fa-gift" style="font-size: 40px; color: rgba(255,255,255,0.5);"></i>
        <p style="color: rgba(255,255,255,0.5); margin-top: 15px;">Nenhum presente disponível nesta categoria</p>
      </div>`;
    return;
  }

  container.innerHTML = gifts.map(gift => `
    <div class="lux-gift-card" data-id="${gift.id}">
      <div class="lux-gift-image-container">
        <img src="${gift.image}" alt="${gift.name}" class="lux-gift-image" 
             onerror="this.src='${defaultGiftImage}'">
      </div>
      <div class="lux-gift-info">
        <h3 class="lux-gift-name">${gift.name}</h3>
        <p class="lux-gift-price">${formatCurrency(gift.price)}</p>
      </div>
    </div>
  `).join('');

  setupShopGiftCards();
}
async function openGiftShop(userId) {
  const modal = document.getElementById('giftModal');
  if (!modal) {
    console.error('Modal de presentes não encontrado');
    return;
  }

  // Armazenar o ID do destinatário no modal
  modal.dataset.recipientId = userId;
  
  // Mostrar modal
  modal.style.display = 'block';
  
  // Carregar presentes
  await loadGifts();
  
  // Configurar eventos
  setupGiftModalEvents();
}

// Função para fechar todos os modais
function closeAllModals() {
  document.getElementById('giftModal').style.display = 'none';
  document.getElementById('giftActionsModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

function closeGiftModal() {
  document.getElementById('giftModal').style.display = 'none';
  document.body.style.overflow = 'auto'; // Restaura o scroll da página
}

function getSafeImageUrl(url) {
  try {
    if (!url || !url.startsWith('http')) {
      return defaultGiftImage; // Use uma imagem padrão definida globalmente
    }
    return url;
  } catch {
    return defaultGiftImage;
  }
}



async function fetchAvailableGifts() {
  try {
    // Verifica se o Firebase está inicializado
    if (!firebase.apps.length) {
      throw new Error('Firebase não inicializado');
    }

    const snapshot = await firebase.firestore().collection('gifts')
      .where('available', '==', true)
      .get();

    if (snapshot.empty) {
      console.warn('Nenhum presente encontrado no Firestore. Usando fallback.');
      return getDefaultGifts(); // Retorna presentes padrão
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || 'Presente sem nome',
      price: doc.data().price || 0,
      image: doc.data().image || defaultGiftImage,
      category: doc.data().category || 'other',
      available: true
    }));

  } catch (error) {
    console.error('Erro ao buscar presentes:', error);
    return getDefaultGifts(); // Retorna presentes padrão em caso de erro
  }
}

// Função de fallback com presentes padrão
function getDefaultGifts() {
  return [
    {
      id: '1',
      name: 'Relógio de Luxo',
      price: 12000,
      image: 'https://via.placeholder.com/300?text=Relógio+Luxo',
      category: 'jewelry',
      available: true
    },
    {
      id: '2',
      name: 'Jantar Romântico',
      price: 800,
      image: 'https://via.placeholder.com/300?text=Jantar+Romântico',
      category: 'experiences',
      available: true
    },
    {
      id: '3',
      name: 'Bolsa Designer',
      price: 3500,
      image: 'https://via.placeholder.com/300?text=Bolsa+Designer',
      category: 'fashion',
      available: true
    },
    {
      id: '4',
      name: 'Assinatura Premium',
      price: 200,
      image: 'https://via.placeholder.com/300?text=Assinatura+Premium',
      category: 'digital',
      available: true
    }
  ];
}

function setupGiftCardEvents() {
  document.querySelectorAll('.lux-gift-card').forEach(card => {
    card.addEventListener('click', function() {
      const giftId = this.getAttribute('data-id');
      const gift = luxuryGifts.find(g => g.id === giftId);
      
      if (gift) {
        showGiftActions(gift);
      } else {
        console.error('Presente não encontrado:', giftId);
      }
    });
  });
}

// Variáveis globais
let selectedGiftForSending = null;

// Função modificada para exibir ações do presente
function setupGiftCardEvents() {
  document.querySelectorAll('.lux-gift-card').forEach(card => {
    card.addEventListener('click', function(e) {
      // Previne que o evento chegue ao modal principal
      e.stopPropagation();
      
      const giftId = this.getAttribute('data-id');
      const gift = luxuryGifts.find(g => g.id === giftId);
      
      if (gift) {
        selectedGiftForSending = gift;
        showGiftActions(gift);
      }
    });
  });
}



function selectUser(userElement) {
  // Remove seleção anterior
  document.querySelectorAll('.user-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Adiciona seleção nova
  userElement.classList.add('selected');
  
  // Armazena o ID do usuário selecionado
  selectedUserId = userElement.dataset.userId;
  console.log('Usuário selecionado:', selectedUserId); // Para depuração
}

async function sendScheduledGift(userId, gift) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) throw new Error('Usuário não autenticado');

  // Verifica saldo (se for presente pago)
  if (gift.price > 0) {
    const userDoc = await firebase.firestore().collection('users').doc(currentUser.uid).get();
    const balance = userDoc.data()?.balance || 0;
    
    if (balance < gift.price) {
      throw new Error('Saldo insuficiente');
    }
  }

  // Cria a transação no Firestore
  const transactionRef = firebase.firestore().collection('scheduledGifts').doc();
  
  const giftData = {
    ...gift,
    giftId: `scheduled_${transactionRef.id}`,
    fromUserId: currentUser.uid,
    toUserId: userId,
    fromUserName: currentUser.displayName || 'Anônimo'
  };

  await transactionRef.set(giftData);

  // Atualiza o saldo imediatamente (se for pago)
  if (gift.price > 0) {
    await firebase.firestore().collection('users').doc(currentUser.uid).update({
      balance: firebase.firestore.FieldValue.increment(-gift.price)
    });
  }
}

async function sendCustomizedGift() {
  // Verificação básica
  if (!selectedUserId || !selectedGift) {
    showToast('Dados incompletos para envio', 'error');
    return;
  }

  // Coleta a mensagem - VERIFICAÇÃO ROBUSTA
  const messageInput = document.getElementById('giftMessage');
  const message = messageInput ? messageInput.value : '';
  
  // Coleta presente extra - VERIFICAÇÃO ROBUSTA
  const additionalGiftsSelect = document.getElementById('additionalGifts');
  const additionalGiftId = additionalGiftsSelect ? additionalGiftsSelect.value : null;

  try {
    showLoading('Enviando presente personalizado...');
    
    // MONTA O OBJETO CORRETAMENTE
    const giftData = {
      // Dados básicos do presente
      ...selectedGift,
      
      // Dados de personalização
      message: message.trim(), // Remove espaços extras
      isCustomized: true,
      createdAt: new Date().toISOString(),
      
      // Relacionamentos
      fromUserId: firebase.auth().currentUser.uid,
      toUserId: selectedUserId,
      
      // Status
      status: 'delivered'
    };

    // ADICIONA PRESENTE EXTRA SE EXISTIR
    if (additionalGiftId) {
      const doc = await firebase.firestore().collection('gifts').doc(additionalGiftId).get();
      if (doc.exists) {
        giftData.additionalGift = {
          id: doc.id,
          ...doc.data()
        };
      }
    }

    console.log('Dados que serão enviados:', giftData); // LOG PARA DEPURAÇÃO

    // ENVIA PARA O FIRESTORE
    const transactionRef = firebase.firestore().collection('transactions').doc();
    giftData.transactionId = transactionRef.id;
    
    await transactionRef.set(giftData);
    
    // ATUALIZA O USUÁRIO RECEPTOR
    await firebase.firestore().collection('users')
      .doc(selectedUserId)
      .update({
        'gifts.received': firebase.firestore.FieldValue.arrayUnion(giftData)
      });

    showToast('Presente personalizado enviado com sucesso!', 'success');
    closeGiftActionsModal();

  } catch (error) {
    console.error('Erro completo:', error);
    showToast(`Erro ao enviar: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// Função para fechar todos os modais
function closeAllModals() {
  document.getElementById('giftModal').style.display = 'none';
  document.getElementById('giftActionsModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}
function setupActionButtons(userId, gift) {
  // Botão Enviar
  document.querySelector('.lux-action-send').onclick = () => {
    sendGiftToUser(userId, gift);
  };
  
  // Botão Lista de Desejos
  document.querySelector('.lux-action-wishlist').onclick = () => {
    addToWishlist(gift);
  };
  
  // Botão Personalizar
  document.querySelector('.lux-action-custom').onclick = () => {
    customizeGift(gift);
  };
  
  // Botão Agendar
  document.querySelector('.lux-action-schedule').onclick = () => {
    scheduleGiftDelivery(userId, gift);
  };
}

function closeGiftActionsModal() {
  document.getElementById('giftActionsModal').style.display = 'none';
}

async function sendGiftToUser(userId, gift) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error('Usuário não autenticado');

    showLoading('Enviando presente...');
    
    // 1. Obter informações dos usuários
    const [receiverDoc, userDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('users').doc(currentUser.uid).get()
    ]);
    
    const receiverName = receiverDoc.data()?.name || 'Usuário';
    const userName = userDoc.data()?.name || 'Anônimo';

    // 2. Verificar saldo (se aplicável)
    if (gift.price > 0) {
      const balance = userDoc.data()?.balance || 0;
      if (balance < gift.price) {
        showToast('Saldo insuficiente para enviar este presente', 'error');
        return;
      }
    }

    // 3. Criar documento na coleção CORRETA (giftTransactions)
    const transactionRef = db.collection('giftTransactions').doc();
    const giftData = {
      giftId: `gift_${transactionRef.id}`,
      transactionId: transactionRef.id,
      name: gift.name,
      price: gift.price,
      image: gift.image,
      category: gift.category,
      date: new Date().toISOString(),
      status: 'pending', // Alterado para pending (será accepted quando recebido)
      type: 'sent', // Tipo diferente para envio
      fromUserId: currentUser.uid,
      fromUserName: userName,
      toUserId: userId,
      toUserName: receiverName,
      viewed: false
    };

    // 4. Executar todas as operações em batch
    const batch = db.batch();
    
    // a) Adicionar à coleção principal
    batch.set(transactionRef, giftData);
    
    // b) Atualizar usuário remetente
    batch.update(db.collection('users').doc(currentUser.uid), {
      'gifts.sent': firebase.firestore.FieldValue.arrayUnion({
        ...giftData,
        status: 'sent' // Mantém como sent no histórico do usuário
      }),
      ...(gift.price > 0 && { 
        balance: firebase.firestore.FieldValue.increment(-gift.price) 
      })
    });

    // c) Atualizar usuário destinatário
    batch.update(db.collection('users').doc(userId), {
      'gifts.received': firebase.firestore.FieldValue.arrayUnion({
        ...giftData,
        status: 'pending' // Status diferente para o receptor
      })
    });

    await batch.commit();
    
    // 5. Mostrar confirmação e atualizar UI
    await showGratitudeScreen(gift, receiverName);
    showToast(`Presente enviado com sucesso para ${receiverName}!`, 'success');
    
    // 6. Atualizar a lista de presentes enviados
    await loadSentGifts();
    
    if (gift.price > 0) {
      await updateUserBalanceUI();
    }

  } catch (error) {
    console.error('Erro ao enviar presente:', error);
    showToast(`Erro ao enviar: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function showGratitudeScreen(gift, receiverName) {
  try {
    console.log('[showGratitudeScreen] Exibindo tela para:', receiverName);
    
    const currentUser = firebase.auth().currentUser;
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userName = userDoc.data()?.name || 'Prezado(a) Cliente';

    await Swal.fire({
      title: '✨ Presente Enviado com Sucesso!',
      html: `
        <div style="text-align: center; max-width: 600px; margin: 0 auto;">
          <div style="
            height: 150px;
            background-image: url('${gift.image || 'https://example.com/default-gift.jpg'}');
            background-size: contain;
            background-position: center;
            background-repeat: no-repeat;
            margin: 20px 0;
          "></div>
          
          <h3 style="color: #d4af37; margin-bottom: 20px;">${userName}, seu gesto foi registrado</h3>
          
          <p style="font-size: 16px; line-height: 1.6;">
            O presente <strong>${gift.name}</strong> foi enviado com sucesso para 
            <strong>${receiverName}</strong>.
          </p>
          
          <div style="
            height: 1px;
            background: linear-gradient(90deg, transparent, #d4af37, transparent);
            margin: 25px 0;
          "></div>
          
          <div style="
            background: rgba(212, 175, 55, 0.1);
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: left;
          ">
            <h4 style="color: #d4af37; margin-top: 0;">Próximos Passos:</h4>
            <ul style="padding-left: 20px;">
              <li>Você receberá uma notificação quando o presente for aceito</li>
              <li>Nosso serviço de concierge poderá auxiliar no agendamento</li>
              <li>Acompanhe o status na seção "Meus Presentes"</li>
            </ul>
          </div>
        </div>
      `,
      width: 700,
      background: '#1a1a1a',
      color: '#ffffff',
      showConfirmButton: true,
      confirmButtonText: 'Voltar à Seleção Exclusiva',
      confirmButtonColor: '#d4af37',
      backdrop: `
        rgba(0,0,0,0.7)
        url("https://media.giphy.com/media/XEZE9JYPwaXIsXkX0Q/giphy.gif")
        center top
        no-repeat
      `
    });
    
    console.log('[showGratitudeScreen] Tela exibida com sucesso');
  } catch (error) {
    console.error('[showGratitudeScreen] Erro:', error);
    // Fallback caso ocorra erro no SweetAlert
    showToast('Presente enviado com sucesso!', 'success');
  }
}
// Função para atualizar o saldo do usuário
async function updateUserBalanceUI() {
  const balanceElement = document.querySelector('.user-balance');
  const balanceContainer = document.querySelector('.user-balance-container');
  
  if (!balanceElement) {
    console.warn('Elemento do saldo não encontrado na página');
    return;
  }

  try {
    // Mostra estado de carregamento
    balanceElement.textContent = 'Carregando...';
    balanceContainer.classList.add('loading');

    const user = firebase.auth().currentUser;
    
    if (!user) {
      balanceElement.textContent = 'Não logado';
      balanceContainer.classList.remove('loading');
      return;
    }

    // Busca os dados do usuário
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    
    if (!userDoc.exists) {
      balanceElement.textContent = 'Erro: perfil não encontrado';
      balanceContainer.classList.remove('loading');
      return;
    }

    const balance = userDoc.data()?.balance || 0;
    
    // Atualiza a UI
    balanceElement.textContent = formatCurrency(balance);
    balanceContainer.classList.remove('loading');
    
    // Atualiza o título com o valor completo
    balanceElement.title = `Saldo disponível: ${formatCurrency(balance)}`;
    
  } catch (error) {
    console.error('Erro ao carregar saldo:', error);
    balanceElement.textContent = 'Erro ao carregar';
    balanceContainer.classList.remove('loading');
  }
}

// Observador de estado de autenticação
function setupAuthObserver() {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      // Usuário logado - atualiza o saldo
      updateUserBalanceUI();
      
      // Configura listener em tempo real para o saldo
      setupBalanceListener(user.uid);
    } else {
      // Usuário não logado - reseta a UI
      const balanceElement = document.querySelector('.user-balance');
      if (balanceElement) {
        balanceElement.textContent = 'Faça login';
      }
    }
  });
}

// Listener em tempo real para o saldo
function setupBalanceListener(userId) {
  // Remove listener anterior se existir
  if (window.balanceListener) {
    window.balanceListener();
  }

  // Cria novo listener
  window.balanceListener = firebase.firestore()
    .collection('users')
    .doc(userId)
    .onSnapshot(doc => {
      if (doc.exists) {
        const balance = doc.data()?.balance || 0;
        const balanceElement = document.querySelector('.user-balance');
        if (balanceElement) {
          balanceElement.textContent = formatCurrency(balance);
          balanceElement.title = `Saldo disponível: ${formatCurrency(balance)}`;
        }
      }
    }, error => {
      console.error('Erro no listener do saldo:', error);
    });
}

// Quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa o Firebase se ainda não estiver inicializado
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  // Configura o observador de autenticação
  setupAuthObserver();
  
  // Atualiza imediatamente (caso o usuário já esteja logado)
  updateUserBalanceUI();
});
// Função auxiliar para verificar saldo
async function checkUserBalance(giftPrice) {
  const user = firebase.auth().currentUser;
  if (!user) return false;
  
  const doc = await firebase.firestore().collection('users').doc(user.uid).get();
  const balance = doc.data()?.balance || 0;
  return balance >= giftPrice;
}


/**
 * Função de serviço para enviar presente ao Firestore
 * Retorna { success: boolean, message?: string }
 */
async function sendGiftToFirestore(senderId, receiverId, giftData) {
  const db = firebase.firestore();
  
  try {
    // Verifica se os usuários existem
    const userCheck = await Promise.all([
      db.collection('users').doc(senderId).get(),
      db.collection('users').doc(receiverId).get()
    ]);

    if (!userCheck[0].exists || !userCheck[1].exists) {
      return { success: false, message: 'Usuário não encontrado' };
    }

    // Prepara os dados para envio
    const giftForSender = {
      ...giftData,
      type: 'sent',
      toUserId: receiverId
    };

    const giftForReceiver = {
      ...giftData,
      type: 'received',
      fromUserId: senderId
    };

    // Executa como transação atômica
    await db.runTransaction(async (transaction) => {
      // Atualiza o documento do remetente
      transaction.update(db.collection('users').doc(senderId), {
        'gifts.sent': firebase.firestore.FieldValue.arrayUnion(giftForSender)
      });

      // Atualiza o documento do destinatário
      transaction.update(db.collection('users').doc(receiverId), {
        'gifts.received': firebase.firestore.FieldValue.arrayUnion(giftForReceiver)
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Erro no Firestore:', error);
    return { 
      success: false, 
      message: error.message || 'Erro ao comunicar com o servidor' 
    };
  }
}






// Função principal para enviar presentes
async function handleSendGift() {
  // Verifica se tudo está definido
  if (!selectedGift || !selectedUserId) {
    showToast('Selecione um presente e um destinatário', 'error');
    return;
  }

  try {
    showLoading('Enviando presente...');
    
    // Prepara os dados do presente
    const giftData = {
      id: firebase.firestore().collection('gifts').doc().id,
      name: selectedGift.name,
      price: selectedGift.price,
      image: selectedGift.image,
      category: selectedGift.category,
      date: new Date().toISOString(),
      status: 'pending'
    };

    // Envia para o Firestore
    const success = await saveGiftToFirestore(
      firebase.auth().currentUser.uid,
      selectedUserId,
      giftData
    );

    if (success) {
      showToast('Presente enviado com sucesso!', 'success');
      closeGiftActionsModal();
      closeGiftModal();
    } else {
      showToast('Erro ao enviar presente', 'error');
    }
  } catch (error) {
    console.error('Erro no envio:', error);
    showToast('Erro: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}



// Função para enviar presente (renomeada para evitar conflito)
async function sendUserGift() {
  try {
    showLoading('Enviando presente...');
    
    if (!selectedGift || !selectedUserId) {
      throw new Error('Nenhum presente ou usuário selecionado');
    }

    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      throw new Error('Usuário não autenticado');
    }

    const giftData = {
      giftId: firebase.firestore().collection('gifts').doc().id,
      name: selectedGift.name,
      price: selectedGift.price,
      image: selectedGift.image,
      date: new Date().toISOString(),
      status: 'pending'
    };

    // Chama a função de serviço renomeada
    const success = await saveGiftToUser(
      currentUser.uid,
      selectedUserId,
      giftData
    );

    if (success) {
      showToast('Presente enviado com sucesso!', 'success');
      closeModal('giftActionsModal');
      closeModal('giftModal');
    }
  } catch (error) {
    console.error('Erro ao enviar presente:', error);
    showToast(error.message || 'Erro ao enviar presente', 'error');
  } finally {
    hideLoading();
  }
}

// Função genérica para fechar modais
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// Configuração do event listener (deve ser chamada quando o modal é aberto)
function setupGiftButton() {
  const sendBtn = document.querySelector('.lux-action-send');
  if (sendBtn) {
    sendBtn.onclick = sendUserGift; // Usa atribuição direta para evitar duplicação
  }
}

async function saveGiftToFirestore(senderId, receiverId, giftData) {
  const db = firebase.firestore();
  
  try {
    await db.runTransaction(async (transaction) => {
      // Referências aos documentos
      const senderRef = db.collection('users').doc(senderId);
      const receiverRef = db.collection('users').doc(receiverId);
      
      // Obtém os dados atuais
      const senderDoc = await transaction.get(senderRef);
      const receiverDoc = await transaction.get(receiverRef);

      // Prepara os dados para atualização
      const senderUpdate = {
        'gifts.sent': [...(senderDoc.data()?.gifts?.sent || []), {
          ...giftData,
          toUserId: receiverId,
          type: 'sent'
        }]
      };

      const receiverUpdate = {
        'gifts.received': [...(receiverDoc.data()?.gifts?.received || []), {
          ...giftData,
          fromUserId: senderId,
          type: 'received'
        }]
      };

      // Aplica as atualizações
      transaction.update(senderRef, senderUpdate);
      transaction.update(receiverRef, receiverUpdate);
    });

    return true;
  } catch (error) {
    console.error('Erro no Firestore:', {
      message: error.message,
      stack: error.stack,
      senderId,
      receiverId,
      giftData
    });
    throw error;
  }
}
async function cleanDuplicateGifts() {
  const db = firebase.firestore();
  const users = await db.collection('users').get();
  const batch = db.batch();

  users.docs.forEach(userDoc => {
    const userData = userDoc.data();
    if (userData.gifts) {
      const cleanSent = removeDuplicates(userData.gifts.sent || [], 'transactionId');
      const cleanReceived = removeDuplicates(userData.gifts.received || [], 'transactionId');
      
      batch.update(userDoc.ref, {
        'gifts.sent': cleanSent,
        'gifts.received': cleanReceived
      });
    }
  });

  await batch.commit();
  console.log('Dados limpos com sucesso!');

  function removeDuplicates(array, key) {
    const seen = new Set();
    return array
      .filter(item => item[key])
      .filter(item => {
        const keyValue = item[key];
        return seen.has(keyValue) ? false : seen.add(keyValue);
      })
      .map(item => {
        // Padroniza para usar sempre giftId
        const { id, ...rest } = item;
        return id && !rest.giftId ? { ...rest, giftId: id } : rest;
      });
  }
}
let isSendingGift = false;

async function sendGift(giftId, direct = false) {
  try {
    // Debug inicial
    console.log('[sendGift] Iniciando processo, giftId:', giftId, 'direct:', direct);
    
    // Verificar autenticação
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Faça login para enviar presentes', 'error');
      console.log('[sendGift] Usuário não autenticado');
      return;
    }

    // Obter dados do presente com tratamento de erro
    console.log('[sendGift] Buscando presente no Firestore, ID:', giftId);
    const giftDoc = await db.collection('gifts').doc(giftId).get();
    
    if (!giftDoc.exists) {
      console.error('[sendGift] Presente não encontrado. ID:', giftId);
      
      // Debug adicional - listar alguns presentes existentes
      const sampleGifts = await db.collection('gifts').limit(3).get();
      console.log('[sendGift] Exemplos de IDs existentes:', 
        sampleGifts.docs.map(doc => doc.id));
      
      showToast('Presente não encontrado', 'error');
      return;
    }

    const gift = {
      id: giftDoc.id,
      ...giftDoc.data()
    };
    console.log('[sendGift] Presente encontrado:', gift);

    // Envio direto com pesquisa de usuário
    if (direct) {
      console.log('[sendGift] Modo envio direto ativado');
      
      // Passo 1: Pesquisar usuário
      const { value: searchTerm } = await Swal.fire({
        title: 'Enviar presente diretamente',
        input: 'text',
        inputLabel: 'Digite o nome do usuário',
        inputPlaceholder: 'Nome do destinatário...',
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) return 'Digite um nome para pesquisar!';
          if (value.length < 3) return 'Mínimo 3 caracteres';
        }
      });

      if (!searchTerm) {
        console.log('[sendGift] Pesquisa cancelada pelo usuário');
        return;
      }

      // Passo 2: Buscar usuários no Firestore
      console.log('[sendGift] Buscando usuários com termo:', searchTerm);
      showLoading('Buscando usuários...');
      
      const usersSnapshot = await db.collection('users')
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff')
        .limit(10)
        .get();

      hideLoading();

      if (usersSnapshot.empty) {
        console.log('[sendGift] Nenhum usuário encontrado para:', searchTerm);
        await Swal.fire('Nenhum resultado', 'Não encontramos usuários com esse nome', 'info');
        return;
      }

      // Passo 3: Selecionar usuário
      console.log('[sendGift] Usuários encontrados:', usersSnapshot.size);
      const usersOptions = usersSnapshot.docs.map(doc => {
        const user = doc.data();
        return `<option value="${doc.id}">${user.name} (${user.email || 'Sem email'})</option>`;
      });

      const { value: selectedUserId } = await Swal.fire({
        title: 'Selecione o destinatário',
        html: `
          <div style="margin: 15px 0;">
            <select id="userSelect" class="swal2-select" style="width: 100%; padding: 8px;">
              ${usersOptions.join('')}
            </select>
          </div>
          <p>Presente selecionado: <b>${gift.name}</b></p>
          ${gift.price > 0 ? `<p>Valor: ${formatCurrency(gift.price)}</p>` : ''}
        `,
        showCancelButton: true,
        confirmButtonText: 'Selecionar',
        preConfirm: () => document.getElementById('userSelect').value
      });

      if (!selectedUserId) {
        console.log('[sendGift] Seleção cancelada pelo usuário');
        return;
      }

      // Passo 4: Confirmar envio
      console.log('[sendGift] Usuário selecionado:', selectedUserId);
      const confirmation = await Swal.fire({
        title: 'Confirmar envio?',
        html: `
          <div style="text-align: left;">
            <p>Você está enviando:</p>
            <p><b>${gift.name}</b></p>
            ${gift.image ? `<img src="${gift.image}" style="max-width: 100px; max-height: 100px; margin: 10px 0;">` : ''}
            <p>Para: <b>${usersSnapshot.docs.find(d => d.id === selectedUserId).data().name}</b></p>
            ${gift.price > 0 ? `<p>Valor: <b>${formatCurrency(gift.price)}</b></p>` : ''}
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Envio',
        cancelButtonText: 'Cancelar'
      });

      if (confirmation.isConfirmed) {
        console.log('[sendGift] Confirmado, enviando presente...');
        await sendGiftToUser(selectedUserId, gift);
            await showGratitudeScreen(gift, receiverName);

      }
    } else {
      // Lógica para envio não-direto (se necessário)
      console.log('[sendGift] Envio padrão não implementado');
      showToast('Método de envio não disponível', 'info');
    }
  } catch (error) {
    console.error('[sendGift] Erro completo:', error);
    showToast(`Erro: ${error.message}`, 'error');
  }
}

// Função auxiliar para formatar moeda
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

async function saveGiftsSeparately(senderId, receiverId, sentGift, receivedGift) {
  const db = firebase.firestore();
  
  try {
    await db.runTransaction(async (transaction) => {
      // Verifica se a transação já existe
      const transactionRef = db.collection('giftTransactions').doc(sentGift.transactionId);
      if ((await transaction.get(transactionRef)).exists) {
        throw new Error('Esta transação já foi processada');
      }

      // Referências aos documentos
      const senderRef = db.collection('users').doc(senderId);
      const receiverRef = db.collection('users').doc(receiverId);

      // Atualiza APENAS o array 'sent' do remetente
      transaction.update(senderRef, {
        'gifts.sent': firebase.firestore.FieldValue.arrayUnion(sentGift)
      });

      // Atualiza APENAS o array 'received' do destinatário
      transaction.update(receiverRef, {
        'gifts.received': firebase.firestore.FieldValue.arrayUnion(receivedGift)
      });

      // Registra a transação
      transaction.set(transactionRef, {
        processedAt: new Date().toISOString(),
        senderId,
        receiverId,
        giftId: sentGift.giftId
      });
    });
  } catch (error) {
    console.error('Erro no Firestore:', {
      error: error.message,
      senderId,
      receiverId,
      sentGift,
      receivedGift
    });
    throw error;
  }
}
async function saveGiftTransaction(senderId, receiverId, giftData) {
  const db = firebase.firestore();
  
  try {
    await db.runTransaction(async (transaction) => {
      // Verifica se a transação já existe
      const transactionRef = db.collection('giftTransactions').doc(giftData.transactionId);
      if ((await transaction.get(transactionRef)).exists) {
        throw new Error('Esta transação já foi processada');
      }

      // Referências aos usuários
      const senderRef = db.collection('users').doc(senderId);
      const receiverRef = db.collection('users').doc(receiverId);

      // Cria objetos com estrutura consistente
      const senderGift = {
        ...giftData,
        type: 'sent',
        toUserId: receiverId
      };

      const receiverGift = {
        ...giftData,
        type: 'received',
        fromUserId: senderId
      };

      // Executa as operações
      transaction.set(transactionRef, {
        processedAt: new Date().toISOString(),
        senderId,
        receiverId
      });

      transaction.update(senderRef, {
        'gifts.sent': firebase.firestore.FieldValue.arrayUnion(senderGift)
      });

      transaction.update(receiverRef, {
        'gifts.received': firebase.firestore.FieldValue.arrayUnion(receiverGift)
      });
    });
  } catch (error) {
    console.error('Erro no Firestore:', error);
    throw error;
  }
}
async function executeGiftTransaction(senderId, receiverId, giftData) {
  const db = firebase.firestore();
  const batch = db.batch();
  
  // Referências aos documentos
  const senderRef = db.collection('users').doc(senderId);
  const receiverRef = db.collection('users').doc(receiverId);
  const transactionRef = db.collection('giftTransactions').doc(giftData.transactionId);

  // Objetos com estrutura idêntica (exceto pelos campos type/to/from)
  const senderGift = {
    ...giftData,
    type: 'sent',
    toUserId: receiverId
  };

  const receiverGift = {
    ...giftData,
    type: 'received',
    fromUserId: senderId
  };

  // Garante que todos os campos sejam iguais exceto os específicos
  delete senderGift.toUserId;
  delete receiverGift.fromUserId;

  // Operações em lote
  batch.set(transactionRef, {
    ...giftData,
    processedAt: new Date().toISOString(),
    senderId,
    receiverId
  });

  batch.update(senderRef, {
    'gifts.sent': firebase.firestore.FieldValue.arrayUnion(senderGift)
  });

  batch.update(receiverRef, {
    'gifts.received': firebase.firestore.FieldValue.arrayUnion(receiverGift)
  });

  await batch.commit();
}

// Funções para controle de modais
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restaura o scroll da página
  }
}

function closeAllModals() {
  // Fecha todos os modais que tenham a classe 'lux-modal'
  document.querySelectorAll('.lux-modal').forEach(modal => {
    modal.style.display = 'none';
  });
  document.body.style.overflow = 'auto';
}

// Funções auxiliares (já existentes no seu código)
function showLoading(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

function hideLoading() {
  Swal.close();
}


function closeAllGiftModals() {
  document.querySelectorAll('.gift-modal').forEach(modal => {
    modal.style.display = 'none';
  });
  document.body.style.overflow = 'auto';
}

// Função para limpar duplicatas existentes (executar uma vez)
async function cleanExistingDuplicates() {
  const db = firebase.firestore();
  const users = await db.collection('users').get();

  const batch = db.batch();
  const transactionBatch = db.batch();

  users.forEach(userDoc => {
    const userData = userDoc.data();
    if (userData.gifts) {
      // Processa presentes enviados
      const uniqueSent = removeDuplicates(userData.gifts.sent, 'transactionId');
      // Processa presentes recebidos
      const uniqueReceived = removeDuplicates(userData.gifts.received, 'transactionId');
      
      if (uniqueSent.length !== userData.gifts.sent?.length || 
          uniqueReceived.length !== userData.gifts.received?.length) {
        batch.update(userDoc.ref, {
          'gifts.sent': uniqueSent,
          'gifts.received': uniqueReceived
        });
      }
    }
  });

  await batch.commit();
  console.log('Duplicatas removidas com sucesso!');

  function removeDuplicates(array, key) {
    if (!array) return [];
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      return seen.has(value) ? false : seen.add(value);
    });
  }
}
async function sendGiftWithVerification(senderId, receiverId, baseGiftData) {
  const db = firebase.firestore();
  
  // Verifica se já existe uma transação com esse ID
  const transactionRef = db.collection('giftTransactions').doc(baseGiftData.transactionId);
  const transactionExists = (await transactionRef.get()).exists;

  if (transactionExists) {
    throw new Error('Esta transação já foi processada');
  }

  await db.runTransaction(async (transaction) => {
    // Primeiro marca a transação como processada
    transaction.set(transactionRef, {
      processedAt: new Date().toISOString(),
      senderId,
      receiverId,
      giftId: baseGiftData.giftId
    });

    // Referências aos usuários
    const senderRef = db.collection('users').doc(senderId);
    const receiverRef = db.collection('users').doc(receiverId);

    // Dados específicos para cada usuário
    const senderGift = {
      ...baseGiftData,
      type: 'sent',
      toUserId: receiverId
    };

    const receiverGift = {
      ...baseGiftData,
      type: 'received',
      fromUserId: senderId
    };

    // Atualiza os documentos
    transaction.update(senderRef, {
      'gifts.sent': firebase.firestore.FieldValue.arrayUnion(senderGift)
    });

    transaction.update(receiverRef, {
      'gifts.received': firebase.firestore.FieldValue.arrayUnion(receiverGift)
    });
  });
}


async function checkIfGiftExists(senderId, receiverId, giftId) {
  const db = firebase.firestore();
  
  // Verifica no remetente
  const senderDoc = await db.collection('users').doc(senderId).get();
  const sentGifts = senderDoc.data()?.gifts?.sent || [];
  const existsInSent = sentGifts.some(gift => gift.giftId === giftId);

  // Verifica no destinatário
  const receiverDoc = await db.collection('users').doc(receiverId).get();
  const receivedGifts = receiverDoc.data()?.gifts?.received || [];
  const existsInReceived = receivedGifts.some(gift => gift.giftId === giftId);

  return existsInSent || existsInReceived;
}
// Ação: Adicionar à lista de desejos
async function addToWishlist(gift) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Faça login para continuar');
    
    await firebase.firestore().collection('users').doc(user.uid).update({
      wishlist: firebase.firestore.FieldValue.arrayUnion({
        giftId: gift.id,
        name: gift.name,
        image: gift.image,
        price: gift.price,
        addedAt: new Date().toISOString()
      })
    });
    
    showToast('Presente adicionado à sua lista de desejos!', 'success');
    actionsModal.classList.add('hidden');
  } catch (error) {
    console.error('Erro ao adicionar à lista:', error);
    showToast(error.message, 'error');
  }
}

// Adicione isso após a criação do modal ou no DOMContentLoaded
document.querySelector('.lux-action-customize').addEventListener('click', function() {
  console.log("Botão Personalizar clicado!"); // Verifique se aparece no console
  document.querySelector('.lux-gift-actions').style.display = 'none';
  document.getElementById('customizeSection').style.display = 'block';
});


// Personalizar presente
function customizeGift(gift) {
  const modal = document.getElementById('customizeGiftModal');
  
  // Preenche os dados
  document.getElementById('customizeGiftName').textContent = gift.name;
  document.getElementById('customGiftImage').src = gift.image;
  
  // Configura o formulário
  document.getElementById('customGiftForm').onsubmit = async (e) => {
    e.preventDefault();
    const message = document.getElementById('giftMessage').value;
    const isPublic = document.getElementById('giftPublic').checked;
    
    // Adiciona os dados extras ao presente
    selectedGift.message = message;
    selectedGift.isPublic = isPublic;
    
    // Agora envia com as personalizações
    await sendGiftToUser(selectedUserId, selectedGift);
    modal.style.display = 'none';
  };
  
  // Mostra o modal
  modal.style.display = 'block';
}

// Agendar entrega
function scheduleGiftDelivery(userId, gift) {
  const modal = document.getElementById('scheduleGiftModal');
  
  // Inicializa o datepicker (exemplo usando flatpickr)
  flatpickr("#deliveryDate", {
    minDate: "today",
    dateFormat: "d/m/Y",
    locale: "pt" // Configuração para português
  });
  
  // Configura o formulário
  document.getElementById('scheduleGiftForm').onsubmit = async (e) => {
    e.preventDefault();
    const deliveryDate = document.getElementById('deliveryDate').value;
    const deliveryMessage = document.getElementById('deliveryMessage').value;
    
    // Adiciona os dados de agendamento
    selectedGift.scheduledDate = deliveryDate;
    selectedGift.deliveryMessage = deliveryMessage;
    selectedGift.status = 'scheduled';
    
    // Envia o presente agendado
    await sendGiftToUser(userId, selectedGift);
    modal.style.display = 'none';
  };
  
  // Mostra o modal
  modal.style.display = 'block';
}

// Mostrar loading
function showLoading(message) {
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'lux-loading';
  loadingDiv.innerHTML = `
    <div class="lux-loading-overlay">
      <div class="lux-loading-content">
        <i class="fas fa-spinner fa-spin"></i>
        <p>${message}</p>
      </div>
    </div>
  `;
  document.body.appendChild(loadingDiv);
}

// Esconder loading
function hideLoading() {
  const loading = document.getElementById('lux-loading');
  if (loading) loading.remove();
}

// Mostrar toast notification
async function sendGift(giftId, direct = false) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      showToast('Faça login para enviar presentes', 'error');
      return;
    }

    // Obter dados do presente
    const giftDoc = await db.collection('gifts').doc(giftId).get();
    if (!giftDoc.exists) {
      showToast('Presente não encontrado', 'error');
      return;
    }
    const gift = giftDoc.data();

    if (direct) {
      // Implementação da pesquisa de usuário
      const { value: searchTerm } = await Swal.fire({
        title: 'Enviar presente diretamente',
        input: 'text',
        inputLabel: 'Digite o nome do usuário',
        inputPlaceholder: 'Nome do destinatário...',
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value) {
            return 'Você precisa digitar um nome!';
          }
        }
      });

      if (searchTerm) {
        // Busca usuários
        const usersSnapshot = await db.collection('users')
          .where('name', '>=', searchTerm)
          .where('name', '<=', searchTerm + '\uf8ff')
          .limit(10)
          .get();

        if (usersSnapshot.empty) {
          Swal.fire('Nenhum usuário encontrado', 'Tente outro nome', 'info');
          return;
        }

        // Preparar opções
        const usersOptions = usersSnapshot.docs.map(doc => {
          const user = doc.data();
          return `<option value="${doc.id}">${user.name} (${user.email || 'Sem email'})</option>`;
        });

        // Selecionar usuário
        const { value: selectedUserId } = await Swal.fire({
          title: 'Selecione o destinatário',
          html: `<select id="userSelect" class="swal2-select">
            ${usersOptions.join('')}
          </select>`,
          focusConfirm: false,
          preConfirm: () => {
            return document.getElementById('userSelect').value;
          }
        });

        if (selectedUserId) {
          // Confirmar envio
          const confirmation = await Swal.fire({
            title: 'Confirmar envio?',
            html: `Você está enviando <b>${gift.name}</b> para o usuário selecionado`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Confirmar envio'
          });

          if (confirmation.isConfirmed) {
            await sendGiftToUser(selectedUserId, gift);
          }
        }
      }
    } else {
      // Lógica para envio não-direto (se aplicável)
      // ...
    }
  } catch (error) {
    console.error('Erro ao enviar presente:', error);
    showToast(`Erro: ${error.message}`, 'error');
  }
}

// Funções auxiliares (já existentes no seu código)
function showLoading(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

function hideLoading() {
  Swal.close();
}

function showToast(message, type) {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });
  
  Toast.fire({
    icon: type,
    title: message
  });
}
async function addToWishlist(userId, giftData) {
  try {
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .update({
        'gifts.wishlist': firebase.firestore.FieldValue.arrayUnion({
          ...giftData,
          giftId: firebase.firestore().collection('gifts').doc().id,
          addedDate: new Date().toISOString()
        })
      });
    
    console.log('Presente adicionado à lista de desejos!');
    return true;
  } catch (error) {
    console.error('Erro ao adicionar à lista de desejos:', error);
    return false;
  }
}

async function removeFromWishlist(userId, giftId) {
  try {
    const userDoc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado');
    }
    
    const wishlist = userDoc.data().gifts?.wishlist || [];
    const updatedWishlist = wishlist.filter(gift => gift.giftId !== giftId);
    
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .update({
        'gifts.wishlist': updatedWishlist
      });
    
    console.log('Presente removido da lista de desejos!');
    return true;
  } catch (error) {
    console.error('Erro ao remover da lista de desejos:', error);
    return false;
  }
}


// Variáveis globais

// Elementos DOM

const categoryButtons = document.querySelectorAll('.lux-category-btn');
const actionsModal = document.getElementById('giftActionsModal');
const closeActionsBtn = document.querySelector('.lux-actions-close');


// Variáveis globais
let availableGifts = [];

// Elementos DOM
const giftShopBtn = document.getElementById('openGiftShopBtn');
const giftShopSection = document.getElementById('giftShopSection');
const closeShopBtn = document.querySelector('.lux-close-shop');
const giftsContainer = document.querySelector('#giftShopSection .lux-gifts-container');

// Evento para abrir a loja
giftShopBtn.addEventListener('click', openGiftShop);


// Variável global para os presentes
let shopGifts = [];
// Função para criar o menu de contexto dinamicamente
function createContextMenu(giftId) {
  const menu = document.createElement('div');
  menu.className = 'gift-context-menu';
  menu.id = `menu-${giftId}`;
  
  // Botões de ação
  const actions = [
    { action: 'send', text: 'Enviar presente' },
    { action: 'customize', text: 'Personalizar' },
    { action: 'details', text: 'Detalhes' }
  ];
  
  actions.forEach(item => {
    const button = document.createElement('button');
    button.textContent = item.text;
    button.setAttribute('data-action', item.action);
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      handleGiftAction(item.action, giftId);
    });
    menu.appendChild(button);
  });
  
  return menu;
}

// Configura os eventos dos cartões (versão atualizada)
function setupShopGiftCards() {
  // Remove event listeners antigos para evitar duplicação
  document.removeEventListener('click', handleDocumentClick);
  document.querySelectorAll('.lux-gift-card').forEach(card => {
    card.removeEventListener('click', handleCardClick);
  });

  // Fecha menus ao clicar em qualquer lugar
  document.addEventListener('click', handleDocumentClick);

  // Configura os eventos para cada card
  document.querySelectorAll('.lux-gift-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });
}

function handleDocumentClick(e) {
  if (!e.target.closest('.lux-gift-card') && !e.target.closest('.gift-context-menu')) {
    document.querySelectorAll('.gift-context-menu').forEach(menu => {
      menu.remove(); // Remove os menus em vez de apenas esconder
    });
  }
}

function handleCardClick(e) {
  const card = e.currentTarget;
  const giftId = card.getAttribute('data-id');
  
  // Impede a abertura se clicar em um botão de ação
  if (e.target.hasAttribute('data-action')) return;
  
  // Remove outros menus abertos
  document.querySelectorAll('.gift-context-menu').forEach(menu => {
    menu.remove();
  });
  
  // Cria e posiciona o novo menu
  const menu = createContextMenu(giftId);
  card.appendChild(menu);
  
  // Posiciona o menu corretamente (opcional)
  positionMenu(menu, card);
}

// Função auxiliar para posicionar o menu (opcional)
function positionMenu(menu, card) {
  const cardRect = card.getBoundingClientRect();
  menu.style.position = 'absolute';
  menu.style.top = `${cardRect.height}px`;
  menu.style.left = '50%';
  menu.style.transform = 'translateX(-50%)';
}

// Carrega os presentes da loja
async function loadShopGifts() {
  const container = document.querySelector('#giftShopSection .lux-gifts-container');
  
  try {
    // Mostra loading
    container.innerHTML = `
      <div class="lux-gifts-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Carregando nossa seleção exclusiva...</p>
      </div>
    `;
    
    // Busca os presentes
    const gifts = await fetchAvailableGifts();
    shopGifts = gifts;
    
    // Exibe os presentes
    displayShopGifts(gifts);
    
  } catch (error) {
    console.error("Erro ao carregar loja:", error);
    container.innerHTML = `
      <div class="lux-no-gifts">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar a loja</p>
      </div>
    `;
  }
}

// Exibe os presentes na loja
function displayShopGifts(gifts) {
  const container = document.querySelector('#giftShopSection .lux-gifts-container');
  
  if (!gifts || gifts.length === 0) {
    container.innerHTML = `
      <div class="lux-no-gifts">
        <i class="fas fa-gift"></i>
        <p>Nenhum presente disponível no momento</p>
      </div>
    `;
    return;
  }

  // Cria uma string HTML com todos os presentes
  let giftsHTML = '<div class="lux-gifts-grid">';
  
  gifts.forEach(gift => {
    giftsHTML += `
      <div class="lux-gift-card" data-id="${gift.id}">
        <div class="lux-gift-image-container">
          <img src="${gift.image || defaultGiftImage}" 
               alt="${gift.name}" 
               class="lux-gift-image"
               onerror="this.src='${defaultGiftImage}'">
        </div>
        <div class="lux-gift-info">
          <h3>${gift.name}</h3>
          <p>${formatCurrency(gift.price)}</p>
        </div>
      </div>
    `;
  });

  giftsHTML += '</div>';
  
  // Insere no container de uma só vez
  container.innerHTML = giftsHTML;
  
  // Configura os eventos de clique
  setupShopGiftCards();
}
// Inicialização
document.addEventListener('DOMContentLoaded', function() {
  // Configura o botão da loja
  document.getElementById('openGiftShopBtn').addEventListener('click', openGiftShop);
  
  // Verifica se há parâmetros na URL para abrir automaticamente
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('showGiftShop') === 'true') {
    openGiftShop();
  }
});

// Abrir loja
giftShopBtn.addEventListener('click', () => {
  giftShopSection.classList.remove('hidden');
  loadGifts();
});

// Fechar loja
closeShopBtn.addEventListener('click', () => {
  giftShopSection.classList.add('hidden');
});

// Fechar modal de ações
closeActionsBtn.addEventListener('click', () => {
  actionsModal.classList.add('hidden');
});

// Filtro por categoria
categoryButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadGifts(btn.dataset.category);
  });
});



async function updateGiftStatus(userId, giftId, newStatus, isReceived = false) {
  try {
    const userDoc = await firebase.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado');
    }
    
    const field = isReceived ? 'received' : 'sent';
    const gifts = userDoc.data().gifts?.[field] || [];
    const updatedGifts = gifts.map(gift => {
      if (gift.giftId === giftId) {
        return { ...gift, status: newStatus };
      }
      return gift;
    });
    
    await firebase.firestore()
      .collection('users')
      .doc(userId)
      .update({
        [`gifts.${field}`]: updatedGifts
      });
    
    console.log(`Status do presente atualizado para ${newStatus}!`);
    return true;
  } catch (error) {
    console.error('Erro ao atualizar status do presente:', error);
    return false;
  }
}






// Configura filtros de categoria
document.querySelectorAll('.lux-gift-category').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.lux-gift-category').forEach(btn => 
      btn.classList.remove('active'));
    button.classList.add('active');
    loadGifts(button.dataset.category);
  });
});

// Fecha com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('giftActionsModal').style.display === 'block') {
      closeGiftActions();
    } else {
      closeGiftModal();
    }
  }
});





// Adicione esta função no seu arquivo de autenticação
async function checkForNewGifts(userId) {
  try {
    const giftsSnapshot = await db.collection('gifts')
      .where('receiverId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    return !giftsSnapshot.empty;
  } catch (error) {
    console.error("Erro ao verificar presentes:", error);
    return false;
  }
}


async function updateGiftsStatus(userId, gifts) {
  const db = firebase.firestore();
  const batch = db.batch();
  const userRef = db.collection('users').doc(userId);

  // Obtém os dados atuais
  const userDoc = await userRef.get();
  const currentGifts = userDoc.data().gifts?.received || [];

  // Atualiza apenas os presentes pendentes
  const updatedGifts = currentGifts.map(gift => {
    const isPending = gifts.some(g => g.id === gift.id && gift.status === 'pending');
    return isPending ? { ...gift, status: 'received' } : gift;
  });

  batch.update(userRef, {
    'gifts.received': updatedGifts
  });

  await batch.commit();
}

function showGiftNotification(gifts) {
  // Cria o elemento de notificação
  const notification = document.createElement('div');
  notification.className = 'gift-notification';
  
  // Conteúdo da notificação
  notification.innerHTML = `
    <div class="gift-notification-content">
      <div class="gift-notification-icon">
        <i class="fas fa-gift fa-shake"></i>
      </div>
      <div class="gift-notification-text">
        Você tem ${gifts.length} novo(s) presente(s)!
      </div>
      <button class="gift-notification-close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  // Adiciona ao corpo do documento
  document.body.appendChild(notification);

  // Fecha a notificação após 5 segundos ou quando clicar
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 5000);

  notification.querySelector('.gift-notification-close').addEventListener('click', () => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  });

  // Animação de confetes
  if (gifts.length > 0) {
    launchConfetti();
  }
}
function launchConfetti() {
  // Verifica se a biblioteca está disponível
  if (typeof confetti === 'undefined') {
    console.warn('Biblioteca de confetes não carregada');
    return;
  }

  // Configuração dos confetes
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    spread: 90,
    ticks: 100,
    gravity: 1,
    decay: 0.94,
    startVelocity: 30,
    colors: ['#ffd700', '#ff0000', '#00ff00', '#0000ff', '#ffffff']
  };

  // Dispara confetes
  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  // Efeitos diferentes
  fire(0.25, { angle: 55, spread: 55 });
  fire(0.2, { angle: 125, spread: 55 });
  fire(0.35, { angle: 90, spread: 100, scalar: 0.8 });
  fire(0.1, { angle: 45, spread: 120, startVelocity: 45 });
  fire(0.1, { angle: 135, spread: 120, startVelocity: 45 });
}
// Função para atualizar o badge
// Formatar data
function formatDate(dateString) {
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
}

// Notificar o remetente
async function notifySender(senderId, giftId) {
  try {
    const senderRef = firebase.firestore().collection('users').doc(senderId);
    await senderRef.update({
      notifications: firebase.firestore.FieldValue.arrayUnion({
        type: 'gift-accepted',
        giftId,
        date: new Date().toISOString(),
        read: false
      })
    });
  } catch (error) {
    console.error('Erro ao notificar remetente:', error);
  }
}

// Atualizar badge de novos presentes
function updateGiftBadge(unviewedCount) {
  const badge = document.querySelector('.gifts-badge');
  if (badge) {
    badge.textContent = unviewedCount > 0 ? unviewedCount : '';
    badge.style.display = unviewedCount > 0 ? 'flex' : 'none';
  }
}

// Animação para o badge
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .pulse {
    animation: pulse 1s infinite;
  }
`;
document.head.appendChild(style);

function formatGiftDate(timestamp) {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleDateString('pt-BR');
}


function openGiftsSection() {
  console.log("Abrindo seção de presentes...");
  const giftsSection = document.getElementById('gifts-section');
  
  // Remove todas as classes que podem estar interferindo
  giftsSection.className = 'lux-gifts-section';
  
  // Aplica estilos diretamente
  giftsSection.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 9999;
    display: block;
    overflow-y: auto;
    padding: 20px;
  `;
  
  // Força o redesenho
  void giftsSection.offsetWidth;
  
  document.body.style.overflow = 'hidden';
  loadUserGifts();
  
  // Debug visual
  giftsSection.style.border = '2px solid red'; // Remova depois de testar
}



// Função para fechar a seção
function closeGiftsSection() {
  document.getElementById('gifts-section').style.display = 'none';
  document.body.style.overflow = 'auto';
}


// Variáveis globais
let userGifts = [];
let giftsSectionVisible = false;

// Função para alternar a visibilidade da seção
function toggleGiftsSection() {
  const section = document.querySelector('.my-gifts-section');
  giftsSectionVisible = !giftsSectionVisible;
  
  if (giftsSectionVisible) {
    section.classList.remove('hidden');
    loadUserGifts(); // Carrega os presentes quando aberto
  } else {
    section.classList.add('hidden');
  }
  
  // Adiciona rolagem suave
  if (giftsSectionVisible) {
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}

// Configura o clique no ícone
document.querySelector('.gift-icon').addEventListener('click', toggleGiftsSection);


async function loadUserGifts() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    showLoading('Carregando seus presentes exclusivos...');
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const giftsData = userDoc.data()?.gifts || {};
      const receivedGifts = giftsData.received || [];
      
      // Atualizar status não visualizados
      const updatedGifts = receivedGifts.map(gift => ({
        ...gift,
        viewed: gift.viewed || false,
        accepted: gift.accepted || false,
        acceptedDate: gift.acceptedDate || null
      }));
      
      // Atualizar no Firestore se houver mudanças
      if (JSON.stringify(receivedGifts) !== JSON.stringify(updatedGifts)) {
        await userRef.update({
          'gifts.received': updatedGifts
        });
      }
      
      updateGiftBadge(updatedGifts.filter(g => !g.viewed).length);
      renderGiftsUI(updatedGifts);
    }
  } catch (error) {
    console.error('Erro ao carregar presentes:', error);
    showToast('Erro ao carregar seus presentes', 'error');
  } finally {
    hideLoading();
  }
}
function renderGiftsUI(gifts) {
  const container = document.querySelector('.gifts-container');
  if (!gifts.length) {
    container.innerHTML = `
      <div class="no-gifts">
        <i class="fas fa-gift"></i>
        <p>Nenhum presente recebido ainda</p>
      </div>
    `;
    return;
  }

  // Calcular totais
  const acceptedGifts = gifts.filter(g => g.status === 'accepted');
  const totalValue = acceptedGifts.reduce((sum, gift) => sum + (gift.price || 0), 0);
  
  document.querySelector('.total-gifts').textContent = `${gifts.length} ${gifts.length === 1 ? 'presente' : 'presentes'}`;
  document.querySelector('.total-value').textContent = `Total: ${formatCurrency(totalValue)}`;

  // Renderizar cada presente
  container.innerHTML = gifts.map(gift => `
    <div class="gift-item ${gift.status}" data-gift-id="${gift.giftId}">
      <div class="gift-image-container">
        <div class="gift-image" style="background-image: url('${gift.image || 'default-gift.jpg'}')"></div>
        ${!gift.viewed ? '<div class="new-badge">Novo</div>' : ''}
      </div>
      
      <div class="gift-details">
        <h3>${gift.name}</h3>
        <p class="gift-from">De: ${gift.fromUserName || 'Anônimo'}</p>
        ${gift.price ? `<p class="gift-price">${formatCurrency(gift.price)}</p>` : ''}
        <p class="gift-date">Recebido em: ${formatDate(gift.date)}</p>
        
        <div class="gift-actions">
          ${gift.status === 'pending' ? `
            <button class="btn-accept-gift" data-gift-id="${gift.giftId}">
              <i class="fas fa-check-circle"></i> Aceitar Presente
            </button>
            <button class="btn-decline-gift" data-gift-id="${gift.giftId}">
              <i class="fas fa-times-circle"></i> Recusar
            </button>
          ` : gift.status === 'accepted' ? `
            <div class="accepted-info">
              <div class="accepted-badge">
                <i class="fas fa-check"></i> Aceito em ${formatDate(gift.acceptedDate)}
              </div>
              ${gift.thankYouNote ? `
                <div class="thank-you-note">
                  <p><strong>Agradecimento:</strong> ${gift.thankYouNote}</p>
                  ${gift.thankYouImage ? `
                    <div class="thank-you-image">
                      <img src="${gift.thankYouImage}" alt="Imagem de agradecimento">
                    </div>
                  ` : ''}
                </div>
              ` : `
                <button class="btn-thank-you" data-gift-id="${gift.giftId}">
                  <i class="fas fa-heart"></i> Enviar Agradecimento
                </button>
              `}
            </div>
          ` : `
            <div class="declined-info">
              <div class="declined-badge">
                <i class="fas fa-times"></i> Recusado
              </div>
              ${gift.declineMessage ? `
                <div class="decline-message">
                  <p><strong>Mensagem:</strong> ${gift.declineMessage}</p>
                </div>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    </div>
  `).join('');

  // Adicionar event listeners
  setupGiftEventListeners();
}

function setupGiftEventListeners() {
  // Aceitar presente
  document.querySelectorAll('.btn-accept-gift').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.giftId;
      await handleGiftAction(giftId, 'accept');
    });
  });

  // Recusar presente
  document.querySelectorAll('.btn-decline-gift').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.giftId;
      await showDeclineModal(giftId);
    });
  });

  // Agradecimento
  document.querySelectorAll('.btn-thank-you').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.giftId;
      await showThankYouModal(giftId);
    });
  });
}



// Modal para recusar presente
async function showDeclineModal(giftId) {
  const { value: formValues } = await Swal.fire({
    title: 'Recusar Presente',
    html:
      '<textarea id="decline-message" class="swal2-textarea" placeholder="Digite uma mensagem para o remetente (opcional)"></textarea>' +
      '<input type="file" id="decline-image" class="swal2-file" accept="image/*">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Confirmar Recusa',
    cancelButtonText: 'Cancelar',
    preConfirm: async () => {
      const message = document.getElementById('decline-message').value;
      const fileInput = document.getElementById('decline-image');
      
      let imageUrl = null;
      if (fileInput.files.length > 0) {
        imageUrl = await uploadImage(fileInput.files[0]);
      }
      
      return { message, imageUrl };
    }
  });

  if (formValues) {
    await handleGiftAction(giftId, 'decline', formValues.message, formValues.imageUrl);
  }
}

// Modal para agradecimento
async function showThankYouModal(giftId) {
  const { value: formValues } = await Swal.fire({
    title: 'Enviar Agradecimento',
    html:
      '<textarea id="thank-you-note" class="swal2-textarea" placeholder="Digite sua mensagem de agradecimento"></textarea>' +
      '<input type="file" id="thank-you-image" class="swal2-file" accept="image/*">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Enviar Agradecimento',
    cancelButtonText: 'Cancelar',
    preConfirm: async () => {
      const note = document.getElementById('thank-you-note').value;
      const fileInput = document.getElementById('thank-you-image');
      
      let imageUrl = null;
      if (fileInput.files.length > 0) {
        imageUrl = await uploadImage(fileInput.files[0]);
      }
      
      return { note, imageUrl };
    }
  });

  if (formValues) {
    await sendThankYouNote(giftId, formValues.note, formValues.imageUrl);
  }
}

// Função para enviar agradecimento
async function sendThankYouNote(giftId, note, imageUrl) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    showLoading('Enviando agradecimento...');
    
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const receivedGifts = userDoc.data()?.gifts?.received || [];
    
    const giftIndex = receivedGifts.findIndex(g => g.giftId === giftId);
    if (giftIndex === -1) throw new Error('Presente não encontrado');

    const updatedGifts = [...receivedGifts];
    updatedGifts[giftIndex] = {
      ...updatedGifts[giftIndex],
      thankYouNote: note,
      thankYouImage: imageUrl || null
    };

    await userRef.update({
      'gifts.received': updatedGifts
    });

    // Atualizar na transação
    const transactionQuery = await db.collection('giftTransactions')
      .where('giftId', '==', giftId)
      .limit(1)
      .get();

    if (!transactionQuery.empty) {
      const transactionRef = transactionQuery.docs[0].ref;
      await transactionRef.update({
        thankYouNote: note,
        thankYouImage: imageUrl || null
      });
    }

    // Notificar o remetente
    const giftData = updatedGifts[giftIndex];
    if (giftData.fromUserId) {
      await notifySender(
        giftData.fromUserId, 
        giftId, 
        'thank_you',
        `Recebeu um agradecimento pelo presente: ${note}`,
        imageUrl
      );
    }

    showToast('Agradecimento enviado com sucesso!', 'success');
    loadUserGifts();

  } catch (error) {
    console.error('Erro ao enviar agradecimento:', error);
    showToast('Erro ao enviar agradecimento', 'error');
  } finally {
    hideLoading();
  }
}

// Função para upload de imagem
async function uploadImage(file) {
  try {
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`thankYouImages/${Date.now()}_${file.name}`);
    await fileRef.put(file);
    return await fileRef.getDownloadURL();
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    return null;
  }
}

async function handleGiftAction(giftId, action, message = null, imageUrl = null) {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    showLoading(action === 'accept' ? 'Processando presente...' : 'Recusando presente...');
    
    // 1. Atualizar no documento do usuário RECEPTOR
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const receivedGifts = userDoc.data()?.gifts?.received || [];
    
    const giftIndex = receivedGifts.findIndex(g => g.giftId === giftId);
    if (giftIndex === -1) throw new Error('Presente não encontrado');

    const updatedGifts = [...receivedGifts];
    updatedGifts[giftIndex] = {
      ...updatedGifts[giftIndex],
      status: action === 'accept' ? 'accepted' : 'declined',
      acceptedDate: action === 'accept' ? new Date().toISOString() : null,
      viewed: true,
      ...(action === 'decline' && {
        declineMessage: message,
        declineImage: imageUrl
      })
    };

    await userRef.update({
      'gifts.received': updatedGifts
    });

    // 2. Atualizar na coleção de transações
    const transactionQuery = await db.collection('giftTransactions')
      .where('giftId', '==', giftId)
      .limit(1)
      .get();

    if (!transactionQuery.empty) {
      const transactionRef = transactionQuery.docs[0].ref;
      await transactionRef.update({
        status: action === 'accept' ? 'accepted' : 'declined',
        acceptedDate: action === 'accept' ? new Date().toISOString() : null,
        viewed: true,
        ...(action === 'decline' && {
          declineMessage: message,
          declineImage: imageUrl
        })
      });
    }

    // 3. Atualizar no documento do usuário REMETENTE
    const giftData = updatedGifts[giftIndex];
    if (giftData.fromUserId) {
      const senderRef = db.collection('users').doc(giftData.fromUserId);
      const senderDoc = await senderRef.get();
      const sentGifts = senderDoc.data()?.gifts?.sent || [];
      
      const sentGiftIndex = sentGifts.findIndex(g => g.giftId === giftId);
      if (sentGiftIndex !== -1) {
        const updatedSentGifts = [...sentGifts];
        updatedSentGifts[sentGiftIndex] = {
          ...updatedSentGifts[sentGiftIndex],
          status: action === 'accept' ? 'accepted' : 'declined',
          ...(action === 'decline' && {
            declineMessage: message,
            declineImage: imageUrl
          })
        };
        
        await senderRef.update({
          'gifts.sent': updatedSentGifts
        });
      }
    }

    showToast(`Presente ${action === 'accept' ? 'aceito' : 'recusado'} com sucesso!`, 'success');
    loadUserGifts();

    // 4. Notificar o remetente
    if (giftData.fromUserId) {
      await notifySender(
        giftData.fromUserId, 
        giftId, 
        action === 'accept' ? 'accepted' : 'declined',
        action === 'accept' 
          ? 'Seu presente foi aceito!' 
          : message || 'Seu presente foi recusado',
        action === 'decline' ? imageUrl : null
      );
    }

  } catch (error) {
    console.error(`Erro ao ${action} presente:`, error);
    showToast(`Erro: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function notifySender(senderId, giftId, action) {
  try {
    const notificationRef = db.collection('notifications').doc();
    await notificationRef.set({
      userId: senderId,
      type: 'gift-' + action,
      giftId: giftId,
      date: new Date().toISOString(),
      read: false,
      message: `Seu presente foi ${action === 'accepted' ? 'aceito' : 'recusado'}`
    });
  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}
// Listener em tempo real para novos presentes
function setupGiftsListener() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  return firebase.firestore().collection('users').doc(user.uid)
    .onSnapshot(doc => {
      if (doc.exists) {
        const newGifts = doc.data()?.gifts?.received || [];
        const newUnviewed = newGifts.filter(gift => !gift.viewed).length;
        
        if (newUnviewed > 0 && !giftsSectionVisible) {
          // Mostra notificação se houver novos presentes
          showNewGiftsNotification(newUnviewed);
        }
        
        userGifts = newGifts;
        updateGiftBadge();
        
        if (giftsSectionVisible) {
          updateGiftsUI();
        }
      }
    });
}

// Mostra notificação de novos presentes
function showNewGiftsNotification(count) {
  const notification = document.createElement('div');
  notification.className = 'gift-notification';
  notification.innerHTML = `
    <span>Você tem ${count} novo(s) presente(s)!</span>
    <button onclick="toggleGiftsSection()">Ver</button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.bottom = '20px';
  }, 100);
  
  setTimeout(() => {
    notification.style.bottom = '-100px';
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// CSS para a notificação
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
  .gift-notification {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: -100px;
    background: #e91e63;
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    transition: bottom 0.3s ease;
  }
  
  .gift-notification button {
    background: white;
    color: #e91e63;
    border: none;
    padding: 5px 15px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
  }
`;
document.head.appendChild(notificationStyle);

// Inicialização
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    setupGiftsListener();
  }
});
async function updateGiftsUI(filter = 'all') {
  const container = document.querySelector('.gifts-container');
  if (!container) return;

  // Mostra loading enquanto carrega
  container.innerHTML = '<div class="loading-gifts"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

  try {
    // Verifica se userGifts existe e é um array
    if (!Array.isArray(userGifts)) {
      console.error('userGifts não é um array:', userGifts);
      userGifts = [];
    }

    // Filtra os presentes (com verificação de categoria)
    const filteredGifts = filter === 'all' 
      ? [...userGifts] 
      : userGifts.filter(gift => {
          // Verifica se gift e gift.category existem
          return gift && gift.category && gift.category === filter;
        });

    console.log('Presentes filtrados:', filteredGifts); // Debug

    // Atualiza o resumo
    updateGiftsSummary(filteredGifts);

    if (filteredGifts.length === 0) {
      container.innerHTML = `
        <div class="no-gifts">
          <i class="fas fa-gift"></i>
          ${filter !== 'all' ? `<button onclick="updateGiftsUI('all')" class="reset-filter">
            Ver todos os presentes
          </button>` : ''}
        </div>
      `;
      return;
    }

    // Ordena por data (usa createdAt se date não existir)
    const sortedGifts = [...filteredGifts].sort((a, b) => {
      const dateA = a.date || a.createdAt;
      const dateB = b.date || b.createdAt;
      return new Date(dateB) - new Date(dateA);
    });

    // Busca todos os nomes de uma vez (com tratamento de erro)
    const giftsWithNames = await Promise.all(
      sortedGifts.map(async gift => {
        try {
          const fromUserName = gift.fromUserName || 
                             (gift.fromUserId ? await getUserName(gift.fromUserId) : 'Anônimo');
          return { 
            ...gift,
            fromUserName,
            // Garante que temos uma data válida
            displayDate: formatDate(gift.date || gift.createdAt || new Date())
          };
        } catch (error) {
          console.error('Erro ao carregar nome:', error);
          return { ...gift, fromUserName: 'Anônimo' };
        }
      })
    );

    // Cria o HTML dos presentes
    container.innerHTML = `
      <div class="gifts-grid">
        ${giftsWithNames.map(gift => `
          <div class="gift-item" data-id="${gift.giftId || gift.id}">
            <div class="gift-image-container">
              <img src="${gift.image || defaultGiftImage}" 
                   alt="${gift.name}" 
                   class="gift-image"
                   onerror="this.src='${defaultGiftImage}'">
              ${gift.category ? `<span class="gift-category">${getCategoryName(gift.category)}</span>` : ''}
            </div>
            <div class="gift-info">
              <h3 class="gift-name">${gift.name || 'Presente'}</h3>
              ${gift.price !== undefined ? `<p class="gift-price">${formatCurrency(gift.price)}</p>` : ''}
              
              <!-- Adiciona mensagem se existir -->
              ${gift.message ? `
                <div class="gift-message">
                  <i class="fas fa-quote-left"></i>
                  ${gift.message}
                </div>
              ` : ''}
              
              <div class="gift-meta">
                <span><i class="fas fa-calendar-alt"></i> ${gift.displayDate}</span>
                <span><i class="fas fa-user"></i> ${gift.fromUserName}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

  } catch (error) {
    console.error('Erro ao atualizar UI:', error);
    container.innerHTML = `
      <div class="error-loading">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar os presentes</p>
        <button onclick="location.reload()" class="btn-retry">
          Recarregar página
        </button>
      </div>
    `;
  }
}

// Cache para armazenar nomes de usuários
const userNamesCache = new Map();

// Função para buscar o nome do usuário
async function getUserName(userId) {
  // Verifica no cache primeiro
  if (userNamesCache.has(userId)) {
    return userNamesCache.get(userId);
  }

  try {
    const userDoc = await firebase.firestore().collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userName = userDoc.data().name || 'Usuário desconhecido';
      // Armazena no cache
      userNamesCache.set(userId, userName);
      return userName;
    }
    return 'Usuário desconhecido';
  } catch (error) {
    console.error('Erro ao buscar nome do usuário:', error);
    return 'Erro ao carregar';
  }
}

// Listener para atualizar cache quando nomes mudarem
function setupUserNameListener() {
  firebase.firestore().collection('users')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const userData = change.doc.data();
          userNamesCache.set(change.doc.id, userData.name);
        }
      });
    });
}


// Atualiza o resumo de presentes
function updateGiftsSummary(gifts) {
  const totalGifts = document.querySelector('.total-gifts');
  const totalValue = document.querySelector('.total-value');
  
  const total = gifts.reduce((sum, gift) => sum + (gift.price || 0), 0);
  const count = gifts.length;
  
  totalGifts.textContent = `${count} ${count === 1 ? 'presente' : 'presentes'}`;
  totalValue.textContent = `Total: ${formatCurrency(total)}`;
}

// Configura os botões de filtro
function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateGiftsUI(btn.dataset.filter);
    });
  });
}

// Funções auxiliares
function formatDate(dateString) {
  if (!dateString) return 'Data desconhecida';
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
}



// Função auxiliar para gerar ID se necessário
function generateId() {
  return 'gift_' + Math.random().toString(36).substr(2, 9);
}




async function openGiftModal(userId) {
  const modal = document.getElementById('giftModal');
  if (!modal) {
    console.error('Modal de presentes não encontrado');
    return;
  }

  // Armazenar o ID do destinatário no modal
  modal.dataset.recipientId = userId;
  
  // Mostrar modal
  modal.style.display = 'block';
  
  // Carregar presentes
  await loadGifts();
  
  // Configurar eventos
  setupGiftModalEvents();
}

async function loadGifts(category = 'all') {
  const giftsContainer = document.querySelector('.lux-gifts-container');
  giftsContainer.innerHTML = `
    <div class="lux-gifts-loading">
      <i class="fas fa-spinner fa-spin"></i> Carregando nossa seleção exclusiva...
    </div>
  `;

  try {
    let query = db.collection('gifts').where('available', '==', true);
    
    if (category !== 'all') {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.orderBy('price', 'asc').limit(20).get();

    console.log(`Encontrados ${snapshot.size} presentes para categoria ${category}`); // Debug

    if (snapshot.empty) {
      if (category !== 'all') {
        await loadGifts('all'); // Tenta carregar todas as categorias
        return;
      }
      giftsContainer.innerHTML = `
        <div class="lux-no-gifts">
          <i class="fas fa-gift"></i>
          <p>Nenhum presente disponível no momento</p>
        </div>
      `;
      return;
    }

    giftsContainer.innerHTML = '';
    
    snapshot.forEach(doc => {
      const gift = doc.data();
      console.log('Exibindo presente:', gift.name); // Debug
      const giftElement = createGiftElement(gift, doc.id);
      giftsContainer.appendChild(giftElement);
    });

  } catch (error) {
    console.error('Erro ao carregar presentes:', error);
    // ... (manter o tratamento de erro existente)
  }
}
// Na função que cria os elementos dos presentes:
function createGiftElement(gift, giftId) {
  const giftElement = document.createElement('div');
  giftElement.className = 'gift-item';
  giftElement.innerHTML = `
    <!-- Seu HTML existente -->
    <button class="btn-direct-send" data-gift-id="${giftId}">
      Envio direto
    </button>
  `;
  
  // Adicione o event listener corretamente
  giftElement.querySelector('.btn-direct-send').addEventListener('click', (e) => {
    e.preventDefault();
    const giftId = e.currentTarget.getAttribute('data-gift-id');
    console.log('ID do presente clicado:', giftId); // Debug
    sendGift(giftId, true);
  });
  
  return giftElement;
}
function getCategoryName(category) {
  const categories = {
    'jewelry': 'Joias',
    'experiences': 'Experiências',
    'fashion': 'Moda',
    'digital': 'Digital',
    'other': 'Outros'
  };
  return categories[category] || category;
}

function setupGiftModalEvents() {
  const modal = document.getElementById('giftModal');
  if (!modal) return;

  // Fechar modal com o botão X
  modal.querySelector('.lux-gift-close').addEventListener('click', closeGiftShop);

  // Fechar ao clicar fora
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeGiftShop();
    }
  });

  // Fechar modal de ações
  const actionsModal = document.getElementById('giftActionsModal');
  if (actionsModal) {
    actionsModal.querySelector('.lux-actions-close').addEventListener('click', closeGiftShop);
  }

  // Filtros de categoria
  document.querySelectorAll('.lux-gift-category').forEach(btn => {
    btn.addEventListener('click', function() {
      // Remover classe active de todos os botões
      document.querySelectorAll('.lux-gift-category').forEach(b => {
        b.classList.remove('active');
      });
      
      // Adicionar classe active ao botão clicado
      this.classList.add('active');
      
      // Carregar presentes da categoria selecionada
      const category = this.dataset.category;
      loadGifts(category).catch(error => {
        console.error('Erro ao carregar presentes:', error);
        // Se der erro, tentar carregar todos
        loadGifts('all');
      });
    });
  });
}
async function loadAdditionalGifts() {
  const select = document.getElementById('additionalGifts');
  if (!select) return;

  try {
    const snapshot = await db.collection('gifts')
      .where('available', '==', true)
      .where('price', '<', 100) // Presentes mais baratos como extras
      .limit(5)
      .get();

    // Limpar opções existentes
    select.innerHTML = '<option value="">Nenhum presente extra</option>';
    
    snapshot.forEach(doc => {
      const gift = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${gift.name} (${formatCurrency(gift.price)})`;
      option.dataset.imageUrl = gift.imageUrl;
      select.appendChild(option);
    });

    // Mostrar preview quando selecionar
    select.addEventListener('change', function() {
      const preview = document.getElementById('additionalGiftPreview');
      const selectedOption = this.options[this.selectedIndex];
      
      if (selectedOption.value) {
        preview.src = selectedOption.dataset.imageUrl;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    });

  } catch (error) {
    console.error('Erro ao carregar presentes extras:', error);
  }
}

async function sendGiftNotification(senderId, recipientId, giftData, message = '') {
  try {
    // Buscar dados do remetente
    const senderDoc = await db.collection('users').doc(senderId).get();
    const senderData = senderDoc.data();

    // Criar notificação
    await db.collection('notifications').add({
      userId: recipientId,
      type: 'new_gift',
      title: '🎁 Você recebeu um presente!',
      message: message || `${senderData.name || 'Alguém'} te enviou ${giftData.name}`,
      imageUrl: giftData.imageUrl,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      relatedUserId: senderId,
      giftId: giftData.id
    });

  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
  }
}


function closeGiftShop() {
  const modal = document.getElementById('giftModal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  const actionsModal = document.getElementById('giftActionsModal');
  if (actionsModal) {
    actionsModal.style.display = 'none';
  }
}
function showGiftActions(gift, giftId) {
  const modal = document.getElementById('giftActionsModal');
  const recipientId = document.getElementById('giftModal').dataset.recipientId;
  
  if (!modal || !recipientId) return;

  // Preencher informações do presente
  document.getElementById('selectedGiftName').textContent = gift.name;
  document.getElementById('selectedGiftImage').src = gift.imageUrl;
  document.getElementById('selectedGiftPrice').textContent = formatCurrency(gift.price);
  
  // Mostrar modal de ações
  modal.style.display = 'block';
  
  // Configurar eventos dos botões
  document.querySelector('.lux-action-send').onclick = () => {
    sendGift(recipientId, giftId, gift);
  };
  
  document.querySelector('.lux-action-customize').onclick = () => {
    showCustomizeSection(gift, giftId, recipientId);
  };
  
  document.querySelector('.lux-actions-close').onclick = () => {
    modal.style.display = 'none';
  };
}

function showCustomizeSection(gift, giftId, recipientId) {
  const customizeSection = document.getElementById('customizeSection');
  const mainActions = document.querySelector('.lux-gift-actions');
  
  // Esconder ações principais e mostrar seção de personalização
  mainActions.style.display = 'none';
  customizeSection.style.display = 'block';
  
  // Configurar botão de envio personalizado
  document.getElementById('confirmCustomSend').onclick = () => {
    const message = document.getElementById('giftMessage').value.trim();
    sendGift(recipientId, giftId, gift, message);
  };
  
  // Configurar botão de voltar
  document.getElementById('backToMain').onclick = () => {
    customizeSection.style.display = 'none';
    mainActions.style.display = 'flex';
  };
  
  // Carregar presentes extras (opcional)
  loadAdditionalGifts();
}







// Exibir presentes
function displayGifts(gifts) {
  if (gifts.length === 0) {
    giftsContainer.innerHTML = `
      <div class="lux-no-gifts">
        <i class="fas fa-gift"></i>
        <p>Nenhum presente disponível nesta categoria</p>
      </div>
    `;
    return;
  }

  giftsContainer.innerHTML = gifts.map(gift => `
    <div class="lux-gift-card" data-id="${gift.id}">
      <div class="lux-gift-image-container">
        <img src="${gift.image}" alt="${gift.name}" class="lux-gift-image" 
             onerror="this.src='${defaultGiftImage}'">
      </div>
      <div class="lux-gift-info">
        <h3 class="lux-gift-name">${gift.name}</h3>
        <p class="lux-gift-price">${formatCurrency(gift.price)}</p>
      </div>
    </div>
  `).join('');

  // Adiciona eventos de clique aos cartões
  document.querySelectorAll('.lux-gift-card').forEach(card => {
    card.addEventListener('click', () => {
      const giftId = card.getAttribute('data-id');
      selectedGift = availableGifts.find(g => g.id === giftId);
      showGiftActions(selectedGift);
    });
  });
}

// Adiciona eventos às cartas de presente
function addGiftCardEvents() {
  document.querySelectorAll('.lux-gift-accept').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.id;
      await updateGiftStatus(giftId, 'accepted');
      showToast('Presente aceito com sucesso!', 'success');
    });
  });
  
  document.querySelectorAll('.lux-gift-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const giftId = e.currentTarget.dataset.id;
      showGiftDetails(giftId);
    });
  });
}

// Atualiza o status de um presente
async function updateGiftStatus(giftId, newStatus) {
  try {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) return;
    
    const userRef = firebase.firestore().collection('users').doc(currentUser.uid);
    
    // Atualiza usando FieldValue.arrayUnion para evitar problemas de concorrência
    await userRef.update({
      'gifts.received': firebase.firestore.FieldValue.arrayRemove(...userGifts.filter(g => g.id === giftId)),
      'gifts.received': firebase.firestore.FieldValue.arrayUnion({
        ...userGifts.find(g => g.id === giftId),
        status: newStatus
      })
    });

    // Atualiza a UI
    userGifts = userGifts.map(gift => 
      gift.id === giftId ? {...gift, status: newStatus} : gift
    );
    
    const currentCategory = document.querySelector('.lux-filter-btn.active')?.dataset.category || 'all';
    displayGifts(userGifts, currentCategory);
    
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    showToast('Erro ao atualizar presente', 'error');
  }
}


function getStatusText(status) {
  const statuses = {
    pending: 'Pendente',
    accepted: 'Aceito',
    rejected: 'Recusado'
  };
  return statuses[status] || status;
}

async function getSenderName(userId) {
  try {
    const userDoc = await firebase.firestore().collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data().name : 'Usuário desconhecido';
  } catch (error) {
    console.error('Erro ao obter nome do remetente:', error);
    return 'Usuário desconhecido';
  }
}

// Configura o clique no ícone de presentes
document.querySelector('.lux-close-gifts').addEventListener('click', closeGiftsSection);

// Configura os filtros de categoria
document.querySelectorAll('.lux-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lux-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    displayGifts(userGifts, btn.dataset.category);
  });
});




document.querySelectorAll('.lux-gift-item').forEach(item => {
  const giftName = item.dataset.name || 'Presente';
  const giftPrice = item.dataset.price ? formatCurrency(item.dataset.price) : '';
  
  const tooltip = document.createElement('div');
  tooltip.className = 'lux-gift-tooltip';
  tooltip.textContent = `${giftName}${giftPrice ? ' - ' + giftPrice : ''}`;
  
  item.appendChild(tooltip);
});

// Exemplo: adiciona badge se quantidade > 1
if (gift.quantity > 1) {
  const badge = document.createElement('div');
  badge.className = 'lux-gift-badge';
  badge.textContent = gift.quantity;
  giftElement.appendChild(badge);
}


// Ativa o visualizador de imagens
document.querySelectorAll('.lux-gift-item img').forEach(img => {
  img.addEventListener('click', function() {
    const modal = document.querySelector('.gift-viewer-modal');
    const fullsizeImg = document.getElementById('fullsize-gift-image');
    
    fullsizeImg.src = this.src;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Bloqueia scroll
  });
});

// Fecha o visualizador
document.querySelector('.close-viewer').addEventListener('click', closeViewer);
document.querySelector('.gift-viewer-modal').addEventListener('click', function(e) {
  if (e.target === this) closeViewer();
});

function closeViewer() {
  document.querySelector('.gift-viewer-modal').style.display = 'none';
  document.body.style.overflow = 'auto'; // Restaura scroll
}

// Tecla ESC para fechar
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeViewer();
});

// Pré-carrega imagens grandes no hover
document.querySelectorAll('.lux-gift-item').forEach(item => {
  item.addEventListener('mouseenter', function() {
    const fullsizeUrl = this.querySelector('img').dataset.fullsize;
    if (fullsizeUrl) {
      const img = new Image();
      img.src = fullsizeUrl;
    }
  });
});






async function loadSentGifts() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  try {
    showLoading('Carregando seu histórico de presentes...');
    
    // Buscar presentes enviados no próprio perfil
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    const sentGifts = userDoc.data()?.gifts?.sent || [];
    
    // Buscar informações adicionais das transações
    const transactionsQuery = await firebase.firestore()
      .collection('giftTransactions')
      .where('fromUserId', '==', user.uid)
      .orderBy('date', 'desc')
      .get();

    const enrichedGifts = await Promise.all(transactionsQuery.docs.map(async doc => {
      const transaction = doc.data();
      
      // Buscar informações do destinatário
      let receiverName = "Usuário";
      try {
        const receiverDoc = await firebase.firestore().collection('users').doc(transaction.toUserId).get();
        receiverName = receiverDoc.data()?.name || "Usuário";
      } catch (e) {
        console.error("Erro ao buscar destinatário:", e);
      }
      
      return {
        ...transaction,
        id: doc.id,
        receiverName,
        status: transaction.status || 'pending',
        dateFormatted: formatDate(transaction.date)
      };
    }));

    updateSentGiftsUI(enrichedGifts);
    updateSentGiftsSummary(enrichedGifts);
    
  } catch (error) {
    console.error('Erro ao carregar presentes enviados:', error);
    showToast('Erro ao carregar histórico de presentes', 'error');
  } finally {
    hideLoading();
  }
}

function updateSentGiftsUI(gifts) {
  const container = document.querySelector('.sent-gifts-container');
  
  if (!gifts.length) {
    container.innerHTML = `
      <div class="no-gifts">
        <i class="fas fa-paper-plane"></i>
        <p>Você ainda não enviou nenhum presente</p>
      </div>
    `;
    return;
  }

  container.innerHTML = gifts.map(gift => `
    <div class="sent-gift-item ${gift.status}" data-gift-id="${gift.id}">
      <div class="gift-image" style="background-image: url('${gift.image || 'default-gift.jpg'}')"></div>
      
      <div class="gift-info">
        <h3>${gift.name}</h3>
        <p class="gift-meta">
          Para: <strong>${gift.receiverName}</strong> • 
          ${gift.price ? `${formatCurrency(gift.price)} • ` : ''}
          ${gift.dateFormatted}
        </p>
        
        <div class="gift-status">
          ${getStatusBadge(gift.status)}
          ${gift.status === 'accepted' ? `
            <p class="status-message">Presente aceito com sucesso!</p>
          ` : gift.status === 'declined' ? `
            <p class="status-message">Presente não foi aceito</p>
          ` : `
            <p class="status-message">Aguardando resposta</p>
          `}
        </div>
      </div>
      
      ${gift.status === 'pending' ? `
        <button class="btn-cancel-gift" data-gift-id="${gift.id}">
          <i class="fas fa-times"></i> Cancelar Envio
        </button>
      ` : ''}
    </div>
  `).join('');

  // Adicionar event listeners para cancelamento
  document.querySelectorAll('.btn-cancel-gift').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.giftId;
      await cancelSentGift(giftId);
    });
  });
}

function getStatusBadge(status) {
  const statusInfo = {
    accepted: { class: 'accepted', icon: 'fa-check-circle', text: 'Aceito' },
    declined: { class: 'declined', icon: 'fa-times-circle', text: 'Recusado' },
    pending: { class: 'pending', icon: 'fa-clock', text: 'Pendente' }
  };
  
  const info = statusInfo[status] || statusInfo.pending;
  return `
    <span class="status-badge ${info.class}">
      <i class="fas ${info.icon}"></i> ${info.text}
    </span>
  `;
}

function updateSentGiftsSummary(gifts) {
  const totalSent = gifts.length;
  const acceptedCount = gifts.filter(g => g.status === 'accepted').length;
  const declinedCount = gifts.filter(g => g.status === 'declined').length;
  
  document.querySelector('.sent-count').textContent = `${totalSent} enviados`;
  document.querySelector('.accepted-count').textContent = `${acceptedCount} aceitos`;
  document.querySelector('.declined-count').textContent = `${declinedCount} recusados`;
}

async function cancelSentGift(giftId) {
  try {
    const confirmation = await Swal.fire({
      title: 'Cancelar envio?',
      text: 'Você pode reenviar este presente depois',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Manter envio'
    });
    
    if (confirmation.isConfirmed) {
      showLoading('Cancelando envio...');
      
      // Atualizar status na transação
      await firebase.firestore().collection('giftTransactions').doc(giftId).update({
        status: 'cancelled',
        cancelledDate: new Date().toISOString()
      });
      
      // Remover da lista de enviados do usuário
      const user = firebase.auth().currentUser;
      const userRef = firebase.firestore().collection('users').doc(user.uid);
      
      await userRef.update({
        'gifts.sent': firebase.firestore.FieldValue.arrayRemove(giftId)
      });
      
      showToast('Envio cancelado com sucesso', 'success');
      loadSentGifts(); // Recarregar a lista
    }
    
  } catch (error) {
    console.error('Erro ao cancelar presente:', error);
    showToast('Erro ao cancelar envio', 'error');
  } finally {
    hideLoading();
  }
}

document.querySelectorAll('.sent-gifts-section .filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const filter = this.dataset.filter;
    
    // Atualizar botões ativos
    document.querySelectorAll('.sent-gifts-section .filter-btn').forEach(b => {
      b.classList.toggle('active', b === this);
    });
    
    // Filtrar presentes
    const allGifts = Array.from(document.querySelectorAll('.sent-gift-item'));
    allGifts.forEach(gift => {
      const shouldShow = filter === 'all' || gift.classList.contains(filter);
      gift.style.display = shouldShow ? 'flex' : 'none';
    });
  });
});



// Adicione esta função para verificar assinatura
async function checkSubscription(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.data()?.subscriptionLevel || 'public';
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return 'public';
  }
}

// Adicione esta função para navegar para a galeria
function setupGalleryNavigation() {
  const galleryLink = document.getElementById('gallery-link');
  if (galleryLink) {
    galleryLink.addEventListener('click', (e) => {
      e.preventDefault();
      const user = firebase.auth().currentUser;
      if (user) {
    window.location.href = `minhagaleria.html?uid=${user.uid}`;
      } else {
        showToast('Por favor, faça login para acessar sua galeria', 'warning');
        window.location.href = 'login.html';
      }
    });
  }
}

// Chame esta função no seu initialization


// Adicione isso no seu arquivo script.js principal
function showLoading(message = 'Carregando...') {
  // Remove qualquer loading existente
  hideLoading();
  
  // Cria o elemento de loading
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'luxury-loading';
  loadingDiv.style.position = 'fixed';
  loadingDiv.style.top = '0';
  loadingDiv.style.left = '0';
  loadingDiv.style.width = '100%';
  loadingDiv.style.height = '100%';
  loadingDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  loadingDiv.style.display = 'flex';
  loadingDiv.style.flexDirection = 'column';
  loadingDiv.style.justifyContent = 'center';
  loadingDiv.style.alignItems = 'center';
  loadingDiv.style.zIndex = '9999';
  loadingDiv.style.color = '#fff';
  
  // Adiciona spinner
  loadingDiv.innerHTML = `
    <div class="luxury-spinner" style="
      width: 50px;
      height: 50px;
      border: 5px solid rgba(139, 110, 75, 0.3);
      border-radius: 50%;
      border-top-color: var(--luxury-gold);
      animation: spin 1s ease-in-out infinite;
      margin-bottom: 20px;
    "></div>
    <p style="font-size: 1.2rem; margin-top: 10px;">${message}</p>
  `;
  
  document.body.appendChild(loadingDiv);
  
  // Adiciona a animação de spin
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function hideLoading() {
  const loadingDiv = document.getElementById('luxury-loading');
  if (loadingDiv) {
    loadingDiv.remove();
  }
}