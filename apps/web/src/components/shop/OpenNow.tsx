'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { openNow } from '@/lib/format';
import type { Hours } from '@/lib/types';

export default function OpenNow({ hours }: { hours: Hours[] }) {
  const [s, setS] = useState<{ open: boolean; label: string } | null>(null);
  useEffect(() => { const u = () => setS(openNow(hours)); u(); const t = setInterval(u, 60_000); return () => clearInterval(t); }, [hours]);
  if (!s) return null;
  return <span className={clsx('t-cond inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm', s.open ? 'bg-emerald-100 text-emerald-900' : 'bg-black/5 text-mute')}><span className={clsx('h-2 w-2 rounded-full', s.open ? 'bg-emerald-600' : 'bg-black/30')} />{s.label}</span>;
}
