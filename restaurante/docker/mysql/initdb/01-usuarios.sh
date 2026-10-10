#!/bin/sh
# Bases y usuarios del MySQL local (REQ-F-014). Lo ejecuta la imagen oficial solo al crear el
# volumen (primer arranque). Solo desarrollo y pruebas: en producción los crea REQ-F-016.
#
# - restaurante           base de desarrollo (utf8mb4 + utf8mb4_es_0900_as_cs)
# - restaurante_app       la app: solo DML sobre restaurante.*
# - restaurante_migrator  migraciones: DDL sobre restaurante.* y la base sombra de `migrate dev`
# - restaurante_test_app  la app en las pruebas: solo DML sobre las bases restaurante_test_*
# - restaurante_test_admin soporte de pruebas: crea, migra, vacía y borra restaurante_test_*
set -eu

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS restaurante CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;
CREATE DATABASE IF NOT EXISTS restaurante_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;

CREATE USER 'restaurante_app'@'%' IDENTIFIED BY '${RESTAURANTE_DB_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON restaurante.* TO 'restaurante_app'@'%';

CREATE USER 'restaurante_migrator'@'%' IDENTIFIED BY '${RESTAURANTE_DB_MIGRATOR_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON restaurante.* TO 'restaurante_migrator'@'%';
GRANT ALL PRIVILEGES ON restaurante_shadow.* TO 'restaurante_migrator'@'%';

CREATE USER 'restaurante_test_app'@'%' IDENTIFIED BY '${RESTAURANTE_DB_TEST_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`restaurante\\_test\\_%\`.* TO 'restaurante_test_app'@'%';

CREATE USER 'restaurante_test_admin'@'%' IDENTIFIED BY '${RESTAURANTE_DB_TEST_PASSWORD}';
GRANT ALL PRIVILEGES ON \`restaurante\\_test\\_%\`.* TO 'restaurante_test_admin'@'%';
SQL
