const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
    const db = await open({
        filename: path.join(__dirname, 'db', 'database.sqlite'),
        driver: sqlite3.Database
    });
    const hashed = await bcrypt.hash('KUS3364', 10);
    await db.run(`UPDATE admins SET password_hash = ? WHERE username = 'admin'`, hashed);
    console.log('管理员密码已设置为 KUS3364');
    await db.close();
})();