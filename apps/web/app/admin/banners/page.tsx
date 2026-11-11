'use client';
import Crud from '@/admin/Crud';
export default function Page() {
  return (
    <Crud title="Banners" endpoint="/admin/banners" empty="Todavía no hay banners."
      defaults={{ placement: 'promo', active: true }}
      fields={[
        { key: 'placement', label: 'Ubicación', type: 'select', options: [{ value: 'promo', label: 'Promo (portada, con video)' }, { value: 'strip', label: 'Franja superior (anuncio)' }] },
        { key: 'kicker', label: 'Volanta', type: 'text' },
        { key: 'title', label: 'Título', type: 'text', required: true, wide: true },
        { key: 'subtitle', label: 'Texto', type: 'textarea' },
        { key: 'ctaLabel', label: 'Texto del botón', type: 'text' },
        { key: 'ctaHref', label: 'Link del botón', type: 'text', hint: 'Ej: /catalogo?coleccion=nueva-temporada' },
        { key: 'mediaId', label: 'Foto', type: 'image' },
        { key: 'videoId', label: 'Video', type: 'video' },
        { key: 'startsAt', label: 'Desde (opcional)', type: 'date' },
        { key: 'endsAt', label: 'Hasta (opcional)', type: 'date' },
        { key: 'active', label: 'Activo', type: 'bool' },
      ]}
      display={(r) => ({ title: String(r.title), sub: r.placement === 'strip' ? 'Franja superior' : 'Promo en portada', badge: r.active ? null : 'Pausado' })}
    />
  );
}
