
const API_BASE_URL = "https://api-datn-2025.onrender.com"; 

// --- BIẾN TOÀN CỤC ---
let allUsers = []; 
const storeMap = new Map(); 
let loggedInOwnerId = null; 

// --- LẤY CÁC ELEMENT ---
const storeManagerGroup = document.getElementById('store-manager-group');
const userManagedStoreSelect = document.getElementById('user-managed-store');
const userPasswordGroup = document.getElementById('user-password-group'); 
const userPasswordInput = document.getElementById('user-password');     
const userRoleSelect = document.getElementById('user-role');


// --- LOGIC KHỞI CHẠY CHÍNH ---
document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      document.getElementById('admin-email').textContent = user.email || 'Chủ CLB';
      loggedInOwnerId = user.uid; 
      await loadStores(loggedInOwnerId); 
      loadUsers(loggedInOwnerId);
      setupEventListeners();
    } else {
      alert("Vui lòng đăng nhập để tiếp tục.");
      window.location.href = "/login.html"; 
    }
  });
});

async function loadStores(ownerId) {
  const storesRef = db.ref('dataStore').orderByChild('ownerId').equalTo(ownerId);
  try {
    const snapshot = await storesRef.once('value');
    storeMap.clear();
    userManagedStoreSelect.innerHTML = '<option value="">-- Chọn cơ sở --</option>'; 
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const store = { id: child.key, ...child.val() };
        if (store.name) {
          storeMap.set(store.id, store.name); 
          const option = document.createElement('option');
          option.value = store.id;
          option.textContent = store.name;
          userManagedStoreSelect.appendChild(option);
        }
      });
    } else {
      console.log("Owner này chưa có CLB nào.");
    }
  } catch (error) {
    console.error("Lỗi tải danh sách cơ sở:", error);
  }
}
function loadUsers(ownerId) {
  const usersRef = db.ref('dataUser').orderByChild('ownerId').equalTo(ownerId);
  usersRef.on('value', (snapshot) => {
    allUsers = [];
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        const user = { id: child.key, ...child.val() };
        allUsers.push(user); 
      });
      displayUsers(allUsers); 
    } else {
      usersList.innerHTML = '<tr><td colspan="7" style="text-align: center;">Bạn chưa tạo người dùng nào</td></tr>';
    }
  });
}

// --- HÀM HIỂN THỊ NGƯỜI DÙNG RA BẢNG ---
function displayUsers(users) {
  const usersList = document.getElementById('users-list');
  usersList.innerHTML = '';
  if (users.length === 0) {
    usersList.innerHTML = '<tr><td colspan="7" style="text-align: center;">Không tìm thấy người dùng nào</td></tr>';
    return;
  }
  users.forEach((user) => {
    const initials = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    const roleClass = `role-${user.role || 'user'}`;
    
    // *** CẬP NHẬT: Thêm logic hiển thị cho các role cấp cao (nếu tồn tại) ***
    let roleText = 'Người dùng';
    switch(user.role) {
      case 'admin': roleText = 'Quản trị viên (Cấp cao)'; break;
      case 'owner': roleText = 'Chủ CLB (Cấp cao)'; break;
      case 'manager': roleText = 'Quản lý'; break;
    }
    
    const managedStoreName = (user.role === 'manager' && user.storeId)
    ? (storeMap.get(user.storeId) || 'Cơ sở không rõ')
    : '---';

    const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : 'N/A';
    const userNameForDelete = user.name || 'N/A';

    usersList.innerHTML += `
      <tr>
        <td>
          <div class="user-info">
            <div class="user-avatar">${initials}</div>
            <div class="user-details">
              <h4>${user.name || 'N/A'}</h4>
              <p>ID: ${user.id.substring(0, 8)}...</p>
            </div>
          </div>
        </td>
        <td>${user.email || 'N/A'}</td>
        <td>${user.phone || 'N/A'}</td>
        <td><span class="user-role ${roleClass}">${roleText}</span></td>
        <td>${managedStoreName}</td> <td>${createdDate}</td>
        <td class="actions-cell">
          <button class="btn btn-warning" data-action="edit" data-id="${user.id}">Sửa</button>
          <button class="btn btn-danger" data-action="delete" data-id="${user.id}" data-name="${userNameForDelete}">Xóa</button>
        </td>
      </tr>
    `;
  });
}

// --- (Bước 3: Hàm cài đặt Listener) ---
function setupEventListeners() {
  // (Code tìm kiếm, lọc giữ nguyên)
  document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allUsers.filter(user => 
      (user.name && user.name.toLowerCase().includes(searchTerm)) ||
      (user.email && user.email.toLowerCase().includes(searchTerm)) ||
      (user.phone && user.phone.includes(searchTerm))
    );
    displayUsers(filtered);
  });
  document.getElementById('role-filter').addEventListener('change', (e) => {
    const role = e.target.value;
    const filtered = role ? allUsers.filter(user => user.role === role) : allUsers;
    displayUsers(filtered);
  });

  // Nút Thêm, Đóng, Hủy
  document.getElementById('add-user-btn').addEventListener('click', openAddModal);
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  
  // Nút Lưu (Submit form)
  document.getElementById('user-form').addEventListener('submit', saveUser);

  // *** LOGIC QUAN TRỌNG: Khi chọn vai trò "Manager" ***
  userRoleSelect.addEventListener('change', (e) => {
    // Chỉ hiện dropdown CLB khi chọn Manager. 
    // KHÔNG HIỆN khi chọn User (hoặc Owner/Admin - cấp cao)
    if (e.target.value === 'manager') {
      storeManagerGroup.style.display = 'block'; 
    } else {
      storeManagerGroup.style.display = 'none'; 
    }
  });

  // Nút Xuất Excel
  document.getElementById('export-users-btn').addEventListener('click', exportUsers);

  // Bộ lắng nghe cho các nút Sửa/Xóa 
  document.getElementById('users-list').addEventListener('click', (event) => {
    const target = event.target; 
    const action = target.dataset.action; 
    const id = target.dataset.id; 

    if (action === 'edit') {
      editUser(id); 
    } 
    else if (action === 'delete') {
      const name = target.dataset.name; 
      deleteUser(id, name); 
    }
  });
}

// --- HÀM MỞ MODAL (Cho Thêm mới) ---
function openAddModal() {
  const errorMessageElement = document.getElementById('form-error-message');
  
  // *** FIX LỖI: Xóa mọi style viền/nền và nội dung khi mở Modal ***
  if (errorMessageElement) {
      errorMessageElement.textContent = '';
      errorMessageElement.style.background = 'none';
      errorMessageElement.style.border = 'none'; // <-- THÊM DÒNG NÀY
      errorMessageElement.style.padding = '0'; // <-- THÊM DÒNG NÀY
  }
  
  document.getElementById('modal-title').textContent = 'Thêm người dùng mới';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  
  storeManagerGroup.style.display = 'none'; 
  userManagedStoreSelect.value = '';
  
  userPasswordGroup.style.display = 'block'; 
  userPasswordInput.setAttribute('required', 'true'); 
  
  userRoleSelect.value = 'user'; 

  document.getElementById('user-modal').classList.add('active');
}

// --- HÀM ĐÓNG MODAL ---
function closeModal() {
  document.getElementById('user-modal').classList.remove('active');
  
  // *** FIX LỖI: Xóa mọi style khi đóng ***
  const errorMessageElement = document.getElementById('form-error-message');
  if (errorMessageElement) {
      errorMessageElement.textContent = '';
      errorMessageElement.style.background = 'none';
      errorMessageElement.style.border = 'none'; // <-- THÊM DÒNG NÀY
      errorMessageElement.style.padding = '0'; // <-- THÊM DÒNG NÀY
  }
}

// --- HÀM MỞ MODAL (Cho Sửa) ---
function editUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('modal-title').textContent = 'Sửa thông tin người dùng';
  document.getElementById('user-id').value = userId;
  document.getElementById('user-name').value = user.name || '';
  document.getElementById('user-email').value = user.email || '';
  document.getElementById('user-phone').value = user.phone || '';
  
  // *** CẬP NHẬT: Xử lý role không tồn tại trong dropdown ***
  // Nếu user có role 'admin' hoặc 'owner', ta phải kiểm tra xem option đó có tồn tại không.
  const roleValue = user.role;
  let isRoleAvailable = false;
  
  // Kiểm tra xem option có tồn tại (dùng querySelector để tránh lỗi)
  if(userRoleSelect.querySelector(`option[value="${roleValue}"]`)) {
     userRoleSelect.value = roleValue;
     isRoleAvailable = true;
  } else {
     // Nếu là admin/owner (cấp cao), ta không thể sửa role này
     userRoleSelect.value = 'user'; // Mặc định về user nếu không tìm thấy role
     isRoleAvailable = false;
     alert(`Lưu ý: Tài khoản này là cấp ${roleValue}. Bạn không thể thay đổi vai trò của họ.`);
  }

  document.getElementById('user-address').value = user.address || '';
  
  // Nếu là manager, hiện và chọn đúng CLB
  if (user.role === 'manager' || (isRoleAvailable && userRoleSelect.value === 'manager')) {
    storeManagerGroup.style.display = 'block';
    userManagedStoreSelect.value = user.storeId || '';
  } else {
    storeManagerGroup.style.display = 'none';
    userManagedStoreSelect.value = '';
  }

  // Ẩn trường mật khẩu khi Sửa
  userPasswordGroup.style.display = 'none';
  userPasswordInput.removeAttribute('required'); 

  document.getElementById('user-modal').classList.add('active');
}

// --- (Bước 4: Hàm LƯU USER - Gọi API Backend) ---
async function saveUser(e) {
  e.preventDefault();
  
  const errorMessageElement = document.getElementById('form-error-message');

  errorMessageElement.textContent = '';
  errorMessageElement.style.border = 'none'; 
  errorMessageElement.style.padding = '0'; 
  errorMessageElement.style.background = 'none';

  if (!errorMessageElement) {
      console.error("Thiếu thẻ #form-error-message trong HTML!");
      return;
  }
  
  errorMessageElement.textContent = '';

  const userId = document.getElementById('user-id').value;
  const role = userRoleSelect.value;
  
  // *** CẬP NHẬT: CẤM TẠO/SỬA CẤP CAO ***
  if (role === 'owner' || role === 'admin') {
      errorMessageElement.textContent = 'Bạn không có quyền tạo hoặc gán vai trò cấp cao (Admin/Owner).';
      return;
  }
  
  const userData = {
    name: document.getElementById('user-name').value,
    email: document.getElementById('user-email').value,
    phone: document.getElementById('user-phone').value,
    role: role,
    address: document.getElementById('user-address').value,
    storeId: null
  };

  if (role === 'manager') {
    const storeId = userManagedStoreSelect.value;
    if (!storeId) {
      errorMessageElement.textContent = 'Vui lòng chọn một cơ sở để gán cho Quản lý.';
      return;
    }
    userData.storeId = storeId;
  }
  
  let token;
  try {
    token = await auth.currentUser.getIdToken();
  } catch (error) {
    errorMessageElement.textContent = "Lỗi xác thực. Vui lòng đăng nhập lại.";
    return;
  }

  try {
    let response;
    if (userId) {
      // Nếu user đang được sửa là Owner/Admin, ta không cho phép sửa role qua API
      const userToEdit = allUsers.find(u => u.id === userId);
      if(userToEdit && (userToEdit.role === 'owner' || userToEdit.role === 'admin') && userToEdit.role !== role) {
         errorMessageElement.textContent = 'Không thể hạ cấp Owner/Admin qua giao diện này.';
         return;
      }
      
      userData.password = undefined; 
      
      response = await fetch(`${API_BASE_URL}/api/updateUser/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userData)
      });
      
    } else {
      // --- CHẾ ĐỘ TẠO MỚI ---
      userData.password = document.getElementById('user-password').value;
      
      if (!userData.password || userData.password.length < 6) {
        errorMessageElement.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
        return; 
      }

      response = await fetch(`${API_BASE_URL}/api/createUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(userData)
      });
    }
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message); 
    }
    
    const result = await response.json();
    alert(result.message); 
    closeModal();
    
  } catch (error) {
    console.error('Lỗi khi lưu user:', error.message);
    
    let friendlyMessage = 'Đã xảy ra lỗi không xác định.';
    
    if (error.message.includes('email address is already in use')) {
        friendlyMessage = 'Email này đã tồn tại. Vui lòng dùng email khác.';
    } else if (error.message.includes('phone number already exists')) {
        friendlyMessage = 'Số điện thoại này đã tồn tại. Vui lòng dùng SĐT khác.';
    } else if (error.message.includes('TOO_SHORT') || error.message.includes('Password should be at least 6 characters')) {
        friendlyMessage = 'Mật khẩu phải có ít nhất 6 ký tự.';
    } else if (error.message) {
        friendlyMessage = error.message.replace('Lỗi Auth:', '').trim();
    }
    
    errorMessageElement.textContent = friendlyMessage;
    errorMessageElement.style.background = '#ffebee'; // Màu hồng
    errorMessageElement.style.border = '1px solid #d32f2f'; // Viền đỏ
    errorMessageElement.style.padding = '10px'; // Khoảng cách
  }
}

// --- HÀM XÓA USER (Gọi API Backend) ---
async function deleteUser(userId, userName) {
  if (confirm(`Bạn có chắc muốn xóa người dùng "${userName}" không? (Hành động này sẽ xóa cả tài khoản đăng nhập)`)) {
    
    let token;
    try {
      token = await auth.currentUser.getIdToken();
    } catch (error) {
      alert("Lỗi xác thực. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      // Gọi API "DELETE"
      const response = await fetch(`${API_BASE_URL}/api/deleteUser/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}` 
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const result = await response.json();
      alert(result.message); 

    } catch (error) {
      console.error('Lỗi khi xóa user:', error);
      alert('Đã xảy ra lỗi: ' + error.message);
    }
  }
}

// --- HÀM XUẤT EXCEL ---
function exportUsers() {
  // (Giữ nguyên hàm này)
  if (allUsers.length === 0) {
    alert('Không có dữ liệu để xuất!');
    return;
  }

  const exportData = allUsers.map(user => {
    let roleText = 'Người dùng';
    switch(user.role) {
      case 'admin': roleText = 'Quản trị viên (Cấp cao)'; break;
      case 'owner': roleText = 'Chủ CLB (Cấp cao)'; break;
      case 'manager': roleText = 'Quản lý'; break;
    }
    
    return {
      'ID': user.id,
      'Họ và tên': user.name || '',
      'Email': user.email || '',
      'Số điện thoại': user.phone || '',
      'Vai trò': roleText,
      'Cơ sở quản lý': (user.role === 'manager' && user.storeId) ? storeMap.get(user.storeId) : '',
      'Địa chỉ': user.address || '',
      'Ngày tạo': user.createdAt ? new Date(user.createdAt).toLocaleString('vi-VN') : ''
    }
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Người dùng');
  
  const date = new Date();
  const dateStr = date.getDate().toString().padStart(2, '0') + '-' + 
                  (date.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                  date.getFullYear();
  XLSX.writeFile(wb, `Danh_sach_nguoi_dung_${dateStr}.xlsx`);
}