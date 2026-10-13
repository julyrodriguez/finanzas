import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { 
  getFirestore, 
  Firestore 
} from "firebase/firestore";

const getFirebaseConfig = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
});

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let firestoreQuotaExceeded = false;

/**
 * Comprueba si Firestore está deshabilitado debido a cuota agotada o migración a MongoDB.
 */
export const isFirestoreDisabled = (): boolean => {
  if (firestoreQuotaExceeded) return true;
  if (typeof window !== "undefined") {
    try {
      if (
        sessionStorage.getItem("finanzas_firestore_disabled") === "true" ||
        localStorage.getItem("finanzas_firestore_disabled") === "true"
      ) {
        firestoreQuotaExceeded = true;
        return true;
      }
    } catch {}
  }
  return false;
};

/**
 * Desactiva Firestore en caliente de forma inmediata y persistente.
 * Esto protege a los componentes de reintentos infructuosos que bloquean la navegación.
 */
export const markFirestoreDisabled = (reason?: any) => {
  if (!firestoreQuotaExceeded) {
    firestoreQuotaExceeded = true;
    console.warn(
      "🛡️ [Firestore Guard] Firestore desactivado (cuota excedida o servidor propio MongoDB en uso). La aplicación opera 100% sobre MongoDB y caché local.",
      reason?.message || reason
    );
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("finanzas_firestore_disabled", "true");
        localStorage.setItem("finanzas_firestore_disabled", "true");
      } catch {}
    }
  }
};

/**
 * Helper para procesar errores de Firestore de manera limpia sin colgar la UI.
 */
export const handleFirestoreError = (error: any): void => {
  if (!error) return;
  const msg = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  if (
    code.includes("resource-exhausted") ||
    code.includes("permission-denied") ||
    code.includes("unavailable") ||
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("exhausted")
  ) {
    markFirestoreDisabled(error);
  }
};

export const getFirebaseApp = (): FirebaseApp | null => {
  if (cachedApp) return cachedApp;
  try {
    if (getApps().length > 0) {
      cachedApp = getApp();
    } else {
      const config = getFirebaseConfig();
      if (config.apiKey) {
        cachedApp = initializeApp(config);
      }
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

export const getFirebaseDb = (): Firestore | null => {
  if (isFirestoreDisabled()) return null;
  if (cachedDb) return cachedDb;
  try {
    const app = getFirebaseApp();
    if (app) {
      // Usar getFirestore estándar sin persistencia en IndexedDB.
      // persistentLocalCache intenta sincronizaciones en segundo plano con Google Cloud
      // y cuando la cuota está agotada genera un bucle de excepciones que rompe el enrutador de Next.js.
      cachedDb = getFirestore(app);
    }
    return cachedDb;
  } catch (error) {
    console.warn("Firestore initialization warning:", error);
    handleFirestoreError(error);
    return null;
  }
};

export const googleProvider = new GoogleAuthProvider();

// ============================================================================
// ESCUDO GLOBAL CONTRA ERRORES DE CUOTA NO CAPTURADOS
// Previene que promesas rechazadas o errores asíncronos de Firestore cuelguen la app.
// ============================================================================
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const msg = String(reason?.message || reason || "").toLowerCase();
    const code = String(reason?.code || "").toLowerCase();
    if (
      code.includes("resource-exhausted") ||
      msg.includes("quota exceeded") ||
      msg.includes("quota") ||
      (msg.includes("firestore") && (msg.includes("exhausted") || msg.includes("quota")))
    ) {
      try {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      } catch {}
      markFirestoreDisabled(reason);
      console.warn("🛡️ [Firestore Guard] Interceptado error de cuota en unhandledrejection. La página continúa estable con MongoDB.");
    }
  });

  window.addEventListener("error", (event) => {
    const msg = String(event?.message || "").toLowerCase();
    const errorMsg = String(event?.error?.message || "").toLowerCase();
    const code = String(event?.error?.code || "").toLowerCase();
    if (
      code.includes("resource-exhausted") ||
      msg.includes("quota exceeded") ||
      errorMsg.includes("quota exceeded") ||
      msg.includes("quota") ||
      (msg.includes("firestore") && (msg.includes("exhausted") || msg.includes("quota")))
    ) {
      try {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      } catch {}
      markFirestoreDisabled(event.error);
      console.warn("🛡️ [Firestore Guard] Interceptado error global de cuota en window.onerror. Se evita el cuelgue de la página.");
    }
  });
}
