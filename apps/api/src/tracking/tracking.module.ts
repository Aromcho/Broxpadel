import { Module } from '@nestjs/common';
import { CatalogService } from '../store/catalog.service';
import { TrackingService } from './tracking.service';
import { FeedController, TrackingController } from './tracking.controller';

/** Píxel de Meta (API de conversiones) y catálogo de productos. */
@Module({
  controllers: [TrackingController, FeedController],
  providers: [TrackingService, CatalogService],
  exports: [TrackingService],
})
export class TrackingModule {}
