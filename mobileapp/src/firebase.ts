import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2SzXbmgSWJuNQUAELzz4YxisJpK951Os",
  authDomain: "finup-app6.firebaseapp.com",
  projectId: "finup-app6",
  storageBucket: "finup-app6.firebasestorage.app",
  messagingSenderId: "79049016759",
  appId: "1:79049016759:web:5bfd45aba925152ef91432",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;