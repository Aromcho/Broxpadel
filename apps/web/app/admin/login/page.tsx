'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/admin/api';
import { Logo } from '@/components/Logo';

function Login() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api('/auth/login', { method: 'POST', json: { email, password } });
      router.replace(sp.get('next') || '/admin');
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <main className="grid min-h-svh place-items-center bg-[#0a0f1a] px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <Logo className="mx-auto h-12 w-auto text-zinc-900" />
        <h1 className="mt-6 text-center text-xl font-bold">Panel de la tienda</h1>
        <label className="mt-6 block"><span className="mb-1 block text-sm font-medium text-zinc-600">Email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="block min-h-12 w-full rounded-xl px-3 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900" /></label>
        <label className="mt-4 block"><span className="mb-1 block text-sm font-medium text-zinc-600">Contraseña</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="block min-h-12 w-full rounded-xl px-3 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900" /></label>
        {err && <p className="mt-3 text-sm font-medium text-[#d9161d]" role="alert">{err}</p>}
        <button type="submit" disabled={busy} className="mt-6 min-h-12 w-full rounded-xl bg-[#d9161d] font-bold text-white disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
export default function Page() { return <Suspense><Login /></Suspense>; }
