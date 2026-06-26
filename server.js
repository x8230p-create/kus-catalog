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

// ============================================================
// 1. 信任代理设置（Railway 需要）
// ============================================================
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true);
}

// ============================================================
// 2. 中间件
// ============================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ============================================================
// 3. 创建必要目录（Railway 临时文件系统需要）
// ============================================================
const uploadDir = path.join(__dirname, 'public/uploads');
const dbDir = path.join(__dirname, 'db');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('✅ 已创建 uploads 目录');
}
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✅ 已创建 db 目录');
}

// ============================================================
// 4. 速率限制器（关键修复：禁用 trust proxy 验证）
// ============================================================
const limiter = rateLimit({
    windowMs: 60 * 1000,          // 1 分钟窗口
    max: 300,                     // 每个 IP 最多 300 次请求
    validate: { trustProxy: false } // 🔥 禁用 trust proxy 验证，避免 ERR_ERL_PERMISSIVE_TRUST_PROXY
});
app.use('/api/', limiter);

// ============================================================
// 5. 数据库初始化与迁移
// ============================================================
(async () => {
    try {
        const db = await openDb();

        // 执行 init.sql 创建表结构
        const initSqlPath = path.join(__dirname, 'db', 'init.sql');
        if (fs.existsSync(initSqlPath)) {
            const initSql = fs.readFileSync(initSqlPath, 'utf8');
            await db.exec(initSql);
            console.log('✅ 数据库表结构初始化完成');
        } else {
            console.warn('⚠️ init.sql 文件不存在，跳过初始化');
        }

        // ---- 迁移：添加 price_cny 列 ----
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

        // ---- 迁移：添加 images 列 ----
        if (!tableInfo.some(col => col.name === 'images')) {
            await db.run("ALTER TABLE products ADD COLUMN images TEXT");
            console.log('✅ 已添加 images 列');
        }

        // ---- 迁移：添加 img_url_1 列 ----
        if (!tableInfo.some(col => col.name === 'img_url_1')) {
            await db.run("ALTER TABLE products ADD COLUMN img_url_1 TEXT");
            console.log('✅ 已添加 img_url_1 列');
        }

        console.log('✅ 数据库迁移全部完成');
    } catch (err) {
        console.error('❌ 数据库初始化失败:', err.message);
        // 不要退出进程，让服务继续尝试
    }
})();

// ============================================================
// 6. 路由挂载
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/auth-codes', require('./routes/auth_codes'));
app.use('/api/exchange-rate', require('./routes/exchange').router);

// ============================================================
// 7. 全局错误处理
// ============================================================
app.use(require('./middleware/errorHandler'));

// ============================================================
// 8. 启动服务器
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});
