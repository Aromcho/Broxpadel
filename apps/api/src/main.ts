import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { config, mediaDir } from './config';
import { RevalidateService } from './common/revalidate.service';

async function bootstrap() {
  mkdirSync(mediaDir, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: [config.publicUrl], credentials: true });
  // archivos subidos: en producción los sirve Nginx directo desde storage/media
  app.useStaticAssets(mediaDir, { prefix: '/media/', maxAge: '30d', immutable: true, index: false });
  app.enableShutdownHooks();
  await app.listen(config.port, process.env.API_HOST ?? '127.0.0.1');
  console.log(`API Brox lista en http://localhost:${config.port}/api`);
  // la tienda cachea datos (p. ej. si Mercado Pago está activo): al arrancar con otra config, que se refresque
  const reval = app.get(RevalidateService);
  setTimeout(() => void reval.tags('catalog', 'products'), 3000);
}
bootstrap();
