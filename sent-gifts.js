// Inicialize o Firebase (substitua com sua configuração)

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
const db = firebase.firestore();

// Variáveis globais
let currentUser = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      initGiftSystem();
    } else {
      redirectToLogin();
    }
  });
});

function initGiftSystem() {
  // Verifica se está na página de presentes enviados
  if (document.querySelector('.sent-gifts-section')) {
    loadSentGifts();
  }
  
  // Verifica se está na página de presentes recebidos
  if (document.querySelector('.my-gifts-section')) {
    loadReceivedGifts();
  }
  
  // Inicializa outros listeners
  initGiftButtons();
}

function updateSentGiftsUI(gifts) {
  const container = document.querySelector('.sent-gifts-container');
  if (!container) {
    console.error("Container não encontrado!");
    return;
  }

  if (!gifts || gifts.length === 0) {
    container.innerHTML = `
      <div class="no-gifts">
        <i class="fas fa-paper-plane"></i>
        <p>Você ainda não enviou nenhum presente</p>
      </div>
    `;
    return;
  }

  container.innerHTML = gifts.map(gift => `
    <div class="gift-card sent-gift ${gift.status}" data-id="${gift.id}">
      <div class="gift-image-container">
        <img src="${gift.image || 'default-gift.jpg'}" alt="${gift.name}" class="gift-image">
        ${gift.viewed ? '' : '<span class="new-badge">Novo</span>'}
      </div>
      
      <div class="gift-info">
        <h3 class="gift-title">${gift.name}</h3>
        
        <div class="gift-meta">
          <p><strong>Para:</strong> ${gift.receiverName || 'Usuário'}</p>
          <p><strong>Enviado em:</strong> ${gift.dateFormatted || formatDate(gift.date)}</p>
          <p><strong>Status:</strong> <span class="status-badge ${gift.status}">${getStatusText(gift.status)}</span></p>
          ${gift.price ? `<p><strong>Valor:</strong> ${formatCurrency(gift.price)}</p>` : ''}
        </div>
        
        ${gift.status === 'accepted' ? `
          <div class="gift-response">
            <div class="response-header">
              <i class="fas fa-heart"></i>
              <span>Agradecimento recebido</span>
            </div>
            ${gift.thankYouNote ? `
              <div class="response-message">
                <p>${gift.thankYouNote}</p>
              </div>
            ` : ''}
            ${gift.thankYouImage ? `
              <div class="response-image">
                <img src="${gift.thankYouImage}" alt="Agradecimento">
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        ${gift.status === 'declined' ? `
          <div class="gift-response declined">
            <div class="response-header">
              <i class="fas fa-comment-alt"></i>
              <span>Mensagem de recusa</span>
            </div>
            ${gift.declineMessage ? `
              <div class="response-message">
                <p>${gift.declineMessage}</p>
              </div>
            ` : ''}
            ${gift.declineImage ? `
              <div class="response-image">
                <img src="${gift.declineImage}" alt="Mensagem de recusa">
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Funções auxiliares:

function getActiveFiltersText() {
  const activeFilters = [];
  
  if (currentFilters.status !== 'all') {
    activeFilters.push(`Status: ${translateStatus(currentFilters.status)}`);
  }
  
  if (currentFilters.category !== 'all') {
    activeFilters.push(`Categoria: ${translateCategory(currentFilters.category)}`);
  }
  
  activeFilters.push(`Ordem: ${currentFilters.date === 'newest' ? 'Mais recentes' : 'Mais antigos'}`);
  
  return activeFilters.join(' • ');
}

function translateStatus(status) {
  const statusMap = {
    pending: 'Pendente',
    accepted: 'Aceito',
    declined: 'Recusado'
  };
  return statusMap[status] || status;
}

function translateCategory(category) {
  const categoryMap = {
    experiences: 'Experiências',
    products: 'Produtos',
    vouchers: 'Vales-presente'
  };
  return categoryMap[category] || category;
}

function calculateFilteredTotals(gifts) {
  const totalGifts = gifts.length;
  const acceptedCount = gifts.filter(g => g.status === 'accepted').length;
  const pendingCount = gifts.filter(g => g.status === 'pending').length;
  const totalValue = gifts.reduce((sum, gift) => sum + (parseFloat(gift.price) || 0), 0);

  return `
    <div class="gifts-summary">
      <div class="summary-item">
        <span class="count">${totalGifts}</span>
        <span class="label">Presentes</span>
      </div>
      <div class="summary-item">
        <span class="count">${acceptedCount}</span>
        <span class="label">Aceitos</span>
      </div>
      <div class="summary-item">
        <span class="count">${pendingCount}</span>
        <span class="label">Pendentes</span>
      </div>
      ${totalValue > 0 ? `
        <div class="summary-item">
          <span class="count">${formatCurrency(totalValue)}</span>
          <span class="label">Valor total</span>
        </div>
      ` : ''}
    </div>
  `;
}

function renderGiftCard(gift) {
  const statusClass = gift.status || 'pending';
  const statusText = translateStatus(gift.status);
  const categoryText = translateCategory(gift.category);
  
  return `
    <div class="gift-card ${statusClass}" data-id="${gift.id}">
      <div class="gift-image-container">
        <img src="${gift.image || 'default-gift.jpg'}" alt="${gift.name}" class="gift-image">
        ${gift.viewed ? '' : '<span class="new-badge">Novo</span>'}
      </div>
      
      <div class="gift-info">
        <h3 class="gift-title">${gift.name}</h3>
        
        <div class="gift-meta">
          <p><strong>Para:</strong> ${gift.toUserName || 'Usuário'}</p>
          <p><strong>Enviado em:</strong> ${gift.dateFormatted || formatDate(gift.date)}</p>
          <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
          ${gift.category ? `<p><strong>Categoria:</strong> ${categoryText}</p>` : ''}
          ${gift.price ? `<p><strong>Valor:</strong> ${formatCurrency(gift.price)}</p>` : ''}
        </div>
        
        ${gift.status === 'accepted' && gift.acceptedDate ? `
          <div class="accepted-info">
            <i class="fas fa-check-circle"></i>
            Aceito em ${formatDate(gift.acceptedDate)}
          </div>
        ` : ''}
        
        ${gift.status === 'pending' ? `
          <div class="gift-actions">
            <button class="btn-cancel-gift" data-id="${gift.id}">
              <i class="fas fa-times"></i> Cancelar Envio
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function setupGiftEventListeners() {
  // Botões de cancelamento
  document.querySelectorAll('.btn-cancel-gift').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const giftId = e.currentTarget.dataset.id;
      if (confirm('Tem certeza que deseja cancelar o envio deste presente?')) {
        await cancelSentGift(giftId);
      }
    });
  });
  
  // Cards clicáveis (opcional)
  document.querySelectorAll('.gift-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-cancel-gift')) {
        const giftId = card.dataset.id;
        showGiftDetails(giftId);
      }
    });
  });
}


function getStatusText(status) {
  const statusMap = {
    pending: '🟡 Pendente',
    accepted: '🟢 Aceito',
    declined: '🔴 Recusado',
    completed: '⚪ Concluído'
  };
  return statusMap[status] || status;
}

async function loadSentGifts() {
  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("Usuário não autenticado");
    return;
  }

  try {
    showLoading('Carregando seus presentes...');
    console.log(`Buscando presentes para usuário: ${user.uid}`);

    // 1. Buscar nas DUAS fontes possíveis
    const [transactionsSnapshot, userSnapshot] = await Promise.all([
      db.collection('giftTransactions')
        .where('fromUserId', '==', user.uid)
        .orderBy('date', 'desc')
        .get(),
      
      db.collection('users').doc(user.uid).get()
    ]);

    // 2. Combinar resultados
    const transactionGifts = transactionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'transactions'
    }));

    const userGifts = userSnapshot.data()?.gifts?.sent || [];
    console.log(`Encontrados: ${transactionGifts.length} transações e ${userGifts.length} no usuário`);

    // 3. Unificar e remover duplicatas
    const allGifts = [...transactionGifts, ...userGifts];
    const uniqueGifts = allGifts.reduce((acc, gift) => {
      if (!acc.some(g => g.transactionId === gift.transactionId)) {
        acc.push(gift);
      }
      return acc;
    }, []);

    console.log('Presentes consolidados:', uniqueGifts);

    // 4. Enriquecer dados
    const enrichedGifts = await Promise.all(uniqueGifts.map(async gift => {
      let receiverName = gift.toUserName || "Usuário";
      
      try {
        if (gift.toUserId) {
          const receiverDoc = await db.collection('users').doc(gift.toUserId).get();
          receiverName = receiverDoc.data()?.name || receiverName;
        }
      } catch (e) {
        console.error("Erro ao buscar destinatário:", e);
      }

      return {
        ...gift,
        receiverName,
        dateFormatted: formatDate(gift.date),
        price: gift.price || 0
      };
    }));

    // 5. Ordenar por data
    enrichedGifts.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('Presentes finais:', enrichedGifts);
    updateSentGiftsUI(enrichedGifts);
    updateSentGiftsSummary(enrichedGifts);

  } catch (error) {
    console.error('Erro completo:', error);
    showToast('Erro ao carregar presentes. Tente recarregar.', 'error');
  } finally {
    hideLoading();
  }
}

// No final do seu arquivo, adicione:
function setupRealTimeUpdates() {
  const user = firebase.auth().currentUser;
  if (!user) return;

  return db.collection('giftTransactions')
    .where('fromUserId', '==', user.uid)
    .orderBy('date', 'desc')
    .onSnapshot(snapshot => {
      const gifts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateFormatted: formatDate(doc.data().date)
      }));
      updateSentGiftsUI(gifts);
      updateSentGiftsSummary(gifts);
    });
}

// Inicialize quando o usuário logar
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    setupRealTimeUpdates();
    loadSentGifts();
  }
});


function applyFilter(gifts, filter) {
  switch(filter) {
    case 'accepted':
      return gifts.filter(g => g.status === 'accepted');
    case 'declined':
      return gifts.filter(g => g.status === 'declined');
    case 'pending':
      return gifts.filter(g => g.status === 'pending');
    default:
      return gifts;
  }
}



function formatDate(dateString) {
  if (!dateString) return 'Data não disponível';
  const options = { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('pt-BR', options);
}

// Função para formatar moeda (se ainda não existir)
function formatCurrency(amount) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

// Função para obter o badge de status (se ainda não existir)
function getStatusBadge(status) {
  const statusMap = {
    pending: '<span class="badge pending">Pendente</span>',
    accepted: '<span class="badge accepted">Aceito</span>',
    declined: '<span class="badge declined">Recusado</span>'
  };
  return statusMap[status] || '<span class="badge">Desconhecido</span>';
}

// Função para atualizar o resumo (adicione esta nova função)
function updateSentGiftsSummary(gifts) {
  const summaryElement = document.querySelector('.sent-gifts-summary') || document.createElement('div');
  
  const acceptedCount = gifts.filter(g => g.status === 'accepted').length;
  const pendingCount = gifts.filter(g => g.status === 'pending').length;
  
  summaryElement.innerHTML = `
    <div class="summary-item">
      <span class="count">${gifts.length}</span>
      <span class="label">Presentes enviados</span>
    </div>
    <div class="summary-item">
      <span class="count">${acceptedCount}</span>
      <span class="label">Aceitos</span>
    </div>
    <div class="summary-item">
      <span class="count">${pendingCount}</span>
      <span class="label">Pendentes</span>
    </div>
  `;
  
  if (!document.querySelector('.sent-gifts-summary')) {
    document.body.appendChild(summaryElement);
    summaryElement.className = 'sent-gifts-summary';
  }
}


function renderSentGifts(gifts) {
  const container = document.getElementById('sent-gifts-container');
  container.innerHTML = '';

  gifts.forEach(gift => {
    const giftElement = document.createElement('div');
    giftElement.className = `gift-card ${gift.status}`;
    giftElement.innerHTML = `
      <div class="gift-image" style="background-image: url('${gift.image || 'default-gift.jpg'}')"></div>
      <div class="gift-info">
        <h3>${gift.name}</h3>
        <p class="gift-meta">
          Para: ${gift.toUserName || 'Usuário'} • 
          ${gift.dateFormatted} • 
          ${gift.price ? formatCurrency(gift.price) : 'Presente'}
        </p>
        <div class="gift-status">
          <span class="status-badge ${gift.status}">
            ${gift.status === 'accepted' && gift.acceptedDate ? 
              `<i class="fas fa-check-circle"></i> Aceito em ${formatDate(gift.acceptedDate)}` :
              gift.status === 'declined' ? 
              `<i class="fas fa-times-circle"></i> Recusado` :
              `<i class="fas fa-clock"></i> Pendente`
            }
          </span>
        </div>
      </div>
    `;
    container.appendChild(giftElement);
  });
}


function formatCurrency(value) {
  return value?.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }) || 'Grátis';
}



async function updateGiftStatus(transactionId, newStatus) {
  try {
    showLoading('Atualizando status...');
    
    await db.runTransaction(async (transaction) => {
      // 1. Atualiza na coleção principal
      const transactionRef = db.collection('transactions').doc(transactionId);
      transaction.update(transactionRef, {
        status: newStatus,
        respondedAt: new Date().toISOString()
      });
      
      // 2. Atualiza no remetente
      const senderRef = db.collection('users').doc(currentUser.uid);
      const senderDoc = await transaction.get(senderRef);
      const sentGifts = senderDoc.data().gifts.sent.map(g => 
        g.transactionId === transactionId ? { ...g, status: newStatus } : g
      );
      transaction.update(senderRef, { 'gifts.sent': sentGifts });
      
      // 3. Atualiza no destinatário
      const giftDoc = await transaction.get(transactionRef);
      const receiverRef = db.collection('users').doc(giftDoc.data().toUserId);
      const receiverDoc = await transaction.get(receiverRef);
      const receivedGifts = receiverDoc.data().gifts.received.map(g =>
        g.transactionId === transactionId ? { ...g, status: newStatus } : g
      );
      transaction.update(receiverRef, { 'gifts.received': receivedGifts });
    });
    
    showToast(`Status atualizado para ${newStatus}`, 'success');
    loadSentGifts(); // Recarrega a lista
    
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    showToast('Erro ao atualizar status', 'error');
  } finally {
    hideLoading();
  }
}

function updateStats(gifts) {
  const totalElement = document.getElementById('total-sent');
  const acceptedElement = document.getElementById('accepted-count');
  const pendingElement = document.getElementById('pending-count');
  const declinedElement = document.getElementById('declined-count');

  if (totalElement && acceptedElement && pendingElement && declinedElement) {
    const total = gifts.length;
    const accepted = gifts.filter(g => g.status === 'accepted').length;
    const declined = gifts.filter(g => g.status === 'declined').length;
    const pending = total - accepted - declined;
    
    totalElement.textContent = total;
    acceptedElement.textContent = accepted;
    declinedElement.textContent = declined;
    pendingElement.textContent = pending;
  }
}

async function respondToGift(giftId, action) {
  try {
    showLoading(action === 'accept' ? 'Aceitando presente...' : 'Recusando presente...');
    const user = firebase.auth().currentUser;
    
    // Atualiza no array received do destinatário
    const userRef = db.collection('users').doc(user.uid);
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const receivedGifts = userDoc.data().gifts.received.map(g => {
        if (g.giftId === giftId) {
          return { 
            ...g, 
            status: action === 'accept' ? 'accepted' : 'declined',
            accepted: action === 'accept',
            acceptedDate: new Date().toISOString()
          };
        }
        return g;
      });
      
      transaction.update(userRef, { 'gifts.received': receivedGifts });
    });

    // Atualiza na transação principal
    const transactionQuery = await db.collection('transactions')
      .where('giftId', '==', giftId)
      .limit(1)
      .get();

    if (!transactionQuery.empty) {
      const transactionRef = transactionQuery.docs[0].ref;
      await transactionRef.update({
        status: action === 'accept' ? 'accepted' : 'declined',
        accepted: action === 'accept',
        respondedAt: new Date().toISOString()
      });
    }

    showToast(`Presente ${action === 'accept' ? 'aceito' : 'recusado'} com sucesso!`, 'success');
    loadReceivedGifts(); // Recarrega a lista do destinatário
    
  } catch (error) {
    console.error(`Erro ao ${action} presente:`, error);
    showToast(`Erro: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}


// Adicione este evento no seu código de inicialização

function renderEmptySentGifts() {
  const container = document.getElementById('sent-gifts-container');
  container.innerHTML = `
    <div class="no-gifts">
      <i class="fas fa-paper-plane"></i>
      <p>Você ainda não enviou nenhum presente</p>
      <button class="btn-primary" onclick="location.href='send-gift.html'">
        Enviar Primeiro Presente
      </button>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('sent-gifts-container');
  container.innerHTML = `
    <div class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${message}</p>
      <button class="btn-retry" onclick="loadSentGifts()">
        <i class="fas fa-sync-alt"></i> Tentar Novamente
      </button>
    </div>
  `;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      loadSentGifts();
    } else {
      window.location.href = 'login.html';
    }
  });
});
// Carrega presentes recebidos
async function loadReceivedGifts() {
  try {
    showLoading('Carregando seus presentes...');
    
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const receivedGifts = userDoc.data()?.gifts?.received || [];
    
    // Marca como visualizados
    if (receivedGifts.some(g => !g.viewed)) {
      await db.collection('users').doc(currentUser.uid).update({
        'gifts.received': receivedGifts.map(g => ({ ...g, viewed: true }))
      });
    }
    
    renderReceivedGifts(receivedGifts);

  } catch (error) {
    console.error('Erro ao carregar presentes:', error);
    showToast('Erro ao carregar presentes', 'error');
  } finally {
    hideLoading();
  }
}


function renderReceivedGifts(gifts) {
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

  container.innerHTML = gifts.map(gift => `
    <div class="gift-item ${gift.status}" data-gift-id="${gift.giftId}">
      ${!gift.viewed ? '<span class="new-badge">Novo</span>' : ''}
      <div class="gift-image" style="background-image: url('${gift.image || 'img/default-gift.jpg'}')"></div>
      <div class="gift-details">
        <h3>${gift.name}</h3>
        <p class="gift-from">De: ${gift.fromUserName}</p>
        ${gift.price ? `<p class="gift-price">${formatCurrency(gift.price)}</p>` : ''}
        <p class="gift-date">${formatDate(gift.date)}</p>
        
        <div class="gift-actions">
          ${gift.status !== 'accepted' ? `
            <button class="btn-accept" data-gift-id="${gift.giftId}">
              <i class="fas fa-check"></i> Aceitar
            </button>
            <button class="btn-decline" data-gift-id="${gift.giftId}">
              <i class="fas fa-times"></i> Recusar
            </button>
          ` : `
            <div class="accepted-badge">
              <i class="fas fa-check-circle"></i> Aceito
            </div>
          `}
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners
  document.querySelectorAll('.btn-accept').forEach(btn => {
    btn.addEventListener('click', (e) => respondToGift(e.target.dataset.giftId, 'accept'));
  });
  
  document.querySelectorAll('.btn-decline').forEach(btn => {
    btn.addEventListener('click', (e) => respondToGift(e.target.dataset.giftId, 'decline'));
  });
}

// Funções de ação
async function respondToGift(giftId, action) {
  try {
    showLoading(action === 'accept' ? 'Aceitando presente...' : 'Recusando presente...');
    
    // Atualiza no destinatário
    const userRef = db.collection('users').doc(currentUser.uid);
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const gifts = userDoc.data().gifts.received;
      
      const updatedGifts = gifts.map(g => 
        g.giftId === giftId ? { 
          ...g, 
          status: action === 'accept' ? 'accepted' : 'declined',
          respondedAt: new Date().toISOString()
        } : g
      );
      
      transaction.update(userRef, { 'gifts.received': updatedGifts });
    });
    
    // Atualiza na transação principal
    const transactionQuery = await db.collection('giftTransactions')
      .where('giftId', '==', giftId)
      .limit(1)
      .get();
      
    if (!transactionQuery.empty) {
      const transactionRef = transactionQuery.docs[0].ref;
      await transactionRef.update({
        status: action === 'accept' ? 'accepted' : 'declined',
        respondedAt: new Date().toISOString()
      });
    }
    
    showToast(`Presente ${action === 'accept' ? 'aceito' : 'recusado'}!`, 'success');
    loadReceivedGifts();
    
  } catch (error) {
    console.error(`Erro ao ${action} presente:`, error);
    showToast(`Erro: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function cancelGift(giftId) {
  try {
    const confirmation = await Swal.fire({
      title: 'Cancelar envio?',
      text: 'Esta ação não pode ser desfeita',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Manter'
    });
    
    if (confirmation.isConfirmed) {
      showLoading('Cancelando envio...');
      
      // Atualiza status na transação
      await db.collection('giftTransactions').doc(giftId).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      
      showToast('Envio cancelado com sucesso', 'success');
      loadSentGifts();
    }
    
  } catch (error) {
    console.error('Erro ao cancelar presente:', error);
    showToast('Erro ao cancelar envio', 'error');
  } finally {
    hideLoading();
  }
}



function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}
// Adicione esta função no mesmo arquivo, antes de loadSentGifts()





function updateSentStats(gifts) {
  const total = gifts.length;
  const accepted = gifts.filter(g => g.status === 'accepted').length;
  const declined = gifts.filter(g => g.status === 'declined').length;
  
  document.getElementById('total-sent').textContent = total;
  document.getElementById('total-accepted').textContent = accepted;
  document.getElementById('total-declined').textContent = declined;
}

// Funções de UI
function showLoading(message = 'Carregando...') {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
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

async function showGratitudeScreen(gift, receiverName) {
  await Swal.fire({
    title: 'Presente Enviado!',
    html: `
      <div class="gratitude-container">
        <div class="gift-preview" style="background-image: url('${gift.image || 'img/default-gift.jpg'}')"></div>
        <h3>${gift.name}</h3>
        <p>Para: <strong>${receiverName}</strong></p>
        ${gift.price ? `<p>Valor: <strong>${formatCurrency(gift.price)}</strong></p>` : ''}
        <p class="gratitude-message">Agora é só aguardar a resposta!</p>
      </div>
    `,
    confirmButtonText: 'Ver Presentes Enviados',
    showCancelButton: true,
    cancelButtonText: 'Continuar Navegando'
  }).then((result) => {
    if (result.isConfirmed) {
      window.location.href = 'presentes-enviados.html';
    }
  });
}

function redirectToLogin() {
  window.location.href = 'login.html';
}

// Inicializa botões de presente na página
function initGiftButtons() {
  // Botão para enviar presente diretamente
  document.querySelectorAll('.btn-send-gift').forEach(btn => {
    btn.addEventListener('click', async () => {
      const giftId = btn.dataset.giftId;
      const giftDoc = await db.collection('gifts').doc(giftId).get();
      
      if (giftDoc.exists) {
        openRecipientSelection(giftDoc.data());
      }
    });
  });
}

// Função para selecionar destinatário
async function openRecipientSelection(gift) {
  // Implemente a lógica de seleção de usuário aqui
  // Esta é uma implementação básica - adapte conforme necessário
  
  const { value: userId } = await Swal.fire({
    title: 'Enviar Presente',
    input: 'select',
    inputOptions: await getUsersList(),
    inputPlaceholder: 'Selecione um usuário',
    showCancelButton: true
  });
  
  if (userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    await sendGiftToUser(userId, gift, userDoc.data().name);
  }
}

async function getUsersList() {
  const snapshot = await db.collection('users').limit(20).get();
  const users = {};
  snapshot.forEach(doc => {
    users[doc.id] = doc.data().name || `Usuário ${doc.id.substring(0, 6)}`;
  });
  return users;
}

document.addEventListener('DOMContentLoaded', () => {
  loadSentGifts();
});

console.log('Elementos com classe sent-gifts-container:', 
  document.querySelectorAll('.sent-gifts-container'));
console.log('Documento pronto?', document.readyState);







// Variáveis para armazenar os filtros atuais
let currentFilters = {
  status: 'all',
  category: 'all',
  date: 'newest'
};

// Função para aplicar os filtros
function applyFilters(gifts) {
  return gifts.filter(gift => {
    // Filtro por status
    const statusMatch = currentFilters.status === 'all' || gift.status === currentFilters.status;
    
    // Filtro por categoria
    const categoryMatch = currentFilters.category === 'all' || gift.category === currentFilters.category;
    
    return statusMatch && categoryMatch;
  }).sort((a, b) => {
    // Ordenação por data
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return currentFilters.date === 'newest' ? dateB - dateA : dateA - dateB;
  });
}

// Função para carregar presentes com filtros
async function loadFilteredGifts() {
  try {
    showLoading('Aplicando filtros...');
    
    // Carrega todos os presentes (do código original)
    const user = firebase.auth().currentUser;
    const snapshot = await db.collection('giftTransactions')
      .where('fromUserId', '==', user.uid)
      .get();
    
    const allGifts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dateFormatted: formatDate(doc.data().date)
    }));
    
    // Aplica os filtros
    const filteredGifts = applyFilters(allGifts);
    
    // Atualiza a UI
    updateSentGiftsUI(filteredGifts);
    
  } catch (error) {
    console.error('Erro ao filtrar presentes:', error);
    showToast('Erro ao aplicar filtros', 'error');
  } finally {
    hideLoading();
  }
}

// Event listeners para os filtros
document.addEventListener('DOMContentLoaded', () => {
  // Carrega filtros salvos (se existirem)
  const savedFilters = localStorage.getItem('giftFilters');
  if (savedFilters) {
    currentFilters = JSON.parse(savedFilters);
    setFilterValues();
  }
  
  // Configura os eventos
  document.getElementById('apply-filters').addEventListener('click', () => {
    currentFilters = {
      status: document.getElementById('status-filter').value,
      category: document.getElementById('category-filter').value,
      date: document.getElementById('date-filter').value
    };
    
    localStorage.setItem('giftFilters', JSON.stringify(currentFilters));
    loadFilteredGifts();
  });
  
  document.getElementById('reset-filters').addEventListener('click', () => {
    currentFilters = {
      status: 'all',
      category: 'all',
      date: 'newest'
    };
    
    localStorage.removeItem('giftFilters');
    setFilterValues();
    loadFilteredGifts();
  });
});

// Função para definir os valores dos selects
function setFilterValues() {
  document.getElementById('status-filter').value = currentFilters.status;
  document.getElementById('category-filter').value = currentFilters.category;
  document.getElementById('date-filter').value = currentFilters.date;
}