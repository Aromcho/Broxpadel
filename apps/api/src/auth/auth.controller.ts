import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/db';
import { config } from '../config';
import { parse } from '../common/zod';
import { AuthGuard, AuthUser, CurrentUser } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private jwt: JwtService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), body);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    if (!u || !u.active || !(await bcrypt.compare(password, u.passwordHash))) throw new UnauthorizedException('Email o contraseña incorrectos');
    const payload: AuthUser = { id: u.id, email: u.email, name: u.name, role: u.role };
    const token = await this.jwt.signAsync(payload, { secret: config.jwtSecret, expiresIn: '7d' });
    res.cookie(config.cookieName, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: 7 * 864e5 });
    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
    return { user: payload };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
