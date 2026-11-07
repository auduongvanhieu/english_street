import { create } from 'zustand';
import { MINIBAR, hotelRoomInfo, ordinal, type HotelBill, type HotelEvent, type HotelStay } from '@es/shared';
import { fetchHotel, hotelBill, hotelCheckin, hotelCheckout, hotelMinibar } from '../net/api';
import { onHotel, sendHotel } from '../net/client';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { teleportTo } from '../scene/LocalPlayer';
import { t } from '../i18n';
import { useProfile } from './profile';
import { useVoice } from './voice';
import { hotelFloorSpot, lobbyLiftSpot } from '../world/places/hotelFloors';

/**
 * Riverside Hotel guest floors: check in at the desk (first stay free), take the lift, open your room with the key
 * card, knock on other rooms (the guest inside lets you in), room service on the phone, the minibar, the TV, the
 * light, "Do not disturb", and check-out with a bill to check (sometimes one line is wrong).
 */
export type HotelPanel = 'reception' | 'lift' | 'phone' | 'minibar' | null;

export interface RoomService {
  id: string;
  en: string;
  reply: string;
  /** what the housekeeper brings (shown in the room) */
  brings?: 'towels' | 'water' | 'breakfast' | 'pillow';
  /** answered on the phone (no visit) */
  answer?: string;
}
export const ROOM_SERVICE: RoomService[] = [
  { id: 'towels', en: 'Could I have some extra towels, please?', reply: 'Of course. Someone will bring them up in a minute.', brings: 'towels' },
  { id: 'pillow', en: 'Could I have another pillow, please?', reply: 'Certainly. A pillow is on its way.', brings: 'pillow' },
  { id: 'water', en: 'Could you bring me a bottle of water?', reply: 'No problem. It will be with you shortly.', brings: 'water' },
  { id: 'breakfast', en: 'Can I have breakfast in my room, please?', reply: 'Yes, of course. Breakfast will be up in a few minutes.', brings: 'breakfast' },
  { id: 'wifi', en: "What's the Wi-Fi password?", reply: 'The password is RIVER2026. All capital letters.', answer: 'Wi-Fi: RIVER2026' },
  { id: 'checkout', en: 'What time is check-out?', reply: 'Check-out is at eleven o’clock in the morning.', answer: '🕚 11:00' },
  { id: 'taxi', en: 'Could you call me a taxi, please?', reply: "I'm sorry, we don't have taxis here. You can take the bus. The bus stop is in front of the hotel.", answer: '🚌' },
];

interface HotelStore {
  stay: HotelStay | null;
  room: number;
  price: number;
  suitePrice: number;
  free: boolean;
  loaded: boolean;
  panel: HotelPanel;
  error: string | null;
  /** knocks on the door of the room I am in */
  knocks: { from: string; name: string; room: number }[];
  /** short notice (door locked, nobody in, …) */
  notice: string | null;
  dnd: boolean;
  tv: boolean;
  light: boolean;
  /** room service on its way / delivered things in the room */
  coming: RoomService | null;
  delivered: RoomService['brings'][];
  bill: HotelBill | null;
  result: { correct: boolean; wrong: number; paid: number; xp: number } | null;
  load: () => Promise<void>;
  open: (p: HotelPanel) => void;
  checkin: (nights: number, suite?: boolean) => Promise<boolean>;
  takeMinibar: (id: string) => Promise<void>;
  loadBill: () => Promise<void>;
  checkout: (disputed: number) => Promise<void>;
  goFloor: (floor: number | 'lobby') => void;
  openDoor: (room: number) => void;
  leaveRoom: (room: number) => void;
  knock: (room: number) => void;
  answer: (to: string, open: boolean) => void;
  callService: (s: RoomService) => void;
  setNotice: (n: string | null) => void;
}

let noticeTimer: number | null = null;
const say = (text: string) => useVoice.getState().speakAs('hotel', text, 'en-US');

export const useHotel = create<HotelStore>((set, get) => ({
  stay: null,
  room: 0,
  price: 5,
  suitePrice: 15,
  free: true,
  loaded: false,
  panel: null,
  error: null,
  knocks: [],
  notice: null,
  dnd: false,
  tv: false,
  light: true,
  coming: null,
  delivered: [],
  bill: null,
  result: null,
  async load() {
    try {
      const r = await fetchHotel();
      set({ stay: r.stay, room: r.room, price: r.price, suitePrice: r.suitePrice ?? 15, free: r.free, loaded: true, error: null });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  open(panel) {
    set({ panel, error: null, result: panel === 'reception' ? null : get().result });
    if (panel === 'reception' && get().stay) void get().loadBill();
  },
  async checkin(nights, suite = false) {
    try {
      const r = await hotelCheckin(nights, suite);
      set({ stay: r.stay, free: false, error: null, delivered: [], dnd: false });
      track('hotel_checkin', { nights, room: r.stay.room, suite });
      void useProfile.getState().refresh();
      const info = hotelRoomInfo(r.stay.room);
      say(`Here is your key card. Your room is ${r.stay.room}, on the ${ordinal(info.floor)} floor. The lift is over there.`);
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
  async takeMinibar(id) {
    try {
      const r = await hotelMinibar(id);
      set({ stay: r.stay, error: null });
      const m = MINIBAR.find((x) => x.id === id);
      if (m) say(`You took ${m.en}.`);
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async loadBill() {
    try {
      const r = await hotelBill();
      set({ bill: r.bill, error: null });
    } catch (e) {
      set({ error: (e as Error).message, bill: null });
    }
  },
  async checkout(disputed) {
    try {
      const r = await hotelCheckout(disputed);
      set({ stay: null, bill: null, result: r, error: null, delivered: [], tv: false, dnd: false });
      track('hotel_checkout', { correct: r.correct });
      void useProfile.getState().refresh();
      say(r.correct ? 'Thank you for staying with us. Have a nice day!' : 'Thank you. Have a nice day!');
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  goFloor(floor) {
    set({ panel: null });
    if (floor === 'lobby') {
      const s = lobbyLiftSpot();
      teleportTo(s.x, s.z, s.rot);
      say('Ground floor.');
    } else {
      const s = hotelFloorSpot(floor);
      teleportTo(s.x, s.z, s.rot);
      say(`${ordinal(floor)} floor.`);
    }
  },
  openDoor(room) {
    const s = get().stay;
    if (!s || s.room !== room) return;
    const i = hotelRoomInfo(room).inside;
    teleportTo(i.x, i.z, i.rot);
  },
  leaveRoom(room) {
    const o = hotelRoomInfo(room).outside;
    teleportTo(o.x, o.z, o.rot);
  },
  knock(room) {
    sendHotel({ op: 'knock', room });
    get().setNotice(t('Knock knock… (room {room})', { room }));
    track('hotel_knock');
  },
  answer(to, open) {
    sendHotel({ op: 'answer', to, open });
    set((s) => ({ knocks: s.knocks.filter((k) => k.from !== to) }));
  },
  callService(svc) {
    set({ panel: null });
    say(svc.reply);
    track('hotel_room_service', { id: svc.id });
    if (svc.answer) {
      get().setNotice(`☎️ ${svc.answer}`);
      return;
    }
    set({ coming: svc });
    // the housekeeper knocks a little later and leaves the things in the room
    window.setTimeout(() => {
      if (get().coming?.id !== svc.id) return;
      say('Housekeeping! Here you are. Enjoy your stay!');
      haptic('light');
      set((s) => ({ coming: null, delivered: [...s.delivered.filter((d) => d !== svc.brings), svc.brings] }));
      get().setNotice(`🛎️ ${t('Housekeeping brought your order.')}`);
    }, 7000);
  },
  setNotice(notice) {
    set({ notice });
    if (noticeTimer) window.clearTimeout(noticeTimer);
    if (notice) noticeTimer = window.setTimeout(() => set({ notice: null }), 4500);
  },
}));

export function initHotel() {
  return onHotel((m: HotelEvent) => {
    const h = useHotel.getState();
    if (m.op === 'knock') {
      if (h.dnd) {
        sendHotel({ op: 'answer', to: m.from, open: false });
        return;
      }
      haptic('medium');
      useHotel.setState((s) => ({ knocks: [...s.knocks.filter((k) => k.from !== m.from), { from: m.from, name: m.name, room: m.room }] }));
    } else if (m.op === 'answer') {
      if (m.open) {
        const i = hotelRoomInfo(m.room).inside;
        teleportTo(i.x, i.z, i.rot);
        h.setNotice(t('{name} opened the door. Come in!', { name: m.name }));
      } else h.setNotice(t("Nobody opened the door. Maybe they don't want visitors."));
    } else if (m.op === 'empty') {
      h.setNotice(t('Nobody answers. Room {room} is empty.', { room: m.room }));
    }
  });
}
