import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

const money = (n: number) => '$' + n.toLocaleString('es-AR');
export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pendiente de pago', paid: 'Pagado', preparing: 'Preparando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado',
};

type OrderLike = {
  number: string; token: string; status: string; paymentMethod: string; customerName: string; customerEmail: string | null;
  shippingName: string | null; address: string | null; city: string | null; postcode: string | null;
  subtotal: number; discount: number; transferDiscount: number; shippingCost: number; shippingToQuote?: boolean; total: number; trackingCode?: string | null; trackingUrl?: string | null;
};
type ItemLike = { name: string; size: string | null; qty: number; unitPrice: number; image?: string | null };

@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private tx: Transporter;
  private outbox = join(config.storageDir, 'mail-outbox');
  constructor() {
    this.tx = config.mail.host
      ? nodemailer.createTransport({ host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465, auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined })
      : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    mkdirSync(this.outbox, { recursive: true });
  }

  private layout(title: string, body: string) {
    return `<!doctype html><html><body style="margin:0;background:#0b0b0c;font-family:Helvetica,Arial,sans-serif;color:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0c;padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141416;border-radius:18px;overflow:hidden">
<tr><td style="background:#e3141b;padding:22px 28px;font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px;color:#fff">BROX <span style="font-size:13px;font-style:normal;letter-spacing:3px;font-weight:700">PADEL</span></td></tr>
<tr><td style="padding:28px">${title ? `<h1 style="margin:0 0 12px;font-size:22px">${title}</h1>` : ''}${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #222;color:#8a8a8f;font-size:12px">Brox Padel · Indumentaria de pádel · Envíos a todo el país</td></tr>
</table></td></tr></table></body></html>`;
  }

  private itemsTable(items: ItemLike[], o: OrderLike) {
    const rows = items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #222">${i.name}${i.size ? ` · Talle ${i.size}` : ''} × ${i.qty}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #222">${money(i.unitPrice * i.qty)}</td></tr>`).join('');
    const line = (k: string, v: string, b = false) => `<tr><td style="padding:4px 0;${b ? 'font-weight:700;font-size:16px' : 'color:#b5b5ba'}">${k}</td><td align="right" style="padding:4px 0;${b ? 'font-weight:700;font-size:16px' : ''}">${v}</td></tr>`;
    return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:16px 0">${rows}
${line('Subtotal', money(o.subtotal))}${o.discount ? line('Descuento', '−' + money(o.discount)) : ''}${o.transferDiscount ? line('Descuento transferencia', '−' + money(o.transferDiscount)) : ''}
${line(o.shippingName ?? 'Envío', o.shippingToQuote ? 'A coordinar' : o.shippingCost ? money(o.shippingCost) : 'Gratis')}${line('Total', money(o.total), true)}</table>`;
  }

  async send(to: string | null | undefined, subject: string, html: string) {
    const targets = [to, config.mail.notify].filter(Boolean) as string[];
    if (!targets.length) return;
    try {
      const info = await this.tx.sendMail({ from: config.mail.from, to: targets.join(','), subject, html });
      if (!config.mail.host) {
        // sin SMTP configurado: queda el .eml en storage/mail-outbox para revisarlo
        const file = join(this.outbox, `${Date.now()}-${subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.eml`);
        writeFileSync(file, (info as unknown as { message: Buffer }).message);
        this.log.log(`Mail guardado en ${file}`);
      }
    } catch (e) {
      this.log.error(`No se pudo enviar el mail: ${(e as Error).message}`);
    }
  }

  orderUrl(o: OrderLike) {
    return `${config.publicUrl}/pedido/${o.number}?t=${o.token}`;
  }

  async orderCreated(o: OrderLike, items: ItemLike[], extra: { transferInfo?: string | null }) {
    const pay =
      o.paymentMethod === 'transfer'
        ? `<p style="background:#1d1d20;border-radius:12px;padding:14px;line-height:1.5">Pagás por <b>transferencia</b>. ${extra.transferInfo ? extra.transferInfo.replace(/\n/g, '<br>') : 'Te escribimos por WhatsApp con los datos de la cuenta.'}<br>Mandanos el comprobante por WhatsApp indicando el pedido <b>${o.number}</b>.</p>`
        : o.paymentMethod === 'whatsapp'
          ? `<p>Seguimos la compra por WhatsApp. Ya tenemos tu pedido guardado.</p>`
          : `<p>Si todavía no completaste el pago con Mercado Pago, podés retomarlo desde el estado del pedido.</p>`;
    await this.send(o.customerEmail, `Recibimos tu pedido ${o.number} · Brox Padel`, this.layout(`¡Gracias, ${o.customerName.split(' ')[0]}!`,
      `<p style="color:#b5b5ba">Recibimos tu pedido <b style="color:#fff">${o.number}</b>.</p>${pay}${this.itemsTable(items, o)}
<a href="${this.orderUrl(o)}" style="display:inline-block;background:#e3141b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Ver estado del pedido</a>`));
  }

  async orderStatus(o: OrderLike, items: ItemLike[]) {
    const extra = o.status === 'shipped' && o.trackingCode ? `<p>Código de seguimiento: <b>${o.trackingCode}</b>${o.trackingUrl ? ` · <a style="color:#ff5a5f" href="${o.trackingUrl}">seguir envío</a>` : ''}</p>` : '';
    await this.send(o.customerEmail, `Tu pedido ${o.number}: ${STATUS_LABEL[o.status]} · Brox Padel`, this.layout(`Pedido ${STATUS_LABEL[o.status].toLowerCase()}`,
      `<p style="color:#b5b5ba">Tu pedido <b style="color:#fff">${o.number}</b> está <b style="color:#fff">${STATUS_LABEL[o.status].toLowerCase()}</b>.</p>${extra}${this.itemsTable(items, o)}
<a href="${this.orderUrl(o)}" style="display:inline-block;background:#e3141b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Ver pedido</a>`));
  }
}
