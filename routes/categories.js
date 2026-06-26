const express = require('express');
const { openDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
    const db = await openDb();
    const categories = await db.all('SELECT * FROM categories ORDER BY sort_order');
    res.json(categories);
});

router.post('/', authenticateToken, async (req, res) => {
    const { main_cat, sub_cat, name_zh, name_en, sort_order } = req.body;
    const db = await openDb();
    await db.run(
        `INSERT INTO categories (main_cat, sub_cat, name_zh, name_en, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [main_cat, sub_cat, name_zh, name_en, sort_order || 0]
    );
    res.status(201).json({ message: '分类创建成功' });
});

router.put('/:id', authenticateToken, async (req, res) => {
    const { name_zh, name_en, sort_order } = req.body;
    const db = await openDb();
    await db.run(`UPDATE categories SET name_zh=?, name_en=?, sort_order=? WHERE id=?`, [name_zh, name_en, sort_order, req.params.id]);
    res.json({ message: '分类更新成功' });
});

router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await openDb();
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: '分类删除成功' });
});

module.exports = router;