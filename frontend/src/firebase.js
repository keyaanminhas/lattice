import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyDkpYdiPm9uwVGPnXTDqIjkyrFLj0GOgfI',
  authDomain: 'lattice-2026.firebaseapp.com',
  projectId: 'lattice-2026',
  storageBucket: 'lattice-2026.firebasestorage.app',
  messagingSenderId: '1012674731605',
  appId: '1:1012674731605:web:ffc54941a262b54a25fedc',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export { db, functions };
