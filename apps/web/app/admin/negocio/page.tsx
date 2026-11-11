'use client';
import { useEffect, useState } from 'react';
import { api } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, Toggle, useToast } from '@/admin/ui';
import { MediaField } from '@/admin/MediaPicker';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type H = { day: number; open: string; close: string; note: string | null };
type B = Record<string, string | number | boolean | null>;

export default function Business() {
  const [b, setB] = useState<B | null>(null);
  const [hours, setHours] = useState<H[]>([]);
  const toast = useToast();
  useEffect(() => { api<{ business: B; hours: H[] }>('/admin/business').then((r) => { setB(r.business); setHours(r.hours); }); }, []);
  if (!b) return <p className="text-zinc-500">Cargando…</p>;
  const t = (k: string, label: string, hint?: string, area?: boolean) => (
    <Field label={label} hint={hint} className={area ? 'md:col-span-2' : ''}>
      {area ? <textarea className={`${inputCls} min-h-24 py-2`} value={String(b[k] ?? '')} onChange={(e) => setB({ ...b, [k]: e.target.value })} /> : <input className={inputCls} value={String(b[k] ?? '')} onChange={(e) => setB({ ...b, [k]: e.target.value })} />}
    </Field>
  );
  const save = async () => {
    const { id, updatedAt, ...rest } = b; void id; void updatedAt;
    try {
      await api('/admin/business', { method: 'PATCH', json: { ...rest, transferDiscountPct: Number(rest.transferDiscountPct ?? 0), lat: rest.lat === '' || rest.lat == null ? null : Number(rest.lat), lng: rest.lng === '' || rest.lng == null ? null : Number(rest.lng) } });
      await api('/admin/business/hours', { method: 'PUT', json: { hours: hours.filter((h) => h.open && h.close) } });
      toast('Datos guardados. Ya se ven en la tienda.');
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <div className="pb-10">
      <PageTitle title="Negocio y horarios"><Btn tone="red" onClick={save}>Guardar</Btn></PageTitle>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Datos de la marca">
          <div className="grid gap-3 md:grid-cols-2">
            {t('name', 'Nombre')}{t('tagline', 'Frase')}{t('description', 'Descripción', undefined, true)}
            {t('legalId', 'CUIT')}{t('instagram', 'Instagram (usuario)')}
            <div className="md:col-span-2"><MediaField label="Logo" value={(b.logoId as number) ?? null} onChange={(id) => setB({ ...b, logoId: id })} /></div>
          </div>
        </Card>
        <Card title="Contacto">
          <div className="grid gap-3 md:grid-cols-2">
            {t('whatsapp', 'WhatsApp', 'Con código de país, sin + ni espacios. Ej: 5492255409164')}{t('phone', 'Teléfono')}{t('email', 'Email')}{t('tiendanube', 'Tiendanube (opcional)')}
            {t('address', 'Dirección del local')}{t('city', 'Ciudad')}{t('province', 'Provincia')}
            {t('lat', 'Latitud (mapa)')}{t('lng', 'Longitud (mapa)')}
          </div>
          <div className="mt-3"><Toggle checked={!!b.hasStore} onChange={(v) => setB({ ...b, hasStore: v })} label="Tiene local a la calle (muestra mapa y horarios)" /></div>
        </Card>
        <Card title="Pagos y envíos">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Descuento por transferencia (%)"><input type="number" min={0} max={50} className={inputCls} value={Number(b.transferDiscountPct ?? 0)} onChange={(e) => setB({ ...b, transferDiscountPct: Number(e.target.value) })} /></Field>
            {t('installmentsText', 'Texto de cuotas')}
            {t('transferInfo', 'Datos para transferir', 'Alias, CBU y titular. Se muestran solo a quien elige transferencia.', true)}
            {t('shippingText', 'Texto de envíos')}{t('announcement', 'Anuncio de la franja superior')}
            <div className="md:col-span-2"><Toggle checked={!!b.pickupEnabled} onChange={(v) => setB({ ...b, pickupEnabled: v })} label="Ofrecer retiro (configurá la zona “Retiro” en Envíos)" /></div>
            {t('pickupInfo', 'Indicaciones de retiro', undefined, true)}
          </div>
        </Card>
        <Card title="Horarios de atención" actions={<Btn tone="light" onClick={() => setHours([...hours, { day: 1, open: '09:00', close: '18:00', note: null }])}>+ Franja</Btn>}>
          {!hours.length && <p className="text-sm text-zinc-500">Sin horarios: la web no muestra “Abierto ahora”.</p>}
          <ul className="space-y-2">
            {hours.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select className={`${inputCls} w-36`} value={h.day} onChange={(e) => setHours(hours.map((x, k) => (k === i ? { ...x, day: Number(e.target.value) } : x)))}>{DAYS.map((d, k) => <option key={k} value={k}>{d}</option>)}</select>
                <input type="time" className={`${inputCls} w-28`} value={h.open} onChange={(e) => setHours(hours.map((x, k) => (k === i ? { ...x, open: e.target.value } : x)))} />
                <span>a</span>
                <input type="time" className={`${inputCls} w-28`} value={h.close} onChange={(e) => setHours(hours.map((x, k) => (k === i ? { ...x, close: e.target.value } : x)))} />
                <button className="h-11 w-11 text-zinc-400 hover:text-[#d9161d]" onClick={() => setHours(hours.filter((_, k) => k !== i))} aria-label="Quitar franja">✕</button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="SEO">
          <div className="grid gap-3">{t('seoTitle', 'Título del sitio')}{t('seoDescription', 'Descripción del sitio', undefined, true)}</div>
        </Card>
      </div>
    </div>
  );
}
