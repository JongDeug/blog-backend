-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_guestId_fkey`;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `GuestComment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
