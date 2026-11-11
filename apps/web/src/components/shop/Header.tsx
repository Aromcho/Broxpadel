'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Logo } from '../Logo';
import { useCart, cartCount } from '@/lib/cart';
import { useHydrated } from '@/lib/hooks';

const NAV = [
  { href: '/catalogo', label: 'Catálogo' },
  { href: '/catalogo?categoria=remeras-secado-rapido', label: 'Remeras' },
  { href: '/catalogo?categoria=shorts', label: 'Shorts' },
  { href: '/#en-la-cancha', label: 'En la cancha' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Header({ announcement }: { announcement: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const setOpen = useCart((s) => s.setOpen);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const qref = useRef<HTMLInputElement>(null);
  const overNight = path === '/' && !scrolled;
  useEffect(() => {
    const on = () => {
      const court = path === '/' ? (document.querySelector('[data-court]') as HTMLElement | null) : null;
      setScrolled(window.scrollY > (court ? court.offsetTop + court.offsetHeight - 80 : 8));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [path]);
  useEffect(() => setMenu(false), [path]);
  useEffect(() => { if (search) qref.current?.focus(); }, [search]);
  const n = hydrated ? cartCount(items) : 0;
  return (
    <>
      {announcement && (
        <div className="relative z-50 bg-ink text-center text-[13px] text-white t-cond py-1.5 px-4">
          {announcement}
        </div>
      )}
      <header className={clsx('sticky top-0 z-40 transition-colors duration-300', overNight ? 'bg-transparent text-white on-night' : 'bg-chalk/92 text-ink backdrop-blur-md shadow-[0_1px_0_rgba(18,21,28,.08)]')}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:px-6">
          <button className="-ml-2 grid h-11 w-11 place-items-center md:hidden" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">{menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h12M4 17h16" />}</svg>
          </button>
          <Link href="/" aria-label="Brox Padel, inicio" className="shrink-0">
            <Logo className="h-7 w-auto md:h-8" />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 md:flex" aria-label="Principal">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="t-cond text-[15px] opacity-85 transition hover:opacity-100">{l.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button className="grid h-11 w-11 place-items-center" aria-label="Buscar" onClick={() => setSearch(true)}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
            </button>
            <button className="relative grid h-11 w-11 place-items-center" aria-label={`Carrito, ${n} producto${n === 1 ? '' : 's'}`} onClick={() => setOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
              {n > 0 && <span className="absolute right-0.5 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-turf px-1 text-[11px] font-bold text-white t-num">{n}</span>}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-black/10 bg-chalk px-4 pb-6 pt-2 text-ink md:hidden" aria-label="Menú">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="t-head block py-3 text-2xl">{l.label}</Link>
            ))}
          </nav>
        )}
      </header>
      {search && (
        <div className="fixed inset-0 z-[60] bg-night/70 backdrop-blur-sm" onClick={() => setSearch(false)}>
          <form
            className="mx-auto mt-20 w-[min(640px,92vw)] rounded-2xl bg-chalk p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); const q = qref.current?.value.trim(); setSearch(false); router.push(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo'); }}
            role="search"
          >
            <label htmlFor="q" className="sr-only">Buscar en la tienda</label>
            <div className="flex items-center gap-2">
              <input id="q" ref={qref} name="q" placeholder="Buscá remeras, shorts, colores…" className="h-12 flex-1 rounded-xl bg-white px-4 text-lg outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-ink" autoComplete="off" />
              <button className="btn btn-red" type="submit">Buscar</button>
            </div>
            <p className="mt-2 px-1 text-sm text-mute">Probá con “violeta”, “short”, “retro” o “degradé”.</p>
          </form>
        </div>
      )}
    </>
  );
}
