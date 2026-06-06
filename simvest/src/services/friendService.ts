import { db } from '../config/firebase';
import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { FriendRequest, FriendStatus } from '../types';

const FRIEND_REQUESTS_COLLECTION = 'friendRequests';
const FRIENDS_COLLECTION = 'friends';

export const friendService = {
  async sendRequest(fromUid: string, toUid: string, fromDisplayName?: string, fromUsername?: string, fromPhotoURL?: string): Promise<void> {
    // Check if a pending request already exists
    const existing = await getDocs(
      query(
        collection(db, FRIEND_REQUESTS_COLLECTION),
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      )
    );
    if (!existing.empty) return;

    await addDoc(collection(db, FRIEND_REQUESTS_COLLECTION), {
      fromUid,
      toUid,
      fromDisplayName: fromDisplayName ?? '',
      fromUsername: fromUsername ?? '',
      fromPhotoURL: fromPhotoURL ?? '',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  },

  async acceptRequest(requestId: string, myUid: string): Promise<void> {
    const reqRef = doc(db, FRIEND_REQUESTS_COLLECTION, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return;
    const data = snap.data() as FriendRequest;

    const batch = writeBatch(db);
    // Mark request accepted
    batch.update(reqRef, { status: 'accepted' });
    // Write bidirectional friend docs
    batch.set(doc(db, FRIENDS_COLLECTION, myUid, 'accepted', data.fromUid), {
      uid: data.fromUid,
      since: serverTimestamp(),
    });
    batch.set(doc(db, FRIENDS_COLLECTION, data.fromUid, 'accepted', myUid), {
      uid: myUid,
      since: serverTimestamp(),
    });
    await batch.commit();
  },

  async declineRequest(requestId: string): Promise<void> {
    await updateDoc(doc(db, FRIEND_REQUESTS_COLLECTION, requestId), {
      status: 'declined',
    });
  },

  async removeFriend(myUid: string, friendUid: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, FRIENDS_COLLECTION, myUid, 'accepted', friendUid));
    batch.delete(doc(db, FRIENDS_COLLECTION, friendUid, 'accepted', myUid));
    await batch.commit();
  },

  async getFriends(uid: string): Promise<string[]> {
    const snap = await getDocs(collection(db, FRIENDS_COLLECTION, uid, 'accepted'));
    return snap.docs.map((d) => d.id);
  },

  async getPendingRequests(uid: string): Promise<FriendRequest[]> {
    const snap = await getDocs(
      query(
        collection(db, FRIEND_REQUESTS_COLLECTION),
        where('toUid', '==', uid),
        where('status', '==', 'pending')
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) }));
  },

  async getPendingRequestCount(uid: string): Promise<number> {
    const requests = await friendService.getPendingRequests(uid);
    return requests.length;
  },

  /** Live listener for incoming pending friend request count (badge). */
  subscribeToPendingRequestCount(uid: string, callback: (count: number) => void): Unsubscribe {
    const q = query(
      collection(db, FRIEND_REQUESTS_COLLECTION),
      where('toUid', '==', uid),
      where('status', '==', 'pending')
    );
    return onSnapshot(
      q,
      (snap) => callback(snap.size),
      () => callback(0)
    );
  },

  async getFriendStatus(myUid: string, targetUid: string): Promise<FriendStatus> {
    // Check if already friends
    const friendDoc = await getDoc(doc(db, FRIENDS_COLLECTION, myUid, 'accepted', targetUid));
    if (friendDoc.exists()) return 'friends';

    // Check pending requests
    const sentSnap = await getDocs(
      query(
        collection(db, FRIEND_REQUESTS_COLLECTION),
        where('fromUid', '==', myUid),
        where('toUid', '==', targetUid),
        where('status', '==', 'pending')
      )
    );
    if (!sentSnap.empty) return 'pending_sent';

    const receivedSnap = await getDocs(
      query(
        collection(db, FRIEND_REQUESTS_COLLECTION),
        where('fromUid', '==', targetUid),
        where('toUid', '==', myUid),
        where('status', '==', 'pending')
      )
    );
    if (!receivedSnap.empty) return 'pending_received';

    return 'none';
  },
};
