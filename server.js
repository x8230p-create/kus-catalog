require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { openDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件（无 trust proxy）
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 创建目录
const uploadDir = path.join(__dirname, 'public/uploads');
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// 速率限制器（无 validate）
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300
});
app.use('/api/', limiter);

// 数据库初始化
(async () => {
    try {
        const db = await openDb();
        const initSql = fs.readFileSync('./db/init.sql', 'utf8');
        await db.exec(initSql);
        console.log('数据库表结构初始化完成');

        const tableInfo = await db.all("PRAGMA table_info(products)");
        if (!tableInfo.some(col => col.name === 'price_cny')) {
            await db.run("ALTER TABLE products ADD COLUMN price_cny DECIMAL(10,2) DEFAULT 0.00");
            console.log('✅ 已添加 price_cny 列到 products');
        }
        const subTableInfo = await db.all("PRAGMA table_info(sub_skus)");
        if (!subTableInfo.some(col => col.name === 'price_cny')) {
            await db.run("ALTER TABLE sub_skus ADD COLUMN price_cny DECIMAL(10,2) DEFAULT 0.00");
            console.log('✅ 已添加 price_cny 列到 sub_skus');
        }
        if (!tableInfo.some(col => col.name === 'images')) {
            await db.run("ALTER TABLE products ADD COLUMN images TEXT");
            console.log('✅ 已添加 images 列');
        }
        if (!tableInfo.some(col => col.name === 'img_url_1')) {
            await db.run("ALTER TABLE products ADD COLUMN img_url_1 TEXT");
            console.log('✅ 已添加 img_url_1 列');
        }
        console.log('数据库迁移完成');
    } catch (err) {
        console.error('数据库初始化失败:', err);
    }
})();

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/auth-codes', require('./routes/auth_codes'));
app.use('/api/exchange-rate', require('./routes/exchange').router);
app.use(require('./middleware/errorHandler'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
