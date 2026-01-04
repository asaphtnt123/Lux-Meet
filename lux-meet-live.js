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


async function handleAuthStateChange(user) {
    if (user) {
        // Usuário está logado
        console.log('Usuário autenticado:', user.uid);
        currentUser = user;
        
        // Validar e carregar dados do usuário
        const userValid = await validateUserData();
        
        if (userValid) {
            updateUserUI();
            await loadActiveLives();
            setupEventListeners();
            showApp();
        } else {
            showToast('Erro ao carregar dados do usuário', 'error');
        }
    } else {
        // Usuário não está logado, redirecionar para login
        console.log('Usuário não autenticado, redirecionando...');
        window.location.href = 'login.html'; // Ajuste para sua página de login
    }
}

async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            console.log('Dados do usuário carregados:', userData);
        } else {
            // Criar novo perfil de usuário
            userData = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Usuário',
                email: currentUser.email,
                photoURL: currentUser.photoURL || 'https://via.placeholder.com/150',
                balance: 0,
                diamonds: 100, // Diamantes iniciais
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
            
            await db.collection('users').doc(currentUser.uid).set(userData);
            console.log('Novo perfil de usuário criado');
        }
        
        // Atualizar último login
        await db.collection('users').doc(currentUser.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

function updateUserUI() {
    if (!currentUser || !userData) return;
    
    // Atualizar informações do usuário no header
    const userNameElements = document.querySelectorAll('#userName, .lux-user-name');
    userNameElements.forEach(el => {
        el.textContent = userData.displayName;
    });
    
    const userAvatarElements = document.querySelectorAll('#userAvatar, .lux-user-avatar');
    userAvatarElements.forEach(el => {
        el.src = userData.photoURL;
        el.onerror = function() {
            this.src = 'https://via.placeholder.com/150';
        };
    });
    
    // Atualizar saldo
    document.getElementById('userBalance').textContent = userData.balance.toFixed(2);
    document.getElementById('userDiamonds').textContent = userData.diamonds;
    document.getElementById('userLevel').textContent = `Nível ${userData.level}`;
    document.getElementById('modalDiamonds').textContent = userData.diamonds;
    
    // Mostrar badge de verificação se for criador verificado
    const verifiedBadge = document.getElementById('verifiedBadge');
    if (verifiedBadge) {
        verifiedBadge.style.display = userData.isVerified ? 'inline-block' : 'none';
    }
    
    console.log('UI do usuário atualizada');
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
// CRIAR LIVE
// ============================================
// ============================================
// CRIAR LIVE - FUNÇÃO ATUALIZADA
// ============================================

async function createLive() {
    try {
        console.log('Iniciando criação de live...');
        
        // Obter valores do formulário
        const title = document.getElementById('liveTitle')?.value.trim();
        const description = document.getElementById('liveDescription')?.value.trim();
        const category = document.getElementById('liveCategory')?.value;
        const privacy = document.getElementById('livePrivacy')?.value;
        const isMultiHost = document.getElementById('liveMultiHost')?.checked || false;
        const maxCoHosts = isMultiHost ? parseInt(document.getElementById('maxCoHosts')?.value) || 2 : 0;
        
        let ticketPrice = 0;
        if (privacy === 'ticket') {
            ticketPrice = parseFloat(document.getElementById('liveTicketPrice')?.value) || 0;
        }
        
        // Validar campos obrigatórios
        if (!title) {
            showToast('Digite um título para a live', 'error');
            return;
        }
        
        // Verificar se userData está carregado
        if (!userData || !currentUser) {
            showToast('Erro ao carregar dados do usuário. Recarregue a página.', 'error');
            return;
        }
        
        // Solicitar permissão de câmera e microfone
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Capturar thumbnail
        const thumbnail = await captureThumbnail(stream);
        
        // Criar dados da live com valores padrão para evitar undefined
        const liveData = {
            hostId: currentUser.uid,
            hostName: userData.displayName || currentUser.displayName || 'Anônimo',
            hostPhoto: userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/150',
            hostVerified: userData.isVerified || false,
            title: title,
            description: description || '',
            category: category || 'social',
            privacy: privacy || 'public',
            isMultiHost: isMultiHost || false,
            maxCoHosts: maxCoHosts || 0,
            ticketPrice: ticketPrice || 0,
            status: 'active',
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            viewers: {},
            viewerCount: 0,
            coHosts: [],
            likes: 0,
            giftCount: 0,
            totalEarnings: 0,
            hostEarnings: 0,
            platformEarnings: 0,
            thumbnail: thumbnail || 'https://via.placeholder.com/300x180?text=Ao+Vivo',
            chatEnabled: true,
            giftsEnabled: true,
            language: 'pt',
            recordingEnabled: false,
            ticketSales: 0,
            // Campos adicionais para evitar erros
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        console.log('Criando live no Firestore com dados:', liveData);
        
        // Verificar campos undefined
        Object.keys(liveData).forEach(key => {
            if (liveData[key] === undefined) {
                console.warn(`Campo ${key} está undefined, convertendo para valor padrão`);
                if (typeof liveData[key] === 'string') {
                    liveData[key] = '';
                } else if (typeof liveData[key] === 'number') {
                    liveData[key] = 0;
                } else if (typeof liveData[key] === 'boolean') {
                    liveData[key] = false;
                } else if (Array.isArray(liveData[key])) {
                    liveData[key] = [];
                } else if (typeof liveData[key] === 'object') {
                    liveData[key] = {};
                }
            }
        });
        
        // Criar documento da live
        const liveRef = await db.collection('liveStreams').add(liveData);
        currentLiveId = liveRef.id;
        
        console.log('Live criada com ID:', currentLiveId);
        
        // Iniciar broadcast como host
        await startBroadcast(stream, currentLiveId, 'host');
        
        // Adicionar host como viewer
        await db.collection('liveStreams').doc(currentLiveId).update({
            [`viewers.${currentUser.uid}`]: {
                uid: currentUser.uid,
                name: userData.displayName || currentUser.displayName || 'Anônimo',
                photo: userData.photoURL || currentUser.photoURL || 'https://via.placeholder.com/150',
                role: 'host',
                joinedAt: new Date().toISOString()
            },
            viewerCount: 1
        });
        
        // Fechar modal e mostrar player
        closeModal('createLiveModal');
        showLivePlayer(liveData, true);
        
        showToast('Live iniciada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao criar live:', error);
        
        if (error.name === 'NotAllowedError') {
            showToast('Permissão de câmera e/ou microfone é necessária', 'error');
        } else if (error.name === 'NotFoundError') {
            showToast('Dispositivo de mídia não encontrado', 'error');
        } else if (error.name === 'NotReadableError') {
            showToast('Dispositivo de mídia em uso', 'error');
        } else if (error.name === 'FirebaseError') {
            showToast('Erro no banco de dados: ' + error.message, 'error');
        } else {
            showToast('Erro ao criar live: ' + error.message, 'error');
        }
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


async function captureThumbnail(stream) {
    try {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                setTimeout(() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 320;
                    canvas.height = 180;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Parar o vídeo
                    video.pause();
                    video.srcObject = null;
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                }, 500);
            };
        });
    } catch (error) {
        console.error('Erro ao capturar thumbnail:', error);
        return null;
    }
}

// ============================================
// BROADCAST E WEBCAM
// ============================================

async function startBroadcast(stream, liveId, role = 'host') {
    try {
        console.log(`Iniciando broadcast como ${role}...`);
        
        localStream = stream;
        userRole = role;
        isBroadcasting = true;
        
        // Configurar vídeo local
        const videoElement = document.getElementById('liveVideo');
        if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.muted = true;
            videoElement.play().catch(e => console.log('Auto-play prevented:', e));
        }
        
        // Configurar WebRTC (simplificado para demonstração)
        // Em produção, use um servidor de sinalização adequado
        
        // Aqui você implementaria a lógica WebRTC real
        // Por enquanto, apenas mostraremos o vídeo local
        
        showToast('Transmissão iniciada', 'success');
        
    } catch (error) {
        console.error('Erro ao iniciar broadcast:', error);
        throw error;
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

async function joinLive(liveId) {
    try {
        console.log('Entrando na live:', liveId);
        
        // Obter dados da live
        const liveDoc = await db.collection('liveStreams').doc(liveId).get();
        
        if (!liveDoc.exists) {
            showToast('Live não encontrada', 'error');
            return;
        }
        
        const liveData = liveDoc.data();
        
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
        
        // Registrar viewer
        await registerViewer(liveId);
        
        // Mostrar player
        showLivePlayer(liveData, false);
        isWatching = true;
        
        // Configurar chat
        setupLiveChat(liveId);
        
        // Simular conexão com stream
        // Em produção, aqui você implementaria a conexão WebRTC
        const videoElement = document.getElementById('liveVideo');
        if (videoElement) {
            // Para demonstração, vamos usar um placeholder
            // Em produção, você conectaria ao stream real
            videoElement.src = 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4';
            videoElement.play().catch(e => console.log('Auto-play prevented:', e));
        }
        
        showToast('Entrou na live com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao entrar na live:', error);
        showToast('Erro ao entrar na live', 'error');
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

async function registerViewer(liveId) {
    try {
        await db.collection('liveStreams').doc(liveId).update({
            [`viewers.${currentUser.uid}`]: {
                uid: currentUser.uid,
                name: userData.displayName,
                photo: userData.photoURL,
                role: 'viewer',
                joinedAt: new Date().toISOString()
            },
            viewerCount: firebase.firestore.FieldValue.increment(1)
        });
        
        console.log('Viewer registrado na live');
    } catch (error) {
        console.error('Erro ao registrar viewer:', error);
    }
}

function showLivePlayer(liveData, isHost = false) {
    const player = document.getElementById('livePlayer');
    const grid = document.getElementById('liveGrid');
    
    if (player) player.classList.remove('hidden');
    if (grid) grid.style.display = 'none';
    
    // Atualizar informações da live no player
    document.getElementById('livePlayerTitle').textContent = liveData.title;
    document.getElementById('liveHostName').textContent = liveData.hostName;
    document.getElementById('liveHostAvatar').src = liveData.hostPhoto;
    document.getElementById('viewerCount').textContent = liveData.viewerCount || 0;
    document.getElementById('likeCount').textContent = liveData.likes || 0;
    document.getElementById('giftCount').textContent = liveData.giftCount || 0;
    document.getElementById('earningsCount').textContent = `R$ ${(liveData.totalEarnings || 0).toFixed(2)}`;
    
    // Atualizar badge
    const liveBadge = document.getElementById('liveBadge');
    if (liveBadge) {
        if (liveData.privacy === 'ticket' || liveData.privacy === 'subscription') {
            liveBadge.textContent = 'EXCLUSIVO';
            liveBadge.className = 'lux-live-badge exclusive';
        } else {
            liveBadge.textContent = 'AO VIVO';
            liveBadge.className = 'lux-live-badge live';
        }
    }
    
    // Configurar botões baseado no papel do usuário
    const exitBtn = document.getElementById('exitLiveBtn');
    if (exitBtn) {
        if (isHost) {
            exitBtn.innerHTML = '<i class="fas fa-stop"></i> Encerrar Live';
            exitBtn.className = 'lux-btn lux-btn-danger';
        } else {
            exitBtn.innerHTML = '<i class="fas fa-times"></i> Sair';
            exitBtn.className = 'lux-btn lux-btn-secondary';
        }
    }
    
    console.log('Player de live mostrado');
}

function hideLivePlayer() {
    const player = document.getElementById('livePlayer');
    const grid = document.getElementById('liveGrid');
    
    if (player) player.classList.add('hidden');
    if (grid) grid.style.display = 'block';
    
    // Parar streams
    if (isBroadcasting) {
        stopBroadcast();
    }
    
    if (isWatching) {
        // Parar de assistir
        const videoElement = document.getElementById('liveVideo');
        if (videoElement) {
            videoElement.src = '';
        }
    }
    
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
    
    console.log('Player de live ocultado');
}

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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
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
    console.log('Configurando event listeners...');
    
    // Botão Criar Live
    document.getElementById('createLiveBtn')?.addEventListener('click', () => {
        openModal('createLiveModal');
    });
    
    // Botão no formulário de criação
    document.getElementById('createLiveForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        createLive();
    });
    
    // Cancelar criação
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

