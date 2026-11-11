import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';

export const metadata: Metadata = { title: 'Botón de arrepentimiento', alternates: { canonical: '/arrepentimiento' } };

export default async function Withdrawal() {
  const { business: b } = await getBootstrap();
  const wa = b.whatsapp ? `https://wa.me/${b.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, quiero arrepentirme de mi compra. Número de pedido: ')}` : null;
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-8 md:pt-12">
      <h1 className="t-head text-[clamp(2.4rem,7vw,4rem)]">Botón de arrepentimiento</h1>
      <p className="mt-4 text-lg">Podés revocar tu compra dentro de los 10 días corridos desde que recibiste el producto, sin costo ni explicación (art. 34 de la Ley 24.240 y Res. 424/2020).</p>
      <ol className="mt-6 list-decimal space-y-2 pl-6 text-lg">
        <li>Mandanos tu número de pedido (empieza con BX-) y tu nombre.</li>
        <li>Te confirmamos la solicitud y coordinamos la devolución de la prenda sin uso y con sus etiquetas.</li>
        <li>Te devolvemos el dinero por el mismo medio de pago.</li>
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        {wa && <a href={wa} target="_blank" rel="noopener" className="btn btn-red">Solicitar por WhatsApp</a>}
        {b.instagram && <a href={`https://ig.me/m/${b.instagram}`} target="_blank" rel="noopener" className="btn btn-ghost">Por mensaje de Instagram</a>}
      </div>
    </div>
  );
}
