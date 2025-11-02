document.addEventListener("DOMContentLoaded", () => {

  if (typeof firebase === "undefined" || !firebase.app()) {
    console.error(
      "Firebase chưa được khởi tạo. Hãy chắc chắn app.js đã được tải và cấu hình đúng.",
    );
    alert("Lỗi: Không thể kết nối đến Firebase.");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.database();
  const vouchersRef = db.ref("dataVoucher");
  const storesRef = db.ref("dataStore");

  // --- 2. LẤY CÁC THÀNH PHẦN (ELEMENTS) TỪ HTML ---
  const form = document.getElementById("voucher-form");
  const formTitle = document.getElementById("form-title");
  const voucherIdInput = document.getElementById("voucher-id");
  const voucherCodeInput = document.getElementById("voucher-code");
  const voucherDiscountInput = document.getElementById("voucher-discount");
  const voucherDescriptionInput = document.getElementById("voucher-description");
  const voucherExpiryInput = document.getElementById("voucher-expiry");
  const voucherMinOrderInput = document.getElementById("voucher-min-order");
  const voucherStatusInput = document.getElementById("voucher-status");
  const clearBtn = document.getElementById("clear-btn");
  const voucherListBody = document.getElementById("voucher-list");
  const voucherStoreInput = document.getElementById("voucher-store");

  // THÀNH PHẦN MỚI CHO LỌC VÀ XUẤT
  const filterStoreInput = document.getElementById("filter-store"); 
  const exportCsvBtn = document.getElementById("export-csv-btn");

  // --- 3. KHỞI TẠO BIẾN TRẠNG THÁI ---
  let currentEditingId = null; // ID của voucher đang được sửa
  let currentFilterStoreId = ""; // ID cơ sở đang được chọn để lọc
  const storeMap = new Map(); // Map: storeId -> storeName
  let currentUserId = null; // ID người dùng hiện tại (Admin/Owner)
  let userStoreIds = []; // Danh sách ID các cơ sở thuộc quyền sở hữu/quản lý

  // --- 4. HÀM XỬ LÝ FORM (TẠO MỚI VÀ CẬP NHẬT) (CREATE & UPDATE) ---
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // Ngăn form tải lại trang

    // Thu thập dữ liệu từ form
    const voucherData = {
      code: voucherCodeInput.value.trim(),
      discount: parseInt(voucherDiscountInput.value, 10),
      description: voucherDescriptionInput.value.trim(),
      expiryDate: voucherExpiryInput.value, // Lưu dưới dạng YYYY-MM-DD
      minOrder: parseInt(voucherMinOrderInput.value, 10) || 0,
      isActive: voucherStatusInput.value === "true",
      storeId: voucherStoreInput.value,
    };

    // Kiểm tra dữ liệu cơ bản
    if (!voucherData.code || !voucherData.discount) {
      alert("Vui lòng nhập Mã Voucher và % Giảm giá.");
      return;
    }

    // ⭐ KIỂM TRA BẢO MẬT: Phải chọn một StoreID thuộc quyền quản lý của mình
    if (voucherData.storeId && !userStoreIds.includes(voucherData.storeId)) {
        alert("Lỗi bảo mật: Bạn chỉ có thể tạo/sửa voucher cho các cơ sở thuộc sở hữu của mình.");
        return;
    }

    try {
      if (currentEditingId) {
        // --- CHẾ ĐỘ CẬP NHẬT (UPDATE) ---
        
        // ⭐ BỔ SUNG: Đảm bảo trường 'id' được lưu lại khi cập nhật
        voucherData.id = currentEditingId; 
        
        await vouchersRef.child(currentEditingId).update(voucherData);
        alert("Cập nhật voucher thành công!");
      } else {
        // --- CHẾ ĐỘ TẠO MỚI (CREATE) ---
        const newVoucherRef = vouchersRef.push();
        const newId = newVoucherRef.key; // Lấy ID vừa được tạo
        
        // ⭐ BỔ SUNG: Gán trường id vào đối tượng trước khi lưu
        voucherData.id = newId; 
        
        await newVoucherRef.set(voucherData);
        alert("Thêm voucher mới thành công!");
      }
      clearForm(); // Xoá trắng form sau khi lưu
      // Bảng sẽ tự động cập nhật vì chúng ta dùng .on() ở hàm loadVouchers
    } catch (error) {
      console.error("Lỗi khi lưu voucher:", error);
      alert("Đã xảy ra lỗi: " + error.message);
    }
  });

  // --- 5. HÀM TẢI VOUCHER (READ) ---
  function loadVouchers() {
    // Dùng .on("value", ...) để TỰ ĐỘNG lắng nghe mọi thay đổi dữ liệu
    vouchersRef.on(
      "value",
      (snapshot) => {
        const vouchers = snapshot.val();
        renderVoucherTable(vouchers);
      },
      (error) => {
        console.error("Lỗi tải danh sách voucher:", error);
        // Đã sửa colspan thành 8 (không hiển thị ID)
        voucherListBody.innerHTML =
          '<tr><td colspan="8" style="text-align: center">Lỗi tải dữ liệu.</td></tr>'; 
      },
    );
  }

  // Hàm phụ: Chuyển dữ liệu (object) thành HTML cho bảng
  function renderVoucherTable(vouchers) {
    if (!vouchers) {
      // Đã sửa colspan thành 8
      voucherListBody.innerHTML =
        '<tr><td colspan="8" style="text-align: center">Chưa có voucher nào.</td></tr>'; 
      return;
    }

    let html = "";
    for (const id in vouchers) {
      const voucher = vouchers[id];
      if (!voucher) continue;
      
      // ⭐ LƯU Ý: Giữ nguyên logic sử dụng 'id' từ key Firebase cho bảo mật/lọc,
      // và hiển thị các trường khác.

      const voucherStoreId = voucher.storeId || "";

      // ⭐ BẢO MẬT: Voucher phải thuộc 1 trong các cơ sở người dùng quản lý (hoặc là voucher chung)
      const isOwnedOrGlobal = voucherStoreId === ""|| userStoreIds.includes(voucherStoreId);

      // ⭐ LỌC: Phải thoả mãn điều kiện lọc từ dropdown
      const isFiltered = !currentFilterStoreId || (currentFilterStoreId === voucherStoreId);

      if (!isOwnedOrGlobal || !isFiltered) {
          continue; // Bỏ qua voucher không thuộc quyền quản lý hoặc không thoả mãn lọc
      }

      // Định dạng dữ liệu cho đẹp
      const statusText = voucher.isActive ? "Đang hoạt động" : "Ngừng HĐ";
      const statusClass = voucher.isActive ? "status-active" : "status-inactive";
      const expiryText = voucher.expiryDate
        ? new Date(voucher.expiryDate).toLocaleDateString("vi-VN")
        : "Không hết hạn";
      const minOrderText = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(voucher.minOrder || 0);
      const storeName = storeMap.get(voucherStoreId) || "Tất cả cơ sở";

      html += `<tr data-id="${id}">
                <td>${voucher.code}</td>
                <td>${voucher.discount}%</td>
                <td>${voucher.description || ""}</td>
                <td>${expiryText}</td>
                <td>${minOrderText}</td>
                <td>${storeName}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell"><button class="btn btn-edit" data-action="edit" data-id="${id}">Sửa</button><button class="btn btn-delete" data-action="delete" data-id="${id}" data-code="${voucher.code}">Xoá</button></td>
              </tr>`.trim();
    }
    voucherListBody.innerHTML = html;
  }

  // --- 6. HÀM TẢI VÀ LỌC DANH SÁCH CLB CỦA ADMIN ---

  // Tải danh sách CLB (store) thuộc về người dùng hiện tại
  async function loadUserClubsIntoDropdown() {
    try {
        const snapshot = await storesRef.once("value");
        const stores = snapshot.val();

        // Reset dropdowns và map
        voucherStoreInput.innerHTML = '<option value="">Tất cả cơ sở</option>';
        if (filterStoreInput) {
            filterStoreInput.innerHTML = '<option value="">Tất cả cơ sở</option>';
        }
        storeMap.clear();
        userStoreIds = [];

        if (stores) {
            for (const id in stores) {
                const store = stores[id];
                // LỌC BẢO MẬT: CHỈ LẤY CƠ SỞ THUỘC VỀ currentUserId
                if (store && store.name && store.ownerId === currentUserId) {
                    // Thêm vào dropdown Quản lý (Thêm/Sửa)
                    let option = document.createElement("option");
                    option.value = id;
                    option.textContent = store.name;
                    voucherStoreInput.appendChild(option);

                    // Thêm vào dropdown Lọc
                    if (filterStoreInput) {
                        let filterOption = option.cloneNode(true);
                        filterStoreInput.appendChild(filterOption);
                    }

                    // Lưu vào Map và danh sách ID
                    storeMap.set(id, store.name);
                    userStoreIds.push(id);
                }
            }
        }
    } catch (error) {
        console.error("Lỗi tải danh sách cơ sở:", error);
    }
  }

  // Hàm lắng nghe sự kiện thay đổi trên dropdown Lọc
  function setupFilterListener() {
    if (filterStoreInput) {
        filterStoreInput.addEventListener("change", (event) => {
            currentFilterStoreId = event.target.value;
            loadVouchers(); // Kích hoạt lại việc tải/hiển thị để áp dụng bộ lọc
        });
    }
  }

  // --- 7. HÀM XỬ LÝ NÚT SỬA VÀ XOÁ (DELETE) ---

  // Xử lý nút "Làm mới"
  clearBtn.addEventListener("click", clearForm);

  function clearForm() {
    form.reset(); // Đặt lại tất cả các trường
    voucherIdInput.value = "";
    currentEditingId = null;
    formTitle.textContent = "Thêm Voucher mới";
  }

  // Dùng "Event Delegation" để xử lý các nút Sửa/Xoá
  voucherListBody.addEventListener("click", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === "edit") {
      handleEditClick(id);
    } else if (action === "delete") {
      const code = target.dataset.code;
      handleDeleteClick(id, code);
    }
  });

  // Hàm xử lý khi bấm nút "Sửa"
  async function handleEditClick(id) {
    try {
      const snapshot = await vouchersRef.child(id).once("value");
      const voucher = snapshot.val();

      if (!voucher) {
        alert("Không tìm thấy voucher!");
        return;
      }
      
      // ⭐ KIỂM TRA BẢO MẬT: Chỉ cho phép sửa voucher thuộc CLB của mình
      if (voucher.storeId && !userStoreIds.includes(voucher.storeId)) {
          alert("Lỗi bảo mật: Bạn không có quyền sửa voucher này.");
          return;
      }

      // Đổ dữ liệu của voucher vào form
      voucherCodeInput.value = voucher.code;
      voucherDiscountInput.value = voucher.discount;
      voucherDescriptionInput.value = voucher.description || "";
      voucherExpiryInput.value = voucher.expiryDate || "";
      voucherMinOrderInput.value = voucher.minOrder || 0;
      voucherStatusInput.value = voucher.isActive.toString();
      voucherStoreInput.value = voucher.storeId || "";

      // Cập nhật trạng thái form
      voucherIdInput.value = id;
      currentEditingId = id;
      formTitle.textContent = `Chỉnh sửa Voucher: ${voucher.code}`;

      window.scrollTo(0, 0);
    } catch (error) {
      console.error("Lỗi khi tải voucher để sửa:", error);
      alert("Lỗi: " + error.message);
    }
  }

  // Hàm xử lý khi bấm nút "Xoá"
  async function handleDeleteClick(id, code) {
    if (confirm(`Bạn có chắc chắn muốn xoá voucher "${code}"?`)) {
      try {
        // ⭐ KIỂM TRA BẢO MẬT: Lấy dữ liệu để kiểm tra quyền
        const snapshot = await vouchersRef.child(id).once("value");
        const voucherToDelete = snapshot.val();

        if (voucherToDelete && voucherToDelete.storeId && !userStoreIds.includes(voucherToDelete.storeId)) {
            alert("Lỗi bảo mật: Bạn không có quyền xoá voucher này.");
            return;
        }

        // Gọi API 'remove' của Firebase
        await vouchersRef.child(id).remove();
        alert("Đã xoá voucher thành công.");
      } catch (error) {
        console.error("Lỗi khi xoá voucher:", error);
        alert("Lỗi: " + error.message);
      }
    }
  }
  
  // --- 8. HÀM XUẤT DỮ LIỆU (EXPORT CSV) ---
  async function exportVouchersToCsv() {
    try {
        const snapshot = await vouchersRef.once("value");
        const vouchers = snapshot.val();

        if (!vouchers) {
            alert("Không có dữ liệu voucher để xuất.");
            return;
        }

        let csv = "ID,Mã Voucher,Giảm giá (%),Mô tả,Ngày hết hạn,Đơn tối thiểu (VND),Áp dụng cho,Trạng thái\n";

        for (const id in vouchers) {
            const voucher = vouchers[id];

            // ⭐ LỌC BẢO MẬT: Chỉ xuất các voucher mà người dùng được quyền quản lý
            const voucherStoreId = voucher.storeId || "";
            const isOwnedOrGlobal = !voucherStoreId || userStoreIds.includes(voucherStoreId);
            if (!isOwnedOrGlobal) {
                continue;
            }

            const storeName = storeMap.get(voucherStoreId) || "Tất cả cơ sở";
            const statusText = voucher.isActive ? "Đang hoạt động" : "Ngừng hoạt động";

            // Xử lý các trường có thể có dấu phẩy bằng cách bao quanh bằng dấu ngoặc kép
            const description = `"${(voucher.description || "").replace(/"/g, '""')}"`;

            // THÊM ID VÀO ĐẦU DÒNG CSV (Sử dụng key Firebase 'id' làm trường ID)
            csv += `${id},${voucher.code},${voucher.discount},${description},${voucher.expiryDate || ""},${voucher.minOrder || 0},${storeName},${statusText}\n`;
        }

        // Tạo và kích hoạt tải về file CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", "danh_sach_voucher.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("Đã xuất dữ liệu ra file danh_sach_voucher.csv!");

    } catch (error) {
        console.error("Lỗi khi xuất CSV:", error);
        alert("Đã xảy ra lỗi khi xuất file: " + error.message);
    }
  }
  
  // --- 9. CHẠY HÀM KHỞI TẠO CHÍNH ---
  async function initializePage() {
    // 1. Lấy thông tin người dùng hiện tại (bảo mật)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUserId = user.uid;
            // 2. Tải danh sách CLB của người dùng này vào dropdown (và Map)
            await loadUserClubsIntoDropdown();
            // 3. Bắt đầu lắng nghe sự kiện thay đổi của filter
            setupFilterListener();
            // 4. Bắt đầu tải và lắng nghe voucher
            loadVouchers();
        } else {
            console.error("Người dùng chưa đăng nhập.");
        }
    });

    // Bắt đầu lắng nghe sự kiện xuất file
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", exportVouchersToCsv);
    }
  }

  initializePage();
});