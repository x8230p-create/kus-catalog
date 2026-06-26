// ============================================================
// 全局状态
// ============================================================
const API_BASE = '/api';
let currentLang = localStorage.getItem('lang') || 'zh';
let authToken = localStorage.getItem('auth_token');
let isAuthorized = false;
let exchangeRate = 7.0;
let cart = JSON.parse(localStorage.getItem('inquiry_cart') || '{}');
let shippingUSD = 0, shippingCNY = 0;
let allProducts = [];
let currentMainCat = 'all';
let currentSubCat = 'all';
let searchKeyword = '';
let currentPage = 0;
let hasMore = true;
const PAGE_SIZE = 20;
let tbody, sentinel;
let isLoading = false;
let allCategories = [];

// ============================================================
// 国际化
// ============================================================
const i18n = {
    zh: {
        logoSubtitle: '专业汽车照明目录',
        searchPlaceholder: 'SKU / 描述',
        langBtn: 'English',
        cart: '购物车',
        cartTitle: '购物车',
        shipping: '运费',
        listSummary: '清单',
        pieces: '件',
        varieties: '款',
        totalAmount: '总金额',
        viewDetail: '查看详细清单',
        clearCart: '清空清单',
        image: '图片',
        image1: '图片1',
        sku: 'SKU',
        category: '分类',
        description: '描述',
        unit: '单位',
        price: '价格',
        action: '操作',
        loading: '加载更多...',
        noMore: '已加载全部',
        noProducts: '暂无产品',
        addToCart: '加入清单',
        needAuth: '需要授权',
        authRequiredText: '您需要联系客服获得授权后才能使用购物车和查看价格。',
        close: '关闭',
        contactService: '联系客服',
        authSuccess: '授权成功！',
        authFailed: '授权失败',
        networkError: '网络错误',
        addedToCart: '已加入清单',
        cartEmpty: '购物车为空',
        confirmClear: '确定清空购物车吗？清空后将无法恢复。',
        selectOption: '请选择一项',
        selectAtLeastOne: '请至少选择一个子SKU',
        selectSubSku: '选择子SKU',
        select: '选择',
        remark: '备注',
        quantity: '数量',
        selectType: '选择产品类型',
        copy: '复制',
        copied: '已复制',
        copyFailed: '复制失败',
        authCodePlaceholder: '输入授权码',
        submitAuth: '提交授权',
        authCodeRequired: '请输入授权码',
        all: '全部',
        subtotal: '小计',
        batchAdd: '批量加入清单（勾选）'
    },
    en: {
        logoSubtitle: 'Professional Auto Lighting',
        searchPlaceholder: 'SKU / Description',
        langBtn: '中文',
        cart: 'Cart',
        cartTitle: 'Shopping Cart',
        shipping: 'Shipping',
        listSummary: 'Cart',
        pieces: 'pcs',
        varieties: 'types',
        totalAmount: 'Total',
        viewDetail: 'View Details',
        clearCart: 'Clear Cart',
        image: 'Image',
        image1: 'Image 2',
        sku: 'SKU',
        category: 'Category',
        description: 'Description',
        unit: 'Unit',
        price: 'Price',
        action: 'Actions',
        loading: 'Loading more...',
        noMore: 'All loaded',
        noProducts: 'No products',
        addToCart: 'Add to Cart',
        needAuth: 'Authorization Required',
        authRequiredText: 'You need to contact customer service to get authorization.',
        close: 'Close',
        contactService: 'Contact Service',
        authSuccess: 'Authorization successful!',
        authFailed: 'Authorization failed',
        networkError: 'Network error',
        addedToCart: 'Added to cart',
        cartEmpty: 'Cart is empty',
        confirmClear: 'Are you sure you want to clear the cart?',
        selectOption: 'Please select an option',
        selectAtLeastOne: 'Please select at least one sub SKU',
        selectSubSku: 'Select Sub SKU',
        select: 'Select',
        remark: 'Remark',
        quantity: 'Quantity',
        selectType: 'Select Product Type',
        copy: 'Copy',
        copied: 'Copied',
        copyFailed: 'Copy failed',
        authCodePlaceholder: 'Enter authorization code',
        submitAuth: 'Submit Authorization',
        authCodeRequired: 'Authorization code required',
        all: 'All',
        subtotal: 'Subtotal',
        batchAdd: 'Batch Add (Checked)'
    }
};

function t(key) { return i18n[currentLang]?.[key] || key; }
function escapeHtml(s) { if (!s) return ''; return s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]); }
function formatPriceUSD(usd) { if (usd === null || usd === undefined) return '--'; return `$${usd.toFixed(2)}`; }
function formatPriceCNY(cny) { if (cny === null || cny === undefined) return '--'; return `¥${cny.toFixed(2)}`; }
function formatProductPrice(usd) { if (!isAuthorized) return '***'; if (usd === null || usd === undefined) return '***'; return formatPriceUSD(usd); }

function showToast(msg) {
    let old = document.querySelector('.toast');
    if (old) old.remove();
    let toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ============================================================
// API 请求
// ============================================================
async function fetchExchangeRate() {
    try {
        const res = await fetch(API_BASE + '/exchange-rate');
        const data = await res.json();
        if (data.rate) exchangeRate = data.rate;
    } catch (e) {
        console.warn('汇率获取失败，使用默认值', e);
    }
}

async function checkAuthStatus() {
    if (!authToken) {
        isAuthorized = false;
        return false;
    }
    try {
        const res = await fetch(API_BASE + '/auth/status', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const d = await res.json();
            isAuthorized = d.authorized === true;
            if (!isAuthorized) {
                localStorage.removeItem('auth_token');
                authToken = null;
            }
        } else {
            isAuthorized = false;
            authToken = null;
        }
    } catch (e) {
        isAuthorized = false;
    }
    return isAuthorized;
}

async function verifyAuthCode(code) {
    try {
        const res = await fetch(API_BASE + '/auth-codes/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const d = await res.json();
        if (d.authorized) {
            authToken = d.token;
            localStorage.setItem('auth_token', authToken);
            isAuthorized = true;
            await fetchExchangeRate();
            showToast(t('authSuccess'));
            refreshProductList();
            return true;
        } else {
            showToast(d.error || t('authFailed'));
            return false;
        }
    } catch (e) {
        showToast(t('networkError'));
        return false;
    }
}

// ============================================================
// 购物车核心函数
// ============================================================
function saveCart() {
    try {
        localStorage.setItem('inquiry_cart', JSON.stringify(cart));
        updateCartUI();
        updateAllBadges();
    } catch (e) {
        console.error('保存购物车失败:', e);
    }
}

function updateAllBadges() {
    const count = Object.keys(cart).length;
    const displayCount = count > 99 ? '99+' : count;

    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.innerText = displayCount;

    const floatBadge = document.getElementById('floatCartCount');
    if (floatBadge) floatBadge.innerText = displayCount;

    const mobileBadge = document.getElementById('mobileCartBadge');
    if (mobileBadge) {
        mobileBadge.textContent = displayCount;
        mobileBadge.classList.toggle('hidden', count === 0);
    }
}

function updateCartUI() {
    const container = document.getElementById('cartItemsList');
    if (!container) return;
    const items = Object.entries(cart);
    if (items.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">${t('cartEmpty')}</div>`;
        const qtyEl = document.getElementById('cartTotalQty');
        const typesEl = document.getElementById('cartTotalTypes');
        const usdEl = document.getElementById('cartTotalUSD');
        const cnyEl = document.getElementById('cartTotalCNY');
        if (qtyEl) qtyEl.innerText = '0';
        if (typesEl) typesEl.innerText = '0';
        if (usdEl) usdEl.innerText = '$0.00';
        if (cnyEl) cnyEl.innerText = '¥0.00';
        return;
    }
    let totalQty = 0, totalCNY = 0;
    let uniqueSKUs = new Set();
    container.innerHTML = items.map(([id, item]) => {
        totalQty += item.quantity;
        uniqueSKUs.add(item.sku);
        const priceCNY = item.price_cny || 0;
        const priceUSD = exchangeRate > 0 ? priceCNY / exchangeRate : 0;
        const itemTotalCNY = priceCNY * item.quantity;
        const itemTotalUSD = priceUSD * item.quantity;
        totalCNY += itemTotalCNY;
        let unitPriceDisplay = isAuthorized ? formatPriceUSD(priceUSD) : '***';
        let optionText = item.option ? ` (${item.option})` : '';
        let imgHtml = item.img_url ? `<img src="${item.img_url}" alt="${item.sku}" style="width:100%;height:100%;object-fit:cover;">` : '📷';
        return `
            <div class="cart-item">
                <div class="cart-item-img">${imgHtml}</div>
                <div class="cart-item-details">
                    <div class="cart-item-row">
                        <span class="cart-item-sku">${escapeHtml(item.sku)}${optionText}</span>
                        <span class="cart-item-total-price">${formatPriceUSD(itemTotalUSD)}</span>
                    </div>
                    <div class="cart-item-desc">${escapeHtml(item.desc || '')}</div>
                    <div class="cart-item-price-line">
                        <span class="cart-item-unit-price">${t('price')}: ${unitPriceDisplay} / ${escapeHtml(item.unit)}</span>
                        <div class="cart-item-controls">
                            <button class="cart-qty-btn" data-id="${id}" data-delta="-1">−</button>
                            <input type="number" class="cart-qty-input" data-id="${id}" value="${item.quantity}" min="1" step="1">
                            <button class="cart-qty-btn" data-id="${id}" data-delta="1">+</button>
                            <button class="cart-remove" data-id="${id}">✕</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    const totalCNYWithShipping = totalCNY + shippingCNY;
    const totalUSDWithShipping = totalCNYWithShipping / exchangeRate;
    document.getElementById('cartTotalQty').innerText = totalQty;
    document.getElementById('cartTotalTypes').innerText = uniqueSKUs.size;
    document.getElementById('cartTotalUSD').innerText = formatPriceUSD(totalUSDWithShipping);
    document.getElementById('cartTotalCNY').innerText = formatPriceCNY(totalCNYWithShipping);

    document.querySelectorAll('.cart-qty-btn').forEach(btn => {
        btn.removeEventListener('click', handleQtyClick);
        btn.addEventListener('click', handleQtyClick);
    });
    document.querySelectorAll('.cart-remove').forEach(btn => {
        btn.removeEventListener('click', handleRemoveClick);
        btn.addEventListener('click', handleRemoveClick);
    });
    document.querySelectorAll('.cart-qty-input').forEach(input => {
        input.removeEventListener('change', handleQtyInputChange);
        input.addEventListener('change', handleQtyInputChange);
    });
}

function handleQtyClick(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const delta = parseInt(btn.dataset.delta);
    updateCartItemQuantity(id, delta);
}
function handleRemoveClick(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    removeCartItem(id);
}
function handleQtyInputChange(e) {
    const input = e.currentTarget;
    const id = input.dataset.id;
    const newVal = parseInt(input.value);
    if (!isNaN(newVal)) updateCartItemQuantityDirect(id, newVal);
}

function updateCartItemQuantity(id, delta) {
    if (!cart[id]) return;
    let newQty = cart[id].quantity + delta;
    if (newQty <= 0) delete cart[id];
    else cart[id].quantity = newQty;
    saveCart();
}
function updateCartItemQuantityDirect(id, newQty) {
    if (!cart[id]) return;
    let qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) delete cart[id];
    else cart[id].quantity = qty;
    saveCart();
}
function removeCartItem(id) {
    delete cart[id];
    saveCart();
}
function clearCart() {
    if (confirm(t('confirmClear'))) {
        cart = {};
        saveCart();
        shippingUSD = 0;
        shippingCNY = 0;
        document.getElementById('shippingUSD').value = '0';
        document.getElementById('shippingCNY').value = '0';
        updateCartUI();
    }
}

// ============================================================
// 加入购物车
// ============================================================
function addSubSKUsToCart(product, selectedSubSKUs) {
    if (!isAuthorized) {
        showAuthPrompt();
        console.warn('未授权，无法加入购物车');
        return;
    }
    if (!selectedSubSKUs || selectedSubSKUs.length === 0) {
        showToast('请选择商品');
        return;
    }
    selectedSubSKUs.forEach(sub => {
        if (!sub.sku || !sub.unit) {
            console.warn('跳过无效商品:', sub);
            return;
        }
        const priceCNY = sub.price_cny || 0;
        const cartKey = `${product.id}_${sub.sku}`;
        if (cart[cartKey]) {
            cart[cartKey].quantity += sub.quantity || 1;
        } else {
            cart[cartKey] = {
                sku: sub.sku,
                unit: sub.unit,
                price_cny: priceCNY,
                desc: sub.desc || '',
                option: null,
                quantity: sub.quantity || 1,
                img_url: product.img_url || null,
                parent_sku: product.sku
            };
        }
    });
    saveCart();
    showToast(t('addedToCart'));
}

function handleAddToCart(product) {
    if (!isAuthorized) {
        showAuthPrompt();
        return;
    }
    fetch(API_BASE + `/products/${product.id}/sub-skus`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
    })
    .then(res => res.json())
    .then(data => {
        const subSkus = data.subSkus || [];
        if (subSkus.length > 0) {
            showDetailModal(product);
        } else {
            const selected = [{
                sku: product.sku,
                unit: product.unit,
                price_cny: product.price_cny || 0,
                desc: currentLang === 'zh' ? (product.desc_zh || '') : (product.desc_en || ''),
                quantity: 1
            }];
            addSubSKUsToCart(product, selected);
        }
    })
    .catch(err => {
        console.error('获取子SKU失败:', err);
        const selected = [{
            sku: product.sku,
            unit: product.unit,
            price_cny: product.price_cny || 0,
            desc: currentLang === 'zh' ? (product.desc_zh || '') : (product.desc_en || ''),
            quantity: 1
        }];
        addSubSKUsToCart(product, selected);
    });
}

// ============================================================
// 产品列表渲染
// ============================================================
async function fetchFilteredProducts() {
    const params = new URLSearchParams();
    if (currentMainCat !== 'all') params.append('main_cat', currentMainCat);
    if (currentSubCat && currentSubCat !== 'all') params.append('sub_cat', currentSubCat);
    if (searchKeyword) params.append('search', searchKeyword);
    params.append('limit', '200');
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(API_BASE + '/products?' + params.toString(), { headers });
    return res.json();
}

async function refreshProductList() {
    allProducts = await fetchFilteredProducts();
    currentPage = 0;
    hasMore = true;
    renderTableBody(true);
}

function renderTableBody(reset) {
    if (!tbody) return;
    if (reset) {
        tbody.innerHTML = '';
        currentPage = 0;
        hasMore = true;
    }
    if (isLoading) return;
    let start = currentPage * PAGE_SIZE;
    let page = allProducts.slice(start, start + PAGE_SIZE);
    if (page.length === 0) {
        hasMore = false;
        if (sentinel) sentinel.innerText = t('noMore');
        if (currentPage === 0 && allProducts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-placeholder">${t('noProducts')}</td></tr>`;
        }
        return;
    }
    page.forEach(p => {
        let row = createProductRow(p);
        tbody.appendChild(row);
    });
    currentPage++;
    if (start + PAGE_SIZE >= allProducts.length) {
        hasMore = false;
        if (sentinel) sentinel.innerText = t('noMore');
    } else {
        if (sentinel) sentinel.innerText = t('loading');
    }
    isLoading = false;
}

function createProductRow(p) {
    let tr = document.createElement('tr');
    let catName = p.main_cat || '';
    let desc = currentLang === 'zh' ? (p.desc_zh || '') : (p.desc_en || '');
    let priceUsd = p.price_usd;
    let priceDisplay = formatProductPrice(priceUsd);
    let canAdd = isAuthorized;
    let addClass = canAdd ? '' : 'disabled';
    let productJson = JSON.stringify(p).replace(/'/g, "&#39;");

    function buildImgCell(imgSrc, fallbackText) {
        if (!imgSrc || imgSrc === '—' || imgSrc === '') {
            return `<div class="product-img">${fallbackText}</div>`;
        }
        return `
            <div class="product-img" data-img="${imgSrc}">
                <img src="${imgSrc}" alt="${p.sku}" loading="lazy">
                <div class="img-tooltip">
                    <img src="${imgSrc}" alt="${p.sku}">
                </div>
            </div>
        `;
    }

    tr.innerHTML = `
        <td>${buildImgCell(p.img_url, '📷')}</td>
        <td>${buildImgCell(p.img_url_1, '—')}</td>
        <td><span class="sku" data-product='${productJson}'>${escapeHtml(p.sku)}</span></td>
        <td>${escapeHtml(catName)}</td>
        <td>${escapeHtml(desc)}</td>
        <td>${escapeHtml(p.unit)}</td>
        <td class="product-price" data-usd="${priceUsd===null?'':priceUsd}">${priceDisplay}</td>
        <td><button class="cart-add-btn ${addClass}" data-id="${p.id}" ${!canAdd?'disabled':''}>➕ ${t('addToCart')}</button></td>
    `;

    const skuEl = tr.querySelector('.sku');
    if (skuEl) skuEl.addEventListener('click', () => showDetailModal(p, true));

    tr.querySelectorAll('.product-img').forEach(el => {
        el.addEventListener('click', () => showDetailModal(p, true));
    });

    let addBtn = tr.querySelector('.cart-add-btn');
    if (addBtn && canAdd) {
        addBtn.addEventListener('click', () => handleAddToCart(p));
    } else if (addBtn && !canAdd) {
        addBtn.addEventListener('click', () => showAuthPrompt());
    }

    tr.querySelectorAll('.product-img').forEach(el => {
        const tooltip = el.querySelector('.img-tooltip');
        if (tooltip) {
            el.addEventListener('mousemove', (e) => {
                let left = e.clientX + 15;
                let top = e.clientY - 10;
                if (left + 300 > window.innerWidth) left = e.clientX - 310;
                if (top + 300 > window.innerHeight) top = window.innerHeight - 310;
                if (top < 10) top = 10;
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            });
        }
    });

    return tr;
}

// ============================================================
// 产品详情弹窗（优化移动端布局，删除批量加入功能）
// ============================================================
async function showDetailModal(product, onlyFirstImage = true) {
    let subSkus = [];
    let isAuth = false;
    try {
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
        const res = await fetch(API_BASE + `/products/${product.id}/sub-skus`, { headers });
        const data = await res.json();
        subSkus = data.subSkus || [];
        isAuth = data.authorized || false;
    } catch (e) {
        subSkus = [];
    }

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';

    // 判断是否为移动端
    const isMobile = window.innerWidth < 768;

    let rows = [];
    if (subSkus.length === 0) {
        rows.push({
            sku: product.sku,
            unit: product.unit,
            price_cny: product.price_cny || 0,
            desc: currentLang === 'zh' ? product.desc_zh : product.desc_en,
            img_url: product.img_url,
            isProduct: true
        });
    } else {
        subSkus.forEach(s => {
            rows.push({
                sku: s.sku,
                unit: s.unit,
                price_cny: s.price_cny || 0,
                desc: currentLang === 'zh' ? s.desc_zh : s.desc_en,
                img_url: product.img_url,
                isProduct: false,
                subId: s.id
            });
        });
    }

    // ---- 生成内容 ----
    let contentHtml = '';

    if (isMobile) {
        // ===== 移动端卡片布局 =====
        let cardsHtml = rows.map((row, idx) => {
            const priceUSD = exchangeRate > 0 ? row.price_cny / exchangeRate : 0;
            const priceDisplay = isAuth ? formatPriceUSD(priceUSD) : '***';
            const subtotalUSD = priceUSD;
            const subtotalDisplay = isAuth ? formatPriceUSD(subtotalUSD) : '***';
            let imgHtml = row.img_url ? `<img src="${row.img_url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '<span style="font-size:32px;">📷</span>';
            return `
                <div class="modal-sku-card" data-sku="${row.sku}" data-price-cny="${row.price_cny}" data-unit="${row.unit}" data-desc="${escapeHtml(row.desc)}">
                    <div class="modal-card-top">
                        <div class="modal-card-img">${imgHtml}</div>
                        <div class="modal-card-info">
                            <div class="modal-card-sku">${escapeHtml(row.sku)}</div>
                            <div class="modal-card-desc">${escapeHtml(row.desc || '-')}</div>
                            <div class="modal-card-unit">单位：${escapeHtml(row.unit)}</div>
                        </div>
                    </div>
                    <div class="modal-card-mid">
                        <div class="modal-card-price">${priceDisplay}</div>
                        <div class="modal-card-qty">
                            <button class="qty-btn-sub" data-delta="-1">−</button>
                            <input type="number" class="qty-input-sub" value="1" min="1" step="1">
                            <button class="qty-btn-sub" data-delta="1">+</button>
                        </div>
                    </div>
                    <div class="modal-card-bottom">
                        <div class="modal-card-subtotal">小计：<span class="subtotal-display">${subtotalDisplay}</span></div>
                        <button class="add-single-sub modal-add-btn" data-index="${idx}">➕ 加入购物车</button>
                    </div>
                </div>
            `;
        }).join('');

        contentHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="font-size:18px;color:var(--accent-blue);margin:0;">${escapeHtml(product.sku)}</h3>
                <button id="closeDetailModal2" class="btn" style="background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);padding:4px 14px;border-radius:var(--radius-btn);cursor:pointer;">✖</button>
            </div>
            <div class="modal-card-list">
                ${cardsHtml}
            </div>
            <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:12px;">
                <button id="closeDetailModal" class="btn" style="background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);padding:6px 18px;border-radius:var(--radius-btn);cursor:pointer;">${t('close')}</button>
            </div>
        `;
    } else {
        // ===== PC 端表格布局 =====
        let tableRowsHtml = rows.map((row, idx) => {
            const priceUSD = exchangeRate > 0 ? row.price_cny / exchangeRate : 0;
            const priceDisplay = isAuth ? formatPriceUSD(priceUSD) : '***';
            const subtotalUSD = priceUSD;
            const subtotalDisplay = isAuth ? formatPriceUSD(subtotalUSD) : '***';
            let imgHtml = row.img_url ? `<img src="${row.img_url}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border-color);">` : '📷';
            return `
                <tr data-index="${idx}" data-sku="${row.sku}" data-price-cny="${row.price_cny}" data-unit="${row.unit}" data-desc="${escapeHtml(row.desc)}">
                    <td style="text-align:center;font-size:12px;color:var(--text-muted);">${idx + 1}</td>
                    <td style="text-align:center;">${imgHtml}</td>
                    <td><strong style="color:var(--accent-blue);font-size:14px;">${escapeHtml(row.sku)}</strong></td>
                    <td>${escapeHtml(row.desc || '-')}</td>
                    <td style="text-align:center;">${escapeHtml(row.unit)}</td>
                    <td class="product-price" style="font-weight:600;color:var(--accent-orange);text-align:center;" data-price-cny="${row.price_cny}">${priceDisplay}</td>
                    <td style="text-align:center;">
                        <div style="display:flex;align-items:center;gap:4px;justify-content:center;">
                            <button class="qty-btn-sub" data-delta="-1" style="width:24px;height:24px;background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;cursor:pointer;">−</button>
                            <input type="number" class="qty-input-sub" value="1" min="1" step="1" style="width:50px;text-align:center;padding:4px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);">
                            <button class="qty-btn-sub" data-delta="1" style="width:24px;height:24px;background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);border-radius:4px;cursor:pointer;">+</button>
                        </div>
                    </td>
                    <td class="subtotal-display" style="font-weight:600;color:var(--accent-orange);text-align:center;">${subtotalDisplay}</td>
                    <td style="text-align:center;">
                        <button class="add-single-sub" data-index="${idx}" style="background:var(--accent-orange);color:#0b1120;border:none;padding:4px 12px;border-radius:var(--radius-btn);font-size:12px;font-weight:600;cursor:pointer;">${t('addToCart')}</button>
                    </td>
                </tr>
            `;
        }).join('');

        contentHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="font-size:18px;color:var(--accent-blue);margin:0;">${escapeHtml(product.sku)}</h3>
                <button id="closeDetailModal2" class="btn" style="background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);padding:4px 14px;border-radius:var(--radius-btn);cursor:pointer;">✖</button>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid var(--border-color);border-radius:12px;overflow:hidden;">
                    <thead style="background:var(--bg-surface);">
                        <tr>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">#</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('image')}</th>
                            <th style="padding:8px 6px;text-align:left;color:var(--text-secondary);font-weight:600;">${t('sku')}</th>
                            <th style="padding:8px 6px;text-align:left;color:var(--text-secondary);font-weight:600;">${t('description')}</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('unit')}</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('price')}</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('quantity')}</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('subtotal')}</th>
                            <th style="padding:8px 6px;text-align:center;color:var(--text-secondary);font-weight:600;">${t('action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
            <div style="margin-top:12px;display:flex;justify-content:flex-end;gap:12px;">
                <button id="closeDetailModal" class="btn" style="background:var(--bg-surface);border:1px solid var(--border-color);color:var(--text-primary);padding:6px 18px;border-radius:var(--radius-btn);cursor:pointer;">${t('close')}</button>
            </div>
        `;
    }

    // 注入内容
    modalDiv.innerHTML = `
        <div class="modal-content" style="max-width:900px;width:95%;padding:16px 20px;">
            ${contentHtml}
        </div>
    `;
    document.body.appendChild(modalDiv);

    // ---- 事件绑定 ----
    const close = () => modalDiv.remove();
    document.getElementById('closeDetailModal')?.addEventListener('click', close);
    document.getElementById('closeDetailModal2')?.addEventListener('click', close);
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) close(); });

    // 数量控制（通用）
    modalDiv.querySelectorAll('.qty-btn-sub').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.modal-sku-card') || this.closest('tr');
            const input = card.querySelector('.qty-input-sub');
            let val = parseInt(input.value) || 1;
            val += parseInt(this.dataset.delta);
            if (val < 1) val = 1;
            input.value = val;
            updateSubtotal(card);
        });
    });
    modalDiv.querySelectorAll('.qty-input-sub').forEach(input => {
        input.addEventListener('change', function() {
            let val = parseInt(this.value) || 1;
            if (val < 1) val = 1;
            this.value = val;
            const card = this.closest('.modal-sku-card') || this.closest('tr');
            updateSubtotal(card);
        });
    });

    function updateSubtotal(container) {
        const priceCNY = parseFloat(container.dataset.priceCny) || 0;
        const priceUSD = exchangeRate > 0 ? priceCNY / exchangeRate : 0;
        const qty = parseInt(container.querySelector('.qty-input-sub').value) || 1;
        const subtotal = priceUSD * qty;
        const subtotalDisplay = isAuth ? formatPriceUSD(subtotal) : '***';
        const subtotalEl = container.querySelector('.subtotal-display');
        if (subtotalEl) subtotalEl.textContent = subtotalDisplay;
    }

    // 单个加入按钮
    modalDiv.querySelectorAll('.add-single-sub').forEach(btn => {
        btn.addEventListener('click', function() {
            const container = this.closest('.modal-sku-card') || this.closest('tr');
            const sku = container.dataset.sku;
            const priceCNY = parseFloat(container.dataset.priceCny) || 0;
            const unit = container.dataset.unit;
            const desc = container.dataset.desc;
            const qty = parseInt(container.querySelector('.qty-input-sub').value) || 1;
            if (!isAuthorized) { showAuthPrompt(); return; }
            const selected = [{ sku, price_cny: priceCNY, unit, desc, quantity: qty }];
            addSubSKUsToCart(product, selected);
        });
    });
}

// ============================================================
// 授权提示 & 联系客服
// ============================================================
function showAuthPrompt() {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="modal-content auth-prompt">
            <h3>🔐 ${t('needAuth')}</h3>
            <p>${t('authRequiredText')}</p>
            <div class="auth-prompt-buttons">
                <button id="closePromptBtn" class="btn">${t('close')}</button>
                <button id="contactServiceBtn" class="btn" style="background:var(--accent-orange); color:#0b1120; font-weight:600; padding:10px 28px;">${t('contactService')}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    document.getElementById('closePromptBtn')?.addEventListener('click', () => modalDiv.remove());
    document.getElementById('contactServiceBtn')?.addEventListener('click', () => {
        modalDiv.remove();
        showContactModal();
    });
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
}

function showContactModal() {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="modal-content contact-modal">
            <h3>📞 ${t('contactService')}</h3>
            <div class="contact-info">
                <span class="label">WhatsApp</span>
                <a href="https://wa.me/+8616658010354" target="_blank" style="color:#25D366; font-weight:500;">${currentLang==='zh'?'点击联系':'Click to WhatsApp'}</a>
            </div>
            <div class="contact-info">
                <span class="label">Email</span>
                <div>
                    <span id="emailAddr">x8230p@gmial.com</span>
                    <button class="copy-btn" data-copy-target="emailAddr">${t('copy')}</button>
                </div>
            </div>
            <div style="margin: 16px 0 8px;">
                <div style="font-weight:500; margin-bottom:6px; color:var(--text-secondary);">${currentLang==='zh'?'微信扫码联系':'WeChat QR'}</div>
                <div class="qr-code">
                    <img src="/uploads/wechat-qr.png" alt="WeChat QR" style="width:100%; display:block;">
                </div>
                <div style="margin-top:8px;">
                    <span id="wechatId">KUS_Ryan</span>
                    <button class="copy-btn" data-copy-target="wechatId">${t('copy')}</button>
                </div>
            </div>
            <div class="auth-input-group">
                <input type="text" id="modalAuthCode" placeholder="${t('authCodePlaceholder')}">
                <button id="modalSubmitAuth" class="auth-submit-btn">${t('submitAuth')}</button>
            </div>
            <button id="closeContactModal" class="close-modal-btn">${t('close')}</button>
        </div>
    `;
    document.body.appendChild(modalDiv);

    modalDiv.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            let text = document.getElementById(btn.dataset.copyTarget)?.innerText;
            if (text) {
                navigator.clipboard.writeText(text).then(() => showToast(t('copied')))
                    .catch(() => showToast(t('copyFailed')));
            }
        });
    });

    const qrImg = modalDiv.querySelector('.qr-code img');
    if (qrImg) {
        qrImg.addEventListener('click', () => {
            const bigModal = document.createElement('div');
            bigModal.className = 'modal-overlay';
            bigModal.innerHTML = `<div class="modal-content" style="text-align:center; max-width:400px;"><img src="${qrImg.src}" style="width:100%; border-radius:12px;"><button class="close-modal-btn" id="closeBigImg">${t('close')}</button></div>`;
            document.body.appendChild(bigModal);
            document.getElementById('closeBigImg')?.addEventListener('click', () => bigModal.remove());
            bigModal.addEventListener('click', (e) => { if (e.target === bigModal) bigModal.remove(); });
        });
    }

    const authInput = document.getElementById('modalAuthCode');
    const submitBtn = document.getElementById('modalSubmitAuth');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const code = authInput?.value?.trim();
            if (!code) { showToast(t('authCodeRequired')); return; }
            const success = await verifyAuthCode(code);
            if (success) modalDiv.remove();
        });
    }
    if (authInput) {
        authInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && submitBtn) submitBtn.click();
        });
    }
    document.getElementById('closeContactModal')?.addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
}

// ============================================================
// 分类导航
// ============================================================
async function fetchCategories() {
    try {
        const res = await fetch(API_BASE + '/categories');
        const data = await res.json();
        allCategories = data;
        return data;
    } catch (e) {
        console.warn('分类加载失败', e);
        return [];
    }
}

function renderCategoryNav() {
    const container = document.getElementById('categoryContainer');
    if (!container) return;

    const groups = {};
    allCategories.forEach(cat => {
        if (!groups[cat.main_cat]) groups[cat.main_cat] = [];
        groups[cat.main_cat].push(cat);
    });

    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<div style="padding:8px 0;color:var(--text-muted);font-size:14px;">暂无分类</div>';
        return;
    }

    const mainCatMap = {
        '双光透镜': { zh: '双光透镜', en: 'Bi-Lens' },
        'LED雾灯': { zh: 'LED雾灯', en: 'LED Fog Light' },
        'LED矩阵': { zh: 'LED矩阵', en: 'LED Matrix' },
        '恶魔眼DHL': { zh: '恶魔眼DHL', en: 'Demon Eye DHL' },
        '改装配件': { zh: '改装配件', en: 'Accessories' },
        '装饰罩': { zh: '装饰罩', en: 'Shroud' },
        '5D装饰罩': { zh: '5D装饰罩', en: '5D Shroud' },
        '解码器': { zh: '解码器', en: 'Decoder' },
        '线束和插头': { zh: '线束和插头', en: 'Harness & Plug' },
        '防尘罩': { zh: '防尘罩', en: 'Dust Cover' },
        '改装工具': { zh: '改装工具', en: 'Tools' }
    };

    let html = `<div class="main-cats-horizontal">`;
    Object.keys(groups).forEach(mainCat => {
        const displayName = mainCatMap[mainCat]?.[currentLang] || mainCat;
        const isActive = (currentMainCat === mainCat);
        html += `
            <button class="main-cat-tab ${isActive ? 'active' : ''}" data-main="${mainCat}">
                ${escapeHtml(displayName)}
            </button>
        `;
    });
    html += `</div>`;
    html += `<div id="subCatContainer" class="sub-cat-container"></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.main-cat-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const mainCat = this.dataset.main;
            container.querySelectorAll('.main-cat-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentMainCat = mainCat;
            currentSubCat = 'all';
            renderSubCategories(mainCat);
            refreshProductList();
        });
    });

    const firstMain = Object.keys(groups)[0];
    if (currentMainCat === 'all' || !groups[currentMainCat]) {
        currentMainCat = firstMain;
        const firstTab = container.querySelector('.main-cat-tab');
        if (firstTab) firstTab.classList.add('active');
        renderSubCategories(firstMain);
    } else {
        renderSubCategories(currentMainCat);
        container.querySelectorAll('.main-cat-tab').forEach(b => {
            if (b.dataset.main === currentMainCat) b.classList.add('active');
        });
    }
}

function renderSubCategories(mainCat) {
    const subContainer = document.getElementById('subCatContainer');
    if (!subContainer) return;
    const subCats = allCategories.filter(c => c.main_cat === mainCat);
    if (subCats.length === 0) {
        subContainer.innerHTML = '';
        return;
    }
    let html = '';
    subCats.forEach(sub => {
        const subName = currentLang === 'zh' ? sub.name_zh : sub.name_en;
        const isActive = (currentSubCat === sub.sub_cat);
        html += `
            <button class="sub-cat-tab ${isActive ? 'active' : ''}" data-main="${mainCat}" data-sub="${sub.sub_cat}">
                ${escapeHtml(subName)}
            </button>
        `;
    });
    subContainer.innerHTML = html;

    subContainer.querySelectorAll('.sub-cat-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const subCat = this.dataset.sub;
            currentSubCat = subCat;
            subContainer.querySelectorAll('.sub-cat-tab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            refreshProductList();
        });
    });
}

// ============================================================
// UI 交互
// ============================================================
function openCartSidebar() {
    if (!isAuthorized) {
        showAuthPrompt();
        return;
    }
    const saved = localStorage.getItem('inquiry_cart');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            let valid = true;
            Object.keys(parsed).forEach(key => {
                if (parsed[key].price_cny === undefined) valid = false;
            });
            if (valid) {
                cart = parsed;
            } else {
                cart = {};
                localStorage.removeItem('inquiry_cart');
            }
        } catch (e) {
            cart = {};
            localStorage.removeItem('inquiry_cart');
        }
    }
    updateAllBadges();
    updateCartUI();
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
}

function closeCartSidebar() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function viewDetail() {
    if (Object.keys(cart).length === 0) {
        showToast(t('cartEmpty'));
        return;
    }
    if (!isAuthorized) {
        showToast(t('needAuth'));
        return;
    }
    localStorage.setItem('cartForDetail', JSON.stringify(cart));
    localStorage.setItem('shippingUSD', shippingUSD);
    localStorage.setItem('shippingCNY', shippingCNY);
    window.location.href = '/cart-detail.html';
}

function makeDraggable(element) {
    if (!element) return;
    let isDragging = false, startX, startY, initialLeft, initialTop;
    element.style.cursor = 'grab';
    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        let rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        element.style.cursor = 'grabbing';
        element.style.transition = 'none';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - startX, dy = e.clientY - startY;
        let newLeft = initialLeft + dx, newTop = initialTop + dy;
        newLeft = Math.max(10, Math.min(window.innerWidth - element.offsetWidth - 10, newLeft));
        newTop = Math.max(10, Math.min(window.innerHeight - element.offsetHeight - 10, newTop));
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'grab';
            element.style.transition = '';
            localStorage.setItem('floatCartLeft', element.style.left);
            localStorage.setItem('floatCartTop', element.style.top);
        }
    });
    let savedLeft = localStorage.getItem('floatCartLeft');
    let savedTop = localStorage.getItem('floatCartTop');
    if (savedLeft && savedTop) {
        element.style.left = savedLeft;
        element.style.top = savedTop;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    }
}

// ============================================================
// 初始化
// ============================================================
async function init() {
    let needClear = false;
    Object.keys(cart).forEach(key => {
        if (cart[key].price_cny === undefined) {
            needClear = true;
        }
    });
    if (needClear) {
        cart = {};
        localStorage.removeItem('inquiry_cart');
        console.log('检测到旧版购物车数据，已清空');
    }

    await fetchExchangeRate();
    await checkAuthStatus();
    await fetchCategories();
    updateStaticTexts();
    renderCategoryNav();
    tbody = document.getElementById('productListBody');
    sentinel = document.getElementById('loadingSentinel');
    await refreshProductList();
    if (sentinel) {
        let observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading) {
                isLoading = true;
                renderTableBody(false);
            }
        }, { threshold: 0.1 });
        observer.observe(sentinel);
    }

    // 事件绑定
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchKeyword = e.target.value;
        refreshProductList();
    });

    document.getElementById('langBtn')?.addEventListener('click', () => {
        currentLang = currentLang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('lang', currentLang);
        updateStaticTexts();
        renderCategoryNav();
        refreshProductList();
        updateCartUI();
        // 更新底部导航文字
        updateMobileNavText();
    });

    document.getElementById('openCartBtn')?.addEventListener('click', openCartSidebar);
    document.getElementById('floatCartBtn')?.addEventListener('click', openCartSidebar);
    document.getElementById('closeCartBtn')?.addEventListener('click', closeCartSidebar);
    document.getElementById('overlay')?.addEventListener('click', closeCartSidebar);
    document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
    document.getElementById('viewDetailBtn')?.addEventListener('click', viewDetail);

    // ===== 手机端底部导航：只保留购物车按钮 =====
    document.getElementById('mobileCartBtn')?.addEventListener('click', openCartSidebar);
    document.getElementById('mobileCartBtn')?.classList.add('active');
    // 初始化底部导航文字
    updateMobileNavText();

    // 运费输入
    const usdInput = document.getElementById('shippingUSD');
    const cnyInput = document.getElementById('shippingCNY');
    if (usdInput) {
        usdInput.addEventListener('input', () => {
            let val = parseFloat(usdInput.value) || 0;
            shippingUSD = val;
            shippingCNY = val * exchangeRate;
            if (cnyInput) cnyInput.value = shippingCNY.toFixed(2);
            updateCartUI();
        });
    }
    if (cnyInput) {
        cnyInput.addEventListener('input', () => {
            let val = parseFloat(cnyInput.value) || 0;
            shippingCNY = val;
            shippingUSD = val / exchangeRate;
            if (usdInput) usdInput.value = shippingUSD.toFixed(2);
            updateCartUI();
        });
    }

    makeDraggable(document.getElementById('floatCartBtn'));
    updateAllBadges();
    updateCartUI();
}

// 新增：更新底部导航文字
function updateMobileNavText() {
    const mobileLabel = document.querySelector('#mobileCartBtn .nav-label');
    if (mobileLabel) {
        mobileLabel.innerText = t('cart');
    }
    // 更新角标（已在 updateAllBadges 中更新）
}

function updateStaticTexts() {
    document.getElementById('logoSubtitle').innerText = t('logoSubtitle');
    document.getElementById('searchInput').placeholder = t('searchPlaceholder');
    document.getElementById('langBtn').innerText = t('langBtn');
    document.getElementById('openCartBtn').innerHTML = `🛒 ${t('cart')} <span id="cartCount">${Object.keys(cart).length}</span>`;
    document.getElementById('cartTitle').innerText = t('cartTitle');
    document.getElementById('shippingLabel').innerText = t('shipping');
    document.getElementById('summaryPrefix').innerText = t('listSummary');
    document.getElementById('unitPieces').innerText = t('pieces');
    document.getElementById('unitVarieties').innerText = t('varieties');
    document.getElementById('totalAmountPrefix').innerText = t('totalAmount');
    document.getElementById('viewDetailText').innerText = t('viewDetail');
    document.getElementById('clearCartText').innerText = t('clearCart');
    document.getElementById('thImage').innerText = t('image');
    document.getElementById('thImage1').innerText = t('image1');
    document.getElementById('thSku').innerText = t('sku');
    document.getElementById('thCategory').innerText = t('category');
    document.getElementById('thDesc').innerText = t('description');
    document.getElementById('thUnit').innerText = t('unit');
    document.getElementById('thPrice').innerText = t('price');
    document.getElementById('thAction').innerText = t('action');
    document.getElementById('loadingSentinel').innerText = t('loading');
    // 更新底部导航文字
    updateMobileNavText();
}

init();