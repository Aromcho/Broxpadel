import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config';

export type AuthUser = { id: number; email: string; name: string; role: 'admin' | 'editor' };
export const ROLES = 'roles';
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES, roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as AuthUser);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[config.cookieName] ?? (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) throw new UnauthorizedException('Iniciá sesión');
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token, { secret: config.jwtSecret });
    } catch {
      throw new UnauthorizedException('Sesión vencida');
    }
    const roles = this.reflector.getAllAndOverride<AuthUser['role'][]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException('No tenés permiso para esto');
    return true;
  }
}
