import { initializeApp } from "firebase/app";
// @ts-expect-error Firebase exposes this persistence helper at runtime for React Native.
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (firebaseConfig.projectId !== "finup-app6") {
  throw new Error("O aplicativo mobile precisa apontar para o projeto Firebase FinUp (finup-app6).");
}

const app = initializeApp(firebaseConfig);

// Inicializa a autenticação com persistência nativa
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
  const authHost = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || "10.0.2.2";
  const firestoreHost = process.env.EXPO_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST || "10.0.2.2";
  connectAuthEmulator(auth, `http://${authHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, 8080);
}

export default app;