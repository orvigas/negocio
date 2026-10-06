-- CreateTable
CREATE TABLE "product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "business" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "label" TEXT,
    "price_cents" INTEGER,
    "price_unit" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "image_src" TEXT,
    "image_alt" TEXT,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "tone" TEXT,
    "order_price_cents" INTEGER,
    "order_quantity" INTEGER,
    "icon" TEXT,
    "details_type" TEXT,
    "details_label" TEXT,
    "portion" TEXT,
    "portion_extra" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    CONSTRAINT "product_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_chip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "highlight" BOOLEAN NOT NULL,
    CONSTRAINT "product_chip_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_change" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "at" DATETIME NOT NULL,
    "business" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" INTEGER,
    "actor_name" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    CONSTRAINT "product_change_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_change_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_import" (
    "business" TEXT NOT NULL PRIMARY KEY,
    "imported_at" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "count" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "product_business_category_deleted_position_idx" ON "product"("business", "category", "deleted", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_business_slug_key" ON "product"("business", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_product_id_position_key" ON "product_variant"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_chip_product_id_position_key" ON "product_chip"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_change_business_at_idx" ON "product_change"("business", "at");

-- CreateIndex
CREATE INDEX "product_change_product_id_idx" ON "product_change"("product_id");
