-- AlterTable
ALTER TABLE "rol" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "atiendeTicketsCsh" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "atiendeTicketsMkt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "traslado" ADD COLUMN     "mail" VARCHAR(100),
ADD COLUMN     "mail_escuela" VARCHAR(100),
ADD COLUMN     "tel_movil" VARCHAR(20),
ADD COLUMN     "telefono" VARCHAR(20);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "alias" VARCHAR(50);
