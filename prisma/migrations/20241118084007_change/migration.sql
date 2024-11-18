/*
  Warnings:

  - Added the required column `guestId` to the `GuestComment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `GuestComment` ADD COLUMN `guestId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `GuestComment` ADD CONSTRAINT `GuestComment_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`guestId`) ON DELETE RESTRICT ON UPDATE CASCADE;
