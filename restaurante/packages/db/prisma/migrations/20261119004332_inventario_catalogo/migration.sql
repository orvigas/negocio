-- Catálogo de inventario (REQ-F-049, T1): categorías, artículos, unidades de empaque, registro de
-- SKU e historial. Generada con `prisma migrate dev --create-only` y revisada a mano: Prisma escribe
-- `COLLATE utf8mb4_unicode_ci` en cada CREATE TABLE; aquí es utf8mb4_es_0900_as_cs (D-5 de REQ-F-014).
-- Aditiva: solo crea tablas nuevas (sus claves foráneas apuntan a ellas o a `user`, sin cambiarla).
-- La versión anterior de la app funciona con ella (DATABASE_ALLOW_NEWER_SCHEMA).

-- CreateTable
CREATE TABLE `inventory_category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `name_key` VARCHAR(120) NOT NULL,
    `active_name_key` VARCHAR(120) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_category_active_name_key_key`(`active_name_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('simple', 'parent', 'variant') NOT NULL,
    `type` ENUM('insumo', 'intermedio', 'compuesto', 'reventa') NOT NULL,
    `parent_id` INTEGER NULL,
    `category_id` INTEGER NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `name_key` VARCHAR(160) NOT NULL,
    `active_name_key` VARCHAR(160) NULL,
    `description` VARCHAR(400) NULL,
    `sku` VARCHAR(40) NULL,
    `base_unit` ENUM('kg', 'g', 'L', 'ml', 'pza') NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` INTEGER NULL,
    `updated_by_name` VARCHAR(60) NULL,

    UNIQUE INDEX `inventory_item_active_name_key_key`(`active_name_key`),
    INDEX `inventory_item_active_type_idx`(`active`, `type`),
    INDEX `inventory_item_category_id_active_idx`(`category_id`, `active`),
    INDEX `inventory_item_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_item_unit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `name_key` VARCHAR(60) NOT NULL,
    `factor` DECIMAL(13, 3) NOT NULL,

    UNIQUE INDEX `inventory_item_unit_item_id_name_key_key`(`item_id`, `name_key`),
    UNIQUE INDEX `inventory_item_unit_item_id_position_key`(`item_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_sku` (
    `sku_key` VARCHAR(40) NOT NULL,
    `item_id` INTEGER NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL,

    INDEX `inventory_sku_item_id_idx`(`item_id`),
    PRIMARY KEY (`sku_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_change` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL,
    `entity` VARCHAR(16) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_name` VARCHAR(60) NOT NULL,
    `changes` MEDIUMTEXT NOT NULL,

    INDEX `inventory_change_entity_entity_id_id_idx`(`entity`, `entity_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- AddForeignKey
ALTER TABLE `inventory_item` ADD CONSTRAINT `inventory_item_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_item` ADD CONSTRAINT `inventory_item_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `inventory_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_item_unit` ADD CONSTRAINT `inventory_item_unit_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_sku` ADD CONSTRAINT `inventory_sku_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_change` ADD CONSTRAINT `inventory_change_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
