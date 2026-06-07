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
  onSnapshot,
  orderBy,
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Group, GroupMessage } from '../types';
import type { LeaderboardEntry } from './userService';
import { userService } from './userService';

const GROUPS_COLLECTION = 'groups';

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const groupService = {
  async createGroup(ownerUid: string, name: string): Promise<{ groupId: string; joinCode: string }> {
    const joinCode = generateJoinCode();
    const ref = await addDoc(collection(db, GROUPS_COLLECTION), {
      name,
      createdBy: ownerUid,
      joinCode,
      members: [ownerUid],
      createdAt: serverTimestamp(),
    });
    return { groupId: ref.id, joinCode };
  },

  async joinGroupByCode(uid: string, code: string): Promise<Group> {
    const snap = await getDocs(
      query(collection(db, GROUPS_COLLECTION), where('joinCode', '==', code.toUpperCase()))
    );
    if (snap.empty) throw new Error('Group not found. Check the code and try again.');
    const groupDoc = snap.docs[0];
    const group = { id: groupDoc.id, ...(groupDoc.data() as Omit<Group, 'id'>) };
    if (group.members.includes(uid)) return group;
    await updateDoc(doc(db, GROUPS_COLLECTION, groupDoc.id), {
      members: arrayUnion(uid),
    });
    return { ...group, members: [...group.members, uid] };
  },

  async getMyGroups(uid: string): Promise<Group[]> {
    const snap = await getDocs(
      query(collection(db, GROUPS_COLLECTION), where('members', 'array-contains', uid))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));
  },

  async getGroupMembers(groupId: string): Promise<{ uid: string; displayName: string; username: string; photoURL?: string }[]> {
    const snap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    if (!snap.exists()) return [];
    const group = snap.data() as Group;
    const results: { uid: string; displayName: string; username: string; photoURL?: string }[] = [];
    for (const uid of group.members) {
      const profile = await userService.getUserProfile(uid);
      if (profile) {
        results.push({
          uid,
          displayName: profile.displayName ?? '',
          username: profile.username ?? '',
          photoURL: profile.photoURL,
        });
      }
    }
    return results;
  },

  async getGroupLeaderboard(groupId: string, memberUids?: string[]): Promise<LeaderboardEntry[]> {
    let uids = memberUids;
    if (!uids) {
      const snap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
      if (!snap.exists()) return [];
      uids = (snap.data() as Group).members;
    }
    return userService.getLeaderboardForUsers(uids);
  },

  async inviteFriend(groupId: string, friendUid: string): Promise<void> {
    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
      members: arrayUnion(friendUid),
    });
  },

  async sendMessage(
    groupId: string,
    uid: string,
    text: string,
    displayName?: string,
    username?: string,
    photoURL?: string
  ): Promise<void> {
    await addDoc(collection(db, GROUPS_COLLECTION, groupId, 'messages'), {
      userId: uid,
      displayName: displayName ?? '',
      username: username ?? '',
      photoURL: photoURL ?? '',
      text,
      createdAt: serverTimestamp(),
    });
  },

  subscribeToMessages(groupId: string, callback: (messages: GroupMessage[]) => void): Unsubscribe {
    const q = query(
      collection(db, GROUPS_COLLECTION, groupId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const msgs: GroupMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GroupMessage, 'id'>),
        }));
        callback(msgs);
      },
      (error) => {
        const code = (error as { code?: string })?.code;
        // Expected when the user leaves or the group is deleted while this screen is open.
        if (code === 'permission-denied') return;
        console.error('Error in group messages subscription:', error);
      }
    );
  },

  async getGroup(groupId: string): Promise<Group | null> {
    const snap = await getDoc(doc(db, GROUPS_COLLECTION, groupId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Group, 'id'>) };
  },

  async leaveGroup(groupId: string, uid: string): Promise<void> {
    const group = await groupService.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (!group.members.includes(uid)) throw new Error('You are not in this group');

    const groupRef = doc(db, GROUPS_COLLECTION, groupId);

    if (group.createdBy === uid) {
      const others = group.members.filter((m) => m !== uid);
      if (others.length === 0) {
        await groupService.deleteGroup(groupId, uid);
        return;
      }
      await updateDoc(groupRef, {
        members: arrayRemove(uid),
        createdBy: others[0],
      });
      return;
    }

    await updateDoc(groupRef, { members: arrayRemove(uid) });
  },

  async removeMember(groupId: string, ownerUid: string, memberUid: string): Promise<void> {
    const group = await groupService.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (group.createdBy !== ownerUid) throw new Error('Only the group owner can remove members');
    if (memberUid === ownerUid) throw new Error('Use Leave Group to remove yourself');
    if (!group.members.includes(memberUid)) throw new Error('User is not in this group');

    await updateDoc(doc(db, GROUPS_COLLECTION, groupId), {
      members: arrayRemove(memberUid),
    });
  },

  async deleteGroup(groupId: string, ownerUid: string): Promise<void> {
    const group = await groupService.getGroup(groupId);
    if (!group) throw new Error('Group not found');
    if (group.createdBy !== ownerUid) throw new Error('Only the group owner can delete this group');

    const messagesRef = collection(db, GROUPS_COLLECTION, groupId, 'messages');
    while (true) {
      const snap = await getDocs(query(messagesRef, firestoreLimit(500)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
  },
};
