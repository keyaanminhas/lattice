/**
 * AuthContext — Ready for Firebase Authentication integration.
 * 
 * When you add Firebase Auth (email/password, Google, etc.):
 * 1. Replace the mock login with signInWithEmailAndPassword / createUserWithEmailAndPassword
 * 2. onAuthStateChanged will auto-detect user sessions
 * 3. The Firestore profile lookup maps Firebase UID → platform role + entity
 * 
 * Usage in App.jsx:
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 */
import { createContext, useContext, useEffect, useState } from 'react';
// import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Looks up the user's platform profile in Firestore using their Firebase UID.
 * Checks: platformUsers → companies → contributors (by authUid field).
 * Returns { role, id, name, email, entityType, entityId } or null.
 */
export async function lookupUserProfile(firebaseUid, email) {
  // 1. Check platformUsers collection (admins, org admins, programme admins)
  const userDoc = await getDoc(doc(db, 'platformUsers', firebaseUid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    return {
      role: data.role, // 'admin', 'orgAdmin', 'programmeAdmin'
      id: firebaseUid,
      name: data.name,
      email: data.email,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
    };
  }

  // 2. Check companies collection (startup users)
  const companyQuery = await getDocs(query(collection(db, 'companies'), where('authUid', '==', firebaseUid)));
  if (!companyQuery.empty) {
    const compDoc = companyQuery.docs[0];
    return {
      role: 'company',
      id: compDoc.id,
      name: compDoc.data().name,
      email: email,
      entityType: 'company',
      entityId: compDoc.id,
    };
  }

  // 3. Check contributors collection
  const contribQuery = await getDocs(query(collection(db, 'contributors'), where('authUid', '==', firebaseUid)));
  if (!contribQuery.empty) {
    const contDoc = contribQuery.docs[0];
    return {
      role: 'contributor',
      id: contDoc.id,
      name: contDoc.data().name,
      email: email,
      entityType: 'contributor',
      entityId: contDoc.id,
    };
  }

  // 4. No profile found — new user, needs onboarding
  return null;
}

/**
 * AuthProvider — wraps the app and provides auth state.
 * 
 * Currently uses the mock login system.
 * To activate Firebase Auth, uncomment the onAuthStateChanged block.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false); // Set true when using real auth
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  /*
  // === UNCOMMENT THIS WHEN FIREBASE AUTH IS READY ===
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await lookupUserProfile(firebaseUser.uid, firebaseUser.email);
        if (profile) {
          setUser(profile);
          setNeedsOnboarding(false);
        } else {
          // New user — needs to complete onboarding
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName || '' });
          setNeedsOnboarding(true);
        }
      } else {
        setUser(null);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  */

  const login = async (mockUser) => {
    setUser(mockUser);
  };

  const logout = async () => {
    // const auth = getAuth(); await signOut(auth);
    setUser(null);
    setNeedsOnboarding(false);
  };

  const completeOnboarding = (profile) => {
    setUser(profile);
    setNeedsOnboarding(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsOnboarding, login, logout, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}
