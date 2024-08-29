/*
  Warnings:

  - Added the required column `draft` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `next` to the `Post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prev` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Post` ADD COLUMN `draft` BOOLEAN NOT NULL,
    ADD COLUMN `next` VARCHAR(191) NOT NULL,
    ADD COLUMN `prev` VARCHAR(191) NOT NULL;
