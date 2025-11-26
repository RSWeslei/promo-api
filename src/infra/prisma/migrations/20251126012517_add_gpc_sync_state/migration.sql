-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "manufacturer" TEXT,
    "origin_country" TEXT,
    "quantity_label" TEXT,
    "package_quantity" INTEGER,
    "package_unit" TEXT,
    "net_weight" DOUBLE PRECISION,
    "net_weight_unit" TEXT,
    "volume" DOUBLE PRECISION,
    "volume_unit" TEXT,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "gross_weight" DOUBLE PRECISION,
    "price" TEXT,
    "price_min" DOUBLE PRECISION,
    "price_max" DOUBLE PRECISION,
    "price_avg" DOUBLE PRECISION,
    "gpc_code" TEXT,
    "gpc_description" TEXT,
    "ncm_code" TEXT,
    "ncm_description" TEXT,
    "ncm_full_description" TEXT,
    "ncm_ex" TEXT,
    "external_category_id" INTEGER,
    "external_category_parent_id" INTEGER,
    "external_category_name" TEXT,
    "release_date" TIMESTAMP(3),
    "image_url" TEXT,
    "additional_images" JSONB,
    "brand_image_url" TEXT,
    "barcode_image_url" TEXT,
    "ingredients" TEXT,
    "allergens" TEXT,
    "is_vegan" BOOLEAN,
    "is_vegetarian" BOOLEAN,
    "is_gluten_free" BOOLEAN,
    "tags" JSONB,
    "source" TEXT,
    "external_id" TEXT,
    "external_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "sort_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gpc_sync_state" (
    "id" TEXT NOT NULL,
    "gpc_code" TEXT NOT NULL,
    "last_page" INTEGER,
    "next_page" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpc_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_key" ON "product"("barcode");

-- CreateIndex
CREATE INDEX "product_image_product_id_idx" ON "product_image"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "gpc_sync_state_gpc_code_key" ON "gpc_sync_state"("gpc_code");

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
