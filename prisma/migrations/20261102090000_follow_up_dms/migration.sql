-- CreateTable
CREATE TABLE "follow_up_dms" (
    "id" UUID NOT NULL,
    "commission_id" UUID NOT NULL,
    "agreement_version_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_dms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_dms_commission_id_idx" ON "follow_up_dms"("commission_id");

-- CreateIndex
CREATE INDEX "follow_up_dms_agreement_version_id_idx" ON "follow_up_dms"("agreement_version_id");

-- AddForeignKey
ALTER TABLE "follow_up_dms" ADD CONSTRAINT "follow_up_dms_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "commissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_dms" ADD CONSTRAINT "follow_up_dms_agreement_version_id_fkey" FOREIGN KEY ("agreement_version_id") REFERENCES "agreement_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only
CREATE TRIGGER follow_up_dms_append_only BEFORE UPDATE OR DELETE ON "follow_up_dms" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- The original DM never changes
CREATE FUNCTION forbid_source_dm_change() RETURNS trigger AS $$
BEGIN
  IF NEW.source_dm IS DISTINCT FROM OLD.source_dm THEN
    RAISE EXCEPTION 'commissions.source_dm is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commissions_source_dm_immutable BEFORE UPDATE ON "commissions" FOR EACH ROW EXECUTE FUNCTION forbid_source_dm_change();
