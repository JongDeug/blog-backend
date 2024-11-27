/*
  Warnings:

  - You are about to alter the column `nextId` on the `Post` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `prevId` on the `Post` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `Post` MODIFY `nextId` INTEGER NULL,
    MODIFY `prevId` INTEGER NULL;
