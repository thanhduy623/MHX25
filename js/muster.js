// muster.js
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

// --- CÁC PHẦN TỬ MỚI CHO HỘP THOẠI XÁC NHẬN / THÔNG BÁO ---
const barcodeScannerContainer = document.getElementById('barcode-scanner-container');
const scannedResultDisplay = document.getElementById('scanned-result-display');
const confirmScanBtn = document.getElementById('confirm-scan-btn');
const cancelScanBtn = document.getElementById('cancel-scan-btn');
const closeScannerBtn = document.getElementById('close-scanner-btn');

const customMessageBox = document.getElementById('custom-message-box');
const customMessageText = document.getElementById('custom-message-text');
const customMessageOkBtn = document.getElementById('custom-message-ok-btn');
// -------------------------------------------------------------

let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';

let urlGAS = "https://script.google.com/macros/s/AKfycbzOYChN4ziw-dVjc_1I4CCXl-GwSjqXDX0vV1bKeHERB06aiK0hYtSVcvDKuhpPPJtecQ/exec";

// Biến lưu trữ hàm để dừng máy quét hiện tại từ thư viện barcode-cam
let stopCurrentScannerFunction = null;
// Biến lưu trữ đối tượng Html5Qrcode instance để điều khiển pause/resume
let html5QrCodeInstance = null;
// Biến lưu trữ MSSV vừa quét được, chờ xử lý
let pendingScannedMssv = null;

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

// Thêm MSSV vào danh sách (manual input)
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

/**
 * Hiển thị hộp thoại thông báo tùy chỉnh.
 * @param {string} message - Nội dung thông báo.
 * @param {function} onOk - Callback khi người dùng nhấn OK.
 */
function showCustomMessageBox(message, onOk = () => {}) {
    customMessageText.textContent = message;
    customMessageBox.style.display = 'flex';
    customMessageOkBtn.onclick = () => {
        customMessageBox.style.display = 'none';
        onOk();
    };
}

/**
 * Bắt đầu quá trình quét barcode.
 * Sẽ hiển thị khung camera và chờ mã được quét.
 */
function startScanningProcess() {
    // Nếu máy quét đang chạy, dừng nó trước khi bắt đầu cái mới
    if (stopCurrentScannerFunction) {
        stopCurrentScannerFunction();
        stopCurrentScannerFunction = null;
        html5QrCodeInstance = null; // Đảm bảo instance được reset
    }

    // Hiển thị khung quét (overlay)
    barcodeScannerContainer.style.display = 'flex';
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    
    // Ẩn nút xác nhận khi mới bắt đầu quét, hiển thị nút hủy/đóng
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';

    // Khởi tạo máy quét, truyền callback xử lý khi quét được mã
    const scannerControl = startBarcodeScanner(
        (scannedText) => {
            // Hàm này sẽ được gọi mỗi khi có mã được quét
            pendingScannedMssv = scannedText.trim();

            // Tạm dừng máy quét để chờ xử lý và xác nhận
            if (html5QrCodeInstance && html5QrCodeInstance.isScanning()) { // Dùng isScanning()
                html5QrCodeInstance.pause(true); // Tạm dừng quét nhưng vẫn giữ camera hoạt động
            }

            // Hiển thị MSSV đã quét và các nút xác nhận/hủy
            const fullName = studentDataMap[pendingScannedMssv] || "Không rõ tên";
            scannedResultDisplay.textContent = `MSSV: ${pendingScannedMssv} - ${fullName}`;
            confirmScanBtn.style.display = 'inline-block';
            cancelScanBtn.textContent = 'Hủy (tiếp tục quét)';

            // Kiểm tra định dạng MSSV
            if (pendingScannedMssv.length !== 8) {
                showCustomMessageBox(`❌ Mã "${pendingScannedMssv}" không hợp lệ. Vui lòng quét lại.`, () => {
                    pendingScannedMssv = null;
                    if (html5QrCodeInstance) {
                        html5QrCodeInstance.resume(); // Tiếp tục quét sau khi thông báo lỗi
                    } else {
                        startScanningProcess(); // Nếu instance không còn, khởi động lại hoàn toàn
                    }
                });
                return;
            }

            // Kiểm tra trùng lặp
            if (studentList.includes(pendingScannedMssv)) {
                showCustomMessageBox(`⚠️ MSSV ${pendingScannedMssv} đã có trong danh sách.`, () => {
                    pendingScannedMssv = null;
                    if (html5QrCodeInstance) {
                        html5QrCodeInstance.resume(); // Tiếp tục quét sau khi thông báo trùng lặp
                    } else {
                        startScanningProcess();
                    }
                });
                return;
            }
        }, 
        // Callback cho sự kiện lỗi (ví dụ: không tìm thấy camera)
        (error, instance) => { // Nhận cả error và instance từ barcode-cam.js
            console.error("Lỗi khi khởi tạo máy quét:", error);
            showCustomMessageBox("Không thể khởi động máy quét. Vui lòng kiểm tra quyền truy cập camera.", () => {
                barcodeScannerContainer.style.display = 'none'; // Đóng khung quét
                stopCurrentScannerFunction = null;
                html5QrCodeInstance = null;
            });
        }
    );
    stopCurrentScannerFunction = scannerControl.stop;
    html5QrCodeInstance = scannerControl.instance;
}

/**
 * Xử lý khi người dùng xác nhận MSSV vừa quét.
 */
function confirmScannedStudent() {
    if (!pendingScannedMssv) {
        showCustomMessageBox("Không có MSSV nào để xác nhận.");
        return;
    }

    studentList.push(pendingScannedMssv);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
    renderList();
    showCustomMessageBox(`✅ Đã thêm ${pendingScannedMssv} vào danh sách.`, () => {
        pendingScannedMssv = null; // Xóa mã tạm thời
        // Resume máy quét để tiếp tục quét cho lượt tiếp theo
        if (html5QrCodeInstance) {
            html5QrCodeInstance.resume();
        } else {
            startScanningProcess(); // Nếu instance không còn, khởi động lại hoàn toàn
        }
    });

    // Reset hiển thị và ẩn nút xác nhận
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';
}

/**
 * Xử lý khi người dùng hủy MSSV vừa quét (hoặc tiếp tục quét).
 */
function cancelScannedStudent() {
    pendingScannedMssv = null; // Xóa mã tạm thời
    scannedResultDisplay.textContent = 'Đang chờ quét...'; // Reset hiển thị
    confirmScanBtn.style.display = 'none'; // Ẩn nút xác nhận
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét'; // Đặt lại text

    // Tiếp tục quét ngay lập tức
    if (html5QrCodeInstance) {
        html5QrCodeInstance.resume();
    } else {
        startScanningProcess(); // Nếu instance không còn, khởi động lại hoàn toàn
    }
}

/**
 * Dừng hoàn toàn máy quét và ẩn khung quét.
 */
function closeScannerFully() {
    if (stopCurrentScannerFunction) {
        stopCurrentScannerFunction(); // Dừng hoàn toàn máy quét
        stopCurrentScannerFunction = null;
        html5QrCodeInstance = null; // Reset instance
    }
    barcodeScannerContainer.style.display = 'none'; // Ẩn khung quét
    pendingScannedMssv = null; // Đảm bảo xóa mã tạm thời
    
    // Đặt lại các nút về trạng thái ban đầu cho lần mở sau
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';
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

    // Dừng máy quét nếu đang hoạt động trước khi gửi
    if (stopCurrentScannerFunction) {
        closeScannerFully(); // Dừng và đóng khung quét
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
                mode: 'no-cors' // Chú ý: 'no-cors' sẽ khiến bạn không đọc được phản hồi lỗi từ Apps Script
            }
        );

        showCustomMessageBox("✅ Yêu cầu gửi dữ liệu đã được thực hiện.", () => {});
        return true;

    } catch (err) {
        console.error("Lỗi gửi dữ liệu:", err);
        showCustomMessageBox("❌ Không thể gửi dữ liệu. Vui lòng kiểm tra kết nối.", () => {});
        return false;
    }
}

// Xóa danh sách
function clearList() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ danh sách?")) {
        studentList = [];
        localStorage.removeItem(STORAGE_KEY);
        renderList();
        // Đảm bảo dừng máy quét nếu đang hoạt động
        if (stopCurrentScannerFunction) {
            closeScannerFully();
        }
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
        addBarcodeBtn.addEventListener("click", startScanningProcess);
    }

    // Gán sự kiện cho các nút trong hộp thoại quét/thông báo
    if (confirmScanBtn) {
        confirmScanBtn.addEventListener("click", confirmScannedStudent);
    }
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener("click", cancelScannedStudent);
    }
    if (closeScannerBtn) {
        closeScannerBtn.addEventListener("click", closeScannerFully);
    }
    // Nút customMessageOkBtn đã được gán trong showCustomMessageBox
    
    studentIdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStudent();
        }
    });
});
