/*
  Warnings:

  - A unique constraint covering the columns `[providerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `providerId` VARCHAR(191) NULL,
    MODIFY `password` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_providerId_key` ON `User`(`providerId`);
