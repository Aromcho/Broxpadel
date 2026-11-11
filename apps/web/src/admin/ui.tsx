'use client';
import clsx from 'clsx';
import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}
export const inputCls = 'block w-full min-h-11 rounded-xl bg-white px-3 text-[15px] ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900';
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-300 transition peer-checked:bg-[#d9161d] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      <span className="text-[15px]">{label}</span>
    </label>
  );
}
export function Btn({ children, tone = 'dark', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'dark' | 'red' | 'light' | 'ghost' }) {
  return (
    <button {...p} className={clsx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition disabled:opacity-40',
      tone === 'dark' && 'bg-zinc-900 text-white hover:bg-zinc-700', tone === 'red' && 'bg-[#d9161d] text-white hover:bg-[#a30f15]',
      tone === 'light' && 'bg-white ring-1 ring-zinc-300 hover:ring-zinc-500', tone === 'ghost' && 'hover:bg-zinc-100', className)}>{children}</button>
  );
}
export function Card({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: string; actions?: React.ReactNode }) {
  return (
    <section className={clsx('rounded-2xl bg-white p-4 ring-1 ring-zinc-200 md:p-5', className)}>
      {(title || actions) && <div className="mb-3 flex items-center justify-between gap-3">{title && <h2 className="text-lg font-bold">{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}
export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1><div className="flex flex-wrap gap-2">{children}</div></div>;
}

type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => undefined);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        <AnimatePresence>
          {list.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={clsx('rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg', t.tone === 'ok' ? 'bg-zinc-900' : 'bg-[#d9161d]')}>{t.text}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-end bg-black/40 md:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
            className={clsx('max-h-[92svh] w-full overflow-y-auto rounded-t-3xl bg-zinc-50 p-5 md:rounded-3xl', wide ? 'md:max-w-4xl' : 'md:max-w-lg')}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-zinc-200" aria-label="Cerrar">✕</button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
