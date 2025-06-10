import { fetchGoogleSheet } from './connect.js';
import { startBarcodeScanner } from './barcode-cam.js';

const eventSelect = document.getElementById('event-select');
const studentIdInput = document.getElementById('student-id');
const addBtn = document.getElementById('add-btn');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const studentListBody = document.getElementById('student-list');
const passCodeInput = document.getElementById("pass-code");
const addBarcodeBtn = document.getElementById('add-barcode-btn');

let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';

let urlGAS = "https://script.google.com/macros/s/AKfycbzOYChN4ziw-dVjc_1I4CCXl-GwSjqXDX0vV1bKeHERB06aiK0hYtSVcvDKuhhPPJtecQ/exec";

// Load danh sách sự kiện từ Google Sheet
async function loadEvents() {
    try {
        const data = await fetchGoogleSheet("CONG_BO");
        const eventNames = [
            ...new Set(
                data
                    .filter(row => row.status === "Duyệt" && row.nameEvent)
                    .map(row => row.nameEvent)
            )
        ];

        eventNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            eventSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Lỗi khi tải danh sách sự kiện:", err);
    }
}

// Load danh sách sinh viên từ Google Sheet
async function loadStudentData() {
    try {
        const data = await fetchGoogleSheet("CHIEN_SI");
        studentDataMap = {};
        data.forEach(row => {
            const id = String(row.idStudent).trim();
            const name = String(row.fullName).trim();
            if (id && name) {
                studentDataMap[id] = name;
            }
        });
    } catch (err) {
        console.error("Lỗi khi tải danh sách sinh viên:", err);
    }
}

// Load danh sách từ localStorage (nếu có)
function loadLocalList() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        studentList = JSON.parse(stored);
        renderList();
    }
}

// Hiển thị danh sách MSSV và tên sinh viên
function renderList() {
    studentListBody.innerHTML = "";
    studentList.forEach(mssv => {
        const trimmedMSSV = String(mssv).trim();
        const fullName = studentDataMap[trimmedMSSV] || "Không rõ";

        const row = document.createElement("tr");
        const idCell = document.createElement("td");
        idCell.textContent = trimmedMSSV;

        const nameCell = document.createElement("td");
        nameCell.textContent = fullName;

        row.appendChild(idCell);
        row.appendChild(nameCell);
        studentListBody.appendChild(row);
    });
}

// Thêm MSSV vào danh sách
function addStudent() {
    const mssv = studentIdInput.value.trim();

    if (!mssv) {
        alert("Vui lòng nhập MSSV.");
        return;
    }

    if (mssv.length !== 8) {
        alert("Sai định dạng MSSV.");
        return;
    }

    if (studentList.includes(mssv)) {
        alert("MSSV đã có trong danh sách.");
        return;
    }

    studentList.push(mssv);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
    renderList();
    studentIdInput.value = "";
}

// Xử lý quét barcode
function handleBarcodeScan() {
    startBarcodeScanner((scannedText, stopScanner) => {
        const mssv = scannedText.trim();

        if (mssv.length !== 8) {
            alert(`❌ Mã không hợp lệ: "${mssv}"`);
            return;
        }

        if (studentList.includes(mssv)) {
            alert(`⚠️ MSSV ${mssv} đã có trong danh sách.`);
            return;
        }

        studentList.push(mssv);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
        renderList();
        alert(`✅ Đã thêm ${mssv} vào danh sách.`);
        // Không gọi stopScanner() => tiếp tục quét cho đến khi người dùng bấm đóng
    });
}

// Gửi dữ liệu
async function submitList() {
    const selectedEvent = eventSelect.value;
    const passcode = passCodeInput.value;

    if (!selectedEvent) {
        alert("Vui lòng chọn sự kiện.");
        return;
    }

    if (!passcode) {
        alert("Vui lòng nhập mã quản trị.");
        return;
    }

    if (studentList.length === 0) {
        alert("Danh sách sinh viên đang trống.");
        return;
    }

    const success = await sendDataToSheet(studentList, selectedEvent, passcode);

    if (success) {
        studentList = [];
        localStorage.removeItem(STORAGE_KEY);
        renderList();
    }
}

// Gửi dữ liệu lên Google Sheet thông qua Apps Script
async function sendDataToSheet(studentList, eventName, passcode) {
    try {
        const response = await fetch(
            urlGAS,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    data: studentList,
                    eventName: eventName,
                    passcode: passcode,
                }),
                mode: 'no-cors'
            }
        );

        alert("✅ Yêu cầu gửi dữ liệu đã được thực hiện.");
        return true;

    } catch (err) {
        console.error("Lỗi gửi dữ liệu:", err);
        alert("❌ Không thể gửi dữ liệu. Vui lòng kiểm tra kết nối.");
        return false;
    }
}

// Xóa danh sách
function clearList() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ danh sách?")) {
        studentList = [];
        localStorage.removeItem(STORAGE_KEY);
        renderList();
    }
}

// Gán sự kiện sau khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", async () => {
    await loadEvents();
    await loadStudentData();
    loadLocalList();

    addBtn.addEventListener("click", addStudent);
    submitBtn.addEventListener("click", submitList);
    clearBtn.addEventListener("click", clearList);

    if (addBarcodeBtn) {
        addBarcodeBtn.addEventListener("click", handleBarcodeScan);
    }

    studentIdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStudent();
        }
    });
});
