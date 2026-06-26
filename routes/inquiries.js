const express = require('express');
const { openDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', async (req, res) => {
    const { product_id, product_sku, customer_name, customer_email, message } = req.body;
    if (!customer_name || !customer_email) {
        return res.status(400).json({ error: '姓名和邮箱为必填项' });
    }
    const db = await openDb();
    await db.run(
        `INSERT INTO inquiries (product_id, product_sku, customer_name, customer_email, message)
         VALUES (?, ?, ?, ?, ?)`,
        [product_id || null, product_sku || null, customer_name, customer_email, message || '']
    );
    res.status(201).json({ message: '询价已提交' });
});

router.get('/', authenticateToken, async (req, res) => {
    const db = await openDb();
    const inquiries = await db.all('SELECT * FROM inquiries ORDER BY created_at DESC');
    res.json(inquiries);
});

router.patch('/:id', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const db = await openDb();
    await db.run(`UPDATE inquiries SET status=? WHERE id=?`, [status, req.params.id]);
    res.json({ message: '状态更新成功' });
});

module.exports = router;