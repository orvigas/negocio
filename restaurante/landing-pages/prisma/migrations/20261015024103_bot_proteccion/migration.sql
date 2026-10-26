-- Protección del bot (REQ-F-025): lista negra seudonimizada, auditoría, contadores globales e
-- interruptor. Generada con `prisma migrate dev --create-only` y revisada a mano: Prisma escribe
-- `COLLATE utf8mb4_unicode_ci` en cada CREATE TABLE; aquí es utf8mb4_es_0900_as_cs (D-5 de REQ-F-014).
-- Aditiva: la versión anterior de la app funciona con ella (DATABASE_ALLOW_NEWER_SCHEMA).

-- CreateTable
CREATE TABLE `bot_block` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phone_hash` CHAR(64) NOT NULL,
    `key_id` CHAR(8) NOT NULL,
    `last4` CHAR(4) NOT NULL,
    `origin` ENUM('manual', 'tope', 'repeticion') NOT NULL,
    `reason` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NULL,
    `created_by_id` INTEGER NULL,
    `created_by_name` VARCHAR(60) NULL,
    `removed_at` DATETIME(3) NULL,
    `removed_by_id` INTEGER NULL,
    `removed_by_name` VARCHAR(60) NULL,
    `expiry_audited_at` DATETIME(3) NULL,

    INDEX `bot_block_phone_hash_idx`(`phone_hash`),
    INDEX `bot_block_expires_at_idx`(`expires_at`),
    INDEX `bot_block_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `bot_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(3) NOT NULL,
    `action` VARCHAR(32) NOT NULL,
    `actor_id` INTEGER NULL,
    `actor_kind` VARCHAR(16) NOT NULL,
    `actor_name` VARCHAR(60) NULL,
    `masked` VARCHAR(20) NULL,
    `origin` VARCHAR(16) NULL,
    `reason` VARCHAR(200) NULL,
    `details` VARCHAR(200) NULL,

    INDEX `bot_audit_at_idx`(`at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `bot_usage` (
    `period_type` VARCHAR(8) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `templates` INTEGER NOT NULL DEFAULT 0,
    `outbound` INTEGER NOT NULL DEFAULT 0,
    `templates_capped_at` DATETIME(3) NULL,
    `outbound_capped_at` DATETIME(3) NULL,
    `budget_capped_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`period_type`, `period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `bot_control` (
    `id` INTEGER NOT NULL,
    `paused` BOOLEAN NOT NULL,
    `changed_at` DATETIME(3) NOT NULL,
    `changed_by_id` INTEGER NULL,
    `changed_by_name` VARCHAR(60) NULL,
    `reason` VARCHAR(200) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- AddForeignKey
ALTER TABLE `bot_block` ADD CONSTRAINT `bot_block_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bot_block` ADD CONSTRAINT `bot_block_removed_by_id_fkey` FOREIGN KEY (`removed_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bot_audit` ADD CONSTRAINT `bot_audit_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bot_control` ADD CONSTRAINT `bot_control_changed_by_id_fkey` FOREIGN KEY (`changed_by_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
