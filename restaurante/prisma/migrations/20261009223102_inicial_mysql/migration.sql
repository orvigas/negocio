-- Migración inicial de MySQL (REQ-F-014), generada con `prisma migrate dev --create-only` y revisada a mano:
-- Prisma escribe `COLLATE utf8mb4_unicode_ci` en cada CREATE TABLE; aquí es utf8mb4_es_0900_as_cs (D-5).

-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(60) NOT NULL,
    `username_key` VARCHAR(128) NOT NULL,
    `display_name` VARCHAR(60) NOT NULL,
    `role` ENUM('admin', 'editor') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `password_hash` VARCHAR(255) NOT NULL,
    `session_version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_login_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_username_key_key`(`username_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `user_business` (
    `user_id` INTEGER NOT NULL,
    `business` ENUM('molotes', 'birria') NOT NULL,

    PRIMARY KEY (`user_id`, `business`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `user_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `action` VARCHAR(32) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_kind` VARCHAR(16) NOT NULL,
    `target_id` INTEGER NOT NULL,
    `changes` MEDIUMTEXT NULL,

    INDEX `user_audit_target_id_idx`(`target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business` ENUM('molotes', 'birria') NOT NULL,
    `category` ENUM('platillo', 'bebida') NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(400) NULL,
    `label` VARCHAR(40) NULL,
    `price_cents` INTEGER NULL,
    `price_unit` VARCHAR(40) NULL,
    `available` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL,
    `image_src` VARCHAR(255) NULL,
    `image_alt` VARCHAR(150) NULL,
    `image_width` INTEGER NULL,
    `image_height` INTEGER NULL,
    `tone` VARCHAR(20) NULL,
    `order_price_cents` INTEGER NULL,
    `order_quantity` INTEGER NULL,
    `icon` VARCHAR(40) NULL,
    `details_type` ENUM('chips', 'portion', 'variants') NULL,
    `details_label` VARCHAR(40) NULL,
    `portion` VARCHAR(40) NULL,
    `portion_extra` VARCHAR(40) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,

    INDEX `product_business_category_deleted_position_idx`(`business`, `category`, `deleted`, `position`),
    UNIQUE INDEX `product_business_slug_key`(`business`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `product_variant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `label` VARCHAR(40) NOT NULL,
    `price_cents` INTEGER NOT NULL,
    `description` VARCHAR(400) NOT NULL,
    `available` BOOLEAN NOT NULL,

    UNIQUE INDEX `product_variant_product_id_position_key`(`product_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `product_chip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `text` VARCHAR(40) NOT NULL,
    `highlight` BOOLEAN NOT NULL,

    UNIQUE INDEX `product_chip_product_id_position_key`(`product_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `product_change` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL,
    `business` ENUM('molotes', 'birria') NOT NULL,
    `product_id` INTEGER NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_name` VARCHAR(60) NOT NULL,
    `changes` MEDIUMTEXT NOT NULL,

    INDEX `product_change_business_at_idx`(`business`, `at`),
    INDEX `product_change_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `product_import` (
    `business` ENUM('molotes', 'birria') NOT NULL,
    `imported_at` DATETIME(3) NOT NULL,
    `source` VARCHAR(16) NOT NULL,
    `count` INTEGER NOT NULL,

    PRIMARY KEY (`business`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- AddForeignKey
ALTER TABLE `user_business` ADD CONSTRAINT `user_business_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_audit` ADD CONSTRAINT `user_audit_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_audit` ADD CONSTRAINT `user_audit_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variant` ADD CONSTRAINT `product_variant_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_chip` ADD CONSTRAINT `product_chip_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_change` ADD CONSTRAINT `product_change_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_change` ADD CONSTRAINT `product_change_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
