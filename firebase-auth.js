// Firebase Authentication Module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBJ6Evrxvax1K9zknHDVdgKmMVKMfqf6FY",
    authDomain: "places-app-5473a.firebaseapp.com",
    projectId: "places-app-5473a",
    storageBucket: "places-app-5473a.firebasestorage.app",
    messagingSenderId: "880636430754",
    appId: "1:880636430754:web:27d71f688a1803fb398afb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use in other modules
window.firebaseAuth = auth;
window.firebaseDb = db;

// DOM Elements
const authContainer = document.getElementById('authContainer');
const mainHeader = document.getElementById('mainHeader');
const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
const btnSignOut = document.getElementById('btnSignOut');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

// Google Sign In
btnGoogleSignIn?.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        showToast('התחברת בהצלחה! 🎉', 'success');
    } catch (error) {
        console.error('Error signing in:', error);
        showToast('שגיאה בהתחברות. נסה שוב.', 'error');
    }
});

// Sign Out
btnSignOut?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showToast('התנתקת בהצלחה', 'info');
    } catch (error) {
        console.error('Error signing out:', error);
        showToast('שגיאה בהתנתקות', 'error');
    }
});

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        authContainer.style.display = 'none';
        mainHeader.style.display = 'block';
        document.querySelector('.filters-bar').style.display = 'block';
        document.querySelector('.stats-bar').style.display = 'flex';
        document.querySelector('.places-container').style.display = 'block';

        // Update user profile
        if (userAvatar && userName) {
            userAvatar.src = user.photoURL || '';
            userName.textContent = user.displayName || user.email;
        }

        // Trigger app to load user's places
        if (window.loadUserPlaces) {
            window.loadUserPlaces(user.uid);
        }
    } else {
        // User is signed out
        console.log('User signed out');
        authContainer.style.display = 'flex';
        mainHeader.style.display = 'none';
        document.querySelector('.filters-bar').style.display = 'none';
        document.querySelector('.stats-bar').style.display = 'none';
        document.querySelector('.places-container').style.display = 'none';
    }
});

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const container = document.getElementById('toastContainer');
    container?.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
