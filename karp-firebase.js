import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjEd4pN33WpoJlT2rsAgDFMO3A4Uh-M4s",
  authDomain: "able-2ca24.firebaseapp.com",
  projectId: "able-2ca24",
  messagingSenderId: "784635231366",
  appId: "1:784635231366:web:fbde7a6daaf4e3e4f0e507",
  measurementId: "G-L9C4YX8MEJ"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let analytics = null;
try {
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    analytics = getAnalytics(app);
  }
} catch (e) {
  console.warn('Firebase Analytics unavailable:', e);
}

export { app, auth, db, analytics };