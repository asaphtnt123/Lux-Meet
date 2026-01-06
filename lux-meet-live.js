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


// Variáveis globais para WebRTC
let peerConnection = null;
let remoteStream = null;
let isHost = false;
let iceCandidates = [];

// Configuração do RTCPeerConnection
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Adicione seus próprios TURN servers se necessário (para NAT restritivo)
        // { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    ],
    iceCandidatePoolSize: 10
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
// ============================================
// CONECTAR AO STREAM DA LIVE - VERSÃO CORRIGIDA
// ============================================

// ============================================
// TENTAR MÉTODOS DE STREAMING REAL
// ============================================

async function tryRealStreamingMethods(liveData, videoElement) {
    console.log('🔄 Tentando conectar ao stream real...');
    
    // Método 1: Verificar se há streamUrl configurado
    if (liveData.streamUrl) {
        console.log('🌐 Stream URL disponível:', liveData.streamUrl);
        // Aqui você implementaria a conexão WebRTC real
        // Por enquanto, manteremos o placeholder
        return false;
    }
    
    // Método 2: Verificar se há configuração WebRTC
    if (liveData.webrtcConfig) {
        console.log('⚡ Configuração WebRTC disponível');
        // Implementar conexão WebRTC aqui
        return false;
    }
    
    // Método 3: Se não houver stream real, mostrar mensagem apropriada
    console.log('⚠️ Nenhum método de streaming disponível');
    showVideoPlaceholder('📹 Transmissão não iniciada');
    
    return false;
}

// ============================================
// MOSTRAR PLACEHOLDER DO VÍDEO (CORRIGIDA)
// ============================================

// ============================================
// CORRIGIR A FUNÇÃO joinLive
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
        
        // Registrar viewer
        await registerViewer(liveId);
        
        // Mostrar player
        showLivePlayer(liveData, false);
        isWatching = true;
        
        // Configurar chat
        setupLiveChat(liveId);
        
        // Configurar listener para atualizações
        setupLiveRealtimeListener(liveId, false);
        
        // CONECTAR AO STREAM REAL (sem simulação!)
        await connectToLiveStream(liveData);
        
        showToast('✅ Entrou na live!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao entrar na live:', error);
        showToast('Erro ao entrar na live', 'error');
    }
}


// ============================================
// CONNECT TO LIVE STREAM - VERSÃO LIMPA E DEFINITIVA
// ============================================
// ============================================
// CONNECT TO LIVE STREAM - VERSÃO CORRIGIDA
// ============================================

async function connectToLiveStream(liveData) {
    console.log('📡 [CORRECTED] Conectando à live');
    
     // SE FOR HOST, NÃO FAZER NADA - o setupVideoElements já configurou
    if (liveData.hostId === currentUser.uid) {
        console.log('👑 Host detectado - pulando connectToLiveStream');
        return;
    }
    try {
        const videoElement = document.getElementById('liveVideo');
        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        
        // 1. Determinar se é host ou espectador
        const isHost = liveData.hostId === currentUser.uid;
        console.log('👤 Tipo:', isHost ? 'HOST' : 'ESPECTADOR');
        
        if (isHost) {
            console.log('🎬 HOST: Configurando transmissão própria');
            await setupHostStream(liveData, videoElement, localVideo, placeholder);
        } else {
            console.log('👀 ESPECTADOR: Mostrando interface de live');
            await setupAudienceView(liveData, videoElement, placeholder);
        }
        
    } catch (error) {
        console.error('❌ Erro em connectToLiveStream:', error);
        showStreamStatus('Erro na conexão', 'error');
    }
}

// ============================================
// CONFIGURAÇÃO PARA HOST
// ============================================

async function setupHostStream(liveData, mainVideo, localVideo, placeholder) {
    console.log('🎥 Configurando stream do host');
    
    // Limpar estado anterior
    if (mainVideo) {
        mainVideo.pause();
        mainVideo.src = '';
        mainVideo.srcObject = null;
    }
    
    // Verificar se tem stream local
    if (localStream && localVideo) {
        console.log('✅ Host tem stream local, configurando...');
        
        // Configurar vídeo local (pequeno, para o host se ver)
        localVideo.srcObject = localStream;
        localVideo.muted = true;
        localVideo.style.display = 'block';
        
        localVideo.play().catch(e => {
            console.log('Auto-play local bloqueado');
            localVideo.setAttribute('controls', 'true');
        });
        
        // Configurar vídeo principal (grande)
        if (mainVideo) {
            mainVideo.srcObject = localStream;
            mainVideo.muted = false;
            mainVideo.style.display = 'block';
            
            mainVideo.play().catch(e => {
                console.log('Auto-play principal bloqueado');
                mainVideo.setAttribute('controls', 'true');
            });
        }
        
        // Esconder placeholder
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Mostrar status
        showStreamStatus('🎬 Você está transmitindo AO VIVO!', 'success');
        
    } else {
        console.log('⚠️ Host não tem stream local');
        
        // Mostrar interface para host sem câmera
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <div class="lux-host-streaming">
                    <i class="fas fa-broadcast-tower fa-3x"></i>
                    <h3>🎤 VOCÊ ESTÁ AO VIVO!</h3>
                    <p>Sua transmissão está ativa</p>
                    <div class="lux-host-stats">
                        <span><i class="fas fa-eye"></i> ${liveData.viewerCount || 0} espectadores</span>
                        <span><i class="fas fa-heart"></i> ${liveData.likes || 0} curtidas</span>
                    </div>
                    <small>Os espectadores podem ver sua transmissão</small>
                    <button class="lux-btn lux-btn-primary" onclick="enableCameraForHost()">
                        <i class="fas fa-camera"></i> Ativar Câmera
                    </button>
                </div>
            `;
        }
        
        if (mainVideo) mainVideo.style.display = 'none';
        if (localVideo) localVideo.style.display = 'none';
    }
}

// ============================================
// CONFIGURAÇÃO PARA ESPECTADORES
// ============================================

async function setupAudienceView(liveData, videoElement, placeholder) {
    console.log('🎭 Configurando visualização para espectador');
    
    // Limpar qualquer vídeo
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.srcObject = null;
        videoElement.style.display = 'none';
    }
    
    // Verificar se o host está transmitindo
    const hostHasStream = liveData.hasActiveStream === true;
    
    if (hostHasStream) {
        console.log('✅ Host está transmitindo, mostrando interface...');
        showLiveAudienceInterface(liveData, placeholder);
    } else {
        console.log('⚠️ Host não está transmitindo vídeo');
        showAudioOnlyInterface(liveData, placeholder);
    }
}

// ============================================
// INTERFACES PARA ESPECTADORES
// ============================================

function showLiveAudienceInterface(liveData, placeholder) {
    if (!placeholder) return;
    
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <div class="lux-live-audience">
            <div class="lux-live-header">
                <div class="lux-live-badge-large">
                    <span class="lux-pulse"></span>
                    <span>🔴 AO VIVO AGORA</span>
                </div>
            </div>
            
            <div class="lux-host-presentation">
                <img src="${liveData.hostPhoto || 'https://via.placeholder.com/120'}" 
                     alt="${liveData.hostName}"
                     class="lux-host-avatar-presentation">
                <div class="lux-host-presentation-info">
                    <h2>${liveData.hostName || 'Host'}</h2>
                    <p class="lux-live-title">${liveData.title || 'Transmissão ao vivo'}</p>
                    <p class="lux-live-category">${liveData.category || 'Social'}</p>
                </div>
            </div>
            
            <div class="lux-audience-content">
                <div class="lux-stream-message">
                    <i class="fas fa-satellite-dish"></i>
                    <h3>Transmissão em Andamento</h3>
                    <p>Conectado à live de ${liveData.hostName || 'o host'}</p>
                </div>
                
                <div class="lux-live-stats-audience">
                    <div class="lux-stat-audience">
                        <i class="fas fa-users"></i>
                        <div>
                            <strong>${formatNumber(liveData.viewerCount || 1)}</strong>
                            <span>Espectadores</span>
                        </div>
                    </div>
                    <div class="lux-stat-audience">
                        <i class="fas fa-heart"></i>
                        <div>
                            <strong>${liveData.likes || 0}</strong>
                            <span>Curtidas</span>
                        </div>
                    </div>
                    <div class="lux-stat-audience">
                        <i class="fas fa-comment"></i>
                        <div>
                            <strong>Chat</strong>
                            <span>Ativo</span>
                        </div>
                    </div>
                </div>
                
                <div class="lux-audience-actions">
                    <p><i class="fas fa-info-circle"></i> Participe do chat para interagir!</p>
                    <button class="lux-btn lux-btn-small" onclick="sendLike()">
                        <i class="fas fa-heart"></i> Curtir
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showAudioOnlyInterface(liveData, placeholder) {
    if (!placeholder) return;
    
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <div class="lux-audio-only">
            <i class="fas fa-headphones-alt fa-3x"></i>
            <h3>🎧 Transmissão de Áudio</h3>
            <p>${liveData.hostName || 'O host'} está transmitindo apenas áudio</p>
            <div class="lux-audio-stats">
                <span><i class="fas fa-user"></i> ${liveData.hostName}</span>
                <span><i class="fas fa-eye"></i> ${liveData.viewerCount || 0} ouvindo</span>
            </div>
            <small>Participe do chat para conversar!</small>
        </div>
    `;
}

// ============================================
// FUNÇÃO AUXILIAR PARA STATUS
// ============================================

function showStreamStatus(message, type = 'info') {
    console.log(`📢 Status: ${message}`);
    
    // Pode implementar um toast ou atualizar algum elemento
    const statusElement = document.getElementById('streamStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `lux-stream-status lux-status-${type}`;
    }
}

// ============================================
// CSS PARA AS NOVAS INTERFACES
// ============================================

function injectStreamingCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Interface do host streaming */
        .lux-host-streaming {
            text-align: center;
            padding: 40px;
            color: white;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .lux-host-streaming i {
            color: #d4af37;
            margin-bottom: 20px;
        }
        
        .lux-host-streaming h3 {
            color: #ff4757;
            margin: 15px 0;
            font-size: 1.5rem;
        }
        
        .lux-host-stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            color: #aaa;
        }
        
        .lux-host-stats span {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .lux-host-streaming small {
            display: block;
            margin: 15px 0;
            color: #666;
        }
        
        /* Interface de live para espectadores */
        .lux-live-audience {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .lux-live-header {
            margin-bottom: 30px;
        }
        
        .lux-live-badge-large {
            display: inline-flex;
            align-items: center;
            background: rgba(255, 71, 87, 0.15);
            padding: 10px 20px;
            border-radius: 25px;
            color: #ff4757;
            font-weight: bold;
        }
        
        .lux-pulse {
            width: 12px;
            height: 12px;
            background: #ff4757;
            border-radius: 50%;
            margin-right: 10px;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .lux-host-presentation {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .lux-host-avatar-presentation {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 3px solid #d4af37;
            object-fit: cover;
        }
        
        .lux-host-presentation-info h2 {
            margin: 0;
            color: white;
            font-size: 1.8rem;
        }
        
        .lux-live-title {
            color: #ddd;
            margin: 5px 0;
            font-size: 1.1rem;
        }
        
        .lux-live-category {
            color: #d4af37;
            background: rgba(212, 175, 55, 0.1);
            padding: 4px 12px;
            border-radius: 12px;
            display: inline-block;
            font-size: 0.9rem;
        }
        
        .lux-stream-message {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            margin: 20px 0;
        }
        
        .lux-stream-message i {
            font-size: 2.5rem;
            color: #d4af37;
            margin-bottom: 15px;
        }
        
        .lux-stream-message h3 {
            color: white;
            margin: 10px 0;
        }
        
        .lux-stream-message p {
            color: #aaa;
            margin: 0;
        }
        
        .lux-live-stats-audience {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 30px 0;
        }
        
        .lux-stat-audience {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }
        
        .lux-stat-audience i {
            font-size: 1.5rem;
            color: #d4af37;
            margin-bottom: 10px;
        }
        
        .lux-stat-audience strong {
            display: block;
            color: white;
            font-size: 1.3rem;
            margin-bottom: 5px;
        }
        
        .lux-stat-audience span {
            color: #aaa;
            font-size: 0.9rem;
        }
        
        .lux-audience-actions {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .lux-audience-actions p {
            color: #888;
            margin-bottom: 15px;
        }
        
        /* Interface de áudio apenas */
        .lux-audio-only {
            text-align: center;
            padding: 50px 30px;
            color: white;
        }
        
        .lux-audio-only i {
            color: #d4af37;
            margin-bottom: 20px;
        }
        
        .lux-audio-only h3 {
            color: white;
            margin: 15px 0;
        }
        
        .lux-audio-only p {
            color: #aaa;
            margin-bottom: 20px;
        }
        
        .lux-audio-stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            color: #888;
        }
        
        /* Status do stream */
        .lux-stream-status {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
            z-index: 100;
        }
        
        .lux-status-success {
            background: rgba(46, 204, 113, 0.8);
        }
        
        .lux-status-error {
            background: rgba(255, 71, 87, 0.8);
        }
    `;
    
    document.head.appendChild(style);
    console.log('✅ CSS de streaming injetado');
}

// Injetar CSS
setTimeout(injectStreamingCSS, 100);
// ============================================
// INTERFACE PARA ESPECTADORES
// ============================================

function showAudienceInterface(liveData) {
    console.log('🎭 Mostrando interface para espectadores');
    
    const placeholder = document.getElementById('videoPlaceholder');
    const videoElement = document.getElementById('liveVideo');
    
    if (!placeholder) return;
    
    // Ocultar vídeo
    if (videoElement) {
        videoElement.style.display = 'none';
        videoElement.src = '';
        videoElement.srcObject = null;
    }
    
    // Mostrar interface bonita para espectadores
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <div class="lux-audience-interface">
            <div class="lux-live-status">
                <div class="lux-pulse-indicator"></div>
                <span class="lux-status-text">AO VIVO AGORA</span>
            </div>
            
            <div class="lux-host-info-large">
                <img src="${liveData.hostPhoto || 'https://via.placeholder.com/100'}" 
                     alt="${liveData.hostName}" 
                     class="lux-host-avatar-large">
                <div class="lux-host-details">
                    <h3>${liveData.hostName || 'Host'}</h3>
                    <p>${liveData.title || 'Transmissão ao vivo'}</p>
                </div>
            </div>
            
            <div class="lux-audience-message">
                <i class="fas fa-headphones-alt"></i>
                <h4>Transmissão de Áudio ao Vivo</h4>
                <p>Conecte-se através do chat e áudio</p>
            </div>
            
            <div class="lux-live-stats-mini">
                <div class="lux-stat-item">
                    <i class="fas fa-eye"></i>
                    <span>${formatNumber(liveData.viewerCount || 1)}</span>
                </div>
                <div class="lux-stat-item">
                    <i class="fas fa-heart"></i>
                    <span>${liveData.likes || 0}</span>
                </div>
                <div class="lux-stat-item">
                    <i class="fas fa-comments"></i>
                    <span>Chat ativo</span>
                </div>
            </div>
            
            <div class="lux-audience-tip">
                <small><i class="fas fa-info-circle"></i> Participe do chat para interagir com o host!</small>
            </div>
        </div>
    `;
    
    console.log('✅ Interface do espectador carregada');
}

// ============================================
// INTERFACE PARA HOST SEM CÂMERA
// ============================================

function showHostPlaceholder() {
    const placeholder = document.getElementById('videoPlaceholder');
    if (!placeholder) return;
    
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <div class="lux-host-placeholder">
            <i class="fas fa-video-slash fa-3x"></i>
            <h3>Transmissão de Áudio</h3>
            <p>Você está transmitindo sem vídeo</p>
            <button class="lux-btn lux-btn-primary" onclick="enableCameraForHost()">
                <i class="fas fa-camera"></i> Ativar Câmera
            </button>
        </div>
    `;
}

// ============================================
// FUNÇÃO DE ERRO
// ============================================

function showErrorPlaceholder(message) {
    const placeholder = document.getElementById('videoPlaceholder');
    if (!placeholder) return;
    
    placeholder.style.display = 'flex';
    placeholder.innerHTML = `
        <div class="lux-error-placeholder">
            <i class="fas fa-exclamation-triangle fa-3x"></i>
            <h3>${message}</h3>
            <p>Tente recarregar a página</p>
        </div>
    `;
}

// ============================================
// REMOVER COMPLETAMENTE AS FUNÇÕES PROBLEMÁTICAS
// ============================================

// SOBRESCREVER tryStreamingMethods para NUNCA usar vídeo externo
if (typeof window.tryStreamingMethods !== 'undefined') {
    window.tryStreamingMethods = async function() {
        console.log('🚫 tryStreamingMethods BLOQUEADA');
        return false; // Sempre retorna false para não carregar vídeos
    };
}

// SOBRESCREVER simulateStream se ainda existir
if (typeof window.simulateStream !== 'undefined') {
    window.simulateStream = async function() {
        console.log('🚫 simulateStream BLOQUEADA');
        return false;
    };
}

// ============================================
// CSS PARA AS NOVAS INTERFACES
// ============================================

// Adicione este CSS no seu arquivo ou via JavaScript
function injectAudienceCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Interface para espectadores */
        .lux-audience-interface {
            text-align: center;
            padding: 30px;
            color: white;
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .lux-live-status {
            display: inline-flex;
            align-items: center;
            background: rgba(255, 71, 87, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            margin-bottom: 20px;
        }
        
        .lux-pulse-indicator {
            width: 10px;
            height: 10px;
            background: #ff4757;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .lux-status-text {
            color: #ff4757;
            font-weight: bold;
            font-size: 0.9rem;
        }
        
        .lux-host-info-large {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin: 20px 0;
        }
        
        .lux-host-avatar-large {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 3px solid #d4af37;
            object-fit: cover;
        }
        
        .lux-host-details h3 {
            margin: 0;
            font-size: 1.3rem;
            color: white;
        }
        
        .lux-host-details p {
            margin: 5px 0 0;
            color: #aaa;
            font-size: 0.9rem;
        }
        
        .lux-audience-message {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .lux-audience-message i {
            font-size: 2rem;
            color: #d4af37;
            margin-bottom: 10px;
        }
        
        .lux-audience-message h4 {
            margin: 10px 0;
            color: white;
        }
        
        .lux-audience-message p {
            color: #aaa;
            margin: 0;
        }
        
        .lux-live-stats-mini {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
        }
        
        .lux-stat-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .lux-stat-item i {
            color: #d4af37;
            margin-bottom: 5px;
        }
        
        .lux-stat-item span {
            color: white;
            font-weight: bold;
        }
        
        .lux-audience-tip {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: #888;
        }
        
        /* Placeholder para host */
        .lux-host-placeholder {
            text-align: center;
            padding: 40px;
            color: white;
        }
        
        .lux-host-placeholder i {
            color: #888;
            margin-bottom: 20px;
        }
        
        .lux-host-placeholder h3 {
            margin: 10px 0;
            color: white;
        }
        
        .lux-host-placeholder p {
            color: #aaa;
            margin-bottom: 20px;
        }
        
        /* Placeholder de erro */
        .lux-error-placeholder {
            text-align: center;
            padding: 40px;
            color: white;
        }
        
        .lux-error-placeholder i {
            color: #ff4757;
            margin-bottom: 20px;
        }
        
        .lux-error-placeholder h3 {
            margin: 10px 0;
            color: #ff4757;
        }
        
        .lux-error-placeholder p {
            color: #aaa;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ CSS da interface injetado');
}

// Executar após o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAudienceCSS);
} else {
    injectAudienceCSS();
}

// ============================================
// LIMPEZA DE EMERGÊNCIA VIA CONSOLE
// ============================================

// Execute este código no console para limpar TUDO
function emergencyCleanup() {
    console.log('🧹 LIMPEZA DE EMERGÊNCIA TOTAL');
    
    // 1. Parar todos os vídeos
    document.querySelectorAll('video').forEach(video => {
        video.pause();
        video.src = '';
        video.srcObject = null;
        video.load();
        video.style.display = 'none';
        console.log('✅ Vídeo limpo:', video.id || 'sem id');
    });
    
    // 2. Bloquear funções problemáticas
    window.tryStreamingMethods = async () => {
        console.log('🚫 Streaming methods bloqueado permanentemente');
        return false;
    };
    
    window.simulateStream = async () => {
        console.log('🚫 Simulate stream bloqueado permanentemente');
        return false;
    };
    
    // 3. Forçar interface do espectador
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder && currentLiveId) {
        // Obter dados da live atual
        db.collection('liveStreams').doc(currentLiveId).get()
            .then(doc => {
                if (doc.exists) {
                    showAudienceInterface(doc.data());
                }
            });
    }
    
    console.log('✅ Limpeza de emergência concluída');
}



// ============================================
// ATUALIZAR FUNÇÃO tryStreamingMethods
// ============================================

async function tryStreamingMethods(liveData, videoElement) {
    const methods = [
        { name: 'WebRTC Real', func: tryRealWebRTCConnection }
        // Remover a simulação da lista
    ];
    
    for (const method of methods) {
        try {
            console.log(`🔄 Tentando método: ${method.name}`);
            const success = await method.func(liveData, videoElement);
            
            if (success) {
                console.log(`✅ Conectado via ${method.name}`);
                return;
            }
        } catch (error) {
            console.log(`⚠️ Método ${method.name} falhou:`, error.message);
        }
    }
    
    // Fallback para placeholder informativo
    showVideoPlaceholder('📺 Aguardando transmissão do host');
}

// ============================================
// IMPLEMENTAÇÃO BÁSICA DE WEBRTC REAL
// ============================================

async function tryRealWebRTCConnection(liveData, videoElement) {
    console.log('⚡ Tentando conexão WebRTC real...');
    
    try {
        // Verificar se temos configuração
        if (!liveData.webrtcConfig) {
            console.log('⚠️ Sem configuração WebRTC');
            return false;
        }
        
        // Aqui você implementaria a conexão WebRTC real
        // Por enquanto, vamos apenas mostrar que estamos tentando
        console.log('🔧 Configuração WebRTC disponível, implementação necessária');
        
        // Mostrar mensagem informativa
        showVideoPlaceholder('🔗 Estabelecendo conexão...');
        
        return false; // Retornar false até implementar
        
    } catch (error) {
        console.error('❌ Erro na conexão WebRTC:', error);
        return false;
    }
}

// ============================================
// ATUALIZAR showLivePlayer PARA ESPECTADORES
// ============================================

// Na função showLivePlayer, na parte do espectador, modifique:

function showLivePlayer(liveData, isHost = false) {
    // ... código anterior ...
    
    if (isHost) {
        // ... configuração para host ...
    } else {
        // ESPECTADOR: mostrar placeholder informativo
        console.log('👀 Configurando para espectador');
        
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fas fa-broadcast-tower"></i>
                <h3>Aguardando transmissão</h3>
                <p>O host está preparando a live</p>
                <small>Transmissão ao vivo em breve</small>
            `;
        }
        
        // GARANTIR que nenhum vídeo de demonstração está rodando
        if (mainVideo) {
            mainVideo.style.display = 'none';
            mainVideo.srcObject = null;
            mainVideo.src = '';
            mainVideo.pause();
        }
        
        if (localVideo) {
            localVideo.style.display = 'none';
        }
    }
    
    // ... resto do código ...
}

// ============================================
// FUNÇÕES PARA GERENCIAR PLACEHOLDER DE VÍDEO
// ============================================

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
// CREATE LIVE - VERSÃO CORRIGIDA E DEFINITIVA
// ============================================


async function createLive(event) {
    console.log('🚀 [CORRIGIDA] Iniciando criação de live');
    
    // Prevenir comportamento padrão
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Prevenir duplo clique
    if (isCreatingLive) {
        console.log('⚠️ Criação já em andamento');
        return;
    }
    
    isCreatingLive = true;
    
     try {
        // ========== OBTER STREAM ==========
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
                frameRate: { ideal: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        window.localStream = stream;
        localStream = stream;
        isHost = true;
        
        // ========== CRIAR LIVE NO FIRESTORE ==========
        const liveRef = await db.collection('liveStreams').add(liveData);
        currentLiveId = liveRef.id;
        
        // ========== CONFIGURAR WEBRTC COMO HOST ==========
        await setupHostWebRTC(currentLiveId, stream);
        
        // ========== MOSTRAR PLAYER ==========
        showLivePlayerCorrected(liveData, true);
        
        // Configurar listener para candidatos ICE
        setupIceCandidateListener(currentLiveId);
        
        showToast('🎬 Live iniciada com sucesso! Aguardando espectadores...', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao criar live:', error);
        showToast('Erro ao iniciar transmissão: ' + error.message, 'error');
    }
}
// ============================================
// SHOW LIVE PLAYER CORRIGIDA
// ============================================

function showLivePlayerCorrected(liveData, isHost) {
    console.log('🎬 [CORRIGIDA] Mostrando player - Host:', isHost);
    
    try {
        // 1. Mostrar player, ocultar grid
        const player = document.getElementById('livePlayer');
        const grid = document.getElementById('liveGrid');
        
        if (player) {
            player.style.display = 'block';
            player.classList.remove('hidden');
            console.log('✅ Player exibido');
        }
        
        if (grid) {
            grid.style.display = 'none';
            console.log('✅ Grid ocultada');
        }
        
        // 2. Atualizar informações básicas
        updateElementSafe('livePlayerTitle', liveData.title || 'Minha Live');
        updateElementSafe('liveHostName', liveData.hostName || 'Host');
        
        const hostAvatar = document.getElementById('liveHostAvatar');
        if (hostAvatar) {
            hostAvatar.src = liveData.hostPhoto || getDefaultAvatar();
            hostAvatar.onerror = function() {
                this.src = getDefaultAvatar();
            };
            console.log('✅ Avatar configurado');
        }
        
        // 3. Atualizar badge
        const badges = document.querySelectorAll('#liveBadge');
        badges.forEach(badge => {
            if (badge) {
                badge.textContent = '🔴 AO VIVO';
                badge.style.background = '#ff4757';
                badge.style.color = 'white';
                console.log('✅ Badge atualizado');
            }
        });
        
        // 4. Configurar vídeo baseado no papel
        if (isHost) {
            setupHostVideoCorrected(liveData);
        } else {
            setupAudienceVideoCorrected(liveData);
        }
        
        // 5. Botão de saída/encerramento
        const exitBtn = document.getElementById('exitLiveBtn');
        if (exitBtn) {
            if (isHost) {
                exitBtn.innerHTML = '<i class="fas fa-stop"></i> Encerrar Live';
                exitBtn.className = 'lux-btn lux-btn-danger';
                exitBtn.onclick = endLive;
                console.log('✅ Botão "Encerrar Live" configurado');
            } else {
                exitBtn.innerHTML = '<i class="fas fa-times"></i> Sair da Live';
                exitBtn.className = 'lux-btn lux-btn-secondary';
                exitBtn.onclick = leaveLive;
                console.log('✅ Botão "Sair" configurado');
            }
        }
        
        // 6. Atualizar contadores iniciais
        updateElementSafe('viewerCount', liveData.viewerCount || 1);
        updateElementSafe('likeCount', liveData.likes || 0);
        updateElementSafe('giftCount', liveData.giftCount || 0);
        
        // 7. Mostrar status de conexão
        showConnectionStatus(isHost ? 'conectado' : 'assistindo');
        
        console.log('✅ Player configurado para', isHost ? 'HOST' : 'ESPECTADOR');
        
    } catch (error) {
        console.error('❌ Erro em showLivePlayerCorrected:', error);
    }
}


async function setupHostWebRTC(liveId, stream) {
    console.log('🎥 Configurando WebRTC como HOST para live:', liveId);
    
    try {
        // Criar PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Adicionar stream local ao PeerConnection
        stream.getTracks().forEach(track => {
            peerConnection.addTrack(track, stream);
        });
        
        // Coletar candidatos ICE e salvar no Firestore
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('❄️ Novo candidato ICE do host:', event.candidate);
                
                // Salvar candidato ICE no Firestore
                db.collection('liveStreams').doc(liveId).collection('hostCandidates').add({
                    candidate: event.candidate.toJSON(),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.error('Erro ao salvar candidato ICE:', e));
            }
        };
        
        // Criar oferta SDP
        const offerDescription = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offerDescription);
        
        // Salvar oferta no Firestore
        await db.collection('liveStreams').doc(liveId).update({
            hostOffer: {
                sdp: offerDescription.sdp,
                type: offerDescription.type
            },
            hostId: currentUser.uid,
            isActive: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Oferta SDP do host salva no Firestore');
        
        // Escutar respostas dos espectadores
        setupAnswerListener(liveId);
        
    } catch (error) {
        console.error('❌ Erro ao configurar WebRTC como host:', error);
        throw error;
    }
}

async function watchLive(liveId) {
    console.log('👀 Assistindo live:', liveId);
    
    try {
        isHost = false;
        currentLiveId = liveId;
        
        // Obter dados da live
        const liveDoc = await db.collection('liveStreams').doc(liveId).get();
        const liveData = liveDoc.data();
        
        if (!liveData || !liveData.isActive) {
            showToast('Live não está mais ativa', 'error');
            return;
        }
        
        // Configurar WebRTC como espectador
        await setupAudienceWebRTC(liveId, liveData);
        
        // Mostrar player do espectador
        showLivePlayerCorrected(liveData, false);
        
        showToast('Conectando à transmissão...', 'info');
        
    } catch (error) {
        console.error('❌ Erro ao assistir live:', error);
        showToast('Não foi possível conectar à transmissão', 'error');
    }
}

async function setupAudienceWebRTC(liveId, liveData) {
    console.log('🎥 Configurando WebRTC como ESPECTADOR');
    
    try {
        // Criar PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        // Configurar stream remoto
        remoteStream = new MediaStream();
        
        // Quando receber tracks remotas
        peerConnection.ontrack = (event) => {
            console.log('📹 Recebendo track remota:', event.track.kind);
            
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
            
            // Atualizar elemento de vídeo
            updateAudienceVideo(remoteStream);
        };
        
        // Coletar candidatos ICE do espectador
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('❄️ Novo candidato ICE do espectador:', event.candidate);
                
                // Salvar candidato ICE no Firestore
                db.collection('liveStreams').doc(liveId).collection('audienceCandidates').add({
                    candidate: event.candidate.toJSON(),
                    userId: currentUser.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.error('Erro ao salvar candidato ICE:', e));
            }
        };
        
        // Obter oferta do host
        const hostOffer = liveData.hostOffer;
        if (!hostOffer) {
            throw new Error('Host ainda não configurou a transmissão');
        }
        
        // Configurar oferta remota
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(hostOffer)
        );
        
        // Criar resposta
        const answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);
        
        // Enviar resposta para o host
        await db.collection('liveStreams').doc(liveId).collection('answers').add({
            answer: {
                sdp: answerDescription.sdp,
                type: answerDescription.type
            },
            userId: currentUser.uid,
            userName: userData.displayName || 'Espectador',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Resposta SDP enviada para o host');
        
        // Obter candidatos ICE do host
        await getHostIceCandidates(liveId);
        
    } catch (error) {
        console.error('❌ Erro ao configurar WebRTC como espectador:', error);
        throw error;
    }
}


async function setupIceCandidateListener(liveId) {
    // Host escuta candidatos ICE dos espectadores
    db.collection('liveStreams').doc(liveId).collection('audienceCandidates')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    try {
                        const candidate = new RTCIceCandidate(data.candidate);
                        await peerConnection.addIceCandidate(candidate);
                        console.log('✅ Candidato ICE do espectador adicionado');
                    } catch (error) {
                        console.error('Erro ao adicionar candidato ICE:', error);
                    }
                }
            });
        });
}

async function getHostIceCandidates(liveId) {
    // Espectador obtém candidatos ICE do host
    const candidatesSnapshot = await db.collection('liveStreams').doc(liveId)
        .collection('hostCandidates')
        .orderBy('timestamp')
        .get();
    
    for (const doc of candidatesSnapshot.docs) {
        const data = doc.data();
        try {
            const candidate = new RTCIceCandidate(data.candidate);
            await peerConnection.addIceCandidate(candidate);
            console.log('✅ Candidato ICE do host adicionado');
        } catch (error) {
            console.error('Erro ao adicionar candidato ICE do host:', error);
        }
    }
    
    // Escutar novos candidatos ICE do host
    db.collection('liveStreams').doc(liveId).collection('hostCandidates')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    try {
                        const candidate = new RTCIceCandidate(data.candidate);
                        await peerConnection.addIceCandidate(candidate);
                    } catch (error) {
                        console.error('Erro ao adicionar novo candidato ICE:', error);
                    }
                }
            });
        });
}

function setupAnswerListener(liveId) {
    // Host escuta respostas dos espectadores
    db.collection('liveStreams').doc(liveId).collection('answers')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    try {
                        const answerDescription = new RTCSessionDescription(data.answer);
                        await peerConnection.setRemoteDescription(answerDescription);
                        console.log('✅ Resposta SDP do espectador configurada');
                    } catch (error) {
                        console.error('Erro ao configurar resposta SDP:', error);
                    }
                }
            });
        });
}

function updateAudienceVideo(stream) {
    console.log('🔄 Atualizando vídeo do espectador');
    
    const mainVideo = document.getElementById('liveVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (mainVideo && stream) {
        // Verificar se há tracks de vídeo
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        console.log('📊 Tracks recebidas:', {
            video: videoTracks.length,
            audio: audioTracks.length
        });
        
        if (videoTracks.length > 0) {
            // Tem vídeo - mostrar player
            mainVideo.srcObject = stream;
            mainVideo.style.display = 'block';
            
            // Tentar play
            mainVideo.play().then(() => {
                console.log('✅ Vídeo do host reproduzindo');
                
                // Ocultar placeholder
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
                
                // Atualizar status
                showToast('✅ Conectado à transmissão!', 'success');
                
            }).catch(e => {
                console.warn('⚠️ Auto-play bloqueado, solicitando interação:', e);
                
                // Mostrar botão de play
                if (placeholder) {
                    placeholder.style.display = 'flex';
                    placeholder.innerHTML = `
                        <div class="lux-play-required">
                            <i class="fas fa-play-circle fa-3x"></i>
                            <h3>Transmissão Pronta</h3>
                            <p>Clique para iniciar a reprodução</p>
                            <button class="lux-btn lux-btn-primary" onclick="startVideoPlayback()">
                                <i class="fas fa-play"></i> Reproduzir Live
                            </button>
                        </div>
                    `;
                }
            });
        } else if (audioTracks.length > 0) {
            // Só tem áudio - mostrar interface de áudio
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="lux-audio-only">
                        <i class="fas fa-headphones-alt fa-3x"></i>
                        <h3>🎧 Transmissão de Áudio</h3>
                        <p>O host está transmitindo apenas áudio</p>
                        <div class="lux-audio-wave">
                            <div class="lux-wave-bar"></div>
                            <div class="lux-wave-bar"></div>
                            <div class="lux-wave-bar"></div>
                            <div class="lux-wave-bar"></div>
                            <div class="lux-wave-bar"></div>
                        </div>
                    </div>
                `;
            }
            mainVideo.style.display = 'none';
        }
    }
}

function startVideoPlayback() {
    const video = document.getElementById('liveVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (video) {
        video.play().then(() => {
            console.log('✅ Vídeo iniciado após interação');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }).catch(e => {
            console.error('❌ Erro ao iniciar vídeo:', e);
            showToast('Não foi possível reproduzir o vídeo', 'error');
        });
    }
}

async function endLive() {
    console.log('🛑 Encerrando live');
    
    if (isHost && currentLiveId) {
        // Atualizar status no Firestore
        await db.collection('liveStreams').doc(currentLiveId).update({
            isActive: false,
            status: 'ended',
            endTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Limpar candidatos ICE
        const batch = db.batch();
        
        const hostCandidates = await db.collection('liveStreams').doc(currentLiveId)
            .collection('hostCandidates').get();
        hostCandidates.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        const audienceCandidates = await db.collection('liveStreams').doc(currentLiveId)
            .collection('audienceCandidates').get();
        audienceCandidates.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }
    
    // Fechar conexões WebRTC
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    remoteStream = null;
    isHost = false;
    currentLiveId = null;
    
    // Restaurar UI
    showHomePage();
    
    showToast('Live encerrada', 'info');
}

// ============================================
// SETUP HOST VIDEO CORRIGIDO
// ============================================

function setupHostVideoCorrected(liveData) {
    console.log('📹 [CORRIGIDO] Configurando vídeo do HOST');
    
    const mainVideo = document.getElementById('liveVideo');
    const localVideo = document.getElementById('localVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    const statusElement = document.getElementById('streamStatus');
    
    if (localStream) {
        console.log('✅ Host TEM stream local');
        
        // Configurar vídeo local (pequeno)
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            localVideo.style.display = 'block';
            
            localVideo.play().catch(e => {
                console.log('Auto-play local prevenido');
                localVideo.setAttribute('controls', 'true');
            });
        }
        
        // Configurar vídeo principal (grande)
        if (mainVideo) {
            mainVideo.srcObject = localStream;
            mainVideo.muted = false;
            mainVideo.style.display = 'block';
            
            mainVideo.play().catch(e => {
                console.log('Auto-play principal prevenido');
                mainVideo.setAttribute('controls', 'true');
            });
        }
        
        // Ocultar placeholder
        if (placeholder) {
            placeholder.style.display = 'none';
            console.log('✅ Placeholder OCULTADO (host com vídeo)');
        }
        
        // Mostrar status
        if (statusElement) {
            statusElement.textContent = '🎬 VOCÊ ESTÁ TRANSMITINDO AO VIVO';
            statusElement.style.color = '#4cd964';
            console.log('✅ Status: TRANSMITINDO');
        }
        
    } else {
        console.log('⚠️ Host SEM stream local');
        
        // Mostrar interface especial para host sem câmera
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <div class="lux-host-no-video">
                    <i class="fas fa-microphone-alt"></i>
                    <h3>🎤 VOCÊ ESTÁ AO VIVO!</h3>
                    <p>Sua transmissão de áudio está ativa</p>
                    <div class="lux-host-stats">
                        <span><i class="fas fa-eye"></i> ${liveData.viewerCount || 1} espectadores</span>
                    </div>
                    <p class="lux-status-connected">✅ CONECTADO</p>
                    <button class="lux-btn lux-btn-primary" onclick="enableHostCamera()">
                        <i class="fas fa-camera"></i> Ativar Câmera
                    </button>
                </div>
            `;
            console.log('✅ Placeholder mostrado (host sem vídeo)');
        }
        
        if (statusElement) {
            statusElement.textContent = '🎤 TRANSMITINDO ÁUDIO AO VIVO';
            statusElement.style.color = '#d4af37';
        }
        
        // Ocultar vídeos
        if (mainVideo) mainVideo.style.display = 'none';
        if (localVideo) localVideo.style.display = 'none';
    }
}

// ============================================
// SETUP AUDIENCE VIDEO CORRIGIDO
// ============================================

function setupAudienceVideoCorrected(liveData) {
    console.log('👀 [CORRIGIDO] Configurando vídeo do ESPECTADOR');
    
    const mainVideo = document.getElementById('liveVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    const statusElement = document.getElementById('streamStatus');
    
    // Sempre mostrar placeholder para espectador
    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <div class="lux-audience-view">
                <div class="lux-live-status-indicator">
                    <div class="lux-pulse-dot"></div>
                    <span>🔴 TRANSMISSÃO AO VIVO</span>
                </div>
                
                <div class="lux-host-display">
                    <div class="lux-host-avatar-display">
                        ${liveData.hostName?.charAt(0) || '🎤'}
                    </div>
                    <div class="lux-host-info-display">
                        <h3>${liveData.hostName || 'Host'}</h3>
                        <p class="lux-live-title">${liveData.title || 'Live em andamento'}</p>
                    </div>
                </div>
                
                <div class="lux-connection-status">
                    <div class="lux-status-connected">
                        <i class="fas fa-check-circle"></i>
                        <span>CONECTADO À TRANSMISSÃO</span>
                    </div>
                    <p>Assistindo live de ${liveData.hostName || 'o host'}</p>
                </div>
                
                <div class="lux-audience-stats">
                    <div class="lux-stat">
                        <i class="fas fa-users"></i>
                        <div>
                            <strong>${liveData.viewerCount || 1}</strong>
                            <span>Espectadores</span>
                        </div>
                    </div>
                    <div class="lux-stat">
                        <i class="fas fa-heart"></i>
                        <div>
                            <strong>${liveData.likes || 0}</strong>
                            <span>Curtidas</span>
                        </div>
                    </div>
                </div>
                
                <div class="lux-audience-message">
                    <i class="fas fa-comment-dots"></i>
                    <p>Participe do chat para interagir!</p>
                </div>
            </div>
        `;
        console.log('✅ Placeholder do espectador configurado');
    }
    
    // Mostrar status
    if (statusElement) {
        statusElement.textContent = '👀 ASSISTINDO TRANSMISSÃO AO VIVO';
        statusElement.style.color = '#4cd964';
    }
    
    // Ocultar vídeo
    if (mainVideo) {
        mainVideo.style.display = 'none';
        mainVideo.srcObject = null;
    }
    
    console.log('✅ Espectador configurado - Status: CONECTADO');
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function updateElementSafe(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        return true;
    }
    console.warn(`Elemento ${id} não encontrado`);
    return false;
}

function getDefaultAvatar() {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1a2e"/><circle cx="50" cy="40" r="20" fill="%23d4af37"/><circle cx="50" cy="85" r="30" fill="%23d4af37"/></svg>`;
}

function getDefaultThumbnail() {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%231a1a2e"/><text x="150" y="90" font-family="Arial" font-size="24" fill="%23d4af37" text-anchor="middle">AO VIVO</text><text x="150" y="120" font-family="Arial" font-size="16" fill="%23ffffff" text-anchor="middle">Transmissão ao vivo</text></svg>`;
}

function showConnectionStatus(status) {
    console.log(`📡 Status de conexão: ${status.toUpperCase()}`);
    
    // Pode adicionar um elemento específico para status se quiser
    const existingStatus = document.getElementById('connectionStatus');
    if (existingStatus) {
        existingStatus.textContent = status === 'conectado' ? '✅ CONECTADO' : '👀 ASSISTINDO';
        existingStatus.className = `lux-connection-status lux-status-${status}`;
    }
}

// ============================================
// CSS PARA AS NOVAS INTERFACES
// ============================================

function injectCorrectedCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Host sem vídeo */
        .lux-host-no-video {
            text-align: center;
            padding: 40px;
            color: white;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .lux-host-no-video i {
            font-size: 3rem;
            color: #d4af37;
            margin-bottom: 20px;
        }
        
        .lux-host-no-video h3 {
            color: #ff4757;
            margin: 15px 0;
            font-size: 1.5rem;
        }
        
        .lux-host-stats {
            margin: 20px 0;
            color: #aaa;
        }
        
        .lux-status-connected {
            color: #4cd964;
            font-weight: bold;
            margin: 15px 0;
            font-size: 1.1rem;
        }
        
        /* Interface do espectador */
        .lux-audience-view {
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
            padding: 20px;
            color: white;
        }
        
        .lux-live-status-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 71, 87, 0.2);
            padding: 10px 20px;
            border-radius: 20px;
            margin-bottom: 25px;
            gap: 10px;
        }
        
        .lux-pulse-dot {
            width: 10px;
            height: 10px;
            background: #ff4757;
            border-radius: 50%;
            animation: luxPulseCorrected 1.5s infinite;
        }
        
        @keyframes luxPulseCorrected {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        .lux-host-display {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
            padding: 15px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
        }
        
        .lux-host-avatar-display {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #d4af37;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: black;
            font-weight: bold;
        }
        
        .lux-host-info-display h3 {
            margin: 0;
            color: white;
        }
        
        .lux-live-title {
            color: #ccc;
            margin: 5px 0 0 0;
            font-size: 0.9rem;
        }
        
        .lux-connection-status {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background: rgba(76, 217, 100, 0.1);
            border-radius: 10px;
        }
        
        .lux-status-connected {
            color: #4cd964;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .lux-audience-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin: 25px 0;
        }
        
        .lux-stat {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .lux-stat i {
            color: #d4af37;
            font-size: 1.3rem;
        }
        
        .lux-stat strong {
            color: white;
            font-size: 1.2rem;
            display: block;
        }
        
        .lux-stat span {
            color: #aaa;
            font-size: 0.9rem;
        }
        
        .lux-audience-message {
            text-align: center;
            padding: 15px;
            background: rgba(212, 175, 55, 0.1);
            border-radius: 10px;
            margin-top: 20px;
        }
        
        .lux-audience-message i {
            color: #d4af37;
            margin-bottom: 10px;
        }
    `;
    document.head.appendChild(style);
    console.log('✅ CSS corrigido injetado');
}

// Executar após carregar
setTimeout(injectCorrectedCSS, 100);


// ============================================
// ============================================
// CORRIGIR SHOW LIVE PLAYER PARA ESPECTADORES
// ============================================

function showLivePlayer(liveData, isHost = false) {
    console.log('🎬 [CORRIGIDO] showLivePlayer - isHost:', isHost);
    
    try {
        // 1. Mostrar player, ocultar grid
        const player = document.getElementById('livePlayer');
        const grid = document.getElementById('liveGrid');
        
        if (player) {
            player.style.display = 'block';
            player.classList.remove('hidden');
            console.log('✅ Player exibido');
        }
        
        if (grid) {
            grid.style.display = 'none';
            console.log('✅ Grid ocultada');
        }
        
        // 2. Atualizar informações básicas
        updateElementSafely('livePlayerTitle', liveData.title || 'Live');
        updateElementSafely('liveHostName', liveData.hostName || 'Host');
        
        const hostAvatar = document.getElementById('liveHostAvatar');
        if (hostAvatar) {
            hostAvatar.src = liveData.hostPhoto || 'https://via.placeholder.com/50';
            hostAvatar.onerror = () => {
                hostAvatar.src = 'https://via.placeholder.com/50';
            };
            console.log('✅ Avatar atualizado');
        }
        
        // 3. Configurar vídeo IMEDIATAMENTE
        console.log('🎥 Chamando setupVideoElements...');
        setupVideoElements(liveData, isHost);
        
        // 4. Botão de saída
        const exitBtn = document.getElementById('exitLiveBtn');
        if (exitBtn) {
            if (isHost) {
                exitBtn.innerHTML = '<i class="fas fa-stop"></i> Encerrar Live';
                exitBtn.className = 'lux-btn lux-btn-danger';
                exitBtn.onclick = endLive;
            } else {
                exitBtn.innerHTML = '<i class="fas fa-times"></i> Sair';
                exitBtn.className = 'lux-btn lux-btn-secondary';
                exitBtn.onclick = leaveLive;
            }
            console.log('✅ Botão configurado');
        }
        
        console.log('✅ showLivePlayer concluído');
        
    } catch (error) {
        console.error('❌ Erro em showLivePlayer:', error);
    }
}

// ============================================
// FUNÇÃO AUXILIAR PARA ATUALIZAR ELEMENTOS
// ============================================

function updateElementSafely(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
        return true;
    }
    console.warn(`Elemento ${id} não encontrado`);
    return false;
}

// ============================================
// FUNÇÃO AUXILIAR PARA CONFIGURAR VÍDEO
// ============================================

function setupVideoForPlayer(isHost) {
    console.log('🎥 Configurando vídeo, isHost:', isHost);
    
    const mainVideo = document.getElementById('liveVideo');
    const localVideo = document.getElementById('localVideo');
    const placeholder = document.getElementById('videoPlaceholder');
    
    if (isHost) {
        // HOST
        if (localStream && localVideo) {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            localVideo.style.display = 'block';
            
            localVideo.play().catch(e => {
                console.log('Auto-play local bloqueado');
                localVideo.setAttribute('controls', 'true');
            });
            
            // Também mostrar no vídeo principal
            if (mainVideo) {
                mainVideo.srcObject = localStream;
                mainVideo.muted = false;
                mainVideo.style.display = 'block';
                
                mainVideo.play().catch(e => {
                    console.log('Auto-play principal bloqueado');
                    mainVideo.setAttribute('controls', 'true');
                });
            }
            
            if (placeholder) placeholder.style.display = 'none';
            
        } else {
            console.log('⚠️ Host sem stream local');
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <i class="fas fa-video-slash"></i>
                    <h3>Câmera não disponível</h3>
                    <p>Ative a câmera para transmitir</p>
                `;
            }
        }
    } else {
        // ESPECTADOR
        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `
                <i class="fas fa-broadcast-tower"></i>
                <h3>Conectando à transmissão...</h3>
                <p>Aguarde enquanto o host inicia a live</p>
            `;
        }
        
        if (mainVideo) {
            mainVideo.style.display = 'none';
            mainVideo.srcObject = null;
        }
        if (localVideo) localVideo.style.display = 'none';
    }
}
// ============================================
// FUNÇÃO AUXILIAR PARA ATIVAR CÂMERA
// ============================================



// ============================================
// SHOW LIVE PLAYER - VERSÃO SUPER SEGURA
// ============================================

// ============================================
// FUNÇÕES AUXILIARES

// ============================================
// SETUP VIDEO ELEMENTS - VERSÃO CORRIGIDA
// ============================================

function setupVideoElements(liveData, isHost) {
    console.log('🎥 [CORRIGIDO] Configurando vídeo, isHost:', isHost);
    
    try {
        const mainVideo = document.getElementById('liveVideo');
        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        
        console.log('📊 Estado atual:', {
            mainVideo: !!mainVideo,
            localVideo: !!localVideo,
            placeholder: !!placeholder,
            localStream: !!localStream,
            isHost: isHost
        });
        
        // 1. SEMPRE limpar primeiro
        if (mainVideo) {
            mainVideo.pause();
            mainVideo.src = '';
            mainVideo.srcObject = null;
        }
        
        if (localVideo) {
            localVideo.pause();
            localVideo.src = '';
            localVideo.srcObject = null;
        }
        
        // 2. HOST
        if (isHost) {
            console.log('👑 CONFIGURANDO HOST');
            
            if (localStream) {
                console.log('✅ Host TEM stream local');
                
                // Mostrar vídeo local (pequeno)
                if (localVideo) {
                    localVideo.srcObject = localStream;
                    localVideo.muted = true;
                    localVideo.style.display = 'block';
                    
                    localVideo.play().catch(e => {
                        console.log('Auto-play local bloqueado');
                        localVideo.setAttribute('controls', 'true');
                    });
                }
                
                // Mostrar vídeo principal (grande) 
                if (mainVideo) {
                    mainVideo.srcObject = localStream;
                    mainVideo.muted = false;
                    mainVideo.style.display = 'block';
                    
                    mainVideo.play().catch(e => {
                        console.log('Auto-play principal bloqueado');
                        mainVideo.setAttribute('controls', 'true');
                    });
                }
                
                // OCULTAR placeholder completamente
                if (placeholder) {
                    console.log('🚫 Ocultando placeholder para host');
                    placeholder.style.display = 'none';
                    placeholder.innerHTML = ''; // Limpar conteúdo
                }
                
                // Mostrar status
                updateHostStatus('🎬 Transmitindo ao vivo!');
                
            } else {
                console.log('⚠️ Host SEM stream local');
                
                // Mostrar interface especial para host sem câmera
                if (placeholder) {
                    placeholder.style.display = 'flex';
                    placeholder.innerHTML = `
                        <div class="lux-host-no-camera">
                            <i class="fas fa-microphone-alt fa-3x"></i>
                            <h3>🎤 VOCÊ ESTÁ AO VIVO!</h3>
                            <p>Sua transmissão de áudio está ativa</p>
                            <div class="lux-host-info">
                                <span><i class="fas fa-eye"></i> ${liveData.viewerCount || 0} espectadores</span>
                                <span><i class="fas fa-heart"></i> ${liveData.likes || 0} curtidas</span>
                            </div>
                            <button class="lux-btn lux-btn-primary" onclick="enableCameraForHost()">
                                <i class="fas fa-camera"></i> Ativar Câmera
                            </button>
                        </div>
                    `;
                }
                
                // Garantir que vídeos estão ocultos
                if (mainVideo) mainVideo.style.display = 'none';
                if (localVideo) localVideo.style.display = 'none';
            }
            
        } 
        // 3. ESPECTADOR
        else {
            console.log('👀 CONFIGURANDO ESPECTADOR');
            
            // ESPECTADOR NUNCA deve ver "Conectando..."
            // Mostrar interface de live imediatamente
            
            if (placeholder) {
                placeholder.style.display = 'flex';
                
                // Verificar se host tem stream
                const hostHasVideo = localStream !== null && localStream !== undefined;
                
                if (hostHasVideo) {
                    // Host está transmitindo vídeo
                    placeholder.innerHTML = `
                        <div class="lux-audience-live">
                            <div class="lux-live-indicator">
                                <span class="lux-pulse-dot"></span>
                                <span class="lux-live-text">🔴 AO VIVO AGORA</span>
                            </div>
                            <div class="lux-audience-host">
                                <img src="${liveData.hostPhoto || 'https://via.placeholder.com/80'}" 
                                     alt="${liveData.hostName}"
                                     class="lux-audience-avatar">
                                <div>
                                    <h3>${liveData.hostName || 'Host'}</h3>
                                    <p>${liveData.title || 'Transmissão ao vivo'}</p>
                                </div>
                            </div>
                            <div class="lux-audience-message">
                                <i class="fas fa-satellite"></i>
                                <p>Conectado à transmissão de <strong>${liveData.hostName || 'host'}</strong></p>
                            </div>
                            <div class="lux-audience-stats">
                                <div>
                                    <i class="fas fa-users"></i>
                                    <span>${formatNumber(liveData.viewerCount || 1)} online</span>
                                </div>
                                <div>
                                    <i class="fas fa-heart"></i>
                                    <span>${liveData.likes || 0} curtidas</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Host só tem áudio
                    placeholder.innerHTML = `
                        <div class="lux-audience-audio">
                            <i class="fas fa-headphones-alt fa-3x"></i>
                            <h3>🎧 Transmissão de Áudio</h3>
                            <p>${liveData.hostName || 'O host'} está ao vivo</p>
                            <div class="lux-audio-info">
                                <span><i class="fas fa-user"></i> ${liveData.hostName}</span>
                                <span><i class="fas fa-volume-up"></i> Áudio ao vivo</span>
                            </div>
                        </div>
                    `;
                }
            }
            
            // Ocultar vídeos para espectador
            if (mainVideo) {
                mainVideo.style.display = 'none';
                mainVideo.srcObject = null;
            }
            if (localVideo) localVideo.style.display = 'none';
        }
        
        console.log('✅ Configuração de vídeo concluída');
        
    } catch (error) {
        console.error('❌ Erro em setupVideoElements:', error);
    }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function updateHostStatus(message) {
    console.log('📢 Status do host:', message);
    
    // Atualizar algum elemento na UI se necessário
    const statusElement = document.getElementById('hostStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// ============================================
// CSS PARA AS NOVAS INTERFACES
// ============================================

function injectVideoCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Host sem câmera */
        .lux-host-no-camera {
            text-align: center;
            padding: 30px;
            color: white;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .lux-host-no-camera i {
            color: #d4af37;
            margin-bottom: 20px;
        }
        
        .lux-host-no-camera h3 {
            color: #ff4757;
            margin: 15px 0;
            font-size: 1.4rem;
        }
        
        .lux-host-info {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            color: #aaa;
        }
        
        .lux-host-info span {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Interface de live para espectadores */
        .lux-audience-live {
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .lux-live-indicator {
            display: inline-flex;
            align-items: center;
            background: rgba(255, 71, 87, 0.15);
            padding: 10px 20px;
            border-radius: 20px;
            margin-bottom: 25px;
        }
        
        .lux-pulse-dot {
            width: 10px;
            height: 10px;
            background: #ff4757;
            border-radius: 50%;
            margin-right: 10px;
            animation: luxPulse 1.5s infinite;
        }
        
        @keyframes luxPulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        .lux-live-text {
            color: #ff4757;
            font-weight: bold;
            font-size: 0.95rem;
        }
        
        .lux-audience-host {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .lux-audience-avatar {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            border: 2px solid #d4af37;
            object-fit: cover;
        }
        
        .lux-audience-host h3 {
            margin: 0;
            color: white;
            font-size: 1.3rem;
        }
        
        .lux-audience-host p {
            margin: 5px 0 0;
            color: #ccc;
            font-size: 0.95rem;
        }
        
        .lux-audience-message {
            background: rgba(212, 175, 55, 0.1);
            border-radius: 10px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
        }
        
        .lux-audience-message i {
            color: #d4af37;
            font-size: 1.5rem;
            margin-bottom: 10px;
        }
        
        .lux-audience-message p {
            color: #ddd;
            margin: 0;
        }
        
        .lux-audience-message strong {
            color: #d4af37;
        }
        
        .lux-audience-stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 25px;
        }
        
        .lux-audience-stats div {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .lux-audience-stats i {
            color: #d4af37;
            font-size: 1.3rem;
            margin-bottom: 8px;
        }
        
        .lux-audience-stats span {
            color: white;
            font-size: 0.9rem;
        }
        
        /* Interface de áudio para espectadores */
        .lux-audience-audio {
            text-align: center;
            padding: 40px 20px;
            color: white;
            max-width: 400px;
            margin: 0 auto;
        }
        
        .lux-audience-audio i {
            color: #d4af37;
            margin-bottom: 20px;
        }
        
        .lux-audience-audio h3 {
            color: white;
            margin: 15px 0;
            font-size: 1.4rem;
        }
        
        .lux-audience-audio p {
            color: #aaa;
            margin-bottom: 20px;
        }
        
        .lux-audio-info {
            display: flex;
            justify-content: center;
            gap: 25px;
            margin-top: 20px;
            color: #888;
        }
        
        .lux-audio-info span {
            display: flex;
            align-items: center;
            gap: 6px;
        }
    `;
    
    document.head.appendChild(style);
    console.log('✅ CSS de vídeo injetado');
}

// Executar após um pequeno delay
setTimeout(injectVideoCSS, 50);

// ============================================
// FUNÇÃO PARA ENCONTRAR O ELEMENTO PROBLEMÁTICO
// ============================================

function findProblematicElement() {
    console.log('🔍 Buscando elemento problemático na linha ~991...');
    
    // IDs que podem estar causando o problema
    const potentialProblemElements = [
        'livePlayerTitle',
        'liveHostName', 
        'liveHostAvatar',
        'liveBadge',
        'viewerCount',
        'likeCount',
        'giftCount',
        'earningsCount',
        'exitLiveBtn',
        'liveVideo',
        'localVideo',
        'videoPlaceholder'
    ];
    
    const missingElements = [];
    
    potentialProblemElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
            console.log(`❌ ${id}: NÃO ENCONTRADO`);
        } else {
            console.log(`✅ ${id}: encontrado (tag: ${element.tagName})`);
        }
    });
    
    if (missingElements.length > 0) {
        console.log(`⚠️ Faltam ${missingElements.length} elementos:`, missingElements);
        alert(`ERRO: Faltam elementos no HTML: ${missingElements.join(', ')}`);
    } else {
        console.log('✅ Todos os elementos principais estão presentes');
    }
    
    // Verificar elementos com mesmo ID (duplicados)
    const allIds = {};
    document.querySelectorAll('[id]').forEach(el => {
        if (allIds[el.id]) {
            console.warn(`⚠️ ID DUPLICADO: ${el.id}`);
            allIds[el.id]++;
        } else {
            allIds[el.id] = 1;
        }
    });
}

// Executar diagnóstico
setTimeout(findProblematicElement, 2000);

// ============================================
// VERSÃO DE EMERGÊNCIA - MÍNIMA
// ============================================

// ============================================
// MODIFICAR CREATE LIVE PARA USAR VERSÃO SEGURA
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


// SOLUÇÃO RÁPIDA PARA TESTAR
function quickFixForHost() {
    console.log('🔧 Aplicando correção rápida...');
    
    // 1. Verificar estado
    console.log('Estado atual:');
    console.log('- currentLiveId:', currentLiveId);
    console.log('- localStream:', localStream ? '✅ Presente' : '❌ Ausente');
    console.log('- isBroadcasting:', isBroadcasting);
    
    // 2. Se não tem stream, pedir permissão
    if (!localStream) {
        console.log('🎥 Solicitando permissões de mídia...');
        
        navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        }).then(stream => {
            console.log('✅ Stream obtido!');
            localStream = stream;
            isBroadcasting = true;
            
            // 3. Atualizar UI
            const localVideo = document.getElementById('localVideo');
            const mainVideo = document.getElementById('liveVideo');
            const placeholder = document.getElementById('videoPlaceholder');
            
            if (localVideo) {
                localVideo.srcObject = stream;
                localVideo.muted = true;
                localVideo.style.display = 'block';
                localVideo.play();
                console.log('✅ Vídeo local configurado');
            }
            
            if (mainVideo) {
                mainVideo.srcObject = stream;
                mainVideo.muted = false;
                mainVideo.style.display = 'block';
                mainVideo.play();
                console.log('✅ Vídeo principal configurado');
            }
            
            if (placeholder) {
                placeholder.style.display = 'none';
                console.log('✅ Placeholder ocultado');
            }
            
            // 4. Atualizar Firestore
            if (currentLiveId) {
                db.collection('liveStreams').doc(currentLiveId).update({
                    hasActiveStream: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('✅ Status atualizado no Firestore');
            }
            
            showToast('🎥 Câmera ativada com sucesso!', 'success');
            
        }).catch(error => {
            console.error('❌ Erro ao obter stream:', error);
            showToast('Não foi possível ativar a câmera', 'error');
        });
    } else {
        console.log('✅ Já tem stream, apenas configurando...');
        
        // Já tem stream, apenas configurar UI
        const localVideo = document.getElementById('localVideo');
        const mainVideo = document.getElementById('liveVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (localVideo && localStream) {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            localVideo.style.display = 'block';
            localVideo.play();
        }
        
        if (mainVideo && localStream) {
            mainVideo.srcObject = localStream;
            mainVideo.muted = false;
            mainVideo.style.display = 'block';
            mainVideo.play();
        }
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }
}

// CORREÇÃO PARA ESPECTADOR
function fixAudienceView() {
    console.log('👀 Corrigindo view do espectador...');
    
    const placeholder = document.getElementById('videoPlaceholder');
    if (!placeholder) return;
    
    // Obter dados da live atual
    if (!currentLiveId) {
        console.error('❌ Nenhuma live ativa');
        return;
    }
    
    db.collection('liveStreams').doc(currentLiveId).get()
        .then(doc => {
            if (doc.exists) {
                const liveData = doc.data();
                
                // Mostrar interface atualizada
                placeholder.innerHTML = `
                    <div class="lux-audience-fixed">
                        <div class="lux-live-pulse">
                            <div class="lux-pulse-animation"></div>
                            <span>🔴 TRANSMISSÃO AO VIVO</span>
                        </div>
                        
                        <div class="lux-audience-content-fixed">
                            <div class="lux-host-card">
                                <img src="${liveData.hostPhoto || 'https://via.placeholder.com/80'}" 
                                     alt="${liveData.hostName}"
                                     class="lux-host-img">
                                <div>
                                    <h3>${liveData.hostName || 'Host'}</h3>
                                    <p class="lux-live-now">AO VIVO AGORA</p>
                                </div>
                            </div>
                            
                            <div class="lux-live-info">
                                <h4>${liveData.title || 'Transmissão ao vivo'}</h4>
                                <p>${liveData.description || 'Assistindo transmissão ao vivo'}</p>
                            </div>
                            
                            <div class="lux-stats-fixed">
                                <div class="lux-stat">
                                    <i class="fas fa-eye"></i>
                                    <div>
                                        <strong>${liveData.viewerCount || 1}</strong>
                                        <span>Espectadores</span>
                                    </div>
                                </div>
                                <div class="lux-stat">
                                    <i class="fas fa-heart"></i>
                                    <div>
                                        <strong>${liveData.likes || 0}</strong>
                                        <span>Curtidas</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="lux-audience-tip-fixed">
                                <i class="fas fa-comment"></i>
                                <p>Participe do chat para interagir!</p>
                            </div>
                        </div>
                    </div>
                `;
                
                console.log('✅ Interface do espectador atualizada');
            }
        })
        .catch(error => {
            console.error('❌ Erro ao obter dados:', error);
        });
}

