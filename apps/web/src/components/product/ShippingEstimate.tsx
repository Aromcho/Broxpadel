'use client';
import { useState } from 'react';
import { money } from '@/lib/format';

type Option = { zoneId: number; name: string; type: 'pickup' | 'zone'; cost: number; eta: string | null; free: boolean; toQuote: boolean };

/** Costo de envío por código postal en la ficha (usa la misma cotización que el checkout). */
export default function ShippingEstimate({ variantId, qty, fallbackText }: { variantId: number | null; qty: number; fallbackText: string }) {
  const [cp, setCp] = useState('');
  const [opts, setOpts] = useState<Option[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const calc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId) { setErr('Elegí un talle con stock para calcular'); return; }
    if (!/^\d{4}$/.test(cp.trim())) { setErr('Ingresá los 4 números de tu código postal'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/store/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ variantId, qty }], postcode: cp.trim() }) });
      if (!r.ok) throw new Error();
      const q = (await r.json()) as { shippingOptions: Option[] };
      setOpts(q.shippingOptions);
      if (!q.shippingOptions.length) setErr('No encontramos envíos para ese código postal. Escribinos y lo coordinamos.');
    } catch {
      setErr('No pudimos calcular el envío. Probá de nuevo.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-w-0 flex-1">
      <p>{fallbackText}</p>
      <form onSubmit={calc} className="mt-2 flex gap-2">
        <label htmlFor="cp" className="sr-only">Código postal</label>
        <input id="cp" inputMode="numeric" autoComplete="postal-code" maxLength={4} placeholder="Tu código postal" value={cp}
          onChange={(e) => { setCp(e.target.value.replace(/\D/g, '')); setOpts(null); setErr(null); }}
          className="h-10 w-36 rounded-lg bg-chalk px-3 ring-1 ring-black/15 focus:ring-ink" />
        <button type="submit" className="t-cond h-10 rounded-lg bg-ink px-4 text-sm text-white disabled:opacity-60" disabled={busy}>{busy ? 'Calculando…' : 'Calcular'}</button>
      </form>
      {err && <p className="mt-2 text-sm text-turf" role="alert">{err}</p>}
      {opts && opts.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" aria-live="polite">
          {opts.map((o) => (
            <li key={o.zoneId} className="flex justify-between gap-3">
              <span>{o.name}{o.eta ? <span className="text-mute"> · {o.eta}</span> : null}</span>
              <span className="t-num shrink-0">{o.toQuote ? 'A coordinar' : o.free || o.cost === 0 ? 'Gratis' : money(o.cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
