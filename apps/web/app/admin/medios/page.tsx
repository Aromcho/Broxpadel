/* eslint-disable @next/next/no-img-element */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Reorder } from 'motion/react';
import clsx from 'clsx';
import { api } from '@/admin/api';
import { Btn, Field, inputCls, Modal, PageTitle, useToast } from '@/admin/ui';
import { thumb, Uploader, type MediaRow } from '@/admin/MediaPicker';

const KINDS = [['', 'Todo'], ['image', 'Fotos'], ['video', 'Videos'], ['model', '3D'], ['usdz', 'AR iPhone']];
const kb = (n: number | null) => (n ? (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`) : '');

export default function MediaLibrary() {
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [edit, setEdit] = useState<MediaRow | null>(null);
  const toast = useToast();
  const load = useCallback(() => api<MediaRow[]>(`/admin/media?kind=${kind}&q=${encodeURIComponent(q)}`).then(setRows), [kind, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  return (
    <div>
      <PageTitle title="Biblioteca de medios" />
      <Uploader onDone={(r) => setRows((x) => [...r, ...x])} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={clsx('h-10 rounded-full px-4 text-sm font-semibold ring-1', kind === k ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white ring-zinc-300')}>{l}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inputCls} w-auto flex-1`} />
      </div>
      <p className="mt-3 text-sm text-zinc-500">Arrastrá para ordenar (el orden de los videos es el de la portada). Tocá un archivo para editar su texto alternativo.</p>
      <Reorder.Group axis="y" values={rows} onReorder={setRows} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {rows.map((m) => (
          <Reorder.Item key={m.id} value={m} onDragEnd={() => api('/admin/media/order', { method: 'PUT', json: { ids: rows.map((r) => r.id) } }).then(() => toast('Orden guardado'))} className="cursor-grab active:cursor-grabbing">
            <button onClick={() => setEdit(m)} className="block w-full text-left">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-200">
                {thumb(m) ? <img src={thumb(m)!} alt={m.alt ?? ''} className="h-full w-full object-cover" draggable={false} loading="lazy" /> : <span className="grid h-full place-items-center text-sm font-bold text-zinc-500">{m.kind === 'model' ? '3D · GLB' : 'USDZ'}</span>}
                <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-[11px] font-semibold text-white">{m.kind === 'image' ? 'Foto' : m.kind === 'video' ? `Video ${m.duration ? `${m.duration.toFixed(0)}s` : ''}` : m.kind.toUpperCase()}</span>
              </div>
              <p className="mt-1 truncate text-xs font-medium">{m.title ?? m.originalName}</p>
              <p className="text-[11px] text-zinc-500">{m.width ? `${m.width}×${m.height} · ` : ''}{kb(m.size)}{m.tags?.length ? ` · ${m.tags.join(', ')}` : ''}</p>
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar archivo">
        {edit && (
          <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api(`/admin/media/${edit.id}`, { method: 'PATCH', json: { title: edit.title, alt: edit.alt, tags: edit.tags } }); toast('Guardado'); setEdit(null); load(); }}>
            {thumb(edit) && <img src={thumb(edit)!} alt="" className="max-h-64 w-full rounded-xl object-contain" />}
            {edit.kind === 'video' && edit.sources && <video src={edit.sources.v_mp4 ?? edit.url} controls muted playsInline className="max-h-72 w-full rounded-xl bg-black" />}
            <Field label="Título"><input className={inputCls} value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Texto alternativo (accesibilidad y SEO)"><input className={inputCls} value={edit.alt ?? ''} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} /></Field>
            <Field label="Etiquetas" hint="court o bg = video de fondo de la portada · reel = En la cancha"><input className={inputCls} value={edit.tags.join(', ')} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
            <p className="break-all text-xs text-zinc-500">{edit.url}</p>
            <div className="flex justify-between gap-2">
              <Btn type="button" tone="ghost" className="text-[#d9161d]" onClick={async () => { if (!confirm('¿Eliminar este archivo?')) return; try { await api(`/admin/media/${edit.id}`, { method: 'DELETE' }); setEdit(null); load(); } catch (er) { toast((er as Error).message, 'err'); } }}>Eliminar</Btn>
              <Btn tone="red">Guardar</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
