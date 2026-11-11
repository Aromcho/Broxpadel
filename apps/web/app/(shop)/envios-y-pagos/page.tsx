import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';
import { money } from '@/lib/format';

export const metadata: Metadata = { title: 'Envíos y pagos', alternates: { canonical: '/envios-y-pagos' } };

export default async function ShippingPayments() {
  const { business: b, shipping, payments } = await getBootstrap();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 md:pt-12">
      <h1 className="t-head text-[clamp(2.6rem,8vw,4.4rem)]">Envíos y pagos</h1>
      <h2 className="t-head mt-10 text-3xl">Envíos</h2>
      <p className="mt-2 text-lg">{b.shippingText}, desde {b.city}.</p>
      <ul className="mt-4 divide-y divide-black/10 rounded-2xl bg-white ring-1 ring-black/10">
        {shipping.map((z) => (
          <li key={z.id} className="flex justify-between gap-4 p-4"><span><b>{z.name}</b>{z.eta && <span className="block text-sm text-mute">{z.eta}</span>}</span><span className="t-num">{z.toQuote ? 'A coordinar' : z.price ? money(z.price) : 'Gratis'}{z.freeFrom ? <span className="block text-sm text-mute">Gratis desde {money(z.freeFrom)}</span> : null}</span></li>
        ))}
      </ul>
      <h2 className="t-head mt-10 text-3xl">Medios de pago</h2>
      <ul className="mt-4 space-y-3 text-lg">
        {payments.mercadopago && <li><b>Mercado Pago:</b> {b.installmentsText ?? 'tarjetas de crédito y débito'}, dinero en cuenta y billetera.</li>}
        <li><b>Transferencia bancaria:</b> {b.transferDiscountPct ? `${b.transferDiscountPct}% de descuento sobre los productos (sin envío).` : 'te pasamos los datos al confirmar.'}</li>
        {b.whatsapp && <li><b>Pedido por WhatsApp:</b> armás el carrito, se guarda el pedido y coordinamos el pago por chat.</li>}
      </ul>
      <h2 className="t-head mt-10 text-3xl">Cambios y devoluciones</h2>
      <p className="mt-2 text-lg">Tenés 10 días corridos desde que recibís la compra para arrepentirte (Ley 24.240). Escribinos con tu número de pedido.</p>
    </div>
  );
}
