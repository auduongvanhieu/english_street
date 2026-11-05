import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from './api';
import { useAdminLang, useL } from './i18n';
import { Login } from './Login';
import { ConfirmHost, Toasts } from './ui';
import { Overview } from './pages/Overview';
import { UsersPage } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { OnlinePage } from './pages/Online';
import { ReportsPage } from './pages/Reports';
import { ContentList } from './pages/ContentList';
import { DocEditor } from './pages/DocEditor';
import { AreaEditor } from './pages/AreaEditor';
import { WorldEditor } from './pages/WorldEditor';
import { TranslationsPage } from './pages/Translations';
import { StatsPage } from './pages/Stats';
import { SettingsPage } from './pages/Settings';
import { AuditPage } from './pages/Audit';
import { SecurityPage } from './pages/Security';

/** Hash routes: #/users/abc → ['users', 'abc']. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}
export const go = (path: string) => (location.hash = `#/${path}`);

interface NavItem {
  path: string;
  icon: string;
  vi: string;
  en: string;
  adminOnly?: boolean;
}
const NAV: { vi: string; en: string; items: NavItem[] }[] = [
  { vi: 'Chung', en: 'General', items: [{ path: '', icon: '📊', vi: 'Tổng quan', en: 'Overview' }, { path: 'stats', icon: '📈', vi: 'Thống kê', en: 'Stats' }] },
  {
    vi: 'Người chơi',
    en: 'Players',
    items: [
      { path: 'users', icon: '👥', vi: 'Người chơi', en: 'Players', adminOnly: true },
      { path: 'online', icon: '🟢', vi: 'Đang online', en: 'Online', adminOnly: true },
      { path: 'reports', icon: '🚩', vi: 'Báo cáo & góp ý', en: 'Reports & feedback', adminOnly: true },
    ],
  },
  {
    vi: 'NPC & Quest',
    en: 'NPCs & quests',
    items: [
      { path: 'npc', icon: '🧑‍🍳', vi: 'NPC', en: 'NPCs' },
      { path: 'quest', icon: '🎯', vi: 'Nhiệm vụ', en: 'Quests' },
      { path: 'pair', icon: '🤝', vi: 'Nhiệm vụ cặp đôi', en: 'Pair quests' },
      { path: 'placement', icon: '📝', vi: 'Bài test xếp lớp', en: 'Placement test' },
    ],
  },
  {
    vi: 'Khu chủ đề',
    en: 'Themed areas',
    items: [
      { path: 'area/farm', icon: '🐄', vi: 'Nông trại', en: 'Farm' },
      { path: 'area/zoo', icon: '🦁', vi: 'Sở thú', en: 'Zoo' },
      { path: 'area/supermarket', icon: '🛒', vi: 'Siêu thị', en: 'Supermarket' },
      { path: 'area/restaurant', icon: '🍽️', vi: 'Nhà hàng', en: 'Restaurant' },
      { path: 'world', icon: '🌍', vi: 'Tên thú, luật nông trại, hết hàng', en: 'Animal names, farm rules, sold out' },
      { path: 'translations', icon: '🌐', vi: 'Bản dịch', en: 'Translations' },
    ],
  },
  {
    vi: 'Vận hành',
    en: 'Operations',
    items: [
      { path: 'settings', icon: '⚙️', vi: 'Cài đặt', en: 'Settings', adminOnly: true },
      { path: 'audit', icon: '🧾', vi: 'Nhật ký', en: 'Audit log', adminOnly: true },
      { path: 'security', icon: '🔐', vi: 'Bảo mật tài khoản', en: 'Account security' },
    ],
  },
];

function Sidebar({ route, onNavigate }: { route: string[]; onNavigate: () => void }) {
  const L = useL();
  const me = useSession((s) => s.me);
  const logout = useSession((s) => s.logout);
  const { lang, setLang } = useAdminLang();
  const cur = route.join('/');
  const active = (p: string) => (p === '' ? cur === '' : cur === p || cur.startsWith(p + '/'));
  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto p-3 text-sm">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-2xl">🏙️</span>
        <div>
          <div className="font-bold">English Street</div>
          <div className="text-xs text-gray-500">Admin</div>
        </div>
      </div>
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.adminOnly || me?.role === 'admin');
        if (!items.length) return null;
        return (
          <div key={g.en}>
            <div className="px-2 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{L(g.vi, g.en)}</div>
            {items.map((i) => (
              <a key={i.path} href={`#/${i.path}`} onClick={onNavigate} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${active(i.path) ? 'bg-blue-100 font-semibold text-blue-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                <span aria-hidden>{i.icon}</span>
                {L(i.vi, i.en)}
              </a>
            ))}
          </div>
        );
      })}
      <div className="mt-auto border-t border-gray-200 pt-3">
        <div className="px-2 text-xs text-gray-600">
          {me?.name} · <b>{me?.role}</b>
        </div>
        <div className="mt-2 flex gap-2 px-2">
          <button type="button" className="text-xs text-blue-700 underline" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>
            {lang === 'vi' ? 'English' : 'Tiếng Việt'}
          </button>
          <button type="button" className="text-xs text-red-700 underline" onClick={logout}>
            {L('Đăng xuất', 'Sign out')}
          </button>
          <a href="/" className="text-xs text-gray-600 underline">
            {L('Vào game', 'Open game')}
          </a>
        </div>
      </div>
    </nav>
  );
}

function Routes({ route }: { route: string[] }): ReactNode {
  const [a, b, c] = route;
  switch (a) {
    case undefined:
      return <Overview />;
    case 'stats':
      return <StatsPage />;
    case 'users':
      return b ? <UserDetail id={b} /> : <UsersPage />;
    case 'online':
      return <OnlinePage />;
    case 'reports':
      return <ReportsPage />;
    case 'npc':
    case 'quest':
    case 'pair':
    case 'placement':
      return b ? <DocEditor kind={a} id={b} isNew={c === 'new'} /> : <ContentList kind={a} />;
    case 'area':
      return <AreaEditor id={b as 'zoo'} />;
    case 'world':
      return <WorldEditor />;
    case 'translations':
      return <TranslationsPage lang={b} />;
    case 'settings':
      return <SettingsPage />;
    case 'audit':
      return <AuditPage />;
    case 'security':
      return <SecurityPage />;
    default:
      return <Overview />;
  }
}

export function AdminApp() {
  const token = useSession((s) => s.token);
  const exp = useSession((s) => s.exp);
  const logout = useSession((s) => s.logout);
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const L = useL();
  // session ends after 12 h
  useEffect(() => {
    if (!token) return;
    const t = setTimeout(logout, Math.max(0, exp - Date.now()));
    return () => clearTimeout(t);
  }, [token, exp, logout]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.join("/")]);

  if (!token)
    return (
      <>
        <Login />
        <Toasts />
      </>
    );
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-gray-200 bg-white md:block">
        <Sidebar route={route} onNavigate={() => undefined} />
      </aside>
      {menu ? (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMenu(false)}>
          <aside className="h-full w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            <Sidebar route={route} onNavigate={() => setMenu(false)} />
          </aside>
        </div>
      ) : null}
      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 md:hidden">
          <button type="button" className="rounded px-2 text-xl" onClick={() => setMenu(true)} aria-label={L('Mở menu', 'Open menu')}>
            ☰
          </button>
          <b>English Street Admin</b>
        </div>
        <Routes route={route} />
      </main>
      <Toasts />
      <ConfirmHost />
    </div>
  );
}
