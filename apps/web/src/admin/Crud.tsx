/* eslint-disable @next/next/no-img-element */
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import clsx from 'clsx';
import { api } from './api';
import { Btn, Field, inputCls, Modal, PageTitle, Toggle, useToast } from './ui';
import { MediaField } from './MediaPicker';

export type FieldDef = {
  key: string; label: string; hint?: string;
  type: 'text' | 'textarea' | 'number' | 'money' | 'bool' | 'select' | 'image' | 'video' | 'date' | 'postcodes' | 'list' | 'table';
  options?: { value: string | number; label: string }[]; required?: boolean; wide?: boolean; showIf?: (v: Row) => boolean;
};
type Row = Record<string, unknown> & { id: number };

export default function Crud({ title, endpoint, fields, display, empty, reorder = true, defaults = {}, extra }: {
  title: string; endpoint: string; fields: FieldDef[]; display: (r: Row) => { title: string; sub?: string; img?: string | null; badge?: string | null };
  empty: string; reorder?: boolean; defaults?: Record<string, unknown>; extra?: (r: Row, reload: () => void) => React.ReactNode;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edit, setEdit] = useState<Row | Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const load = useCallback(() => api<Row[]>(endpoint).then(setRows), [endpoint]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) {
        let v = edit[f.key];
        if (f.type === 'number' || f.type === 'money') v = v === '' || v == null ? null : Number(v);
        if (f.type === 'date') v = v ? new Date(String(v)).toISOString() : null;
        body[f.key] = v;
      }
      if ('id' in edit && edit.id) await api(`${endpoint}/${edit.id}`, { method: 'PATCH', json: body });
      else await api(endpoint, { method: 'POST', json: body });
      toast('Guardado. Ya se ve en la tienda.');
      setEdit(null);
      load();
    } catch (e) { toast((e as Error).message, 'err'); } finally { setSaving(false); }
  };
  const remove = async (r: Row) => {
    if (!confirm(`¿Eliminar “${display(r).title}”?`)) return;
    try { await api(`${endpoint}/${r.id}`, { method: 'DELETE' }); toast('Eliminado'); load(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const saveOrder = async (list: Row[]) => {
    setRows(list);
    await api(`${endpoint}/order`, { method: 'PUT', json: { ids: list.map((r) => r.id) } }).catch(() => toast('No se pudo guardar el orden', 'err'));
  };

  return (
    <div>
      <PageTitle title={title}><Btn tone="red" onClick={() => setEdit({ ...defaults })}>+ Nuevo</Btn></PageTitle>
      {!rows ? <p className="text-zinc-500">Cargando…</p> : !rows.length ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-zinc-200"><p className="text-zinc-600">{empty}</p><Btn tone="red" className="mt-4" onClick={() => setEdit({ ...defaults })}>Crear el primero</Btn></div>
      ) : (
        <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-2">
          {rows.map((r) => <Item key={r.id} r={r} d={display(r)} canDrag={reorder} onDrop={() => saveOrder(rows)} onEdit={() => setEdit(r)} onRemove={() => remove(r)} extra={extra?.(r, load)} />)}
        </Reorder.Group>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && 'id' in edit && edit.id ? `Editar · ${display(edit as Row).title}` : `Nuevo · ${title}`} wide={fields.length > 6}>
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 md:grid-cols-2">
            {fields.filter((f) => !f.showIf || f.showIf(edit as Row)).map((f) => <Input key={f.key} f={f} value={edit[f.key]} onChange={(v) => setEdit({ ...edit, [f.key]: v })} />)}
            <div className="sticky bottom-0 flex justify-end gap-2 bg-zinc-50 py-2 md:col-span-2">
              <Btn type="button" tone="light" onClick={() => setEdit(null)}>Cancelar</Btn>
              <Btn type="submit" tone="red" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Item({ r, d, canDrag, onDrop, onEdit, onRemove, extra }: { r: Row; d: ReturnType<Parameters<typeof Crud>[0]['display']>; canDrag: boolean; onDrop: () => void; onEdit: () => void; onRemove: () => void; extra?: React.ReactNode }) {
  const ctl = useDragControls();
  return (
    <Reorder.Item value={r} dragListener={false} dragControls={ctl} onDragEnd={onDrop} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
      {canDrag && (
        <button type="button" aria-label="Arrastrar para ordenar" className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-zinc-400 active:cursor-grabbing" onPointerDown={(e) => ctl.start(e)}>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor"><circle cx="4" cy="4" r="1.6" /><circle cx="10" cy="4" r="1.6" /><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="4" cy="16" r="1.6" /><circle cx="10" cy="16" r="1.6" /></svg>
        </button>
      )}
      {d.img !== undefined && <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200">{d.img && <img src={d.img} alt="" className="h-full w-full object-cover" />}</div>}
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold">{d.title}{d.badge && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{d.badge}</span>}</p>
        {d.sub && <p className="truncate text-sm text-zinc-500">{d.sub}</p>}
      </button>
      {extra}
      <Btn type="button" tone="ghost" onClick={onEdit} aria-label="Editar">Editar</Btn>
      <button type="button" onClick={onRemove} className="grid h-11 w-11 place-items-center rounded-xl text-zinc-400 hover:bg-red-50 hover:text-[#d9161d]" aria-label="Eliminar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
    </Reorder.Item>
  );
}

export function Input({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const cls = clsx(f.wide || f.type === 'textarea' || f.type === 'postcodes' || f.type === 'table' ? 'md:col-span-2' : '');
  if (f.type === 'bool') return <div className={cls}><Toggle checked={!!value} onChange={onChange} label={f.label} />{f.hint && <p className="text-xs text-zinc-500">{f.hint}</p>}</div>;
  if (f.type === 'image' || f.type === 'video') return <div className={cls}><MediaField label={f.label} kind={f.type} value={(value as number) ?? null} onChange={(id) => onChange(id)} /></div>;
  if (f.type === 'select') return <Field label={f.label} hint={f.hint} className={cls}><select className={inputCls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value === '' ? null : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}><option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
  if (f.type === 'textarea') return <Field label={f.label} hint={f.hint} className={cls}><textarea className={clsx(inputCls, 'min-h-24 py-2')} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} /></Field>;
  if (f.type === 'date') return <Field label={f.label} hint={f.hint} className={cls}><input type="datetime-local" className={inputCls} value={value ? new Date(String(value)).toISOString().slice(0, 16) : ''} onChange={(e) => onChange(e.target.value || null)} /></Field>;
  if (f.type === 'list') return <Field label={f.label} hint={f.hint ?? 'Separados por coma'} className={cls}><input className={inputCls} value={((value as string[]) ?? []).join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></Field>;
  if (f.type === 'postcodes') {
    const list = (value as { from: number; to: number }[]) ?? [];
    return (
      <Field label={f.label} hint={f.hint} className={cls}>
        <input className={inputCls} placeholder="Ej: 7165-7167, 1000-1499" value={list.map((r) => (r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`)).join(', ')}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [a, b] = s.split('-').map((x) => parseInt(x, 10)); return { from: a, to: Number.isFinite(b) ? b : a }; }).filter((r) => Number.isFinite(r.from)))} />
      </Field>
    );
  }
  if (f.type === 'table') {
    const t = (value as { columns: string[]; rows: string[][] }) ?? { columns: [], rows: [] };
    return <div className={cls} />;
    void t;
  }
  return (
    <Field label={f.label} hint={f.hint} className={cls}>
      <div className="relative">
        {f.type === 'money' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>}
        <input required={f.required} type={f.type === 'number' || f.type === 'money' ? 'number' : 'text'} inputMode={f.type === 'number' || f.type === 'money' ? 'numeric' : undefined}
          className={clsx(inputCls, f.type === 'money' && 'pl-7')} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Field>
  );
}
