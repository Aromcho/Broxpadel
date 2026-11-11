import type { Metadata } from 'next';
import { getBootstrap } from '@/lib/api';
import Checkout from '@/components/shop/Checkout';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };

export default async function CheckoutPage() {
  const { business, payments } = await getBootstrap();
  return <Checkout mp={payments.mercadopago} whatsapp={!!business.whatsapp} transferPct={business.transferDiscountPct} hasTransferInfo={business.hasTransferInfo} />;
}
