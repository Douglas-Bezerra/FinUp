// src/firebase.ts
// Configuração e Inicialização do Firebase
// =============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { connectorConfig } from './dataconnect-generated';

const firebaseConfig = {
  apiKey: "AIzaSyC2SzXbmgSWJuNQUAELzz4YxisJpK951Os",
  authDomain: "finup-app6.firebaseapp.com",
  projectId: "finup-app6",
  storageBucket: "finup-app6.firebasestorage.app",
  messagingSenderId: "79049016759",
  appId: "1:79049016759:web:5bfd45aba925152ef91432"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const dataConnect = getDataConnect(app, connectorConfig);

// Conecta sempre ao emulador local (127.0.0.1:9399) em modo de desenvolvimento
connectDataConnectEmulator(dataConnect, '127.0.0.1', 9399);

//if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
//  connectDataConnectEmulator(dataConnect, '127.0.0.1', 9399);
//}
