let allProducts = [];
let filteredProducts = [];
let allCategories = [];
let allCustomers = [];
let selectedCustomer = '';
let isUnlocked = false;
let currentView = 'main'; // 'main' 或 'customer'
let currentCustomerData = null;

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
        setupViewSwitcher();
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

// 设置视图切换功能
function setupViewSwitcher() {
    const mainViewBtn = document.getElementById('mainViewBtn');
    const customerViewBtn = document.getElementById('customerViewBtn');
    
    mainViewBtn.addEventListener('click', () => switchToMainView());
    customerViewBtn.addEventListener('click', () => switchToCustomerView());
    
    // 设置客户专属界面的按钮
    document.getElementById('backToCustomerSelect').addEventListener('click', () => {
        showCustomerSelection();
    });
    
    document.getElementById('switchCustomer').addEventListener('click', () => {
        showCustomerSelection();
    });
}

// 切换到主页面视图
function switchToMainView() {
    currentView = 'main';
    
    // 更新按钮状态
    document.getElementById('mainViewBtn').classList.add('active');
    document.getElementById('customerViewBtn').classList.remove('active');
    
    // 显示/隐藏界面
    document.getElementById('mainViewContent').style.display = 'block';
    document.getElementById('customerSelectionScreen').style.display = 'none';
    document.getElementById('customerProductsScreen').style.display = 'none';
    
    // 重新渲染主页面
    filteredProducts = allProducts;
    renderProducts();
    updateSearchStats();
}

// 切换到客户专属视图
function switchToCustomerView() {
    currentView = 'customer';
    
    // 更新按钮状态
    document.getElementById('mainViewBtn').classList.remove('active');
    document.getElementById('customerViewBtn').classList.add('active');
    
    // 隐藏主页面内容
    document.getElementById('mainViewContent').style.display = 'none';
    document.getElementById('customerProductsScreen').style.display = 'none';
    
    // 显示客户选择界面
    showCustomerSelection();
}

// 显示客户选择界面
function showCustomerSelection() {
    document.getElementById('customerSelectionScreen').style.display = 'block';
    document.getElementById('customerProductsScreen').style.display = 'none';
    
    // 生成客户按钮
    generateCustomerButtons();
}

// 生成客户按钮
function generateCustomerButtons() {
    const container = document.getElementById('customerButtons');
    
    const buttonsHtml = allCustomers.map(customer => {
        // 计算该客户的专属商品数量
        const customerProductCount = allProducts.filter(product => 
            product.customer_prices && 
            product.customer_prices.some(cp => cp.customer_id === customer.id)
        ).length;
        
        return `
            <button class="customer-btn" onclick="selectCustomerForView('${customer.id}', '${customer.name}')">
                ${customer.name}
                <div class="customer-count">${customerProductCount} 个专属商品</div>
            </button>
        `;
    }).join('');
    
    container.innerHTML = buttonsHtml;
}

// 选择客户查看专属商品
function selectCustomerForView(customerId, customerName) {
    currentCustomerData = { id: customerId, name: customerName };
    
    // 筛选该客户的专属商品
    filteredProducts = allProducts.filter(product => 
        product.customer_prices && 
        product.customer_prices.some(cp => cp.customer_id === customerId)
    );
    
    // 显示客户专属商品界面
    document.getElementById('customerSelectionScreen').style.display = 'none';
    document.getElementById('customerProductsScreen').style.display = 'block';
    document.getElementById('currentCustomerName').textContent = `${customerName} 专属商品`;
    
    // 渲染专属商品
    renderCustomerProducts(customerId);
}

// 渲染客户专属商品
function renderCustomerProducts(customerId) {
    const container = document.getElementById('productList');
    
    if (filteredProducts.length === 0) {
        container.innerHTML = '<div class="no-results">该客户暂无专属商品</div>';
        return;
    }
    
    const html = filteredProducts.map(product => {
        const customerPricing = product.customer_prices.find(cp => cp.customer_id === customerId);
        const customerPrice = customerPricing.price;
        const savings = product.sell_price - customerPrice;
        
        return `
        <div class="customer-product-card">
            <div class="product-name">${product.name}</div>
            ${product.specification ? `<div class="product-spec">${product.specification}</div>` : ''}
            
            <div class="customer-price-highlight">
                <div class="price-label">您的专属价格</div>
                <div class="price-value">¥${customerPrice.toFixed(2)}</div>
            </div>
            
            <div class="price-comparison">
                <span>通用价格: <span class="original-price">¥${product.sell_price.toFixed(2)}</span></span>
                <span class="savings">省 ¥${savings.toFixed(2)}</span>
            </div>
            
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
                    <span class="info-label">总库存</span>
                    <span class="info-value">${product.main_stock + product.warehouse_a_stock + product.warehouse_b_stock}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    container.innerHTML = html;
}
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
    // 如果是客户专属视图，使用专门的渲染函数
    if (currentView === 'customer' && currentCustomerData) {
        renderCustomerProducts(currentCustomerData.id);
        return;
    }
    
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
