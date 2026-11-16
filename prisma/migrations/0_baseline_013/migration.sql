-- CreateTable
CREATE TABLE `category_013_tb` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `food_013_tb` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NOT NULL DEFAULT '',
    `price` DECIMAL(10, 2) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,

    INDEX `fk_food_category_013`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_013_tb` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `track_code` CHAR(12) NOT NULL,
    `customer_name` VARCHAR(60) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('pending', 'preparing', 'ready', 'completed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(0) NOT NULL,
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `track_code`(`track_code`),
    INDEX `idx_order_status_009`(`status`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_013_tb` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER UNSIGNED NOT NULL,
    `food_id` INTEGER UNSIGNED NOT NULL,
    `food_name` VARCHAR(100) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,

    INDEX `fk_item_food_013`(`food_id`),
    INDEX `fk_item_order_013`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `food_013_tb` ADD CONSTRAINT `fk_food_category_013` FOREIGN KEY (`category_id`) REFERENCES `category_013_tb`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `order_item_013_tb` ADD CONSTRAINT `fk_item_order_013` FOREIGN KEY (`order_id`) REFERENCES `order_013_tb`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `order_item_013_tb` ADD CONSTRAINT `fk_item_food_013` FOREIGN KEY (`food_id`) REFERENCES `food_013_tb`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

