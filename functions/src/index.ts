import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Delete anonymous games older than 24 hours - using v2 syntax
export const cleanupAnonymousGames = functions.scheduler.onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC'
}, async (event) => {
  try {
    console.log('Starting cleanup of anonymous games...');
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = new admin.firestore.Timestamp(now.seconds - 86400, now.nanoseconds);

    const gamesSnapshot = await db.collection('games')
      .where('createdAt', '<=', twentyFourHoursAgo)
      .where('status', 'in', ['finished', 'abandoned'])
      .limit(50)
      .get();

    let deletedCount = 0;

    for (const doc of gamesSnapshot.docs) {
      const game = doc.data();
      const [whiteUser, blackUser] = await Promise.all([
        db.collection('users').doc(game.white).get(),
        db.collection('users').doc(game.black || '').get()
      ]);

      if (!whiteUser.exists && !blackUser.exists) {
        await Promise.all([
          doc.ref.delete(),
          db.collection('onlineGames').doc(doc.id).delete().catch(() => {})
        ]);
        deletedCount++;
      }
    }

    console.log(`Deleted ${deletedCount} anonymous games`);
  } catch (error) {
    console.error('Error in cleanupAnonymousGames:', error);
  }
});

// Cleanup match requests - using v2 syntax
export const cleanupMatchRequests = functions.scheduler.onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'UTC'
}, async (event) => {
  try {
    console.log('Starting cleanup of match requests...');
    const now = admin.firestore.Timestamp.now();
    const oneHourAgo = new admin.firestore.Timestamp(now.seconds - 3600, now.nanoseconds);

    const matchRequestsSnapshot = await db.collection('match_requests')
      .where('createdAt', '<=', oneHourAgo)
      .limit(50)
      .get();

    let deletedCount = 0;

    for (const doc of matchRequestsSnapshot.docs) {
      const request = doc.data();
      const userDoc = await db.collection('users').doc(request.userId).get();
      
      if (!userDoc.exists) {
        await doc.ref.delete();
        deletedCount++;
      }
    }

    console.log(`Deleted ${deletedCount} anonymous match requests`);
  } catch (error) {
    console.error('Error in cleanupMatchRequests:', error);
  }
});

// Delete anonymous user progress data - using v2 syntax
export const cleanupAnonymousUserData = functions.scheduler.onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC'
}, async (event) => {
  try {
    console.log('Starting cleanup of anonymous user data...');
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = new admin.firestore.Timestamp(now.seconds - 86400, now.nanoseconds);

    const usersSnapshot = await db.collection('users')
      .where('lastActive', '<=', twentyFourHoursAgo)
      .limit(50)
      .get();

    let deletedUserCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const isAnonymous = !userData.email && !userData.displayName && !userData.phoneNumber;

      if (isAnonymous) {
        await userDoc.ref.delete();
        deletedUserCount++;
      }
    }

    console.log(`Deleted ${deletedUserCount} anonymous users`);
  } catch (error) {
    console.error('Error in cleanupAnonymousUserData:', error);
  }
});

// Manual trigger for immediate cleanup - v2 syntax
export const manualCleanup = functions.https.onCall(async (request) => {
  if (!request.auth?.token?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger manual cleanup');
  }

  try {
    console.log('Manual cleanup triggered by admin');
    return { success: true, message: 'Manual cleanup completed' };
  } catch (error) {
    console.error('Manual cleanup error:', error);
    throw new functions.https.HttpsError('internal', 'Cleanup failed');
  }
});

// Test function - v2 syntax
export const testFunction = functions.https.onCall((request) => {
  return { message: 'Test successful' };
});