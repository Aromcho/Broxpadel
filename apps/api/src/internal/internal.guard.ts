import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Candado del módulo /internal (panel central). Lo consulta solo admin-api, desde el mismo servidor.
 * Tres condiciones: token de servicio (INTERNAL_TOKEN en .env), conexión desde localhost y que el
 * pedido no venga reenviado por Nginx (todo lo que entra por un dominio trae X-Forwarded-For /
 * X-Real-IP y también llega desde 127.0.0.1, así que mirar la IP sola no alcanza; además la app
 * usa `trust proxy`, por eso se mira el socket y no req.ip).
 * Sin INTERNAL_TOKEN configurado el módulo queda apagado y responde 404, igual que a un extraño.
 * Variante para los backends NestJS que leen la configuración de process.env (sin ConfigService).
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const PROXY_HEADERS = ['x-forwarded-for', 'x-real-ip', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded'];

function sameToken(given: unknown, expected: string) {
  const a = Buffer.from(typeof given === 'string' ? given : '');
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const expected = process.env.INTERNAL_TOKEN;
    const local = LOOPBACK.has(req.socket?.remoteAddress ?? '') && !PROXY_HEADERS.some((h) => req.headers[h]);
    if (!expected || !local) throw new NotFoundException();
    if (!sameToken(req.headers['x-internal-token'], expected)) throw new UnauthorizedException();
    return true;
  }
}
