// barcode-cam.js
document.addEventListener('DOMContentLoaded', () => {
    const addBarcodeBtn = document.getElementById('add-barcode-btn');
    const studentIdInput = document.getElementById('student-id');

    if (!addBarcodeBtn || !studentIdInput) return;

    addBarcodeBtn.addEventListener('click', () => {
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

        html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: 250
            },
            decodedText => {
                alert(`Mã đã quét: ${decodedText}`);
                studentIdInput.value = decodedText;
                html5QrCode.stop().then(() => scannerDiv.remove());
            },
            errorMessage => {
                // console.log("Lỗi quét:", errorMessage); // có thể log ra nhưng tránh spam alert
            }
        ).catch(err => {
            alert("Không thể mở camera: " + err.message);
            scannerDiv.remove();
        });

        document.getElementById("close-scanner").addEventListener("click", () => {
            html5QrCode.stop().then(() => scannerDiv.remove());
        });
    });
});
