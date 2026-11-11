'use client';
import { useEffect, useState } from 'react';
import { api } from '@/admin/api';
import { Btn, Card, inputCls, PageTitle, useToast } from '@/admin/ui';

type Guide = { id?: number; name: string; columns: string[]; rows: string[][]; notes: string | null };

export default function Page() {
  const [list, setList] = useState<Guide[]>([]);
  const toast = useToast();
  const load = () => api<Guide[]>('/admin/size-guides').then(setList);
  useEffect(() => { load(); }, []);
  const upd = (i: number, g: Guide) => setList(list.map((x, k) => (k === i ? g : x)));
  const save = async (g: Guide) => {
    try {
      const body = { name: g.name, columns: g.columns, rows: g.rows.filter((r) => r.some(Boolean)), notes: g.notes };
      if (g.id) await api(`/admin/size-guides/${g.id}`, { method: 'PATCH', json: body }); else await api('/admin/size-guides', { method: 'POST', json: body });
      toast('Guía guardada'); load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <div>
      <PageTitle title="Guías de talles"><Btn tone="red" onClick={() => setList([...list, { name: 'Nueva guía', columns: ['Talle', 'Largo (cm)', 'Ancho (cm)'], rows: [['', '', '']], notes: '' }])}>+ Nueva guía</Btn></PageTitle>
      <div className="space-y-4">
        {list.map((g, i) => (
          <Card key={g.id ?? `n${i}`}>
            <input className={`${inputCls} text-lg font-bold`} value={g.name} onChange={(e) => upd(i, { ...g, name: e.target.value })} aria-label="Nombre de la guía" />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead><tr>{g.columns.map((c, ci) => <th key={ci} className="p-1"><input className={`${inputCls} font-semibold`} value={c} onChange={(e) => upd(i, { ...g, columns: g.columns.map((x, k) => (k === ci ? e.target.value : x)) })} aria-label={`Columna ${ci + 1}`} /></th>)}<th /></tr></thead>
                <tbody>
                  {g.rows.map((r, ri) => (
                    <tr key={ri}>
                      {g.columns.map((_, ci) => <td key={ci} className="p-1"><input className={inputCls} value={r[ci] ?? ''} onChange={(e) => upd(i, { ...g, rows: g.rows.map((row, k) => (k === ri ? g.columns.map((__, cc) => (cc === ci ? e.target.value : row[cc] ?? '')) : row)) })} aria-label={`Fila ${ri + 1}, ${g.columns[ci]}`} /></td>)}
                      <td><button className="grid h-11 w-11 place-items-center text-zinc-400 hover:text-[#d9161d]" onClick={() => upd(i, { ...g, rows: g.rows.filter((_, k) => k !== ri) })} aria-label="Quitar fila">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn tone="light" onClick={() => upd(i, { ...g, rows: [...g.rows, g.columns.map(() => '')] })}>+ Fila</Btn>
              <Btn tone="light" onClick={() => upd(i, { ...g, columns: [...g.columns, 'Nueva'], rows: g.rows.map((r) => [...r, '']) })}>+ Columna</Btn>
            </div>
            <textarea className={`${inputCls} mt-3 min-h-20 py-2`} placeholder="Notas (cómo medir, aclaraciones)" value={g.notes ?? ''} onChange={(e) => upd(i, { ...g, notes: e.target.value })} />
            <div className="mt-3 flex justify-end gap-2">
              {g.id && <Btn tone="ghost" onClick={async () => { if (confirm('¿Eliminar la guía?')) { await api(`/admin/size-guides/${g.id}`, { method: 'DELETE' }); load(); } }}>Eliminar</Btn>}
              <Btn tone="red" onClick={() => save(g)}>Guardar</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
