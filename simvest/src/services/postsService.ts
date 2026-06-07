import { db, auth } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
  increment,
  onSnapshot,
  Unsubscribe,
  runTransaction,
} from 'firebase/firestore';
import { FeedPost } from '../types';
import { userService, UserProfile } from './userService';
import { getPrimaryStockSymbol, extractStockSymbols } from '../utils/stockParser';
import { tradingService } from './tradingService';

// Firestore Post type (what we store in DB)
export interface FirestorePost {
  id: string;
  userId: string;
  title: string;
  body?: string;
  topic?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  likedBy: string[]; // Array of user IDs who liked
  savedBy: string[]; // Array of user IDs who saved
  repostedBy: string[]; // Array of user IDs who reposted
  stockSymbol?: string; // Primary stock symbol mentioned in post (deprecated, use stockSymbols)
  stockPriceAtCreation?: number; // Price of primary stock when post was created (deprecated, use stockPricesAtCreation)
  stockSymbols?: string[]; // All stock symbols mentioned in post
  stockPricesAtCreation?: Record<string, number>; // Prices of all stocks when post was created (symbol -> price)
}

export interface PostComment {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: number; // milliseconds
}

/** Build a feed row from Firestore + author profile (sync). Use `currentUserId` to set isLiked/isSaved without extra reads. */
function buildFeedPost(
  firestorePost: FirestorePost,
  userProfile: UserProfile,
  currentUserId?: string
): FeedPost {
  const createdAtMillis = firestorePost.createdAt?.toMillis?.() || Date.now();
  const likedBy = firestorePost.likedBy || [];
  const savedBy = firestorePost.savedBy || [];
  const post: FeedPost = {
    id: firestorePost.id,
    userId: firestorePost.userId,
    user: {
      name: userProfile.displayName,
      handle: userProfile.username,
      avatar: userProfile.photoURL,
      tags: userProfile.tags || [],
    },
    topic: firestorePost.topic,
    title: firestorePost.title,
    body: firestorePost.body,
    minutesAgo: Math.floor((Date.now() - createdAtMillis) / 60000),
    createdAt: createdAtMillis,
    stockSymbol: firestorePost.stockSymbol,
    stockPriceAtCreation: firestorePost.stockPriceAtCreation,
    stockSymbols: firestorePost.stockSymbols || (firestorePost.stockSymbol ? [firestorePost.stockSymbol] : []),
    stockPricesAtCreation:
      firestorePost.stockPricesAtCreation ||
      (firestorePost.stockPriceAtCreation && firestorePost.stockSymbol
        ? { [firestorePost.stockSymbol]: firestorePost.stockPriceAtCreation }
        : {}),
    stats: {
      likes: firestorePost.likes,
      comments: firestorePost.comments,
      reposts: firestorePost.reposts,
      saves: firestorePost.saves,
    },
  };
  if (currentUserId) {
    post.isLiked = likedBy.includes(currentUserId);
    post.isSaved = savedBy.includes(currentUserId);
  }
  return post;
}

/** One profile fetch per post (legacy / single-doc callers). */
const convertToFeedPost = async (firestorePost: FirestorePost): Promise<FeedPost> => {
  const userProfile = await userService.getUserProfile(firestorePost.userId);
  if (!userProfile) {
    throw new Error(`User profile not found for post author ${firestorePost.userId}`);
  }
  return buildFeedPost(firestorePost, userProfile);
};

class PostsService {
  // Create a new post
  async createPost(
    userId: string,
    title: string,
    body?: string,
    topic?: string
  ): Promise<string> {
    try {
      // Detect all stock symbols in post
      const fullText = title + ' ' + (body || '');
      const allSymbols = extractStockSymbols(fullText);
      const primarySymbol = allSymbols.length > 0 ? allSymbols[0] : getPrimaryStockSymbol(fullText);
      
      // Fetch current prices for all stocks mentioned
      const stockPricesAtCreation: Record<string, number> = {};
      let stockPriceAtCreation: number | undefined;
      
      if (allSymbols.length > 0) {
        await Promise.all(
          allSymbols.map(async (symbol) => {
            try {
              const price = await tradingService.getCurrentPrice(symbol);
              if (price !== null) {
                stockPricesAtCreation[symbol] = price;
                // Also set primary symbol price for backward compatibility
                if (symbol === primarySymbol) {
                  stockPriceAtCreation = price;
                }
              }
            } catch (error) {
              console.error(`Error fetching price for ${symbol}:`, error);
              // Continue without price - post will still be created
            }
          })
        );
      }

      const postsRef = collection(db, 'posts');
      const postData: any = {
        userId,
        title: title.trim(),
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        likes: 0,
        comments: 0,
        reposts: 0,
        repostedBy: [],
        saves: 0,
        likedBy: [],
        savedBy: [],
      };

      // Only add optional fields if they have values (Firestore doesn't allow undefined)
      if (body?.trim()) {
        postData.body = body.trim();
      }
      if (topic?.trim()) {
        postData.topic = topic.trim();
      }
      if (primarySymbol) {
        postData.stockSymbol = primarySymbol; // Keep for backward compatibility
      }
      if (stockPriceAtCreation !== undefined) {
        postData.stockPriceAtCreation = stockPriceAtCreation; // Keep for backward compatibility
      }
      if (allSymbols.length > 0) {
        postData.stockSymbols = allSymbols;
      }
      if (Object.keys(stockPricesAtCreation).length > 0) {
        postData.stockPricesAtCreation = stockPricesAtCreation;
      }

      const docRef = await addDoc(postsRef, postData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Get all posts (for "For You" feed). Profiles are loaded in parallel and deduped by author uid.
  async getPosts(limitCount: number = 50, currentUserId?: string): Promise<FeedPost[]> {
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );

      const snapshot = await getDocs(q);
      const raw: FirestorePost[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Omit<FirestorePost, 'id'>;
        if (!data.createdAt) {
          console.warn(`Post ${docSnap.id} has no createdAt, skipping`);
          continue;
        }
        raw.push({ id: docSnap.id, ...data } as FirestorePost);
      }

      const uniqueAuthorIds = [...new Set(raw.map((p) => p.userId).filter(Boolean))];
      const profiles = await Promise.all(
        uniqueAuthorIds.map((uid) => userService.getUserProfile(uid))
      );
      const profileByUid = new Map<string, UserProfile>();
      uniqueAuthorIds.forEach((uid, i) => {
        const prof = profiles[i];
        if (prof) profileByUid.set(uid, prof);
      });

      const posts: FeedPost[] = [];
      for (const fp of raw) {
        const prof = profileByUid.get(fp.userId);
        if (!prof) {
          console.warn(`Skipping post ${fp.id}: no profile for author ${fp.userId}`);
          continue;
        }
        try {
          posts.push(buildFeedPost(fp, prof, currentUserId));
        } catch (error) {
          console.error(`Error building post ${fp.id}:`, error);
        }
      }

      return posts;
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  // Get posts from users you follow (for "Following" feed)
  async getFollowingPosts(userId: string, limitCount: number = 50): Promise<FeedPost[]> {
    try {
      const { followService } = await import('./followService');
      const followingUids = await followService.getFollowing(userId);
      if (followingUids.length === 0) return [];

      // Firestore 'in' queries support up to 30 values; chunk if needed
      const chunks: string[][] = [];
      for (let i = 0; i < followingUids.length; i += 30) {
        chunks.push(followingUids.slice(i, i + 30));
      }

      const rawByChunk = await Promise.all(
        chunks.map(async (chunk) => {
          const q = query(
            collection(db, 'posts'),
            where('userId', 'in', chunk),
            orderBy('createdAt', 'desc'),
            firestoreLimit(limitCount)
          );
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestorePost, 'id'>) } as FirestorePost));
        })
      );

      const raw = rawByChunk.flat().filter((p) => !!p.createdAt);
      raw.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      const sliced = raw.slice(0, limitCount);

      const uniqueAuthorIds = [...new Set(sliced.map((p) => p.userId).filter(Boolean))];
      const profiles = await Promise.all(uniqueAuthorIds.map((uid) => userService.getUserProfile(uid)));
      const profileByUid = new Map<string, UserProfile>();
      uniqueAuthorIds.forEach((uid, i) => {
        const prof = profiles[i];
        if (prof) profileByUid.set(uid, prof);
      });

      const posts: FeedPost[] = [];
      for (const fp of sliced) {
        const prof = profileByUid.get(fp.userId);
        if (!prof) continue;
        try {
          posts.push(buildFeedPost(fp, prof, userId));
        } catch {
          // skip malformed posts
        }
      }
      return posts;
    } catch (error) {
      console.error('Error fetching following posts:', error);
      throw error;
    }
  }

  // Like a post
  async likePost(postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        throw new Error('Post not found');
      }

      const data = postSnap.data() as FirestorePost;
      const isLiked = data.likedBy.includes(userId);

      if (isLiked) {
        // Unlike: remove user from likedBy and decrement likes
        await updateDoc(postRef, {
          likedBy: data.likedBy.filter((id) => id !== userId),
          likes: increment(-1),
        });
      } else {
        // Like: add user to likedBy and increment likes
        await updateDoc(postRef, {
          likedBy: [...data.likedBy, userId],
          likes: increment(1),
        });
      }
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Save a post
  async savePost(postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        throw new Error('Post not found');
      }

      const data = postSnap.data() as FirestorePost;
      const isSaved = data.savedBy.includes(userId);

      if (isSaved) {
        // Unsave: remove user from savedBy and decrement saves
        await updateDoc(postRef, {
          savedBy: data.savedBy.filter((id) => id !== userId),
          saves: increment(-1),
        });
      } else {
        // Save: add user to savedBy and increment saves
        await updateDoc(postRef, {
          savedBy: [...data.savedBy, userId],
          saves: increment(1),
        });
      }
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  }

  // Repost a post (toggle on/off like like/unlike)
  async repost(postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        throw new Error('Post not found');
      }

      const data = postSnap.data() as FirestorePost;
      const isReposted = (data.repostedBy || []).includes(userId);

      if (isReposted) {
        // Unrepost: remove user from repostedBy and decrement reposts
        await updateDoc(postRef, {
          repostedBy: (data.repostedBy || []).filter((id) => id !== userId),
          reposts: increment(-1),
        });
      } else {
        // Repost: add user to repostedBy and increment reposts
        await updateDoc(postRef, {
          repostedBy: [...(data.repostedBy || []), userId],
          reposts: increment(1),
        });
      }
    } catch (error) {
      console.error('Error reposting:', error);
      throw error;
    }
  }

  // Delete a post (owner only)
  async deletePost(postId: string, userId: string): Promise<void> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) {
      throw new Error('Post not found');
    }
    const data = postSnap.data() as FirestorePost;
    if (data.userId !== userId) {
      throw new Error('You can only delete your own posts');
    }
    await deleteDoc(postRef);
  }

  // Get users who liked a post
  async getPostLikers(postId: string): Promise<(UserProfile & { uid: string })[]> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return [];

      const likedBy = (postSnap.data() as FirestorePost).likedBy || [];
      if (likedBy.length === 0) return [];

      const profiles = await Promise.all(likedBy.map((uid) => userService.getUserProfile(uid)));
      return profiles
        .map((profile, i) => (profile ? { ...profile, uid: likedBy[i] } : null))
        .filter(Boolean) as (UserProfile & { uid: string })[];
    } catch (error) {
      console.error('Error fetching post likers:', error);
      return [];
    }
  }

  // Check if user liked a post
  async isPostLiked(postId: string, userId: string): Promise<boolean> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return false;
      }

      const data = postSnap.data() as FirestorePost;
      return data.likedBy.includes(userId);
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  // Check if user saved a post
  async isPostSaved(postId: string, userId: string): Promise<boolean> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return false;
      }

      const data = postSnap.data() as FirestorePost;
      return data.savedBy.includes(userId);
    } catch (error) {
      console.error('Error checking save status:', error);
      return false;
    }
  }

  // Check if user reposted a post
  async isPostReposted(postId: string, userId: string): Promise<boolean> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);

      if (!postSnap.exists()) {
        return false;
      }

      const data = postSnap.data() as FirestorePost;
      return (data.repostedBy || []).includes(userId);
    } catch (error) {
      console.error('Error checking repost status:', error);
      return false;
    }
  }

  // Get comments for a post (newest first)
  async getComments(postId: string, limitCount: number = 100): Promise<PostComment[]> {
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      const q = query(
        commentsRef,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limitCount)
      );
      const snapshot = await getDocs(q);
      const raw = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdAt = d.createdAt?.toMillis?.() ?? Date.now();
        return {
          id: docSnap.id,
          userId: d.userId ?? '',
          username: d.username ?? '',
          displayName: d.displayName ?? '',
          photoURL: d.photoURL ?? undefined,
          text: d.text ?? '',
          createdAt,
        } as PostComment;
      });

      const missingPhotoUids = [...new Set(
        raw.filter((c) => c.userId && !c.photoURL).map((c) => c.userId)
      )];
      const photoByUid = new Map<string, string | undefined>();
      await Promise.all(
        missingPhotoUids.map(async (uid) => {
          const profile = await userService.getUserProfile(uid);
          photoByUid.set(uid, profile?.photoURL);
        })
      );

      return raw.map((comment) => ({
        ...comment,
        photoURL: comment.photoURL || photoByUid.get(comment.userId),
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  // Add a comment to a post (transaction: explicit comment count so rules match reliably)
  async addComment(postId: string, userId: string, text: string): Promise<void> {
    if (!text?.trim()) throw new Error('Comment cannot be empty');
    const uid = auth.currentUser?.uid;
    if (!uid || uid !== userId) throw new Error('Not signed in');
    try {
      const profile = await userService.getUserProfile(userId);
      if (!profile) throw new Error('User profile not found');
      const postRef = doc(db, 'posts', postId);
      const commentsCol = collection(db, 'posts', postId, 'comments');
      const newCommentRef = doc(commentsCol);

      await runTransaction(db, async (tx) => {
        const postSnap = await tx.get(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');
        const oldCount = postSnap.data()?.comments;
        const prev = oldCount == null ? 0 : oldCount;
        tx.set(newCommentRef, {
          userId,
          username: profile.username ?? '',
          displayName: profile.displayName ?? '',
          photoURL: profile.photoURL ?? '',
          text: text.trim(),
          createdAt: serverTimestamp(),
        });
        tx.update(postRef, { comments: prev + 1 });
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  /** Comment author only (Firestore rules). Uses transaction + explicit count (not increment) for stable rules checks. */
  async deleteComment(postId: string, commentId: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);
    try {
      await runTransaction(db, async (tx) => {
        const [cSnap, pSnap] = await Promise.all([tx.get(commentRef), tx.get(postRef)]);
        if (!cSnap.exists()) throw new Error('Comment not found');
        if (!pSnap.exists()) throw new Error('Post not found');
        const authorId = cSnap.data()?.userId;
        if (authorId == null || String(authorId) !== String(uid)) {
          throw new Error('You can only delete your own comments');
        }
        const oldCount = pSnap.data()?.comments;
        const prev = oldCount == null ? 0 : oldCount;
        const next = Math.max(0, prev - 1);
        tx.delete(commentRef);
        tx.update(postRef, { comments: next });
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  // Submit a report for a post (App Store UGC compliance)
  async submitReport(postId: string, reporterId: string, reason?: string): Promise<void> {
    try {
      const profile = await userService.getUserProfile(reporterId);
      const reportsRef = collection(db, 'reports');
      await addDoc(reportsRef, {
        postId,
        reporterId,
        reporterHandle: profile?.username ?? '',
        reporterEmail: profile?.email ?? '',
        createdAt: serverTimestamp(),
        reason: reason ?? null,
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  }

  // Subscribe to real-time posts updates
  subscribeToPosts(
    limitCount: number,
    callback: (posts: FeedPost[]) => void,
    userId?: string
  ): Unsubscribe {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    return onSnapshot(
      q,
      async (snapshot) => {
        const raw: FirestorePost[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as Omit<FirestorePost, 'id'>;
          if (!data.createdAt) continue;
          raw.push({ id: docSnap.id, ...data } as FirestorePost);
        }

        const uniqueAuthorIds = [...new Set(raw.map((p) => p.userId).filter(Boolean))];
        const profiles = await Promise.all(
          uniqueAuthorIds.map((uid) => userService.getUserProfile(uid))
        );
        const profileByUid = new Map<string, UserProfile>();
        uniqueAuthorIds.forEach((uid, i) => {
          const prof = profiles[i];
          if (prof) profileByUid.set(uid, prof);
        });

        const posts: FeedPost[] = [];
        for (const fp of raw) {
          const prof = profileByUid.get(fp.userId);
          if (!prof) continue;
          try {
            posts.push(buildFeedPost(fp, prof, userId));
          } catch (error) {
            console.error('Error building post in subscription:', error);
          }
        }

        callback(posts);
      },
      (error) => {
        console.error('Error in posts subscription:', error);
      }
    );
  }
}

export const postsService = new PostsService();

