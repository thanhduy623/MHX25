/**
 * Initializes and starts the barcode scanner using the camera.
 * @param {function(string): void} onScanSuccess - Callback when a barcode is successfully scanned, receiving the code as a string.
 * @param {function(Error, Html5Qrcode): void} onError - Callback for camera initialization errors, receiving the error and the Html5Qrcode instance.
 * @returns {{stop: function(): void, instance: Html5Qrcode}} An object containing a function to stop the scanner and the Html5Qrcode instance.
 */
export function startBarcodeScanner(onScanSuccess, onError) {
    const scannerViewportId = "barcode-scanner-viewport";
    let html5QrCode = null;

    const viewportElement = document.getElementById(scannerViewportId);
    if (!viewportElement) {
        const errorMessage = `HTML element with ID "${scannerViewportId}" not found.`;
        console.error(`Error: ${errorMessage}`);
        onError(new Error(errorMessage), null);
        return { stop: () => {}, instance: null };
    }

    viewportElement.innerHTML = '';

    try {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error("Thư viện Html5Qrcode chưa được tải. Vui lòng kiểm tra thẻ script của bạn.");
        }
        html5QrCode = new Html5Qrcode(scannerViewportId);
    } catch (e) {
        console.error("Không thể tạo instance Html5Qrcode:", e);
        onError(e, null);
        return { stop: () => {}, instance: null };
    }

    const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 },
        disableFlip: false // ✅ Cho phép thư viện tự xoay ảnh để xử lý lật/mirror
    };

    const stopScanner = () => {
        if (html5QrCode && typeof html5QrCode.isScanning === 'function' && html5QrCode.isScanning()) {
            html5QrCode.stop().then(() => {
                console.log("Scanner stopped.");
                viewportElement.innerHTML = '';
            }).catch((err) => {
                console.warn("Error stopping scanner:", err);
                viewportElement.innerHTML = '';
            });
        } else {
            console.log("Không có instance Html5Qrcode hoạt động nào để dừng trong barcode-cam.js.");
            viewportElement.innerHTML = '';
        }
    };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
            onScanSuccess(decodedText);
        },
        (errorMessage) => {
            // console.warn(`Scan error: ${errorMessage}`);
        }
    ).catch((err) => {
        console.error("Không thể khởi động camera:", err);
        onError(err, html5QrCode);
        stopScanner();
    });

    return { stop: stopScanner, instance: html5QrCode };
}
