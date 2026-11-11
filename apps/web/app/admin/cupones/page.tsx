'use client';
import Crud from '@/admin/Crud';
import { money } from '@/admin/api';
export default function Page() {
  return (
    <Crud title="Cupones" endpoint="/admin/coupons" empty="No hay cupones. Creá uno para una promo." reorder={false}
      defaults={{ type: 'percent', value: 10, minSubtotal: 0, active: true }}
      fields={[
        { key: 'code', label: 'Código', type: 'text', required: true, hint: 'Ej: TORNEOBROX' },
        { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'percent', label: 'Porcentaje' }, { value: 'fixed', label: 'Monto fijo' }, { value: 'free_shipping', label: 'Envío gratis' }] },
        { key: 'value', label: 'Valor (% o $)', type: 'number' },
        { key: 'minSubtotal', label: 'Compra mínima', type: 'money' },
        { key: 'maxUses', label: 'Usos máximos (vacío = sin límite)', type: 'number' },
        { key: 'startsAt', label: 'Desde', type: 'date' },
        { key: 'endsAt', label: 'Hasta', type: 'date' },
        { key: 'note', label: 'Nota interna', type: 'text' },
        { key: 'active', label: 'Activo', type: 'bool' },
      ]}
      display={(r) => ({ title: String(r.code), sub: `${r.type === 'percent' ? `${r.value}% off` : r.type === 'fixed' ? `${money(Number(r.value))} off` : 'Envío gratis'}${Number(r.minSubtotal) ? ` · desde ${money(Number(r.minSubtotal))}` : ''} · usado ${r.used}${r.maxUses ? `/${r.maxUses}` : ''}`, badge: r.active ? null : 'Pausado' })}
    />
  );
}
