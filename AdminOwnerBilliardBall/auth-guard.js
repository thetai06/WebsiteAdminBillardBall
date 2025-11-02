auth.onAuthStateChanged(function (user) {
  if (user) {
    console.log("Người dùng đã đăng nhập:", user.email);

    db.ref("dataUser/" + user.uid).once("value")
      .then((snapshot) => {
        const userData = snapshot.val(); 

        if (userData && userData.role === "admin") {
          console.log("Người dùng là ADMIN: Cho phép truy cập và xóa phiên.");
          
          if(window.location.pathname.includes("login.html") || window.location.pathname === "/") {
            window.location.href = "tong-quan.html"; 
          } 
          else if (typeof startPageLogic === 'function') {
            startPageLogic(user); 
          }

        } else {
          console.log("Không phải Admin. Buộc đăng xuất.");
          auth.signOut();
          alert("Bạn không có quyền truy cập trang quản trị này!");
          window.location.href = "login.html";
        }
      })
      .catch((error) => {
        console.error("Lỗi khi lấy thông tin vai trò:", error);
        auth.signOut();
        window.location.href = "login.html";
      });
  } else {
    if (!window.location.pathname.includes("login.html")) {
        console.log("Chưa đăng nhập, chuyển về trang login.");
        window.location.href = "login.html";
    }
  }
});