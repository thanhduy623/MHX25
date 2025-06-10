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

// Thêm các phần tử DOM cho hộp thoại xác nhận quét
const scanConfirmDialog = document.getElementById('scan-confirm-dialog');
const scannedMssvDisplay = document.getElementById('scanned-mssv-display');
const confirmScanBtn = document.getElementById('confirm-scan-btn');
const cancelScanBtn = document.getElementById('cancel-scan-btn');
const scannerStatusDisplay = document.getElementById('scanner-status'); // Để hiển thị trạng thái máy quét

let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';

let urlGAS = "https://script.google.com/macros/s/AKfycbzOYChN4ziw-dVjc_1I4CCXl-GwSjqXDX0vV1bKeHERB06aiK0hYtSVcvDKuhhPPJtecQ/exec";

// Biến để lưu trữ hàm dừng máy quét
let stopCurrentScanner = null;
// Biến để lưu trữ MSSV tạm thời từ quét
let currentScannedMssv = null;

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

// Hàm bắt đầu quét barcode
function startScanningProcess() {
    scannerStatusDisplay.textContent = 'Máy quét đang hoạt động...';
    stopCurrentScanner = startBarcodeScanner((scannedText, stopScannerCallback) => {
        // Lưu lại hàm stopScanner để có thể dừng máy quét từ bên ngoài
        stopCurrentScanner = stopScannerCallback;

        const mssv = scannedText.trim();
        currentScannedMssv = mssv; // Lưu mã đã quét tạm thời

        // Dừng máy quét tạm thời để chờ xác nhận
        if (stopCurrentScanner) {
            stopCurrentScanner();
            stopCurrentScanner = null; // Đặt lại về null để tránh dừng nhầm
            scannerStatusDisplay.textContent = 'Đã quét: Chờ xác nhận...';
        }

        // Hiển thị hộp thoại xác nhận
        scannedMssvDisplay.textContent = mssv;
        scanConfirmDialog.style.display = 'block';
    });
}

// Xử lý khi xác nhận MSSV đã quét
function confirmScannedStudent() {
    const mssv = currentScannedMssv;

    if (!mssv) {
        alert('Không có MSSV nào để xác nhận.');
        return;
    }

    if (mssv.length !== 8) {
        alert(`❌ Mã không hợp lệ: "${mssv}"`);
        // Đóng hộp thoại và tiếp tục quét
        scanConfirmDialog.style.display = 'none';
        startScanningProcess();
        return;
    }

    if (studentList.includes(mssv)) {
        alert(`⚠️ MSSV ${mssv} đã có trong danh sách.`);
        // Đóng hộp thoại và tiếp tục quét
        scanConfirmDialog.style.display = 'none';
        startScanningProcess();
        return;
    }

    studentList.push(mssv);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
    renderList();
    alert(`✅ Đã thêm ${mssv} vào danh sách.`);

    // Đóng hộp thoại xác nhận và tiếp tục quét
    scanConfirmDialog.style.display = 'none';
    startScanningProcess(); // Tiếp tục quét sau khi xác nhận
}

// Xử lý khi hủy MSSV đã quét
function cancelScannedStudent() {
    currentScannedMssv = null; // Xóa mã đã quét tạm thời
    scanConfirmDialog.style.display = 'none'; // Đóng hộp thoại
    startScanningProcess(); // Tiếp tục quét
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
        addBarcodeBtn.addEventListener("click", startScanningProcess); // Gọi hàm bắt đầu quét
    }

    // Xử lý sự kiện cho hộp thoại xác nhận quét
    if (confirmScanBtn) {
        confirmScanBtn.addEventListener('click', confirmScannedStudent);
    }
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', cancelScannedStudent);
    }

    studentIdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStudent();
        }
    });
});
