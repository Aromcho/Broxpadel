/* eslint-disable @next/next/no-img-element */
'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useCart, cartTotal } from '@/lib/cart';
import { money } from '@/lib/format';

export default function CartDrawer({ transferPct }: { transferPct: number }) {
  const { items, open, setOpen, setQty, remove } = useCart();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [setOpen]);
  const total = cartTotal(items);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-night/55" onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog" aria-modal="true" aria-label="Tu carrito"
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-[440px] flex-col bg-chalk shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <h2 className="t-head text-2xl">Tu carrito</h2>
              <button className="grid h-11 w-11 place-items-center" onClick={() => setOpen(false)} aria-label="Cerrar carrito">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <p className="t-head text-3xl">Todavía no elegiste nada</p>
                <p className="text-mute">Mirá las remeras y shorts y sumá tu talle.</p>
                <Link href="/catalogo" className="btn btn-red" onClick={() => setOpen(false)}>Ver el catálogo</Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-black/10 overflow-y-auto px-5">
                  {items.map((i) => (
                    <li key={i.variantId} className="flex gap-3 py-4">
                      <Link href={`/producto/${i.slug}`} onClick={() => setOpen(false)} className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-chalk-2">
                        {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/producto/${i.slug}`} onClick={() => setOpen(false)} className="font-semibold leading-tight">{i.name}</Link>
                        <span className="t-cond text-sm text-mute">Talle {i.size}</span>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center rounded-full ring-1 ring-black/15">
                            <button className="grid h-9 w-9 place-items-center text-lg" aria-label="Restar uno" onClick={() => (i.qty > 1 ? setQty(i.variantId, i.qty - 1) : remove(i.variantId))}>−</button>
                            <span className="t-num w-6 text-center" aria-live="polite">{i.qty}</span>
                            <button className={clsx('grid h-9 w-9 place-items-center text-lg', i.qty >= i.max && 'opacity-30')} aria-label="Sumar uno" disabled={i.qty >= i.max} onClick={() => setQty(i.variantId, i.qty + 1)}>+</button>
                          </div>
                          <span className="t-num">{money(i.price * i.qty)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-black/10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-mute">Subtotal</span>
                    <span className="t-num text-2xl">{money(total)}</span>
                  </div>
                  {transferPct > 0 && <p className="mt-1 text-sm text-mute">Con transferencia: <span className="t-num text-ink">{money(total * (1 - transferPct / 100))}</span> ({transferPct}% off)</p>}
                  <Link href="/checkout" onClick={() => setOpen(false)} className="btn btn-red mt-4 w-full">Finalizar compra</Link>
                  <button className="mt-2 w-full py-2 text-sm underline underline-offset-4" onClick={() => setOpen(false)}>Seguir mirando</button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
