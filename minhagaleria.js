// Adicione no início do seu JavaScript
const notificationSounds = {
    success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'),
    error: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'),
    info: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3')
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
let currentAlbum = null;


// Sistema de abas corrigido
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove classe active de todas as abas e conteúdos
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Adiciona classe active à aba clicada
        this.classList.add('active');
        
        // Mostra o conteúdo correspondente
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// Restante do seu código JavaScript permanece igual
// Evento quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    

    // Sistema de abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Mostrar/ocultar campo de preço baseado na privacidade
    document.getElementById('album-privacy').addEventListener('change', function() {
        const priceField = document.getElementById('price-field');
        priceField.style.display = this.value === 'paid' ? 'block' : 'none';
    });

    // Formulário de criação de álbum
    document.getElementById('album-form').addEventListener('submit', function(e) {
        e.preventDefault();
        createAlbum();
    });

    // Modal de álbum
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('album-modal').style.display = 'none';
            document.getElementById('share-modal').style.display = 'none';
        });
    });

    // Botão para adicionar fotos
    document.getElementById('add-photos-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    // Input para upload de fotos
    document.getElementById('file-input').addEventListener('change', function(e) {
        uploadPhotos(e.target.files);
    });
});

// Adicione este código após a definição da função deleteAlbum
document.getElementById('delete-album-btn').addEventListener('click', function() {
    if (currentAlbum && currentAlbum.id) {
        deleteAlbum(currentAlbum.id, currentAlbum.name);
        
        // Fecha o modal após abrir a confirmação
        document.getElementById('album-modal').style.display = 'none';
    } else {
        showNotification('Nenhum álbum selecionado', 'error');
    }
});


async function loadUserAlbums() {
    const albumsContainer = document.getElementById('albums-container');
    albumsContainer.innerHTML = '';
    showLoading("Carregando seus álbuns...");

    try {
        const albumsSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').get();

        hideLoading();
        
        if (albumsSnapshot.empty) {
            albumsContainer.innerHTML = '<p class="no-albums-message">Você ainda não tem álbuns. Crie seu primeiro álbum!</p>';
            return;
        }

        // Usando Promise.all para carregar vários álbuns simultaneamente
        const albumCards = [];
        for (const doc of albumsSnapshot.docs) {
            albumCards.push(createAlbumCard(doc.data(), doc.id));
        }
        
        await Promise.all(albumCards);
    } catch (error) {
        hideLoading();
        console.error("Erro ao carregar álbuns: ", error);
        albumsContainer.innerHTML = '<p class="error-message">Erro ao carregar álbuns. Tente novamente.</p>';
    }
}


async function createAlbumCard(album, albumId) {
    try {
        const albumCard = document.createElement('div');
        albumCard.className = 'album-card';
        
        let coverImageUrl = album.coverUrl || 'https://via.placeholder.com/300x200?text=Carregando...';
        
        if (!album.coverUrl) {
            const firstPhotoUrl = await getFirstAlbumPhoto(albumId);
            if (firstPhotoUrl) {
                coverImageUrl = firstPhotoUrl;
            }
        }
        
        albumCard.innerHTML = `
            <div class="album-cover-container">
                <img src="${coverImageUrl}" alt="${album.name}" class="album-cover">
                <div class="album-overlay"></div>
                <button class="delete-album-btn" data-album-id="${albumId}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <div class="album-info">
                <h3>${album.name}</h3>
                <p>${album.photosCount || 0} fotos</p>
                <span class="privacy-badge ${album.privacy}">${getPrivacyLabel(album.privacy)}</span>
            </div>
        `;

        albumCard.addEventListener('click', (e) => {
            // Não abrir o álbum se clicar no botão de excluir
            if (!e.target.closest('.delete-album-btn')) {
                openAlbum(albumId, album);
            }
        });
        
        // Adiciona evento de exclusão
        const deleteBtn = albumCard.querySelector('.delete-album-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteAlbum(albumId, album.name);
        });

        document.getElementById('albums-container').appendChild(albumCard);
    } catch (error) {
        console.error("Erro ao criar card do álbum:", error);
        // Fallback básico se algo der errado
        const fallbackCard = document.createElement('div');
        fallbackCard.className = 'album-card';
        fallbackCard.innerHTML = `
            <div class="album-cover-container">
                <img src="https://via.placeholder.com/300x200?text=Erro" alt="${album.name}">
            </div>
            <div class="album-info">
                <h3>${album.name}</h3>
            </div>
        `;
        document.getElementById('albums-container').appendChild(fallbackCard);
    }
}

async function deleteAlbum(albumId, albumName) {
    const confirmDelete = await Swal.fire({
        title: 'Excluir Álbum',
        html: `Tem certeza que deseja excluir permanentemente o álbum <b>"${albumName}"</b>?<br><small>Todas as fotos serão removidas e esta ação não pode ser desfeita.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, excluir permanentemente',
        cancelButtonText: 'Cancelar',
        backdrop: 'rgba(0,0,0,0.8)'
    });

    if (!confirmDelete.isConfirmed) return;

    showLoading(`Excluindo álbum "${albumName}"...`);

    try {
        // Primeiro, excluir todas as fotos do Storage
        const photosSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId)
            .collection('photos').get();

        const storage = firebase.storage();
        const deletePhotoPromises = photosSnapshot.docs.map(doc => {
            const photoUrl = doc.data().url;
            const photoRef = storage.refFromURL(photoUrl);
            return photoRef.delete().catch(error => {
                console.error("Erro ao excluir foto:", error);
            });
        });

        await Promise.all(deletePhotoPromises);

        // Depois excluir todas as fotos do Firestore
        const deletePhotosPromises = photosSnapshot.docs.map(doc => 
            doc.ref.delete()
        );
        await Promise.all(deletePhotosPromises);

        // Finalmente excluir o álbum
        await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId).delete();

        hideLoading();
        showNotification(`Álbum "${albumName}" excluído com sucesso!`, 'success');
        
        // Fecha o modal e recarrega a lista de álbuns
        document.getElementById('album-modal').style.display = 'none';
        loadUserAlbums();
    } catch (error) {
        hideLoading();
        console.error("Erro ao excluir álbum:", error);
        showNotification('Erro ao excluir álbum. Tente novamente.', 'error');
    }
}


// Função auxiliar para pegar a primeira foto do álbum
async function getFirstAlbumPhoto(albumId) {
    try {
        const photosSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId)
            .collection('photos')
            .orderBy('uploadedAt', 'asc')
            .limit(1)
            .get();
        
        if (!photosSnapshot.empty) {
            return photosSnapshot.docs[0].data().url;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar primeira foto:", error);
        return null;
    }
}

async function setAlbumCover(albumId, imageUrl) {
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId)
            .update({
                coverUrl: imageUrl
            });
        
        showNotification('Capa do álbum atualizada com sucesso!', 'success');
        return true;
    } catch (error) {
        console.error("Erro ao atualizar capa:", error);
        showNotification('Erro ao atualizar capa', 'error');
        return false;
    }
}

let selectedPhotoId = null;


async function openAlbum(albumId, albumData) {
    // Define o álbum atual antes de abrir o modal
    currentAlbum = { id: albumId, ...albumData };
    
    const modal = document.getElementById('album-modal');
    const photosContainer = document.getElementById('album-photos-container');
    
    document.getElementById('modal-album-title').textContent = albumData.name;
    photosContainer.innerHTML = '<p>Carregando fotos...</p>';
    modal.style.display = 'block';

    // Restante do código permanece o mesmo...
    try {
        const photosSnapshot = await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId)
            .collection('photos').get();

        if (photosSnapshot.empty) {
            photosContainer.innerHTML = '<p>Nenhuma foto neste álbum ainda.</p>';
            return;
        }

        photosContainer.innerHTML = '';
        photosSnapshot.forEach(doc => {
            const photo = doc.data();
            const photoElement = document.createElement('div');
            photoElement.className = 'photo-item';
            photoElement.dataset.id = doc.id;
            photoElement.innerHTML = `
                <img src="${photo.url}" alt="Foto">
                <div class="photo-actions">
                    <button class="delete-photo" data-id="${doc.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;
            photosContainer.appendChild(photoElement);
            
            photoElement.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-photo')) {
                    document.querySelectorAll('.photo-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    photoElement.classList.add('selected');
                    selectedPhotoId = doc.id;
                }
            });

            // Adiciona evento para deletar foto
            photoElement.querySelector('.delete-photo').addEventListener('click', (e) => {
                e.stopPropagation();
                deletePhoto(albumId, doc.id);
            });
        });
    } catch (error) {
        console.error("Erro ao carregar fotos: ", error);
        photosContainer.innerHTML = '<p>Erro ao carregar fotos. Tente novamente.</p>';
    }
}

// Adicione este evento para o botão de definir capa
document.getElementById('set-cover-btn').addEventListener('click', async function() {
    if (!selectedPhotoId) {
        showNotification('Selecione uma foto primeiro', 'warning');
        return;
    }
    
    const photoDoc = await db.collection('users').doc(currentUser.uid)
        .collection('MinhaGaleria').doc(currentAlbum.id)
        .collection('photos').doc(selectedPhotoId).get();
    
    if (photoDoc.exists) {
        const success = await setAlbumCover(currentAlbum.id, photoDoc.data().url);
        if (success) {
            loadUserAlbums(); // Recarrega os álbuns para mostrar a nova capa
        }
    }
});
// Funções para controlar o loading
function showLoading(text = "Processando...") {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = text;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Modifique a função createAlbum para incluir o loading
async function createAlbum() {
    const name = document.getElementById('album-name').value;
    const description = document.getElementById('album-description').value;
    const privacy = document.getElementById('album-privacy').value;
    const price = privacy === 'paid' ? parseFloat(document.getElementById('album-price').value) : 0;

    if (!name) {
         showNotification('Por favor, dê um nome ao álbum');

        return;
    }

    if (privacy === 'paid' && (isNaN(price) || price <= 0)) {
        showNotification('Por favor, insira um preço válido');
        return;
    }

    showLoading("Criando seu álbum...");

    try {
        const albumRef = await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').add({
                name,
                description,
                privacy,
                price,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                photosCount: 0
            });

        hideLoading();
showNotification('Álbum criado com sucesso!', 'success');
        document.getElementById('album-form').reset();
        loadUserAlbums();
    } catch (error) {
        hideLoading();
        console.error("Erro ao criar álbum: ", error);
showNotification('Erro ao criar álbum. Tente novamente.', 'error');
    }
}

// Modifique a função uploadPhotos para incluir o loading
async function uploadPhotos(files) {
    if (!files || files.length === 0) return;

    const albumId = currentAlbum.id;
    const storageRef = storage.ref();
    const albumRef = db.collection('users').doc(currentUser.uid)
        .collection('MinhaGaleria').doc(albumId);

    showLoading(`Enviando 1 de ${files.length} fotos...`);

    try {
        for (let i = 0; i < files.length; i++) {
            // Atualiza o texto do loading
            document.getElementById('loading-text').textContent = 
                `Enviando ${i+1} de ${files.length} fotos...`;
            
            const file = files[i];
            const filePath = `users/${currentUser.uid}/albums/${albumId}/${Date.now()}_${file.name}`;
            const fileRef = storageRef.child(filePath);
            
            // Upload com monitoramento de progresso
            const uploadTask = fileRef.put(file);
            
            // Espera o upload completar
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        // Você pode usar isso para mostrar progresso detalhado se quiser
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload: ${progress}%`);
                    },
                    (error) => reject(error),
                    () => resolve()
                );
            });
            
            const downloadUrl = await fileRef.getDownloadURL();
            await albumRef.collection('photos').add({
                url: downloadUrl,
                name: file.name,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // Atualiza contador de fotos
        const photosCount = (await albumRef.collection('photos').get()).size;
        await albumRef.update({ photosCount });

        hideLoading();
showNotification('Fotos adicionadas com sucesso!', 'success');
        openAlbum(albumId, currentAlbum);
    } catch (error) {
        hideLoading();
        console.error("Erro ao fazer upload: ", error);
showNotification('Erro ao conectar com o servidor', 'error');
    }
}

// Modifique a função deletePhoto para incluir o loading
async function deletePhoto(albumId, photoId) {
showNotification('Foto Excluida', 'warning');

    showLoading("Excluindo foto...");

    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId)
            .collection('photos').doc(photoId).delete();

        // Atualiza contador de fotos
        const albumRef = db.collection('users').doc(currentUser.uid)
            .collection('MinhaGaleria').doc(albumId);
        const photosCount = (await albumRef.collection('photos').get()).size;
        await albumRef.update({ photosCount });

        hideLoading();
        openAlbum(albumId, currentAlbum);
    } catch (error) {
        hideLoading();
        console.error("Erro ao excluir foto: ", error);
        showNotification('Erro ao excluir foto. Tente novamente.');
    }
}
// Função auxiliar para obter rótulo de privacidade
function getPrivacyLabel(privacy) {
    switch (privacy) {
        case 'public': return 'Público';
        case 'private': return 'Privado';
        case 'paid': return 'Pago';
        default: return privacy;
    }
}

function updateProfilePhoto(imageUrl) {
    const avatarImg = document.getElementById('user-avatar');
    
    if (imageUrl) {
        avatarImg.src = imageUrl;
        avatarImg.classList.remove('default-avatar');
    } else {
        // Se não houver foto, mostra as iniciais
        const userName = document.getElementById('user-name').textContent;
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();
        avatarImg.src = '';
        avatarImg.alt = initials;
        avatarImg.classList.add('default-avatar');
    }
}


// Função para mostrar notificações personalizadas
function showNotification(message, type = 'info') {
   if (notificationSounds[type]) {
        notificationSounds[type].cloneNode(true).play(); // cloneNode para permitir múltiplas notificações
    }
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Ícones para cada tipo (você pode usar ícones de uma biblioteca como Font Awesome)
   // Atualize o objeto icons para usar Font Awesome
const icons = {
    success: '<i class="fas fa-check-circle"></i>',
    error: '<i class="fas fa-times-circle"></i>',
    warning: '<i class="fas fa-exclamation-triangle"></i>',
    info: '<i class="fas fa-info-circle"></i>'
};
    
    notification.innerHTML = `
        <span class="notification-icon">${icons[type] || icons.info}</span>
        <span class="notification-message">${message}</span>
        <span class="notification-close">&times;</span>
    `;
    
    container.appendChild(notification);
    
    // Fechar ao clicar no X
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => notification.remove(), 500);
    });
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Menu Mobile
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.createElement('button');
  mobileMenuBtn.className = 'mobile-menu-btn';
  mobileMenuBtn.innerHTML = '☰';
  document.body.appendChild(mobileMenuBtn);
  
  const galleryTabs = document.querySelector('.gallery-tabs');
  
  mobileMenuBtn.addEventListener('click', function() {
    galleryTabs.classList.toggle('active');
  });
  
  // Fechar menu ao clicar em uma aba
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      galleryTabs.classList.remove('active');
    });
  });
  
  // Fechar menu ao clicar fora
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.gallery-tabs') && !e.target.closest('.mobile-menu-btn')) {
      galleryTabs.classList.remove('active');
    }
  });
});


// Função para carregar informações do usuário no cabeçalho
async function loadUserHeaderInfo() {
    if (!currentUser) return;
    
    try {
        // Obter dados do usuário do Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Atualizar informações básicas
            document.getElementById('user-name').textContent = userData.name || 'Usuário';
            document.getElementById('user-balance').textContent = `Saldo: R$ ${(userData.balance || 0).toFixed(2)}`;
            
            // Atualizar avatar - CORREÇÃO AQUI (profilePhotoURL em vez de profileImage)
           updateProfilePhoto(userData.profilePhotoURL);

            
            // Restante do código permanece igual...
            let totalEarnings = 0;
            let totalViews = 0;
            let subscribersCount = 0;
            
            const albumsSnapshot = await db.collection('users').doc(currentUser.uid)
                .collection('MinhaGaleria').get();
            
            for (const albumDoc of albumsSnapshot.docs) {
                const albumData = albumDoc.data();
                
                if (albumData.privacy === 'paid' && albumData.earnings) {
                    totalEarnings += albumData.earnings;
                }
                
                if (albumData.views) {
                    totalViews += albumData.views;
                }
                
                if (albumData.privacy === 'paid') {
                    const subsSnapshot = await albumDoc.ref.collection('subscribers').get();
                    subscribersCount += subsSnapshot.size;
                }
            }
            
            document.getElementById('total-earnings').textContent = `R$ ${totalEarnings.toFixed(2)}`;
            document.getElementById('total-views').textContent = totalViews.toLocaleString();
            document.getElementById('subscribers-count').textContent = subscribersCount.toLocaleString();
        }
    } catch (error) {
        console.error("Erro ao carregar informações do usuário:", error);
        // Mostrar notificação de erro
        showNotification('Erro ao carregar dados do perfil', 'error');
    }
}


function updateProfilePhoto(imageUrl) {
    const avatarImg = document.getElementById('user-avatar');
    
    if (imageUrl) {
        avatarImg.src = imageUrl;
        avatarImg.classList.remove('default-avatar');
    } else {
        // Se não houver foto, mostra as iniciais
        const userName = document.getElementById('user-name').textContent;
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase();
        avatarImg.src = '';
        avatarImg.alt = initials;
        avatarImg.classList.add('default-avatar');
    }
}

// Adicione após a definição de db
function setupProfileListener() {
    if (!currentUser) return;
    
    db.collection('users').doc(currentUser.uid)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                document.getElementById('user-name').textContent = userData.name || 'Usuário';
                document.getElementById('user-balance').textContent = `Saldo: R$ ${(userData.balance || 0).toFixed(2)}`;
                updateProfilePhoto(userData.profilePhotoURL);
            }
        }, (error) => {
            console.error("Erro no listener do perfil:", error);
        });
}

// Chame esta função após o login
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadUserHeaderInfo();
        loadUserAlbums();
        setupProfileListener(); // Adicione esta linha
    }
});
