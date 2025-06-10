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
const closeScannerBtn = document.getElementById('close-scanner-btn');

const customMessageBox = document.getElementById('custom-message-box');
const customMessageText = document.getElementById('custom-message-text');
const customMessageOkBtn = document.getElementById('custom-message-ok-btn');

// **Data Storage and Configuration**
let studentList = [];
let studentDataMap = {};
const STORAGE_KEY = 'muster_student_list';
const URL_GAS = "https://script.google.com/macros/s/AKfycbzOYChN4ziw-dVjc_1I4CCXl-GwSjqXDX0vV1bKeHERB06aiK0hYtSVcvDKuhpPPJtecQ/exec";

// **Scanner State Variables**
let stopCurrentScannerFunction = null;
let html5QrCodeInstance = null;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studentList));
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
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';

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
    cancelScanBtn.textContent = 'Hủy (tiếp tục quét)';

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
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';
}

/**
 * Cancels the scanned student and resumes scanning.
 */
function cancelScannedStudent() {
    resetScannerState();
    resumeScanning();
}

/**
 * Resets the scanner state.
 */
function resetScannerState() {
    pendingScannedMssv = null;
    scannedResultDisplay.textContent = 'Đang chờ quét...';
    confirmScanBtn.style.display = 'none';
    cancelScanBtn.textContent = 'Hủy / Tiếp tục quét';
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
    if (stopCurrentScannerFunction) {
        stopCurrentScannerFunction();
        stopCurrentScannerFunction = null;
        html5QrCodeInstance = null;
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
                mode: 'no-cors' // Note: 'no-cors' will prevent you from reading error responses from Apps Script
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
    cancelScanBtn.addEventListener("click", cancelScannedStudent);
    closeScannerBtn.addEventListener("click", closeScannerFully);

    studentIdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStudent();
        }
    });
});
