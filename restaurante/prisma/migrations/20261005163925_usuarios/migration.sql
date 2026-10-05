-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "username_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_login_at" DATETIME
);

-- CreateTable
CREATE TABLE "user_business" (
    "user_id" INTEGER NOT NULL,
    "business" TEXT NOT NULL,

    PRIMARY KEY ("user_id", "business"),
    CONSTRAINT "user_business_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_audit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actor_id" INTEGER,
    "actor_kind" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "changes" TEXT,
    CONSTRAINT "user_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_audit_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key_key" ON "user"("username_key");

-- CreateIndex
CREATE INDEX "user_audit_target_id_idx" ON "user_audit"("target_id");
