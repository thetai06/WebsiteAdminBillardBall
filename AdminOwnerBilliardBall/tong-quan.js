// Biến toàn cục
let currentOwnerId = null;
let bookingChart = null;

// Biến trạng thái cho bộ lọc (Filter State)
let filterMode = 'month'; // 'day', 'week', 'month', 'year'
let currentDate = new Date(); // Ngày tham chiếu cho bộ lọc

/* =========================================
 KHỞI ĐỘNG TRANG
========================================= 
*/

document.addEventListener('DOMContentLoaded', function() {
  // Các hàm load sẽ được gọi sau khi auth xác nhận
});

/**
 * HÀM KHỞI TẠO LOGIC CHÍNH (Được gọi từ auth-guard.js sau khi xác minh Admin)
 * @param {firebase.User} user Đối tượng người dùng Firebase
 */
function startPageLogic(user) {
    if (user) {
        currentOwnerId = user.uid;
        document.getElementById('admin-email').textContent = user.email || 'Chủ CLB';
        
        // --- KÍCH HOẠT BỘ LỌC SAU KHI ĐĂNG NHẬP ---
        addFilterEventListeners();
        updateFilterDisplay(); 
        // ----------------------------------
        
        // GỌI CÁC HÀM TẢI DỮ LIỆU CHÍNH
        loadDashboardStats(); // Hàm này sẽ tự động gọi loadMonthlyRevenue()
        loadRecentBookings();
        loadTopClubs();
        loadBookingChart();
    }
}

/* =========================================
 CÁC HÀM TẢI DỮ LIỆU (loadMonthlyRevenue đã được sửa)
========================================= 
*/

/**
 * Tải thống kê tổng quan
 */
function loadDashboardStats() {
  if (!currentOwnerId) return;

  db.ref('dataStore')
    .orderByChild('ownerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      const count = snapshot.exists() ? snapshot.numChildren() : 0;
      document.getElementById('total-clubs').textContent = count;
    })
    .catch(handleFirebaseError);

  db.ref('dataUser')
    .orderByChild('ownerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      const count = snapshot.exists() ? snapshot.numChildren() : 0;
      document.getElementById('total-users').textContent = count;
    })
    .catch(handleFirebaseError);

  loadTodayBookings();
  loadMonthlyRevenue(); // Tải doanh thu theo bộ lọc
}

/**
 * Tải số đơn đặt bàn hôm nay
 */
function loadTodayBookings() {
  if (!currentOwnerId) return;
  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      let todayCount = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const booking = child.val();
          if (booking.dateTime && booking.dateTime === todayStr) {
            todayCount++;
          }
        });
      }
      document.getElementById('today-bookings').textContent = todayCount;
    })
    .catch(handleFirebaseError);
}

/**
 * === HÀM ĐÃ THAY THẾ ===
 * Tính doanh thu dựa trên bộ lọc (filterMode và currentDate)
 */
function loadMonthlyRevenue() {
  if (!currentOwnerId) {
    console.warn("loadMonthlyRevenue được gọi nhưng currentOwnerId is null.");
    return; 
  }

  const { startDate, endDate } = getDisplayRange(filterMode, currentDate);
  updateFilterDisplay(); // Cập nhật UI (tab, text)

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      let totalRevenue = 0;
      let bookingCount = 0;
      
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const booking = child.val();
          
          if (booking.paymentStatus === 'Đã thanh toán' || booking.status === 'Đã hoàn thành' || booking.status === 'Đã hoàn thanh(owner)') {
            if (booking.dateTime) {
              const parts = booking.dateTime.split('/'); // DD/MM/YYYY
              if (parts.length === 3) {
                const bookingDate = new Date(parts[2], parts[1] - 1, parts[0]);
                bookingDate.setHours(0, 0, 0, 0);
                
                if (bookingDate >= startDate && bookingDate <= endDate) {
                  totalRevenue += booking.money || 0;
                  bookingCount++;
                }
              }
            }
          }
        });
      }
      
      document.getElementById('monthly-revenue').textContent = 
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue);
      document.getElementById('revenue-booking-count').textContent = `${bookingCount} đơn`;
    })
    .catch(handleFirebaseError);
}

/**
 * Tải 5 đơn đặt bàn gần đây
 */
function loadRecentBookings() {
  if (!currentOwnerId) return;

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .limitToLast(5)
    .once('value', (snapshot) => {
      const bookingsList = document.getElementById('recent-bookings-list');
      bookingsList.innerHTML = '';

      if (snapshot.exists()) {
        const bookings = [];
        snapshot.forEach((child) => {
          bookings.push({ id: child.key, ...child.val() });
        });
        bookings.reverse().forEach((booking) => {
          let statusClass = 'status-pending';
          let statusText = 'Đang chờ';
          if (booking.status) {
            if (booking.status === 'Đã hoàn thành' || booking.status === 'Đã hoàn thanh(owner)') {
              statusClass = 'status-completed'; statusText = 'Hoàn thành';
            } else if (booking.status === 'Đã huỷ') {
              statusClass = 'status-cancelled'; statusText = 'Đã hủy';
            } else if (booking.status === 'Đang chờ') {
              statusClass = 'status-pending'; statusText = 'Đang chờ';
            }
          } else if (booking.paymentStatus === 'Đã thanh toán') {
            statusClass = 'status-confirmed'; statusText = 'Đã xác nhận';
          }
          bookingsList.innerHTML += `
            <div class="booking-item">
              <div class="booking-info">
                <h4>${booking.addressClb || 'CLB không xác định'}</h4>
                <p>${booking.name || 'Khách hàng'} - ${booking.dateTime || 'N/A'} ${booking.startTime ? booking.startTime : ''}</p>
              </div>
              <span class="booking-status ${statusClass}">${statusText}</span>
            </div>
          `;
        });
      } else {
        bookingsList.innerHTML = `<div class="booking-item"><div class="booking-info"><h4>Chưa có đơn đặt bàn nào</h4></div></div>`;
      }
    })
    .catch(handleFirebaseError);
}

/**
 * Tải Top CLB
 */
function loadTopClubs() {
  if (!currentOwnerId) return;

  db.ref('dataStore')
    .orderByChild('ownerId')
    .equalTo(currentOwnerId)
    .once('value', (storeSnapshot) => {
      const clubsList = document.getElementById('top-clubs-list');
      clubsList.innerHTML = '';
      if (!storeSnapshot.exists()) {
        clubsList.innerHTML = '<li><span class="club-name">Chưa có CLB nào</span></li>';
        return;
      }

      db.ref('dataBookTable')
        .orderByChild('storeOwnerId')
        .equalTo(currentOwnerId)
        .once('value', (bookingSnapshot) => {
          const bookingCounts = {};
          if (bookingSnapshot.exists()) {
            bookingSnapshot.forEach((child) => {
              const booking = child.val();
              const storeId = booking.storeId;
              if (storeId) {
                bookingCounts[storeId] = (bookingCounts[storeId] || 0) + 1;
              }
            });
          }
          const clubsArray = [];
          storeSnapshot.forEach((child) => {
            const club = child.val();
            clubsArray.push({
              id: child.key,
              name: club.name || 'CLB không tên',
              bookings: bookingCounts[child.key] || 0
            });
          });
          clubsArray.sort((a, b) => b.bookings - a.bookings);
          const top5 = clubsArray.slice(0, 5);
          if (top5.length === 0) {
            clubsList.innerHTML = '<li><span class="club-name">Chưa có CLB nào</span></li>';
            return;
          }
          top5.forEach((club, index) => {
            clubsList.innerHTML += `
              <li>
                <div class="club-rank">${index + 1}</div>
                <span class="club-name">${club.name}</span>
                <span class="club-bookings">${club.bookings} đơn</span>
              </li>
            `;
          });
        })
        .catch(handleFirebaseError);
    })
    .catch(handleFirebaseError);
}

/**
 * Tải biểu đồ
 */
function loadBookingChart() {
  if (!currentOwnerId) return;

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      const monthlyData = new Array(12).fill(0);
      const currentYear = new Date().getFullYear();

      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const booking = child.val();
          if (booking.dateTime) {
            const parts = booking.dateTime.split('/'); // DD/MM/YYYY
            if (parts.length === 3) {
              const bookingMonth = parseInt(parts[1], 10) - 1; // 0-11
              const bookingYear = parseInt(parts[2], 10);
              if (bookingYear === currentYear && bookingMonth >= 0 && bookingMonth < 12) {
                monthlyData[bookingMonth]++;
              }
            }
          }
        });
      }
      renderBookingChart(monthlyData);
    })
    .catch(handleFirebaseError);
}

/**
 * Vẽ biểu đồ Chart.js
 */
function renderBookingChart(data) {
  const ctx = document.getElementById('bookingChart');
  if (!ctx) return;
  if (bookingChart) {
    bookingChart.destroy();
  }
  bookingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
      datasets: [{
        label: 'Số đơn đặt bàn',
        data: data,
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(52, 152, 219, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 13
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 13
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              display: false
            }
          }
        }
    }
  });
}

/* =========================================
 CÁC HÀM XỬ LÝ BỘ LỌC DOANH THU (MÃ MỚI)
========================================= 
*/

/**
 * Gán sự kiện click cho các nút của bộ lọc
 */
function addFilterEventListeners() {
  try {
    document.getElementById('filter-day').addEventListener('click', () => setFilterMode('day'));
    document.getElementById('filter-week').addEventListener('click', () => setFilterMode('week'));
    document.getElementById('filter-month').addEventListener('click', () => setFilterMode('month'));
    document.getElementById('filter-year').addEventListener('click', () => setFilterMode('year'));

    document.getElementById('filter-prev').addEventListener('click', () => navigateFilter(-1));
    document.getElementById('filter-next').addEventListener('click', () => navigateFilter(1));
    document.getElementById('filter-today').addEventListener('click', () => navigateToToday());
  } catch (e) {
    console.error("Lỗi khi gán sự kiện cho bộ lọc:", e);
  }
}

/**
 * (Logic) Đổi chế độ lọc
 */
function setFilterMode(mode) {
  filterMode = mode;
  currentDate = new Date(); // Reset về ngày hôm nay
  loadMonthlyRevenue(); // Tải lại doanh thu
}

/**
 * (Logic) Xử lý nút "Trước" và "Sau"
 */
function navigateFilter(direction) { // -1 (trước) hoặc 1 (sau)
  if (filterMode === 'day') {
    currentDate.setDate(currentDate.getDate() + direction);
  } else if (filterMode === 'week') {
    currentDate.setDate(currentDate.getDate() + (7 * direction));
  } else if (filterMode === 'month') {
    currentDate.setMonth(currentDate.getMonth() + direction);
  } else if (filterMode === 'year') {
    currentDate.setFullYear(currentDate.getFullYear() + direction);
  }
  loadMonthlyRevenue(); // Tải lại doanh thu
}

/**
 * (Logic) Xử lý nút "Hôm nay"
 */
function navigateToToday() {
  currentDate = new Date();
  loadMonthlyRevenue(); // Tải lại doanh thu
}

/**
 * (Hiển thị) Cập nhật văn bản
 */
function updateFilterDisplay() {
  const { displayString } = getDisplayRange(filterMode, currentDate);
  const displayElement = document.getElementById('filter-display-value');
  if (displayElement) {
    displayElement.textContent = displayString;
  }
  
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  const activeTab = document.getElementById(`filter-${filterMode}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
}

/**
 * (Hỗ trợ) Lấy Ngày bắt đầu, Ngày kết thúc, và Chuỗi hiển thị
 */
function getDisplayRange(mode, date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0=CN, 1=T2, ... 6=T7

  let startDate = new Date(year, month, day);
  let endDate = new Date(year, month, day);
  let displayString = '';

  switch (mode) {
    case 'day':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      displayString = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
      break;

    case 'week':
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Tuần bắt đầu từ T2
      startDate.setDate(day + diff);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // Tuần kết thúc vào CN
      endDate.setHours(23, 59, 59, 999);

      const startDay = startDate.getDate().toString().padStart(2, '0');
      const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
      const endDay = endDate.getDate().toString().padStart(2, '0');
      const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
      displayString = `Tuần (${startDay}/${startMonth} - ${endDay}/${endMonth})`;
      break;

    case 'month':
      startDate = new Date(year, month, 1, 0, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999); // Ngày cuối tháng
      displayString = `Tháng ${month + 1}, ${year}`;
      break;

    case 'year':
      startDate = new Date(year, 0, 1, 0, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      displayString = `Năm ${year}`;
      break;
  }
  
  return { startDate, endDate, displayString };
}

/**
 * (Hỗ trợ) Xử lý lỗi Firebase
 */
function handleFirebaseError(error) {
  console.error("Lỗi khi tải dữ liệu từ Firebase:", error);
}