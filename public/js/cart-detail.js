// ======================== 国际化词库 ========================
const i18n = {
    zh: {
        pageTitle: '📄 订单详情',
        contractLabel: '合同编号：',
        authCodeLabel: '授权码：',
        customerLabel: '客户代码：',
        dateLabel: '订单日期：',
        statusLabel: '订单状态：',
        orderStatus: '待确认',
        serial: '序号',
        image: '图片',
        sku: 'SKU',
        description: '描述',
        option: '选型',
        unit: '单位',
        quantity: '数量',
        unitPrice: '单价 (USD)',
        subtotal: '小计 (USD)',
        totalCNY: '人民币 (CNY)',
        action: '操作',
        totalQuantity: '总数量：',
        pieces: '件',
        varieties: '款',
        goodsSubtotal: '商品小计：',
        shipping: '运费：',
        finalAmount: '💰 最终金额：',
        backToCart: '← 返回购物车',
        clearCart: '清空清单',
        print: '🖨️ 打印 / 生成合同',
        notice: '⚠️ 注意：我们网站的所有产品单价计算基础是人民币，如美元兑人民币汇率波动，美元单价会自动调整（非涨价）。您可选择支付人民币，感谢支持。',
        loading: '加载中...',
        cartEmpty: '购物车为空，请返回继续选购',
        confirmClear: '确定清空所有商品吗？',
        noAuth: '未授权',
        authClient: '已授权客户',
        guest: '游客'
    },
    en: {
        pageTitle: '📄 Order Details',
        contractLabel: 'Contract No.: ',
        authCodeLabel: 'Auth Code: ',
        customerLabel: 'Customer Code: ',
        dateLabel: 'Order Date: ',
        statusLabel: 'Status: ',
        orderStatus: 'Pending',
        serial: 'No.',
        image: 'Image',
        sku: 'SKU',
        description: 'Description',
        option: 'Option',
        unit: 'Unit',
        quantity: 'Qty',
        unitPrice: 'Unit Price (USD)',
        subtotal: 'Subtotal (USD)',
        totalCNY: 'Amount (CNY)',
        action: 'Actions',
        totalQuantity: 'Total Qty: ',
        pieces: 'pcs',
        varieties: 'types',
        goodsSubtotal: 'Goods Subtotal: ',
        shipping: 'Shipping: ',
        finalAmount: '💰 Final Amount: ',
        backToCart: '← Back to Cart',
        clearCart: 'Clear Cart',
        print: '🖨️ Print / Contract',
        notice: '⚠️ Note: All product prices are based on CNY. USD prices will be automatically adjusted with exchange rate fluctuations. You may pay in CNY. Thanks for your support.',
        loading: 'Loading...',
        cartEmpty: 'Cart is empty, please continue shopping',
        confirmClear: 'Are you sure you want to clear all items?',
        noAuth: 'Unauthorized',
        authClient: 'Authorized Customer',
        guest: 'Guest'
    }
};

let currentLang = localStorage.getItem('lang') || 'zh';
function t(key) { return i18n[currentLang][key] || key; }

// ======================== 更新静态文本 ========================
function updateStaticTexts() {
    document.getElementById('pageTitle').innerText = t('pageTitle');
    document.getElementById('contractLabel').innerHTML = t('contractLabel');
    document.getElementById('authCodeLabel').innerHTML = t('authCodeLabel');
    document.getElementById('customerLabel').innerHTML = t('customerLabel');
    document.getElementById('dateLabel').innerHTML = t('dateLabel');
    document.getElementById('statusLabel').innerHTML = t('statusLabel');
    document.getElementById('orderStatus').innerText = t('orderStatus');
    document.getElementById('thSerial').innerText = t('serial');
    document.getElementById('thImage').innerText = t('image');
    document.getElementById('thSku').innerText = t('sku');
    document.getElementById('thDesc').innerText = t('description');
    document.getElementById('thOption').innerText = t('option');
    document.getElementById('thUnit').innerText = t('unit');
    document.getElementById('thQuantity').innerText = t('quantity');
    document.getElementById('thUnitPrice').innerText = t('unitPrice');
    document.getElementById('thSubtotal').innerText = t('subtotal');
    document.getElementById('thTotalCNY').innerText = t('totalCNY');
    document.getElementById('thAction').innerText = t('action');
    document.getElementById('backToCartBtn').innerHTML = t('backToCart');
    document.getElementById('clearCartBtn').innerHTML = t('clearCart');
    document.getElementById('printBtn').innerHTML = t('print');
    document.getElementById('noticeText').innerHTML = t('notice');
    document.getElementById('langSwitch').innerText = currentLang === 'zh' ? 'English' : '中文';
}

// ======================== 核心逻辑 ========================
let cart = {};
let shippingUSD = 0;
let shippingCNY = 0;
let exchangeRate = 7.0;
let authToken = localStorage.getItem('auth_token');
let usedAuthCode = null;

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

function formatUSD(usd) {
    if (usd === undefined || usd === null) return '--';
    return `$${usd.toFixed(2)}`;
}
function formatCNY(cny) {
    if (cny === undefined || cny === null) return '--';
    return `¥${cny.toFixed(2)}`;
}

function parseAuthCodeFromToken(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        return payload.code || null;
    } catch(e) { return null; }
}

function generateContractId() {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `KUS-${randomNum}`;
}

async function fetchExchangeRate() {
    try {
        let res = await fetch('/api/exchange-rate');
        let data = await res.json();
        if (data.rate) exchangeRate = data.rate;
    } catch(e) { console.warn('汇率获取失败'); }
}

function loadData() {
    const savedCart = localStorage.getItem('inquiry_cart');
    if (savedCart) {
        let parsed = JSON.parse(savedCart);
        let needClear = false;
        Object.keys(parsed).forEach(key => {
            if (parsed[key].price_cny === undefined) {
                needClear = true;
            }
        });
        if (needClear) {
            cart = {};
            localStorage.removeItem('inquiry_cart');
        } else {
            cart = parsed;
        }
    }
    const savedShippingUSD = localStorage.getItem('shippingUSD');
    const savedShippingCNY = localStorage.getItem('shippingCNY');
    if (savedShippingUSD) shippingUSD = parseFloat(savedShippingUSD);
    if (savedShippingCNY) shippingCNY = parseFloat(savedShippingCNY);
    usedAuthCode = parseAuthCodeFromToken(authToken);
    document.getElementById('authCodeDisplay').innerText = usedAuthCode || t('noAuth');
    document.getElementById('customerCode').innerText = authToken ? t('authClient') : t('guest');
    document.getElementById('orderDate').innerText = new Date().toLocaleString();
    document.getElementById('contractId').innerText = generateContractId();
}

function saveCart() {
    localStorage.setItem('inquiry_cart', JSON.stringify(cart));
}

// ======================== 判断是否为手机端 ========================
function isMobile() {
    return window.innerWidth < 768;
}

// ======================== 渲染函数（支持卡片/表格双模式） ========================
function renderTable() {
    const tbody = document.getElementById('orderTableBody');
    const cardContainer = document.getElementById('mobileCardContainer');
    const items = Object.entries(cart);
    const isMobileView = isMobile();

    // 显示/隐藏对应容器
    if (isMobileView) {
        document.getElementById('tableWrapper').style.display = 'none';
        cardContainer.style.display = 'block';
    } else {
        document.getElementById('tableWrapper').style.display = 'block';
        cardContainer.style.display = 'none';
    }

    if (items.length === 0) {
        const emptyMsg = `<div style="text-align:center;padding:40px;color:#5a7a9a;">${t('cartEmpty')}</div>`;
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;">${t('cartEmpty')}</td></tr>`;
        cardContainer.innerHTML = emptyMsg;
        document.getElementById('orderSummary').innerHTML = '';
        return;
    }

    // ---- PC端表格渲染 ----
    let totalCNY = 0, totalQty = 0;
    let idx = 1;
    tbody.innerHTML = items.map(([id, item]) => {
        const priceCNY = item.price_cny || 0;
        const priceUSD = exchangeRate > 0 ? priceCNY / exchangeRate : 0;
        let itemTotalCNY = priceCNY * item.quantity;
        let itemTotalUSD = priceUSD * item.quantity;
        totalCNY += itemTotalCNY;
        totalQty += item.quantity;
        let imgHtml = item.img_url ? `<img src="${item.img_url}" alt="${item.sku}" style="width:100%;height:100%;object-fit:cover;">` : '📷';
        let optionText = item.option ? escapeHtml(item.option) : '-';
        return `
            <tr data-id="${id}">
                <td style="text-align:center;">${idx++}</td>
                <td><div class="product-img-table">${imgHtml}</div></td>
                <td><strong style="color:#00d4ff;">${escapeHtml(item.sku)}</strong></td>
                <td>${escapeHtml(item.desc || '')}</td>
                <td>${optionText}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>
                    <div class="qty-control">
                        <button class="qty-btn" data-id="${id}" data-delta="-1">-</button>
                        <input type="number" class="qty-input" data-id="${id}" value="${item.quantity}" min="1" step="1">
                        <button class="qty-btn" data-id="${id}" data-delta="1">+</button>
                        <button class="remove-btn" data-id="${id}">✕</button>
                    </div>
                </td>
                <td style="color:#f5a623;font-weight:600;">${formatUSD(priceUSD)}</td>
                <td style="color:#f5a623;font-weight:600;">${formatUSD(itemTotalUSD)}</td>
                <td style="color:#4b8cff;font-weight:600;">${formatCNY(itemTotalCNY)}</td>
                <td></td>
            </tr>
        `;
    }).join('');

    // ---- 手机端卡片渲染 ----
    let cardHtml = '';
    let cardIdx = 1;
    items.forEach(([id, item]) => {
        const priceCNY = item.price_cny || 0;
        const priceUSD = exchangeRate > 0 ? priceCNY / exchangeRate : 0;
        let itemTotalCNY = priceCNY * item.quantity;
        let itemTotalUSD = priceUSD * item.quantity;
        let imgHtml = item.img_url ? `<img src="${item.img_url}" alt="${item.sku}">` : `<span class="no-img">📷</span>`;
        let optionText = item.option ? escapeHtml(item.option) : '';
        cardHtml += `
            <div class="cart-detail-card" data-id="${id}">
                <div class="card-index">#${cardIdx++}</div>
                <div class="card-top">
                    <div class="card-img">${imgHtml}</div>
                    <div class="card-info">
                        <span class="card-sku">${escapeHtml(item.sku)}</span>
                        <span class="card-desc">${escapeHtml(item.desc || '')}</span>
                        ${optionText ? `<span class="card-option">${optionText}</span>` : ''}
                    </div>
                </div>
                <div class="card-mid">
                    <span class="card-unit">单位：<strong>${escapeHtml(item.unit)}</strong></span>
                    <div class="card-qty">
                        <button class="qty-btn" data-id="${id}" data-delta="-1">−</button>
                        <input type="number" class="qty-input" data-id="${id}" value="${item.quantity}" min="1" step="1">
                        <button class="qty-btn" data-id="${id}" data-delta="1">+</button>
                        <button class="remove-btn" data-id="${id}">✕</button>
                    </div>
                </div>
                <div class="card-bottom">
                    <div class="card-price">
                        <span class="price-label">单价</span><br>
                        ${formatUSD(priceUSD)}
                    </div>
                    <div class="card-subtotal">
                        <span class="subtotal-label">小计</span><br>
                        <span class="subtotal-usd">${formatUSD(itemTotalUSD)}</span>
                        <span class="subtotal-cny">${formatCNY(itemTotalCNY)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    cardContainer.innerHTML = cardHtml;

    // ---- 汇总信息 ----
    const totalWithShippingCNY = totalCNY + shippingCNY;
    const totalWithShippingUSD = totalWithShippingCNY / exchangeRate;
    const summaryHtml = `
        <div class="summary-row">
            <div class="label">${t('totalQuantity')}</div>
            <div class="value">${totalQty} ${t('pieces')} / ${Object.keys(cart).length} ${t('varieties')}</div>
        </div>
        <div class="summary-row">
            <div class="label">${t('goodsSubtotal')}</div>
            <div class="value"><span class="usd">${formatUSD(totalWithShippingCNY / exchangeRate)}</span> / <span class="cny">${formatCNY(totalCNY)}</span></div>
        </div>
        <div class="summary-row">
            <div class="label">${t('shipping')}</div>
            <div class="value"><span class="usd">${formatUSD(shippingCNY / exchangeRate)}</span> / <span class="cny">${formatCNY(shippingCNY)}</span></div>
        </div>
        <div class="summary-row final-row">
            <div class="label">${t('finalAmount')}</div>
            <div class="value"><span class="usd">${formatUSD(totalWithShippingUSD)}</span> / <span class="cny">${formatCNY(totalWithShippingCNY)}</span></div>
        </div>
    `;
    document.getElementById('orderSummary').innerHTML = summaryHtml;

    // ---- 绑定事件（表格 + 卡片） ----
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.removeEventListener('click', handleQtyClick);
        btn.addEventListener('click', handleQtyClick);
    });
    document.querySelectorAll('.qty-input').forEach(input => {
        input.removeEventListener('change', handleQtyInputChange);
        input.addEventListener('change', handleQtyInputChange);
    });
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.removeEventListener('click', handleRemoveClick);
        btn.addEventListener('click', handleRemoveClick);
    });
}

// ======================== 事件处理函数 ========================
function handleQtyClick(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const delta = parseInt(btn.dataset.delta);
    updateQuantity(id, delta);
}
function handleRemoveClick(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    removeItem(id);
}
function handleQtyInputChange(e) {
    const input = e.currentTarget;
    const id = input.dataset.id;
    const newVal = parseInt(input.value);
    if (!isNaN(newVal) && newVal > 0) updateQuantityDirect(id, newVal);
    else renderTable();
}

function updateQuantity(id, delta) {
    if (!cart[id]) return;
    let newQty = cart[id].quantity + delta;
    if (newQty <= 0) delete cart[id];
    else cart[id].quantity = newQty;
    saveCart();
    renderTable();
}
function updateQuantityDirect(id, newQty) {
    if (!cart[id]) return;
    if (newQty <= 0) delete cart[id];
    else cart[id].quantity = newQty;
    saveCart();
    renderTable();
}
function removeItem(id) {
    delete cart[id];
    saveCart();
    renderTable();
}
function clearCart() {
    if (confirm(t('confirmClear'))) {
        cart = {};
        saveCart();
        renderTable();
    }
}
function printContract() {
    if (Object.keys(cart).length === 0) {
        alert(t('cartEmpty'));
        return;
    }
    window.print();
}

// ======================== 窗口变化重新渲染 ========================
let resizeTimer = null;
function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        renderTable();
    }, 200);
}

// ======================== 初始化 ========================
async function init() {
    await fetchExchangeRate();
    loadData();
    renderTable();
    updateStaticTexts();

    document.getElementById('backToCartBtn').addEventListener('click', () => {
        localStorage.setItem('inquiry_cart', JSON.stringify(cart));
        window.location.href = '/';
    });
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('printBtn').addEventListener('click', printContract);
    document.getElementById('langSwitch').addEventListener('click', () => {
        currentLang = currentLang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('lang', currentLang);
        updateStaticTexts();
        renderTable();
    });

    window.addEventListener('resize', handleResize);
}

init();