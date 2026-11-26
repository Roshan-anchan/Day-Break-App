// ---------------------------------------------------------------------------
// Firebase setup for Daybreak.
//
// This gives you: Guest login, Google login, and Email/Password login, with
// your habit data synced to the cloud so it's the same everywhere you log in
// (Google/Email accounts only — Guest mode is local to that one browser,
// since there's no email/password tying it to you on another device).
//
// SETUP (free, ~5 minutes):
// 1. Go to https://console.firebase.google.com -> "Add project" (name it
//    anything, e.g. "daybreak"). Google Analytics is optional, you can skip it.
// 2. In your new project: Build -> Authentication -> "Get started".
//    Enable these sign-in providers:
//      - Google        (just toggle it on, pick a support email)
//      - Email/Password (just toggle it on)
//      - Anonymous     (just toggle it on) — this powers Guest mode
// 3. Build -> Firestore Database -> "Create database" -> start in
//    "Production mode" -> pick any location -> Enable.
// 4. In Firestore, go to the "Rules" tab and replace the rules with:
//
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /users/{userId} {
//            allow read, write: if request.auth != null && request.auth.uid == userId;
//          }
//        }
//      }
//
//    then click "Publish". This makes sure people can only read/write their
//    own data.
// 5. Project settings (gear icon, top left) -> "Your apps" -> click the
//    </> (web) icon -> register the app (any nickname) -> you'll be shown a
//    firebaseConfig object. Copy those values into the object below.
// 6. Run `npm install firebase` in the project folder, then `npm run dev`.
// ---------------------------------------------------------------------------

import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBqyFOy_AoBGathYKpQjQ0efze3Oc9Upxw',
  authDomain: 'habittracker-fbe9d.firebaseapp.com',
  databaseURL: 'https://habittracker-fbe9d-default-rtdb.firebaseio.com',
  projectId: 'habittracker-fbe9d',
  storageBucket: 'habittracker-fbe9d.firebasestorage.app',
  messagingSenderId: '331652731835',
  appId: '1:331652731835:web:7cfe98edb38803bee16a9e',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup, signInAnonymously, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, onSnapshot,
};
