const express = require('express');
const router = express.Router();
const https = require('https');

let cachedRate = null;
let lastFetch = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function fetchExchangeRate() {
    return new Promise((resolve, reject) => {
        const url = 'https://api.exchangerate-api.com/v4/latest/USD';
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const rate = json.rates.CNY;
                    if (rate) resolve(rate);
                    else reject(new Error('汇率获取失败'));
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function getExchangeRate() {
    const now = Date.now();
    if (cachedRate && (now - lastFetch) < CACHE_DURATION) return cachedRate;
    cachedRate = await fetchExchangeRate();
    lastFetch = now;
    console.log('汇率已更新: 1 USD =', cachedRate, 'CNY');
    return cachedRate;
}

router.get('/', async (req, res) => {
    try {
        const rate = await getExchangeRate();
        res.json({ rate, currency: 'CNY', base: 'USD', updated: new Date(lastFetch).toISOString() });
    } catch (err) {
        res.status(500).json({ error: '汇率获取失败', fallback: 7.0 });
    }
});

// 导出 router 和 getExchangeRate
module.exports = { router, getExchangeRate };