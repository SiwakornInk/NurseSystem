import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      getAnalytics(app);
    }
  });
}

export const WARDS = [
  { id: 'medicine', name: 'อายุรกรรม' },
  { id: 'surgery', name: 'ศัลยกรรม' },
  { id: 'pediatrics', name: 'กุมารเวชกรรม' },
  { id: 'emergency', name: 'ฉุกเฉิน' }
];

export const SHIFT_TYPES = {
  MORNING: { id: 1, code: 'M', nameTH: 'เช้า', nameEN: 'Morning', color: '#FFD700' },
  AFTERNOON: { id: 2, code: 'A', nameTH: 'บ่าย', nameEN: 'Afternoon', color: '#87CEEB' },
  NIGHT: { id: 3, code: 'N', nameTH: 'ดึก', nameEN: 'Night', color: '#4B0082' },
  OFF: { id: 0, code: 'OFF', nameTH: 'หยุด', nameEN: 'Off', color: '#D3D3D3' }
};

export const SHIFT_CODES = {
  M_REQUEST: 1,
  A_REQUEST: 2,
  N_REQUEST: 3,
  NA_DOUBLE_REQUEST: 4
};

export default app;