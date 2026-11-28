-- Recetas multinivel versionadas y costo teórico (REQ-F-050, T2). Generada con `prisma migrate diff`
-- y revisada a mano. Aditiva: la imagen anterior arranca con ella (DATABASE_ALLOW_NEWER_SCHEMA).
-- - Cada CREATE TABLE fija utf8mb4_es_0900_as_cs: Prisma escribe utf8mb4_unicode_ci (D-5 de REQ-F-014).
-- - Los ALTER llevan ALGORITHM=INSTANT: solo cambian metadatos y, si algún día no se pudiera, MySQL
--   falla en lugar de reconstruir la tabla en silencio. `hr` va al final del ENUM (no cambia los
--   valores guardados ni su tamaño); la columna conserva la colación de la tabla. Una imagen de T1
--   no lee una fila en `hr` (C-2: solo en desarrollo; `main` no lee el inventario).

-- AlterTable
ALTER TABLE `inventory_item` MODIFY `base_unit` ENUM('kg', 'g', 'L', 'ml', 'pza', 'hr') NULL, ALGORITHM=INSTANT;

-- AlterTable
ALTER TABLE `inventory_item` ADD COLUMN `reference_cost` DECIMAL(15, 4) NULL,
    ADD COLUMN `inventoriable` BOOLEAN NOT NULL DEFAULT true, ALGORITHM=INSTANT;

-- CreateTable
CREATE TABLE `inventory_recipe_version` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_id` INTEGER NOT NULL,
    `number` INTEGER NOT NULL,
    `yield_quantity` DECIMAL(13, 3) NOT NULL,
    `valid_from` DATETIME(3) NOT NULL,
    `valid_to` DATETIME(3) NULL,
    `current_item_id` INTEGER NULL,
    `note` VARCHAR(400) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `created_by_id` INTEGER NULL,
    `created_by_name` VARCHAR(60) NOT NULL,

    UNIQUE INDEX `inventory_recipe_version_current_item_id_key`(`current_item_id`),
    INDEX `inventory_recipe_version_item_id_valid_from_idx`(`item_id`, `valid_from`),
    UNIQUE INDEX `inventory_recipe_version_item_id_number_key`(`item_id`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_recipe_line` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `version_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `ingredient_item_id` INTEGER NOT NULL,
    `quantity` DECIMAL(13, 3) NOT NULL,
    `unit` VARCHAR(30) NOT NULL,
    `net_base_quantity` DECIMAL(13, 3) NOT NULL,
    `waste_percent` DECIMAL(5, 2) NOT NULL,
    `gross_base_quantity` DECIMAL(13, 3) NOT NULL,
    `note` VARCHAR(200) NULL,

    INDEX `inventory_recipe_line_ingredient_item_id_idx`(`ingredient_item_id`),
    UNIQUE INDEX `inventory_recipe_line_version_id_position_key`(`version_id`, `position`),
    UNIQUE INDEX `inventory_recipe_line_version_id_ingredient_item_id_key`(`version_id`, `ingredient_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `inventory_lock` (
    `name` VARCHAR(32) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- Fila del candado de recetas. El usuario de la app solo hace DML: el upsert del store la recrea si falta.
INSERT INTO `inventory_lock` (`name`) VALUES ('recetas');

-- AddForeignKey
ALTER TABLE `inventory_recipe_version` ADD CONSTRAINT `inventory_recipe_version_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_recipe_version` ADD CONSTRAINT `inventory_recipe_version_current_item_id_fkey` FOREIGN KEY (`current_item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_recipe_version` ADD CONSTRAINT `inventory_recipe_version_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_recipe_line` ADD CONSTRAINT `inventory_recipe_line_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `inventory_recipe_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_recipe_line` ADD CONSTRAINT `inventory_recipe_line_ingredient_item_id_fkey` FOREIGN KEY (`ingredient_item_id`) REFERENCES `inventory_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
