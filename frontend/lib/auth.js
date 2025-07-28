import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';
import { useEffect, useState, createContext, useContext } from 'react';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData({ id: user.uid, ...userDoc.data() });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    if (!email.endsWith('@gmail.com')) {
      throw new Error('กรุณาใช้อีเมล @gmail.com เท่านั้น');
    }
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ');
    }
    
    return userCredential.user;
  };

  const logout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const resetPassword = async (email) => {
    if (!email.endsWith('@gmail.com')) {
      throw new Error('กรุณาใช้อีเมล @gmail.com เท่านั้น');
    }
    await sendPasswordResetEmail(auth, email);
  };

  const value = {
    user,
    userData,
    login,
    logout,
    resetPassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (adminOnly && !userData?.isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [user, userData, loading, adminOnly, router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || (adminOnly && !userData?.isAdmin)) {
    return null;
  }

  return children;
}