import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (cachedApp) return cachedApp;
  try {
    if (getApps().length > 0) {
      cachedApp = getApp();
    } else if (firebaseConfig.apiKey) {
      cachedApp = initializeApp(firebaseConfig);
    }
    return cachedApp;
  } catch (error) {
    console.warn("Firebase App initialization warning:", error);
    return null;
  }
};

export const getFirebaseAuth = (): Auth | null => {
  if (cachedAuth) return cachedAuth;
  try {
    const app = getFirebaseApp();
    if (app) {
      cachedAuth = getAuth(app);
    }
    return cachedAuth;
  } catch (error) {
    console.warn("Firebase Auth initialization warning:", error);
    return null;
  }
};

export const googleProvider = new GoogleAuthProvider();
