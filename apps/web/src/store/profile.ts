import { create } from 'zustand';
import type { Profile } from '@es/shared';
import { fetchMe, login as apiLogin, register as apiRegister } from '../net/api';
import { getGuestId, getToken, setSession } from '../net/player';

interface ProfileStore {
  profile: (Profile & { quota?: { turnsLeftToday: number } }) | null;
  loggedIn: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

export const useProfile = create<ProfileStore>((set) => ({
  profile: null,
  loggedIn: !!getToken(),
  async refresh() {
    try {
      set({ profile: await fetchMe() });
    } catch {
      /* API down: HUD stays empty */
    }
  },
  async login(email, password) {
    const r = await apiLogin(email, password);
    setSession(r.token, r.profile.id);
    set({ profile: r.profile, loggedIn: true });
  },
  async register(email, password, name) {
    const r = await apiRegister(email, password, name, getGuestId());
    setSession(r.token, r.profile.id);
    set({ profile: r.profile, loggedIn: true });
  },
  logout() {
    setSession(null, null);
    set({ profile: null, loggedIn: false });
  },
}));
