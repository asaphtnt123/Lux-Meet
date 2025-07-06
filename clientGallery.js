// 1. Variáveis globais e inicialização
let currentUser = null;
let creatorData = null;
let creatorId = new URLSearchParams(window.location.search).get('creatorId') || '';
let viewerId = new URLSearchParams(window.location.search).get('viewerId') || '';
let isOwnGallery = new URLSearchParams(window.location.search).get('isOwnGallery') === 'true';
let currentAlbumToUnlock = null;
let selectedPaymentMethod = null;

// Inicialização segura do Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase inicializado com sucesso");
  
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log("Persistência LOCAL configurada"))
    .catch(error => console.error("Erro na persistência:", error));
}
 // 2. Inicialização
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Verificar parâmetros da URL primeiro
      const urlParams = new URLSearchParams(window.location.search);
      creatorId = urlParams.get('creatorId') || '';
      
      // Fallback para sessionStorage apenas se não houver creatorId na URL
      if (!creatorId) {
        const savedAuth = sessionStorage.getItem('galleryAuthData');
        if (savedAuth) {
          creatorId = JSON.parse(savedAuth).profileUserId;
          console.log("ID do criador obtido do sessionStorage:", creatorId);
        }
      }

      if (!creatorId) {
        throw new Error("ID do criador não especificado");
      }

      // Obter usuário atual
      const currentUser = await getAuthenticatedUser();
      isOwnGallery = currentUser && currentUser.uid === creatorId;

      console.log("Configuração inicial:", {
        creatorId,
        currentUser: currentUser ? currentUser.uid : 'null',
        isOwnGallery
      });

      // Carregar dados
      await loadCreatorProfile();
      await loadAlbums(currentUser);
      setupEventListeners();

    } catch (error) {
      console.error("Erro inicial:", error);
      handleError(error);
    }
  });


// 3. Funções principais
async function loadCreatorProfile() {
  try {
    const creatorDoc = await firebase.firestore().collection('users').doc(creatorId).get();
    
    if (creatorDoc.exists) {
      creatorData = creatorDoc.data();
      
      // Atualizar UI
      document.getElementById('creator-name').textContent = creatorData.name || 'Criador';
      document.getElementById('creator-avatar').src = creatorData.profilePhotoURL || 'https://via.placeholder.com/150';
      document.title = `${creatorData.name}'s Galeria`;
      
      console.log("Perfil do criador carregado:", creatorData);
    } else {
      throw new Error("Perfil do criador não encontrado");
    }
  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    throw error;
  }
}
 // 3. Função para carregar álbuns CORRIGIDA
  async function loadAlbums(currentUser) {
    const albumsContainer = document.getElementById('albums-container');
    if (!albumsContainer) return;

    albumsContainer.innerHTML = '<p class="loading">Carregando álbuns...</p>';
    
    try {
      console.log(`Buscando álbuns para o criador: ${creatorId}`); // LOG IMPORTANTE

      let query = firebase.firestore()
        .collection('users')
        .doc(creatorId) // SEMPRE usar creatorId aqui
        .collection('MinhaGaleria');

      // Apenas filtrar por públicos se não for a própria galeria
      if (!isOwnGallery) {
        query = query.where('isPublic', '==', true);
        console.log("Filtrando apenas álbuns públicos");
      }

      const albumsSnapshot = await query
        .orderBy('createdAt', 'desc')
        .get();
        
      if (albumsSnapshot.empty) {
        albumsContainer.innerHTML = '<p class="no-albums">Nenhum álbum disponível.</p>';
        return;
      }
      
      // Restante da função permanece igual...
      
    } catch (error) {
      console.error("Erro ao carregar álbuns:", error);
      albumsContainer.innerHTML = '<p class="error">Erro ao carregar álbuns.</p>';
    }
  }

// 4. Funções de autenticação e assinatura
async function getAuthenticatedUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      
      if (user) {
        resolve(user);
      } else if (isOwnGallery) {
        // Se tentando acessar própria galeria sem login
        const redirectUrl = encodeURIComponent(window.location.href);
        window.location.href = `login.html?redirect=${redirectUrl}`;
        reject(new Error("Redirecionando para login"));
      } else {
        // Permitir visualização de galerias públicas sem login
        resolve(null);
      }
    }, reject);
  });
}

async function checkSubscriptions() {
  if (!currentUser || !creatorId || currentUser.uid === creatorId) return;
  
  try {
    const subscriptionDoc = await firebase.firestore().collection('users').doc(currentUser.uid)
      .collection('subscriptions').doc(creatorId).get();
      
    const isSubscriber = subscriptionDoc.exists && subscriptionDoc.data().active;
    
    // Atualizar UI
    const subscribeBtn = document.getElementById('subscribe-btn');
    const unlockBtn = document.getElementById('unlock-all-btn');
    
    if (isSubscriber) {
      if (subscribeBtn) subscribeBtn.style.display = 'none';
      if (unlockBtn) unlockBtn.style.display = 'none';
      
      // Desbloquear todos os álbuns
      document.querySelectorAll('.album-card.locked').forEach(card => {
        card.classList.remove('locked');
      });
    } else {
      if (subscribeBtn) subscribeBtn.style.display = 'block';
      if (unlockBtn) unlockBtn.style.display = 'block';
    }
    
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
  }
}

// 5. Funções de UI e eventos
function setupEventListeners() {
  // Botão de assinar
  const subscribeBtn = document.getElementById('subscribe-btn');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', () => {
      showPaymentModal('subscription');
    });
  }
  
  // Botão desbloquear tudo
  const unlockBtn = document.getElementById('unlock-all-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      showPaymentModal('unlock_all');
    });
  }
  
  // Opções de pagamento
  document.querySelectorAll('.payment-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.payment-option').forEach(o => 
        o.classList.remove('selected'));
      option.classList.add('selected');
      selectedPaymentMethod = option.dataset.method;
    });
  });
  
  // Confirmar pagamento
  const confirmBtn = document.getElementById('confirm-payment');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', processPayment);
  }
  
  // Fechar modal
  const closeBtn = document.querySelector('.close-payment');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('payment-modal').style.display = 'none';
    });
  }
}

function handleAlbumClick(albumId, albumData) {
  const albumCard = document.querySelector(`.album-card[data-album-id="${albumId}"]`);
  
  if (albumCard && albumCard.classList.contains('locked')) {
    currentAlbumToUnlock = albumId;
    showPaymentModal('album', albumData);
  } else {
    window.location.href = `album.html?creatorId=${creatorId}&albumId=${albumId}`;
  }
}

function showPaymentModal(type, albumData = null) {
  const modal = document.getElementById('payment-modal');
  if (!modal) return;
  
  const title = document.getElementById('payment-title');
  const details = document.getElementById('payment-details');
  
  // Resetar seleção
  selectedPaymentMethod = null;
  document.querySelectorAll('.payment-option').forEach(o => 
    o.classList.remove('selected'));
  
  // Configurar modal conforme o tipo
  if (type === 'subscription') {
    title.textContent = 'Assinar Perfil';
    details.innerHTML = `
      <p>Você está assinando o perfil de ${creatorData.name}.</p>
      <p class="price">R$ ${creatorData.subscriptionPrice?.toFixed(2) || '19,90'}/mês</p>
      <ul class="benefits">
        <li><i class="fas fa-check"></i> Acesso a todos os álbuns</li>
        <li><i class="fas fa-check"></i> Conteúdo exclusivo</li>
      </ul>
    `;
  } 
  else if (type === 'album') {
    title.textContent = `Desbloquear Álbum: ${albumData.name}`;
    details.innerHTML = `
      <p>Você está desbloqueando o álbum "${albumData.name}".</p>
      <p class="price">R$ ${albumData.price?.toFixed(2) || '9,90'}</p>
      <p>${albumData.description || ''}</p>
    `;
  }
  else if (type === 'unlock_all') {
    title.textContent = 'Desbloquear Todos os Álbuns';
    details.innerHTML = `
      <p>Você está desbloqueando todos os álbuns de ${creatorData.name}.</p>
      <p class="price">R$ ${creatorData.unlockAllPrice?.toFixed(2) || '49,90'}</p>
      <p>Acesso vitalício a todos os álbuns atuais e futuros.</p>
    `;
  }
  
  modal.style.display = 'flex';
}

async function processPayment() {
  if (!selectedPaymentMethod) {
    alert('Selecione um método de pagamento');
    return;
  }

  const confirmBtn = document.getElementById('confirm-payment');
  if (!confirmBtn) return;
  
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

  try {
    // Registrar a compra no Firestore
    const purchaseData = {
      userId: currentUser.uid,
      creatorId: creatorId,
      date: firebase.firestore.FieldValue.serverTimestamp(),
      method: selectedPaymentMethod,
      status: 'completed'
    };

    if (currentAlbumToUnlock) {
      purchaseData.type = 'album';
      purchaseData.albumId = currentAlbumToUnlock;
      await firebase.firestore().collection('purchases').add(purchaseData);
    } 
    else if (document.getElementById('payment-title').textContent.includes('Assinar')) {
      purchaseData.type = 'subscription';
      await firebase.firestore().collection('users').doc(currentUser.uid)
        .collection('subscriptions').doc(creatorId).set({
          ...purchaseData,
          active: true,
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
        });
    } 
    else {
      purchaseData.type = 'unlock_all';
      await firebase.firestore().collection('purchases').add(purchaseData);
    }

    // Fechar modal e recarregar
    document.getElementById('payment-modal').style.display = 'none';
    alert('Pagamento processado com sucesso!');
    await loadAlbums();
    await checkSubscriptions();

  } catch (error) {
    console.error("Erro no pagamento:", error);
    alert("Erro ao processar pagamento: " + error.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirmar Pagamento';
  }
}

// 6. Tratamento de erros
function handleError(error) {
  const errorContainer = document.createElement('div');
  errorContainer.className = 'error-container';
  
  errorContainer.innerHTML = `
    <div class="error-content">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Ocorreu um erro</h3>
      <p>${error.message}</p>
      <div class="error-actions">
        <button onclick="window.location.reload()">Tentar novamente</button>
        <button onclick="window.location.href='index.html'">Voltar ao início</button>
      </div>
    </div>
  `;
  
  document.body.innerHTML = '';
  document.body.appendChild(errorContainer);
}

// 7. Função para redirecionamento (usada no openProfileModal)
window.redirectToGallery = async function(profileUserId) {
  try {
    const user = firebase.auth().currentUser;
    
    // Salvar dados para fallback
    sessionStorage.setItem('galleryAuthData', JSON.stringify({
      profileUserId: profileUserId,
      timestamp: Date.now()
    }));
    
    const url = new URL('minhagaleriaCL.html', window.location.origin);
    url.searchParams.set('creatorId', profileUserId);
    
    if (user) {
      url.searchParams.set('viewerId', user.uid);
      url.searchParams.set('isOwnGallery', user.uid === profileUserId);
      
      const token = await user.getIdToken(true);
      url.searchParams.set('auth', token);
    }
    
    console.log("Redirecionando para:", url.toString());
    window.location.href = url.toString();

  } catch (error) {
    console.error('Erro no redirecionamento:', error);
    const redirectUrl = encodeURIComponent(`minhagaleriaCL.html?creatorId=${profileUserId}`);
    window.location.href = `login.html?redirect=${redirectUrl}`;
  }
};