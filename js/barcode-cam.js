export function startBarcodeScanner(onScanSuccess) {
    const scannerDivId = "barcode-scanner";

    // Tạo container nếu chưa có
    let scannerDiv = document.getElementById(scannerDivId);
    if (!scannerDiv) {
        scannerDiv = document.createElement("div");
        scannerDiv.id = scannerDivId;
        document.body.appendChild(scannerDiv);
    }

    // Hiển thị khu vực quét
    scannerDiv.style.display = "block";
    scannerDiv.style.position = "fixed";
    scannerDiv.style.top = "0";
    scannerDiv.style.left = "0";
    scannerDiv.style.width = "100%";
    scannerDiv.style.height = "100%";
    scannerDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    scannerDiv.style.zIndex = "9999";
    scannerDiv.innerHTML = `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            <div id="reader" style="width: 300px;"></div>
            <button id="close-scanner" style="margin-top: 16px; width: 100%; padding: 10px;">❌ Đóng</button>
        </div>
    `;

    const html5QrCode = new Html5Qrcode("reader");

    const stopScanner = () => {
        html5QrCode.stop().then(() => scannerDiv.remove()).catch(() => scannerDiv.remove());
    };

    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decodedText => {
            onScanSuccess(decodedText, stopScanner); // Gọi callback và cho phép quyết định khi nào dừng
        },
        errorMessage => {
            // log nhẹ, không alert
        }
    ).catch(err => {
        alert("Không thể mở camera: " + err.message);
        scannerDiv.remove();
    });

    document.getElementById("close-scanner").addEventListener("click", stopScanner);
}
