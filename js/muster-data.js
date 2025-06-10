import { fetchGoogleSheet } from './connect.js';

const studentIdInput = document.getElementById("student-id");
const searchBtn = document.getElementById("search-btn");
const resultBody = document.getElementById("result-body");

searchBtn.addEventListener("click", async () => {
    const studentId = studentIdInput.value.trim();

    if (!studentId || studentId.length !== 8) {
        alert("Vui lòng nhập MSSV hợp lệ (8 chữ số).");
        return;
    }

    try {
        const data = await fetchGoogleSheet("DIEM_DANH");
        const filtered = data.filter(row => row.idStudent === studentId);
        renderTable(filtered);
    } catch (err) {
        console.error("Lỗi khi tải dữ liệu từ Google Sheet:", err);
        alert("Không thể tải dữ liệu. Vui lòng thử lại sau.");
    }
});

function renderTable(data) {
    if (!data || data.length === 0) {
        resultBody.innerHTML = `<tr><td colspan="3">Không tìm thấy hoạt động nào.</td></tr>`;
        return;
    }

    resultBody.innerHTML = data.map(row => `
        <tr>
            <td data-label="Loại">${row.type || ""}</td>
            <td data-label="Tên hoạt động">${row.eventName || ""}</td>
            <td data-label="Trạng thái">${row.status || ""}</td>
        </tr>
    `).join("");
}
