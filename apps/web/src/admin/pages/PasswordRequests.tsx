import { useState } from 'react';
import { api, get } from '../api';
import { go } from '../App';
import { ago, useL } from '../i18n';
import { AsyncBtn, Badge, Btn, Card, Loaded, Modal, Page, Table, Text, toast, useLoad } from '../ui';

interface PwRequest {
  id: string;
  name: string;
  email: string | null;
  at: string;
  mailed: boolean;
  count: number;
  status: 'open' | 'self' | 'admin' | 'dismissed';
  doneAt: string | null;
  lastActiveAt: string;
}

/** Type a new password for a player (they get it from the admin; their other sessions end). */
export function SetPasswordButton({ id, name, disabled, onDone, small }: { id: string; name: string; disabled?: boolean; onDone?: () => void; small?: boolean }) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(true);
  return (
    <>
      <Btn small={small} className="whitespace-nowrap" disabled={disabled} onClick={() => (setPw(''), setOpen(true))}>
        🔑 {L('Đặt mật khẩu mới', 'Set a new password')}
      </Btn>
      {open ? (
        <Modal title={`${L('Đặt mật khẩu mới cho', 'New password for')} ${name}`} onClose={() => setOpen(false)}>
          <p className="mb-2 text-sm text-gray-600">{L('Người chơi sẽ bị đăng xuất khỏi mọi thiết bị và đăng nhập lại bằng mật khẩu này. Nhớ gửi mật khẩu cho họ.', 'The player is signed out everywhere and signs in with this password. Remember to tell them.')}</p>
          <div className="flex items-center gap-2">
            <Text type={show ? 'text' : 'password'} value={pw} onChange={setPw} placeholder={L('Ít nhất 6 ký tự', 'At least 6 characters')} autoFocus autoComplete="new-password" />
            <Btn small onClick={() => setShow(!show)}>{show ? '🙈' : '👁️'}</Btn>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn onClick={() => setOpen(false)}>{L('Huỷ', 'Cancel')}</Btn>
            <AsyncBtn
              kind="primary"
              disabled={pw.length < 6}
              onRun={async () => {
                await api('POST', `/admin/users/${encodeURIComponent(id)}/set-password`, { password: pw });
                toast(L('Đã đặt mật khẩu mới', 'Password set'));
                setOpen(false);
                onDone?.();
              }}
            >
              {L('Lưu mật khẩu', 'Save password')}
            </AsyncBtn>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** Who asked for a password reset code, whether the e-mail went out, and whether they managed on their own. */
export function PasswordRequestsPage() {
  const L = useL();
  const [n, setN] = useState(0);
  const s = useLoad(() => get<{ rows: PwRequest[]; open: number }>('/admin/password-requests'), [n]);
  const reload = () => setN((k) => k + 1);
  const status = (r: PwRequest) =>
    r.status === 'self' ? (
      <Badge tone="green">{L('Đã tự đổi bằng mã', 'Reset with the code')}</Badge>
    ) : r.status === 'admin' ? (
      <Badge tone="blue">{L('Admin đã đặt mật khẩu', 'Set by an admin')}</Badge>
    ) : r.status === 'dismissed' ? (
      <Badge>{L('Đã xử lý', 'Handled')}</Badge>
    ) : (
      <Badge tone="amber">{L('Chưa xong', 'Open')}</Badge>
    );
  return (
    <Page title={`🔑 ${L('Quên mật khẩu', 'Forgot password')}`}>
      <Card>
        <p className="text-sm text-gray-600">
          {L(
            'Người chơi bấm "Quên mật khẩu?" sẽ nhận mã 6 số qua email để tự đặt mật khẩu mới. Danh sách dưới đây là các yêu cầu trong 30 ngày. Nếu ai đó chưa nhận được email hoặc không tự làm được, bạn có thể đặt mật khẩu mới cho họ.',
            'Players who tap "Forgot password?" get a 6-digit code by e-mail and reset it themselves. Below: requests of the last 30 days. If someone did not get the e-mail or is stuck, set a new password for them.',
          )}
        </p>
      </Card>
      <Card>
        <Loaded s={s}>
          {(d) => (
            <Table
              rows={d.rows}
              rowKey={(r) => r.id + r.at}
              empty={L('Chưa có yêu cầu nào', 'No requests yet')}
              cols={[
                {
                  key: 'name',
                  label: L('Người chơi', 'Player'),
                  render: (r) => (
                    <button type="button" className="font-semibold text-blue-700 underline" onClick={() => go(`users/${encodeURIComponent(r.id)}`)}>
                      {r.name}
                    </button>
                  ),
                },
                { key: 'email', label: 'Email', render: (r) => <span className="text-xs">{r.email}</span> },
                { key: 'at', label: L('Yêu cầu lúc', 'Asked'), render: (r) => <span className="text-xs">{ago(r.at)}{r.count > 1 ? ` · ×${r.count}` : ''}</span> },
                { key: 'mail', label: 'Email OTP', render: (r) => (r.mailed ? <Badge tone="green">{L('Đã gửi', 'Sent')}</Badge> : <Badge tone="red">{L('Gửi lỗi', 'Failed')}</Badge>) },
                { key: 'status', label: L('Trạng thái', 'Status'), render: (r) => <span>{status(r)}{r.doneAt ? <span className="ml-1 text-xs text-gray-500">{ago(r.doneAt)}</span> : null}</span> },
                {
                  key: 'act',
                  label: '',
                  render: (r) => (
                    <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <SetPasswordButton small id={r.id} name={r.name} onDone={reload} />
                      {r.status === 'open' ? (
                        <AsyncBtn
                          small
                          className="whitespace-nowrap"
                          onRun={async () => {
                            await api('POST', `/admin/users/${encodeURIComponent(r.id)}/password-request/dismiss`);
                            reload();
                          }}
                        >
                          ✓ {L('Đã xử lý', 'Handled')}
                        </AsyncBtn>
                      ) : null}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Loaded>
      </Card>
    </Page>
  );
}
