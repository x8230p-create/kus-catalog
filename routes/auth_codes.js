const express = require('express');
const { openDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();

function generateCode() {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `KUS${randomNum}`;
}

// 获取所有授权码（后台）
router.get('/', authenticateToken, async (req, res) => {
    const db = await openDb();
    const codes = await db.all('SELECT id, code, created_at, expires_at, used FROM auth_codes ORDER BY created_at DESC');
    res.json(codes);
});

// 生成新授权码（后台）
router.post('/', authenticateToken, async (req, res) => {
    const { expires_in_hours = 24 } = req.body;
    let code = generateCode();
    const db = await openDb();
    let existing = await db.get('SELECT id FROM auth_codes WHERE code = ?', [code]);
    while (existing) {
        code = generateCode();
        existing = await db.get('SELECT id FROM auth_codes WHERE code = ?', [code]);
    }
    const expires_at = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();
    await db.run('INSERT INTO auth_codes (code, expires_at) VALUES (?, ?)', [code, expires_at]);
    res.status(201).json({ code, expires_at });
});

// 前台验证授权码
router.post('/verify', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '授权码不能为空' });
    const db = await openDb();
    const record = await db.get('SELECT * FROM auth_codes WHERE code = ?', [code]);
    if (!record) return res.status(401).json({ error: '授权码无效' });
    if (record.used) return res.status(401).json({ error: '授权码已被使用' });
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
        return res.status(401).json({ error: '授权码已过期' });
    }
    // 标记为已使用
    await db.run('UPDATE auth_codes SET used = 1 WHERE id = ?', [record.id]);
    // 生成 token 时存入授权码的 id
    const token = jwt.sign(
        { authorized: true, codeId: record.id, code: record.code },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.json({ authorized: true, token });
});

// 删除授权码（后台）
router.delete('/:id', authenticateToken, async (req, res) => {
    const db = await openDb();
    await db.run('DELETE FROM auth_codes WHERE id = ?', [req.params.id]);
    res.json({ message: '删除成功' });
});

module.exports = router;