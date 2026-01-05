// Sistema Lux Meet Live - JavaScript Completo
// lux-meet-live.js

// ============================================
// CONFIGURAÇÕES E INICIALIZAÇÃO
// ============================================

// Firebase
let auth = null;
let db = null;
let storage = null;
let currentUser = null;
let userData = null;

// Estado da aplicação
let currentLiveId = null;
let isBroadcasting = false;
let isWatching = false;
let userRole = 'viewer'; // host, cohost, viewer
let peerConnections = new Map();
let localStream = null;

// Configurações ICE Servers
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
    ]
};

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

async function initializeApp() {
    try {
        console.log('Iniciando aplicação...');
        
        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: "AIzaSyA-7HOp-Ycvyf3b_03ev__8aJEwAbWSQZY",
                authDomain: "connectfamilia-312dc.firebaseapp.com",
                projectId: "connectfamilia-312dc",
                storageBucket: "connectfamilia-312dc.appspot.com",
                messagingSenderId: "797817838649",
                appId: "1:797817838649:web:1aa7c54abd97661f8d81e8"
            });
        }
        
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
        
        // Verificar autenticação
        auth.onAuthStateChanged(handleAuthStateChange);
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showToast('Erro ao inicializar aplicação', 'error');
    }
}

// ============================================
// MANIPULADOR DE MUDANÇA DE AUTENTICAÇÃO (CORRIGIDO)
// ============================================

async function handleAuthStateChange(user) {
    try {
        if (user) {
            // Usuário está logado
            console.log('✅ Usuário autenticado:', user.uid);
            currentUser = user;
            
            // Carregar dados do usuário
            const userDataLoaded = await loadUserData();
            
            if (userDataLoaded) {
                // Atualizar UI
                updateUserUI();
                
                // Carregar conteúdo da página
                await loadPageContent();
                
                // Configurar listeners
                setupEventListeners();
                
                // Mostrar aplicação
                showApp();
            } else {
                showToast('Erro ao carregar dados do usuário. Recarregue a página.', 'error');
            }
        } else {
            // Usuário não está logado
            console.log('⚠️ Usuário não autenticado');
            
            // Redirecionar para página de login
            redirectToLogin();
        }
    } catch (error) {
        console.error('❌ Erro em handleAuthStateChange:', error);
        showToast('Erro ao processar autenticação', 'error');
    }
}
// ============================================
// CARREGAR DADOS DO USUÁRIO (CORRIGIDA)
// ============================================

async function loadUserData() {
    try {
        console.log('Carregando dados do usuário...');
        
        if (!currentUser || !currentUser.uid) {
            throw new Error('Usuário não autenticado');
        }
        
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            
            // Garantir que todos os campos necessários existam
            userData = {
                // Dados básicos
                uid: userData.uid || currentUser.uid,
                displayName: userData.displayName || currentUser.displayName || 'Usuário',
                email: userData.email || currentUser.email || '',
                photoURL: userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/150',
                
                // Sistema de economia
                balance: typeof userData.balance === 'number' ? userData.balance : 0,
                diamonds: typeof userData.diamonds === 'number' ? userData.diamonds : 100,
                
                // Sistema de progressão
                role: userData.role || 'user',
                level: typeof userData.level === 'number' ? userData.level : 1,
                experience: typeof userData.experience === 'number' ? userData.experience : 0,
                
                // Sistema social
                followers: typeof userData.followers === 'number' ? userData.followers : 0,
                following: Array.isArray(userData.following) ? userData.following : [],
                
                // Sistema de monetização
                totalEarnings: typeof userData.totalEarnings === 'number' ? userData.totalEarnings : 0,
                isVerified: userData.isVerified === true,
                
                // Metadados
                createdAt: userData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            console.log('✅ Dados do usuário carregados:', userData);
            
        } else {
            // Criar novo perfil de usuário com estrutura completa
            userData = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Usuário ' + currentUser.uid.substring(0, 8),
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || 'https://via.placeholder.com/150',
                
                // Sistema de economia
                balance: 0,
                diamonds: 100,
                
                // Sistema de progressão
                role: 'user',
                level: 1,
                experience: 0,
                
                // Sistema social
                followers: 0,
                following: [],
                
                // Sistema de monetização
                totalEarnings: 0,
                isVerified: false,
                
                // Metadados
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(currentUser.uid).set(userData);
            console.log('✅ Novo perfil de usuário criado:', userData);
        }
        
        // Atualizar último login
        await db.collection('users').doc(currentUser.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        
        // Criar objeto userData mínimo em caso de erro
        userData = {
            uid: currentUser?.uid || 'unknown',
            displayName: currentUser?.displayName || 'Usuário',
            photoURL: currentUser?.photoURL || 'https://via.placeholder.com/150',
            balance: 0,
            diamonds: 100,
            level: 1,
            isVerified: false
        };
        
        showToast('Erro ao carregar dados do usuário. Alguns recursos podem não funcionar.', 'warning');
        return false;
    }
}

// ============================================
// ATUALIZAR INTERFACE DO USUÁRIO (CORRIGIDA)
// ============================================

function updateUserUI() {
    if (!currentUser || !userData) {
        console.error('Erro: currentUser ou userData não definidos');
        return;
    }
    
    try {
        // Atualizar nome do usuário
        const userNameElements = document.querySelectorAll('#userName, .lux-user-name');
        userNameElements.forEach(el => {
            if (el) {
                el.textContent = userData.displayName || currentUser.displayName || 'Usuário';
            }
        });
        
        // Atualizar avatar do usuário
        const userAvatarElements = document.querySelectorAll('#userAvatar, .lux-user-avatar');
        userAvatarElements.forEach(el => {
            if (el) {
                el.src = userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/40';
                el.onerror = function() {
                    this.src = 'https://via.placeholder.com/40';
                };
            }
        });
        
        // Atualizar saldo com verificação segura
        const balanceElement = document.getElementById('userBalance');
        if (balanceElement) {
            const balance = userData.balance || 0;
            balanceElement.textContent = balance.toFixed(2);
        }
        
        // Atualizar diamantes com verificação segura
        const diamondsElement = document.getElementById('userDiamonds');
        if (diamondsElement) {
            const diamonds = userData.diamonds || 0;
            diamondsElement.textContent = diamonds;
        }
        
        // Atualizar diamantes no modal
        const modalDiamondsElement = document.getElementById('modalDiamonds');
        if (modalDiamondsElement) {
            const diamonds = userData.diamonds || 0;
            modalDiamondsElement.textContent = diamonds;
        }
        
        // Atualizar nível
        const levelElement = document.getElementById('userLevel');
        if (levelElement) {
            const level = userData.level || 1;
            levelElement.textContent = `Nível ${level}`;
        }
        
        // Atualizar badge de verificação
        const verifiedBadge = document.getElementById('verifiedBadge');
        if (verifiedBadge) {
            verifiedBadge.style.display = userData.isVerified ? 'inline-block' : 'none';
        }
        
        console.log('UI do usuário atualizada com sucesso');
        
    } catch (error) {
        console.error('Erro ao atualizar UI do usuário:', error);
        showToast('Erro ao carregar dados do usuário', 'error');
    }
}

function showApp() {
    // Ocultar tela de loading e mostrar aplicação
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.querySelector('.lux-live-app');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (app) app.style.display = 'block';
    
    console.log('Aplicação mostrada');
}

// ============================================
// SISTEMA DE LIVES
// ============================================


// ============================================
// MOSTRAR PLAYER DA LIVE (ATUALIZADA E CORRIGIDA)
// ============================================
// ============================================
// MOSTRAR PLAYER DA LIVE (CORRIGIDA PARA SEU HTML)
// ============================================
// ============================================
// MOSTRAR PLAYER DA LIVE (VERSÃO FINAL CORRIGIDA)
// ============================================


// ============================================
// FUNÇÃO AUXILIAR PARA VERIFICAR ELEMENTOS DO DOM
// ============================================

function checkDOMElements() {
    console.log('🔍 Verificando elementos do DOM...');
    
    const requiredElements = [
        'livePlayer',
        'liveGrid', 
        'livePlayerTitle',
        'liveHostName',
        'liveHostAvatar',
        'liveBadge',
        'exitLiveBtn',
        'liveVideo',
        'localVideo',
        'videoPlaceholder',
        'viewerCount',  // Note: minúsculo como no seu HTML
        'likeCount',
        'giftCount',
        'earningsCount',
        'chatUserCount'
    ];
    
    const missingElements = [];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log('✅ Elemento encontrado:', id);
        } else {
            console.log('❌ Elemento não encontrado:', id);
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.log('⚠️ Faltam', missingElements.length, 'elementos:', missingElements);
    } else {
        console.log('🎉 Todos os elementos necessários estão presentes!');
    }
}

// Executar verificação após o DOM carregar
setTimeout(checkDOMElements, 1000);
// ============================================
// SETUP MEDIA CONTROLS (CORRIGIDA)
// ============================================

function setupMediaControls(isHost) {
    // Só configurar controles se for host
    if (!isHost) return;
    
    // Toggle vídeo
    const videoBtn = document.getElementById('toggleVideoBtn');
    if (videoBtn && localStream) {
        videoBtn.addEventListener('click', function() {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const icon = this.querySelector('i');
                if (icon) {
                    icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
                }
                showToast(videoTrack.enabled ? 'Câmera ativada' : 'Câmera desativada', 'info');
            }
        });
    }
    
    // Toggle áudio
    const audioBtn = document.getElementById('toggleAudioBtn');
    if (audioBtn && localStream) {
        audioBtn.addEventListener('click', function() {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const icon = this.querySelector('i');
                if (icon) {
                    icon.className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
                }
                showToast(audioTrack.enabled ? 'Microfone ativado' : 'Microfone desativado', 'info');
            }
        });
    }
    
    // Tela cheia
    const fullscreenBtn = document.getElementById('toggleFullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
}

// ============================================
// CONFIGURAR EVENTOS DO CHAT (CORRIGIDA)
// ============================================

function setupChatEvents() {
    const chatInput = document.getElementById('liveChatInput');
    const sendBtn = document.getElementById('sendLiveChatBtn');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
}
// ============================================
// ATUALIZAR CONTADORES DA LIVE (NOVA FUNÇÃO AUXILIAR)
// ============================================

function updateLiveCounters(liveData) {
    // Função auxiliar para atualizar contadores
    function updateCounter(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || '0';
        }
    }
    
    // Atualizar todos os contadores
    updateCounter('liveViewerCount', formatNumber(liveData.viewerCount || 0));
    updateCounter('likeCount', liveData.likes || 0);
    updateCounter('giftCount', liveData.giftCount || 0);
    
    // Atualizar informações do host no player
    updateCounter('liveHostFollowers', formatNumber(liveData.hostFollowers || 0));
}

// ============================================
// CRIAR LIVE - CORREÇÃO FINAL (ADICIONE AQUI)
// ============================================


async function loadActiveLives() {
    try {
        console.log('Carregando lives ativas...');
        
        const gridContainer = document.getElementById('liveGridContainer');
        const sidebarList = document.getElementById('sidebarLiveList');
        const activeCountElement = document.getElementById('activeLivesCount');
        
        if (!gridContainer) {
            console.error('Elemento liveGridContainer não encontrado');
            return;
        }
        
        gridContainer.innerHTML = '<div class="lux-loading-lives"><i class="fas fa-spinner fa-spin"></i><p>Carregando lives...</p></div>';
        
        const snapshot = await db.collection('liveStreams')
            .where('status', '==', 'active')
            .orderBy('startTime', 'desc')
            .limit(50)
            .get();
        
        gridContainer.innerHTML = '';
        
        if (snapshot.empty) {
            gridContainer.innerHTML = `
                <div class="lux-no-lives">
                    <i class="fas fa-broadcast-tower fa-3x"></i>
                    <h3>Nenhuma live no momento</h3>
                    <p>Seja o primeiro a iniciar uma transmissão!</p>
                    <button id="createLiveBtn2" class="lux-btn lux-btn-primary">
                        <i class="fas fa-video"></i> Criar Primeira Live
                    </button>
                </div>
            `;
            
            // Adicionar event listener ao botão
            document.getElementById('createLiveBtn2')?.addEventListener('click', () => {
                openModal('createLiveModal');
            });
            
            if (activeCountElement) activeCountElement.textContent = '0';
            return;
        }
        
        let liveCount = 0;
        const liveCards = [];
        
        snapshot.forEach(doc => {
            const live = { id: doc.id, ...doc.data() };
            if (live.status === 'active') {
                liveCount++;
                const card = createLiveCard(live);
                liveCards.push(card);
            }
        });
        
        // Adicionar cards ao container
        liveCards.forEach(card => {
            gridContainer.appendChild(card);
        });
        
        // Atualizar contadores
        if (activeCountElement) activeCountElement.textContent = liveCount;
        if (document.getElementById('footerLives')) {
            document.getElementById('footerLives').textContent = liveCount;
        }
        
        // Atualizar lista na sidebar
        updateSidebarLiveList(snapshot);
        
        console.log(`${liveCount} lives carregadas`);
        
    } catch (error) {
        console.error('Erro ao carregar lives:', error);
        const gridContainer = document.getElementById('liveGridContainer');
        if (gridContainer) {
            gridContainer.innerHTML = '<div class="lux-error">Erro ao carregar lives. Tente novamente.</div>';
        }
    }
}

function createLiveCard(live) {
    const card = document.createElement('div');
    card.className = 'lux-live-card';
    card.dataset.liveId = live.id;
    card.dataset.category = live.category;
    
    const viewerCount = live.viewerCount || 0;
    const isExclusive = live.privacy === 'paid' || live.privacy === 'ticket' || live.privacy === 'subscription';
    const ticketPrice = live.ticketPrice || 0;
    
    card.innerHTML = `
        <div class="lux-live-thumbnail">
            <img src="${live.thumbnail || 'https://via.placeholder.com/300x180?text=Ao+Vivo'}" 
                 alt="${live.title}"
                 onerror="this.src='https://via.placeholder.com/300x180?text=Ao+Vivo'">
            <span class="lux-live-badge ${isExclusive ? 'exclusive' : 'live'}">
                <i class="fas ${isExclusive ? 'fa-crown' : 'fa-circle'}"></i> 
                ${isExclusive ? 'EXCLUSIVO' : 'AO VIVO'}
            </span>
            <span class="lux-live-viewers">
                <i class="fas fa-eye"></i> ${formatNumber(viewerCount)}
            </span>
            ${ticketPrice > 0 ? `
            <span class="lux-live-ticket">
                <i class="fas fa-ticket-alt"></i> ${ticketPrice}
            </span>` : ''}
        </div>
        <div class="lux-live-content">
            <div class="lux-live-title-row">
                <h3 class="lux-live-title">${live.title || 'Live sem título'}</h3>
                ${live.isMultiHost ? '<span class="lux-multi-host-badge"><i class="fas fa-users"></i> Multi</span>' : ''}
            </div>
            <p class="lux-live-description">${live.description || ''}</p>
            <div class="lux-live-meta">
                <div class="lux-live-host">
                    <img src="${live.hostPhoto || 'https://via.placeholder.com/30'}" 
                         alt="${live.hostName}" class="lux-host-avatar">
                    <span>${live.hostName}</span>
                    ${live.hostVerified ? '<i class="fas fa-check-circle verified"></i>' : ''}
                </div>
                <div class="lux-live-stats">
                    <span><i class="fas fa-heart"></i> ${live.likes || 0}</span>
                    <span><i class="fas fa-gift"></i> ${live.giftCount || 0}</span>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar event listener
    card.addEventListener('click', () => joinLive(live.id));
    
    return card;
}

function updateSidebarLiveList(snapshot) {
    const sidebarList = document.getElementById('sidebarLiveList');
    if (!sidebarList) return;
    
    sidebarList.innerHTML = '';
    
    let count = 0;
    snapshot.forEach(doc => {
        const live = { id: doc.id, ...doc.data() };
        if (live.status === 'active' && count < 5) { // Limitar a 5 na sidebar
            const item = document.createElement('div');
            item.className = 'lux-live-list-item';
            item.dataset.liveId = live.id;
            
            item.innerHTML = `
                <h4>${live.title || 'Live'}</h4>
                <p>${live.hostName} • ${live.viewerCount || 0} espectadores</p>
            `;
            
            item.addEventListener('click', () => joinLive(live.id));
            sidebarList.appendChild(item);
            count++;
        }
    });
    
    if (count === 0) {
        sidebarList.innerHTML = '<div class="lux-no-lives">Nenhuma live ativa</div>';
    }
}


// ============================================
// VALIDAR USUÁRIO - NOVA FUNÇÃO
// ============================================

async function validateUserData() {
    try {
        if (!currentUser) {
            console.error('Usuário não autenticado');
            return false;
        }
        
        // Verificar se o documento do usuário existe
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (!userDoc.exists) {
            // Criar documento do usuário se não existir
            const defaultUserData = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Usuário ' + currentUser.uid.substring(0, 8),
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || 'https://via.placeholder.com/150',
                balance: 0,
                diamonds: 100,
                role: 'user',
                level: 1,
                experience: 0,
                followers: 0,
                following: [],
                totalEarnings: 0,
                isVerified: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(currentUser.uid).set(defaultUserData);
            userData = defaultUserData;
            console.log('Documento do usuário criado:', defaultUserData);
        } else {
            userData = userDoc.data();
            console.log('Dados do usuário carregados:', userData);
        }
        
        // Garantir que userData tenha todos os campos necessários
        userData = {
            ...userData,
            displayName: userData.displayName || currentUser.displayName || 'Usuário',
            photoURL: userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/150',
            isVerified: userData.isVerified || false
        };
        
        return true;
        
    } catch (error) {
        console.error('Erro ao validar dados do usuário:', error);
        return false;
    }
}
// ============================================
// CRIAR LIVE - VERSÃO ROBUSTA COM MELHOR TRATAMENTO DE ERROS
// ============================================
let isCreatingLive = false; // Variável global para controlar estado
// ============================================
// CRIAR LIVE - VERSÃO COM DEBUG DETALHADO
// ============================================

// ============================================
// CAPTURAR THUMBNAIL - VERSÃO SIMPLIFICADA
// ============================================

async function captureThumbnail(stream) {
    return new Promise((resolve) => {
        console.log('📸 [DEBUG] Iniciando captura de thumbnail');
        
        // Se não houver stream, retornar null imediatamente
        if (!stream) {
            console.log('📸 [DEBUG] Sem stream, retornando placeholder');
            resolve(null);
            return;
        }
        
        try {
            // Criar canvas fixo sem usar vídeo
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext('2d');
            
            // Criar cor de fundo
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Adicionar texto
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('AO VIVO', canvas.width / 2, canvas.height / 2);
            
            // Adicionar subtexto
            ctx.font = '14px Arial';
            ctx.fillText('Live em andamento', canvas.width / 2, canvas.height / 2 + 30);
            
            // Converter para data URL
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            
            console.log('📸 [DEBUG] Thumbnail criada com sucesso');
            resolve(thumbnail);
            
        } catch (error) {
            console.error('📸 [DEBUG] Erro ao criar thumbnail:', error);
            resolve(null);
        }
    });
}

// ============================================
// CRIAR LIVE - VERSÃO SEM THUMBNAIL COMPLEXA
// ============================================

// ============================================
// START BROADCAST - VERSÃO SIMPLIFICADA
// ============================================

async function startBroadcast(stream, liveId) {
    return new Promise((resolve) => {
        console.log('📡 [DEBUG] Iniciando broadcast simplificado');
        
        try {
            // Armazenar stream localmente
            localStream = stream;
            isBroadcasting = true;
            
            // Configurar vídeo local
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = stream;
                localVideo.muted = true;
                localVideo.style.display = 'block';
                
                localVideo.play().catch(e => {
                    console.log('⚠️ [DEBUG] Auto-play do vídeo local prevenido');
                });
            }
            
            // Atualizar status no Firestore
            db.collection('liveStreams').doc(liveId).update({
                hasActiveStream: true,
                streamUrl: `webrtc://luxmeet.live/${liveId}`,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log('✅ [DEBUG] Status do stream atualizado');
                resolve();
            }).catch(error => {
                console.log('⚠️ [DEBUG] Erro ao atualizar status, continuando...');
                resolve(); // Resolver mesmo com erro
            });
            
        } catch (error) {
            console.error('❌ [DEBUG] Erro no broadcast:', error);
            resolve(); // Sempre resolver para não travar
        }
    });
}

// ============================================
// VERIFICAR E CORRIGIR CSS DO MODAL
// ============================================

// Adicione este CSS no seu arquivo ou via JavaScript
function injectModalCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* FORÇAR FECHAMENTO DE MODAIS */
        .lux-modal[style*="display: none"],
        .lux-modal.hidden {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
        
        /* REMOVER BACKDROP */
        .lux-modal-backdrop {
            display: none !important;
        }
        
        /* GARANTIR QUE MODAL ABERTO SEJA VISÍVEL */
        .lux-modal:not([style*="display: none"]):not(.hidden) {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        /* CORRIGIR Z-INDEX */
        .lux-modal {
            z-index: 10000 !important;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ CSS de modal injetado');
}

// Executar após o DOM carregar
document.addEventListener('DOMContentLoaded', injectModalCSS);

// ============================================
// FUNÇÃO FORÇAR FECHAMENTO DE TODOS MODAIS
// ============================================

function forceCloseAllModals() {
    console.log('🔒 Forçando fechamento de todos os modais');
    
    // Fechar todos os modais
    document.querySelectorAll('.lux-modal').forEach(modal => {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
        modal.classList.remove('open', 'active', 'show');
    });
    
    // Restaurar scroll do body
    document.body.style.overflow = 'auto';
    document.body.classList.remove('modal-open');
    
    console.log('✅ Todos os modais fechados');
}


// ============================================
// FUNÇÃO CLOSE MODAL - VERSÃO ROBUSTA
// ============================================
function closeModal(modalId) {
    console.log(`🔒 Fechando modal: ${modalId}`);
    
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal ${modalId} não encontrado`);
        return;
    }
    
    // Método 1: Remover classe
    modal.classList.remove('open', 'active', 'show');
    
    // Método 2: Definir display
    modal.style.display = 'none';
    
    // Método 3: Definir opacity e visibility
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    
    // Método 4: Remover do fluxo
    modal.style.position = 'fixed';
    modal.style.top = '-100%';
    modal.style.left = '-100%';
    
    // Restaurar scroll do body
    document.body.style.overflow = 'auto';
    document.body.classList.remove('modal-open');
    
    // Forçar reflow
    void modal.offsetHeight;
    
    console.log(`✅ Modal ${modalId} fechado`);
    
    // Verificar se realmente fechou
    setTimeout(() => {
        const computedStyle = window.getComputedStyle(modal);
        console.log(`Verificação pós-fechamento: display=${computedStyle.display}, visibility=${computedStyle.visibility}`);
    }, 100);
}

// ============================================
// VERIFICAR SE O MODAL REALMENTE FECHA
// ============================================

function checkModalState() {
    const modal = document.getElementById('createLiveModal');
    if (!modal) {
        console.log('❌ Modal createLiveModal não existe no DOM');
        return;
    }
    
    const computedStyle = window.getComputedStyle(modal);
    console.log('🔍 Estado do modal createLiveModal:');
    console.log('- display:', computedStyle.display);
    console.log('- visibility:', computedStyle.visibility);
    console.log('- opacity:', computedStyle.opacity);
    console.log('- classes:', modal.className);
    
    // Se ainda estiver visível, forçar fechamento
    if (computedStyle.display !== 'none') {
        console.log('⚠️ Modal ainda visível, forçando fechamento...');
        modal.style.display = 'none';
    }
}

// ============================================
// TESTE DE CRIAÇÃO SIMPLES (para diagnóstico)
// ============================================

async function testCreateLiveSimple() {
    try {
        console.log('🧪 TESTE: Criando live simplificada...');
        
        // Criar dados mínimos
        const testLiveData = {
            hostId: currentUser.uid,
            hostName: 'Teste Host',
            title: 'Live de Teste',
            status: 'active',
            viewerCount: 1,
            thumbnail: 'https://via.placeholder.com/300x180?text=Teste'
        };
        
        const liveRef = await db.collection('liveStreams').add(testLiveData);
        console.log('✅ TESTE: Live criada com ID:', liveRef.id);
        
        // Fechar modal
        closeModal('createLiveModal');
        
        // Mostrar player
        showLivePlayer(testLiveData, true);
        
        showToast('Live de teste criada!', 'success');
        
    } catch (error) {
        console.error('❌ TESTE: Erro:', error);
    }
}





// ============================================
// VERIFICAR E CORRIGIR PROBLEMAS DE EXTENSÕES
// ============================================

function checkForExtensionIssues() {
    // Verificar se estamos em um contexto seguro
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.warn('⚠️ Site não está usando HTTPS. Algumas funcionalidades podem não funcionar.');
    }
    
    // Detectar extensões que podem interferir
    const problematicExtensions = [
        'uBlock',
        'AdBlock',
        'Privacy',
        'Ghostery',
        'ScriptSafe'
    ];
    
    // Verificar se alguma mensagem de erro de extensão aparece
    const originalConsoleError = console.error;
    console.error = function(...args) {
        if (args[0] && typeof args[0] === 'string') {
            if (args[0].includes('Receiving end does not exist') ||
                args[0].includes('extension') ||
                args[0].includes('chrome-extension')) {
                console.warn('⚠️ Possível interferência de extensão detectada');
                showToast('Desative extensões que bloqueiam scripts e tente novamente', 'warning');
            }
        }
        originalConsoleError.apply(console, args);
    };
}

// Executar verificação
checkForExtensionIssues();

async function setupSimpleWebRTC(liveId) {
    try {
        // Para um MVP, usaremos um sistema simplificado
        // Em produção, implemente WebRTC completo com servidor de sinalização
        
        // Criar URL de streaming simulada (apenas para demonstração)
        const streamUrl = `webrtc://luxmeet.live/${liveId}/${currentUser.uid}`;
        
        // Salvar no Firestore para espectadores acessarem
        await db.collection('liveStreams').doc(liveId).update({
            streamUrl: streamUrl,
            webrtcConfig: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ],
                sdpSemantics: 'unified-plan'
            }
        });
        
        console.log('📡 WebRTC configurado (simulado)');
        
    } catch (error) {
        console.error('⚠️ Erro na configuração WebRTC:', error);
    }
}
async function stopBroadcast() {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (currentLiveId) {
            // Atualizar status da live para encerrada
            await db.collection('liveStreams').doc(currentLiveId).update({
                status: 'ended',
                endTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        isBroadcasting = false;
        currentLiveId = null;
        
        console.log('Broadcast encerrado');
        
    } catch (error) {
        console.error('Erro ao encerrar broadcast:', error);
    }
}

// ============================================
// ASSISTIR LIVE
// ============================================
// ============================================
// ASSISTIR LIVE (ATUALIZADA)
// ============================================

async function joinLive(liveId) {
    try {
        console.log(`🎯 Entrando na live ${liveId}...`);
        
        // Obter dados da live
        const liveDoc = await db.collection('liveStreams').doc(liveId).get();
        
        if (!liveDoc.exists) {
            showToast('Live não encontrada', 'error');
            return;
        }
        
        const liveData = liveDoc.data();
        currentLiveId = liveId;
        
        // Verificar status
        if (liveData.status !== 'active') {
            showToast('Esta live já foi encerrada', 'warning');
            return;
        }
        
        // Verificar acesso (se for paga)
        if (liveData.privacy === 'ticket' && liveData.ticketPrice > 0) {
            const hasAccess = await checkLiveAccess(liveId);
            if (!hasAccess) {
                showTicketPurchaseModal(liveData);
                return;
            }
        }
        
        // Registrar viewer (com retry em caso de concorrência)
        await registerViewerWithRetry(liveId, 3);
        
        // Mostrar player
        showLivePlayer(liveData, false);
        isWatching = true;
        
        // Configurar chat
        setupLiveChat(liveId);
        
        // Configurar listener para atualizações em tempo real
        setupLiveRealtimeListener(liveId, false);
        
        // Tentar conectar ao stream
        await connectToLiveStream(liveData);
        
        showToast('✅ Entrou na live com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao entrar na live:', error);
        showToast('Erro ao entrar na live', 'error');
    }
}

async function registerViewerWithRetry(liveId, maxRetries) {
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            await registerViewer(liveId);
            return;
        } catch (error) {
            retries++;
            console.log(`Tentativa ${retries}/${maxRetries} falhou:`, error.message);
            
            if (retries === maxRetries) {
                throw error;
            }
            
            // Esperar antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function registerViewer(liveId) {
    try {
        const viewerData = {
            uid: currentUser.uid,
            name: userData.displayName,
            photo: userData.photoURL,
            role: 'viewer',
            joinedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };
        
        // Usar transaction para evitar condições de corrida
        await db.runTransaction(async (transaction) => {
            const liveRef = db.collection('liveStreams').doc(liveId);
            const liveDoc = await transaction.get(liveRef);
            
            if (!liveDoc.exists) {
                throw new Error('Live não encontrada');
            }
            
            const liveData = liveDoc.data();
            const viewers = liveData.viewers || {};
            
            // Adicionar viewer
            viewers[currentUser.uid] = viewerData;
            
            // Calcular novo contador
            const viewerCount = Object.keys(viewers).length;
            
            // Atualizar
            transaction.update(liveRef, {
                viewers: viewers,
                viewerCount: viewerCount,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        console.log(`👁️ Viewer registrado: ${currentUser.uid}`);
        
        // Atualizar estatísticas do usuário
        await updateUserViewingStats();
        
    } catch (error) {
        console.error('❌ Erro ao registrar viewer:', error);
        throw error;
    }
}

async function updateUserViewingStats() {
    try {
        await db.collection('users').doc(currentUser.uid).update({
            'stats.livesWatched': firebase.firestore.FieldValue.increment(1),
            'stats.lastWatched': new Date().toISOString(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

async function checkLiveAccess(liveId) {
    try {
        // Verificar se o usuário já comprou acesso a esta live
        const accessDoc = await db.collection('ticketPurchases')
            .doc(`${liveId}_${currentUser.uid}`)
            .get();
        
        return accessDoc.exists;
    } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        return false;
    }
}
// ============================================
// MOSTRAR PLAYER DA LIVE (ATUALIZADA)
// ============================================
// ============================================
// MOSTRAR PLAYER DA LIVE (COM VERIFICAÇÕES DE SEGURANÇA)
// ============================================

// ============================================
// SISTEMA DE CHAT
// ============================================

function setupLiveChat(liveId) {
    const chatMessages = document.getElementById('liveChatMessages');
    if (!chatMessages) return;
    
    // Limpar mensagens anteriores
    chatMessages.innerHTML = `
        <div class="lux-chat-welcome">
            <i class="fas fa-comment-dots"></i>
            <p>Seja bem-vindo ao chat da live!<br>Se comporte com respeito.</p>
        </div>
    `;
    
    // Configurar listener para novas mensagens
    db.collection('liveStreams').doc(liveId)
        .collection('chat')
        .orderBy('timestamp', 'asc')
        .limit(100)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    addChatMessage(change.doc.data());
                }
            });
            
            // Auto-scroll para a última mensagem
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('liveChatMessages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `lux-chat-message ${message.type || 'normal'}`;
    
    if (message.type === 'system') {
        messageElement.innerHTML = `
            <div class="lux-system-message">
                <i class="fas fa-info-circle"></i>
                <span>${message.text}</span>
            </div>
        `;
    } else if (message.type === 'gift') {
        messageElement.innerHTML = `
            <div class="lux-gift-message">
                <i class="fas fa-gift"></i>
                <span><strong>${message.userName}</strong> enviou ${message.giftName}!</span>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="lux-user-message">
                <img src="${message.userPhoto || 'https://via.placeholder.com/30'}" 
                     alt="${message.userName}" 
                     class="lux-message-avatar">
                <div class="lux-message-content">
                    <span class="lux-message-sender">${message.userName}</span>
                    <span class="lux-message-text">${message.text}</span>
                </div>
            </div>
        `;
    }
    
    chatMessages.appendChild(messageElement);
}

async function sendChatMessage() {
    if (!currentLiveId) {
        showToast('Você não está em uma live', 'error');
        return;
    }
    
    const input = document.getElementById('liveChatInput');
    const message = input?.value.trim();
    
    if (!message) return;
    
    try {
        await db.collection('liveStreams').doc(currentLiveId).collection('chat').add({
            userId: currentUser.uid,
            userName: userData.displayName,
            userPhoto: userData.photoURL,
            text: message,
            type: 'normal',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        input.value = '';
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        showToast('Erro ao enviar mensagem', 'error');
    }
}

// ============================================
// SISTEMA DE PRESENTES
// ============================================

async function loadGifts() {
    try {
        const container = document.getElementById('giftsContainer');
        if (!container) return;
        
        container.innerHTML = '<div class="lux-loading-gifts"><i class="fas fa-spinner fa-spin"></i><p>Carregando presentes...</p></div>';
        
        // Em produção, carregue os presentes do Firestore
        // Por enquanto, usaremos dados mockados
        const gifts = [
            { id: 1, name: 'Rose', price: 10, image: '🌹', category: 'cheap' },
            { id: 2, name: 'Coração', price: 50, image: '❤️', category: 'popular' },
            { id: 3, name: 'Estrela', price: 100, image: '⭐', category: 'popular' },
            { id: 4, name: 'Diamante', price: 500, image: '💎', category: 'exclusive' },
            { id: 5, name: 'Coroa', price: 1000, image: '👑', category: 'exclusive' },
            { id: 6, name: 'Fogo', price: 200, image: '🔥', category: 'animated' }
        ];
        
        container.innerHTML = '';
        
        gifts.forEach(gift => {
            const giftElement = document.createElement('div');
            giftElement.className = 'lux-gift-item';
            giftElement.dataset.giftId = gift.id;
            giftElement.dataset.price = gift.price;
            
            giftElement.innerHTML = `
                <div class="lux-gift-icon">${gift.image}</div>
                <div class="lux-gift-info">
                    <h4>${gift.name}</h4>
                    <p><i class="fas fa-gem"></i> ${gift.price}</p>
                </div>
            `;
            
            giftElement.addEventListener('click', () => selectGift(gift));
            container.appendChild(giftElement);
        });
        
        console.log('Presentes carregados');
        
    } catch (error) {
        console.error('Erro ao carregar presentes:', error);
        const container = document.getElementById('giftsContainer');
        if (container) {
            container.innerHTML = '<div class="lux-error">Erro ao carregar presentes</div>';
        }
    }
}

function selectGift(gift) {
    // Remover seleção anterior
    document.querySelectorAll('.lux-gift-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Selecionar novo presente
    const giftElement = document.querySelector(`[data-gift-id="${gift.id}"]`);
    if (giftElement) {
        giftElement.classList.add('selected');
    }
    
    // Habilitar botão de enviar
    const sendBtn = document.getElementById('sendSelectedGiftBtn');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.dataset.giftId = gift.id;
        sendBtn.dataset.giftName = gift.name;
        sendBtn.dataset.giftPrice = gift.price;
    }
    
    console.log('Presente selecionado:', gift.name);
}

async function sendGift() {
    const sendBtn = document.getElementById('sendSelectedGiftBtn');
    if (!sendBtn || !sendBtn.dataset.giftId) {
        showToast('Selecione um presente primeiro', 'warning');
        return;
    }
    
    if (!currentLiveId) {
        showToast('Você não está em uma live', 'error');
        return;
    }
    
    const giftId = sendBtn.dataset.giftId;
    const giftName = sendBtn.dataset.giftName;
    const giftPrice = parseInt(sendBtn.dataset.giftPrice);
    
    // Verificar saldo
    if (userData.diamonds < giftPrice) {
        showToast('Diamantes insuficientes', 'error');
        openModal('buyDiamondsModal');
        return;
    }
    
    try {
        // Atualizar saldo do usuário
        const newDiamonds = userData.diamonds - giftPrice;
        await db.collection('users').doc(currentUser.uid).update({
            diamonds: newDiamonds
        });
        
        userData.diamonds = newDiamonds;
        updateUserUI();
        
        // Obter dados da live para calcular distribuição
        const liveDoc = await db.collection('liveStreams').doc(currentLiveId).get();
        const liveData = liveDoc.data();
        
        // Calcular distribuição 70/30
        const hostShare = giftPrice * 0.7;
        const platformShare = giftPrice * 0.3;
        
        // Atualizar host
        await db.collection('users').doc(liveData.hostId).update({
            balance: firebase.firestore.FieldValue.increment(hostShare),
            totalEarnings: firebase.firestore.FieldValue.increment(hostShare)
        });
        
        // Atualizar estatísticas da live
        await db.collection('liveStreams').doc(currentLiveId).update({
            giftCount: firebase.firestore.FieldValue.increment(1),
            totalEarnings: firebase.firestore.FieldValue.increment(giftPrice),
            hostEarnings: firebase.firestore.FieldValue.increment(hostShare),
            platformEarnings: firebase.firestore.FieldValue.increment(platformShare)
        });
        
        // Adicionar mensagem no chat
        await db.collection('liveStreams').doc(currentLiveId).collection('chat').add({
            userId: currentUser.uid,
            userName: userData.displayName,
            userPhoto: userData.photoURL,
            giftId: giftId,
            giftName: giftName,
            giftPrice: giftPrice,
            type: 'gift',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar animação
        showGiftAnimation(giftName);
        
        // Fechar modal
        closeModal('giftModal');
        
        showToast(`Presente ${giftName} enviado!`, 'success');
        
        // Atualizar contador de presentes no player
        const giftCountElement = document.getElementById('giftCount');
        if (giftCountElement) {
            const currentCount = parseInt(giftCountElement.textContent) || 0;
            giftCountElement.textContent = currentCount + 1;
        }
        
    } catch (error) {
        console.error('Erro ao enviar presente:', error);
        showToast('Erro ao enviar presente', 'error');
    }
}

function showGiftAnimation(giftName) {
    const animationContainer = document.getElementById('giftAnimationContainer');
    if (!animationContainer) return;
    
    const emojis = {
        'Rose': '🌹',
        'Coração': '❤️',
        'Estrela': '⭐',
        'Diamante': '💎',
        'Coroa': '👑',
        'Fogo': '🔥'
    };
    
    const emoji = emojis[giftName] || '🎁';
    
    const animation = document.createElement('div');
    animation.className = 'lux-gift-animation';
    animation.textContent = emoji;
    animation.style.position = 'fixed';
    animation.style.top = '50%';
    animation.style.left = '50%';
    animation.style.transform = 'translate(-50%, -50%)';
    animation.style.fontSize = '80px';
    animation.style.zIndex = '10000';
    animation.style.pointerEvents = 'none';
    animation.style.animation = 'giftAnimation 2s ease-out forwards';
    
    animationContainer.appendChild(animation);
    
    // Remover após a animação
    setTimeout(() => {
        animation.remove();
    }, 2000);
}

// ============================================
// SISTEMA DE COMPRA DE DIAMANTES
// ============================================

function setupDiamondPurchase() {
    // Selecionar pacote
    document.querySelectorAll('.select-package-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.lux-package-card');
            const diamonds = parseInt(card.dataset.diamonds);
            const price = parseFloat(card.dataset.price);
            const bonus = Math.floor(diamonds * 0.1); // 10% de bônus
            
            // Atualizar resumo
            document.getElementById('selectedDiamonds').textContent = diamonds;
            document.getElementById('selectedBonus').textContent = bonus;
            document.getElementById('selectedTotal').textContent = `R$ ${price.toFixed(2)}`;
            
            // Habilitar botão de compra
            const confirmBtn = document.getElementById('confirmPurchaseBtn');
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.dataset.diamonds = diamonds;
                confirmBtn.dataset.price = price;
                confirmBtn.dataset.bonus = bonus;
            }
            
            // Remover seleção anterior
            document.querySelectorAll('.lux-package-card.selected').forEach(c => {
                c.classList.remove('selected');
            });
            
            // Adicionar seleção atual
            card.classList.add('selected');
            
            console.log('Pacote selecionado:', diamonds, 'diamantes');
        });
    });
}

async function purchaseDiamonds() {
    const confirmBtn = document.getElementById('confirmPurchaseBtn');
    if (!confirmBtn || confirmBtn.disabled) return;
    
    const diamonds = parseInt(confirmBtn.dataset.diamonds);
    const price = parseFloat(confirmBtn.dataset.price);
    const bonus = parseInt(confirmBtn.dataset.bonus);
    const totalDiamonds = diamonds + bonus;
    
    try {
        // Em produção, aqui você integraria com um gateway de pagamento
        // Por enquanto, simularemos a compra
        
        // Atualizar saldo do usuário
        const newDiamonds = userData.diamonds + totalDiamonds;
        await db.collection('users').doc(currentUser.uid).update({
            diamonds: newDiamonds
        });
        
        userData.diamonds = newDiamonds;
        updateUserUI();
        
        // Registrar transação
        await db.collection('transactions').add({
            userId: currentUser.uid,
            type: 'diamond_purchase',
            amount: price,
            diamonds: totalDiamonds,
            status: 'completed',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Fechar modal
        closeModal('buyDiamondsModal');
        
        showToast(`${totalDiamonds} diamantes adquiridos com sucesso!`, 'success');
        
    } catch (error) {
        console.error('Erro ao comprar diamantes:', error);
        showToast('Erro ao processar compra', 'error');
    }
}

// ============================================
// SISTEMA DE TICKETS PARA LIVE PAGA
// ============================================

function showTicketPurchaseModal(liveData) {
    Swal.fire({
        title: 'Live Exclusiva',
        html: `
            <div style="text-align: center;">
                <h3>${liveData.title}</h3>
                <p>${liveData.description || 'Live exclusiva'}</p>
                <div style="font-size: 48px; margin: 20px 0;">🎟️</div>
                <h2>${liveData.ticketPrice} diamantes</h2>
                <p>Para assistir esta live, adquira o ticket</p>
                <p><small>70% vai para o criador, 30% para a plataforma</small></p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Comprar Ticket',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d4af37',
        background: '#1a1a2e',
        color: '#fff',
        customClass: {
            popup: 'lux-swal-popup'
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            await purchaseTicket(liveData);
        }
    });
}

async function purchaseTicket(liveData) {
    try {
        const ticketPrice = liveData.ticketPrice;
        
        // Verificar saldo
        if (userData.diamonds < ticketPrice) {
            showToast('Diamantes insuficientes', 'error');
            openModal('buyDiamondsModal');
            return;
        }
        
        // Calcular distribuição
        const hostShare = ticketPrice * 0.7;
        const platformShare = ticketPrice * 0.3;
        
        // Processar transação
        const batch = db.batch();
        
        // Deduzir do comprador
        const userRef = db.collection('users').doc(currentUser.uid);
        batch.update(userRef, {
            diamonds: userData.diamonds - ticketPrice
        });
        
        // Adicionar ao host
        const hostRef = db.collection('users').doc(liveData.hostId);
        batch.update(hostRef, {
            balance: firebase.firestore.FieldValue.increment(hostShare),
            totalEarnings: firebase.firestore.FieldValue.increment(hostShare)
        });
        
        // Registrar acesso
        const accessRef = db.collection('ticketPurchases').doc(`${liveData.id}_${currentUser.uid}`);
        batch.set(accessRef, {
            liveId: liveData.id,
            userId: currentUser.uid,
            hostId: liveData.hostId,
            price: ticketPrice,
            purchasedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        
        // Atualizar estatísticas da live
        const liveRef = db.collection('liveStreams').doc(liveData.id);
        batch.update(liveRef, {
            totalEarnings: firebase.firestore.FieldValue.increment(ticketPrice),
            hostEarnings: firebase.firestore.FieldValue.increment(hostShare),
            platformEarnings: firebase.firestore.FieldValue.increment(platformShare),
            ticketSales: firebase.firestore.FieldValue.increment(1)
        });
        
        await batch.commit();
        
        // Atualizar dados locais
        userData.diamonds -= ticketPrice;
        updateUserUI();
        
        showToast('Ticket adquirido com sucesso!', 'success');
        
        // Entrar na live
        joinLive(liveData.id);
        
    } catch (error) {
        console.error('Erro ao comprar ticket:', error);
        showToast('Erro ao processar pagamento', 'error');
    }
}

// ============================================
// SISTEMA DE MISSÕES
// ============================================

async function loadMissions() {
    try {
        const missionsList = document.getElementById('missionsList');
        if (!missionsList) return;
        
        // Em produção, carregue as missões do Firestore
        // Por enquanto, usaremos missões mockadas
        
        const missions = [
            {
                id: 1,
                title: 'Assistir 30 minutos de lives',
                description: 'Assista qualquer live por pelo menos 30 minutos',
                progress: 18,
                target: 30,
                reward: 50,
                icon: 'fa-eye'
            },
            {
                id: 2,
                title: 'Enviar 3 presentes',
                description: 'Envie presentes para seus criadores favoritos',
                progress: 1,
                target: 3,
                reward: 100,
                icon: 'fa-gift'
            },
            {
                id: 3,
                title: 'Seguir 5 criadores',
                description: 'Descubra e siga novos criadores',
                progress: 2,
                target: 5,
                reward: 75,
                icon: 'fa-user-plus'
            },
            {
                id: 4,
                title: 'Dar like em 10 lives',
                description: 'Mostre apoio curtindo as lives',
                progress: 5,
                target: 10,
                reward: 60,
                icon: 'fa-heart'
            }
        ];
        
        missionsList.innerHTML = '';
        
        missions.forEach(mission => {
            const percent = (mission.progress / mission.target) * 100;
            
            const missionElement = document.createElement('div');
            missionElement.className = 'lux-mission-item';
            missionElement.innerHTML = `
                <div class="lux-mission-icon">
                    <i class="fas ${mission.icon}"></i>
                </div>
                <div class="lux-mission-details">
                    <h4>${mission.title}</h4>
                    <p>${mission.description}</p>
                    <div class="lux-mission-progress">
                        <div class="lux-progress-bar small">
                            <div class="lux-progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <span>${mission.progress}/${mission.target}</span>
                    </div>
                </div>
                <div class="lux-mission-reward">
                    <span class="lux-reward-amount">+${mission.reward}</span>
                    <i class="fas fa-gem"></i>
                </div>
            `;
            
            missionsList.appendChild(missionElement);
        });
        
    } catch (error) {
        console.error('Erro ao carregar missões:', error);
    }
}

// ============================================
// SISTEMA DE BATALHAS
// ============================================

async function loadBattles() {
    try {
        const battlesList = document.getElementById('battlesList');
        if (!battlesList) return;
        
        const snapshot = await db.collection('battles')
            .where('status', '==', 'active')
            .limit(10)
            .get();
        
        battlesList.innerHTML = '';
        
        if (snapshot.empty) {
            battlesList.innerHTML = `
                <div class="lux-no-battles">
                    <i class="fas fa-trophy"></i>
                    <p>Nenhuma batalha ativa no momento</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach(doc => {
            const battle = { id: doc.id, ...doc.data() };
            const battleElement = createBattleCard(battle);
            battlesList.appendChild(battleElement);
        });
        
    } catch (error) {
        console.error('Erro ao carregar batalhas:', error);
    }
}

function createBattleCard(battle) {
    const element = document.createElement('div');
    element.className = 'lux-battle-card';
    
    // Calcular tempo restante
    const endTime = new Date(battle.endTime.toDate());
    const now = new Date();
    const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    element.innerHTML = `
        <div class="lux-battle-header">
            <h4>Batalha ao Vivo</h4>
            <span class="lux-battle-timer">${minutes}:${seconds.toString().padStart(2, '0')}</span>
        </div>
        <div class="lux-battle-participants">
            <div class="lux-battle-participant">
                <img src="https://via.placeholder.com/60" alt="Desafiante">
                <span>${battle.challengerName || 'Desafiante'}</span>
                <strong>${battle.challengerScore || 0}</strong>
            </div>
            <div class="lux-battle-vs">VS</div>
            <div class="lux-battle-participant">
                <img src="https://via.placeholder.com/60" alt="Desafiado">
                <span>${battle.targetName || 'Desafiado'}</span>
                <strong>${battle.targetScore || 0}</strong>
            </div>
        </div>
        <div class="lux-battle-prize">
            <span><i class="fas fa-gem"></i> ${battle.prizePool || 0}</span>
        </div>
        <button class="lux-btn lux-btn-primary" onclick="joinBattle('${battle.id}')">
            <i class="fas fa-eye"></i> Assistir
        </button>
    `;
    
    return element;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Carregar dados específicos do modal
        if (modalId === 'giftModal') {
            loadGifts();
        } else if (modalId === 'missionsModal') {
            loadMissions();
        } else if (modalId === 'battleModal') {
            loadBattles();
        }
    }
}



function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer') || document.body;
    
    const toast = document.createElement('div');
    toast.className = `lux-toast lux-toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 
                         type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        showToast('Erro ao fazer logout', 'error');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {

     // Botão de teste (remova depois)
    document.getElementById('forceCloseModalBtn')?.addEventListener('click', forceCloseAllModals);
    
    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            forceCloseAllModals();
        }
    });
     // Botão Criar Live (no header)
    document.getElementById('createLiveBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal('createLiveModal');
    });
    
    // Botão no formulário de criação - APENAS UM EVENT LISTENER
    const createLiveForm = document.getElementById('createLiveForm');
    if (createLiveForm) {
        // Remover event listeners anteriores para evitar duplicação
        createLiveForm.removeEventListener('submit', createLive);
        
        // Adicionar apenas um listener
        createLiveForm.addEventListener('submit', function(e) {
            console.log('📝 Formulário submetido');
            createLive(e);
        });
        
        // Remover qualquer outro listener no botão de submit
        const submitBtn = createLiveForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        }
    }
    
    // Botão de cancelar criação
    document.getElementById('cancelCreateLive')?.addEventListener('click', () => {
        closeModal('createLiveModal');
    });
    
    // Sair da Live
    document.getElementById('exitLiveBtn')?.addEventListener('click', hideLivePlayer);
    
    // Enviar mensagem no chat
    document.getElementById('sendLiveChatBtn')?.addEventListener('click', sendChatMessage);
    document.getElementById('liveChatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Dar like na live
    document.getElementById('likeLiveBtn')?.addEventListener('click', async () => {
        if (!currentLiveId) return;
        
        try {
            await db.collection('liveStreams').doc(currentLiveId).update({
                likes: firebase.firestore.FieldValue.increment(1)
            });
            
            // Atualizar contador local
            const likeCountElement = document.getElementById('likeCount');
            if (likeCountElement) {
                const currentLikes = parseInt(likeCountElement.textContent) || 0;
                likeCountElement.textContent = currentLikes + 1;
            }
            
            showToast('Like enviado!', 'success');
            
        } catch (error) {
            console.error('Erro ao dar like:', error);
        }
    });
    
    // Enviar presente
    document.getElementById('sendGiftBtn')?.addEventListener('click', () => {
        openModal('giftModal');
    });
    
    document.getElementById('sendSelectedGiftBtn')?.addEventListener('click', sendGift);
    
    // Comprar diamantes
    document.getElementById('addFundsBtn')?.addEventListener('click', () => {
        openModal('buyDiamondsModal');
    });
    
    document.getElementById('buyMoreDiamondsBtn')?.addEventListener('click', () => {
        closeModal('giftModal');
        openModal('buyDiamondsModal');
    });
    
    document.getElementById('confirmPurchaseBtn')?.addEventListener('click', purchaseDiamonds);
    document.getElementById('cancelPurchaseBtn')?.addEventListener('click', () => {
        closeModal('buyDiamondsModal');
    });
    
    // Fechar modais com X
    document.querySelectorAll('.lux-modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            const modal = this.closest('.lux-modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Clicar fora do modal para fechar
    document.querySelectorAll('.lux-modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
    
    // Filtros de categoria
    document.querySelectorAll('.lux-category-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const category = this.dataset.category;
            filterLivesByCategory(category);
            
            // Atualizar botão ativo
            document.querySelectorAll('.lux-category-btn').forEach(b => {
                b.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    
    // Menu dropdown do usuário
    document.getElementById('userMenuBtn')?.addEventListener('click', function() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('userDropdown');
        const menuBtn = document.getElementById('userMenuBtn');
        
        if (dropdown && menuBtn && !menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // Configurar compra de diamantes
    setupDiamondPurchase();
    
    // Refresh lives
    document.getElementById('refreshLivesBtn')?.addEventListener('click', loadActiveLives);
    
    // Missões
    document.getElementById('missionsBtn')?.addEventListener('click', () => {
        openModal('missionsModal');
    });
    
    // Batalhas
    document.getElementById('battleBtn')?.addEventListener('click', () => {
        openModal('battleModal');
    });
    
    console.log('Event listeners configurados');
}

function filterLivesByCategory(category) {
    const cards = document.querySelectorAll('.lux-live-card');
    
    cards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ============================================
// INICIALIZAÇÃO QUANDO O DOM ESTIVER PRONTO
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ============================================
// FUNÇÕES GLOBAIS (para uso no HTML)
// ============================================

// Funções que podem ser chamadas diretamente do HTML
window.joinLive = joinLive;
window.openModal = openModal;
window.closeModal = closeModal;
window.selectGift = selectGift;
window.logout = logout;
window.sendChatMessage = sendChatMessage;

console.log('Lux Meet Live - JavaScript carregado');

// ============================================
// TESTAR CONEXÃO COM FIREBASE
// ============================================

async function testFirebaseConnection() {
    try {
        console.log('Testando conexão com Firebase...');
        
        // Testar autenticação
        if (!auth.currentUser) {
            console.log('Usuário não autenticado');
            return false;
        }
        
        // Testar Firestore - criar um documento de teste
        const testDoc = await db.collection('test').add({
            test: 'conexão',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userId: auth.currentUser.uid
        });
        
        console.log('Firestore conectado - Documento de teste criado:', testDoc.id);
        
        // Limpar documento de teste
        await testDoc.delete();
        
        return true;
        
    } catch (error) {
        console.error('Erro na conexão com Firebase:', error);
        showToast('Erro de conexão com o servidor', 'error');
        return false;
    }
}



// ============================================
// FUNÇÕES AUXILIARES ADICIONAIS
// ============================================

async function loadPageContent() {
    try {
        console.log('Carregando conteúdo da página...');
        
        // Carregar lives ativas
        await loadActiveLives();
        
        // Carregar estatísticas da plataforma
        await loadPlatformStats();
        
        // Carregar amigos online
        await loadOnlineFriends();
        
        console.log('✅ Conteúdo da página carregado');
    } catch (error) {
        console.error('❌ Erro ao carregar conteúdo:', error);
    }
}

async function loadPlatformStats() {
    try {
        // Carregar estatísticas gerais da plataforma
        const platformDoc = await db.collection('platform').doc('stats').get();
        
        if (platformDoc.exists) {
            const stats = platformDoc.data();
            
            // Atualizar elementos na UI
            const totalOnlineElement = document.getElementById('totalOnline');
            const todayGiftsElement = document.getElementById('todayGifts');
            const footerOnlineElement = document.getElementById('footerOnline');
            const footerLivesElement = document.getElementById('footerLives');
            const footerGiftsElement = document.getElementById('footerGifts');
            
            if (totalOnlineElement) {
                totalOnlineElement.textContent = stats.totalOnline || 0;
            }
            
            if (todayGiftsElement) {
                todayGiftsElement.textContent = stats.todayGifts || 0;
            }
            
            if (footerOnlineElement) {
                footerOnlineElement.textContent = stats.totalOnline || 0;
            }
            
            if (footerLivesElement) {
                footerLivesElement.textContent = stats.activeLives || 0;
            }
            
            if (footerGiftsElement) {
                footerGiftsElement.textContent = stats.todayGifts || 0;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

async function loadOnlineFriends() {
    try {
        // Em produção, carregue amigos do Firestore
        // Por enquanto, usaremos dados mockados
        const friendsList = document.getElementById('friendsList');
        
        if (!friendsList) return;
        
        // Dados mockados para demonstração
        const onlineFriends = [
            { id: 1, name: 'João Silva', avatar: 'https://via.placeholder.com/40' },
            { id: 2, name: 'Maria Santos', avatar: 'https://via.placeholder.com/40' },
            { id: 3, name: 'Pedro Costa', avatar: 'https://via.placeholder.com/40' }
        ];
        
        friendsList.innerHTML = '';
        
        onlineFriends.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = 'lux-friend-item';
            friendElement.innerHTML = `
                <img src="${friend.avatar}" alt="${friend.name}" class="lux-friend-avatar">
                <span class="lux-friend-name">${friend.name}</span>
                <span class="lux-friend-status online"></span>
            `;
            friendsList.appendChild(friendElement);
        });
        
        // Atualizar contador
        const onlineCountElement = document.getElementById('onlineFriendsCount');
        if (onlineCountElement) {
            onlineCountElement.textContent = onlineFriends.length;
        }
        
    } catch (error) {
        console.error('Erro ao carregar amigos:', error);
    }
}

function redirectToLogin() {
    // Verificar se estamos na página de login
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

function showApp() {
    // Ocultar tela de loading e mostrar aplicação
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.querySelector('.lux-live-app');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    if (app) {
        app.style.display = 'block';
        // Adicionar classe para animação de entrada
        app.classList.add('app-loaded');
    }
    
    console.log('🚀 Aplicação carregada com sucesso!');
}


// ============================================
// CONECTAR AO STREAM DA LIVE
// ============================================
// ============================================
// CONECTAR AO STREAM DA LIVE (COM TRATAMENTO DE ERROS)
// ============================================

async function connectToLiveStream(liveData) {
    try {
        console.log('📡 Conectando ao stream da live...');
        
        const videoElement = document.getElementById('liveVideo');
        if (!videoElement) {
            console.error('❌ Elemento de vídeo principal não encontrado');
            showVideoPlaceholder('Elemento de vídeo não encontrado');
            return;
        }
        
        // Resetar estado do vídeo
        videoElement.srcObject = null;
        videoElement.src = '';
        videoElement.removeAttribute('controls');
        
        // Mostrar placeholder inicial
        showVideoPlaceholder('🔗 Conectando à transmissão...');
        
        // Verificar se o host tem stream ativo
        if (!liveData.hasActiveStream) {
            showVideoPlaceholder('⌛ Aguardando transmissão...');
            return;
        }
        
        // Se o host for o próprio usuário (modo co-host)
        if (liveData.hostId === currentUser?.uid) {
            console.log('👤 Usuário é o host, usando stream local');
            
            if (localStream) {
                videoElement.srcObject = localStream;
                videoElement.play().catch(e => {
                    console.log('⚠️ Auto-play do stream local bloqueado:', e);
                    videoElement.setAttribute('controls', 'true');
                });
                hideVideoPlaceholder();
            }
            return;
        }
        
        // Tentar métodos de streaming
        const success = await tryStreamingMethods(liveData, videoElement);
        
        if (!success) {
            showVideoPlaceholder('❌ Não foi possível conectar à transmissão');
        }
        
    } catch (error) {
        console.error('❌ Erro ao conectar ao stream:', error);
        showVideoPlaceholder('⚠️ Erro na conexão com a transmissão');
    }
}

// ============================================
// FUNÇÕES PARA GERENCIAR PLACEHOLDER DE VÍDEO
// ============================================

function showVideoPlaceholder(message) {
    try {
        const placeholder = document.getElementById('videoPlaceholder');
        const mainVideo = document.getElementById('liveVideo');
        const statusText = document.getElementById('statusText');
        
        if (placeholder) {
            // Atualizar conteúdo do placeholder
            const icon = placeholder.querySelector('i') || document.createElement('i');
            const title = placeholder.querySelector('h3') || document.createElement('h3');
            const description = placeholder.querySelector('p') || document.createElement('p');
            
            icon.className = 'fas fa-broadcast-tower';
            title.textContent = message;
            description.textContent = 'Aguarde enquanto a transmissão é carregada';
            
            if (!placeholder.contains(icon)) placeholder.appendChild(icon);
            if (!placeholder.contains(title)) placeholder.appendChild(title);
            if (!placeholder.contains(description)) placeholder.appendChild(description);
            
            placeholder.style.display = 'flex';
        }
        
        if (mainVideo) {
            mainVideo.style.display = 'none';
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
        
    } catch (error) {
        console.error('❌ Erro ao mostrar placeholder:', error);
    }
}

function hideVideoPlaceholder() {
    try {
        const placeholder = document.getElementById('videoPlaceholder');
        const mainVideo = document.getElementById('liveVideo');
        const statusText = document.getElementById('statusText');
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        if (mainVideo) {
            mainVideo.style.display = 'block';
            mainVideo.classList.add('playing');
        }
        
        if (statusText) {
            statusText.textContent = 'Transmitindo ao vivo';
        }
        
        // Atualizar indicador de status
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.classList.add('live');
        }
        
    } catch (error) {
        console.error('❌ Erro ao ocultar placeholder:', error);
    }
}



// ============================================
// TENTAR MÉTODOS DE STREAMING (COM TRATAMENTO DE ERROS)
// ============================================

async function tryStreamingMethods(liveData, videoElement) {
    const methods = [
        { name: 'Simulação', func: simulateStream },
        { name: 'Fallback', func: fallbackStream }
    ];
    
    for (const method of methods) {
        try {
            console.log(`🔄 Tentando método: ${method.name}`);
            const success = await method.func(liveData, videoElement);
            
            if (success) {
                console.log(`✅ Conectado via ${method.name}`);
                hideVideoPlaceholder();
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Método ${method.name} falhou:`, error.message);
        }
    }
    
    return false;
}

async function simulateStream(liveData, videoElement) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Para demonstração, usar vídeo de placeholder
            // Em produção, substitua por WebRTC real
            
            // Criar elemento canvas para simular vídeo
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext('2d');
            
            // Desenhar fundo
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Desenhar texto
            ctx.fillStyle = '#d4af37';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('TRANSMISSÃO AO VIVO', canvas.width / 2, canvas.height / 2 - 20);
            
            ctx.fillStyle = '#94a3b8';
            ctx.font = '16px Arial';
            ctx.fillText(liveData.title || 'Live em andamento', canvas.width / 2, canvas.height / 2 + 20);
            
            // Criar stream a partir do canvas
            const stream = canvas.captureStream(30);
            videoElement.srcObject = stream;
            
            videoElement.play().then(() => {
                console.log('🎬 Stream simulado iniciado');
                resolve(true);
            }).catch(error => {
                console.log('⚠️ Auto-play bloqueado:', error);
                videoElement.setAttribute('controls', 'true');
                resolve(true);
            });
        }, 1000);
    });
}

async function fallbackStream(liveData, videoElement) {
    // Método de fallback usando vídeo estático
    return new Promise((resolve) => {
        videoElement.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        videoElement.loop = true;
        
        videoElement.oncanplay = () => {
            videoElement.play().then(() => {
                console.log('🎬 Fallback iniciado');
                resolve(true);
            }).catch(() => {
                videoElement.setAttribute('controls', 'true');
                resolve(true);
            });
        };
        
        videoElement.onerror = () => {
            console.log('❌ Fallback falhou');
            resolve(false);
        };
        
        // Timeout
        setTimeout(() => {
            if (videoElement.readyState < 2) { // MENOS DE LOADED
                resolve(false);
            }
        }, 5000);
    });
}
async function simulateStream(liveData, videoElement) {
    // Para demonstração, simularemos um stream
    // Em produção, substitua por WebRTC real
    
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mostrar vídeo de demonstração
            videoElement.src = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            videoElement.loop = true;
            videoElement.muted = false;
            
            videoElement.play().then(() => {
                console.log('🎬 Vídeo de demonstração iniciado');
                resolve(true);
            }).catch(error => {
                console.log('⚠️ Auto-play bloqueado:', error);
                videoElement.setAttribute('controls', 'true');
                resolve(true);
            });
        }, 500);
    });
}

async function tryWebRTCStream(liveData, videoElement) {
    // Implementação básica de WebRTC
    // Em produção, use um servidor de sinalização completo
    
    try {
        if (!liveData.webrtcConfig) {
            return false;
        }
        
        const configuration = liveData.webrtcConfig;
        const peerConnection = new RTCPeerConnection(configuration);
        
        peerConnection.ontrack = (event) => {
            console.log('🎬 Stream WebRTC recebido');
            if (videoElement.srcObject !== event.streams[0]) {
                videoElement.srcObject = event.streams[0];
                videoElement.play().catch(e => console.log('Auto-play WebRTC bloqueado'));
            }
        };
        
        // Simular conexão (em produção, use oferta/resposta real)
        setTimeout(() => {
            peerConnection.close();
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('WebRTC falhou:', error);
        return false;
    }
}

function showVideoPlaceholder(message) {
    const placeholder = document.getElementById('videoPlaceholder');
    const mainVideo = document.getElementById('liveVideo');
    
    if (placeholder) {
        placeholder.innerHTML = `
            <i class="fas fa-broadcast-tower"></i>
            <h3>${message}</h3>
            <p>Aguarde enquanto a transmissão é carregada</p>
        `;
        placeholder.style.display = 'flex';
    }
    
    if (mainVideo) {
        mainVideo.style.display = 'none';
    }
}


// ============================================
// ENCERRAR/SAIR DA LIVE
// ============================================

async function endLive() {
    try {
        if (!currentLiveId) return;
        
        const confirm = await Swal.fire({
            title: 'Encerrar Live?',
            text: 'Tem certeza que deseja encerrar a transmissão?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, encerrar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirm.isConfirmed) return;
        
        // Parar stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Atualizar status da live
        await db.collection('liveStreams').doc(currentLiveId).update({
            status: 'ended',
            endTime: firebase.firestore.FieldValue.serverTimestamp(),
            hasActiveStream: false
        });
        
        // Limpar listeners
        if (window.liveListeners && window.liveListeners[currentLiveId]) {
            window.liveListeners[currentLiveId]();
            delete window.liveListeners[currentLiveId];
        }
        
        // Mostrar mensagem de sucesso
        showToast('Live encerrada com sucesso', 'success');
        
        // Voltar para grade de lives
        hideLivePlayer();
        
        // Recarregar lives
        await loadActiveLives();
        
    } catch (error) {
        console.error('❌ Erro ao encerrar live:', error);
        showToast('Erro ao encerrar live', 'error');
    }
}

async function leaveLive() {
    try {
        if (!currentLiveId) return;
        
        // Remover viewer do contador
        await removeViewer(currentLiveId);
        
        // Limpar listeners
        if (window.liveListeners && window.liveListeners[currentLiveId]) {
            window.liveListeners[currentLiveId]();
            delete window.liveListeners[currentLiveId];
        }
        
        // Parar stream local se existir
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Voltar para grade de lives
        hideLivePlayer();
        
        showToast('Você saiu da live', 'info');
        
    } catch (error) {
        console.error('❌ Erro ao sair da live:', error);
    }
}

async function removeViewer(liveId) {
    try {
        await db.collection('liveStreams').doc(liveId).update({
            [`viewers.${currentUser.uid}`]: firebase.firestore.FieldValue.delete(),
            viewerCount: firebase.firestore.FieldValue.increment(-1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('👋 Viewer removido da live');
        
    } catch (error) {
        console.error('Erro ao remover viewer:', error);
    }
}

function hideLivePlayer() {
    const player = document.getElementById('livePlayer');
    const grid = document.getElementById('liveGrid');
    
    if (player) {
        player.classList.add('hidden');
        player.style.display = 'none';
    }
    
    if (grid) {
        grid.style.display = 'block';
    }
    
    // Limpar vídeo
    const videoElement = document.getElementById('liveVideo');
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.src = '';
        videoElement.removeAttribute('controls');
    }
    
    // Limpar stream local
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
    }
    
    // Resetar estado
    isBroadcasting = false;
    isWatching = false;
    currentLiveId = null;
    
    // Limpar chat
    const chatMessages = document.getElementById('liveChatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = `
            <div class="lux-chat-welcome">
                <i class="fas fa-comment-dots"></i>
                <p>Seja bem-vindo ao chat da live!<br>Se comporte com respeito.</p>
            </div>
        `;
    }
    
    console.log('🎬 Player da live ocultado');
}


// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function setupMediaControls(isHost) {
    // Toggle vídeo
    document.getElementById('toggleVideoBtn')?.addEventListener('click', function() {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const icon = this.querySelector('i');
                icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
                showToast(videoTrack.enabled ? 'Câmera ativada' : 'Câmera desativada', 'info');
            }
        }
    });
    
    // Toggle áudio
    document.getElementById('toggleAudioBtn')?.addEventListener('click', function() {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const icon = this.querySelector('i');
                icon.className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
                showToast(audioTrack.enabled ? 'Microfone ativado' : 'Microfone desativado', 'info');
            }
        }
    });
    
    // Tela cheia
    document.getElementById('toggleFullscreenBtn')?.addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
    const videoContainer = document.querySelector('.lux-video-container');
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().catch(err => {
            console.log(`Erro ao entrar em tela cheia: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function setupChatEvents() {
    // Enviar mensagem com Enter
    document.getElementById('liveChatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

function startWatchTimeTracker() {
    if (window.watchTimeInterval) {
        clearInterval(window.watchTimeInterval);
    }
    
    const startTime = Date.now();
    
    window.watchTimeInterval = setInterval(async () => {
        if (!currentLiveId) {
            clearInterval(window.watchTimeInterval);
            return;
        }
        
        const minutesWatched = Math.floor((Date.now() - startTime) / 60000);
        
        // Atualizar tempo assistido no Firestore (a cada 5 minutos)
        if (minutesWatched % 5 === 0) {
            try {
                await db.collection('liveStreams').doc(currentLiveId).update({
                    [`viewers.${currentUser.uid}.watchTime`]: minutesWatched,
                    [`viewers.${currentUser.uid}.lastSeen`]: new Date().toISOString()
                });
            } catch (error) {
                console.error('Erro ao atualizar watch time:', error);
            }
        }
        
        // Atualizar missões (se implementado)
        updateWatchTimeMission(minutesWatched);
        
    }, 60000); // A cada minuto
}



// ============================================
// VERIFICAR ELEMENTOS DO DOM (FUNÇÃO DE DEPURAÇÃO)
// ============================================

function checkDOMElements() {
    const requiredElements = [
        'livePlayer',
        'liveGrid',
        'livePlayerTitle',
        'liveHostName',
        'liveHostAvatar',
        'liveBadge',
        'exitLiveBtn',
        'liveVideo',
        'localVideo',
        'videoPlaceholder',
        'viewerCount',
        'likeCount',
        'giftCount',
        'earningsCount',
        'chatUserCount'
    ];
    
    console.log('🔍 Verificando elementos do DOM...');
    
    const missingElements = [];
    
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
            console.error(`❌ Elemento não encontrado: ${id}`);
        } else {
            console.log(`✅ Elemento encontrado: ${id}`);
        }
    });
    
    if (missingElements.length > 0) {
        console.error(`⚠️ Faltam ${missingElements.length} elementos:`, missingElements);
        showToast(`⚠️ ${missingElements.length} elementos do player não encontrados`, 'warning');
    } else {
        console.log('✅ Todos os elementos do player estão presentes');
    }
    
    return missingElements.length === 0;
}

// Chamar esta função durante a inicialização
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(checkDOMElements, 1000);
});





// ============================================
// SETUP LIVE REALTIME LISTENER (FUNÇÃO FALTANTE)
// ============================================

function setupLiveRealtimeListener(liveId, isHost) {
    console.log('👂 [DEBUG] Configurando listener para live:', liveId);
    
    // Remover listener anterior se existir
    if (window.liveListenerUnsubscribe) {
        window.liveListenerUnsubscribe();
    }
    
    // Configurar listener para atualizações em tempo real
    window.liveListenerUnsubscribe = db.collection('liveStreams').doc(liveId)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const liveData = doc.data();
                console.log('🔄 [DEBUG] Live atualizada:', {
                    viewers: liveData.viewerCount,
                    likes: liveData.likes,
                    gifts: liveData.giftCount
                });
                
                // Atualizar contadores na UI
                updateLiveUI(liveData);
                
                // Se for host, verificar se precisa mostrar avisos
                if (isHost) {
                    checkHostNotifications(liveData);
                }
            }
        }, (error) => {
            console.error('❌ [DEBUG] Erro no listener:', error);
        });
    
    console.log('✅ [DEBUG] Listener configurado');
}

// ============================================
// ATUALIZAR UI DA LIVE EM TEMPO REAL
// ============================================

function updateLiveUI(liveData) {
    // Atualizar contadores
    const viewerCountElement = document.getElementById('viewerCount');
    if (viewerCountElement) {
        viewerCountElement.textContent = formatNumber(liveData.viewerCount || 0);
    }
    
    const likeCountElement = document.getElementById('likeCount');
    if (likeCountElement) {
        likeCountElement.textContent = liveData.likes || 0;
    }
    
    const giftCountElement = document.getElementById('giftCount');
    if (giftCountElement) {
        giftCountElement.textContent = liveData.giftCount || 0;
    }
    
    // Atualizar contador no chat
    const chatUserCountElement = document.getElementById('chatUserCount');
    if (chatUserCountElement) {
        chatUserCountElement.textContent = liveData.viewerCount || 1;
    }
}

// ============================================
// VERIFICAR NOTIFICAÇÕES PARA HOST
// ============================================

function checkHostNotifications(liveData) {
    // Verificar se há novos presentes
    if (liveData.giftCount > (window.lastGiftCount || 0)) {
        showToast(`🎁 Novo presente recebido! Total: ${liveData.giftCount}`, 'success');
        window.lastGiftCount = liveData.giftCount;
    }
    
    // Verificar se há novos viewers
    if (liveData.viewerCount > (window.lastViewerCount || 0)) {
        console.log('👤 Novo viewer entrou na live');
        window.lastViewerCount = liveData.viewerCount;
    }
}

// ============================================
// CORRIGIR PERMISSÕES DE MÍDIA
// ============================================

async function requestMediaPermissions() {
    console.log('🎥 [DEBUG] Solicitando permissões de mídia...');
    
    try {
        // Verificar se já temos permissões
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoPermission = devices.some(device => device.kind === 'videoinput' && device.deviceId);
        const hasAudioPermission = devices.some(device => device.kind === 'audioinput' && device.deviceId);
        
        console.log('📱 [DEBUG] Status das permissões:', {
            video: hasVideoPermission,
            audio: hasAudioPermission
        });
        
        // Se já tem permissão, não pedir novamente (pode ser bloqueado pelo navegador)
        if (hasVideoPermission && hasAudioPermission) {
            console.log('✅ [DEBUG] Permissões já concedidas anteriormente');
            return true;
        }
        
        // Pedir permissões de forma mais explícita
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        console.log('✅ [DEBUG] Permissões concedidas, stream obtido');
        
        // Liberar stream imediatamente para não bloquear câmera
        stream.getTracks().forEach(track => track.stop());
        
        return true;
        
    } catch (error) {
        console.error('❌ [DEBUG] Erro ao solicitar permissões:', error);
        
        if (error.name === 'NotAllowedError') {
            showToast('Permissão de câmera/microfone necessária para transmitir', 'warning');
        }
        
        return false;
    }
}

// ============================================
// CRIAR LIVE - VERSÃO CORRIGIDA COM PERMISSÕES
// ============================================

async function createLive(event) {
    console.log('🔍 [DEBUG] Início da função createLive');
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (isCreatingLive) {
        console.log('⚠️ [DEBUG] Criação já em andamento, ignorando');
        return;
    }
    
    isCreatingLive = true;
    
    try {
        console.log('1. 📋 Validando formulário...');
        const titleInput = document.getElementById('liveTitle');
        const title = titleInput?.value.trim();
        
        if (!title) {
            showToast('Digite um título para a live', 'error');
            isCreatingLive = false;
            return;
        }
        
        console.log('✅ [DEBUG] Título válido:', title);
        
        // Desabilitar botão
        const submitBtn = document.querySelector('#createLiveForm button[type="submit"], #createLiveSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
        }
        
        console.log('2. 👤 Validando usuário...');
        if (!currentUser || !userData) {
            showToast('Usuário não autenticado', 'error');
            throw new Error('Usuário não autenticado');
        }
        
        console.log('3. 🎥 Solicitando permissões e stream...');
        let stream;
        
        try {
            // Primeiro verificar se podemos obter permissões
            const hasPermissions = await requestMediaPermissions();
            
            if (hasPermissions) {
                // Agora obter stream para transmissão
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: true
                });
                console.log('✅ [DEBUG] Stream obtido para transmissão');
            } else {
                console.log('⚠️ [DEBUG] Sem permissões, criando live sem stream');
                stream = null;
            }
            
        } catch (mediaError) {
            console.log('⚠️ [DEBUG] Erro ao obter stream:', mediaError.name);
            stream = null;
        }
        
        console.log('4. 📝 Preparando dados da live...');
        const liveData = {
            hostId: currentUser.uid,
            hostName: userData.displayName || 'Anônimo',
            hostPhoto: userData.photoURL || 'https://via.placeholder.com/150',
            hostVerified: userData.isVerified || false,
            title: title,
            description: document.getElementById('liveDescription')?.value.trim() || '',
            category: document.getElementById('liveCategory')?.value || 'social',
            privacy: document.getElementById('livePrivacy')?.value || 'public',
            status: 'active',
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            viewerCount: 1,
            likes: 0,
            giftCount: 0,
            totalEarnings: 0,
            thumbnail: 'https://via.placeholder.com/300x180?text=Ao+Vivo',
            hasActiveStream: stream !== null,
            streamingType: stream ? 'webrtc' : 'none',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('5. 🔥 Criando documento no Firestore...');
        const liveRef = await db.collection('liveStreams').add(liveData);
        currentLiveId = liveRef.id;
        console.log('✅ [DEBUG] Live criada com ID:', currentLiveId);
        
        console.log('6. 👁️ Adicionando host como viewer...');
        await db.collection('liveStreams').doc(currentLiveId).update({
            [`viewers.${currentUser.uid}`]: {
                uid: currentUser.uid,
                name: userData.displayName || 'Anônimo',
                photo: userData.photoURL || 'https://via.placeholder.com/150',
                role: 'host',
                joinedAt: new Date().toISOString()
            }
        });
        
        console.log('7. 📡 Configurando transmissão...');
        if (stream) {
            try {
                await startBroadcast(stream, currentLiveId);
                console.log('✅ [DEBUG] Transmissão configurada');
            } catch (broadcastError) {
                console.log('⚠️ [DEBUG] Erro na transmissão:', broadcastError);
            }
        } else {
            // Mostrar aviso se não tem stream
            showToast('⚠️ Live criada sem vídeo. Ative a câmera nas configurações.', 'warning');
        }
        
        console.log('8. 🚪 Fechando modal...');
        forceCloseAllModals();
        
        console.log('9. 🧹 Limpando formulário...');
        if (titleInput) titleInput.value = '';
        const descInput = document.getElementById('liveDescription');
        if (descInput) descInput.value = '';
        
        console.log('10. 🎬 Mostrando player...');
        // Pequeno delay para garantir transição
        setTimeout(() => {
            showLivePlayer(liveData, true);
            console.log('✅ [DEBUG] Player mostrado');
            
            // Configurar listener em tempo real
            setupLiveRealtimeListener(currentLiveId, true);
            
            showToast('🎬 Live iniciada com sucesso!', 'success');
            console.log('🎉 [DEBUG] TUDO CONCLUÍDO!');
        }, 300);
        
    } catch (error) {
        console.error('❌ [DEBUG] ERRO CRÍTICO:', error);
        showToast('Erro ao criar live: ' + error.message, 'error');
        
    } finally {
        console.log('🔄 [DEBUG] Restaurando estado...');
        isCreatingLive = false;
        
        const submitBtn = document.querySelector('#createLiveForm button[type="submit"], #createLiveSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-video"></i> Criar Live';
        }
    }
}

// ============================================
// SHOW LIVE PLAYER - CORRIGIR VÍDEO PRETO
// ============================================
// ============================================
// SHOW LIVE PLAYER - VERSÃO CORRIGIDA
// ============================================

function showLivePlayer(liveData, isHost = false) {
    console.log('🎬 Mostrando player da live - isHost:', isHost);
    
    // Função segura para atualizar elementos
    function safeUpdate(id, value, attr = 'textContent') {
        try {
            const element = document.getElementById(id);
            if (element) {
                if (attr === 'src') {
                    element.src = value;
                } else if (attr === 'className') {
                    element.className = value;
                } else {
                    element[attr] = value || '';
                }
                return true;
            }
            console.warn(`⚠️ Elemento não encontrado: ${id}`);
            return false;
        } catch (error) {
            console.error(`❌ Erro ao atualizar ${id}:`, error);
            return false;
        }
    }
    
    // 1. Mostrar player e ocultar grade
    try {
        const player = document.getElementById('livePlayer');
        const grid = document.getElementById('liveGrid');
        
        if (player) {
            player.classList.remove('hidden');
            player.style.display = 'block';
        }
        
        if (grid) {
            grid.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ Erro ao mostrar/ocultar elementos:', error);
    }
    
    // 2. Atualizar informações básicas (com fallbacks)
    safeUpdate('livePlayerTitle', liveData.title || 'Live sem título');
    safeUpdate('liveHostName', liveData.hostName || 'Host');
    safeUpdate('liveHostAvatar', liveData.hostPhoto || 'https://via.placeholder.com/50', 'src');
    
    // Configurar fallback para imagem
    const hostAvatar = document.getElementById('liveHostAvatar');
    if (hostAvatar) {
        hostAvatar.onerror = function() {
            this.src = 'https://via.placeholder.com/50';
        };
    }
    
    // 3. Atualizar badge da live
    const badgeElements = document.querySelectorAll('#liveBadge');
    if (badgeElements.length > 0) {
        badgeElements.forEach(badge => {
            if (badge) {
                if (liveData.privacy === 'ticket' || liveData.privacy === 'subscription' || liveData.privacy === 'paid') {
                    badge.textContent = 'EXCLUSIVO';
                    badge.className = 'lux-live-badge exclusive';
                } else {
                    badge.textContent = 'AO VIVO';
                    badge.className = 'lux-live-badge live';
                }
            }
        });
    }
    
    // 4. Atualizar contadores (com verificações)
    const viewerCount = document.getElementById('viewerCount');
    const likeCount = document.getElementById('likeCount');
    const giftCount = document.getElementById('giftCount');
    const earningsCount = document.getElementById('earningsCount');
    
    if (viewerCount) viewerCount.textContent = formatNumber(liveData.viewerCount || 0);
    if (likeCount) likeCount.textContent = liveData.likes || 0;
    if (giftCount) giftCount.textContent = liveData.giftCount || 0;
    if (earningsCount) {
        earningsCount.textContent = `R$ ${(liveData.totalEarnings || 0).toFixed(2)}`;
    }
    
    // 5. Configurar botão de saída/encerramento
    const exitBtn = document.getElementById('exitLiveBtn');
    if (exitBtn) {
        if (isHost) {
            exitBtn.innerHTML = '<i class="fas fa-stop"></i> Encerrar Live';
            exitBtn.className = 'lux-btn lux-btn-danger';
            // Remover event listener anterior para evitar duplicação
            exitBtn.onclick = endLive;
        } else {
            exitBtn.innerHTML = '<i class="fas fa-times"></i> Sair';
            exitBtn.className = 'lux-btn lux-btn-secondary';
            exitBtn.onclick = leaveLive;
        }
    }
    
    // 6. Configurar vídeo
    const mainVideo = document.getElementById('liveVideo');
    const localVideo = document.getElementById('localVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    
    console.log('🎥 Elementos de vídeo:', {
        mainVideo: !!mainVideo,
        localVideo: !!localVideo,
        placeholder: !!placeholder,
        hasLocalStream: !!localStream
    });
    
    if (isHost) {
        // HOST: Mostrar stream local
        if (localStream && localVideo) {
            console.log('📹 Configurando vídeo local para host');
            try {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
                localVideo.play().catch(e => {
                    console.log('⚠️ Auto-play do vídeo local bloqueado');
                    localVideo.setAttribute('controls', 'true');
                });
                localVideo.style.display = 'block';
                
                // Também mostrar no vídeo principal
                if (mainVideo) {
                    mainVideo.srcObject = localStream;
                    mainVideo.muted = false;
                    mainVideo.play().catch(e => {
                        console.log('⚠️ Auto-play do vídeo principal bloqueado');
                        mainVideo.setAttribute('controls', 'true');
                    });
                    mainVideo.style.display = 'block';
                }
                
                if (placeholder) placeholder.style.display = 'none';
                
            } catch (videoError) {
                console.error('❌ Erro ao configurar vídeo:', videoError);
                if (placeholder) {
                    placeholder.style.display = 'flex';
                    placeholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i><h3>Erro ao carregar vídeo</h3>';
                }
            }
        } else {
            console.log('⚠️ Host não tem stream local');
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <i class="fas fa-video-slash"></i>
                    <h3>Câmera não disponível</h3>
                    <p>Clique para ativar a câmera</p>
                    <button class="lux-btn lux-btn-primary" onclick="requestCameraForHost()">
                        <i class="fas fa-camera"></i> Ativar Câmera
                    </button>
                `;
            }
        }
    } else {
        // ESPECTADOR: Mostrar placeholder
        console.log('👀 Configurando para espectador');
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fas fa-broadcast-tower"></i>
                <h3>Conectando à transmissão...</h3>
                <p>Aguarde enquanto o vídeo é carregado</p>
            `;
        }
        
        if (mainVideo) {
            mainVideo.style.display = 'none';
            mainVideo.srcObject = null;
        }
        if (localVideo) localVideo.style.display = 'none';
    }
    
    // 7. Configurar chat inicial
    const chatMessages = document.getElementById('liveChatMessages');
    if (chatMessages && chatMessages.children.length <= 1) {
        chatMessages.innerHTML = `
            <div class="lux-chat-welcome">
                <i class="fas fa-comment-dots"></i>
                <p>Bem-vindo ao chat da live!<br>Seja respeitoso.</p>
            </div>
        `;
    }
    
    // 8. Configurar eventos
    if (isHost) {
        setupMediaControls(true);
    }
    setupChatEvents();
    
    // 9. Iniciar tracker de tempo (apenas espectadores)
    if (!isHost) {
        startWatchTimeTracker();
    }
    
    console.log('✅ Player configurado com sucesso para', isHost ? 'host' : 'espectador');
}

// ============================================
// FUNÇÃO AUXILIAR PARA ATIVAR CÂMERA
// ============================================

async function requestCameraForHost() {
    console.log('📹 Solicitando câmera para host...');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        localStream = stream;
        
        // Atualizar UI do vídeo
        const localVideo = document.getElementById('localVideo');
        const mainVideo = document.getElementById('liveVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (localVideo) {
            localVideo.srcObject = stream;
            localVideo.muted = true;
            localVideo.play();
            localVideo.style.display = 'block';
        }
        
        if (mainVideo) {
            mainVideo.srcObject = stream;
            mainVideo.play();
            mainVideo.style.display = 'block';
        }
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Atualizar Firestore
        if (currentLiveId) {
            await db.collection('liveStreams').doc(currentLiveId).update({
                hasActiveStream: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showToast('🎥 Câmera ativada com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao ativar câmera:', error);
        showToast('Não foi possível ativar a câmera: ' + error.message, 'error');
    }
}

// ============================================
// FUNÇÃO PARA DIAGNÓSTICO DE ELEMENTOS
// ============================================

function diagnosePlayerElements() {
    console.log('🔍 Diagnóstico dos elementos do player:');
    
    const elementsToCheck = [
        'livePlayer', 'liveGrid', 'livePlayerTitle', 'liveHostName', 
        'liveHostAvatar', 'liveBadge', 'exitLiveBtn', 'liveVideo',
        'localVideo', 'videoPlaceholder', 'viewerCount', 'likeCount',
        'giftCount', 'earningsCount', 'chatUserCount'
    ];
    
    elementsToCheck.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${id}: encontrado`);
        } else {
            console.log(`❌ ${id}: NÃO encontrado`);
        }
    });
    
    // Verificar se há elementos com mesmo ID
    const allElements = document.querySelectorAll('[id]');
    const ids = {};
    allElements.forEach(el => {
        if (ids[el.id]) {
            console.warn(`⚠️ ID duplicado: ${el.id} (${ids[el.id]} ocorrências)`);
            ids[el.id]++;
        } else {
            ids[el.id] = 1;
        }
    });
}

// Executar diagnóstico após o DOM carregar
setTimeout(diagnosePlayerElements, 1000);

// ============================================
// ATIVAR CÂMERA PARA HOST
// ============================================

async function enableCameraForHost() {
    console.log('📹 [DEBUG] Tentando ativar câmera para host...');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        localStream = stream;
        
        // Atualizar no Firestore
        if (currentLiveId) {
            await db.collection('liveStreams').doc(currentLiveId).update({
                hasActiveStream: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Atualizar vídeo local
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = stream;
            localVideo.muted = true;
            localVideo.play();
            localVideo.style.display = 'block';
        }
        
        // Atualizar vídeo principal
        const mainVideo = document.getElementById('liveVideo');
        if (mainVideo) {
            mainVideo.srcObject = stream;
            mainVideo.play();
            mainVideo.style.display = 'block';
        }
        
        // Ocultar placeholder
        const placeholder = document.getElementById('videoPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        showToast('🎥 Câmera ativada com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao ativar câmera:', error);
        showToast('Erro ao ativar câmera: ' + error.message, 'error');
    }
}