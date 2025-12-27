// Firebase Firestore Integration
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ================================
// App State
// ================================
let places = [];
let currentFilter = {
    category: 'all',
    visited: 'all',
    priority: 'all',
    searchQuery: ''
};
let editingPlaceId = null;
let selectedImageData = null;
let currentUserId = null;
let unsubscribePlaces = null;

// ================================
// Category Config
// ================================
const CATEGORIES = {
    restaurant: { icon: '🍽️', label: 'מסעדה' },
    bar: { icon: '🍸', label: 'בר' },
    cafe: { icon: '☕', label: 'בית קפה' },
    attraction: { icon: '🎡', label: 'אטרקציה' },
    other: { icon: '✨', label: 'אחר' }
};

const PRIORITY_CONFIG = {
    high: { icon: '🔥', label: 'גבוהה', color: '#F44336' },
    medium: { icon: '⭐', label: 'בינונית', color: '#FF9800' },
    low: { icon: '💫', label: 'נמוכה', color: '#2196F3' }
};

// ================================
// Initialization
// ================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
});

//  Load shared places when authenticated
window.loadUserPlaces = function (userId) {
    currentUserId = userId;
    subscribeToPlaces();
};

// ================================
// Firestore Functions
// ================================
function subscribeToPlaces() {
    if (!window.firebaseDb) {
        console.error('Firestore not initialized');
        return;
    }

    // Unsubscribe from previous listener
    if (unsubscribePlaces) {
        unsubscribePlaces();
    }

    // Use shared collection for both users
    const placesRef = collection(window.firebaseDb, 'sharedPlaces');

    unsubscribePlaces = onSnapshot(placesRef, (snapshot) => {
        places = [];
        snapshot.forEach((doc) => {
            places.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort by createdAt descending
        places.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        renderPlaces();
        updateStats();
    }, (error) => {
        console.error('Error loading places:', error);
        showToast('שגיאה בטעינת המקומות', 'error');
    });
}

async function savePlace(placeData) {
    if (!currentUserId || !window.firebaseDb) {
        showToast('יש להתחבר כדי לשמור מקומות', 'error');
        return;
    }

    try {
        // Save to shared collection
        const placeRef = doc(window.firebaseDb, 'sharedPlaces', placeData.id);
        await setDoc(placeRef, placeData);
        console.log('Place saved successfully');
    } catch (error) {
        console.error('Error saving place:', error);
        showToast('שגיאה בשמירת המקום', 'error');
        throw error;
    }
}

async function deletePlaceFromFirestore(placeId) {
    if (!currentUserId || !window.firebaseDb) {
        showToast('יש להתחבר כדי למחוק מקומות', 'error');
        return;
    }

    try {
        // Delete from shared collection
        const placeRef = doc(window.firebaseDb, 'sharedPlaces', placeId);
        await deleteDoc(placeRef);
        console.log('Place deleted successfully');
    } catch (error) {
        console.error('Error deleting place:', error);
        showToast('שגיאה במחיקת המקום', 'error');
        throw error;
    }
}

// ================================
// Event Listeners
// ================================
function initEventListeners() {
    // Add button
    document.getElementById('btnAdd')?.addEventListener('click', openAddModal);

    // Search
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        currentFilter.searchQuery = e.target.value.toLowerCase();
        renderPlaces();
    });

    // Category filters
    document.querySelectorAll('.chip-category').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            currentFilter.category = category;

            // Update active state
            document.querySelectorAll('.chip-category').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');

            renderPlaces();
        });
    });

    // Visited toggle
    const toggleVisited = document.getElementById('toggleVisited');
    toggleVisited?.addEventListener('click', (e) => {
        const currentState = currentFilter.visited;
        if (currentState === 'all') {
            currentFilter.visited = 'unvisited';
            e.currentTarget.querySelector('span:last-child').textContent = 'לא ביקרנו';
            e.currentTarget.style.background = 'var(--gradient-primary)';
            e.currentTarget.style.color = 'white';
        } else if (currentState === 'unvisited') {
            currentFilter.visited = 'visited';
            e.currentTarget.querySelector('span:last-child').textContent = 'ביקרנו';
            e.currentTarget.style.background = 'var(--success)';
            e.currentTarget.style.color = 'white';
        } else {
            currentFilter.visited = 'all';
            e.currentTarget.querySelector('span:last-child').textContent = 'הכל';
            e.currentTarget.style.background = '';
            e.currentTarget.style.color = '';
        }
        renderPlaces();
    });

    // Priority toggle
    const togglePriority = document.getElementById('togglePriority');
    togglePriority?.addEventListener('click', (e) => {
        const priorities = ['all', 'high', 'medium', 'low'];
        const currentIndex = priorities.indexOf(currentFilter.priority);
        const nextIndex = (currentIndex + 1) % priorities.length;
        currentFilter.priority = priorities[nextIndex];

        if (currentFilter.priority === 'all') {
            e.currentTarget.querySelector('span:last-child').textContent = 'כל העדיפויות';
            e.currentTarget.style.background = '';
            e.currentTarget.style.color = '';
        } else {
            const config = PRIORITY_CONFIG[currentFilter.priority];
            e.currentTarget.querySelector('span:last-child').textContent = config.label;
            e.currentTarget.style.background = config.color;
            e.currentTarget.style.color = 'white';
        }
        renderPlaces();
    });

    // Form submit
    document.getElementById('placeForm')?.addEventListener('submit', handleFormSubmit);

    // Image upload
    document.getElementById('imageInput')?.addEventListener('change', handleImageUpload);
    document.getElementById('btnRemoveImage')?.addEventListener('click', removeImage);

    // Star rating
    document.querySelectorAll('.star-rating .star').forEach(star => {
        star.addEventListener('click', (e) => {
            const rating = parseInt(e.currentTarget.dataset.rating);
            document.getElementById('placeRating').value = rating;
            updateStarDisplay(rating);
        });
    });

    // Priority selector
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const priority = e.currentTarget.dataset.priority;
            document.getElementById('placePriority').value = priority;

            // Update active state
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
}

// ================================
// Render Functions
// ================================
function renderPlaces() {
    const grid = document.getElementById('placesGrid');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noResults');

    // Filter places
    const filtered = filterPlaces();

    // Update category counts
    updateCategoryCounts();

    // Show/hide states
    if (places.length === 0) {
        emptyState.style.display = 'block';
        noResults.style.display = 'none';
        grid.style.display = 'none';
        return;
    }

    if (filtered.length === 0) {
        emptyState.style.display = 'none';
        noResults.style.display = 'block';
        grid.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    noResults.style.display = 'none';
    grid.style.display = 'grid';

    // Render cards
    grid.innerHTML = filtered.map(place => createPlaceCard(place)).join('');

    // Add event listeners to cards
    attachCardEventListeners();
}

function filterPlaces() {
    return places.filter(place => {
        // Category filter
        if (currentFilter.category !== 'all' && place.category !== currentFilter.category) {
            return false;
        }

        // Visited filter
        if (currentFilter.visited === 'visited' && !place.visited) {
            return false;
        }
        if (currentFilter.visited === 'unvisited' && place.visited) {
            return false;
        }

        // Priority filter
        if (currentFilter.priority !== 'all' && place.priority !== currentFilter.priority) {
            return false;
        }

        // Search filter
        if (currentFilter.searchQuery) {
            const query = currentFilter.searchQuery;
            const searchableText = `${place.name} ${place.address} ${place.notes}`.toLowerCase();
            if (!searchableText.includes(query)) {
                return false;
            }
        }

        return true;
    });
}

function createPlaceCard(place) {
    const category = CATEGORIES[place.category] || CATEGORIES.other;
    const priority = PRIORITY_CONFIG[place.priority];

    // Create stars
    const stars = Array.from({ length: 5 }, (_, i) => {
        const filled = i < place.rating;
        return `<span class="star ${filled ? 'filled' : 'empty'}">★</span>`;
    }).join('');

    // Image
    const imageHtml = place.imageUrl
        ? `<img src="${place.imageUrl}" alt="${place.name}">`
        : category.icon;

    const imageClass = place.imageUrl ? '' : 'no-image';

    return `
        <div class="place-card ${place.visited ? 'visited' : ''}" data-id="${place.id}">
            <div class="place-card-image ${imageClass}">
                ${imageHtml}
                ${place.visited ? '<div class="visited-badge">✓ ביקרנו</div>' : ''}
                ${place.priority !== 'medium' ? `<div class="priority-badge ${place.priority}">${priority.icon} ${priority.label}</div>` : ''}
            </div>
            <div class="place-card-content">
                <div class="place-card-header">
                    <div>
                        <h3 class="place-name">${escapeHtml(place.name)}</h3>
                        ${place.rating > 0 ? `<div class="place-rating">${stars}</div>` : ''}
                    </div>
                </div>
                
                <div class="category-badge">${category.icon} ${category.label}</div>
                
                ${place.address ? `<div class="place-address">📍 ${escapeHtml(place.address)}</div>` : ''}
                
                ${place.notes ? `<div class="place-notes">${escapeHtml(place.notes)}</div>` : ''}
                
                ${place.website ? `<a href="${escapeHtml(place.website)}" target="_blank" class="place-website" onclick="event.stopPropagation()">🔗 אתר המקום</a>` : ''}
                
                <div class="place-info-badges">
                    ${place.openSaturday ? '<span class="info-badge">🗓️ פתוח בשבת</span>' : ''}
                    ${place.onlineReservation ? '<span class="info-badge">💻 הזמנה אונליין</span>' : ''}
                </div>
                
                <div class="place-card-actions">
                    <button class="btn-action btn-visited ${place.visited ? 'active' : ''}" 
                            onclick="toggleVisited('${place.id}')">
                        ${place.visited ? '✓ ביקרנו' : 'סמן כביקור'}
                    </button>
                    <button class="btn-action btn-edit" onclick="openEditModal('${place.id}')">
                        ✏️ ערוך
                    </button>
                    <button class="btn-action btn-delete" onclick="openDeleteModal('${place.id}')">
                        🗑️ מחק
                    </button>
                </div>
            </div>
        </div>
    `;
}

function attachCardEventListeners() {
    // Card event listeners are handled via onclick in HTML for simplicity
}

function updateCategoryCounts() {
    const counts = {
        all: places.length,
        restaurant: 0,
        bar: 0,
        cafe: 0,
        attraction: 0,
        other: 0
    };

    places.forEach(place => {
        if (counts.hasOwnProperty(place.category)) {
            counts[place.category]++;
        }
    });

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countRestaurant').textContent = counts.restaurant;
    document.getElementById('countBar').textContent = counts.bar;
    document.getElementById('countCafe').textContent = counts.cafe;
    document.getElementById('countAttraction').textContent = counts.attraction;
    document.getElementById('countOther').textContent = counts.other;
}

function updateStats() {
    const total = places.length;
    const visited = places.filter(p => p.visited).length;
    const remaining = total - visited;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statVisited').textContent = visited;
    document.getElementById('statRemaining').textContent = remaining;
}

// ================================
// Modal Functions
// ================================
function openAddModal() {
    editingPlaceId = null;
    selectedImageData = null;

    document.getElementById('modalTitle').textContent = 'הוספת מקום חדש';
    document.getElementById('placeForm').reset();
    document.getElementById('placeId').value = '';
    document.getElementById('placeRating').value = '0';
    document.getElementById('placePriority').value = 'medium';

    // Reset image
    document.getElementById('imagePreview').classList.remove('active');
    document.getElementById('uploadLabel').classList.remove('hidden');

    // Reset stars
    updateStarDisplay(0);

    // Reset priority
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.priority === 'medium');
    });

    document.getElementById('placeModal').classList.add('active');
}

function openEditModal(placeId) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;

    editingPlaceId = placeId;
    selectedImageData = place.imageUrl;

    document.getElementById('modalTitle').textContent = 'עריכת מקום';
    document.getElementById('placeId').value = place.id;
    document.getElementById('placeName').value = place.name;
    document.getElementById('placeCategory').value = place.category;
    document.getElementById('placeAddress').value = place.address || '';
    document.getElementById('placeWebsite').value = place.website || '';
    document.getElementById('placeRating').value = place.rating;
    document.getElementById('placePriority').value = place.priority;
    document.getElementById('placeNotes').value = place.notes || '';
    document.getElementById('placeOpenSaturday').checked = place.openSaturday || false;
    document.getElementById('placeOnlineReservation').checked = place.onlineReservation || false;
    document.getElementById('placeVisited').checked = place.visited;

    // Set image
    if (place.imageUrl) {
        document.getElementById('previewImg').src = place.imageUrl;
        document.getElementById('imagePreview').classList.add('active');
        document.getElementById('uploadLabel').classList.add('hidden');
    } else {
        document.getElementById('imagePreview').classList.remove('active');
        document.getElementById('uploadLabel').classList.remove('hidden');
    }

    // Set stars
    updateStarDisplay(place.rating);

    // Set priority
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.priority === place.priority);
    });

    document.getElementById('placeModal').classList.add('active');
}

function closeModal() {
    document.getElementById('placeModal').classList.remove('active');
    editingPlaceId = null;
    selectedImageData = null;
}

function openDeleteModal(placeId) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;

    document.getElementById('deleteModalPlaceName').textContent = place.name;
    document.getElementById('deleteModal').classList.add('active');

    // Set up confirm button
    const btnConfirm = document.getElementById('btnConfirmDelete');
    btnConfirm.onclick = () => {
        deletePlace(placeId);
        closeDeleteModal();
    };
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

// ================================
// CRUD Functions
// ================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        id: editingPlaceId || generateId(),
        name: document.getElementById('placeName').value.trim(),
        category: document.getElementById('placeCategory').value,
        address: document.getElementById('placeAddress').value.trim(),
        website: document.getElementById('placeWebsite').value.trim(),
        rating: parseInt(document.getElementById('placeRating').value),
        priority: document.getElementById('placePriority').value,
        notes: document.getElementById('placeNotes').value.trim(),
        openSaturday: document.getElementById('placeOpenSaturday').checked,
        onlineReservation: document.getElementById('placeOnlineReservation').checked,
        visited: document.getElementById('placeVisited').checked,
        imageUrl: selectedImageData || '',
        createdAt: editingPlaceId ? places.find(p => p.id === editingPlaceId)?.createdAt || Date.now() : Date.now(),
        updatedAt: Date.now()
    };

    try {
        await savePlace(formData);
        showToast(editingPlaceId ? 'המקום עודכן בהצלחה!' : 'המקום נוסף בהצלחה!', 'success');
        closeModal();
    } catch (error) {
        // Error already shown in savePlace
    }
}

async function toggleVisited(placeId) {
    const place = places.find(p => p.id === placeId);
    if (!place) return;

    const updatedPlace = {
        ...place,
        visited: !place.visited,
        visitedDate: !place.visited ? Date.now() : null,
        updatedAt: Date.now()
    };

    try {
        await savePlace(updatedPlace);
        showToast(updatedPlace.visited ? 'סומן כביקור! 🎉' : 'סימון הביקור הוסר', 'success');
    } catch (error) {
        // Error already shown in savePlace
    }
}

async function deletePlace(placeId) {
    try {
        await deletePlaceFromFirestore(placeId);
        showToast('המקום נמחק', 'info');
    } catch (error) {
        // Error already shown in deletePlaceFromFirestore
    }
}

// ================================
// Image Handling
// ================================
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('אנא בחר קובץ תמונה תקין', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('התמונה גדולה מדי. מקסימום 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        selectedImageData = event.target.result;
        document.getElementById('previewImg').src = selectedImageData;
        document.getElementById('imagePreview').classList.add('active');
        document.getElementById('uploadLabel').classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removeImage(e) {
    e.preventDefault();
    e.stopPropagation();

    selectedImageData = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').classList.remove('active');
    document.getElementById('uploadLabel').classList.remove('hidden');
}

// ================================
// UI Helper Functions
// ================================
function updateStarDisplay(rating) {
    document.querySelectorAll('.star-rating .star').forEach((star, index) => {
        star.classList.toggle('active', index < rating);
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// ================================
// Utility Functions
// ================================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================
// Make functions global for onclick handlers
// ================================
window.toggleVisited = toggleVisited;
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;

// ================================
// PWA Service Worker
// ================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
    });
}
