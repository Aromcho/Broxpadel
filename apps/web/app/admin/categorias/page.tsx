'use client';
import Crud from '@/admin/Crud';
export default function Page() {
  return (
    <Crud title="Categorías" endpoint="/admin/categories" empty="Todavía no hay categorías."
      defaults={{ visible: true }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'slug', label: 'URL (se arma sola)', type: 'text', hint: 'Ej: remeras-retro' },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        { key: 'coverId', label: 'Portada', type: 'image' },
        { key: 'visible', label: 'Visible en la tienda', type: 'bool' },
      ]}
      display={(r) => ({ title: String(r.name), sub: `/catalogo?categoria=${r.slug}`, badge: r.visible ? null : 'Oculta' })}
    />
  );
}
