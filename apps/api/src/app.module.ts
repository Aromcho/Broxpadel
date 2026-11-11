import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from './db/db';
import { config } from './config';
import { CommonModule } from './common/common.module';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { MediaService } from './media/media.service';
import { CatalogService } from './store/catalog.service';
import { StoreController } from './store/store.controller';
import { PricingService } from './orders/pricing.service';
import { OrdersService } from './orders/orders.service';
import { MailService } from './mail/mail.service';
import { MercadoPagoService } from './payments/mercadopago.service';
import { PaymentsController } from './payments/payments.controller';
import { AdminProductsController } from './admin/products.controller';
import { AdminMediaController, AdminOrdersController, AdminDashboardController, AdminBusinessController, AdminUsersController } from './admin/misc.controllers';
import { CategoriesCrud, CollectionsCrud, StoriesCrud, StoryItemsCrud, BannersCrud, CouponsCrud, ZonesCrud, SizeGuidesCrud } from './admin/admin.controllers';

@Controller('health')
class HealthController {
  @Get()
  async health() {
    await db.execute(sql`select 1`);
    return { ok: true, time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    CommonModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    JwtModule.register({ secret: config.jwtSecret }),
  ],
  controllers: [
    HealthController, AuthController, StoreController, PaymentsController,
    AdminProductsController, AdminMediaController, AdminOrdersController, AdminDashboardController, AdminBusinessController, AdminUsersController,
    CategoriesCrud, CollectionsCrud, StoriesCrud, StoryItemsCrud, BannersCrud, CouponsCrud, ZonesCrud, SizeGuidesCrud,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AuthGuard, MediaService, CatalogService, PricingService, OrdersService, MailService, MercadoPagoService,
  ],
})
export class AppModule {}
