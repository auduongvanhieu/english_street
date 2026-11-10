import { create } from 'zustand';
import type { PayInfo, PayMethod, PayOrderView } from '@es/shared';
import { get, post } from '../net/api';
import { isNativeApp } from '../native/bridge';
import { useProfile } from './profile';

/**
 * Top-ups: the coin packs, the order being paid (watched until the money arrives) and past orders.
 * Hidden inside the iOS / Android app (store rules: digital goods there go through the store's own payments).
 */
interface PayStore {
  info: PayInfo | null;
  order: PayOrderView | null;
  busy: boolean;
  error: string;
  /** coins just credited (the success card) */
  done: PayOrderView | null;
  load: () => Promise<void>;
  start: (pack: string, method: PayMethod) => Promise<void>;
  open: (o: PayOrderView) => void;
  cancel: () => Promise<void>;
  back: () => void;
}

let poll = 0;
const stopPoll = () => {
  window.clearInterval(poll);
  poll = 0;
};

export const usePay = create<PayStore>((set, getS) => {
  const watch = (o: PayOrderView) => {
    stopPoll();
    if (o.status !== 'pending' && o.status !== 'expired') return;
    poll = window.setInterval(async () => {
      const cur = getS().order;
      if (!cur || cur.code !== o.code) return stopPoll();
      try {
        const next = await get<PayOrderView>(`/me/pay/orders/${o.code}`);
        if (getS().order?.code !== o.code) return;
        if (next.status === 'paid') {
          stopPoll();
          set({ order: null, done: next });
          void useProfile.getState().refresh();
          void getS().load();
        } else set({ order: next });
      } catch {
        /* try again next tick */
      }
    }, 4000);
  };
  return {
    info: null,
    order: null,
    busy: false,
    error: '',
    done: null,
    async load() {
      if (isNativeApp()) return set({ info: null });
      try {
        set({ info: await get<PayInfo>('/me/pay') });
      } catch {
        set({ info: null });
      }
    },
    async start(pack, method) {
      set({ busy: true, error: '' });
      try {
        const o = await post<PayOrderView>('/me/pay/orders', { pack, method });
        set({ order: o, done: null });
        watch(o);
      } catch (e) {
        set({ error: (e as Error).message });
      } finally {
        set({ busy: false });
      }
    },
    open(o) {
      set({ order: o, done: null, error: '' });
      watch(o);
    },
    async cancel() {
      const o = getS().order;
      stopPoll();
      set({ order: null });
      if (o) await post(`/me/pay/orders/${o.code}/cancel`, {}).catch(() => undefined);
      void getS().load();
    },
    back() {
      stopPoll();
      set({ order: null, done: null, error: '' });
      void getS().load();
    },
  };
});
