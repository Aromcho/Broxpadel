import { Body, Controller, Headers, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MercadoPagoService } from './mercadopago.service';

@Controller('payments/mp')
@SkipThrottle()
export class PaymentsController {
  private log = new Logger('MPWebhook');
  constructor(private mp: MercadoPagoService) {}

  /** Webhook de Mercado Pago: actualiza el estado del pedido solo. */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Query() q: Record<string, string>, @Body() body: { type?: string; action?: string; data?: { id?: string } }, @Headers() headers: Record<string, string>) {
    const type = body?.type ?? q.type ?? q.topic;
    const id = String(body?.data?.id ?? q['data.id'] ?? q.id ?? '');
    if (type !== 'payment' || !id) return { ignored: true };
    if (!this.mp.verifySignature(headers, id)) {
      this.log.warn(`Firma inválida para el pago ${id}`);
      return { ok: false };
    }
    try {
      await this.mp.syncPayment(id);
    } catch (e) {
      this.log.error(`Error procesando el pago ${id}: ${(e as Error).message}`);
    }
    return { ok: true };
  }
}
