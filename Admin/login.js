document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("login-form");

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault(); 

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    console.log("Đang thử đăng nhập với:", email);

    // ⭐ BƯỚC QUAN TRỌNG: ĐẶT CHẾ ĐỘ DUY TRÌ PHIÊN THÀNH SESSION
    // Phiên làm việc sẽ mất khi đóng tab/trình duyệt
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION) 
      .then(() => {
        // Bước 1: Xác thực email/password
        return auth.signInWithEmailAndPassword(email, password);
      })
      .then((userCredential) => {
        const user = userCredential.user;
        console.log("Xác thực thành công, đang kiểm tra quyền Admin...", user.uid);

        // Bước 2: Dùng Realtime Database để kiểm tra quyền
        return db.ref("dataUser/" + user.uid).once("value");
      })
      .then((snapshot) => {
        // Bước 3: Ra quyết định dựa trên role
        const userData = snapshot.val(); 

        if (userData && userData.role === "superadmin") {
          console.log("Là Admin! Chuyển hướng thành công.");
          window.location.href = "Admin_quanly.html"; 
        } else {
          console.log("Không phải Admin. Từ chối truy cập.");
          alert("Bạn không có quyền truy cập trang quản trị này!");
          auth.signOut(); 
        }
      })
      .catch((error) => {
        console.error("Lỗi đăng nhập:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          alert("Email hoặc mật khẩu không đúng!");
        } else {
          alert("Đã xảy ra lỗi: " + error.message);
        }
      });
  });
});