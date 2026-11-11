'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from './api';
import { ToastProvider } from './ui';
import { BMark } from '@/components/Logo';

type User = { id: number; email: string; name: string; role: 'admin' | 'editor' };
const UserCtx = createContext<User | null>(null);
export const useUser = () => useContext(UserCtx);

const NAV: { href: string; label: string; icon: string; admin?: boolean }[] = [
  { href: '/admin', label: 'Inicio', icon: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: 'M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8zM9 8V6.5a3 3 0 0 1 6 0V8' },
  { href: '/admin/productos', label: 'Productos', icon: 'M8 4l4 2 4-2 4 3-2 4-2-1v10H8V10l-2 1-2-4z' },
  { href: '/admin/medios', label: 'Medios', icon: 'M4 6h16v12H4zM4 15l5-5 4 4 3-3 4 4' },
  { href: '/admin/categorias', label: 'Categorías', icon: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z' },
  { href: '/admin/colecciones', label: 'Colecciones', icon: 'M5 4h14v4H5zM5 10h14v4H5zM5 16h14v4H5z' },
  { href: '/admin/historias', label: 'Historias', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10z' },
  { href: '/admin/banners', label: 'Banners', icon: 'M3 6h18v10H3zM7 20h10' },
  { href: '/admin/cupones', label: 'Cupones', icon: 'M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM10 7v12', admin: true },
  { href: '/admin/envios', label: 'Envíos', icon: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', admin: true },
  { href: '/admin/talles', label: 'Guías de talles', icon: 'M3 8h18v8H3zM7 8v4M11 8v3M15 8v4M19 8v3' },
  { href: '/admin/negocio', label: 'Negocio y horarios', icon: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6', admin: true },
  { href: '/admin/usuarios', label: 'Usuarios', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', admin: true },
];
const MOBILE = ['/admin', '/admin/pedidos', '/admin/productos', '/admin/medios'];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [more, setMore] = useState(false);
  const isLogin = path === '/admin/login';
  useEffect(() => {
    if (isLogin) return;
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => router.replace(`/admin/login?next=${encodeURIComponent(path)}`));
  }, [isLogin, path, router]);
  useEffect(() => setMore(false), [path]);
  if (isLogin) return <ToastProvider>{children}</ToastProvider>;
  if (!user) return <div className="grid min-h-svh place-items-center bg-zinc-100"><BMark className="h-10 w-10 animate-pulse text-[#fb2324]" /></div>;
  const nav = NAV.filter((n) => !n.admin || user.role === 'admin');
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); router.replace('/admin/login'); };
  const Item = ({ n }: { n: (typeof NAV)[number] }) => {
    const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
    return (
      <Link href={n.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium', on ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round"><path d={n.icon} /></svg>{n.label}
      </Link>
    );
  };
  return (
    <UserCtx.Provider value={user}>
      <ToastProvider>
        <div className="min-h-svh bg-zinc-100 text-zinc-900 [font-variation-settings:'wdth'_100]">
          <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-zinc-200 bg-zinc-50 p-4 lg:flex">
            <Link href="/admin" className="mb-6 flex items-center gap-2 px-2"><BMark className="h-8 w-8 rounded-lg bg-[#fb2324] p-1.5 text-white" /><span className="text-lg font-extrabold">Panel Brox</span></Link>
            <nav className="flex-1 space-y-1 overflow-y-auto" aria-label="Panel">{nav.map((n) => <Item key={n.href} n={n} />)}</nav>
            <div className="mt-4 border-t border-zinc-200 pt-4 text-sm">
              <p className="font-semibold">{user.name}</p><p className="text-zinc-500">{user.role === 'admin' ? 'Administrador' : 'Editor'}</p>
              <div className="mt-2 flex gap-3"><Link href="/" target="_blank" className="underline">Ver tienda</Link><button onClick={logout} className="underline">Salir</button></div>
            </div>
          </aside>
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur lg:hidden">
            <BMark className="h-7 w-7 rounded-md bg-[#fb2324] p-1 text-white" /><span className="font-extrabold">Panel Brox</span>
            <Link href="/" target="_blank" className="ml-auto text-sm underline">Tienda</Link>
          </header>
          <main className="px-4 pb-28 pt-5 md:px-8 lg:ml-64 lg:pb-12 lg:pt-8">{children}</main>
          <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Panel">
            {nav.filter((n) => MOBILE.includes(n.href)).map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={clsx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', on ? 'text-[#d9161d]' : 'text-zinc-600')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round"><path d={n.icon} /></svg>{n.label}
                </Link>
              );
            })}
            <button onClick={() => setMore(!more)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-zinc-600" aria-expanded={more}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>Más
            </button>
          </nav>
          {more && (
            <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMore(false)}>
              <div className="absolute inset-x-0 bottom-16 rounded-t-3xl bg-zinc-50 p-4 pb-6" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-1">{nav.filter((n) => !MOBILE.includes(n.href)).map((n) => <Item key={n.href} n={n} />)}</div>
                <button onClick={logout} className="mt-3 w-full rounded-xl py-3 text-sm font-semibold ring-1 ring-zinc-300">Cerrar sesión ({user.name})</button>
              </div>
            </div>
          )}
        </div>
      </ToastProvider>
    </UserCtx.Provider>
  );
}
