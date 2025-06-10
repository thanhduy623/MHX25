import { fetchGoogleSheet } from './connect.js';
import { startBarcodeScanner } from './barcode-cam.js'; // Giả định barcode-cam.js cung cấp hàm startBarcodeScanner

const eventSelect = document.getElementById('event-select');
const studentIdInput = document.getElementById('student-id');
const addBtn = document.getElementById('add-btn');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const studentListBody = document.getElementById('student-list');
const passCodeInput = document.getElementById("pass-code");
const addBarcodeBtn = document.getElementById('add-barcode-btn');

// --- CÁC PHẦN TỬ MỚI CHO HỘP THOẠI XÁC NHẬN / THÔNG BÁO ---
const barcodeScannerContainer = document.getElementById('barcode-scanner-container'); // Container chứa khung quét camera
const scannedResultDisplay = document.getElementById('scanned-result-display'); // Nơi hiển thị MSSV đã quét
const confirmScanBtn = document.getElementById('confirm-scan-btn'); // Nút xác nhận MSSV
const cancelScanBtn = document.getElementById('cancel-scan-btn'); // Nút hủy MSSV / tiếp tục quét
const closeScannerBtn = document.getElementById('close-scanner-btn'); // Nút đóng hẳn khung quét camera

const customMessageBox = document.getElementById('custom-message-box'); // Hộp thông báo tùy chỉnh
const customMessageText = document.getElementById('custom-message-text'); // Nội dung thông báo
const customMessageOkBtn = document.getElementById('custom-message-ok-btn'); // Nút OK cho thông báo
// -------------------------------------------------------------

let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';

let urlGAS = "https://script.google.com/macros/s/AKfycbzOYChN4ziw-dVjc_1I4CCXl-GwSjqXDX0vV1bKeHERB06aiK0hYtSVcvDKuhpPPJtecQ/exec"; // Đã sửa urlGAS

// Biến lưu trữ hàm để dừng máy quét hiện tại từ thư viện barcode-cam
let stopCurrentScannerFunction = null;
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
    customMessageBox.style.display = 'flex'; // Sử dụng flexbox để căn giữa dễ hơn
    customMessageOkBtn.onclick = () => {
        customMessageBox.style.display = 'none';
        onOk(); // Thực thi callback sau khi đóng thông báo
    };
}

/**
 * Bắt đầu quá trình quét barcode.
 * Sẽ dừng máy quét khi tìm thấy mã và chờ xác nhận.
 */
function startScanningProcess() {
    // Nếu máy quét đang chạy, dừng nó trước khi bắt đầu cái mới
    if (stopCurrentScannerFunction) {
        stopCurrentScannerFunction();
        stopCurrentScannerFunction = null;
    }

    // Hiển thị khung quét (overlay)
    barcodeScannerContainer.style.display = 'flex'; // Dùng flexbox
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    
    // Ẩn nút xác nhận, hiển thị nút hủy/đóng
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét'; // Đổi text để rõ ràng hơn

    // Khởi tạo máy quét, truyền callback xử lý khi quét được mã
    stopCurrentScannerFunction = startBarcodeScanner((scannedText) => {
        // Hàm này sẽ được gọi mỗi khi có mã được quét
        pendingScannedMssv = scannedText.trim();

        // Tạm dừng máy quét để chờ xử lý và xác nhận
        // Chúng ta không gọi stopCallback() ở đây nữa mà để hàm startBarcodeScanner tự quản lý việc pause/resume
        // Tuy nhiên, để tránh quét liên tục khi hiển thị dialog, ta sẽ điều khiển UI
        
        // Hiển thị MSSV đã quét và các nút xác nhận/hủy
        scannedResultDisplay.textContent = `MSSV đã quét: ${pendingScannedMssv}`;
        confirmScanBtn.style.display = 'inline-block'; // Hiển thị nút xác nhận
        cancelScanBtn.textContent = 'Bỏ qua và tiếp tục'; // Đổi text cho nút hủy/tiếp tục
        
        // Vô hiệu hóa khả năng quét thêm cho đến khi có phản hồi
        if (stopCurrentScannerFunction) { // Nếu có hàm dừng được trả về
            stopCurrentScannerFunction(); // Dừng camera tạm thời
        }

        // Kiểm tra định dạng MSSV
        if (pendingScannedMssv.length !== 8) {
            showCustomMessageBox(`❌ Mã "${pendingScannedMssv}" không hợp lệ. Vui lòng quét lại.`, () => {
                pendingScannedMssv = null;
                if (stopCurrentScannerFunction) {
                    startScanningProcess(); // Khởi động lại máy quét
                }
            });
            return;
        }

        // Kiểm tra trùng lặp
        if (studentList.includes(pendingScannedMssv)) {
            showCustomMessageBox(`⚠️ MSSV ${pendingScannedMssv} đã có trong danh sách.`, () => {
                pendingScannedMssv = null;
                if (stopCurrentScannerFunction) {
                    startScanningProcess(); // Khởi động lại máy quét
                }
            });
            return;
        }

        // Nếu mã hợp lệ và chưa có, chờ người dùng xác nhận
        scannedResultDisplay.textContent = `MSSV: ${pendingScannedMssv} - ${studentDataMap[pendingScannedMssv] || "Không rõ tên"}`;
        confirmScanBtn.style.display = 'inline-block';
        cancelScanBtn.textContent = 'Hủy (tiếp tục quét)';
    }, 
    // Callback cho sự kiện lỗi (ví dụ: không tìm thấy camera)
    (error) => {
        console.error("Lỗi khi khởi tạo máy quét:", error);
        showCustomMessageBox("Không thể khởi động máy quét. Vui lòng kiểm tra quyền truy cập camera.", () => {
            barcodeScannerContainer.style.display = 'none'; // Đóng khung quét
            stopCurrentScannerFunction = null;
        });
    });
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
        startScanningProcess(); // Bắt đầu quét lại cho lượt tiếp theo
    });

    // Reset hiển thị
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
    startScanningProcess();
}

/**
 * Dừng hoàn toàn máy quét và ẩn khung quét.
 */
function closeScannerFully() {
    if (stopCurrentScannerFunction) {
        stopCurrentScannerFunction(); // Dừng hoàn toàn máy quét
        stopCurrentScannerFunction = null;
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
        cancelScanBtn.addEventListener("click", cancelScannedStudent); // Hủy mã hiện tại và tiếp tục quét
    }
    if (closeScannerBtn) { // Nút đóng hẳn khung quét
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
