import { writeSync } from 'node:fs';
import { Writable } from 'node:stream';

// Some managed hosts lose libuv pipe writes from nested Node processes. Direct
// descriptor writes preserve MCP frames; retries respect non-blocking pipe pressure.
export function stdioOutput(fd = 1): Writable {
  return new Writable({
    write(chunk: Buffer | string, encoding, done) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
        deadline = Date.now() + 15000;
      let offset = 0;
      const flush = () => {
        try {
          while (offset < bytes.length) {
            const written = writeSync(fd, bytes, offset, bytes.length - offset);
            if (written === 0)
              throw Object.assign(new Error('STDIO made no progress'), { code: 'EAGAIN' });
            offset += written;
          }
          done();
        } catch (error) {
          if (
            ['EAGAIN', 'EWOULDBLOCK'].includes((error as NodeJS.ErrnoException).code ?? '') &&
            Date.now() < deadline
          ) {
            setTimeout(flush, 5);
            return;
          }
          done(error as Error);
        }
      };
      flush();
    },
  });
}
