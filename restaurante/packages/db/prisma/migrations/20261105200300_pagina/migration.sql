-- Datos de página (REQ-F-044): versión vigente y anterior, historial y marca de importación. Generada
-- con `prisma migrate dev --create-only` y revisada a mano: Prisma escribe
-- `COLLATE utf8mb4_unicode_ci` en cada CREATE TABLE; aquí es utf8mb4_es_0900_as_cs (D-5 de REQ-F-014).
-- Aditiva: la versión anterior de la app funciona con ella (DATABASE_ALLOW_NEWER_SCHEMA).

-- CreateTable
CREATE TABLE `page_version` (
    `business` ENUM('molotes', 'birria') NOT NULL,
    `slot` ENUM('current', 'previous') NOT NULL,
    `revision` INTEGER NOT NULL,
    `updated_at` VARCHAR(64) NULL,
    `updated_by` VARCHAR(60) NULL,
    `updated_by_id` INTEGER NULL,
    `data` MEDIUMTEXT NOT NULL,

    PRIMARY KEY (`business`, `slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `page_change` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` VARCHAR(64) NULL,
    `business` ENUM('molotes', 'birria') NOT NULL,
    `author` VARCHAR(60) NOT NULL,
    `author_id` INTEGER NULL,
    `action` VARCHAR(32) NOT NULL,
    `changes` MEDIUMTEXT NOT NULL,
    `imported` BOOLEAN NOT NULL DEFAULT false,

    INDEX `page_change_business_id_idx`(`business`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

-- CreateTable
CREATE TABLE `page_import` (
    `business` ENUM('molotes', 'birria') NOT NULL,
    `imported_at` DATETIME(3) NOT NULL,
    `source` VARCHAR(16) NOT NULL,
    `source_version` VARCHAR(96) NOT NULL,
    `history_count` INTEGER NOT NULL,
    `skipped_lines` INTEGER NOT NULL,

    PRIMARY KEY (`business`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
