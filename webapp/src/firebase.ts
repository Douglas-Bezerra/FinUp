// src/firebase.ts
// Configuração e Inicialização do Firebase
// =============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { connectorConfig } from './dataconnect-generated';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const dataConnect = getDataConnect(app, connectorConfig);

if (import.meta.env.VITE_USE_DATA_CONNECT_EMULATOR === 'true') {
  connectDataConnectEmulator(
    dataConnect,
    import.meta.env.VITE_DATA_CONNECT_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_DATA_CONNECT_EMULATOR_PORT || 9399),
  );
}
