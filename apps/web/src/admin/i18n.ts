import { create } from 'zustand';

/** The admin site speaks Vietnamese or English (toggle in the sidebar). L('Tiếng Việt', 'English'). */
type Lang = 'vi' | 'en';
export const useAdminLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: (localStorage.getItem('es:adminLang') as Lang) || 'vi',
  setLang(lang) {
    localStorage.setItem('es:adminLang', lang);
    set({ lang });
  },
}));
export function useL() {
  const lang = useAdminLang((s) => s.lang);
  return (vi: string, en: string) => (lang === 'vi' ? vi : en);
}
export const L = (vi: string, en: string) => (useAdminLang.getState().lang === 'vi' ? vi : en);

export const fmtDate = (d: string | Date | null | undefined, withTime = true) => {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleString(useAdminLang.getState().lang === 'vi' ? 'vi-VN' : 'en-GB', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
};
export const fmtNum = (n: number | null | undefined, digits = 0) => (n == null ? '—' : n.toLocaleString(useAdminLang.getState().lang === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits: digits }));
export const ago = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const vi = useAdminLang.getState().lang === 'vi';
  if (s < 60) return vi ? 'vừa xong' : 'just now';
  if (s < 3600) return vi ? `${Math.floor(s / 60)} phút trước` : `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return vi ? `${Math.floor(s / 3600)} giờ trước` : `${Math.floor(s / 3600)} h ago`;
  return vi ? `${Math.floor(s / 86400)} ngày trước` : `${Math.floor(s / 86400)} d ago`;
};
