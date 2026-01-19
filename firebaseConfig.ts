
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Key used to store config in browser's local storage
const STORAGE_KEY = 'ttp_firebase_config';

export const isFirebaseInitialized = () => !!app;

export const getFirebaseAuth = (): Auth => {
  if (!auth) {
    throw new Error("Firebase chưa được khởi tạo. Vui lòng nhập cấu hình.");
  }
  return auth;
};

export const getFirebaseDb = (): Firestore => {
  if (!db) {
    throw new Error("Firebase Database chưa được khởi tạo.");
  }
  return db;
};

/**
 * Tries to initialize Firebase from 3 sources in order:
 * 1. Environment Variables (Vite)
 * 2. Local Storage (User previously entered)
 * 3. Returns false if neither exists
 */
export const tryInitFirebase = (): boolean => {
  if (app) return true;

  // 1. Try Environment Variables
  // Fix: Safely access env, defaulting to empty object if undefined to prevent crash
  const viteEnv = (import.meta as any).env || {};

  const envConfig = {
    apiKey: viteEnv.VITE_FIREBASE_API_KEY,
    authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: viteEnv.VITE_FIREBASE_PROJECT_ID,
    storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: viteEnv.VITE_FIREBASE_APP_ID
  };

  if (envConfig.apiKey && envConfig.projectId) {
    try {
      app = initializeApp(envConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      return true;
    } catch (e) {
      console.error("Lỗi khởi tạo từ Env Vars:", e);
    }
  }

  // 2. Try Local Storage
  const storedConfig = localStorage.getItem(STORAGE_KEY);
  if (storedConfig) {
    try {
      const parsedConfig = JSON.parse(storedConfig);
      app = initializeApp(parsedConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      return true;
    } catch (e) {
      console.error("Lỗi khởi tạo từ LocalStorage:", e);
      localStorage.removeItem(STORAGE_KEY); // Clear bad config
    }
  }

  return false;
};

/**
 * Manually initialize with a provided config object (from UI)
 */
export const initFirebaseManual = (config: any) => {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    // Save to storage for next reload
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const resetFirebaseConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
};
