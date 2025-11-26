-- AlterTable
ALTER TABLE "product" ADD COLUMN     "cest_code" TEXT,
ADD COLUMN     "cest_description" TEXT,
ADD COLUMN     "cest_id" INTEGER,
ADD COLUMN     "cest_parent_id" INTEGER,
ADD COLUMN     "cosmos_created_at" TIMESTAMP(3),
ADD COLUMN     "cosmos_raw" JSONB,
ADD COLUMN     "cosmos_updated_at" TIMESTAMP(3),
ADD COLUMN     "gpc_english_description" TEXT,
ADD COLUMN     "gpc_portuguese_description" TEXT,
ADD COLUMN     "gtin_details" JSONB;
