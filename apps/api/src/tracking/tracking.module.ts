import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config';
import { AuthGuard } from '../auth/auth.guard';
import { CatalogService } from '../store/catalog.service';
import { TrackingService } from './tracking.service';
import { AdminTrackingController, FeedController, TrackingController } from './tracking.controller';

/** Píxel de Meta (API de conversiones), catálogo de productos y su pantalla en el panel (/admin/medicion). */
@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret })],
  controllers: [TrackingController, FeedController, AdminTrackingController],
  providers: [TrackingService, CatalogService, AuthGuard],
  exports: [TrackingService],
})
export class TrackingModule {}
