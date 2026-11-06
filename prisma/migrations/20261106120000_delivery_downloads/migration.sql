-- CreateTable
CREATE TABLE "delivery_downloads" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "user_agent" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_downloads_delivery_id_idx" ON "delivery_downloads"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_downloads_commission_id_requested_at_idx" ON "delivery_downloads"("commission_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_storage_key_key" ON "deliveries"("storage_key");

-- AddForeignKey
ALTER TABLE "delivery_downloads" ADD CONSTRAINT "delivery_downloads_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_downloads" ADD CONSTRAINT "delivery_downloads_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only
CREATE TRIGGER delivery_downloads_append_only BEFORE UPDATE OR DELETE ON "delivery_downloads" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
