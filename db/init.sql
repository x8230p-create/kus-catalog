-- ============================================
-- 分类表
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    main_cat TEXT NOT NULL,
    sub_cat TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    name_en TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 产品表
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    main_cat TEXT NOT NULL,
    sub_cat TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_mask TEXT DEFAULT '***',
    price_cny DECIMAL(10,2) DEFAULT 0.00,
    price_usd DECIMAL(10,2) DEFAULT 0.00,
    desc_zh TEXT,
    desc_en TEXT,
    detail_zh TEXT,
    detail_en TEXT,
    img_url TEXT,
    img_url_1 TEXT,
    images TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 子 SKU 表
-- ============================================
CREATE TABLE IF NOT EXISTS sub_skus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    unit TEXT NOT NULL,
    price_cny DECIMAL(10,2) DEFAULT 0.00,
    price_usd DECIMAL(10,2) DEFAULT 0.00,
    desc_zh TEXT,
    desc_en TEXT,
    remark_zh TEXT,
    remark_en TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 询价记录表
-- ============================================
CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    product_sku TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 管理员表
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- ============================================
-- 授权码表
-- ============================================
CREATE TABLE IF NOT EXISTS auth_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    used BOOLEAN DEFAULT 0
);

-- ============================================
-- 插入分类数据（二级菜单结构）
-- ============================================
DELETE FROM categories;

INSERT INTO categories (main_cat, sub_cat, name_zh, name_en, sort_order) VALUES
('双光透镜', '2.5寸', '2.5寸', '2.5inch', 1),
('双光透镜', '3.0寸', '3.0寸', '3.0inch', 2),
('LED雾灯', '2.0寸', '2.0寸', '2.0inch', 3),
('LED雾灯', '3.0寸', '3.0寸', '3.0inch', 4),
('LED矩阵', '射灯', '射灯', 'Spotlight', 5),
('LED矩阵', '1.5寸', '1.5寸', '1.5inch', 6),
('LED矩阵', '1.8寸', '1.8寸', '1.8inch', 7),
('恶魔眼DHL', '通用', '恶魔眼DHL', 'Demon Eye DHL', 10),
('改装配件', '通用', '改装配件', 'Accessories', 11),
('装饰罩', '通用', '装饰罩', 'Shroud', 12),
('5D装饰罩', '通用', '5D装饰罩', '5D Shroud', 13),
('解码器', '通用', '解码器', 'Decoder', 14),
('线束和插头', '通用', '线束和插头', 'Harness & Plug', 15),
('防尘罩', '通用', '防尘罩', 'Dust Cover', 16),
('改装工具', '通用', '改装工具', 'Tools', 17);

-- ============================================
-- 插入默认管理员（密码：KUS3364）
-- ============================================
INSERT OR IGNORE INTO admins (username, password_hash) 
VALUES ('admin', '$2a$10$dummyHashForKUS3364WillBeReplacedByScript');

-- ============================================
-- 插入示例产品（价格改为人民币）
-- ============================================
INSERT OR IGNORE INTO products (sku, main_cat, sub_cat, unit, price_mask, price_cny, desc_zh, desc_en, detail_zh, detail_en, img_url, img_url_1) VALUES
('KUS-2.5LED-A01', '双光透镜', '2.5寸', '对', '***', 250.00, '2.5寸矩阵模组LED双光透镜', '2.5inch Matrix LED Bi-Lens', '功率60W，色温6000K', 'Power 60W, 6000K', '/uploads/1.jpg', '/uploads/2.jpg'),
('KUS-3.0LED-B2', '双光透镜', '3.0寸', '对', '***', 340.00, '3.0寸双光透镜，12芯片', '3.0inch Bi-LED Lens', '5500K，15000lux', '5500K, 15000lux', '/uploads/3.jpg', ''),
('KUS-FOG-2.0', 'LED雾灯', '2.0寸', '对', '***', 155.00, '2.0寸LED雾灯', '2.0inch LED Fog Light', 'IP67防水', 'IP67 waterproof', '/uploads/4.jpg', ''),
('KUS-MATRIX-SPOT', 'LED矩阵', '射灯', '个', '***', 126.00, '矩阵射灯模组', 'Matrix Spotlight', '聚光型', 'Spot beam', '', ''),
('KUS-MATRIX-1.5', 'LED矩阵', '1.5寸', '个', '***', 175.00, '1.5寸矩阵透镜', '1.5inch Matrix Lens', '广角', 'Wide angle', '', '');

-- ============================================
-- 插入示例子 SKU（价格改为人民币）
-- ============================================
INSERT OR IGNORE INTO sub_skus (product_id, sku, unit, price_cny, desc_zh, desc_en, remark_zh, remark_en, sort_order)
SELECT id, 'KUS-2.5LED-A01-L', '对', 250.00, '左驾版，近光截止线左低右高', 'LHD version, cutoff left low right high', '左驾 (LHD)', 'Left (LHD)', 1
FROM products WHERE sku = 'KUS-2.5LED-A01';

INSERT OR IGNORE INTO sub_skus (product_id, sku, unit, price_cny, desc_zh, desc_en, remark_zh, remark_en, sort_order)
SELECT id, 'KUS-2.5LED-A01-R', '对', 250.00, '右驾版，近光截止线右低左高', 'RHD version, cutoff right low left high', '右驾 (RHD)', 'Right (RHD)', 2
FROM products WHERE sku = 'KUS-2.5LED-A01';