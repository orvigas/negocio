-- Rol Gerente (REQ-F-049, T1, RF-9): valor nuevo al final del ENUM `user.role`. Revisada a mano.
-- Aditiva: añadir un valor al final de un ENUM no cambia los valores guardados ni su orden, y MySQL lo
-- aplica sin reconstruir la tabla. La columna conserva la colación de la tabla (utf8mb4_es_0900_as_cs).
-- La versión anterior de la app arranca con ella (DATABASE_ALLOW_NEWER_SCHEMA) mientras no haya
-- gerentes; con gerentes, ver el procedimiento de vuelta atrás a mano de despliegue.md (DT-2).

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('admin', 'editor', 'gerente') NOT NULL;
