/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import { Reorder } from 'motion/react';
import { api } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, Toggle, useToast, Modal } from '@/admin/ui';
import { MediaField, MediaPicker, thumb, type MediaRow } from '@/admin/MediaPicker';

type Item = { id: number; storyId: number; mediaId: number; caption: string | null; linkLabel: string | null; linkHref: string | null; duration: number; sortOrder: number; image?: { url: string; variants: { w: number; url: string }[] } | null; video?: { poster: { url: string; variants: { w: number; url: string }[] } | null } | null; kind?: string };
type Story = { id: number; title: string; coverId: number | null; visible: boolean; sortOrder: number; items: Item[] };

export default function Page() {
  const [stories, setStories] = useState<Story[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const toast = useToast();
  const load = async () => {
    const [ss, items, media] = await Promise.all([api<Story[]>('/admin/stories'), api<Item[]>('/admin/story-items'), api<MediaRow[]>('/admin/media')]);
    const mm = new Map(media.map((m) => [m.id, m]));
    setStories(ss.map((s) => ({ ...s, items: items.filter((i) => i.storyId === s.id).sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ ...i, thumb: thumb(mm.get(i.mediaId)) })) as Item[] })));
  };
  useEffect(() => { load(); }, []);
  const patch = async (s: Story, body: Partial<Story>) => { await api(`/admin/stories/${s.id}`, { method: 'PATCH', json: body }); toast('Guardado'); load(); };
  const addItems = async (storyId: number, rows: MediaRow[]) => {
    for (const m of rows) await api('/admin/story-items', { method: 'POST', json: { storyId, mediaId: m.id, duration: m.kind === 'video' ? Math.min(15, Math.max(2, m.duration ?? 5)) : 5 } });
    toast(`${rows.length} agregado${rows.length > 1 ? 's' : ''}`); load();
  };
  return (
    <div>
      <PageTitle title="Historias destacadas"><Btn tone="red" onClick={async () => { await api('/admin/stories', { method: 'POST', json: { title: 'Nueva', visible: true } }); load(); }}>+ Nueva historia</Btn></PageTitle>
      <Reorder.Group axis="y" values={stories} onReorder={setStories} className="space-y-4">
        {stories.map((s) => (
          <Reorder.Item key={s.id} value={s} onDragEnd={() => api('/admin/stories/order', { method: 'PUT', json: { ids: stories.map((x) => x.id) } })}>
            <Card>
              <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                <Field label="Título"><input className={inputCls} defaultValue={s.title} onBlur={(e) => e.target.value !== s.title && patch(s, { title: e.target.value })} /></Field>
                <MediaField label="Portada" value={s.coverId} onChange={(id) => patch(s, { coverId: id })} />
                <Toggle checked={s.visible} onChange={(v) => patch(s, { visible: v })} label="Visible" />
              </div>
              <Reorder.Group axis="x" values={s.items} onReorder={(items) => setStories(stories.map((x) => (x.id === s.id ? { ...x, items } : x)))} className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {s.items.map((it) => (
                  <Reorder.Item key={it.id} value={it} onDragEnd={() => api('/admin/story-items/order', { method: 'PUT', json: { ids: s.items.map((x) => x.id) } })} className="w-24 shrink-0 cursor-grab">
                    <button className="block aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-200" onClick={() => setEditItem(it)} aria-label="Editar ítem">
                      {(it as unknown as { thumb: string | null }).thumb && <img src={(it as unknown as { thumb: string }).thumb} alt="" className="h-full w-full object-cover" draggable={false} />}
                    </button>
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{it.caption}</p>
                  </Reorder.Item>
                ))}
                <button onClick={() => setPick(s.id)} className="grid aspect-[9/16] w-24 shrink-0 place-items-center rounded-xl border-2 border-dashed border-zinc-300 text-sm font-semibold text-zinc-500">+ Agregar</button>
              </Reorder.Group>
              <div className="mt-2 flex justify-end"><Btn tone="ghost" onClick={async () => { if (confirm(`¿Eliminar la historia “${s.title}”?`)) { await api(`/admin/stories/${s.id}`, { method: 'DELETE' }); load(); } }}>Eliminar historia</Btn></div>
            </Card>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <MediaPicker open={pick !== null} onClose={() => setPick(null)} multiple kind="visual" onPick={(rows) => pick && addItems(pick, rows)} />
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Ítem de historia">
        {editItem && (
          <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); await api(`/admin/story-items/${editItem.id}`, { method: 'PATCH', json: { caption: editItem.caption, linkLabel: editItem.linkLabel, linkHref: editItem.linkHref, duration: Number(editItem.duration) } }); toast('Guardado'); setEditItem(null); load(); }}>
            <Field label="Texto"><input className={inputCls} value={editItem.caption ?? ''} onChange={(e) => setEditItem({ ...editItem, caption: e.target.value })} /></Field>
            <Field label="Texto del botón"><input className={inputCls} value={editItem.linkLabel ?? ''} onChange={(e) => setEditItem({ ...editItem, linkLabel: e.target.value })} /></Field>
            <Field label="Link"><input className={inputCls} value={editItem.linkHref ?? ''} onChange={(e) => setEditItem({ ...editItem, linkHref: e.target.value })} placeholder="/producto/remera-brox-violeta" /></Field>
            <Field label="Duración (segundos)"><input type="number" min={2} max={30} className={inputCls} value={editItem.duration} onChange={(e) => setEditItem({ ...editItem, duration: Number(e.target.value) })} /></Field>
            <div className="flex justify-between gap-2"><Btn type="button" tone="ghost" onClick={async () => { await api(`/admin/story-items/${editItem.id}`, { method: 'DELETE' }); setEditItem(null); load(); }}>Quitar</Btn><Btn tone="red">Guardar</Btn></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
