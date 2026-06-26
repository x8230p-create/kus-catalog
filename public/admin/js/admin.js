// ============================ 全局 ============================
const API_BASE = '/api';
let adminToken = localStorage.getItem('admin_token');
let allProducts = [], allCategories = [], allSubSkus = [];

async function request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await fetch(API_BASE + url, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

const api = {
    products: {
        fetch: () => request('/products'),
        create: (fd) => fetch(API_BASE + '/products', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: fd
        }).then(r => { if (!r.ok) throw new Error('创建失败'); return r.json(); }),
        update: (id, fd) => fetch(API_BASE + `/products/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}` },
            body: fd
        }).then(r => { if (!r.ok) throw new Error('更新失败'); return r.json(); }),
        delete: (id) => request(`/products/${id}`, { method: 'DELETE' })
    },
    categories: {
        fetch: () => request('/categories'),
        create: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => request(`/categories/${id}`, { method: 'DELETE' })
    },
    authCodes: {
        fetch: () => request('/auth-codes'),
        generate: () => request('/auth-codes', { method: 'POST' }),
        delete: (id) => request(`/auth-codes/${id}`, { method: 'DELETE' })
    },
    subSkus: {
        fetch: (productId) => request(`/products/${productId}/sub-skus`),
        create: (productId, data) => request(`/products/${productId}/sub-skus`, { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => request(`/products/sub-skus/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => request(`/products/sub-skus/${id}`, { method: 'DELETE' })
    }
};

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

async function login(username, password) {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    adminToken = res.token;
    localStorage.setItem('admin_token', adminToken);
    return res;
}

// ============================ 侧边栏 & 内容 ============================
const sidebarContainer = document.getElementById('sidebarContainer');
const contentContainer = document.getElementById('contentContainer');

const tabs = [
    { id: 'authcodes', label: '🔑 授权码管理' },
    { id: 'products', label: '📦 产品管理' },
    { id: 'categories', label: '📁 分类管理' },
    { id: 'subskus', label: '🧩 子SKU管理' }
];
let currentTab = 'authcodes';

function renderSidebar() {
    sidebarContainer.innerHTML = tabs.map(tab =>
        `<button class="tab-btn ${currentTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            <span class="icon">${tab.label.split(' ')[0]}</span> ${tab.label}
        </button>`
    ).join('');
    sidebarContainer.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    currentTab = tabId;
    renderSidebar();
    renderContent(tabId);
}

function renderContent(tabId) {
    contentContainer.innerHTML = '';
    switch (tabId) {
        case 'authcodes': renderAuthCodes(); break;
        case 'products': renderProducts(); break;
        case 'categories': renderCategories(); break;
        case 'subskus': renderSubSkus(); break;
        default: contentContainer.innerHTML = '<div class="text-muted">未知页面</div>';
    }
}

// ============================ 授权码 ============================
async function renderAuthCodes() {
    contentContainer.innerHTML = `
        <div class="card">
            <div class="card-header"><div class="card-title">🔑 授权码管理</div><button id="genCodeBtn" class="btn-primary">+ 生成新授权码</button></div>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>授权码</th><th>生成时间</th><th>过期时间</th><th>状态</th><th>操作</th></tr></thead><tbody id="authCodesTableBody"><tr><td colspan="6" class="text-center text-muted">加载中...</td></tr></tbody></table></div>
        </div>
    `;
    document.getElementById('genCodeBtn').addEventListener('click', async () => {
        try {
            const result = await api.authCodes.generate();
            alert('✅ 授权码已生成：' + result.code);
            await loadAuthCodesTable();
        } catch (err) { alert('生成失败: ' + err.message); }
    });
    await loadAuthCodesTable();
}

async function loadAuthCodesTable() {
    const tbody = document.getElementById('authCodesTableBody');
    try {
        const codes = await api.authCodes.fetch();
        if (!codes.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无授权码</td></tr>';
            return;
        }
        tbody.innerHTML = codes.map(c => `
            <tr>
                <td>${c.id}</td>
                <td><span class="code-cell">${c.code}</span> <button class="btn-secondary copy-btn" data-code="${c.code}" style="padding:2px 10px; font-size:0.7rem;">复制</button></td>
                <td>${new Date(c.created_at).toLocaleString()}</td>
                <td>${c.expires_at ? new Date(c.expires_at).toLocaleString() : '永久'}</td>
                <td>${c.used ? '已使用' : '未使用'}</td>
                <td><button class="btn-danger delete-code" data-id="${c.id}">删除</button></td>
            </tr>
        `).join('');
        tbody.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.code).then(() => alert('已复制')).catch(() => {});
        }));
        tbody.querySelectorAll('.delete-code').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('确定删除？')) {
                await api.authCodes.delete(btn.dataset.id);
                await loadAuthCodesTable();
            }
        }));
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">加载失败</td></tr>';
    }
}

// ============================ 产品管理 ============================
async function loadCategoriesForProducts() {
    try {
        const cats = await api.categories.fetch();
        allCategories = cats;
        return cats;
    } catch (e) {
        console.error('加载分类失败', e);
        return [];
    }
}

async function renderProducts() {
    await loadCategoriesForProducts();

    contentContainer.innerHTML = `
        <div class="card">
            <div class="card-header"><div class="card-title">📦 产品管理</div><div class="flex-row"><input type="text" id="searchProduct" class="search-input" placeholder="搜索 SKU / 描述"><button id="addProductBtn" class="btn-primary">+ 添加产品</button></div></div>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>SKU</th><th>主分类</th><th>子分类</th><th>价格 (CNY)</th><th>操作</th></tr></thead><tbody id="productsTableBody"><tr><td colspan="6" class="text-center text-muted">加载中...</td></tr></tbody></table></div>
        </div>
    `;
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('searchProduct').addEventListener('input', (e) => {
        const keyword = e.target.value.toLowerCase();
        document.querySelectorAll('#productsTableBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(keyword) ? '' : 'none';
        });
    });
    await loadProductsTable();
}

async function loadProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    try {
        const prods = await api.products.fetch();
        allProducts = prods;
        if (!prods.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无产品</td></tr>';
            return;
        }
        tbody.innerHTML = prods.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHtml(p.sku)}</td>
                <td>${escapeHtml(p.main_cat)}</td>
                <td>${escapeHtml(p.sub_cat)}</td>
                <td>¥${p.price_cny || 0}</td>
                <td><button class="btn-edit edit-product" data-id="${p.id}">编辑</button> <button class="btn-danger delete-product" data-id="${p.id}">删除</button></td>
            </tr>
        `).join('');
        tbody.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', () => openProductModal(parseInt(btn.dataset.id))));
        tbody.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('确定删除？')) {
                await api.products.delete(btn.dataset.id);
                await loadProductsTable();
            }
        }));
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">加载失败</td></tr>';
    }
}

function openProductModal(id = null) {
    const isEdit = !!id;
    const product = isEdit ? allProducts.find(p => p.id === id) : null;

    const mainCats = [...new Set(allCategories.map(c => c.main_cat))];
    if (mainCats.length === 0) {
        alert('请先创建分类！');
        return;
    }
    const selectedMain = isEdit ? product.main_cat : mainCats[0];
    const subCats = allCategories.filter(c => c.main_cat === selectedMain).map(c => c.sub_cat);

    const mainOptions = mainCats.map(cat =>
        `<option value="${cat}" ${isEdit && product.main_cat === cat ? 'selected' : ''}>${cat}</option>`
    ).join('');

    const subOptions = subCats.map(sub =>
        `<option value="${sub}" ${isEdit && product.sub_cat === sub ? 'selected' : ''}>${sub}</option>`
    ).join('');

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';

    let imagesHtml = '';
    if (isEdit) {
        if (product?.img_url) {
            imagesHtml += `
                <div style="display:inline-block; margin:4px; border-radius:12px; overflow:hidden; width:80px; height:80px; border:1px solid var(--border-color);">
                    <img src="${product.img_url}" style="width:100%;height:100%;object-fit:cover;">
                    <div style="text-align:center;font-size:10px;color:var(--text-muted);">主图</div>
                </div>
            `;
        }
        if (product?.img_url_1) {
            imagesHtml += `
                <div style="display:inline-block; margin:4px; border-radius:12px; overflow:hidden; width:80px; height:80px; border:1px solid var(--border-color);">
                    <img src="${product.img_url_1}" style="width:100%;height:100%;object-fit:cover;">
                    <div style="text-align:center;font-size:10px;color:var(--text-muted);">图片1</div>
                </div>
            `;
        }
    }

    modalDiv.innerHTML = `
        <div class="modal-container">
            <h3>${isEdit ? '编辑产品' : '添加产品'}</h3>
            <form id="productForm" enctype="multipart/form-data">
                ${isEdit ? '<input type="hidden" name="id" value="' + id + '">' : ''}
                ${isEdit ? `<input type="hidden" name="existing_img_url" value="${product.img_url || ''}">` : ''}
                ${isEdit ? `<input type="hidden" name="existing_img_url_1" value="${product.img_url_1 || ''}">` : ''}
                <label>SKU *</label><input type="text" name="sku" value="${isEdit ? escapeHtml(product.sku) : ''}" required>
                <label>主分类 *</label>
                <select name="main_cat" id="mainCatSelect" required>
                    ${mainOptions}
                </select>
                <label>子分类 *</label>
                <select name="sub_cat" id="subCatSelect" required>
                    ${subOptions}
                </select>
                <label>单位 *</label><input type="text" name="unit" value="${isEdit ? escapeHtml(product.unit) : ''}" required>
                <label>人民币价格 (CNY)</label>
                <input type="number" step="0.01" name="price_cny" value="${isEdit ? product.price_cny : ''}">
                <label>价格显示</label><input type="text" name="price_mask" value="${isEdit ? escapeHtml(product.price_mask) : '***'}">
                <label>中文描述</label><textarea name="desc_zh">${isEdit ? escapeHtml(product.desc_zh || '') : ''}</textarea>
                <label>英文描述</label><textarea name="desc_en">${isEdit ? escapeHtml(product.desc_en || '') : ''}</textarea>
                <label>中文详情</label><textarea name="detail_zh">${isEdit ? escapeHtml(product.detail_zh || '') : ''}</textarea>
                <label>英文详情</label><textarea name="detail_en">${isEdit ? escapeHtml(product.detail_en || '') : ''}</textarea>
                <label>主图</label><input type="file" name="img" accept="image/*">
                <label style="margin-top:8px;">图片1（第二张图）</label><input type="file" name="img_1" accept="image/*">
                ${imagesHtml ? `<div style="margin:8px 0;"><span style="color:var(--text-secondary);">现有图片：</span><div style="display:flex;flex-wrap:wrap;gap:8px;">${imagesHtml}</div></div>` : ''}
                <div class="modal-buttons"><button type="button" class="btn-secondary" id="closeModalBtn">取消</button><button type="submit" class="btn-primary">保存</button></div>
            </form>
        </div>
    `;
    document.body.appendChild(modalDiv);

    const mainSelect = modalDiv.querySelector('#mainCatSelect');
    const subSelect = modalDiv.querySelector('#subCatSelect');

    function updateSubCategories() {
        const selectedMain = mainSelect.value;
        const subCats = allCategories.filter(c => c.main_cat === selectedMain).map(c => c.sub_cat);
        subSelect.innerHTML = subCats.map(sub =>
            `<option value="${sub}">${sub}</option>`
        ).join('');
        if (isEdit && product) {
            if (subCats.includes(product.sub_cat)) {
                subSelect.value = product.sub_cat;
            }
        }
    }

    mainSelect.addEventListener('change', updateSubCategories);

    if (isEdit) {
        mainSelect.value = product.main_cat;
        updateSubCategories();
        setTimeout(() => {
            if (subSelect.querySelector(`option[value="${product.sub_cat}"]`)) {
                subSelect.value = product.sub_cat;
            }
        }, 50);
    }

    modalDiv.querySelector('#closeModalBtn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });

    const form = modalDiv.querySelector('#productForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        if (!formData.get('price_cny')) formData.set('price_cny', '0');
        try {
            if (isEdit) {
                await api.products.update(id, formData);
            } else {
                await api.products.create(formData);
            }
            modalDiv.remove();
            await loadProductsTable();
        } catch (err) {
            alert('操作失败: ' + err.message);
        }
    });
}

// ============================ 分类管理 ============================
async function renderCategories() {
    contentContainer.innerHTML = `
        <div class="card">
            <div class="card-header"><div class="card-title">📁 分类管理</div><button id="addCategoryBtn" class="btn-primary">+ 添加分类</button></div>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>主分类</th><th>子分类</th><th>中文名</th><th>英文名</th><th>排序</th><th>操作</th></tr></thead><tbody id="categoriesTableBody"><tr><td colspan="7" class="text-center text-muted">加载中...</td></tr></tbody></table></div>
        </div>
    `;
    document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
    await loadCategoriesTable();
}

async function loadCategoriesTable() {
    const tbody = document.getElementById('categoriesTableBody');
    try {
        const cats = await api.categories.fetch();
        allCategories = cats;
        if (!cats.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">暂无分类</td></tr>';
            return;
        }
        tbody.innerHTML = cats.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(c.main_cat)}</td>
                <td>${escapeHtml(c.sub_cat)}</td>
                <td>${escapeHtml(c.name_zh)}</td>
                <td>${escapeHtml(c.name_en)}</td>
                <td>${c.sort_order}</td>
                <td><button class="btn-edit edit-cat" data-id="${c.id}">编辑</button> <button class="btn-danger delete-cat" data-id="${c.id}">删除</button></td>
            </tr>
        `).join('');
        tbody.querySelectorAll('.edit-cat').forEach(btn => btn.addEventListener('click', () => openCategoryModal(parseInt(btn.dataset.id))));
        tbody.querySelectorAll('.delete-cat').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('删除分类？')) {
                await api.categories.delete(btn.dataset.id);
                await loadCategoriesTable();
            }
        }));
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">加载失败</td></tr>';
    }
}

function openCategoryModal(id = null) {
    const isEdit = !!id;
    const cat = isEdit ? allCategories.find(c => c.id === id) : null;
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="modal-container">
            <h3>${isEdit ? '编辑分类' : '添加分类'}</h3>
            <form id="catForm">
                ${isEdit ? '<input type="hidden" name="id" value="' + id + '">' : ''}
                <label>主分类 *</label><input type="text" name="main_cat" value="${isEdit ? escapeHtml(cat.main_cat) : ''}" required>
                <label>子分类 *</label><input type="text" name="sub_cat" value="${isEdit ? escapeHtml(cat.sub_cat) : ''}" required>
                <label>中文名 *</label><input type="text" name="name_zh" value="${isEdit ? escapeHtml(cat.name_zh) : ''}" required>
                <label>英文名 *</label><input type="text" name="name_en" value="${isEdit ? escapeHtml(cat.name_en) : ''}" required>
                <label>排序</label><input type="number" name="sort_order" value="${isEdit ? cat.sort_order : 0}">
                <div class="modal-buttons"><button type="button" class="btn-secondary" id="closeModalBtn">取消</button><button type="submit" class="btn-primary">保存</button></div>
            </form>
        </div>
    `;
    document.body.appendChild(modalDiv);
    const form = modalDiv.querySelector('#catForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            main_cat: form.main_cat.value,
            sub_cat: form.sub_cat.value,
            name_zh: form.name_zh.value,
            name_en: form.name_en.value,
            sort_order: parseInt(form.sort_order.value)
        };
        try {
            if (isEdit) await api.categories.update(id, data);
            else await api.categories.create(data);
            modalDiv.remove();
            await loadCategoriesTable();
        } catch (err) { alert('保存失败: ' + err.message); }
    });
    modalDiv.querySelector('#closeModalBtn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
}

// ============================ 子SKU管理 ============================
async function renderSubSkus() {
    if (!allCategories.length) {
        try { await loadCategoriesForProducts(); } catch(e) {}
    }
    if (!allProducts.length) {
        try { const prods = await api.products.fetch(); allProducts = prods; } catch(e) {}
    }

    const mainCats = [...new Set(allCategories.map(c => c.main_cat))];
    const catOptions = mainCats.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    contentContainer.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">🧩 子SKU管理</div>
                <div class="flex-row">
                    <label style="color:var(--text-secondary);">分类筛选：</label>
                    <select id="filterCategorySelect" style="padding:6px 12px;border-radius:20px;border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-primary);">
                        <option value="all">全部</option>
                        ${catOptions}
                    </select>
                    <label style="color:var(--text-secondary);margin-left:12px;">选择产品：</label>
                    <select id="subSkuProductSelect"><option value="">-- 请选择 --</option></select>
                    <button id="addSubSkuBtn" class="btn-primary">+ 添加子SKU</button>
                </div>
            </div>
            <div class="table-wrap">
                <table><thead><tr><th>ID</th><th>SKU</th><th>单位</th><th>价格(CNY)</th><th>中文描述</th><th>英文描述</th><th>中文备注</th><th>英文备注</th><th>排序</th><th>操作</th></tr></thead>
                <tbody id="subSkusTableBody"><tr><td colspan="10" class="text-center text-muted">请选择产品</td></tr></tbody></table>
            </div>
        </div>
    `;

    document.getElementById('filterCategorySelect').addEventListener('change', () => {
        loadSubSkuProductSelect();
    });

    await loadSubSkuProductSelect();

    document.getElementById('addSubSkuBtn').addEventListener('click', () => openSubSkuModal());
    document.getElementById('subSkuProductSelect').addEventListener('change', () => loadSubSkusTable());
}

async function loadSubSkuProductSelect() {
    const select = document.getElementById('subSkuProductSelect');
    const filterCat = document.getElementById('filterCategorySelect').value;
    if (!select) return;

    let filteredProducts = allProducts;
    if (filterCat !== 'all') {
        filteredProducts = allProducts.filter(p => p.main_cat === filterCat);
    }

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- 请选择 --</option>' +
        filteredProducts.map(p => `<option value="${p.id}">${p.sku} (${p.main_cat})</option>`).join('');

    if (currentVal && filteredProducts.some(p => p.id == currentVal)) {
        select.value = currentVal;
    } else if (filteredProducts.length) {
        select.value = filteredProducts[0].id;
    }
    await loadSubSkusTable();
}

async function loadSubSkusTable() {
    const select = document.getElementById('subSkuProductSelect');
    const productId = select.value;
    const tbody = document.getElementById('subSkusTableBody');
    if (!productId) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">请选择产品</td></tr>';
        return;
    }
    try {
        const data = await api.subSkus.fetch(productId);
        allSubSkus = data.subSkus || [];
        if (!allSubSkus.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">暂无子SKU</td></tr>';
            return;
        }
        tbody.innerHTML = allSubSkus.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${escapeHtml(s.sku)}</td>
                <td>${escapeHtml(s.unit)}</td>
                <td>¥${s.price_cny || 0}</td>
                <td>${escapeHtml(s.desc_zh || '')}</td>
                <td>${escapeHtml(s.desc_en || '')}</td>
                <td>${escapeHtml(s.remark_zh || '')}</td>
                <td>${escapeHtml(s.remark_en || '')}</td>
                <td>${s.sort_order}</td>
                <td>
                    <button class="btn-edit edit-subsku" data-id="${s.id}">编辑</button>
                    <button class="btn-danger delete-subsku" data-id="${s.id}">删除</button>
                </td>
            </tr>
        `).join();

        tbody.querySelectorAll('.delete-subsku').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                const id = this.dataset.id;
                if (!confirm('确定删除该子SKU？')) return;
                try {
                    await api.subSkus.delete(id);
                    await loadSubSkusTable();
                } catch (err) {
                    alert('删除失败: ' + err.message);
                }
            });
        });

        tbody.querySelectorAll('.edit-subsku').forEach(btn => btn.addEventListener('click', () => openSubSkuModal(parseInt(btn.dataset.id))));
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">加载失败</td></tr>';
    }
}

function openSubSkuModal(id = null) {
    const isEdit = !!id;
    const subSku = isEdit ? allSubSkus.find(s => s.id === id) : null;
    const productId = document.getElementById('subSkuProductSelect').value;
    if (!productId) { alert('请先选择产品'); return; }
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="modal-container">
            <h3>${isEdit ? '编辑子SKU' : '添加子SKU'}</h3>
            <form id="subSkuForm">
                ${isEdit ? '<input type="hidden" name="id" value="' + id + '">' : ''}
                <label>SKU *</label><input type="text" name="sku" value="${isEdit ? escapeHtml(subSku.sku) : ''}" required>
                <label>单位 *</label><input type="text" name="unit" value="${isEdit ? escapeHtml(subSku.unit) : ''}" required>
                <label>人民币价格 (CNY)</label>
                <input type="number" step="0.01" name="price_cny" value="${isEdit ? subSku.price_cny : 0}">
                <label>中文描述</label><textarea name="desc_zh">${isEdit ? escapeHtml(subSku.desc_zh || '') : ''}</textarea>
                <label>英文描述</label><textarea name="desc_en">${isEdit ? escapeHtml(subSku.desc_en || '') : ''}</textarea>
                <label>中文备注</label><textarea name="remark_zh">${isEdit ? escapeHtml(subSku.remark_zh || '') : ''}</textarea>
                <label>英文备注</label><textarea name="remark_en">${isEdit ? escapeHtml(subSku.remark_en || '') : ''}</textarea>
                <label>排序</label><input type="number" name="sort_order" value="${isEdit ? subSku.sort_order : 0}">
                <div class="modal-buttons"><button type="button" class="btn-secondary" id="closeModalBtn">取消</button><button type="submit" class="btn-primary">保存</button></div>
            </form>
        </div>
    `;
    document.body.appendChild(modalDiv);
    const form = modalDiv.querySelector('#subSkuForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            sku: form.sku.value,
            unit: form.unit.value,
            price_cny: parseFloat(form.price_cny.value) || 0,
            desc_zh: form.desc_zh.value,
            desc_en: form.desc_en.value,
            remark_zh: form.remark_zh.value,
            remark_en: form.remark_en.value,
            sort_order: parseInt(form.sort_order.value) || 0
        };
        try {
            if (isEdit) await api.subSkus.update(id, data);
            else await api.subSkus.create(productId, data);
            modalDiv.remove();
            await loadSubSkusTable();
        } catch (err) { alert('操作失败: ' + err.message); }
    });
    modalDiv.querySelector('#closeModalBtn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('click', (e) => { if (e.target === modalDiv) modalDiv.remove(); });
}

// ============================ 登录/退出 ============================
const loginPanel = document.getElementById('loginPanel');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    location.reload();
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        await login(username, password);
        loginPanel.style.display = 'none';
        adminPanel.style.display = 'block';
        renderSidebar();
        renderContent('authcodes');
    } catch (err) {
        loginError.innerText = err.message;
    }
});

if (adminToken) {
    loginPanel.style.display = 'none';
    adminPanel.style.display = 'block';
    renderSidebar();
    renderContent('authcodes');
} else {
    loginPanel.style.display = 'flex';
    adminPanel.style.display = 'none';
}