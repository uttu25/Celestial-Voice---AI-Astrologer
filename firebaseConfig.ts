import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// CONFIGURATION UPDATED FROM PROVIDED JSON
// ------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyAyKSioDgVPUpHFyuXvb0yB7EBH3uQ3uCQ",
  authDomain: "celestial-voice---ai-astrologe.firebaseapp.com",
  projectId: "celestial-voice---ai-astrologe",
  storageBucket: "celestial-voice---ai-astrologe.firebasestorage.app",
  messagingSenderId: "612222375736",
  // Note: This is the Android App ID. For the web version to work perfectly without warnings, 
  // you should register a "Web App" in Firebase Console and use that App ID here.
  // However, this will often work for basic authentication and database access.
  appId: "1:612222375736:android:2d7f2584eaa95a65ef53cd" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helper to check if config is missing (Updated to check for real key)
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE" && firebaseConfig.projectId !== "PASTE_YOUR_PROJECT_ID";
};