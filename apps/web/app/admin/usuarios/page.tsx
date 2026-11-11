'use client';
import { useEffect, useState } from 'react';
import { api } from '@/admin/api';
import { Btn, Card, Field, inputCls, PageTitle, useToast } from '@/admin/ui';

type U = { id: number; email: string; name: string; role: 'admin' | 'editor'; active: boolean; lastLoginAt: string | null };

export default function Users() {
  const [list, setList] = useState<U[]>([]);
  const [n, setN] = useState({ name: '', email: '', role: 'editor', password: '' });
  const toast = useToast();
  const load = () => api<U[]>('/admin/users').then(setList);
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageTitle title="Usuarios del panel" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <ul className="divide-y divide-zinc-100">
            {list.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="font-semibold">{u.name}</p><p className="text-sm text-zinc-500">{u.email} · {u.lastLoginAt ? `entró ${new Date(u.lastLoginAt).toLocaleDateString('es-AR')}` : 'nunca entró'}</p></div>
                <select className={`${inputCls} w-36`} value={u.role} onChange={async (e) => { try { await api(`/admin/users/${u.id}`, { method: 'PATCH', json: { role: e.target.value } }); toast('Rol actualizado'); load(); } catch (er) { toast((er as Error).message, 'err'); } }}><option value="admin">Administrador</option><option value="editor">Editor</option></select>
                <Btn tone="ghost" onClick={async () => { const p = prompt(`Nueva contraseña para ${u.name} (mínimo 8 caracteres)`); if (p) { try { await api(`/admin/users/${u.id}`, { method: 'PATCH', json: { password: p } }); toast('Contraseña cambiada'); } catch (er) { toast((er as Error).message, 'err'); } } }}>Contraseña</Btn>
                <Btn tone="ghost" className="text-[#d9161d]" onClick={async () => { if (confirm(`¿Eliminar a ${u.name}?`)) { try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); load(); } catch (er) { toast((er as Error).message, 'err'); } } }}>Eliminar</Btn>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-zinc-500">El editor maneja productos, medios, historias, banners y pedidos. El administrador, además, cupones, envíos, datos del negocio y usuarios.</p>
        </Card>
        <Card title="Invitar usuario">
          <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api('/admin/users', { method: 'POST', json: n }); toast('Usuario creado'); setN({ name: '', email: '', role: 'editor', password: '' }); load(); } catch (er) { toast((er as Error).message, 'err'); } }}>
            <Field label="Nombre"><input required className={inputCls} value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field>
            <Field label="Email"><input required type="email" className={inputCls} value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></Field>
            <Field label="Rol"><select className={inputCls} value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })}><option value="editor">Editor</option><option value="admin">Administrador</option></select></Field>
            <Field label="Contraseña inicial"><input required minLength={8} className={inputCls} value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} /></Field>
            <Btn tone="red">Crear usuario</Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
