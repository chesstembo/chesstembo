// src/lib/firebaseClient.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  AuthError,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  DocumentSnapshot,
  DocumentData,
  increment,
} from "firebase/firestore";
import { getAnalytics, logEvent } from "firebase/analytics";

// Types
export interface UserData {
  createdAt: any;
  puzzlesSolvedCount: number;
  premium: boolean;
  lastSeen: any;
  email?: string;
  displayName?: string;
  photoURL?: string;
  openingProgress?: { [openingId: string]: OpeningProgress };
}

export interface PuzzleHistory {
  puzzleId: string;
  solved: boolean;
  theme: string;
  createdAt: any;
  timeSpent?: number;
}

export interface Puzzle {
  id: string;
  rating: number;
  theme?: string;
  fen: string;
  moves: string[];
}

export interface OpeningProgress {
  openingId: string;
  openingName: string;
  eco: string;
  lastPracticed: any;
  practiceCount: number;
  successRate: number;
  variationsMastered: number;
  totalVariations: number;
  completed: boolean;
  bestScore?: number;
  timeSpent: number;
}

export interface UserStats {
  totalPuzzlesCompleted: number;
  currentStreak: number;
  bestRating: number;
  successRate: number;
  lastPlayed: any;
  puzzlesToday: number;
  puzzlesThisWeek: number;
  puzzlesThisMonth: number;
  favoriteOpening?: string;
  joinDate?: any;
  puzzlesSolvedCount: number;
  premium: boolean;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// ✅ Initialize Firebase
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Initialize Analytics (client-side only)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Configure Google Provider
googleProvider.setCustomParameters({
  prompt: "select_account",
});

//
// ✅ NEW: Clear authentication storage function
//

/**
 * Clears all authentication-related data from storage
 */
export const clearAuthStorage = (): void => {
  if (typeof window !== 'undefined') {
    // Clear magic link authentication data
    const keysToRemove = [
      'emailForSignIn',
      'auth_email',
      'auth_pending', 
      'magic_link_sent',
      'auth_redirect',
      'magic_link_email',
    ];
    
    // Remove each key from localStorage
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Also clear sessionStorage for auth data
    sessionStorage.clear();
    
  }
};

//
// ✅ Authentication helpers
//

/**
 * Ensure user is authenticated and user document exists
 */
export async function ensureUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          await ensureUserDoc(user.uid, {
            email: user.email!,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
          resolve(user);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error("User not authenticated. Please sign in."));
      }
    });
  });
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(result.user.uid, {
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    });
    
    if (analytics) {
      logEvent(analytics, 'login', { method: 'google' });
    }
    
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

/**
 * Sign out user
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
    if (analytics) {
      logEvent(analytics, 'logout');
    }
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Auth state observer
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

//
// ✅ User management
//

/**
 * Ensure user document exists
 */
export async function ensureUserDoc(uid: string, userInfo?: Partial<UserData>): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    const userData: UserData = {
      createdAt: serverTimestamp(),
      puzzlesSolvedCount: 0,
      premium: false,
      lastSeen: serverTimestamp(),
      ...userInfo,
    };
    
    await setDoc(ref, userData);
    
    if (analytics) {
      logEvent(analytics, 'user_created');
    }
  } else {
    // Update last seen and any provided user info
    const updateData: Partial<UserData> = {
      lastSeen: serverTimestamp(),
      ...userInfo,
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof UserData] === undefined) {
        delete updateData[key as keyof UserData];
      }
    });
    
    if (Object.keys(updateData).length > 0) {
      await updateDoc(ref, updateData);
    }
  }
}

/**
 * Get user document
 */
export async function getUserDoc(uid: string): Promise<{
  ref: ReturnType<typeof doc>;
  snap: DocumentSnapshot<DocumentData>;
}> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return { ref, snap };
}

/**
 * Get user data
 */
export async function getUserData(uid: string): Promise<UserData | null> {
  try {
    const { snap } = await getUserDoc(uid);
    return snap.exists() ? (snap.data() as UserData) : null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
}

/**
 * Get user's total puzzles solved count
 */
export async function getUserPuzzlesSolvedCount(uid: string): Promise<number> {
  try {
    const userData = await getUserData(uid);
    return userData?.puzzlesSolvedCount || 0;
  } catch (error) {
    console.error("Error getting puzzles solved count:", error);
    return 0;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  uid: string, 
  updates: Partial<Pick<UserData, 'displayName' | 'photoURL'>>
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    ...updates,
    lastSeen: serverTimestamp(),
  });
}

//
// ✅ Puzzle management
//

/**
 * Save puzzle result
 */
export async function savePuzzleResult(
  uid: string,
  puzzle: Puzzle,
  solved: boolean,
  timeSpent?: number
): Promise<void> {
  try {
    // Save to puzzle history
    const historyRef = doc(db, "users", uid, "puzzleHistory", puzzle.id);
    const historyData: PuzzleHistory = {
      puzzleId: puzzle.id,
      solved,
      theme: puzzle.theme || "general",
      createdAt: serverTimestamp(),
      ...(timeSpent && { timeSpent }),
    };
    
    await setDoc(historyRef, historyData);

    // Update puzzles solved count if solved
    if (solved) {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        puzzlesSolvedCount: increment(1),
        lastSeen: serverTimestamp(),
      });
    }

    // Log analytics
    if (analytics) {
      logEvent(analytics, 'puzzle_completed', {
        puzzle_id: puzzle.id,
        solved,
        puzzle_rating: puzzle.rating,
        theme: puzzle.theme,
      });
    }

  } catch (error) {
    console.error("Error saving puzzle result:", error);
    throw error;
  }
}

/**
 * Get user's puzzle history
 */
export async function getUserPuzzleHistory(
  uid: string, 
  options: { limit?: number; theme?: string } = {}
): Promise<PuzzleHistory[]> {
  try {
    let q = query(
      collection(db, "users", uid, "puzzleHistory"),
      orderBy("createdAt", "desc")
    );

    if (options.theme) {
      q = query(q, where("theme", "==", options.theme));
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as PuzzleHistory);
  } catch (error) {
    console.error("Error getting puzzle history:", error);
    return [];
  }
}

/**
 * Check if puzzle was already attempted
 */
export async function getPuzzleAttempt(
  uid: string, 
  puzzleId: string
): Promise<PuzzleHistory | null> {
  try {
    const historyRef = doc(db, "users", uid, "puzzleHistory", puzzleId);
    const snap = await getDoc(historyRef);
    return snap.exists() ? (snap.data() as PuzzleHistory) : null;
  } catch (error) {
    console.error("Error getting puzzle attempt:", error);
    return null;
  }
}

//
// ✅ Opening Progress Management
//

/**
 * Save or update opening progress
 */
export async function saveOpeningProgress(
  uid: string,
  progress: OpeningProgress
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    
    // Use setDoc with merge to update the specific opening progress
    await updateDoc(userRef, {
      [`openingProgress.${progress.openingId}`]: progress,
      lastSeen: serverTimestamp(),
    });

    // Log analytics
    if (analytics) {
      logEvent(analytics, 'opening_progress_updated', {
        opening_id: progress.openingId,
        practice_count: progress.practiceCount,
        success_rate: progress.successRate,
        completed: progress.completed,
      });
    }

  } catch (error) {
    console.error("Error saving opening progress:", error);
    throw error;
  }
}

/**
 * Get user's opening progress
 */
export async function getOpeningProgress(
  uid: string
): Promise<{ [openingId: string]: OpeningProgress }> {
  try {
    const userData = await getUserData(uid);
    return userData?.openingProgress || {};
  } catch (error) {
    console.error("Error getting opening progress:", error);
    return {};
  }
}

/**
 * Get specific opening progress
 */
export async function getSpecificOpeningProgress(
  uid: string,
  openingId: string
): Promise<OpeningProgress | null> {
  try {
    const progress = await getOpeningProgress(uid);
    return progress[openingId] || null;
  } catch (error) {
    console.error("Error getting specific opening progress:", error);
    return null;
  }
}

/**
 * Update opening progress after practice session
 */
export async function updateOpeningProgressAfterPractice(
  uid: string,
  openingId: string,
  openingName: string,
  eco: string,
  totalVariations: number,
  sessionResults: {
    successRate: number;
    variationsMastered: number;
    timeSpent: number;
    completed: boolean;
  }
): Promise<void> {
  try {
    const existingProgress = await getSpecificOpeningProgress(uid, openingId);
    
    const newProgress: OpeningProgress = {
      openingId,
      openingName,
      eco,
      lastPracticed: serverTimestamp(),
      practiceCount: (existingProgress?.practiceCount || 0) + 1,
      successRate: Math.max(
        sessionResults.successRate,
        existingProgress?.successRate || 0
      ),
      variationsMastered: sessionResults.variationsMastered,
      totalVariations,
      completed: sessionResults.completed || (existingProgress?.completed || false),
      bestScore: Math.max(
        sessionResults.successRate,
        existingProgress?.bestScore || 0
      ),
      timeSpent: (existingProgress?.timeSpent || 0) + sessionResults.timeSpent,
    };

    await saveOpeningProgress(uid, newProgress);
    
    if (analytics) {
      logEvent(analytics, 'opening_practice_completed', {
        opening_id: openingId,
        success_rate: sessionResults.successRate,
        variations_mastered: sessionResults.variationsMastered,
        time_spent: sessionResults.timeSpent,
      });
    }

  } catch (error) {
    console.error("Error updating opening progress:", error);
    throw error;
  }
}

//
// ✅ Email link (OTP) authentication
//

/**
 * Send magic link for email authentication
 */
export async function sendMagicLink(email: string): Promise<void> {
  try {
    const actionCodeSettings = {
      url: `${window.location.origin}/auth/verify?email=${encodeURIComponent(email)}`,
      handleCodeInApp: true,
    };
    
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    
    if (analytics) {
      logEvent(analytics, 'magic_link_sent');
    }
  } catch (error) {
    console.error("Error sending magic link:", error);
    const authError = error as AuthError;
    
    // Provide more user-friendly error messages
    switch (authError.code) {
      case 'auth/invalid-email':
        throw new Error('Invalid email address');
      case 'auth/user-disabled':
        throw new Error('This account has been disabled');
      default:
        throw new Error('Failed to send login link. Please try again.');
    }
  }
}

/**
 * Confirm magic link authentication
 */
export async function confirmMagicLink(url: string): Promise<User> {
  try {
    const email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      throw new Error("Email not found in local storage. Please try the login process again.");
    }
    
    const result = await signInWithEmailLink(auth, email, url);
    window.localStorage.removeItem("emailForSignIn");
    
    await ensureUserDoc(result.user.uid, {
      email: result.user.email!,
    });
    
    if (analytics) {
      logEvent(analytics, 'login', { method: 'email_link' });
    }
    
    return result.user;
  } catch (error) {
    console.error("Error confirming magic link:", error);
    const authError = error as AuthError;
    
    switch (authError.code) {
      case 'auth/invalid-email':
        throw new Error('Invalid email address');
      case 'auth/expired-action-code':
        throw new Error('The login link has expired. Please request a new one.');
      case 'auth/invalid-action-code':
        throw new Error('Invalid login link. Please request a new one.');
      default:
        throw new Error('Failed to sign in. Please try again.');
    }
  }
}

//
// ✅ NEW: Email authentication helper functions
//

/**
 * Check if current URL is a magic link
 */
export function isMagicLink(): boolean {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('apiKey') || 
         urlParams.has('mode') && urlParams.get('mode') === 'signIn';
}

/**
 * Get stored email from localStorage
 */
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('emailForSignIn');
}

/**
 * Get authentication error message
 */
export function getAuthErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  const authError = error as AuthError;
  switch (authError.code) {
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists';
    case 'auth/weak-password':
      return 'Password is too weak';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    case 'auth/expired-action-code':
      return 'The login link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'Invalid login link. Please request a new one.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

//
// ✅ Analytics helpers
//

/**
 * Log custom analytics event
 */
export function logAnalyticsEvent(eventName: string, params?: Record<string, any>): void {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
}

/**
 * Log puzzle start event
 */
export function logPuzzleStart(puzzle: Puzzle): void {
  logAnalyticsEvent('puzzle_start', {
    puzzle_id: puzzle.id,
    rating: puzzle.rating,
    theme: puzzle.theme,
  });
}

/**
 * Log page view event
 */
export function logPageView(pageName: string): void {
  logAnalyticsEvent('page_view', { page: pageName });
}

//
// ✅ Utility functions
//

/**
 * Check if user has premium status
 */
export async function isUserPremium(uid: string): Promise<boolean> {
  const userData = await getUserData(uid);
  return userData?.premium ?? false;
}

/**
 * Get comprehensive user statistics
 */
export async function getUserStats(uid: string): Promise<UserStats> {
  try {
    const userData = await getUserData(uid);
    const puzzleHistory = await getUserPuzzleHistory(uid, { limit: 100 });
    const openingProgress = await getOpeningProgress(uid);
    
    // Calculate statistics from puzzle history
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const puzzlesToday = puzzleHistory.filter(history => {
      const historyDate = history.createdAt?.toDate ? history.createdAt.toDate() : new Date(history.createdAt);
      return historyDate >= today;
    }).length;
    
    const puzzlesThisWeek = puzzleHistory.filter(history => {
      const historyDate = history.createdAt?.toDate ? history.createdAt.toDate() : new Date(history.createdAt);
      return historyDate >= weekAgo;
    }).length;
    
    const puzzlesThisMonth = puzzleHistory.filter(history => {
      const historyDate = history.createdAt?.toDate ? history.createdAt.toDate() : new Date(history.createdAt);
      return historyDate >= monthAgo;
    }).length;
    
    // Calculate success rate
    const solvedPuzzles = puzzleHistory.filter(history => history.solved);
    const successRate = puzzleHistory.length > 0 
      ? (solvedPuzzles.length / puzzleHistory.length) * 100 
      : 0;
    
    // Find favorite opening (most practiced)
    const openingPracticeCounts: { [key: string]: number } = {};
    Object.values(openingProgress).forEach(progress => {
      openingPracticeCounts[progress.openingName] = (openingPracticeCounts[progress.openingName] || 0) + progress.practiceCount;
    });
    
    const favoriteOpening = Object.keys(openingPracticeCounts).length > 0
      ? Object.keys(openingPracticeCounts).reduce((a, b) => 
          openingPracticeCounts[a] > openingPracticeCounts[b] ? a : b
        )
      : undefined;
    
    // Calculate current streak (consecutive days with puzzle activity)
    let currentStreak = 0;
    const sortedHistory = [...puzzleHistory].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (sortedHistory.length > 0) {
      let currentDate = new Date();
      let streakBroken = false;
      
      for (let i = 0; i < 30; i++) { // Check up to 30 days back
        const checkDate = new Date(currentDate);
        const hasActivity = sortedHistory.some(history => {
          const historyDate = history.createdAt?.toDate ? history.createdAt.toDate() : new Date(history.createdAt);
          return historyDate.toDateString() === checkDate.toDateString();
        });
        
        if (hasActivity && !streakBroken) {
          currentStreak++;
        } else if (i > 0) { // Don't break streak on first day if no activity
          streakBroken = true;
        }
        
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    return {
      totalPuzzlesCompleted: userData?.puzzlesSolvedCount || 0,
      puzzlesSolvedCount: userData?.puzzlesSolvedCount || 0,
      premium: userData?.premium || false,
      currentStreak,
      bestRating: Math.max(...puzzleHistory.map(h => h.solved ? 1 : 0), 0), // Simplified - you might want to track actual ratings
      successRate,
      lastPlayed: puzzleHistory.length > 0 ? puzzleHistory[0].createdAt : null,
      puzzlesToday,
      puzzlesThisWeek,
      puzzlesThisMonth,
      favoriteOpening,
      joinDate: userData?.createdAt,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    // Return default stats
    return {
      totalPuzzlesCompleted: 0,
      puzzlesSolvedCount: 0,
      premium: false,
      currentStreak: 0,
      bestRating: 0,
      successRate: 0,
      lastPlayed: null,
      puzzlesToday: 0,
      puzzlesThisWeek: 0,
      puzzlesThisMonth: 0,
    };
  }
}

// Default export
export default {
  app,
  auth,
  db,
  analytics,
  
  // Auth
  ensureUser,
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  clearAuthStorage,
  
  // User management
  ensureUserDoc,
  getUserData,
  getUserPuzzlesSolvedCount,
  updateUserProfile,
  isUserPremium,
  getUserStats,
  
  // Puzzle management
  savePuzzleResult,
  getUserPuzzleHistory,
  getPuzzleAttempt,
  
  // Opening progress management
  saveOpeningProgress,
  getOpeningProgress,
  getSpecificOpeningProgress,
  updateOpeningProgressAfterPractice,
  
  // Email auth
  sendMagicLink,
  confirmMagicLink,
  isMagicLink,
  getStoredEmail,
  getAuthErrorMessage,
  
  // Analytics
  logAnalyticsEvent,
  logPuzzleStart,
  logPageView,
};