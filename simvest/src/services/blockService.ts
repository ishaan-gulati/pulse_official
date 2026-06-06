import { db } from '../config/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * Block list stored at users/{uid}/blockedUsers/{blockedUid}.
 * Each doc can store blockedAt timestamp for display if needed.
 */

export const blockService = {
  async blockUser(blockerUid: string, blockedUid: string): Promise<void> {
    if (blockerUid === blockedUid) return;
    const ref = doc(db, 'users', blockerUid, 'blockedUsers', blockedUid);
    await setDoc(ref, { blockedAt: new Date().toISOString() });
  },

  async unblockUser(blockerUid: string, blockedUid: string): Promise<void> {
    const ref = doc(db, 'users', blockerUid, 'blockedUsers', blockedUid);
    await deleteDoc(ref);
  },

  async getBlockedUserIds(blockerUid: string): Promise<string[]> {
    const ref = collection(db, 'users', blockerUid, 'blockedUsers');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map((d) => d.id);
  },
};
