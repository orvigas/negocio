#!/bin/sh
# Base y usuarios del MySQL de producción (REQ-F-016, RF-1). Lo ejecuta la imagen oficial solo al
# crear el volumen (primer arranque); después no vuelve a correr. Las contraseñas llegan por el
# entorno del contenedor (compose.prod.yaml, desde /opt/restaurante/.env) y deben ser hexadecimales
# (openssl rand -hex 32): así no hace falta escaparlas en SQL ni codificarlas en las URL.
#
# - restaurante           base en utf8mb4 con utf8mb4_es_0900_as_cs
# - restaurante_app       la app: solo DML
# - restaurante_migrator  migraciones (imagen migrate): DML y DDL, sin base sombra
# - restaurante_backup    volcados (deploy.sh): solo lectura
set -eu

for name in RESTAURANTE_DB_APP_PASSWORD RESTAURANTE_DB_MIGRATOR_PASSWORD RESTAURANTE_DB_BACKUP_PASSWORD; do
  eval "value=\${$name:-}"
  # shellcheck disable=SC2154 # value la define el eval anterior.
  if ! printf '%s' "$value" | grep -Eq '^[0-9a-f]{32,128}$'; then
    echo "01-usuarios.sh: $name debe ser hexadecimal en minúsculas (32 a 128 caracteres; openssl rand -hex 32)" >&2
    exit 1
  fi
done

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS restaurante CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE USER 'restaurante_app'@'%' IDENTIFIED BY '${RESTAURANTE_DB_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON restaurante.* TO 'restaurante_app'@'%';

CREATE USER 'restaurante_migrator'@'%' IDENTIFIED BY '${RESTAURANTE_DB_MIGRATOR_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON restaurante.* TO 'restaurante_migrator'@'%';

CREATE USER 'restaurante_backup'@'%' IDENTIFIED BY '${RESTAURANTE_DB_BACKUP_PASSWORD}';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES ON restaurante.* TO 'restaurante_backup'@'%';
SQL
