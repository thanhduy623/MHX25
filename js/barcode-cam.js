// barcode-cam.js
import { Html5Qrcode } from "html5-qrcode";

/**
 * Khởi tạo và bắt đầu quét mã vạch bằng camera.
 * @param {function(string): void} onScanSuccess - Callback khi quét thành công, nhận về chuỗi mã.
 * @param {function(Error, Html5Qrcode): void} onError - Callback khi có lỗi khởi tạo camera, nhận về lỗi và instance.
 * @returns {{stop: function(): void, instance: Html5Qrcode}} Một object chứa hàm để dừng máy quét và instance của Html5Qrcode.
 */
export function startBarcodeScanner(onScanSuccess, onError) {
    const scannerViewportId = "barcode-scanner-viewport"; // ID của div bạn muốn hiển thị camera
    let html5QrCode = null;

    const viewportElement = document.getElementById(scannerViewportId);
    if (!viewportElement) {
        console.error(`Lỗi: Không tìm thấy phần tử HTML có ID "${scannerViewportId}" để hiển thị camera.`);
        if (onError) onError(new Error(`HTML element with ID "${scannerViewportId}" not found.`), null);
        return { stop: () => {}, instance: null };
    }

    // Đảm bảo viewport sạch trước khi khởi tạo
    viewportElement.innerHTML = ''; 
    html5QrCode = new Html5Qrcode(scannerViewportId);

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 } // Kích thước khung quét
    };

    const stopScanner = () => {
        // Chỉ dừng máy quét nếu nó đang hoạt động
        if (html5QrCode && html5QrCode.isScanning()) { // Sử dụng isScanning() để kiểm tra trạng thái
            html5QrCode.stop().then(() => {
                console.log("Máy quét đã dừng.");
                viewportElement.innerHTML = ''; // Làm sạch viewport sau khi dừng
            }).catch((err) => {
                console.warn("Lỗi khi dừng máy quét:", err);
                viewportElement.innerHTML = ''; // Vẫn cố gắng làm sạch
            });
        }
    };

    html5QrCode.start(
        { facingMode: "environment" }, // Ưu tiên camera sau
        config,
        (decodedText) => {
            onScanSuccess(decodedText);
            // Sau khi quét thành công, chúng ta không gọi pause ở đây nữa.
            // Việc tạm dừng/tiếp tục quét sẽ do muster.js điều khiển bằng html5QrCodeInstance.pause() / resume().
        },
        (errorMessage) => {
            // Log lỗi mà không hiển thị cho người dùng (ví dụ: không tìm thấy QR/barcode)
            // console.warn(`Scan error: ${errorMessage}`);
        }
    ).catch((err) => {
        console.error("Không thể khởi động camera:", err);
        if (onError) onError(err, html5QrCode); // Truyền instance khi có lỗi để muster.js có thể xử lý
        stopScanner(); // Đảm bảo dừng nếu khởi động thất bại
    });

    return { stop: stopScanner, instance: html5QrCode }; // Trả về cả hàm dừng và instance
}
