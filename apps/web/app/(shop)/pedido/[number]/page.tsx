import type { Metadata } from 'next';
import OrderStatus from '@/components/shop/OrderStatus';

export const metadata: Metadata = { title: 'Estado del pedido', robots: { index: false } };

export default async function OrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <OrderStatus number={number} />;
}
