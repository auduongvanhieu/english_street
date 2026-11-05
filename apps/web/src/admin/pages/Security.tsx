import { useState } from 'react';
import { api, get } from '../api';
import { useL } from '../i18n';
import { AsyncBtn, Badge, Card, Field, Loaded, Page, Text, toast, useLoad } from '../ui';

/** Two-step sign-in (authenticator app) for the signed-in staff member. */
export function SecurityPage() {
  const L = useL();
  const me = useLoad(() => get<{ name: string; role: string; totp: boolean }>('/admin/me'));
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState('');
  return (
    <Page title={`🔐 ${L('Bảo mật tài khoản', 'Account security')}`}>
      <Loaded s={me}>
        {(m) => (
          <Card title={<span>{L('Xác thực 2 bước', 'Two-step sign-in')} {m.totp ? <Badge tone="green">{L('đang bật', 'on')}</Badge> : <Badge>{L('đang tắt', 'off')}</Badge>}</span>}>
            <p className="mb-3 text-sm text-gray-700">
              {L(
                'Khi bật, đăng nhập trang quản trị cần thêm mã 6 số từ ứng dụng xác thực (Google Authenticator, Authy, 1Password…). Nên bật cho tài khoản quản trị.',
                'When on, signing in to the admin site also needs a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…). Recommended for admin accounts.',
              )}
            </p>
            {!m.totp && !setup ? (
              <AsyncBtn kind="primary" onRun={async () => setSetup(await api('POST', '/admin/me/2fa/setup', {}))}>
                {L('Bật xác thực 2 bước', 'Turn on two-step sign-in')}
              </AsyncBtn>
            ) : null}
            {setup ? (
              <div className="max-w-md">
                <ol className="mb-3 list-decimal pl-5 text-sm">
                  <li>{L('Mở ứng dụng xác thực, chọn "Thêm tài khoản" → "Nhập khoá thủ công".', 'Open your authenticator app, choose "Add account" → "Enter a setup key".')}</li>
                  <li>
                    {L('Nhập khoá này (loại: theo thời gian):', 'Enter this key (time based):')}
                    <code className="mt-1 block rounded bg-gray-100 p-2 text-center font-mono tracking-wider break-all select-all">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
                    <a href={setup.url} className="text-xs text-blue-700 underline">
                      {L('hoặc mở trực tiếp trên điện thoại', 'or open it on this phone')}
                    </a>
                  </li>
                  <li>{L('Gõ mã 6 số ứng dụng hiện ra:', 'Type the 6-digit code it shows:')}</li>
                </ol>
                <Field label={L('Mã', 'Code')}>
                  <Text value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="font-mono tracking-widest" />
                </Field>
                <AsyncBtn
                  kind="primary"
                  disabled={code.length !== 6}
                  onRun={async () => {
                    await api('POST', '/admin/me/2fa/enable', { code });
                    toast(L('Đã bật xác thực 2 bước', 'Two-step sign-in is on'));
                    setSetup(null);
                    setCode('');
                    me.reload();
                  }}
                >
                  {L('Xác nhận', 'Confirm')}
                </AsyncBtn>
              </div>
            ) : null}
            {m.totp ? (
              <div className="flex max-w-md items-end gap-2">
                <Field label={L('Mã hiện tại để tắt', 'Current code to turn it off')} className="mb-0 flex-1">
                  <Text value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="font-mono tracking-widest" />
                </Field>
                <AsyncBtn
                  kind="danger"
                  disabled={code.length !== 6}
                  onRun={async () => {
                    await api('POST', '/admin/me/2fa/disable', { code });
                    toast(L('Đã tắt', 'Turned off'));
                    setCode('');
                    me.reload();
                  }}
                >
                  {L('Tắt', 'Turn off')}
                </AsyncBtn>
              </div>
            ) : null}
          </Card>
        )}
      </Loaded>
    </Page>
  );
}
