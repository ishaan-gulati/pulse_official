import { db } from '../config/firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import type { Follow } from '../types';

const FOLLOWS_COLLECTION = 'follows';

function followDocId(followerId: string, followedId: string): string {
  return `${followerId}_${followedId}`;
}

export const followService = {
  async follow(myUid: string, targetUid: string): Promise<void> {
    const docId = followDocId(myUid, targetUid);
    const follow: Follow = {
      followerId: myUid,
      followedId: targetUid,
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, FOLLOWS_COLLECTION, docId), follow);
  },

  async unfollow(myUid: string, targetUid: string): Promise<void> {
    const docId = followDocId(myUid, targetUid);
    await deleteDoc(doc(db, FOLLOWS_COLLECTION, docId));
  },

  async isFollowing(myUid: string, targetUid: string): Promise<boolean> {
    const docId = followDocId(myUid, targetUid);
    const snap = await getDoc(doc(db, FOLLOWS_COLLECTION, docId));
    return snap.exists();
  },

  /** True if targetUid follows myUid */
  async isFollowedBy(myUid: string, targetUid: string): Promise<boolean> {
    const docId = followDocId(targetUid, myUid);
    const snap = await getDoc(doc(db, FOLLOWS_COLLECTION, docId));
    return snap.exists();
  },

  getFollowButtonLabel(isFollowing: boolean, followsYou: boolean): string {
    if (isFollowing) return 'Following';
    if (followsYou) return 'Follow Back';
    return 'Follow';
  },

  async getFollowing(uid: string): Promise<string[]> {
    const q = query(
      collection(db, FOLLOWS_COLLECTION),
      where('followerId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => (d.data() as Follow).followedId);
  },

  async getFollowers(uid: string): Promise<string[]> {
    const q = query(
      collection(db, FOLLOWS_COLLECTION),
      where('followedId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => (d.data() as Follow).followerId);
  },

  async getFollowingCount(uid: string): Promise<number> {
    const uids = await followService.getFollowing(uid);
    return uids.length;
  },

  async getFollowerCount(uid: string): Promise<number> {
    const uids = await followService.getFollowers(uid);
    return uids.length;
  },
};
