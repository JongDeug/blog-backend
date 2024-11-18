/*
  Warnings:

  - You are about to alter the column `guestId` on the `Comment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the column `email` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `nickName` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Guest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_guestId_fkey`;

-- AlterTable
ALTER TABLE `Comment` MODIFY `guestId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Guest` DROP COLUMN `email`,
    DROP COLUMN `nickName`,
    DROP COLUMN `password`;

-- CreateTable
CREATE TABLE `GuestComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nickName` VARCHAR(100) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `password` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `GuestComment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
