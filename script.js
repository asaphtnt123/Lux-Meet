
// Adicione no início do seu arquivo, antes de qualquer função
const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23CCCCCC"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

// Adicione no topo do seu arquivo, com outras variáveis globais
const pendingAttachments = {
  images: [],
  files: []
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

function openProfileModal(profileData) {
  const modal = document.getElementById('profileModal');
  if (!modal) return;

  modal.innerHTML = `
    <div class="lux-modal-content">
      <span class="lux-modal-close">&times;</span>
      <div class="lux-profile-header">
        <img src="${profileData.profilePhotoURL || defaultAvatar}" 
             class="lux-profile-avatar"
             alt="Foto de ${profileData.name}"
             onerror="this.src='${defaultAvatar.replace(/'/g, "&#039;")}'">
        <h2>${profileData.name || 'Usuário LuxMeet'}</h2>
        ${profileData.bio ? `<p class="lux-profile-bio">${profileData.bio}</p>` : ''}
      </div>
      
      <div class="lux-profile-actions">
        <button class="lux-btn lux-btn-primary" onclick="openChatbox('${profileData.userId}')">
          <i class="fas fa-envelope"></i> Mensagem
        </button>
      </div>
    </div>
  `;

  modal.style.display = 'block';
  
  // Fecha o modal ao clicar no X
  modal.querySelector('.lux-modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Fecha o modal ao clicar fora
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
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
// Declare a função viewProfile no escopo global

async function viewProfile(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      // Abre o modal de perfil com o botão de mensagem que usa o chatbox
      openProfileModal({
        ...userDoc.data(),
        userId: userId  // Garante que o userId está disponível
      });
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
  messagesContainer.innerHTML = '<div class="lux-loading">Carregando mensagens...</div>';
  
  try {
    const snapshot = await db.collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    
    messagesContainer.innerHTML = '';
    
    if (snapshot.empty) {
      messagesContainer.innerHTML = '<div class="lux-no-messages">Nenhuma mensagem ainda</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      const message = doc.data();
      const messageElement = createMessageElement(message);
      messagesContainer.appendChild(messageElement);
    });
    
    // Rolagem para a última mensagem
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error);
    messagesContainer.innerHTML = '<div class="lux-error">Erro ao carregar mensagens</div>';
  }
}

function createMessageElement(message) {
  const currentUser = firebase.auth().currentUser;
  const isCurrentUser = message.senderId === currentUser.uid;

  const messageElement = document.createElement('div');
  messageElement.className = `lux-message ${isCurrentUser ? 'lux-message-sent' : 'lux-message-received'}`;

  // Começa o conteúdo vazio
  let messageContent = '';

  // Texto
  if (message.text) {
    messageContent += `<div class="lux-message-text">${message.text}</div>`;
  }

  // Imagens
  if (message.imageUrls && message.imageUrls.length > 0) {
    message.imageUrls.forEach(url => {
      messageContent += `
        <div class="lux-message-image">
          <img src="${url}" alt="Imagem enviada" loading="lazy" />
        </div>`;
    });
  }

  // Arquivos
  if (message.files && message.files.length > 0) {
    message.files.forEach(file => {
      messageContent += `
        <div class="lux-message-file">
          <a href="${file.url}" target="_blank">
            📎 ${file.name || 'Arquivo'}
          </a> <span class="lux-file-size">(${formatFileSize(file.size)})</span>
        </div>`;
    });
  }

  messageElement.innerHTML = `
    ${!isCurrentUser ? `<img src="${message.senderPhoto || 'https://via.placeholder.com/40'}" 
         class="lux-message-avatar" 
         alt="Avatar"
         onerror="this.src='https://via.placeholder.com/40'">` : ''}
    <div class="lux-message-content">
      ${messageContent}
      <div class="lux-message-time">${formatMessageTime(message.timestamp?.toDate())}</div>
    </div>
  `;

  return messageElement;
}





function setupMessageSender(chatId, partnerId) {
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendMessageBtn');

  const sendMessage = async () => {
    const text = messageInput.value.trim();
    const hasImages = pendingAttachments.images.length > 0;
    const hasFiles = pendingAttachments.files.length > 0;

    if (!text && !hasImages && !hasFiles) return;

    try {
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) return;

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
          );
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
          );
        });
      }

      const uploadedAttachments = await Promise.all(uploadPromises);

      // Montar objeto da mensagem
      const messageData = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Usuário',
        senderPhoto: currentUser.photoURL || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      };

      if (text) messageData.text = text;

      const imageUrls = uploadedAttachments
        .filter(a => a.type === 'image')
        .map(a => a.url);

      if (imageUrls.length > 0) {
        messageData.imageUrls = imageUrls;
        messageData.messageType = 'image';
      }

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

      // Enviar a mensagem
      await db.collection('chats').doc(chatId).collection('messages').add(messageData);

      // Última mensagem para exibir no resumo do chat
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

      await loadChatMessages(chatId);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showToast('Erro ao enviar mensagem', 'error');
    }
  };

  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}
async function uploadFile(file, path) {
  const storageRef = firebase.storage().ref();
  const fileRef = storageRef.child(`${path}/${Date.now()}_${file.name}`);
  
  await fileRef.put(file);
  const url = await fileRef.getDownloadURL();
  return url;
}




/*********************
 * PERFIL / MODAL UI *
 *********************/

function openProfileModal(profileData) {
  const modal = document.getElementById('profileModal');
  if (!modal) {
    console.error('Elemento profileModal não encontrado no DOM');
    return;
  }

  // Preenche o modal com os dados do perfil
  const modalContent = `
    <div class="lux-profile-modal">
      <div class="lux-profile-modal-header">
        <img src="${profileData.profilePhotoURL || 'https://via.placeholder.com/150'}" 
             class="lux-profile-modal-img" 
             alt="${profileData.name || 'Usuário'}"
             onerror="this.src='https://via.placeholder.com/150'">
        <h2>${profileData.name || 'Usuário'}</h2>
        <p>${profileData.tipouser || 'Membro'} • ${profileData.age || ''} anos • ${profileData.cidade || ''}</p>
      </div>
      <div class="lux-profile-modal-body">
        <h3>Sobre</h3>
        <p>${profileData.bio || 'Nenhuma biografia fornecida.'}</p>
        
        ${profileData.interestIn ? `
        <h3>Interessado em</h3>
        <p>${profileData.interestIn}</p>
        ` : ''}
      </div>
      <div class="lux-profile-actions">
        <button class="lux-btn lux-btn-primary" onclick="startChatWithUser('${profileData.userId || profileData.id}')">
          <i class="fas fa-envelope"></i> Mensagem
        </button>
      </div>
    </div>
  `;

  // Atualiza o modal e exibe
  modal.innerHTML = `
    <div class="lux-modal-content">
      <span class="lux-modal-close">&times;</span>
      ${modalContent}
    </div>
  `;

  // Mostra o modal
  modal.style.display = 'flex';

  // Configura eventos para fechar o modal
  modal.querySelector('.lux-modal-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
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

async function openChat(chatId, otherUserId) {
  try {
    // Busca dados do outro usuário
    const userDoc = await db.collection('users').doc(otherUserId).get();
    if (!userDoc.exists) {
      console.error('Usuário não encontrado');
      return;
    }

    const userData = userDoc.data();

    // Preenche informações no cabeçalho do chat flutuante
    document.getElementById('chatPartnerAvatar').src = userData.profilePhotoURL || 'https://via.placeholder.com/150';
    document.getElementById('chatPartnerName').textContent = userData.name || 'Usuário';
    // Status pode ser dinâmico futuramente
    document.getElementById('chatPartnerStatus').textContent = 'Online';

    // Mostra o chat flutuante
    const activeChat = document.getElementById('activeChat');
    activeChat.style.display = 'flex';

    // Limpa mensagens anteriores
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = `
      <div class="lux-messages-date">
        <span>HOJE</span>
      </div>
    `;

    // Carrega mensagens do Firestore (exemplo simples)
    const messagesSnapshot = await db.collection('chats').doc(chatId).collection('messages')
      .orderBy('timestamp')
      .get();

    messagesSnapshot.forEach(doc => {
      const msg = doc.data();
      const messageDiv = document.createElement('div');
      messageDiv.className = msg.senderId === firebase.auth().currentUser.uid ? 'lux-message me' : 'lux-message';
      messageDiv.innerHTML = `
        <div class="lux-message-bubble">${msg.text || '[Mensagem vazia]'}</div>
      `;
      messagesContainer.appendChild(messageDiv);
    });

    // Scrolla para a última mensagem
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Adiciona comportamento ao botão de envio
    document.getElementById('sendMessageBtn').onclick = async () => {
      const messageInput = document.getElementById('messageInput');
      const text = messageInput.value.trim();
      if (text === '') return;

      await db.collection('chats').doc(chatId).collection('messages').add({
        text,
        senderId: firebase.auth().currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      messageInput.value = '';
      openChat(chatId, otherUserId); // recarrega mensagens (ou use um listener ao invés disso)
    };

  } catch (error) {
    console.error('Erro ao abrir chat:', error);
    showToast('Erro ao abrir o chat', 'error');
  }
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




// Configura os listeners para os inputs de arquivo
function setupFileInputs() {
  document.getElementById('chatboxImageInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        handleFileSelection(file, 'image');
      });
    }
  });

  document.getElementById('chatboxFileInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        handleFileSelection(file, 'file');
      });
    }
  });
}

// Função para lidar com a seleção de arquivos
function handleFileSelection(file, type) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast('Arquivo muito grande. Tamanho máximo: 5MB', 'error');
    return;
  }

  if (type === 'image') {
    const reader = new FileReader();
    reader.onload = function(e) {
      pendingAttachments.images.push({
        file: file,
        previewUrl: e.target.result
      });
      updateAttachmentsPreview();
    };
    reader.readAsDataURL(file);
  } else {
    pendingAttachments.files.push({
      file: file,
      name: file.name,
      type: file.type,
      size: file.size
    });
    updateAttachmentsPreview();
  }
}

// Atualiza a pré-visualização dos anexos
function updateAttachmentsPreview() {
  const previewContainer = document.getElementById('attachmentsPreview');
  previewContainer.innerHTML = '';
  
  // Adiciona imagens
  pendingAttachments.images.forEach((img, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'lux-preview-item';
    previewItem.innerHTML = `
      <img src="${img.previewUrl}" class="lux-preview-image">
      <button class="lux-preview-remove" onclick="removeAttachment(${index}, 'image')">
        <i class="fas fa-times"></i>
      </button>
    `;
    previewContainer.appendChild(previewItem);
  });
  
  // Adiciona arquivos
  pendingAttachments.files.forEach((file, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'lux-preview-item';
    previewItem.innerHTML = `
      <div class="lux-preview-file">
        <div class="lux-file-icon">${getFileIcon(file.type)}</div>
        <div class="lux-file-info">
          <div class="lux-file-name">${file.name}</div>
          <div class="lux-file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="lux-preview-remove" onclick="removeAttachment(${index}, 'file')">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    previewContainer.appendChild(previewItem);
  });

  previewContainer.style.display = 
    pendingAttachments.images.length > 0 || pendingAttachments.files.length > 0 
      ? 'block' 
      : 'none';
}

// Remove um anexo específico
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

// Configura o envio de mensagens no chatbox (com suporte a anexos)
function setupChatboxMessageSender() {
  const messageInput = document.getElementById('chatboxMessageInput');
  const sendButton = document.getElementById('chatboxSendButton');
  
  const sendMessage = async () => {
    const text = messageInput.value.trim();
    const hasImage = currentUploads.image !== null;
    const hasFile = currentUploads.file !== null;
    
    if (!text && !hasImage && !hasFile) {
      showToast('Digite uma mensagem ou adicione um anexo', 'warning');
      return;
    }
    
    try {
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        showToast('Você precisa estar logado para enviar mensagens', 'error');
        return;
      }
      
      let chatId = currentChat.id;
      
      // Se não existe um chat, cria um novo
      if (!chatId) {
        const lastMessageText = hasImage ? '📷 Imagem' : 
                              (hasFile ? `📎 ${currentUploads.file.name}` : text);
        
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
      
      // Upload de imagem se existir
      let imageUrl = '';
      if (hasImage) {
        imageUrl = await uploadFile(currentUploads.image.file, `chats/${chatId}/images`);
        removeImagePreview();
      }
      
      // Upload de arquivo se existir
      let fileUrl = '';
      let fileData = null;
      if (hasFile) {
        fileUrl = await uploadFile(currentUploads.file, `chats/${chatId}/files`);
        fileData = {
          url: fileUrl,
          name: currentUploads.file.name,
          type: currentUploads.file.type,
          size: currentUploads.file.size
        };
      }
      
      // Cria o objeto da mensagem
      const messageData = {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Usuário',
        senderPhoto: currentUser.photoURL || '',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      };
      
      // Adiciona dados da imagem se existir
      if (hasImage) {
        messageData.imageUrl = imageUrl;
        messageData.messageType = 'image';
      }
      
      // Adiciona dados do arquivo se existir
      if (hasFile) {
        messageData.fileUrl = fileData.url;
        messageData.fileName = fileData.name;
        messageData.fileType = fileData.type;
        messageData.fileSize = fileData.size;
        messageData.messageType = 'file';
      }
      
      // Adiciona a mensagem ao chat
      await db.collection('chats').doc(chatId).collection('messages').add(messageData);
      
      // Atualiza a última mensagem no chat
      const lastMessageText = hasImage ? '📷 Imagem' : 
                            (hasFile ? `📎 ${currentUploads.file.name}` : text);
      
      await db.collection('chats').doc(chatId).update({
        lastMessage: lastMessageText,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        [`unreadCount.${currentChat.partnerId}`]: firebase.firestore.FieldValue.increment(1)
      });
      
      // Limpa o campo de entrada e anexos
      messageInput.value = '';
      currentUploads.image = null;
      currentUploads.file = null;
      
      // Recarrega as mensagens
      await loadChatboxMessages(chatId);
      
      // Rola para a última mensagem
      const messagesContainer = document.getElementById('chatboxMessages');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showToast('Erro ao enviar mensagem', 'error');
    }
  };
  
 async function uploadFile(file, path) {
  try {
    const storageRef = firebase.storage().ref();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const fileRef = storageRef.child(`${path}/${fileName}`);
    
    await fileRef.put(file);
    return await fileRef.getDownloadURL();
  } catch (error) {
    console.error('Erro no upload:', error);
    throw error;
  }
}
  
  // Função para remover pré-visualização de imagem
  function removeImagePreview() {
    const preview = document.querySelector('.lux-chatbox-preview-container');
    if (preview) preview.remove();
  }
  
  // Enviar ao clicar no botão
  sendButton.addEventListener('click', sendMessage);
  
  // Enviar ao pressionar Enter (sem Shift)
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Auto-ajuste da altura do textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
}

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

// Configura os listeners para os inputs de arquivo
document.getElementById('chatImageInput').addEventListener('change', function(e) {
  if (e.target.files && e.target.files.length > 0) {
    handleFileSelection(e.target.files[0], 'image');
  }
});

document.getElementById('chatFileInput').addEventListener('change', function(e) {
  if (e.target.files && e.target.files.length > 0) {
    handleFileSelection(e.target.files[0], 'file');
  }
});
  
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


function openMediaViewer(imageUrl) {
  const modal = document.getElementById('mediaViewerModal');
  const img = document.getElementById('mediaViewerImage');
  if (!modal || !img) return;
  
  img.src = imageUrl;
  modal.style.display = 'flex';
}

function downloadFile(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'arquivo';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Função para obter ícone do arquivo
function getFileIcon(fileType) {
  if (!fileType) return '📄';
  
  const icons = {
    'image/': '🖼️',
    'application/pdf': '📕',
    'application/zip': '🗜️',
    'application/msword': '📝',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
    'text/': '📄'
  };
  
  for (const [prefix, icon] of Object.entries(icons)) {
    if (fileType.startsWith(prefix)) return icon;
  }
  
  return '📄';
}



function downloadFile(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'arquivo';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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


function formatMessageTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  
  document.getElementById('deleteChatOption')?.addEventListener('click', () => {
    if (confirm('Tem certeza que deseja apagar esta conversa?')) {
      deleteChat(currentChat.id);
    }
    optionsMenu.remove();
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



// Função para limpar o chat (apenas para o usuário atual)
async function clearChat(chatId) {
  try {
    // Verifica se o chatId é válido
    if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
      throw new Error('ID do chat inválido');
    }

    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      throw new Error('Usuário não autenticado');
    }
    
    // Referência ao chat com verificação adicional
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    
    if (!chatDoc.exists) {
      throw new Error('Chat não encontrado');
    }

    // Verifica se o usuário tem permissão para limpar este chat
    const chatData = chatDoc.data();
    if (!chatData.participants || !chatData.participants.includes(currentUser.uid)) {
      throw new Error('Você não tem permissão para limpar este chat');
    }

    // Marca todas as mensagens como apagadas para este usuário
    const messagesSnapshot = await chatRef.collection('messages')
      .where('deletedFor', 'not-in', [[currentUser.uid]])
      .get();
    
    const batch = db.batch();
    messagesSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        deletedFor: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
      });
    });
    
    await batch.commit();
    showToast('Conversa limpa com sucesso');
    
    // Recarrega as mensagens apenas se for o chat atual
    if (currentChat && currentChat.id === chatId) {
      loadChatboxMessages(chatId);
    }
    
  } catch (error) {
    console.error('Erro ao limpar chat:', error);
    showToast(error.message || 'Erro ao limpar conversa', 'error');
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
