let allProducts = [];
let filteredProducts = [];
let allCategories = [];
let allCustomers = [];
let selectedCustomer = '';
let isUnlocked = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 监听密码输入框的回车键
    document.getElementById('passwordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            unlockData();
        }
    });
});

// 解锁数据函数
async function unlockData() {
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('errorMessage');
    
    if (!password) {
        showError('请输入密码');
        return;
    }
    
    try {
        // 显示加载状态
        errorElement.textContent = '正在验证密码...';
        errorElement.style.color = '#666';
        
        // 尝试加载和解密数据
        await loadEncryptedData(password);
        
        // 解密成功，显示主界面
        document.getElementById('passwordScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // 初始化主界面
        setupFilters();
        setupSearch();
        renderProducts();
        updateSearchStats();
        
        isUnlocked = true;
        
    } catch (error) {
        console.error('解锁失败:', error);
        showError('密码错误或数据加载失败');
    }
}

// 显示错误信息
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.color = '#e74c3c';
}

// 加载加密的商品数据
async function loadEncryptedData(password) {
    try {
        const response = await fetch('encrypted_products.json');
        if (!response.ok) {
            throw new Error('无法加载数据文件');
        }
        
        const encryptedData = await response.text();
        
        // 解密数据 - 兼容 Python AES 加密
        const decryptedText = await decryptAESData(encryptedData.trim(), password);
        
        if (!decryptedText) {
            throw new Error('密码错误');
        }
        
        const data = JSON.parse(decryptedText);
        
        allProducts = data.products;
        allCategories = data.categories || [];
        allCustomers = data.customers || [];
        filteredProducts = allProducts;
        
        updateLastUpdated(data.last_updated);
        
    } catch (error) {
        throw new Error('密码错误或数据格式不正确');
    }
}

// 解密 AES 数据（兼容 Python AES 加密）
async function decryptAESData(encryptedBase64, password) {
    try {
        // Base64 解码
        const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedBase64);
        
        // 提取 IV（前16字节）和加密数据
        const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4));
        const encrypted = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(4));
        
        // 生成密钥（SHA256）
        const key = CryptoJS.SHA256(password);
        
        // 解密
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: encrypted },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );
        
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        throw new Error('解密失败');
    }
}

// 更新最后更新时间
function updateLastUpdated(timestamp) {
    const date = new Date(timestamp);
    const formatted = date.toLocaleString('zh-CN');
    document.getElementById('lastUpdated').textContent = `最后更新: ${formatted}`;
}

// 设置筛选功能
function setupFilters() {
    // 填充分类选项
    const categoryFilter = document.getElementById('categoryFilter');
    allCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    // 填充客户选项
    const customerSelect = document.getElementById('customerSelect');
    allCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
    });

    // 监听筛选变化
    categoryFilter.addEventListener('change', performCombinedFilter);
    document.getElementById('stockFilter').addEventListener('change', performCombinedFilter);
    customerSelect.addEventListener('change', function() {
        selectedCustomer = this.value;
        const selectedCustomerName = this.options[this.selectedIndex].text;
        
        // 更新价格显示
        renderProducts();
        
        // 可选：显示当前选择的客户
        console.log('选择客户:', selectedCustomerName);
    });
}

// 设置搜索功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performCombinedFilter();
        }, 300);
    });
}

// 执行组合筛选
function performCombinedFilter() {
    const category = document.getElementById('categoryFilter').value;
    const stockStatus = document.getElementById('stockFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
    
    filteredProducts = allProducts.filter(product => {
        // 分类筛选
        if (category && product.category_name !== category) {
            return false;
        }
        
        // 库存状态筛选
        if (stockStatus) {
            const totalStock = product.main_stock + product.warehouse_a_stock + product.warehouse_b_stock;
            switch(stockStatus) {
                case 'instock':
                    if (totalStock <= 0) return false;
                    break;
                case 'lowstock':
                    if (totalStock > 10 || totalStock <= 0) return false; // 假设10以下为库存不足
                    break;
                case 'outstock':
                    if (totalStock > 0) return false;
                    break;
            }
        }
        
        // 文本搜索
        if (searchQuery) {
            return product.name.toLowerCase().includes(searchQuery) ||
                   (product.specification && product.specification.toLowerCase().includes(searchQuery));
        }
        
        return true;
    });
    
    renderProducts();
    updateSearchStats();
}

// 更新搜索统计
function updateSearchStats() {
    const stats = document.getElementById('searchStats');
    const total = allProducts.length;
    const showing = filteredProducts.length;
    
    if (showing === total) {
        stats.textContent = `共 ${total} 个商品`;
    } else {
        stats.textContent = `显示 ${showing} / ${total} 个商品`;
    }
}

// 渲染商品列表
function renderProducts() {
    const container = document.getElementById('productList');
    
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="no-results">没有找到匹配的商品</div>';
        return;
    }
    
    const html = filteredProducts.map(product => {
        // 获取客户价格
        const customerPrice = getCustomerPrice(product);
        const hasCustomerPrice = customerPrice !== null;
        
        return `
        <div class="product-card">
            <div class="product-name">${product.name}</div>
            ${product.specification ? `<div class="product-spec">${product.specification}</div>` : ''}
            
            <div class="product-info">
                <div class="info-item">
                    <span class="info-label">分类</span>
                    <span class="info-value">${product.category_name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">单位</span>
                    <span class="info-value">${product.unit}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">门店库存</span>
                    <span class="info-value">${product.main_stock}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">仓库A</span>
                    <span class="info-value">${product.warehouse_a_stock}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">仓库B</span>
                    <span class="info-value">${product.warehouse_b_stock}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">总库存</span>
                    <span class="info-value">${product.main_stock + product.warehouse_a_stock + product.warehouse_b_stock}</span>
                </div>
            </div>
            
            <div class="price-info">
                <div class="price-item cost-price">
                    <div class="price-label">进价</div>
                    <div class="price-value">¥${product.current_cost_price.toFixed(2)}</div>
                </div>
                <div class="price-item sell-price">
                    <div class="price-label">
                        ${hasCustomerPrice ? '通用售价' : '售价'}
                    </div>
                    <div class="price-value">¥${product.sell_price.toFixed(2)}</div>
                </div>
                ${hasCustomerPrice ? `
                <div class="price-item customer-price">
                    <div class="price-label">客户价格</div>
                    <div class="price-value">¥${customerPrice.toFixed(2)}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    }).join('');
    
    container.innerHTML = html;
}

// 获取客户价格
function getCustomerPrice(product) {
    if (!selectedCustomer || !product.customer_prices) {
        return null;
    }
    
    const customerPricing = product.customer_prices.find(cp => cp.customer_id === selectedCustomer);
    return customerPricing ? customerPricing.price : null;
}
