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

// Updated Interface to match your Root Collection structure
export interface SavedGame {
  id: string;
  pgn: string;
  fen: string;
  createdAt: any; // Timestamp from your DB
  startedAt?: any;
  event?: string;
  site?: string;
  // In your DB, these are strings (UIDs), but we handle that in the hook
  white: string | { name: string; rating?: number }; 
  black: string | { name: string; rating?: number };
  result: string;
  timeControl?: string;
  termination?: string;
  status: string;
  moves?: string[];
  rated?: boolean;
  winner?: string;
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
let app: FirebaseApp;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let analytics: ReturnType<typeof getAnalytics> | null = null;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  analytics = getAnalytics(app);
} else {
  app = {} as FirebaseApp;
  auth = {} as ReturnType<typeof getAuth>;
  db = {} as ReturnType<typeof getFirestore>;
}

export { app, auth, db, analytics };

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

//
// ✅ Authentication helpers
//

export const clearAuthStorage = (): void => {
  if (typeof window !== 'undefined') {
    const keysToRemove = [
      'emailForSignIn',
      'auth_email',
      'auth_pending', 
      'magic_link_sent',
      'auth_redirect',
      'magic_link_email',
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    sessionStorage.clear();
  }
};

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

export async function getDetailedUserStats(uid: string): Promise<{
  basicStats: UserStats;
  openingProgress: { [key: string]: OpeningProgress };
  puzzleHistory: PuzzleHistory[];
  userData: UserData | null;
}> {
  try {
    const [basicStats, openingProgress, puzzleHistory, userData] = await Promise.all([
      getUserStats(uid),
      getOpeningProgress(uid),
      getUserPuzzleHistory(uid, { limit: 100 }),
      getUserData(uid)
    ]);

    return {
      basicStats,
      openingProgress,
      puzzleHistory,
      userData
    };
  } catch (error) {
    console.error('Error getting detailed user stats:', error);
    throw error;
  }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

//
// ✅ User management
//

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
    const updateData: Partial<UserData> = {
      lastSeen: serverTimestamp(),
      ...userInfo,
    };
    
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

export async function getUserDoc(uid: string): Promise<{
  ref: ReturnType<typeof doc>;
  snap: DocumentSnapshot<DocumentData>;
}> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return { ref, snap };
}

export async function getUserData(uid: string): Promise<UserData | null> {
  try {
    const { snap } = await getUserDoc(uid);
    return snap.exists() ? (snap.data() as UserData) : null;
  } catch (error) {
    console.error("Error getting user data:", error);
    return null;
  }
}

export async function getUserPuzzlesSolvedCount(uid: string): Promise<number> {
  try {
    const userData = await getUserData(uid);
    return userData?.puzzlesSolvedCount || 0;
  } catch (error) {
    console.error("Error getting puzzles solved count:", error);
    return 0;
  }
}

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

export async function savePuzzleResult(
  uid: string,
  puzzle: Puzzle,
  solved: boolean,
  timeSpent?: number
): Promise<void> {
  try {
    const historyRef = doc(db, "users", uid, "puzzleHistory", puzzle.id);
    const historyData: PuzzleHistory = {
      puzzleId: puzzle.id,
      solved,
      theme: puzzle.theme || "general",
      createdAt: serverTimestamp(),
      ...(timeSpent && { timeSpent }),
    };
    
    await setDoc(historyRef, historyData);

    if (solved) {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        puzzlesSolvedCount: increment(1),
        lastSeen: serverTimestamp(),
      });
    }

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

export async function saveOpeningProgress(
  uid: string,
  progress: OpeningProgress
): Promise<void> {
  try {
    const userRef = doc(db, "users", uid);
    
    await updateDoc(userRef, {
      [`openingProgress.${progress.openingId}`]: progress,
      lastSeen: serverTimestamp(),
    });

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

export async function sendMagicLink(email: string): Promise<void> {
  try {
    const actionCodeSettings = {
      url: `${window.location.origin}/login?email=${encodeURIComponent(email)}`,
      handleCodeInApp: true,
    };
    
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    
    if (typeof window !== 'undefined') {
      window.localStorage.setItem("emailForSignIn", email);
    }
    
    if (analytics) {
      logEvent(analytics, 'magic_link_sent');
    }
  } catch (error) {
    console.error("Error sending magic link:", error);
    const authError = error as AuthError;
    
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

export async function confirmMagicLink(email: string, url: string): Promise<User> {
  try {
    const result = await signInWithEmailLink(auth, email, url);
    
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem("emailForSignIn");
    }
    
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

export function isMagicLink(): boolean {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('apiKey') || 
         (urlParams.has('mode') && urlParams.get('mode') === 'signIn') ||
         window.location.href.includes('__/auth/action');
}

export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('emailForSignIn');
}

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
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Please use Google sign-in.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

//
// ✅ Analytics helpers
//

export function logAnalyticsEvent(eventName: string, params?: Record<string, any>): void {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
}

export function logPuzzleStart(puzzle: Puzzle): void {
  logAnalyticsEvent('puzzle_start', {
    puzzle_id: puzzle.id,
    rating: puzzle.rating,
    theme: puzzle.theme,
  });
}

export function logPageView(pageName: string): void {
  logAnalyticsEvent('page_view', { page: pageName });
}

//
// ✅ Utility functions
//

export async function isUserPremium(uid: string): Promise<boolean> {
  const userData = await getUserData(uid);
  return userData?.premium ?? false;
}

export async function getUserStats(uid: string): Promise<UserStats> {
  try {
    const userData = await getUserData(uid);
    const puzzleHistory = await getUserPuzzleHistory(uid, { limit: 100 });
    const openingProgress = await getOpeningProgress(uid);
    
    // Calculate statistics
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
    
    // Find favorite opening
    const openingPracticeCounts: { [key: string]: number } = {};
    Object.values(openingProgress).forEach(progress => {
      openingPracticeCounts[progress.openingName] = (openingPracticeCounts[progress.openingName] || 0) + progress.practiceCount;
    });
    
    const favoriteOpening = Object.keys(openingPracticeCounts).length > 0
      ? Object.keys(openingPracticeCounts).reduce((a, b) => 
          openingPracticeCounts[a] > openingPracticeCounts[b] ? a : b
        )
      : undefined;
    
    // Calculate current streak
    let currentStreak = 0;
    const sortedHistory = [...puzzleHistory].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (sortedHistory.length > 0) {
      let currentDate = new Date();
      let streakBroken = false;
      
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(currentDate);
        const hasActivity = sortedHistory.some(history => {
          const historyDate = history.createdAt?.toDate ? history.createdAt.toDate() : new Date(history.createdAt);
          return historyDate.toDateString() === checkDate.toDateString();
        });
        
        if (hasActivity && !streakBroken) {
          currentStreak++;
        } else if (i > 0) {
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
      bestRating: Math.max(...puzzleHistory.map(h => h.solved ? 1 : 0), 0),
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

//
// ✅ Game Management (Updated for Root Collection)
//

/**
 * Save a played game (Not strictly needed if game engine saves it, but good for manual saves)
 */
export async function savePlayerGame(uid: string, game: SavedGame): Promise<void> {
  try {
    // If your game engine already saves to /games, this might be redundant
    // But if you want to manually update it, this points to the root collection
    const gameRef = doc(db, "games", game.id);
    
    const cleanGame = JSON.parse(JSON.stringify(game));

    await setDoc(gameRef, {
      ...cleanGame,
      createdAt: serverTimestamp(), 
    }, { merge: true }); // Merge to avoid overwriting existing fields

    if (analytics) {
      logEvent(analytics, 'game_saved', { game_id: game.id });
    }
  } catch (error) {
    console.error("Error saving player game to Firestore:", error);
    throw error;
  }
}

/**
 * Get all games played by the user from the root 'games' collection
 */
export async function getPlayerGames(uid: string, limitCount: number = 50): Promise<SavedGame[]> {
  try {
    const gamesRef = collection(db, "games");
    
    // Firestore cannot do "OR" queries across fields (white == uid OR black == uid) easily.
    // We must do two queries and merge them.

    // 1. Query games where user is White
    const whiteQuery = query(
      gamesRef, 
      where("white", "==", uid),
      orderBy("createdAt", "desc"), 
      limit(limitCount)
    );

    // 2. Query games where user is Black
    const blackQuery = query(
      gamesRef, 
      where("black", "==", uid),
      orderBy("createdAt", "desc"), 
      limit(limitCount)
    );

    // Execute both queries
    const [whiteSnap, blackSnap] = await Promise.all([
      getDocs(whiteQuery),
      getDocs(blackQuery)
    ]);

    // Combine results
    const allDocs = [...whiteSnap.docs, ...blackSnap.docs];
    
    // Deduplicate based on ID (just in case) and Map data
    const uniqueGamesMap = new Map();
    
    allDocs.forEach(doc => {
      if (!uniqueGamesMap.has(doc.id)) {
        const data = doc.data();
        
        // Handle Date conversion safely
        let gameDate = new Date().toISOString().split('T')[0];
        if (data.createdAt?.toDate) {
          gameDate = data.createdAt.toDate().toISOString().split('T')[0];
        } else if (data.startedAt?.toDate) {
          gameDate = data.startedAt.toDate().toISOString().split('T')[0];
        }

        uniqueGamesMap.set(doc.id, {
          ...data,
          id: doc.id,
          date: gameDate,
          // Ensure standard fields exist even if DB has variations
          white: data.white || "Unknown",
          black: data.black || "Unknown",
          pgn: data.pgn || "",
          result: data.result || "*"
        } as SavedGame);
      }
    });

    // Convert map to array and sort by date descending again (since we merged two lists)
    const sortedGames = Array.from(uniqueGamesMap.values()).sort((a, b) => {
      const dateA = new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.date || 0);
      const dateB = new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.date || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return sortedGames.slice(0, limitCount);

  } catch (error) {
    console.error("Error fetching player games:", error);
    return [];
  }
}
// src/lib/firebaseClient.ts

// ... (after getPlayerGames)

/**
 * Get a single game by its ID from the root 'games' collection.
 */
export async function getSingleGameById(gameId: string): Promise<SavedGame | null> {
  try {
    const gameRef = doc(db, "games", gameId);
    const docSnap = await getDoc(gameRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      let gameDate = new Date().toISOString().split('T')[0];
      if (data.createdAt?.toDate) {
        gameDate = data.createdAt.toDate().toISOString().split('T')[0];
      } else if (data.startedAt?.toDate) {
        gameDate = data.startedAt.toDate().toISOString().split('T')[0];
      }

      return {
        ...data,
        id: docSnap.id,
        date: gameDate,
        white: data.white || "Unknown",
        black: data.black || "Unknown",
        pgn: data.pgn || "",
        result: data.result || "*"
      } as SavedGame;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching single game:", error);
    return null;
  }
}
