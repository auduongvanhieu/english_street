import { useState, type FormEvent } from 'react';
import { useProfile } from '../store/profile';

type Mode = 'guest' | 'login' | 'register';

export function AuthScreen({ initialName, onPlay, connecting, connError }: { initialName: string; onPlay: (name: string) => void; connecting: boolean; connError: boolean }) {
  const { loggedIn, profile, login, register, logout } = useProfile();
  const [mode, setMode] = useState<Mode>(loggedIn ? 'login' : 'guest');
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (loggedIn && profile) return onPlay(profile.name);
    if (mode === 'guest') {
      if (name.trim().length < 2) return setError('Name must be at least 2 characters.');
      return onPlay(name.trim());
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name.trim());
      onPlay(useProfile.getState().profile?.name ?? name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Tab = ({ m, label }: { m: Mode; label: string }) => (
    <button type="button" onClick={() => setMode(m)} className={`flex-1 rounded-lg py-1.5 text-sm ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </button>
  );

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={submit} className="w-[22rem] rounded-2xl bg-white/95 p-6 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold">English Street</h1>
        <p className="mb-4 text-sm text-gray-600">Walk the street. Talk in English.</p>

        {loggedIn && profile ? (
          <div className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Signed in as <b>{profile.name}</b> · Level {profile.level} · {profile.cefrLevel}
            <button type="button" onClick={logout} className="ml-2 text-xs underline">
              sign out
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
              <Tab m="guest" label="Guest" />
              <Tab m="login" label="Sign in" />
              <Tab m="register" label="Sign up" />
            </div>
            {mode !== 'login' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={20} autoFocus className="mb-2 w-full rounded-lg border px-3 py-2" />}
            {mode !== 'guest' && (
              <>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="mb-2 w-full rounded-lg border px-3 py-2" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mb-2 w-full rounded-lg border px-3 py-2" />
              </>
            )}
            {mode === 'guest' && <p className="mb-2 text-xs text-gray-500">Guest progress stays in this browser. Sign up later to keep it.</p>}
          </>
        )}

        <button type="submit" disabled={connecting || busy} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
          {connecting ? 'Connecting…' : busy ? 'Please wait…' : mode === 'register' && !loggedIn ? 'Create account & play' : 'Enter the street'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {connError && <p className="mt-2 text-sm text-red-600">Cannot reach the game server. Is it running?</p>}
      </form>
    </div>
  );
}
