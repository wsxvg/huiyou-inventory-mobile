let allProducts = [];
let filteredProducts = [];
let allCategories = [];
let allCustomers = [];
let filteredCustomers = []; // 新增：筛选后的客户列表
let selectedCustomer = '';
let isUnlocked = false;
let currentView = 'main'; // 'main' 或 'customer'
let currentCustomerData = null;
let customerProductsFiltered = []; // 新增：客户专属商品的筛选结果

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
        setupCustomerSearch(); // 新增：设置客户搜索
        renderProducts();
        updateSearchStats();
        
        isUnlocked = true;
        
        // 设置定期检查更新（每5分钟检查一次）
        setInterval(async () => {
            try {
                await loadEncryptedData(password);
                console.log('数据已自动更新');
            } catch (error) {
                console.log('自动更新失败:', error);
            }
        }, 5 * 60 * 1000); // 5分钟
        
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
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const response = await fetch(`encrypted_products.json?t=${timestamp}`);
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

// 设置客户搜索功能
function setupCustomerSearch() {
    const customerSearchInput = document.getElementById('customerSearchInput');
    const customerProductSearchInput = document.getElementById('customerProductSearchInput');
    let searchTimeout;
    
    // 客户搜索
    customerSearchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performCustomerSearch();
        }, 300);
    });
    
    // 客户专属商品搜索
    customerProductSearchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performCustomerProductFilter();
        }, 300);
    });
}

// 执行客户搜索
function performCustomerSearch() {
    const searchQuery = document.getElementById('customerSearchInput').value.trim().toLowerCase();
    
    if (searchQuery) {
        filteredCustomers = allCustomers.filter(customer => 
            customer.name.toLowerCase().includes(searchQuery)
        );
    } else {
        filteredCustomers = allCustomers;
    }
    
    generateCustomerButtons();
    updateCustomerSearchStats();
}

// 更新客户搜索统计
function updateCustomerSearchStats() {
    const stats = document.getElementById('customerSearchStats');
    const total = allCustomers.length;
    const showing = filteredCustomers.length;
    
    if (showing === total) {
        stats.textContent = `共 ${total} 个客户`;
    } else {
        stats.textContent = `显示 ${showing} / ${total} 个客户`;
    }
}

// 设置客户专属商品的筛选功能
function setupCustomerProductFilters() {
    // 填充分类选项（只包含该客户专属商品的分类）
    const categoryFilter = document.getElementById('customerCategoryFilter');
    categoryFilter.innerHTML = '<option value="">全部分类</option>';
    
    const customerCategories = [...new Set(customerProductsFiltered.map(product => product.category_name))];
    customerCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    // 监听筛选变化
    categoryFilter.addEventListener('change', performCustomerProductFilter);
    document.getElementById('customerStockFilter').addEventListener('change', performCustomerProductFilter);
}

// 执行客户专属商品筛选
function performCustomerProductFilter() {
    if (!currentCustomerData) return;
    
    const category = document.getElementById('customerCategoryFilter').value;
    const stockStatus = document.getElementById('customerStockFilter').value;
    const searchQuery = document.getElementById('customerProductSearchInput').value.trim().toLowerCase();
    
    // 获取该客户的所有专属商品
    const customerProducts = allProducts.filter(product => 
        product.customer_prices && 
        product.customer_prices.some(cp => cp.customer_id === currentCustomerData.id)
    );
    
    // 应用筛选条件
    customerProductsFiltered = customerProducts.filter(product => {
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
                    if (totalStock > 10 || totalStock <= 0) return false;
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
    
    renderCustomerProducts(currentCustomerData.id);
    updateCustomerProductSearchStats();
}

// 更新客户专属商品搜索统计
function updateCustomerProductSearchStats() {
    const stats = document.getElementById('customerProductSearchStats');
    const total = allProducts.filter(product => 
        product.customer_prices && 
        product.customer_prices.some(cp => cp.customer_id === currentCustomerData.id)
    ).length;
    const showing = customerProductsFiltered.length;
    
    if (showing === total) {
        stats.textContent = `共 ${total} 个专属商品`;
    } else {
        stats.textContent = `显示 ${showing} / ${total} 个专属商品`;
    }
}
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
    
    // 清空商品列表（因为还没选择客户）
    document.getElementById('productList').innerHTML = '';
    
    // 显示客户选择界面
    showCustomerSelection();
}

// 显示客户选择界面
function showCustomerSelection() {
    document.getElementById('customerSelectionScreen').style.display = 'block';
    document.getElementById('customerProductsScreen').style.display = 'none';
    
    // 初始化客户列表
    filteredCustomers = allCustomers;
    generateCustomerButtons();
    updateCustomerSearchStats();
    
    // 清空搜索框
    document.getElementById('customerSearchInput').value = '';
}

// 生成客户按钮
function generateCustomerButtons() {
    const container = document.getElementById('customerButtons');
    
    const buttonsHtml = filteredCustomers.map(customer => {
        // 计算该客户的专属商品数量
        const customerProductCount = allProducts.filter(product => 
            product.customer_prices && 
            product.customer_prices.some(cp => cp.customer_id === customer.id)
        ).length;
        
        return `
            <button class="customer-btn" onclick="selectCustomerForView('${customer.id}', '${customer.name}')">
                <div>
                    <div class="customer-btn-name">${customer.name}</div>
                    <div class="customer-btn-info">${customerProductCount} 个专属商品</div>
                </div>
                <div class="customer-btn-arrow">></div>
            </button>
        `;
    }).join('');
    
    container.innerHTML = buttonsHtml;
}

// 选择客户查看专属商品
function selectCustomerForView(customerId, customerName) {
    currentCustomerData = { id: customerId, name: customerName };
    
    // 获取该客户的专属商品
    customerProductsFiltered = allProducts.filter(product => 
        product.customer_prices && 
        product.customer_prices.some(cp => cp.customer_id === customerId)
    );
    
    // 显示客户专属商品界面
    document.getElementById('customerSelectionScreen').style.display = 'none';
    document.getElementById('customerProductsScreen').style.display = 'block';
    document.getElementById('currentCustomerName').textContent = `${customerName} 专属商品`;
    
    // 设置筛选功能
    setupCustomerProductFilters();
    
    // 渲染专属商品
    renderCustomerProducts(customerId);
    updateCustomerProductSearchStats();
    
    // 清空搜索和筛选
    document.getElementById('customerProductSearchInput').value = '';
    document.getElementById('customerCategoryFilter').value = '';
    document.getElementById('customerStockFilter').value = '';
}

// 渲染客户专属商品
function renderCustomerProducts(customerId) {
    const container = document.getElementById('productList');
    
    if (customerProductsFiltered.length === 0) {
        container.innerHTML = '<div class="no-results">没有找到匹配的专属商品</div>';
        return;
    }
    
    const html = customerProductsFiltered.map(product => {
        const customerPricing = product.customer_prices.find(cp => cp.customer_id === customerId);
        const customerPrice = customerPricing.price;
        const savings = product.sell_price - customerPrice;
        
        return `
        <div class="customer-product-card">
            <div class="product-name">${product.name}</div>
            ${product.specification ? `<div class="product-spec">${product.specification}</div>` : ''}
            
            <div class="customer-price-highlight">
                <div class="price-label">${currentCustomerData.name}的价格</div>
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
    // 如果是客户专属视图且已选择客户，使用专门的渲染函数
    if (currentView === 'customer' && currentCustomerData) {
        renderCustomerProducts(currentCustomerData.id);
        return;
    }
    
    // 如果是客户专属视图但还没选择客户，不显示商品列表
    if (currentView === 'customer' && !currentCustomerData) {
        return; // 不渲染任何商品，因为用户还在客户选择界面
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
