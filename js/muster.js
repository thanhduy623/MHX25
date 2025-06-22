import { fetchGoogleSheet } from './connect.js';
import { startBarcodeScanner } from './barcode-cam.js';

// **UI Element Definitions**
const eventSelect = document.getElementById('event-select');
const studentIdInput = document.getElementById('student-id');
const addBtn = document.getElementById('add-btn');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const studentListBody = document.getElementById('student-list');
const passCodeInput = document.getElementById("pass-code");
const addBarcodeBtn = document.getElementById('add-barcode-btn');

const barcodeScannerContainer = document.getElementById('barcode-scanner-container');
const scannedResultDisplay = document.getElementById('scanned-result-display');
const confirmScanBtn = document.getElementById('confirm-scan-btn');
const cancelScanBtn = document.getElementById('cancel-scan-btn');

const customMessageBox = document.getElementById('custom-message-box');
const customMessageText = document.getElementById('custom-message-text');
const customMessageOkBtn = document.getElementById('custom-message-ok-btn');

// **Data Storage and Configuration**
let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';
const URL_GAS = "https://script.google.com/macros/s/AKfycbweSKnUjp_KKmbeBF57ITQd4uS1nuebcCQimEjNUy2hXULo5rRUUlp3ga1Q4h1Ig3En/exec";

// **Scanner State Variables**
let stopCurrentScannerFunction = null;
let html5QrCodeInstance = null; // Đảm bảo khởi tạo là null
let pendingScannedMssv = null;

// **Helper Functions**

/**
 * Displays a custom message box with a given message and an optional callback.
 * @param {string} message - The message to display.
 * @param {function} onOk - The callback function to execute when the OK button is clicked.
 */
function showCustomMessageBox(message, onOk = () => { }) {
    customMessageText.textContent = message;
    customMessageBox.style.display = 'flex';
    customMessageOkBtn.onclick = () => {
        customMessageBox.style.display = 'none';
        onOk();
    };
}

/**
 * Saves the student list to local storage.
 */
function saveStudentList() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
    } catch (error) {
        console.error("Error saving to local storage:", error);
        showCustomMessageBox("Không thể lưu danh sách sinh viên vào bộ nhớ cục bộ. Vui lòng kiểm tra trình duyệt của bạn.");
    }
}

/**
 * Renders the student list in the UI.
 */
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

// **Data Loading Functions**

/**
 * Loads events from the Google Sheet and populates the event select dropdown.
 */
async function loadEvents() {
    try {
        const data = await fetchGoogleSheet("CONG_BO");
        const eventNames = [...new Set(data
            .filter(row => row.status === "Duyệt" && row.nameEvent)
            .map(row => row.nameEvent))
        ];

        eventNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            eventSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error loading events:", err);
        showCustomMessageBox("Không thể tải danh sách sự kiện. Vui lòng kiểm tra kết nối.");
    }
}

/**
 * Loads student data from the Google Sheet into a map for quick lookup.
 */
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
        console.error("Error loading student data:", err);
        showCustomMessageBox("Không thể tải danh sách sinh viên. Vui lòng kiểm tra kết nối.");
    }
}

/**
 * Loads the student list from local storage.
 */
function loadLocalList() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            studentList = JSON.parse(stored);
            renderList();
        } catch (e) {
            console.error("Error parsing stored student list:", e);
            showCustomMessageBox("Lỗi khi tải danh sách sinh viên đã lưu. Danh sách sẽ được làm mới.");
            studentList = [];
            saveStudentList();
            renderList();
        }
    }
}

// **Student Management Functions**

/**
 * Adds a student to the list based on manual input.
 */
function addStudent() {
    const mssv = studentIdInput.value.trim();

    if (!mssv) {
        showCustomMessageBox("Vui lòng nhập MSSV.");
        return;
    }

    if (mssv.length !== 8) {
        showCustomMessageBox("Sai định dạng MSSV.");
        return;
    }

    if (studentList.includes(mssv)) {
        showCustomMessageBox("MSSV đã có trong danh sách.");
        return;
    }

    studentList.push(mssv);
    saveStudentList();
    renderList();
    studentIdInput.value = "";
}

// **Barcode Scanning Functions**

/**
 * Starts the barcode scanning process.
 */
function startScanningProcess() {
    // Stop the current scanner if it's running
    stopScanner();

    // Display the scanner container
    barcodeScannerContainer.style.display = 'flex';
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy quét'; // Text updated to reflect new behavior

    // Initialize the barcode scanner
    const scannerControl = startBarcodeScanner(
        handleScanSuccess,
        handleScanError
    );

    stopCurrentScannerFunction = scannerControl.stop;
    html5QrCodeInstance = scannerControl.instance;
}

/**
 * Handles the successful scan of a barcode.
 * @param {string} scannedText - The text that was scanned.
 */
function handleScanSuccess(scannedText) {
    pendingScannedMssv = scannedText.trim();

    if (html5QrCodeInstance) {
        html5QrCodeInstance.pause(true);
    }

    const fullName = studentDataMap[pendingScannedMssv] || "Không rõ tên";
    scannedResultDisplay.textContent = `MSSV: ${pendingScannedMssv} - ${fullName}`;
    confirmScanBtn.style.display = 'inline-block';
    cancelScanBtn.textContent = 'Hủy (tiếp tục quét)'; // Still offers resume if user cancels this particular scan

    if (pendingScannedMssv.length !== 8) {
        showCustomMessageBox(`❌ Mã "${pendingScannedMssv}" không hợp lệ. Vui lòng quét lại.`, () => {
            resetScannerState();
            resumeScanning();
        });
        return;
    }

    if (studentList.includes(pendingScannedMssv)) {
        showCustomMessageBox(`⚠️ MSSV ${pendingScannedMssv} đã có trong danh sách.`, () => {
            resetScannerState();
            resumeScanning();
        });
        return;
    }
}

/**
 * Handles errors that occur during the barcode scanning process.
 * @param {Error} error - The error that occurred.
 * @param {Html5Qrcode} instance - The Html5Qrcode instance.
 */
function handleScanError(error, instance) {
    console.error("Error initializing scanner:", error);
    // Nếu instance là null do lỗi khởi tạo, hãy gán html5QrCodeInstance = null để tránh lỗi
    if (instance === null) {
        html5QrCodeInstance = null;
    }
    showCustomMessageBox("Không thể khởi động máy quét. Vui lòng kiểm tra quyền truy cập camera.", () => {
        closeScannerFully();
    });
}

/**
 * Confirms the scanned student and adds them to the list.
 */
function confirmScannedStudent() {
    if (!pendingScannedMssv) {
        showCustomMessageBox("Không có MSSV nào để xác nhận.");
        return;
    }

    studentList.push(pendingScannedMssv);
    saveStudentList();
    renderList();
    showCustomMessageBox(`✅ Đã thêm ${pendingScannedMssv} vào danh sách.`, () => {
        resetScannerState();
        resumeScanning();
    });

    scannedResultDisplay.textContent = 'Đang chờ quét...';
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy quét'; // Reset text after confirmation
}

/**
 * Handles the logic for the "Cancel" button.
 * This function now always closes the scanner modal fully.
 */
function handleCancelScansAndClose() {
    closeScannerFully();
}

/**
 * Resets the scanner state.
 */
function resetScannerState() {
    pendingScannedMssv = null;
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy quét'; // Ensures the button text is "Hủy quét"
}

/**
 * Resumes the barcode scanning process.
 */
function resumeScanning() {
    if (html5QrCodeInstance) {
        html5QrCodeInstance.resume();
    } else {
        startScanningProcess();
    }
}

/**
 * Stops the scanner.
 */
function stopScanner() {
    // Chỉ cố gắng gọi .isScanning() nếu html5QrCodeInstance tồn tại và có phương thức đó
    if (html5QrCodeInstance && typeof html5QrCodeInstance.isScanning === 'function' && html5QrCodeInstance.isScanning()) {
        html5QrCodeInstance.stop().then(() => {
            console.log("Scanner stopped successfully.");
        }).catch((err) => {
            console.warn("Error stopping scanner:", err);
        }).finally(() => {
            // Luôn đặt lại các biến trạng thái sau khi cố gắng dừng
            stopCurrentScannerFunction = null;
            html5QrCodeInstance = null;
            const viewportElement = document.getElementById("barcode-scanner-viewport");
            if (viewportElement) {
                viewportElement.innerHTML = '';
            }
        });
    } else {
        // Nếu không có instance đang hoạt động hoặc không phải là hàm, chỉ cần đặt lại trạng thái
        console.log("Scanner was not active or not properly initialized when stopScanner was called.");
        stopCurrentScannerFunction = null;
        html5QrCodeInstance = null;
        const viewportElement = document.getElementById("barcode-scanner-viewport");
        if (viewportElement) {
            viewportElement.innerHTML = '';
        }
    }
}

/**
 * Closes the scanner completely.
 */
function closeScannerFully() {
    stopScanner();
    barcodeScannerContainer.style.display = 'none';
    resetScannerState();
}

// **Data Submission Functions**

/**
 * Submits the student list to the Google Sheet.
 */
async function submitList() {
    const selectedEvent = eventSelect.value;
    const passcode = passCodeInput.value;

    if (!selectedEvent) {
        showCustomMessageBox("Vui lòng chọn sự kiện.");
        return;
    }

    if (!passcode) {
        showCustomMessageBox("Vui lòng nhập mã quản trị.");
        return;
    }

    if (studentList.length === 0) {
        showCustomMessageBox("Danh sách sinh viên đang trống.");
        return;
    }

    stopScanner();

    const success = await sendDataToSheet(studentList, selectedEvent, passcode);

    if (success) {
        studentList = [];
        localStorage.removeItem(STORAGE_KEY);
        renderList();
    }
}

/**
 * Sends the student data to the Google Sheet using Apps Script.
 * @param {Array<string>} studentList - The list of student IDs.
 * @param {string} eventName - The name of the event.
 * @param {string} passcode - The admin passcode.
 * @returns {boolean} - True if the data was sent successfully, false otherwise.
 */
async function sendDataToSheet(studentList, eventName, passcode) {
    try {
        const response = await fetch(
            URL_GAS,
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

        showCustomMessageBox("✅ Yêu cầu gửi dữ liệu đã được thực hiện.", () => { });
        return true;

    } catch (err) {
        console.error("Error sending data:", err);
        showCustomMessageBox("❌ Không thể gửi dữ liệu. Vui lòng kiểm tra kết nối.", () => { });
        return false;
    }
}

// **List Management Functions**

/**
 * Clears the student list.
 */
function clearList() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ danh sách?")) {
        studentList = [];
        localStorage.removeItem(STORAGE_KEY);
        renderList();
        stopScanner();
    }
}

// **Event Listeners**
document.addEventListener("DOMContentLoaded", async () => {
    await loadEvents();
    await loadStudentData();
    loadLocalList();

    addBtn.addEventListener("click", addStudent);
    submitBtn.addEventListener("click", submitList);
    clearBtn.addEventListener("click", clearList);
    addBarcodeBtn.addEventListener("click", startScanningProcess);

    confirmScanBtn.addEventListener("click", confirmScannedStudent);
    // Changed listener for cancelScanBtn to always close the scanner
    cancelScanBtn.addEventListener("click", handleCancelScansAndClose);

    studentIdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStudent();
        }
    });
});
