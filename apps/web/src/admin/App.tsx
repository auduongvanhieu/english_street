import { ClaudePage } from './pages/Claude';
import type { AreaId } from '@es/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from './api';
import { useAdminLang, useL } from './i18n';
import { Login } from './Login';
import { ConfirmHost, Toasts } from './ui';
import { AIcon } from './icons';
import { Overview } from './pages/Overview';
import { UsersPage } from './pages/Users';
import { UserDetail } from './pages/UserDetail';
import { OnlinePage } from './pages/Online';
import { JourneyPage } from './pages/Journey';
import { PasswordRequestsPage } from './pages/PasswordRequests';
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
  { vi: 'Chung', en: 'General', items: [{ path: '', icon: 'overview', vi: 'Tổng quan', en: 'Overview' }, { path: 'stats', icon: 'stats', vi: 'Thống kê', en: 'Stats' }] },
  {
    vi: 'Người chơi',
    en: 'Players',
    items: [
      { path: 'users', icon: 'users', vi: 'Người chơi', en: 'Players', adminOnly: true },
      { path: 'online', icon: 'online', vi: 'Đang online', en: 'Online', adminOnly: true },
      { path: 'reports', icon: 'flag', vi: 'Báo cáo & góp ý', en: 'Reports & feedback', adminOnly: true },
      { path: 'journey', icon: 'star', vi: 'Hành trình', en: 'Journey', adminOnly: true },
      { path: 'passwords', icon: 'key', vi: 'Quên mật khẩu', en: 'Forgot password', adminOnly: true },
    ],
  },
  {
    vi: 'NPC & Quest',
    en: 'NPCs & quests',
    items: [
      { path: 'npc', icon: 'npc', vi: 'NPC', en: 'NPCs' },
      { path: 'quest', icon: 'target', vi: 'Nhiệm vụ', en: 'Quests' },
      { path: 'pair', icon: 'pair', vi: 'Nhiệm vụ cặp đôi', en: 'Pair quests' },
      { path: 'placement', icon: 'test', vi: 'Bài test xếp lớp', en: 'Placement test' },
    ],
  },
  {
    vi: 'Khu chủ đề',
    en: 'Themed areas',
    items: [
      { path: 'area/farm', icon: 'farm', vi: 'Nông trại', en: 'Farm' },
      { path: 'area/zoo', icon: 'zoo', vi: 'Sở thú', en: 'Zoo' },
      { path: 'area/supermarket', icon: 'cart', vi: 'Siêu thị', en: 'Supermarket' },
      { path: 'area/restaurant', icon: 'food', vi: 'Nhà hàng', en: 'Restaurant' },
      { path: 'area/home', icon: 'home', vi: 'Ngôi nhà', en: 'Home' },
      { path: 'area/school', icon: 'school', vi: 'Trường học', en: 'School' },
      { path: 'area/clothes', icon: 'shirt', vi: 'Shop quần áo', en: 'Clothes shop' },
      { path: 'area/cinema', icon: 'film', vi: 'Rạp phim & thư viện', en: 'Cinema & library' },
      { path: 'area/station', icon: 'train', vi: 'Nhà ga', en: 'Station' },
      { path: 'area/hospital', icon: 'pill', vi: 'Bệnh viện', en: 'Hospital' },
      { path: 'area/hotel', icon: 'hotel', vi: 'Khách sạn', en: 'Hotel' },
      { path: 'area/sports', icon: 'ball', vi: 'Công viên thể thao', en: 'Sports park' },
      { path: 'world', icon: 'globe', vi: 'Tên thú, luật nông trại, hết hàng', en: 'Animal names, farm rules, sold out' },
      { path: 'translations', icon: 'translate', vi: 'Bản dịch', en: 'Translations' },
    ],
  },
  {
    vi: 'Vận hành',
    en: 'Operations',
    items: [
      { path: 'settings', icon: 'settings', vi: 'Cài đặt', en: 'Settings', adminOnly: true },
      { path: 'claude', icon: 'coin', vi: 'Claude AI: chi phí', en: 'Claude AI: cost', adminOnly: true },
      { path: 'audit', icon: 'log', vi: 'Nhật ký', en: 'Audit log', adminOnly: true },
      { path: 'security', icon: 'shield', vi: 'Bảo mật tài khoản', en: 'Account security' },
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
    <nav className="flex h-full flex-col bg-slate-900 text-sm text-slate-300">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 text-lg font-black text-white shadow-lg shadow-indigo-900/40">E</span>
        <div className="leading-tight">
          <div className="font-bold text-white">English Street</div>
          <div className="text-xs text-slate-400">{L('Quản trị', 'Admin')}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-3">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.adminOnly || me?.role === 'admin');
          if (!items.length) return null;
          return (
            <div key={g.en}>
              <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{L(g.vi, g.en)}</div>
              {items.map((i) => (
                <a
                  key={i.path}
                  href={`#/${i.path}`}
                  onClick={onNavigate}
                  className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors ${active(i.path) ? 'bg-indigo-500/15 font-semibold text-white ring-1 ring-indigo-400/30' : 'hover:bg-white/5 hover:text-white'}`}
                >
                  <AIcon name={i.icon} size={17} className={active(i.path) ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="truncate">{L(i.vi, i.en)}</span>
                </a>
              ))}
            </div>
          );
        })}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white">{(me?.name ?? '?').slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-semibold text-white">{me?.name}</div>
            <div className="text-xs text-slate-400">{me?.role}</div>
          </div>
          <button type="button" title={lang === 'vi' ? 'English' : 'Tiếng Việt'} onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-slate-300 hover:bg-white/10">
            {lang === 'vi' ? 'EN' : 'VI'}
          </button>
          <button type="button" title={L('Đăng xuất', 'Sign out')} onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-red-300">
            <AIcon name="logout" size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}

/** The bar on top of every page: menu (phone), quick player search, open the game. */
function TopBar({ onMenu }: { onMenu: () => void }) {
  const L = useL();
  const me = useSession((s) => s.me);
  const [q, setQ] = useState('');
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/85 px-3 py-2 backdrop-blur md:px-6">
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden" onClick={onMenu} aria-label={L('Mở menu', 'Open menu')}>
        <AIcon name="menu" />
      </button>
      {me?.role === 'admin' ? (
        <form
          className="relative max-w-md flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            sessionStorage.setItem('admin:userq', q.trim());
            window.dispatchEvent(new Event('admin:userq'));
            go('users');
            setQ('');
          }}
        >
          <AIcon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Tìm người chơi: tên, email, id, IP…', 'Find a player: name, e-mail, id, IP…')} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none" />
        </form>
      ) : (
        <b className="flex-1 md:hidden">English Street</b>
      )}
      <a href="/" className="ml-auto flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
        <AIcon name="game" size={16} />
        <span className="hidden sm:inline">{L('Vào game', 'Open game')}</span>
      </a>
    </div>
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
    case 'journey':
      return <JourneyPage />;
    case 'passwords':
      return <PasswordRequestsPage />;
    case 'reports':
      return <ReportsPage />;
    case 'npc':
    case 'quest':
    case 'pair':
    case 'placement':
      return b ? <DocEditor kind={a} id={b} isNew={c === 'new'} /> : <ContentList kind={a} />;
    case 'area':
      return <AreaEditor id={b as AreaId} />;
    case 'world':
      return <WorldEditor />;
    case 'translations':
      return <TranslationsPage lang={b} />;
    case 'settings':
      return <SettingsPage />;
    case 'claude':
      return <ClaudePage />;
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
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 md:block">
        <Sidebar route={route} onNavigate={() => undefined} />
      </aside>
      {menu ? (
        <div className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)}>
          <aside className="h-full w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Sidebar route={route} onNavigate={() => setMenu(false)} />
          </aside>
        </div>
      ) : null}
      <main className="min-w-0 flex-1">
        <TopBar onMenu={() => setMenu(true)} />
        <Routes route={route} />
      </main>
      <Toasts />
      <ConfirmHost />
    </div>
  );
}
