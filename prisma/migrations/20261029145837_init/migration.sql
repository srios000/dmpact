-- CreateEnum
CREATE TYPE "CommissionState" AS ENUM ('draft', 'negotiating', 'agreed', 'dp_paid', 'in_progress', 'delivered', 'fully_paid', 'cancelled');

-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('creator', 'client', 'paypal', 'system');

-- CreateEnum
CREATE TYPE "Party" AS ENUM ('creator', 'client');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('deposit', 'balance');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "creators" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "paypal_email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "state" "CommissionState" NOT NULL DEFAULT 'draft',
    "source_dm" TEXT NOT NULL,
    "client_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_versions" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "created_by" "Actor" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmations" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "agreement_version_id" UUID NOT NULL,
    "party" "Party" NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "paypal_invoice_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "due_date" DATE,
    "pay_link" TEXT,
    "paid_at" TIMESTAMPTZ,
    "last_reminded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_key" TEXT,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "logged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_events" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "from_state" "CommissionState",
    "to_state" "CommissionState",
    "actor" "Actor" NOT NULL,
    "reason" TEXT,
    "meta" JSONB,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "rates" JSONB NOT NULL,
    "mismatch_threshold_pct" INTEGER NOT NULL DEFAULT 20,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creators_auth_user_id_key" ON "creators"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "creators_email_key" ON "creators"("email");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_client_token_key" ON "commissions"("client_token");

-- CreateIndex
CREATE INDEX "commissions_creator_id_state_idx" ON "commissions"("creator_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_versions_commission_id_version_key" ON "agreement_versions"("commission_id", "version");

-- CreateIndex
CREATE INDEX "confirmations_commission_id_idx" ON "confirmations"("commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_agreement_version_id_party_key" ON "confirmations"("agreement_version_id", "party");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paypal_invoice_id_key" ON "invoices"("paypal_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_commission_id_idx" ON "invoices"("commission_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "deliveries_commission_id_idx" ON "deliveries"("commission_id");

-- CreateIndex
CREATE INDEX "commission_events_commission_id_at_idx" ON "commission_events"("commission_id", "at");

-- CreateIndex
CREATE INDEX "change_requests_commission_id_idx" ON "change_requests"("commission_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_creator_id_key" ON "rate_cards"("creator_id");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_agreement_version_id_fkey" FOREIGN KEY ("agreement_version_id") REFERENCES "agreement_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agreement_versions_append_only BEFORE UPDATE OR DELETE ON "agreement_versions" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER confirmations_append_only BEFORE UPDATE OR DELETE ON "confirmations" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER deliveries_append_only BEFORE UPDATE OR DELETE ON "deliveries" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER commission_events_append_only BEFORE UPDATE OR DELETE ON "commission_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
