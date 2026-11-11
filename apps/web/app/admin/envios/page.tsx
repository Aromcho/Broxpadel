'use client';
import Crud from '@/admin/Crud';
import { money } from '@/admin/api';
export default function Page() {
  return (
    <Crud title="Zonas de envío" endpoint="/admin/shipping-zones" empty="No hay zonas de envío."
      defaults={{ type: 'zone', price: 0, active: true, postcodes: [], provinces: [], toQuote: false }}
      fields={[
        { key: 'name', label: 'Nombre', type: 'text', required: true, hint: 'Ej: Villa Gesell y alrededores' },
        { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'zone', label: 'Envío a domicilio' }, { value: 'pickup', label: 'Retiro (sin costo)' }] },
        { key: 'price', label: 'Costo', type: 'money' },
        { key: 'freeFrom', label: 'Gratis desde (opcional)', type: 'money' },
        { key: 'eta', label: 'Plazo / aclaración', type: 'text', hint: 'Ej: 24 a 72 h hábiles' },
        { key: 'postcodes', label: 'Códigos postales', type: 'postcodes', hint: 'Rangos separados por coma. Vacío + sin provincias = resto del país.' },
        { key: 'provinces', label: 'Provincias', type: 'list', hint: 'Opcional, separadas por coma. Ej: Buenos Aires, CABA' },
        { key: 'toQuote', label: 'Costo a coordinar (no se cobra online)', type: 'bool' },
        { key: 'active', label: 'Activa', type: 'bool' },
      ]}
      display={(r) => ({ title: String(r.name), sub: r.toQuote ? 'A coordinar' : r.type === 'pickup' ? 'Retiro sin costo' : `${money(Number(r.price))}${r.freeFrom ? ` · gratis desde ${money(Number(r.freeFrom))}` : ''}${(r.postcodes as unknown[]).length ? ` · ${(r.postcodes as { from: number; to: number }[]).map((p) => `${p.from}-${p.to}`).join(', ')}` : ''}`, badge: r.active ? null : 'Inactiva' })}
    />
  );
}
