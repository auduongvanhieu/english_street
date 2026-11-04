import { create } from 'zustand';
import type { Profile } from '@es/shared';
import { fetchMe, login as apiLogin, register as apiRegister, saveLang, type CaptchaAnswer } from '../net/api';
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

export const useProfile = create<ProfileStore>((set) => ({
  profile: null,
  loggedIn: !!getToken(),
  async refresh() {
    try {
      const profile = await fetchMe();
      set({ profile });
      syncLang(profile);
    } catch {
      /* API down: HUD stays empty */
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
  logout() {
    setSession(null, null);
    set({ profile: null, loggedIn: false });
  },
}));
