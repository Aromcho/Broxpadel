/* eslint-disable @next/next/no-img-element */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { api } from './api';
import { Btn, Modal, useToast } from './ui';

export type MediaRow = {
  id: number; kind: 'image' | 'video' | 'model' | 'usdz'; title: string | null; alt: string | null; url: string; width: number | null; height: number | null;
  size: number | null; duration: number | null; variants: { w: number; url: string }[] | null; sources: Record<string, string> | null; poster: { url: string; variants: { w: number; url: string }[] } | null;
  tags: string[]; originalName: string | null; sortOrder: number;
};
export const thumb = (m: Pick<MediaRow, 'kind' | 'url' | 'variants' | 'poster'> | null | undefined) =>
  !m ? null : m.kind === 'image' ? m.variants?.find((v) => v.w >= 320)?.url ?? m.url : m.kind === 'video' ? m.poster?.variants?.find((v) => v.w >= 320)?.url ?? m.poster?.url ?? null : null;

/** Subida con arrastrar y soltar (o tocar): imágenes, videos (se transcodifican solos), .glb y .usdz. */
export function Uploader({ onDone, accept = 'image/*,video/*,.glb,.usdz', compact }: { onDone: (rows: MediaRow[]) => void; accept?: string; compact?: boolean }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const send = async (files: FileList | File[]) => {
    const arr = [...files];
    if (!arr.length) return;
    setBusy(arr.some((f) => f.type.startsWith('video/')) ? 'Procesando video (MP4 + WebM, recortes y póster)…' : arr.some((f) => f.name.endsWith('.glb')) ? 'Optimizando modelo 3D…' : `Subiendo ${arr.length} archivo${arr.length > 1 ? 's' : ''}…`);
    const fd = new FormData();
    arr.forEach((f) => fd.append('files', f));
    try {
      const rows = await api<MediaRow[]>('/admin/media/upload', { method: 'POST', body: fd });
      toast(`${rows.length} archivo${rows.length > 1 ? 's' : ''} listo${rows.length > 1 ? 's' : ''}`);
      onDone(rows);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
      className={clsx('grid place-items-center rounded-2xl border-2 border-dashed text-center transition', compact ? 'p-4' : 'p-8', drag ? 'border-[#d9161d] bg-red-50' : 'border-zinc-300 bg-white')}>
      <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => e.target.files && send(e.target.files)} />
      {busy ? (
        <p className="flex items-center gap-2 text-sm font-medium"><span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />{busy}</p>
      ) : (
        <>
          <p className="font-semibold">Arrastrá archivos acá</p>
          <p className="mt-1 text-sm text-zinc-500">Fotos, videos, modelos 3D (.glb) o .usdz para AR en iPhone</p>
          <Btn type="button" tone="light" className="mt-3" onClick={() => input.current?.click()}>Elegir archivos</Btn>
        </>
      )}
    </div>
  );
}

/** Selector de medios de la biblioteca (uno o varios), con subida incluida. */
export function MediaPicker({ open, onClose, onPick, kind = 'image', multiple }: { open: boolean; onClose: () => void; onPick: (rows: MediaRow[]) => void; kind?: MediaRow['kind'] | 'visual'; multiple?: boolean }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const load = useCallback(() => api<MediaRow[]>(`/admin/media?${kind === 'visual' ? '' : `kind=${kind}`}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((r) => setRows(kind === 'visual' ? r.filter((m) => m.kind === 'image' || m.kind === 'video') : r)), [kind, q]);
  useEffect(() => { if (open) { setSel([]); load(); } }, [open, load]);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : multiple ? [...s, id] : [id]));
  return (
    <Modal open={open} onClose={onClose} title={`Elegir ${kind === 'image' ? 'fotos' : kind === 'video' ? 'video' : kind === 'visual' ? 'fotos o videos' : kind === 'model' ? 'modelo 3D' : 'archivo USDZ'}`} wide>
      <Uploader compact accept={kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : kind === 'visual' ? 'image/*,video/*' : kind === 'model' ? '.glb' : '.usdz'} onDone={(r) => { setRows((x) => [...r, ...x]); setSel((s) => (multiple ? [...s, ...r.map((m) => m.id)] : [r[0].id])); }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="mt-4 block min-h-11 w-full rounded-xl bg-white px-3 ring-1 ring-zinc-300" />
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {rows.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => toggle(m.id)} className={clsx('relative block aspect-square w-full overflow-hidden rounded-xl bg-zinc-200 ring-2', sel.includes(m.id) ? 'ring-[#d9161d]' : 'ring-transparent')} aria-pressed={sel.includes(m.id)}>
              {thumb(m) ? <img src={thumb(m)!} alt={m.alt ?? m.title ?? ''} className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center p-2 text-xs font-semibold">{m.kind.toUpperCase()}<br />{m.title}</span>}
              {sel.includes(m.id) && <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#d9161d] text-xs font-bold text-white">{multiple ? sel.indexOf(m.id) + 1 : '✓'}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 mt-4 flex justify-end gap-2 bg-zinc-50 py-2">
        <Btn tone="light" onClick={onClose}>Cancelar</Btn>
        <Btn tone="red" disabled={!sel.length} onClick={() => { onPick(sel.map((id) => rows.find((r) => r.id === id)!).filter(Boolean)); onClose(); }}>Usar {sel.length > 1 ? `${sel.length} archivos` : 'archivo'}</Btn>
      </div>
    </Modal>
  );
}

/** Campo de un solo medio (portada, video, etc.). */
export function MediaField({ value, onChange, kind = 'image', label }: { value: number | null; onChange: (id: number | null, row?: MediaRow) => void; kind?: MediaRow['kind']; label: string }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<MediaRow | null>(null);
  useEffect(() => {
    if (!value) { setRow(null); return; }
    if (row?.id === value) return;
    api<MediaRow[]>(`/admin/media?kind=${kind}`).then((rs) => setRow(rs.find((r) => r.id === value) ?? null));
  }, [value, kind, row?.id]);
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-200 text-xs font-semibold">{thumb(row) ? <img src={thumb(row)!} alt="" className="h-full w-full object-contain" /> : value ? kind.toUpperCase() : '—'}</div>
        <Btn type="button" tone="light" onClick={() => setOpen(true)}>{value ? 'Cambiar' : 'Elegir'}</Btn>
        {value && <Btn type="button" tone="ghost" onClick={() => onChange(null)}>Quitar</Btn>}
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} kind={kind} onPick={(r) => { setRow(r[0]); onChange(r[0].id, r[0]); }} />
    </div>
  );
}
