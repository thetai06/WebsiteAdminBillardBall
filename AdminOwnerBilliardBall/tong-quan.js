let currentOwnerId = null;
let bookingChart = null;



// Load Dashboard Data
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
        
        // GỌI CÁC HÀM TẢI DỮ LIỆU CHÍNH
        loadDashboardStats();
        loadRecentBookings();
        loadTopClubs();
        loadBookingChart();
    }
}
/**
 * Tải thống kê tổng quan
 */
function loadDashboardStats() {
  if (!currentOwnerId) return;

  // Tải tổng số CLB của owner
  db.ref('dataStore')
    .orderByChild('ownerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      const count = snapshot.exists() ? snapshot.numChildren() : 0;
      document.getElementById('total-clubs').textContent = count;
    });

  // Tải tổng số người dùng (manager + user) thuộc owner
  db.ref('dataUser')
    .orderByChild('ownerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      const count = snapshot.exists() ? snapshot.numChildren() : 0;
      document.getElementById('total-users').textContent = count;
    });

  // Tải số đơn đặt bàn hôm nay
  loadTodayBookings();

  // Tải doanh thu tháng
  loadMonthlyRevenue();
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
          if (booking.dateTime === todayStr) {
            todayCount++;
          }
        });
      }
      document.getElementById('today-bookings').textContent = todayCount;
    });
}

/**
 * Tính doanh thu tháng hiện tại
 */
function loadMonthlyRevenue() {
  if (!currentOwnerId) return;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      let totalRevenue = 0;
      
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const booking = child.val();
          
          // Chỉ tính đơn đã thanh toán
          if (booking.paymentStatus === 'Đã thanh toán' || booking.status === 'Đã hoàn thành' || booking.status === 'Đã hoàn thanh(owner)') {
            if (booking.dateTime) {
              const parts = booking.dateTime.split('/'); // DD/MM/YYYY
              if (parts.length === 3) {
                const bookingMonth = parseInt(parts[1], 10);
                const bookingYear = parseInt(parts[2], 10);
                
                if (bookingMonth === currentMonth && bookingYear === currentYear) {
                  totalRevenue += booking.money || 0;
                }
              }
            }
          }
        });
      }
      
      document.getElementById('monthly-revenue').textContent = 
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue);
    });
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

        // Đảo ngược để hiển thị mới nhất trước
        bookings.reverse().forEach((booking) => {
          let statusClass = 'status-pending';
          let statusText = 'Đang chờ';
          
          // Ưu tiên hiển thị status đơn
          if (booking.status) {
            if (booking.status === 'Đã hoàn thành' || booking.status === 'Đã hoàn thanh(owner)') {
              statusClass = 'status-completed';
              statusText = 'Hoàn thành';
            } else if (booking.status === 'Đã huỷ') {
              statusClass = 'status-cancelled';
              statusText = 'Đã hủy';
            } else if (booking.status === 'Đang chờ') {
              statusClass = 'status-pending';
              statusText = 'Đang chờ';
            }
          } else if (booking.paymentStatus === 'Đã thanh toán') {
            statusClass = 'status-confirmed';
            statusText = 'Đã xác nhận';
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
        bookingsList.innerHTML = `
          <div class="booking-item">
            <div class="booking-info">
              <h4>Chưa có đơn đặt bàn nào</h4>
            </div>
          </div>
        `;
      }
    });
}

/**
 * Tải Top CLB được đặt nhiều nhất
 */
function loadTopClubs() {
  if (!currentOwnerId) return;

  // Lấy danh sách CLB
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

      // Đếm số đơn cho mỗi CLB
      db.ref('dataBookTable')
        .orderByChild('storeOwnerId')
        .equalTo(currentOwnerId)
        .once('value', (bookingSnapshot) => {
          const bookingCounts = {};

          // Đếm số đơn
          if (bookingSnapshot.exists()) {
            bookingSnapshot.forEach((child) => {
              const booking = child.val();
              const storeId = booking.storeId;
              if (storeId) {
                bookingCounts[storeId] = (bookingCounts[storeId] || 0) + 1;
              }
            });
          }

          // Tạo mảng CLB với số đơn
          const clubsArray = [];
          storeSnapshot.forEach((child) => {
            const club = child.val();
            clubsArray.push({
              id: child.key,
              name: club.name || 'CLB không tên',
              bookings: bookingCounts[child.key] || 0
            });
          });

          // Sắp xếp theo số đơn giảm dần
          clubsArray.sort((a, b) => b.bookings - a.bookings);

          // Hiển thị top 5
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
        });
    });
}

/**
 * Tải biểu đồ đặt bàn theo tháng
 */
function loadBookingChart() {
  if (!currentOwnerId) return;

  db.ref('dataBookTable')
    .orderByChild('storeOwnerId')
    .equalTo(currentOwnerId)
    .once('value', (snapshot) => {
      // Khởi tạo dữ liệu cho 12 tháng
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
              
              // Chỉ tính năm hiện tại
              if (bookingYear === currentYear && bookingMonth >= 0 && bookingMonth < 12) {
                monthlyData[bookingMonth]++;
              }
            }
          }
        });
      }

      renderBookingChart(monthlyData);
    });
}

/**
 * Vẽ biểu đồ Chart.js
 */
function renderBookingChart(data) {
  const ctx = document.getElementById('bookingChart');
  
  if (!ctx) {
    console.error('Không tìm thấy canvas bookingChart');
    return;
  }

  // Hủy chart cũ nếu có
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