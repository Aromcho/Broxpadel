// npm run dev → API (Nest en modo watch, :4000) + web (Next dev, :3000) en la misma terminal.
import { serve, killOnExit, log } from './lib.mjs';
log('web', 'Tienda: http://localhost:3000 · Panel: http://localhost:3000/admin');
const api = serve('api', 'npm', ['run', 'dev', '-w', 'apps/api']);
const web = serve('web', 'npm', ['run', 'dev', '-w', 'apps/web']);
killOnExit([api, web]);
