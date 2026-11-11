import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';
import { DAYS } from '@/lib/format';
import OpenNow from '@/components/shop/OpenNow';

export const metadata: Metadata = { title: 'Contacto', description: 'Escribile a Brox Padel por WhatsApp o Instagram. Envíos a todo el país desde Villa Gesell.', alternates: { canonical: '/contacto' } };

export default async function Contact() {
  const { business: b } = await getBootstrap();
  const wa = b.whatsapp ? `https://wa.me/${b.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('¡Hola Brox! Tengo una consulta.')}` : null;
  const map = b.hasStore && b.address ? `https://www.google.com/maps?q=${encodeURIComponent(`${b.address}, ${b.city}, ${b.province}`)}&output=embed` : null;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 md:px-6 md:pt-12">
      <h1 className="t-head text-[clamp(2.6rem,8vw,4.6rem)]">Hablemos</h1>
      <p className="mt-3 max-w-[52ch] text-lg text-mute">¿Dudas con el talle, el envío o un pedido? Escribinos y te respondemos por chat.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {wa && (
          <a href={wa} target="_blank" rel="noopener" className="group rounded-3xl bg-ink p-6 text-white">
            <p className="t-cond text-white/60">WhatsApp</p>
            <p className="t-head mt-1 text-3xl">Escribinos por chat</p>
            <p className="t-num mt-2 text-white/80">+{b.whatsapp}</p>
          </a>
        )}
        {b.instagram && (
          <a href={`https://www.instagram.com/${b.instagram}/`} target="_blank" rel="noopener" className="rounded-3xl bg-white p-6 ring-1 ring-black/10">
            <p className="t-cond text-mute">Instagram</p>
            <p className="t-head mt-1 text-3xl">@{b.instagram}</p>
            <p className="mt-2 text-mute">Novedades, torneos y nuevos colores. Consultas por DM.</p>
          </a>
        )}
        {b.email && (
          <a href={`mailto:${b.email}`} className="rounded-3xl bg-white p-6 ring-1 ring-black/10">
            <p className="t-cond text-mute">Email</p><p className="t-head mt-1 text-2xl">{b.email}</p>
          </a>
        )}
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/10">
          <p className="t-cond text-mute">Dónde estamos</p>
          <p className="t-head mt-1 text-2xl">{b.city}, {b.province}</p>
          <p className="mt-2 text-mute">{b.hasStore && b.address ? b.address : 'Tienda online. Hacemos envíos a todo el país.'}</p>
        </div>
      </div>
      {b.hours.length > 0 && (
        <section className="mt-10 rounded-3xl bg-white p-6 ring-1 ring-black/10">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="t-head text-2xl">Horarios</h2><OpenNow hours={b.hours} /></div>
          <dl className="mt-4 grid gap-1 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const hs = b.hours.filter((h) => h.day === d);
              return <div key={d} className="flex justify-between gap-4 py-1"><dt>{DAYS[d]}</dt><dd className="t-num text-mute">{hs.length ? hs.map((h) => `${h.open}–${h.close}`).join(' · ') : 'Cerrado'}</dd></div>;
            })}
          </dl>
        </section>
      )}
      {map && <iframe title={`Mapa de ${b.name}`} src={map} className="mt-6 h-80 w-full rounded-3xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
    </div>
  );
}
