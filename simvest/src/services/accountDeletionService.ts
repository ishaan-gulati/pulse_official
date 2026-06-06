import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';

import { userService } from './userService';

const LOGIN_USERNAMES_COLLECTION = 'loginUsernames';

/**
 * Deletes all Firestore data for a user (required for account deletion).
 * Does NOT delete the Firebase Auth user - the client does that after this succeeds.
 * Caller must ensure the current user is the one being deleted (uid matches auth).
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  // 1. Delete user subcollections
  const subcollections = ['portfolio', 'tradingHistory', 'portfolioSnapshots', 'priceAlerts', 'blockedUsers'];
  for (const sub of subcollections) {
    const ref = collection(db, 'users', uid, sub);
    const snap = await getDocs(ref);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }

  // 2. Delete user's posts and their comments
  const postsRef = collection(db, 'posts');
  const userPostsQuery = query(
    postsRef,
    where('userId', '==', uid),
    firestoreLimit(500)
  );
  const userPostsSnap = await getDocs(userPostsQuery);
  for (const postDoc of userPostsSnap.docs) {
    const commentsRef = collection(db, 'posts', postDoc.id, 'comments');
    const commentsSnap = await getDocs(commentsRef);
    for (const commentDoc of commentsSnap.docs) {
      await deleteDoc(commentDoc.ref);
    }
    await deleteDoc(postDoc.ref);
  }

  // 3. Remove uid from likedBy/savedBy/repostedBy on all other posts (batch by querying posts that contain this user)
  const postsSnap = await getDocs(query(postsRef, orderBy('createdAt', 'desc'), firestoreLimit(3000)));
  const toUpdate: { ref: ReturnType<typeof doc>; data: { likedBy: string[]; savedBy: string[]; repostedBy: string[]; likes: number; saves: number; reposts: number } }[] = [];
  for (const postDoc of postsSnap.docs) {
    const data = postDoc.data();
    const likedBy = (data.likedBy || []).filter((id: string) => id !== uid);
    const savedBy = (data.savedBy || []).filter((id: string) => id !== uid);
    const repostedBy = (data.repostedBy || []).filter((id: string) => id !== uid);
    const hadLike = (data.likedBy || []).includes(uid);
    const hadSave = (data.savedBy || []).includes(uid);
    const hadRepost = (data.repostedBy || []).includes(uid);
    if (hadLike || hadSave || hadRepost) {
      toUpdate.push({
        ref: doc(db, 'posts', postDoc.id),
        data: {
          likedBy,
          savedBy,
          repostedBy,
          likes: Math.max(0, (data.likes || 0) - (hadLike ? 1 : 0)),
          saves: Math.max(0, (data.saves || 0) - (hadSave ? 1 : 0)),
          reposts: Math.max(0, (data.reposts || 0) - (hadRepost ? 1 : 0)),
        },
      });
    }
  }
  for (const { ref, data } of toUpdate) {
    await updateDoc(ref, data);
  }

  // 4. Remove public username lookup (canonical + legacy @doc ids)
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    const uname = userSnap.data()?.username;
    if (typeof uname === 'string' && uname.trim()) {
      const key = userService.normalizeLoginUsername(uname);
      const keysToDelete = key ? [key, `@${key}`] : [];
      for (const k of keysToDelete) {
        try {
          await deleteDoc(doc(db, LOGIN_USERNAMES_COLLECTION, k));
        } catch {
          // ignore if missing or rules mismatch
        }
      }
    }
  }

  // 5. Delete user profile document
  await deleteDoc(doc(db, 'users', uid));
}
