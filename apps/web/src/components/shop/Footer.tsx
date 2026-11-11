import Link from 'next/link';
import type { Business, Category } from '@/lib/types';
import { BMark, Logo } from '../Logo';

export default function Footer({ business, categories }: { business: Business; categories: Category[] }) {
  const wa = business.whatsapp ? `https://wa.me/${business.whatsapp.replace(/\D/g, '')}` : null;
  return (
    <footer className="on-night relative overflow-hidden bg-night text-white">
      <BMark className="pointer-events-none absolute -right-16 -top-10 h-[420px] w-auto text-white/[0.035]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-6">
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-4 max-w-xs text-white/70">{business.tagline}</p>
          <p className="mt-4 text-white/70">{business.shippingText} · desde {business.city}</p>
        </div>
        <nav aria-label="Tienda">
          <h3 className="t-cond mb-3 text-white/50">Tienda</h3>
          <ul className="space-y-2">
            <li><Link href="/catalogo" className="hover:underline">Todo el catálogo</Link></li>
            {categories.map((c) => <li key={c.slug}><Link href={`/catalogo?categoria=${c.slug}`} className="hover:underline">{c.name}</Link></li>)}
          </ul>
        </nav>
        <div>
          <h3 className="t-cond mb-3 text-white/50">Contacto</h3>
          <ul className="space-y-2">
            {wa && <li><a href={wa} target="_blank" rel="noopener" className="hover:underline">WhatsApp</a></li>}
            {business.instagram && <li><a href={`https://www.instagram.com/${business.instagram}/`} target="_blank" rel="noopener" className="hover:underline">Instagram @{business.instagram}</a></li>}
            {business.email && <li><a href={`mailto:${business.email}`} className="hover:underline">{business.email}</a></li>}
            <li><Link href="/contacto" className="hover:underline">Escribinos</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="t-cond mb-3 text-white/50">Ayuda</h3>
          <ul className="space-y-2">
            <li><Link href="/envios-y-pagos" className="hover:underline">Envíos y pagos</Link></li>
            <li><Link href="/talles" className="hover:underline">Guía de talles</Link></li>
            <li><Link href="/arrepentimiento" className="hover:underline">Botón de arrepentimiento</Link></li>
            <li><a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener" className="hover:underline">Defensa de las y los consumidores</a></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-5 text-sm text-white/50 md:flex-row md:justify-between md:px-6">
          <span>© {new Date().getFullYear()} {business.name}{business.legalId ? ` · CUIT ${business.legalId}` : ''}</span>
          <span>Indumentaria de pádel · Villa Gesell, Buenos Aires</span>
        </div>
      </div>
    </footer>
  );
}
