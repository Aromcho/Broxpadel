'use client';
import Crud from '@/admin/Crud';
export default function Page() {
  return (
    <Crud title="Colecciones" endpoint="/admin/collections" empty="Todavía no hay colecciones."
      defaults={{ visible: true, featured: false }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'kicker', label: 'Volanta (texto chico arriba)', type: 'text' },
        { key: 'slug', label: 'URL (se arma sola)', type: 'text' },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        { key: 'coverId', label: 'Foto de portada', type: 'image' },
        { key: 'videoId', label: 'Video de fondo', type: 'video' },
        { key: 'featured', label: 'Destacada en la portada', type: 'bool' },
        { key: 'visible', label: 'Visible', type: 'bool' },
      ]}
      display={(r) => ({ title: String(r.name), sub: String(r.kicker ?? ''), badge: r.featured ? 'En portada' : r.visible ? null : 'Oculta' })}
    />
  );
}
