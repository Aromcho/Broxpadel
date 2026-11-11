import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';

export const metadata: Metadata = { title: 'Guía de talles', alternates: { canonical: '/talles' } };

export default async function SizeGuidePage() {
  const { products } = await getBootstrap();
  const guides = [...new Map(products.filter((p) => p.sizeGuide).map((p) => [p.sizeGuide!.id, p.sizeGuide!])).values()];
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:pt-12">
      <h1 className="t-head text-[clamp(2.6rem,8vw,4.4rem)]">Guía de talles</h1>
      {guides.map((g) => (
        <section key={g.id} className="mt-8">
          <h2 className="t-head text-3xl">{g.name}</h2>
          <table className="mt-4 w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-black/10">
            <thead><tr>{g.columns.map((c) => <th key={c} className="t-cond border-b border-black/10 p-3 font-normal text-mute">{c}</th>)}</tr></thead>
            <tbody>{g.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`border-b border-black/5 p-3 ${i ? 't-num' : 'font-semibold'}`}>{c}</td>)}</tr>)}</tbody>
          </table>
          {g.notes && <p className="mt-3 text-mute">{g.notes}</p>}
        </section>
      ))}
      <p className="mt-8 text-mute">¿Dudas con el talle del short? Escribinos y te ayudamos a elegir.</p>
    </div>
  );
}
