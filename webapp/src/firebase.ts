// src/firebase.ts
// Configuração e Inicialização do Firebase
// =============================================================================

import { initializeApp } from 'firebase/app';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { connectorConfig } from './dataconnect-generated';

const firebaseConfig = {
  apiKey: "AIzaSyFakeKeyForLocalDevelopment",
  authDomain: "finup-app6.firebaseapp.com",
  projectId: "finup-app6",
  storageBucket: "finup-app6.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:1234567890"
};

const app = initializeApp(firebaseConfig);

export const dataConnect = getDataConnect(app, connectorConfig);

// Conecta sempre ao emulador local (127.0.0.1:9399) em modo de desenvolvimento
connectDataConnectEmulator(dataConnect, '127.0.0.1', 9399);

//if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
//  connectDataConnectEmulator(dataConnect, '127.0.0.1', 9399);
//}
