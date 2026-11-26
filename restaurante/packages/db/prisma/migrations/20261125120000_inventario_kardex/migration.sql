-- Kardex, existencias y proveedores (REQ-F-051, T3). Generada con `prisma migrate diff` y revisada a
-- mano. Aditiva: solo crea tablas; la imagen anterior arranca con ella (DATABASE_ALLOW_NEWER_SCHEMA).
-- - Cada CREATE TABLE fija utf8mb4_es_0900_as_cs: Prisma escribe utf8mb4_unicode_ci (D-5 de REQ-F-014).
-- - Tipos, criterio de costo y motivos en VARCHAR con la lista cerrada en core (DT-T3-1 y DT-15): una
--   imagen anterior lee un valor nuevo sin fallar.
-- - Documentos y movimientos son inmutables (DT-5): solo los inserta core; `inventory:verify` comprueba
--   la cadena.
-- - Al final, escrito a mano: la fila de existencia de cada artículo que no es padre (DT-T3-2). En
--   producción no hay artículos hasta la importación A5, así que no inserta nada.
-- CreateTable
CREATE TABLE `inventory_supplier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `name_key` VARCHAR(160) NOT NULL,
    `active_name_key` VARCHAR(160) NULL,
    `contact` VARCHAR(120) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` INTEGER NULL,
    `updated_by_name` VARCHAR(60) NULL,

    UNIQUE INDEX `inventory_supplier_active_name_key_key`(`active_name_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_stock` (
    `item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(13, 3) NOT NULL DEFAULT 0,
    `avg_cost` DECIMAL(15, 4) NULL,
    `last_cost` DECIMAL(15, 4) NULL,
    `last_seq` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(24) NOT NULL,
    `occurred_on` DATE NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `supplier_id` INTEGER NULL,
    `reference` VARCHAR(40) NULL,
    `cost_basis` VARCHAR(16) NULL,
    `reason` VARCHAR(32) NULL,
    `note` VARCHAR(400) NULL,
    `total_cost` DECIMAL(19, 4) NOT NULL,
    `reverses_document_id` INTEGER NULL,
    `source_document_id` INTEGER NULL,
    `idempotency_key` VARCHAR(120) NULL,
    `request_hash` CHAR(64) NULL,
    `actor_id` INTEGER NULL,
    `actor_name` VARCHAR(60) NOT NULL,

    UNIQUE INDEX `inventory_document_reverses_document_id_key`(`reverses_document_id`),
    UNIQUE INDEX `inventory_document_idempotency_key_key`(`idempotency_key`),
    INDEX `inventory_document_type_id_idx`(`type`, `id`),
    INDEX `inventory_document_supplier_id_id_idx`(`supplier_id`, `id`),
    INDEX `inventory_document_source_document_id_idx`(`source_document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_movement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `document_id` INTEGER NOT NULL,
    `line` INTEGER NOT NULL,
    `item_id` INTEGER NOT NULL,
    `seq` INTEGER NOT NULL,
    `type` VARCHAR(24) NOT NULL,
    `quantity` DECIMAL(13, 3) NOT NULL,
    `entered_quantity` DECIMAL(13, 3) NOT NULL,
    `entered_unit` VARCHAR(30) NOT NULL,
    `balance_before` DECIMAL(13, 3) NOT NULL,
    `balance_after` DECIMAL(13, 3) NOT NULL,
    `unit_cost` DECIMAL(15, 4) NULL,
    `line_total` DECIMAL(19, 4) NULL,
    `avg_cost_before` DECIMAL(15, 4) NULL,
    `avg_cost_after` DECIMAL(15, 4) NULL,
    `source_movement_id` INTEGER NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_name` VARCHAR(60) NOT NULL,

    INDEX `inventory_movement_source_movement_id_idx`(`source_movement_id`),
    UNIQUE INDEX `inventory_movement_item_id_seq_key`(`item_id`, `seq`),
    UNIQUE INDEX `inventory_movement_document_id_line_key`(`document_id`, `line`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- AddForeignKey
ALTER TABLE `inventory_stock` ADD CONSTRAINT `inventory_stock_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_document` ADD CONSTRAINT `inventory_document_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `inventory_supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_document` ADD CONSTRAINT `inventory_document_reverses_document_id_fkey` FOREIGN KEY (`reverses_document_id`) REFERENCES `inventory_document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_document` ADD CONSTRAINT `inventory_document_source_document_id_fkey` FOREIGN KEY (`source_document_id`) REFERENCES `inventory_document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_document` ADD CONSTRAINT `inventory_document_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movement` ADD CONSTRAINT `inventory_movement_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `inventory_document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movement` ADD CONSTRAINT `inventory_movement_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movement` ADD CONSTRAINT `inventory_movement_source_movement_id_fkey` FOREIGN KEY (`source_movement_id`) REFERENCES `inventory_movement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movement` ADD CONSTRAINT `inventory_movement_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existencias de los artículos que ya existen (DT-T3-2): 0 y sin costo.
INSERT INTO `inventory_stock` (`item_id`, `updated_at`)
    SELECT `id`, CURRENT_TIMESTAMP(3) FROM `inventory_item` WHERE `kind` <> 'parent';
