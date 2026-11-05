import { useEffect } from 'react';
import { api, get } from '../api';
import { go } from '../App';
import { ago, useL } from '../i18n';
import { areaAt } from '../../world/areas';
import { SHOPS, TILE } from '../../world/layout';
import { AsyncBtn, Badge, Card, ErrorBox, Loaded, Page, Table, confirmDialog, toast, useLoad } from '../ui';

interface Online {
  gameServer: boolean;
  rooms: { id: string; zone: string; clients: number }[];
  players: { sessionId: string; uid: string; guest: boolean; name: string; x: number; z: number; ip: string; since: number; zone: string; account: { email: string | null; cefrLevel: string; role: string } | null }[];
}

/** Where on the street a position is: a themed area, in front of a shop, or "street". */
export function placeName(x: number, z: number): string {
  const a = areaAt(x, z);
  if (a) return a;
  const shop = SHOPS.find((s) => Math.abs(s.tx * TILE - x) < TILE / 2 && z < 2);
  return shop ? shop.label : 'street';
}

export function OnlinePage() {
  const L = useL();
  const s = useLoad(() => get<Online>('/admin/online'));
  useEffect(() => {
    const t = setInterval(s.reload, 15_000);
    return () => clearInterval(t);
  }, [s.reload]);
  return (
    <Page title={L('Đang online', 'Online now')} actions={<AsyncBtn onRun={async () => s.reload()}>↻ {L('Làm mới', 'Refresh')}</AsyncBtn>}>
      <Loaded s={s}>
        {(d) =>
          !d.gameServer ? (
            <ErrorBox error={L('Không kết nối được game server.', 'The game server is not reachable.')} retry={s.reload} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {d.rooms.map((r) => (
                  <Badge key={r.id} tone="blue">
                    {r.zone}: {r.clients}
                  </Badge>
                ))}
              </div>
              <Card title={`${d.players.length} ${L('người đang chơi', 'players on the street')}`}>
                <Table
                  rows={d.players}
                  rowKey={(p) => p.sessionId}
                  cols={[
                    { key: 'n', label: L('Tên', 'Name'), render: (p) => (p.uid ? <a className="text-blue-700 underline" href={`#/users/${encodeURIComponent(p.uid)}`}>{p.name}</a> : p.name) },
                    { key: 'k', label: '', render: (p) => (p.guest ? <Badge>{L('khách', 'guest')}</Badge> : p.account?.role && p.account.role !== 'player' ? <Badge tone="violet">{p.account.role}</Badge> : <Badge tone="green">{L('tài khoản', 'account')}</Badge>) },
                    { key: 'z', label: 'Zone', render: (p) => p.zone },
                    { key: 'w', label: L('Đang ở', 'Where'), render: (p) => placeName(p.x, p.z) },
                    { key: 'ip', label: 'IP', render: (p) => <span className="font-mono text-xs">{p.ip}</span>, wide: true },
                    { key: 's', label: L('Vào lúc', 'Since'), render: (p) => ago(new Date(p.since)) },
                    {
                      key: 'a',
                      label: '',
                      render: (p) =>
                        p.uid ? (
                          <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <AsyncBtn
                              small
                              onRun={async () => {
                                if (!(await confirmDialog(L(`Đá ${p.name} ra khỏi phố?`, `Kick ${p.name} off the street?`)))) return;
                                await api('POST', `/admin/users/${encodeURIComponent(p.uid)}/kick`, { reason: 'Removed by a moderator.' });
                                toast(L('Đã đá ra', 'Kicked'));
                                s.reload();
                              }}
                            >
                              👢
                            </AsyncBtn>
                            <AsyncBtn small onRun={async () => go(`users/${encodeURIComponent(p.uid)}`)}>
                              →
                            </AsyncBtn>
                          </span>
                        ) : null,
                    },
                  ]}
                />
              </Card>
            </>
          )
        }
      </Loaded>
    </Page>
  );
}
