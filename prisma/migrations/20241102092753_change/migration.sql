/*
  Warnings:

  - The primary key for the `PostLike` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `GuestComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuestLike` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_guestId_fkey`;

-- DropForeignKey
ALTER TABLE `PostLike` DROP FOREIGN KEY `PostLike_guestId_fkey`;

-- AlterTable
ALTER TABLE `Comment` MODIFY `guestId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PostLike` DROP PRIMARY KEY,
    MODIFY `guestId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`postId`, `guestId`);

-- DropTable
DROP TABLE `GuestComment`;

-- DropTable
DROP TABLE `GuestLike`;

-- CreateTable
CREATE TABLE `Guest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guestId` VARCHAR(191) NOT NULL,
    `nickName` VARCHAR(100) NULL,
    `email` VARCHAR(200) NULL,
    `password` VARCHAR(255) NULL,

    UNIQUE INDEX `Guest_guestId_key`(`guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`guestId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostLike` ADD CONSTRAINT `PostLike_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`guestId`) ON DELETE RESTRICT ON UPDATE CASCADE;
