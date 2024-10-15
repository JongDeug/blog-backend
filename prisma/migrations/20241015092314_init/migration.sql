/*
  Warnings:

  - You are about to drop the column `next` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `prev` on the `Post` table. All the data in the column will be lost.
  - You are about to alter the column `role` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Enum(EnumId(0))`.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Category` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Comment` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `GuestComment` MODIFY `password` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `Image` MODIFY `url` VARCHAR(500) NOT NULL;

-- AlterTable
ALTER TABLE `Post` DROP COLUMN `next`,
    DROP COLUMN `prev`,
    ADD COLUMN `nextId` VARCHAR(191) NULL,
    ADD COLUMN `prevId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PostLike` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `User` MODIFY `password` VARCHAR(255) NOT NULL,
    MODIFY `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER';
