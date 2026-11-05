import { Component, type ReactNode } from 'react';
import { t } from '../i18n';
import { track } from '../net/analytics';

interface State {
  error: string | null;
  /** Bumped on retry so the Canvas remounts and asks for a fresh WebGL context. */
  attempt: number;
}

/**
 * Catches crashes of the 3D scene (most often "Error creating WebGL context" on phones that
 * refuse WebGL: iOS Lockdown Mode, GPU process crashed, too many tabs, low memory).
 * Without it the error unmounts the whole app and the player only sees the sky-blue page.
 * One silent retry first (transient context loss), then a card explaining what to try.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempt: 0 };
  private retried = false;

  static getDerivedStateFromError(e: unknown): Partial<State> {
    return { error: String((e as Error)?.message ?? e).slice(0, 160) };
  }

  componentDidCatch(e: unknown) {
    track('scene_crash', { msg: String((e as Error)?.message ?? e).slice(0, 160), auto: !this.retried });
    if (!this.retried) {
      this.retried = true;
      setTimeout(() => this.retry(), 800);
    }
  }

  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { error, attempt } = this.state;
    if (!error) return <div key={attempt} className="h-full w-full">{this.props.children}</div>;
    if (!this.retried || attempt === 0) return null; // waiting for the silent retry
    const webgl = /webgl|context/i.test(error);
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl bg-white/90 p-5 text-sm text-gray-800 shadow-lg">
          <div className="mb-2 text-base font-semibold">
            {webgl ? t('Your browser could not start 3D graphics') : t('The street failed to load')}
          </div>
          {webgl ? (
            <ul className="mb-4 list-disc space-y-1 pl-5">
              <li>{t('Close other tabs, or fully close and reopen the browser.')}</li>
              <li>{t('On iPhone: try Safari, and turn off Low Power Mode.')}</li>
              <li>{t('If Lockdown Mode is on, turn it off for this website.')}</li>
            </ul>
          ) : (
            <p className="mb-4 break-words text-xs text-gray-500">{error}</p>
          )}
          <div className="flex gap-2">
            <button className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white" onClick={this.retry}>
              {t('Try again')}
            </button>
            <button className="rounded-lg bg-gray-200 px-4 py-2 font-medium" onClick={() => location.reload()}>
              {t('Reload page')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
