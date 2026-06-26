const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { openDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { getExchangeRate } = require('./exchange');
const router = express.Router();

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function applyPriceVisibility(products, req) {
    const authHeader = req.headers.authorization;
    let showPrice = false;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.isAdmin || decoded.authorized) showPrice = true;
        } catch (e) {}
    }
    if (!showPrice) {
        if (Array.isArray(products)) {
            products.forEach(p => { p.price_usd = null; });
        } else if (products) {
            products.price_usd = null;
        }
    }
    return products;
}

// ---------- 公开接口 ----------
router.get('/:id/sub-skus', async (req, res) => {
    const db = await openDb();
    const product = await db.get('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: '产品不存在' });
    const subSkus = await db.all(
        'SELECT id, sku, unit, price_cny, price_usd, desc_zh, desc_en, remark_zh, remark_en FROM sub_skus WHERE product_id = ? ORDER BY sort_order',
        [req.params.id]
    );
    const rate = await getExchangeRate();
    subSkus.forEach(s => {
        s.price_usd = s.price_cny ? parseFloat((s.price_cny / rate).toFixed(2)) : 0;
    });
    applyPriceVisibility(subSkus, req);
    const authHeader = req.headers.authorization;
    let isAuthorized = false;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.isAdmin || decoded.authorized) isAuthorized = true;
        } catch (e) {}
    }
    res.json({ subSkus, authorized: isAuthorized });
});

router.get('/', async (req, res) => {
    const { main_cat, sub_cat, search, limit = 200 } = req.query;
    let sql = 'SELECT id, sku, main_cat, sub_cat, unit, price_mask, price_cny, price_usd, desc_zh, desc_en, detail_zh, detail_en, img_url, img_url_1 FROM products WHERE 1=1';
    const params = [];
    if (main_cat) { sql += ' AND main_cat = ?'; params.push(main_cat); }
    if (sub_cat) { sql += ' AND sub_cat = ?'; params.push(sub_cat); }
    if (search) {
        sql += ' AND (sku LIKE ? OR desc_zh LIKE ? OR desc_en LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like);
    }
    sql += ' ORDER BY id LIMIT ?';
    params.push(parseInt(limit));
    const db = await openDb();
    const products = await db.all(sql, params);
    const rate = await getExchangeRate();
    products.forEach(p => {
        p.price_usd = p.price_cny ? parseFloat((p.price_cny / rate).toFixed(2)) : 0;
    });
    applyPriceVisibility(products, req);
    res.json(products);
});

router.get('/:id', async (req, res) => {
    const db = await openDb();
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: '产品不存在' });
    const rate = await getExchangeRate();
    product.price_usd = product.price_cny ? parseFloat((product.price_cny / rate).toFixed(2)) : 0;
    applyPriceVisibility(product, req);
    res.json(product);
});

// ---------- 后台管理 ----------
router.post('/', authenticateToken, upload.any(), async (req, res) => {
    try {
        const { sku, main_cat, sub_cat, unit, price_mask, price_cny, desc_zh, desc_en, detail_zh, detail_en } = req.body;
        if (!sku || !main_cat || !sub_cat || !unit) {
            return res.status(400).json({ error: 'SKU、主分类、子分类、单位为必填项' });
        }
        let img_url = null;
        let img_url_1 = null;
        if (req.files && req.files.length) {
            const imgFile = req.files.find(f => f.fieldname === 'img');
            if (imgFile) img_url = `/uploads/${imgFile.filename}`;
            const img1File = req.files.find(f => f.fieldname === 'img_1');
            if (img1File) img_url_1 = `/uploads/${img1File.filename}`;
        }
        const db = await openDb();
        await db.run(
            `INSERT INTO products (sku, main_cat, sub_cat, unit, price_mask, price_cny, desc_zh, desc_en, detail_zh, detail_en, img_url, img_url_1)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [sku, main_cat, sub_cat, unit, price_mask || '***', price_cny || 0, desc_zh || '', desc_en || '', detail_zh || '', detail_en || '', img_url, img_url_1]
        );
        res.status(201).json({ message: '产品创建成功' });
    } catch (err) {
        console.error(err);
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ error: 'SKU 已存在' });
        } else {
            res.status(500).json({ error: '服务器内部错误：' + err.message });
        }
    }
});

router.put('/:id', authenticateToken, upload.any(), async (req, res) => {
    try {
        const { sku, main_cat, sub_cat, unit, price_mask, price_cny, desc_zh, desc_en, detail_zh, detail_en, existing_img_url, existing_img_url_1 } = req.body;
        let img_url = existing_img_url || null;
        let img_url_1 = existing_img_url_1 || null;
        if (req.files && req.files.length) {
            const imgFile = req.files.find(f => f.fieldname === 'img');
            if (imgFile) img_url = `/uploads/${imgFile.filename}`;
            const img1File = req.files.find(f => f.fieldname === 'img_1');
            if (img1File) img_url_1 = `/uploads/${img1File.filename}`;
        }
        const db = await openDb();
        await db.run(
            `UPDATE products SET sku=?, main_cat=?, sub_cat=?, unit=?, price_mask=?, price_cny=?, desc_zh=?, desc_en=?, detail_zh=?, detail_en=?, img_url=?, img_url_1=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [sku, main_cat, sub_cat, unit, price_mask, price_cny, desc_zh, desc_en, detail_zh, detail_en, img_url, img_url_1, req.params.id]
        );
        res.json({ message: '产品更新成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '更新失败：' + err.message });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await openDb();
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: '产品删除成功' });
});

// ---------- 子SKU管理 ----------
router.post('/:productId/sub-skus', authenticateToken, async (req, res) => {
    const { productId } = req.params;
    const { sku, unit, price_cny, desc_zh, desc_en, remark_zh, remark_en, sort_order } = req.body;
    if (!sku || !unit) return res.status(400).json({ error: 'SKU 和单位不能为空' });
    const db = await openDb();
    const product = await db.get('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) return res.status(404).json({ error: '产品不存在' });
    const existing = await db.get('SELECT id FROM sub_skus WHERE product_id = ? AND sku = ?', [productId, sku]);
    if (existing) return res.status(400).json({ error: '该产品下已存在相同 SKU' });
    await db.run(
        `INSERT INTO sub_skus (product_id, sku, unit, price_cny, desc_zh, desc_en, remark_zh, remark_en, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [productId, sku, unit, price_cny || 0, desc_zh || '', desc_en || '', remark_zh || '', remark_en || '', sort_order || 0]
    );
    res.status(201).json({ message: '子 SKU 创建成功' });
});

router.put('/sub-skus/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { sku, unit, price_cny, desc_zh, desc_en, remark_zh, remark_en, sort_order } = req.body;
    if (!sku || !unit) return res.status(400).json({ error: 'SKU 和单位不能为空' });
    const db = await openDb();
    const existing = await db.get('SELECT id, product_id FROM sub_skus WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: '子 SKU 不存在' });
    const conflict = await db.get('SELECT id FROM sub_skus WHERE product_id = ? AND sku = ? AND id != ?', [existing.product_id, sku, id]);
    if (conflict) return res.status(400).json({ error: '该产品下已存在相同 SKU' });
    await db.run(
        `UPDATE sub_skus SET sku=?, unit=?, price_cny=?, desc_zh=?, desc_en=?, remark_zh=?, remark_en=?, sort_order=? WHERE id=?`,
        [sku, unit, price_cny || 0, desc_zh || '', desc_en || '', remark_zh || '', remark_en || '', sort_order || 0, id]
    );
    res.json({ message: '子 SKU 更新成功' });
});

router.delete('/sub-skus/:id', authenticateToken, async (req, res) => {
    console.log('🔥 删除子SKU请求 ID:', req.params.id);
    const { id } = req.params;
    const db = await openDb();
    const result = await db.run('DELETE FROM sub_skus WHERE id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: '子 SKU 不存在' });
    res.json({ message: '子 SKU 删除成功' });
});

module.exports = router;