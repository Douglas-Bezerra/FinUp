// src/services/firebase.ts
// Arquivo de configuração do Firebase Firestore
//================================================

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Cole aqui o seu firebaseConfig baixado do console
//const firebaseConfig = {
//  apiKey: "SUA_API_KEY_AQUI",
//  authDomain: "SEU_AUTH_DOMAIN",
//  projectId: "SEU_PROJECT_ID",
//  storageBucket: "SEU_STORAGE_BUCKET",
//  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
//  appId: "SEU_APP_ID"
//};

const firebaseConfig = {
  apiKey: "AIzaSyC2SzXbmgSWJuNQUAELzz4YxisJpK951Os",
  authDomain: "finup-app6.firebaseapp.com",
  projectId: "finup-app6",
  storageBucket: "finup-app6.firebasestorage.app",
  messagingSenderId: "79049016759",
  appId: "1:79049016759:web:5bfd45aba925152ef91432"
};


// Inicializa a aplicação
const app = initializeApp(firebaseConfig);

// Inicializa e exporta a instância do Firestore
export const db = getFirestore(app);
