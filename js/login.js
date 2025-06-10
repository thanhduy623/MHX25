import { fetchGoogleSheet } from './connect.js';

const urlNextPage = "muster.html";

document.querySelector(".login-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const studentId = document.querySelector("#student-id").value.trim();
    const password = document.querySelector("#password").value.trim();

    try {
        const data = await fetchGoogleSheet("CHIEN_SI");

        // 🔍 Tìm người dùng theo mã số sinh viên
        const user = data.find(row => row.idStudent === studentId);

        if (!user) {
            alert("❌ Bạn không phải chiến sĩ MHX CNTT 2025");
            return;
        }

        // ✅ Nếu không có mật khẩu → cho phép đăng nhập
        const noPassword = !user.password || user.password.trim() === "" || user.password.trim() === "-";
        if (noPassword) {
            localStorage.setItem("idStudent", studentId);
            window.location.href = urlNextPage;
            return;
        }

        // 🔐 Nếu có mật khẩu, kiểm tra khớp không
        if (user.password === password) {
            localStorage.setItem("idStudent", studentId);
            window.location.href = urlNextPage;
        } else {
            alert("❌ Sai mật khẩu. Vui lòng kiểm tra lại.");
        }

    } catch (error) {
        console.error("Lỗi khi đăng nhập:", error);
        alert("⚠️ Không thể kết nối tới dữ liệu. Vui lòng thử lại sau.");
    }
});
