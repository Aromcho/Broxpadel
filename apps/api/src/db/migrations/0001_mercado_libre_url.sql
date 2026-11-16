ALTER TABLE "business" ADD COLUMN "mercado_libre_url" varchar(300);--> statement-breakpoint
UPDATE "business" SET "mercado_libre_url" = 'https://listado.mercadolibre.com.ar/_CustId_9529578' WHERE "id" = 1 AND "mercado_libre_url" IS NULL;
