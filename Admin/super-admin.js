// ================ SUPER ADMIN - QUẢN LÝ TẤT CẢ NGƯỜI DÙNG ================
let currentSuperAdmin = null;
let allUsers = [];
let filteredUsers = [];
let allOwners = new Set();

/**
 * Khởi tạo trang Super Admin
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Khởi tạo Super Admin...');
    
    // Kiểm tra đăng nhập
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            currentSuperAdmin = user;
            document.getElementById('admin-name').textContent = user.displayName || 'Super Admin';
            document.getElementById('admin-email').textContent = user.email;
            
            console.log('✅ Super Admin đã đăng nhập:', user.email);
            
            // Tải tất cả người dùng
            loadAllUsers();
            
            // Thiết lập event listeners
            setupEventListeners();
        } else {
            console.log('❌ Chưa đăng nhập, chuyển hướng...');
            window.location.href = '../login.html';
        }
    });
});

/**
 * Thiết lập event listeners
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('role-filter');
    const ownerFilter = document.getElementById('owner-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    if (roleFilter) {
        roleFilter.addEventListener('change', applyFilters);
    }
    
    if (ownerFilter) {
        ownerFilter.addEventListener('change', applyFilters);
    }
}

/**
 * Debounce function để tối ưu performance
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Tải TẤT CẢ người dùng từ Firebase (không lọc theo owner)
 */
function loadAllUsers() {
    console.log('📊 Đang tải TẤT CẢ người dùng...');
    
    db.ref('dataUser')
        .once('value', (snapshot) => {
            allUsers = [];
            allOwners.clear();
            
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const userData = child.val();
                    allUsers.push({
                        id: child.key,
                        ...userData
                    });
                    
                    // Thu thập danh sách owner
                    if (userData.ownerId) {
                        allOwners.add(userData.ownerId);
                    }
                });
            }
            
            console.log(`✅ Đã tải ${allUsers.length} người dùng`);
            console.log(`✅ Tìm thấy ${allOwners.size} owner khác nhau`);
            
            // Cập nhật dropdown owner filter
            updateOwnerFilter();
            
            // Cập nhật thống kê
            updateStatistics();
            
            // Hiển thị danh sách
            filteredUsers = [...allUsers];
            renderUsersTable();
        })
        .catch(error => {
            console.error('❌ Lỗi tải người dùng:', error);
            showError('Không thể tải dữ liệu người dùng');
        });
}

/**
 * Cập nhật dropdown owner filter
 */
function updateOwnerFilter() {
    const ownerFilter = document.getElementById('owner-filter');
    if (!ownerFilter) return;
    
    // Giữ option "Tất cả Owner"
    ownerFilter.innerHTML = '<option value="all">Tất cả Owner</option>';
    
    // Thêm các owner
    allOwners.forEach(ownerId => {
        const option = document.createElement('option');
        option.value = ownerId;
        option.textContent = `Owner: ${ownerId.substring(0, 8)}...`;
        ownerFilter.appendChild(option);
    });
}

/**
 * Cập nhật thống kê
 */
function updateStatistics() {
    const stats = {
        total: allUsers.length,
        owners: 0,
        managers: 0,
        players: 0
    };
    
    allUsers.forEach(user => {
        const role = (user.role || 'user').toLowerCase();
        if (role === 'admin' || role === 'owner') {
            stats.owners++;
        } else if (role === 'manager') {
            stats.managers++;
        } else {
            stats.players++;
        }
    });
    
    document.getElementById('total-users').textContent = stats.total;
    document.getElementById('total-owners').textContent = stats.owners;
    document.getElementById('total-managers').textContent = stats.managers;
    document.getElementById('total-players').textContent = stats.players;
}

/**
 * Áp dụng bộ lọc
 */
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const roleFilter = document.getElementById('role-filter').value;
    const ownerFilter = document.getElementById('owner-filter').value;
    
    console.log('🔍 Áp dụng bộ lọc:', { searchTerm, roleFilter, ownerFilter });
    
    filteredUsers = allUsers.filter(user => {
        // Lọc theo tìm kiếm
        let matchSearch = true;
        if (searchTerm) {
            const searchableText = [
                user.name || '',
                user.email || '',
                user.phone || '',
                user.address || '',
                user.id || ''
            ].join(' ').toLowerCase();
            
            matchSearch = searchableText.includes(searchTerm);
        }
        
        // Lọc theo vai trò
        let matchRole = true;
        if (roleFilter !== 'all') {
            const userRole = (user.role || 'user').toLowerCase();
            if (roleFilter === 'admin') {
                matchRole = userRole === 'admin' || userRole === 'owner';
            } else {
                matchRole = userRole === roleFilter;
            }
        }
        
        // Lọc theo owner
        let matchOwner = true;
        if (ownerFilter !== 'all') {
            matchOwner = user.ownerId === ownerFilter;
        }
        
        return matchSearch && matchRole && matchOwner;
    });
    
    console.log(`✅ Kết quả lọc: ${filteredUsers.length}/${allUsers.length} người dùng`);
    renderUsersTable();
}

/**
 * Reset bộ lọc
 */
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('role-filter').value = 'all';
    document.getElementById('owner-filter').value = 'all';
    
    filteredUsers = [...allUsers];
    console.log('🔄 Đã reset bộ lọc');
    renderUsersTable();
}

/**
 * Hiển thị bảng người dùng
 */
function renderUsersTable() {
    const wrapper = document.getElementById('table-wrapper');
    const showingCount = document.getElementById('showing-count');
    
    if (!wrapper) return;
    
    // Cập nhật số lượng hiển thị
    showingCount.textContent = `Hiển thị ${filteredUsers.length} / ${allUsers.length} người dùng`;
    
    // Nếu không có người dùng
    if (filteredUsers.length === 0) {
        wrapper.innerHTML = `
            <div class="empty-state">
                <div class="icon">
                    <span class="material-symbols-outlined">person_off</span>
                </div>
                <h3>Không tìm thấy người dùng</h3>
                <p>Thử thay đổi bộ lọc hoặc tìm kiếm khác</p>
            </div>
        `;
        return;
    }
    
    // Tạo HTML table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Người dùng</th>
                    <th>Số điện thoại</th>
                    <th>Địa chỉ</th>
                    <th>Vai trò</th>
                    <th>Owner ID</th>
                    <th>Thao tác</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredUsers.forEach(user => {
        const avatar = (user.name || 'U')[0].toUpperCase();
        const name = user.name || 'Chưa có tên';
        const email = user.email || 'Chưa có email';
        const phone = user.phone || 'Chưa có';
        const address = user.address || 'Chưa có';
        const role = (user.role || 'user').toLowerCase();
        const ownerId = user.ownerId || 'N/A';
        const ownerIdShort = ownerId !== 'N/A' ? ownerId.substring(0, 8) + '...' : 'N/A';
        
        // Chọn màu avatar
        const avatarColors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        ];
        const colorIndex = user.id.charCodeAt(0) % avatarColors.length;
        
        // Role badge
        let roleBadge = '';
        if (role === 'admin' || role === 'owner') {
            roleBadge = '<span class="role-badge role-owner">👑 Owner/Admin</span>';
        } else if (role === 'manager') {
            roleBadge = '<span class="role-badge role-manager">⚙️ Manager</span>';
        } else {
            roleBadge = '<span class="role-badge role-user">👤 User/Player</span>';
        }
        
        tableHTML += `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar" style="background: ${avatarColors[colorIndex]}">${avatar}</div>
                        <div class="user-details">
                            <div class="name">${name}</div>
                            <div class="email">${email}</div>
                            <div class="uid">ID: ${user.id}</div>
                        </div>
                    </div>
                </td>
                <td>${phone}</td>
                <td>${address}</td>
                <td>${roleBadge}</td>
                <td title="${ownerId}">${ownerIdShort}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon btn-view" onclick="viewUserDetail('${user.id}')" title="Xem chi tiết">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="btn-icon btn-edit" onclick="editUser('${user.id}')" title="Chỉnh sửa">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn-icon btn-delete" onclick="confirmDeleteUser('${user.id}', '${name}')" title="Xóa">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    wrapper.innerHTML = tableHTML;
}

/**
 * Xem chi tiết người dùng
 */
function viewUserDetail(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        alert('❌ Không tìm thấy người dùng');
        return;
    }
    
    const role = (user.role || 'user').toLowerCase();
    let roleText = '👤 User/Player';
    if (role === 'admin' || role === 'owner') roleText = '👑 Owner/Admin';
    else if (role === 'manager') roleText = '⚙️ Manager';
    
    const details = `
📋 THÔNG TIN CHI TIẾT NGƯỜI DÙNG
${'='.repeat(50)}

👤 Tên: ${user.name || 'Chưa có'}
📧 Email: ${user.email || 'Chưa có'}
📱 SĐT: ${user.phone || 'Chưa có'}
📍 Địa chỉ: ${user.address || 'Chưa có'}
🎭 Vai trò: ${roleText}

🆔 User ID: ${user.id}
👥 Owner ID: ${user.ownerId || 'N/A'}

${'='.repeat(50)}
    `;
    
    alert(details);
    console.log('👁️ Xem chi tiết:', user);
}

/**
 * Chỉnh sửa người dùng
 */
function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        alert('❌ Không tìm thấy người dùng');
        return;
    }
    
    const newName = prompt('✏️ Nhập tên mới:', user.name || '');
    if (newName === null) return; // User cancelled
    
    const newPhone = prompt('✏️ Nhập số điện thoại mới:', user.phone || '');
    if (newPhone === null) return;
    
    const newAddress = prompt('✏️ Nhập địa chỉ mới:', user.address || '');
    if (newAddress === null) return;
    
    const newRole = prompt('✏️ Nhập vai trò mới (admin/manager/user):', user.role || 'user');
    if (newRole === null) return;
    
    // Cập nhật vào Firebase
    const updates = {};
    if (newName) updates.name = newName;
    if (newPhone) updates.phone = newPhone;
    if (newAddress) updates.address = newAddress;
    if (newRole) updates.role = newRole.toLowerCase();
    
    db.ref('dataUser/' + userId)
        .update(updates)
        .then(() => {
            console.log('✅ Đã cập nhật người dùng');
            alert('✅ Cập nhật thành công!');
            loadAllUsers(); // Reload
        })
        .catch(error => {
            console.error('❌ Lỗi cập nhật:', error);
            alert('❌ Không thể cập nhật. Vui lòng thử lại!');
        });
}

/**
 * Xác nhận xóa người dùng
 */
function confirmDeleteUser(userId, userName) {
    const confirmed = confirm(`
⚠️ XÁC NHẬN XÓA NGƯỜI DÙNG

Bạn có chắc chắn muốn xóa người dùng "${userName}"?

⚠️ CẢNH BÁO: Hành động này không thể hoàn tác!
- Tất cả dữ liệu của người dùng sẽ bị xóa vĩnh viễn
- Các đơn đặt bàn liên quan có thể bị ảnh hưởng

Nhấn OK để xác nhận xóa.
    `);
    
    if (confirmed) {
        deleteUser(userId, userName);
    }
}

/**
 * Xóa người dùng
 */
function deleteUser(userId, userName) {
    console.log('🗑️ Đang xóa người dùng:', userId);
    
    db.ref('dataUser/' + userId)
        .remove()
        .then(() => {
            console.log('✅ Đã xóa người dùng thành công');
            alert(`✅ Đã xóa người dùng "${userName}" thành công!`);
            loadAllUsers(); // Reload
        })
        .catch(error => {
            console.error('❌ Lỗi xóa người dùng:', error);
            alert('❌ Không thể xóa người dùng. Vui lòng thử lại!');
        });
}

/**
 * Hiển thị lỗi
 */
function showError(message) {
    const wrapper = document.getElementById('table-wrapper');
    if (wrapper) {
        wrapper.innerHTML = `
            <div class="empty-state">
                <div class="icon">
                    <span class="material-symbols-outlined" style="color: #d32f2f;">error</span>
                </div>
                <h3>Có lỗi xảy ra</h3>
                <p>${message}</p>
            </div>
        `;
    }
}