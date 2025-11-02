
let map; // Biến giữ bản đồ
let marker; // Biến giữ ghim
let tempLatLng = null; // Biến giữ vị trí tạm thời trong modal
const defaultLat = 21.027763; // Vị trí Hà Nội
const defaultLng = 105.834160;

// --- LOGIC KHỞI CHẠY CHÍNH (Được gọi từ auth-guard.js) ---
function startPageLogic(user) {
  // Chỉ chạy nếu người dùng đã được xác minh là Admin
  if (user) {
      const currentOwnerId = user.uid;
      
      // Cập nhật email admin
      const adminEmailElement = document.getElementById("admin-email");
      if (adminEmailElement) {
          adminEmailElement.textContent = user.email || "Chủ CLB";
      }

      // Cập nhật ID ẩn
      const clbOwnerIdInput = document.getElementById("clb-owner-id");
      if (clbOwnerIdInput) {
          clbOwnerIdInput.value = currentOwnerId;
      }
      
      // Chạy hàm logic chính
      initCrudPage(currentOwnerId);
  }
}

/**
 * Khởi tạo toàn bộ trang CRUD (Thêm/Sửa/Xoá/Đọc)
 */
function initCrudPage(currentOwnerId) {
  // === Tham chiếu đến các phần tử HTML ===
  const clbForm = document.getElementById("clb-form");
  const formTitle = document.getElementById("form-title");
  const clbIdInput = document.getElementById("clb-id");
  const clearBtn = document.getElementById("clear-btn");
  const clbList = document.getElementById("clb-list");
  const exportBtn = document.getElementById("export-btn");

  const clbAddressInput = document.getElementById("clb-address"); 
  const clbLatitudeInput = document.getElementById("clb-latitude"); 
  const clbLongitudeInput = document.getElementById("clb-longitude");
  const addressDisplay = document.getElementById("address-display"); 
  const openMapBtn = document.getElementById("open-map-btn");
  const mapModal = document.getElementById("map-modal");
  const closeMapBtn = document.getElementById("close-map-btn");
  const confirmLocationBtn = document.getElementById("confirm-location-btn");

  // === GẮN SỰ KIỆN CHO CÁC NÚT BẢN ĐỒ ===
  openMapBtn.addEventListener("click", openMapModal);
  closeMapBtn.addEventListener("click", closeMapModal);
  confirmLocationBtn.addEventListener("click", confirmLocation);
  
  // (*** Phần CRUD khác giữ nguyên ***)
  
  // === (R) READ / ĐỌC DỮ LIỆU ===
  const clbRef = db
    .ref("dataStore")
    .orderByChild("ownerId")
    .equalTo(currentOwnerId);
  clbRef.on("value", (snapshot) => {
    clbList.innerHTML = "";
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();
        renderClubRow(key, data);
      });
    } else {
      clbList.innerHTML =
        '<tr><td colspan="9" style="text-align: center;">Bạn chưa có CLB nào. Hãy thêm CLB mới!</td></tr>';
    }
  });

  /**
   * Hàm "vẽ" 1 hàng <tr> trong bảng
   */
  function renderClubRow(key, data) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.name || "N/A"}</td>
      <td>${data.address || "N/A"}</td>
      <td>${data.tableNumber || "N/A"}</td>
      <td>${data.phone || "N/A"}</td>
      <td>${data.email || "N/A"}</td>
      <td>${data.openingHour || "--:--"} - ${data.closingHour || "--:--"}</td>
      <td>${
        data.priceTable ? data.priceTable.toLocaleString("vi-VN") : 0
      } đ</td>
      <td>${data.des || "N/A"}</td>
      <td class="actions-cell">
        <button class="btn btn-edit">Sửa</button>
        <button class="btn btn-delete">Xoá</button>
      </td>
    `;
    row.querySelector(".btn-edit").addEventListener("click", () => {
      populateFormForEdit(key, data);
    });
    row.querySelector(".btn-delete").addEventListener("click", () => {
      deleteClub(key, data.name);
    });
    clbList.appendChild(row);
  }

  // === (C) CREATE / THÊM MỚI & (U) UPDATE / SỬA ===
  clbForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = clbIdInput.value;
    const clubData = {
      ownerId: document.getElementById("clb-owner-id").value,
      name: document.getElementById("clb-name").value,
      address: clbAddressInput.value, 
      imageURL: parseInt(document.getElementById("clb-image-url").value) || 0,
      phone: document.getElementById("clb-phone").value,
      email: document.getElementById("clb-email").value || null,
      tableNumber: document.getElementById("clb-table-number").value,
      des: document.getElementById("clb-des").value || null,
      openingHour: document.getElementById("clb-opening-hour").value,
      closingHour: document.getElementById("clb-closing-hour").value,
      priceTable: parseInt(document.getElementById("clb-price-table").value) || 0,
      latitude: parseFloat(clbLatitudeInput.value) || 0.0, 
      longitude: parseFloat(clbLongitudeInput.value) || 0.0, 
      distance: null,
    };

    if (!clubData.ownerId) {
      alert("Lỗi: Không tìm thấy ID chủ CLB. Vui lòng tải lại trang.");
      return;
    }

    if (id) {
      // --- CẬP NHẬT (UPDATE) ---
      // Khi cập nhật, đảm bảo trường storeId không bị xoá nếu nó đã có
      db.ref("dataStore").child(id).update(clubData)
        .then(() => { alert("Cập nhật CLB thành công!"); clearForm(); })
        .catch((error) => { console.error("Lỗi cập nhật: ", error); });
        
    } else {
      // 1. Tạo tham chiếu push mới để lấy key trước
      const newClbRef = db.ref("dataStore").push();
      const newKey = newClbRef.key;

      clubData.storeId = newKey; 

      newClbRef.set(clubData)
        .then(() => { alert("Thêm CLB mới thành công!"); clearForm(); })
        .catch((error) => { console.error("Lỗi thêm mới: ", error); });
    }
  });

  // === (D) DELETE / XOÁ ===
  function deleteClub(key, name) {
     if (confirm(`Bạn có chắc muốn xoá CLB "${name}" không?`)) {
      db.ref("dataStore").child(key).remove();
    }
  }

  // === Chức năng nút "Sửa" ===
  function populateFormForEdit(key, data) {
    formTitle.innerText = "Sửa thông tin CLB";
    clbIdInput.value = key;
    document.getElementById("clb-name").value = data.name || "";
    clbAddressInput.value = data.address || "";
    addressDisplay.textContent = data.address || "Chưa chọn vị trí";
    document.getElementById("clb-owner-id").value = data.ownerId || "";
    document.getElementById("clb-table-number").value = data.tableNumber || "";
    document.getElementById("clb-phone").value = data.phone || "";
    document.getElementById("clb-email").value = data.email || "";
    document.getElementById("clb-opening-hour").value = data.openingHour || "";
    document.getElementById("clb-closing-hour").value = data.closingHour || "";
    document.getElementById("clb-price-table").value = data.priceTable || 0;
    document.getElementById("clb-image-url").value = data.imageURL || 0;
    clbLatitudeInput.value = data.latitude || 0;
    clbLongitudeInput.value = data.longitude || 0;
    document.getElementById("clb-des").value = data.des || "";
    window.scrollTo(0, 0);
  }

  // === Chức năng nút "Làm mới" ===
  function clearForm() {
    formTitle.innerText = "Thêm CLB mới";
    clbForm.reset();
    clbIdInput.value = "";
    document.getElementById("clb-owner-id").value = currentOwnerId;
    clbLatitudeInput.value = 0;
    clbLongitudeInput.value = 0;
    addressDisplay.textContent = "Chưa chọn vị trí";
  }
  clearBtn.addEventListener("click", clearForm);

  // === Chức năng XUẤT EXCEL ===
  exportBtn.addEventListener("click", function () {
    // Kiểm tra xem thư viện XLSX đã được tải chưa
    if (typeof XLSX === 'undefined') {
        console.error("LỖI NGHIÊM TRỌNG: Thư viện XLSX chưa được tải! Vui lòng kiểm tra file quan-ly-clb.html");
        alert("Lỗi: Thư viện XLSX không tồn tại. Không thể xuất file.");
        return;
    }
    
    // Dùng clbRef (query Firebase đã lọc theo Owner)
    clbRef.once("value", (snapshot) => {
        
      // *** LOG 2: KIỂM TRA PHẢN HỒI FIREBASE ***
      console.log("-> BƯỚC 2: Firebase đã phản hồi. Kiểm tra dữ liệu..."); 
        
      if (!snapshot.exists()) {
        alert('Không có dữ liệu CLB nào từ Firebase của bạn để xuất!');
        console.log("-> BƯỚC 2.1: snapshot.exists() = FALSE. Dữ liệu rỗng.");
        return;
      }
      
      // *** LOG 3: BẮT ĐẦU XỬ LÝ DỮ LIỆU ***
      console.log("-> BƯỚC 3: Tìm thấy dữ liệu. Bắt đầu xử lý...");
      
      const exportData = [];
      snapshot.forEach((childSnapshot) => {
        const key = childSnapshot.key;
        const data = childSnapshot.val();

        // Xây dựng đối tượng để xuất
        exportData.push({
            "Store ID": key,
            "Owner ID": data.ownerId || "",
            "Tên CLB": data.name || "",
            "ID Hình ảnh": data.imageURL || 0,
            "Địa chỉ": data.address || "",
            "Số điện thoại": data.phone || "",
            Email: data.email || "",
            "Số bàn": data.tableNumber || "",
            "Mô tả": data.des || "", 
            "Giờ mở cửa": data.openingHour || "",
            "Giờ đóng cửa": data.closingHour || "",
            "Giá bàn (VNĐ)": data.priceTable || 0,
            "Vĩ độ": data.latitude || 0,
            "Kinh độ": data.longitude || 0,
        });
      });
      
      // *** LOG 4: TẠO FILE ***
      console.log(`-> BƯỚC 4: Tạo file Excel từ ${exportData.length} CLB...`); 

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách CLB");

      const date = new Date();
      const dateStr =
        date.getDate().toString().padStart(2, "0") +
        "-" +
        (date.getMonth() + 1).toString().padStart(2, "0") +
        "-" +
        date.getFullYear();
      const fileName = `Danh_sach_CLB_${dateStr}.xlsx`;
      
      XLSX.writeFile(wb, fileName); // Lệnh tải file
      
      // *** LOG 5: HOÀN TẤT ***
      console.log("-> BƯỚC 5: Lệnh tải file đã được gửi đi. Kiểm tra thư mục Downloads.");
      alert("Đã xuất file Excel thành công!");
      
    }).catch((error) => {
      // *** LOG LỖI TỔNG QUÁT ***
      console.error("LỖI XUẤT EXCEL: ", error); 
      alert("Có lỗi xảy ra khi xuất file: " + error.message);
    });
  });

} // --- Kết thúc hàm initCrudPage ---

// ===================================================
// *** LOGIC BẢN ĐỒ 
// ===================================================

// 1. Khởi tạo bản đồ (chỉ chạy 1 lần KHI CẦN)
function initMapModal() {
  if (map) { map.remove(); map = null; } // Hủy bản đồ cũ (nếu có)
  try {
    // *** KHỞI TẠO BẢN ĐỒ MỚI ***
    map = L.map('map-picker-container').setView(tempLatLng || [defaultLat, defaultLng], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    marker = L.marker(tempLatLng || [defaultLat, defaultLng], {
      draggable: true
    }).addTo(map);

    // Gắn sự kiện cho bản đồ MỚI
    map.on('click', function(e) {
      updateModalAddress(e.latlng);
    });
    marker.on('dragend', function(e) {
      updateModalAddress(marker.getLatLng());
    });
    
  } catch (error) {
     console.error("Lỗi khởi tạo bản đồ:", error);
     document.getElementById("modal-address-display").textContent = "Không thể tải bản đồ.";
  }
}

// 2. Hàm mở Pop-up bản đồ (*** ĐÃ SỬA: SỬ DỤNG CLASS CSS ***)
function openMapModal() {
  const mapModal = document.getElementById("map-modal");
  const currentLat = parseFloat(document.getElementById("clb-latitude").value);
  const currentLng = parseFloat(document.getElementById("clb-longitude").value);
  const currentAddress = document.getElementById("clb-address").value;
  
  // Xác định vị trí ban đầu
  tempLatLng = (currentLat !== 0 && !isNaN(currentLat)) ? L.latLng(currentLat, currentLng) : L.latLng(defaultLat, defaultLng);
  
  // *** BƯỚC QUAN TRỌNG: SỬA DỨT ĐIỂM BẰNG CÁCH GỌI initMapModal() ***
  // Khởi tạo bản đồ mới ngay sau khi xác định vị trí
  initMapModal();

  // Hiển thị Modal bằng class
  mapModal.classList.add('is-active');
  
  // Cập nhật địa chỉ trong modal (tên địa điểm)
  if(currentAddress && currentLat !== 0) {
      document.getElementById("modal-address-display").textContent = currentAddress;
  } else {
      updateModalAddress(tempLatLng); // Tải địa chỉ mặc định
  }
  
  // *** Rất quan trọng: Phải di chuyển mapview sau khi modal hiện ***
  // Dùng setTimeout để khắc phục lỗi vỡ gạch nếu nó vẫn xảy ra.
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      map.setView(tempLatLng, 15); // Đảm bảo bản đồ tập trung vào đúng vị trí
    }
  }, 10); 
}

// 3. Hàm đóng Pop-up
function closeMapModal() {
  const mapModal = document.getElementById("map-modal");
  mapModal.classList.remove('is-active'); // Ẩn Modal
  
  // *** QUAN TRỌNG: Hủy bản đồ khi đóng ***
  if (map) {
    map.remove();
    map = null;
  }
}

// 4. Hàm chạy khi nhấn "Xác nhận vị trí"
function confirmLocation() {
  if (tempLatLng) {
    const addressInModal = document.getElementById("modal-address-display").textContent;
    
    // Cập nhật các ô input (cả ẩn và hiện)
    document.getElementById("clb-latitude").value = tempLatLng.lat.toFixed(6);
    document.getElementById("clb-longitude").value = tempLatLng.lng.toFixed(6);
    document.getElementById("clb-address").value = addressInModal;
    document.getElementById("address-display").textContent = addressInModal;
  }
  closeMapModal();
}

// 5. Hàm cập nhật địa chỉ (khi nhấn/kéo trong modal)
async function updateModalAddress(latlng) {
  tempLatLng = latlng; // Cập nhật vị trí tạm thời
  marker.setLatLng(latlng); // Di chuyển ghim
  
  const modalAddressDisplay = document.getElementById("modal-address-display");
  modalAddressDisplay.textContent = "Đang tìm địa chỉ...";
  
  // Gọi API Nominatim (miễn phí) để tìm tên địa chỉ
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
    );
    const data = await response.json();
    if (data && data.display_name) {
      modalAddressDisplay.textContent = data.display_name;
    } else {
      modalAddressDisplay.textContent = "Không tìm thấy tên địa chỉ.";
    }
  } catch (error) {
    modalAddressDisplay.textContent = "Lỗi khi tìm địa chỉ.";
  }
}