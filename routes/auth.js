const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openDb } = require('../db/database');
const router = express.Router();

// 管理员登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    const db = await openDb();
    const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign(
        { id: admin.id, username: admin.username, isAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
    res.json({ token, username: admin.username });
});

// 检查前台授权状态（实时验证数据库中授权码是否仍然有效）
router.get('/status', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.json({ authorized: false });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 只有前台授权 token 才有 codeId 字段
        if (!decoded.codeId) {
            return res.json({ authorized: false });
        }
        const db = await openDb();
        // 查询该授权码是否仍然存在于数据库
        const record = await db.get('SELECT id FROM auth_codes WHERE id = ?', [decoded.codeId]);
        if (!record) {
            // 授权码已被删除，失效
            return res.json({ authorized: false });
        }
        return res.json({ authorized: true });
    } catch (e) {
        return res.json({ authorized: false });
    }
});

module.exports = router;