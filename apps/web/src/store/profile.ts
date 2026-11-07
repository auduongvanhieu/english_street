import { create } from 'zustand';
import type { Profile } from '@es/shared';
import { useGame } from './game';
import { changeName as apiChangeName, changePassword as apiChangePassword, fetchMe, login as apiLogin, register as apiRegister, resetPassword as apiResetPassword, saveLang, type CaptchaAnswer } from '../net/api';
import { isLang } from '@es/shared';
import { onLangChange, useLang } from '../i18n';
import { track } from '../net/analytics';
import { getGuestId, getToken, setSession } from '../net/player';

interface ProfileStore {
  profile: (Profile & { quota?: { turnsLeftToday: number } }) | null;
  loggedIn: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string, captcha: CaptchaAnswer) => Promise<void>;
  register: (email: string, password: string, name: string, captcha: CaptchaAnswer) => Promise<void>;
  /** New password from an e-mailed / admin reset link: signs in. */
  resetPassword: (token: string, password: string) => Promise<void>;
  /** Change the password (other devices are signed out; this one gets a fresh token). */
  changePassword: (current: string, password: string) => Promise<void>;
  /** New display name (guests too): saved, and the name tag in the street changes. */
  rename: (name: string) => Promise<string>;
  logout: () => void;
}

/** Profile ⇄ language: a fresh device adopts the profile's language; a choice made here is saved to the profile. */
function syncLang(p: Profile | null) {
  if (!p) return;
  const l = useLang.getState();
  if (isLang(p.nativeLang) && !l.chosen) l.setLang(p.nativeLang, { fromProfile: true });
  else if (l.chosen && p.nativeLang !== l.lang) void saveLang(l.lang).catch(() => undefined);
}
onLangChange((lang) => {
  track('lang_change', { lang });
  if (useProfile.getState().profile) void saveLang(lang).catch(() => undefined);
});

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  loggedIn: !!getToken(),
  async refresh() {
    try {
      const profile = await fetchMe();
      // The saved sign-in no longer works (expired, or signed out by a moderator): the API answered as a guest.
      if (getToken() && !profile.email) {
        setSession(null, null);
        set({ loggedIn: false });
      }
      set({ profile });
      syncLang(profile);
    } catch (e) {
      // a saved sign-in the API refuses: forget it so the sign-in form (with its security check) works again
      if (getToken() && /unauthorized|^401$/.test((e as Error).message)) {
        setSession(null, null);
        set({ loggedIn: false });
      }
      /* otherwise API down: HUD stays empty */
    }
  },
  async login(email, password, captcha) {
    const r = await apiLogin(email, password, captcha);
    setSession(r.token, r.profile.id);
    set({ profile: r.profile, loggedIn: true });
    syncLang(r.profile);
  },
  async register(email, password, name, captcha) {
    const r = await apiRegister(email, password, name, getGuestId(), captcha);
    setSession(r.token, r.profile.id);
    set({ profile: r.profile, loggedIn: true });
  },
  async resetPassword(token, password) {
    const r = await apiResetPassword(token, password);
    setSession(r.token, r.profile.id);
    set({ profile: r.profile, loggedIn: true });
    syncLang(r.profile);
  },
  async changePassword(current, password) {
    const r = await apiChangePassword(current, password);
    const id = get().profile?.id;
    if (id) setSession(r.token, id);
  },
  async rename(name) {
    const r = await apiChangeName(name);
    const p = get().profile;
    if (p) set({ profile: { ...p, name: r.name } });
    useGame.getState().setPlayerName(r.name);
    return r.name;
  },
  logout() {
    setSession(null, null);
    set({ profile: null, loggedIn: false });
  },
}));
