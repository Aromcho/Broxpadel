'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CartItem = {
  variantId: number; productId: number; slug: string; name: string; size: string; color: string | null;
  price: number; image: string | null; qty: number; max: number;
};
type CartState = {
  items: CartItem[];
  open: boolean;
  coupon: string | null;
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  setQty: (variantId: number, qty: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  setOpen: (o: boolean) => void;
  setCoupon: (c: string | null) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      coupon: null,
      add: (item, qty = 1) =>
        set((s) => {
          const ex = s.items.find((i) => i.variantId === item.variantId);
          const items = ex
            ? s.items.map((i) => (i.variantId === item.variantId ? { ...i, ...item, qty: Math.min(i.max || 99, i.qty + qty) } : i))
            : [...s.items, { ...item, qty: Math.min(item.max || 99, qty) }];
          return { items, open: true };
        }),
      setQty: (variantId, qty) => set((s) => ({ items: s.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(i.max || 99, qty)) } : i)) })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], coupon: null }),
      setOpen: (open) => set({ open }),
      setCoupon: (coupon) => set({ coupon }),
    }),
    { name: 'brox-cart', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ items: s.items, coupon: s.coupon }) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, i) => a + i.qty, 0);
export const cartTotal = (items: CartItem[]) => items.reduce((a, i) => a + i.qty * i.price, 0);
