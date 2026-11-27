'use client';
import { useEffect, useState } from 'react';
import { api } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, useToast } from '@/admin/ui';
import { GA4_ID } from '@/lib/tracking-ids';

type Status = { pixelId: string; capiConfigured: boolean; tokenSource: 'env' | 'panel' | null; tokenEnd: string | null; testEventCode: string | null; feedUrl: string };

/** Medición: píxel de Meta, API de conversiones (token), código de prueba, catálogo y Analytics. */
export default function Medicion() {
  const [s, setS] = useState<Status | null>(null);
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { api<Status>('/admin/tracking').then((r) => { setS(r); setCode(r.testEventCode ?? ''); }).catch((e) => toast((e as Error).message, 'err')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="text-zinc-500">Cargando…</p>;

  const saveToken = async () => {
    setBusy(true);
    try {
      const r = await api<Status>('/admin/tracking/meta-token', { method: 'PUT', json: { token } });
      setS(r); setToken('');
      toast('Token guardado: la tienda ya manda los eventos desde el servidor.');
    } catch (e) { toast((e as Error).message, 'err'); }
    setBusy(false);
  };
  const saveCode = async () => {
    try {
      const r = await api<Status>('/admin/tracking/test-code', { method: 'PUT', json: { code } });
      setS(r);
      toast(code ? 'Código de prueba activo: los eventos del servidor aparecen en "Probar eventos".' : 'Código de prueba quitado.');
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  return (
    <div className="pb-10">
      <PageTitle title="Medición" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Píxel de Meta · API de conversiones">
          <p className="text-sm text-zinc-600">Píxel (conjunto de datos) <b>{s.pixelId}</b>.</p>
          <p className={`mt-2 text-sm font-semibold ${s.capiConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {s.capiConfigured ? `API de conversiones activa (token terminado en …${s.tokenEnd}${s.tokenSource === 'env' ? ', cargado en el servidor' : ''}).` : 'Falta el token: por ahora solo mide el píxel del navegador.'}
          </p>
          <div className="mt-4 space-y-3">
            <Field label={s.capiConfigured ? 'Reemplazar token' : 'Token de acceso'} hint="Administrador de eventos → el conjunto de datos → Configuración → API de conversiones → Generar token de acceso. Pegalo acá: se prueba con Meta antes de guardarlo y no se vuelve a mostrar.">
              <input className={inputCls} type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAA…" />
            </Field>
            <Btn tone="red" onClick={saveToken} disabled={busy || token.trim().length < 20}>{busy ? 'Probando con Meta…' : 'Guardar token'}</Btn>
          </div>
        </Card>
        <Card title="Probar eventos">
          <p className="text-sm text-zinc-600">Copiá el código de la pestaña “Probar eventos” del Administrador de eventos para ver ahí los eventos del servidor en vivo. Borralo cuando termines: mientras está cargado, esos eventos no cuentan para los anuncios.</p>
          <div className="mt-4 flex gap-2">
            <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="TEST12345" />
            <Btn onClick={saveCode}>{code ? 'Usar código' : 'Quitar'}</Btn>
          </div>
        </Card>
        <Card title="Catálogo de productos">
          <p className="text-sm text-zinc-600">Meta lo lee cada hora desde:</p>
          <a href={s.feedUrl} target="_blank" rel="noopener" className="mt-1 block break-all text-sm underline">{s.feedUrl}</a>
        </Card>
        <Card title="Google Analytics 4">
          <p className="text-sm text-zinc-600">ID de medición <b>{GA4_ID || 'sin cargar'}</b> (cuenta broxpadel@gmail.com).</p>
        </Card>
      </div>
    </div>
  );
}
