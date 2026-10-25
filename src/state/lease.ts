import { randomUUID } from 'node:crypto';
import type { Store } from './store.js';
export async function withLease<T>(
  store: Store,
  key: string,
  work: (assert: () => void) => Promise<T>,
): Promise<T> {
  const token = randomUUID(),
    now = Date.now(),
    duration = 30000;
  const result = store.db
    .prepare(
      `INSERT INTO records(namespace,key,data) VALUES('leases',?,?) ON CONFLICT(namespace,key) DO UPDATE SET data=excluded.data WHERE json_extract(records.data,'$.expiresAt')<?`,
    )
    .run(key, JSON.stringify({ token, expiresAt: now + duration }), now);
  if (result.changes !== 1)
    throw new Error('Another process is operating on this session; resume after its lease expires');
  const renew = () => {
    store.db
      .prepare(
        `UPDATE records SET data=json_set(data,'$.expiresAt',?) WHERE namespace='leases' AND key=? AND json_extract(data,'$.token')=?`,
      )
      .run(Date.now() + duration, key, token);
  };
  const timer = setInterval(renew, 10000);
  timer.unref();
  const assert = () => {
    const lease = store.read<{ token: string; expiresAt: number }>('leases', key);
    if (lease?.token !== token || lease.expiresAt <= Date.now())
      throw new Error('Operation lease lost');
  };
  try {
    return await work(assert);
  } finally {
    clearInterval(timer);
    store.db
      .prepare(
        `DELETE FROM records WHERE namespace='leases' AND key=? AND json_extract(data,'$.token')=?`,
      )
      .run(key, token);
  }
}
