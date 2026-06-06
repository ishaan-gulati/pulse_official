import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { PriceAlert } from '../types';
import { stockPriceService } from './stockPriceService';
import { notificationService } from './notificationService';

const alertsCollection = (uid: string) => collection(db, 'users', uid, 'priceAlerts');

function isUnreadExecuted(a: PriceAlert): boolean {
  return !!(a.executedAt && a.executedPrice != null && !a.seenAt);
}

export const priceAlertsService = {
  async getPriceAlerts(uid: string): Promise<PriceAlert[]> {
    const snap = await getDocs(alertsCollection(uid));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceAlert));
  },

  async addPriceAlert(
    uid: string,
    data: { symbol: string; targetPrice: number; condition: 'above' | 'below' }
  ): Promise<string> {
    const ref = collection(db, 'users', uid, 'priceAlerts');
    const docRef = await addDoc(ref, {
      ...data,
      symbol: data.symbol.toUpperCase(),
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async markAlertExecuted(uid: string, alertId: string, executedPrice: number): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'priceAlerts', alertId), {
      executedAt: serverTimestamp(),
      executedPrice,
    });
  },

  async markAlertSeen(uid: string, alertId: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'priceAlerts', alertId), {
      seenAt: serverTimestamp(),
    });
  },

  async deletePriceAlert(uid: string, alertId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'priceAlerts', alertId));
  },

  /** Count executed alerts the user has not acknowledged (bell badge). */
  async getUnreadExecutedAlertCount(uid: string): Promise<number> {
    const all = await this.getPriceAlerts(uid);
    return all.filter(isUnreadExecuted).length;
  },

  /**
   * Poll quotes vs active alerts; mark hits executed. Optionally shows local notification only if permission granted.
   * Returns whether any alert fired and current unread executed count.
   */
  async checkAndExecutePriceAlerts(uid: string): Promise<{ hit: boolean; unreadExecutedCount: number }> {
    let all = await this.getPriceAlerts(uid);
    const active = all.filter((a) => !a.executedAt);
    if (active.length === 0) {
      return { hit: false, unreadExecutedCount: all.filter(isUnreadExecuted).length };
    }

    const symbols = [...new Set(active.map((a) => a.symbol.toUpperCase()))];
    const quotes = await stockPriceService.getQuotes(symbols);
    let hit = false;
    const pushOk = (await notificationService.getPermissionStatus()) === 'granted';

    for (const alert of active) {
      const quote = quotes.get(alert.symbol.toUpperCase());
      if (!quote) continue;
      const crossed =
        alert.condition === 'above'
          ? quote.currentPrice >= alert.targetPrice
          : quote.currentPrice <= alert.targetPrice;
      if (crossed) {
        if (pushOk) {
          try {
            await notificationService.showPriceAlertNotification(
              alert.symbol,
              quote.currentPrice,
              alert.condition
            );
          } catch {
            // Simulator / missing config - in-app badge still works
          }
        }
        await this.markAlertExecuted(uid, alert.id, quote.currentPrice);
        hit = true;
      }
    }

    if (hit) {
      all = await this.getPriceAlerts(uid);
    }
    return { hit, unreadExecutedCount: all.filter(isUnreadExecuted).length };
  },
};
