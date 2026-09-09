-- Envio manual de documentos (comprobantes, boletas, cotizaciones) desde el
-- panel: el envio queda registrado con sus adjuntos para poder reenviarlo.
CREATE TABLE IF NOT EXISTS "DocumentEmail" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT[],
    "sentBy" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentEmailFile" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEmailFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentEmail_createdAt_idx" ON "DocumentEmail"("createdAt");
CREATE INDEX IF NOT EXISTS "DocumentEmailFile_emailId_idx" ON "DocumentEmailFile"("emailId");

ALTER TABLE "DocumentEmailFile" DROP CONSTRAINT IF EXISTS "DocumentEmailFile_emailId_fkey";
ALTER TABLE "DocumentEmailFile" ADD CONSTRAINT "DocumentEmailFile_emailId_fkey"
    FOREIGN KEY ("emailId") REFERENCES "DocumentEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
