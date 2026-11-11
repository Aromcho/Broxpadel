import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

/** Avisa a Next.js qué tags invalidar para que los cambios del panel se vean al instante. */
@Injectable()
export class RevalidateService {
  private log = new Logger('Revalidate');
  async tags(...tags: string[]) {
    const unique = [...new Set(tags.filter(Boolean))];
    if (!unique.length) return;
    try {
      const r = await fetch(`${config.webInternalUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': config.revalidateSecret },
        body: JSON.stringify({ tags: unique }),
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) this.log.warn(`revalidate ${r.status}`);
    } catch (e) {
      this.log.warn(`No se pudo revalidar (${unique.join(',')}): ${(e as Error).message}`);
    }
  }
}
