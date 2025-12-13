let currentOwnerId = null; // Biến mới để lưu ownerId của người dùng hiện tại
let allBookings = []; 
let allClubs = [];    

// Cập nhật: Kiểm tra trạng thái đăng nhập VÀ lấy ownerId
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('admin-email').textContent = user.email || 'Admin';
        
        // GIẢ SỬ: Đọc ownerId từ bảng 'users' hoặc 'owners'
        // TRONG CODE NÀY, TA SẼ GIẢ SỬ ownerId = user.uid (admin chính là owner)
        // LƯU Ý: Nếu admin là Supper Admin, logic này cần thay đổi!
        currentOwnerId = user.uid;
        
        // KHI CÓ ID THÌ MỚI TẢI DỮ LIỆU
        loadClubs(); 
        loadBookings(); 
    } else {
        // Nếu không đăng nhập, có thể chuyển hướng hoặc hiển thị lỗi
        console.error("Người dùng chưa đăng nhập!");
    }
});

// ===== PHẦN 2: HÀM KHỞI ĐỘNG KHI TẢI TRANG =====

document.addEventListener('DOMContentLoaded', () => {
    // loadClubs(); // CHUYỂN VÀO onAuthStateChanged
    // loadBookings(); // CHUYỂN VÀO onAuthStateChanged
    setupEventListeners();
    
    // Giả sử bạn có 1 ô input 'booking-dateTime' trong form
    try {
        document.getElementById('booking-dateTime').value = new Date().toISOString().split('T')[0];
    } catch(e) {
        console.warn("Không tìm thấy 'booking-dateTime', bỏ qua.");
    }
});

// ===== PHẦN 3: TẢI DỮ LIỆU TỪ FIREBASE =====

/**
 * Tải danh sách CLB (dataStore) - CHỈ TẢI CỦA OWNER HIỆN TẠI
 */
function loadClubs() {
    if (!currentOwnerId) return; // Đảm bảo đã có ownerId

    // THAY ĐỔI: Thêm query lọc theo ownerId
    db.ref('dataStore')
      .orderByChild('ownerId')
      .equalTo(currentOwnerId)
      .once('value', snapshot => {
        const selectElement = document.getElementById('club-select'); 
        const filterElement = document.getElementById('club-filter'); // Bộ lọc mới
        
        selectElement.innerHTML = '<option value="">-- Chọn CLB --</option>';
        filterElement.innerHTML = '<option value="">Tất cả CLB</option>'; // Option cho bộ lọc
        allClubs = [];

        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                // Lưu cache
                allClubs.push({ 
                    id: childSnapshot.key, 
                    ownerId: data.ownerId, 
                    address: data.address,
                    name: data.name 
                });
                const optionHtml = `<option value="${childSnapshot.key}">${data.name}</option>`;
                selectElement.innerHTML += optionHtml;
                filterElement.innerHTML += optionHtml; // Thêm vào bộ lọc
            });
        }
    });
}

/**
 * Tải danh sách đơn đặt bàn (từ 'dataBookTable') - CHỈ TẢI CỦA OWNER HIỆN TẠI
 */
function loadBookings() {
    if (!currentOwnerId) return; // Đảm bảo đã có ownerId

    // THAY ĐỔI: Thêm query lọc theo storeOwnerId
    db.ref('dataBookTable')
      .orderByChild('storeOwnerId')
      .equalTo(currentOwnerId)
      .on('value', snapshot => {
        allBookings = []; 
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                allBookings.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });
        }
        displayBookings(allBookings);
        updateStats(allBookings); 
    });
}

// ===== PHẦN 4: HIỂN THỊ DỮ LIỆU LÊN GIAO DIỆN =====

/**
 * "Vẽ" các đơn đặt bàn ra bảng - THÊM CỘT TRẠNG THÁI ĐƠN
 * @param {Array} bookings Mảng đơn từ 'dataBookTable'
 */
function displayBookings(bookings) {
    const listElement = document.getElementById('bookings-list'); // <tbody>
    listElement.innerHTML = '';

    if (!bookings.length) {
        // Cập nhật colspan này cho đúng với số cột <thead> của bạn (tăng lên 10)
        listElement.innerHTML = '<tr><td colspan="10" style="text-align:center;">Chưa có đơn nào</td></tr>';
        return;
    }

    bookings.forEach(b => {
        // CẬP NHẬT: Dùng paymentStatus cho class badge
        const statusClass = `status-${(b.paymentStatus || 'pending').replace(/ /g, '-')}`;
        let statusText = b.paymentStatus; 
        
        // Lấy booking status để hiển thị
        // THÊM: Lấy booking status để hiển thị, mặc định là 'Đang chờ'
        let bookingStatusText = b.status || 'Đang chờ'; 
        // Tạo class cho booking status (chuyển khoảng trắng thành gạch ngang)
        const bookingStatusClass = `status-${bookingStatusText.replace(/ /g, '-')}`;

        
        listElement.innerHTML += `
            <tr>
                <td>#${b.id ? b.id.substring(0, 6) : 'N/A'}</td>
                <td><strong>${b.name || 'N/A'}</strong><br><small>${b.phoneNumber || ''}</small></td>
                <td>${b.addressClb || 'N/A'}</td>
                <td>${b.dateTime || ''}</td>
                <td>${b.startTime || ''} - ${b.endTime || ''}</td>
                <td>${b.person || 'N/A'} người</td>
                <td>${b.money ? b.money.toLocaleString('vi-VN') : 0} ₫</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td><span class="status-badge ${bookingStatusClass}">${bookingStatusText}</span></td> <td>
                    <button class="btn btn-info" onclick="viewBooking('${b.id}')">Chi tiết</button>
                    <button class="btn btn-warning" onclick="editBooking('${b.id}')">Sửa</button>
                    <button class="btn btn-danger" onclick="deleteBooking('${b.id}', '${b.name}')">Xóa</button>
                </td>
            </tr>
        `;
    });
}

/**
 * Cập nhật các thẻ thống kê - KHÔNG THAY ĐỔI NỘI DUNG HÀM
 * @param {Array} bookings Mảng tất cả đơn
 */
function updateStats(bookings) {
    document.getElementById('total-bookings').textContent = bookings.length;
    
    document.getElementById('pending-bookings').textContent = bookings.filter(
        b => b.status === 'Đang chờ'
    ).length;
    
    // Đếm "Đã thanh toán" (paid)
    document.getElementById('confirmed-bookings').textContent = bookings.filter(
        b => b.paymentStatus === 'Đã thanh toán'
    ).length; 
    
    // SỬA LẠI: Đếm "Hoàn thành" (completed) VÀ "Hoàn thành(owner)" (paid(owner))
    document.getElementById('completed-bookings').textContent = bookings.filter(
        b => b.status === 'Đã hoàn thành' || b.status === 'Đã hoàn thanh(owner)'
    ).length; 
    
    // Đếm "Đã hủy"
    document.getElementById('cancelled-bookings').textContent = bookings.filter(
        b => b.status === 'Đã huỷ'
    ).length;
}

// ===== PHẦN 5: GẮN SỰ KIỆN & LỌC DỮ LIỆU =====

/**
 * Gắn sự kiện (event listener) - CẬP NHẬT THÊM LỌC STATUS
 */
function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', filterBookings);
    // CẬP NHẬT: Đổi ID cũ thành payment-status-filter
    document.getElementById('payment-status-filter').addEventListener('change', filterBookings);
    // THÊM: Gắn sự kiện cho bộ lọc status mới
    document.getElementById('booking-status-filter').addEventListener('change', filterBookings); 
    
    document.getElementById('date-filter').addEventListener('change', filterBookings);
    document.getElementById('club-filter').addEventListener('change', filterBookings); 

    document.getElementById('add-booking-btn').addEventListener('click', openAddModal);
    document.getElementById('close-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('booking-form').addEventListener('submit', saveBooking);
    document.getElementById('export-bookings-btn').addEventListener('click', exportBookings);
}

/**
 * Hàm lọc và tìm kiếm - CẬP NHẬT THÊM LỌC THEO STATUS
 */
function filterBookings() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    // CẬP NHẬT: Lọc theo Payment Status
    const paymentStatusTerm = document.getElementById('payment-status-filter').value;
    // THÊM: Lọc theo Booking Status
    const bookingStatusTerm = document.getElementById('booking-status-filter').value;
    
    const dateTerm = document.getElementById('date-filter').value; 
    const clubTerm = document.getElementById('club-filter').value; 

    let filterDate = null;
    if (dateTerm) {
        const parts = dateTerm.split('-'); 
        filterDate = new Date(parts[0], parts[1] - 1, parts[2]); 
    }

    let filteredBookings = allBookings.filter(b => {
        // Phần lọc tên, SĐT, trạng thái (giữ nguyên)
        const matchSearch = !searchTerm ||
            (b.name && b.name.toLowerCase().includes(searchTerm)) ||
            (b.addressClb && b.addressClb.toLowerCase().includes(searchTerm)) ||
            (b.phoneNumber && b.phoneNumber.includes(searchTerm));
        
        // CẬP NHẬT: Lọc theo Payment Status
        const matchPaymentStatus = !paymentStatusTerm || b.paymentStatus === paymentStatusTerm;
        
        // THÊM: Logic lọc theo Booking Status
        // Lưu ý: b.status có thể không tồn tại trên các đơn cũ
        const matchBookingStatus = !bookingStatusTerm || (b.status || 'Đang chờ') === bookingStatusTerm;

        const matchClub = !clubTerm || b.storeId === clubTerm;

        let matchDate = false;
        if (!filterDate) {
            matchDate = true;
        } else if (b.dateTime && typeof b.dateTime === 'string') {
            try {
                const parts = b.dateTime.split('/'); // ["23", "10", "2025"]
                if (parts.length === 3) {
                    const bookingDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    matchDate = bookingDate.toDateString() === filterDate.toDateString();
                }
            } catch (e) {
                console.error("Lỗi parse ngày:", b.dateTime, e);
                matchDate = false;
            }
        }

        return matchSearch && matchPaymentStatus && matchBookingStatus && matchDate && matchClub; // THÊM matchBookingStatus
    });

    displayBookings(filteredBookings);
}
// ===== PHẦN 6: CHỨC NĂNG CỦA MODAL (THÊM/SỬA/XEM) =====

/**
 * Mở modal ở chế độ "Thêm mới" - KHÔNG THAY ĐỔI NỘI DUNG HÀM
 */
function openAddModal() {
    document.getElementById('modal-title').textContent = 'Tạo đơn mới';
    document.getElementById('booking-form').reset(); // Xóa trắng form
    document.getElementById('booking-id').value = ''; // Xóa ID ẩn
    // Tự động điền ngày
    try {
        document.getElementById('booking-dateTime').value = new Date().toISOString().split('T')[0];
    } catch(e) {}
    
    document.getElementById('booking-modal').classList.add('active'); // Hiện modal
}

function closeModal() {
    document.getElementById('booking-modal').classList.remove('active');
}

/**
 * Mở modal ở chế độ "Sửa" và điền thông tin cũ vào - KHÔNG THAY ĐỔI NỘI DUNG HÀM
 * @param {string} id ID của đơn cần sửa
 */
function editBooking(id) {
    const booking = allBookings.find(b => b.id === id); 
    if (!booking) return;

    document.getElementById('modal-title').textContent = 'Sửa đơn';
    // Đặt ID vào ô ẩn
    document.getElementById('booking-id').value = id; 
    
    // Điền dữ liệu theo schema mới
    document.getElementById('customer-name').value = booking.name || '';
    document.getElementById('customer-phone').value = booking.phoneNumber || '';
    document.getElementById('customer-email').value = booking.email || '';
    document.getElementById('club-select').value = booking.storeId || '';
    
    // THAY ĐỔI: Chuyển ngày DD/MM/YYYY sang YYYY-MM-DD cho input type="date"
    let displayDate = booking.dateTime || '';
    if (displayDate.includes('/')) {
        const parts = displayDate.split('/'); // ["23", "10", "2025"]
        // Định dạng YYYY-MM-DD
        displayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; 
    }
    // Gán vào input
    document.getElementById('booking-dateTime').value = displayDate;
    
    document.getElementById('booking-startTime').value = booking.startTime || '';
    document.getElementById('booking-endTime').value = booking.endTime || '';
    document.getElementById('booking-person').value = booking.person || '';
    document.getElementById('booking-money').value = booking.money || 0;
    document.getElementById('booking-paymentStatus').value = booking.paymentStatus || 'pending';
    
    document.getElementById('booking-modal').classList.add('active'); // Hiện modal
}

/**
 * Hiển thị chi tiết đơn bằng 'alert' - CẬP NHẬT THÊM STATUS
 * @param {string} id ID của đơn cần xem
 */
function viewBooking(id) {
    const b = allBookings.find(x => x.id === id);
    if (b) {
        alert(
            `Mã: #${b.id}\n` +
            `Khách: ${b.name} (${b.email})\n` +
            `SĐT: ${b.phoneNumber}\n` +
            `CLB: ${b.addressClb}\n` +
            `Ngày: ${b.dateTime}\n` +
            `Giờ: ${b.startTime} - ${b.endTime}\n` +
            `Số người: ${b.person}\n` +
            `Tổng tiền: ${b.money} ₫\n` +
            `Trạng thái TT: ${b.paymentStatus}\n` +
            `Trạng thái Đơn: ${b.status || 'Đang chờ'}` // THÊM STATUS
        );
    }
}

/**
 * Lưu (Thêm mới HOẶC Cập nhật) đơn - CẬP NHẬT LOGIC NGÀY THÁNG VÀ STATUS
 * @param {Event} e Sự kiện submit
 */
function saveBooking(e) {
    e.preventDefault(); 

    const id = document.getElementById('booking-id').value; // Lấy ID ẩn (nếu là sửa)
    const storeId = document.getElementById('club-select').value;
    const selectedStore = allClubs.find(c => c.id === storeId);
    
    let rawDate = document.getElementById('booking-dateTime').value; // Lấy ra YYYY-MM-DD từ input date
    let formattedDate = rawDate; // Mặc định giữ nguyên giá trị lấy được

    // Logic chuyển đổi: Nếu có dấu '-', chuyển YYYY-MM-DD sang DD/MM/YYYY
    if (rawDate && rawDate.includes('-')) {
        const dateParts = rawDate.split('-'); // ["YYYY", "MM", "DD"]
        // Định dạng DD/MM/YYYY
        formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`; 
    }

    // THAY ĐỔI: Gom dữ liệu từ form theo schema 'dataBookTable'
    const bookingData = {
        // userId: null, 
        storeOwnerId: selectedStore ? selectedStore.ownerId : null,
        storeId: storeId,
        phoneNumber: document.getElementById('customer-phone').value,
        email: document.getElementById('customer-email').value,
        name: document.getElementById('customer-name').value,
        startTime: document.getElementById('booking-startTime').value,
        endTime: document.getElementById('booking-endTime').value,
        dateTime: formattedDate, // <<< DÙNG formattedDate ĐÃ CHUẨN HÓA
        person: document.getElementById('booking-person').value,
        money: parseFloat(document.getElementById('booking-money').value) || 0.0,
        paymentStatus: document.getElementById('booking-paymentStatus').value,
        addressClb: selectedStore ? (selectedStore.address || selectedStore.name) : '', // Lấy địa chỉ hoặc tên
    };

    // --- CẬP NHẬT LOGIC GÁN STATUS ---
    let currentBooking = allBookings.find(b => b.id === id); // Lấy đơn cũ (nếu là update)
    
    // Gán status mặc định là 'Đang chờ' nếu là đơn mới HOẶC không có status cũ
    let newStatus = currentBooking?.status || 'Đang chờ'; 
    
    // Logic YÊU CẦU: Nếu paymentStatus là "Thanh toán tại quầy" thì status là "Đang chờ"
    if (bookingData.paymentStatus === 'Thanh toán tại quầy') {
        newStatus = 'Đang chờ';
    }
    
    bookingData.status = newStatus;

    if (id) {
        // --- CẬP NHẬT (UPDATE) ---
        db.ref('dataBookTable/' + id).update(bookingData)
            .then(() => {
                alert('Cập nhật thành công!');
                closeModal();
            })
            .catch(e => alert('Lỗi: ' + e.message));
    } else {
        // --- THÊM MỚI (CREATE) ---
        bookingData.createdAt = new Date().getTime(); // Gán thời gian tạo
        
        const newBookingRef = db.ref('dataBookTable').push(); // Tạo 1 key mới
        bookingData.id = newBookingRef.key; // Gán key đó vào trường 'id'
        
        newBookingRef.set(bookingData) // Lưu dữ liệu
            .then(() => {
                alert('Tạo đơn thành công!');
                closeModal();
            })
            .catch(e => alert('Lỗi: ' + e.message));
    }
}

/**
 * Xóa một đơn - KHÔNG THAY ĐỔI NỘI DUNG HÀM
 * @param {string} id ID của đơn
 * @param {string} name Tên khách (để hiển thị xác nhận)
 */
function deleteBooking(id, name) {
    if (confirm(`Xóa đơn của "${name}"?`)) { 
        db.ref('dataBookTable/' + id).remove()
            .then(() => alert('Đã xóa!'))
            .catch(e => alert('Lỗi: ' + e.message));
    }
}

// ===== PHẦN 7: CHỨC NĂNG NÂNG CAO (XUẤT EXCEL) =====

/**
 * Xuất dữ liệu trong bảng ra file Excel - CẬP NHẬT THÊM STATUS
 */
function exportBookings() {
    if (!allBookings.length) {
        alert('Không có dữ liệu!');
        return;
    }

    // Map các trường mới
    const dataForExport = allBookings.map(b => ({
        'Mã đơn': b.id,
        'Khách hàng': b.name || '',
        'SĐT': b.phoneNumber || '',
        'Email': b.email || '',
        'CLB': b.addressClb || '',
        'Ngày': b.dateTime || '',
        'Giờ bắt đầu': b.startTime || '',
        'Giờ kết thúc': b.endTime || '',
        'Số người': b.person || '',
        'Tổng tiền (VND)': b.money || 0,
        'Trạng thái TT': b.paymentStatus || '',
        'Trạng thái Đơn': b.status || 'Đang chờ', // THÊM STATUS
        'Ngày tạo': b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Đơn đặt bàn');

    const t = new Date();
    const dateString = t.getDate().toString().padStart(2, '0') + '-' +
                       (t.getMonth() + 1).toString().padStart(2, '0') + '-' +
                       t.getFullYear();
    XLSX.writeFile(workbook, `Don_dat_ban_${dateString}.xlsx`);
    alert('Đã xuất file!');
}
