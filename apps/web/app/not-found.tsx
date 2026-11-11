import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="grid min-h-[80svh] place-items-center bg-night px-6 text-center text-white">
      <div>
        <p className="t-cond text-ball">Error 404 · pelota afuera</p>
        <h1 className="t-head mt-2 text-[clamp(2.6rem,9vw,5rem)]">Esta página salió por 3</h1>
        <p className="mt-3 text-white/70">No la encontramos. Volvé a la cancha y seguí mirando.</p>
        <Link href="/" className="btn btn-red mt-6">Ir a la tienda</Link>
      </div>
    </main>
  );
}
