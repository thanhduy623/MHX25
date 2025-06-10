// barcode-cam.js
import { Html5Qrcode } from "html5-qrcode"; // Đảm bảo import Html5Qrcode nếu bạn dùng ES Modules

/**
 * Khởi tạo và bắt đầu quét mã vạch bằng camera.
 * @param {function(string): void} onScanSuccess - Callback khi quét thành công, nhận về chuỗi mã.
 * @param {function(Error): void} onError - Callback khi có lỗi khởi tạo camera.
 * @returns {function(): void} Một hàm để dừng máy quét.
 */
export function startBarcodeScanner(onScanSuccess, onError) {
    const scannerViewportId = "barcode-scanner-viewport"; // ID của div bạn muốn hiển thị camera
    let html5QrCode = null;

    // Đảm bảo phần tử viewport tồn tại
    const viewportElement = document.getElementById(scannerViewportId);
    if (!viewportElement) {
        console.error(`Lỗi: Không tìm thấy phần tử HTML có ID "${scannerViewportId}" để hiển thị camera.`);
        if (onError) onError(new Error(`HTML element with ID "${scannerViewportId}" not found.`));
        return () => {}; // Trả về hàm dừng rỗng
    }

    // Xóa nội dung cũ trong viewport để đảm bảo sạch sẽ
    viewportElement.innerHTML = ''; 

    html5QrCode = new Html5Qrcode(scannerViewportId);

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 } // Kích thước khung quét
    };

    // Hàm để dừng máy quét.
    // Lưu ý: Không đóng hoặc xóa `barcode-scanner-viewport` ở đây.
    // Việc ẩn/hiển thị khung overlay sẽ do muster.js quản lý.
    const stopScanner = () => {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                console.log("Máy quét đã dừng.");
                // Có thể làm sạch thêm nếu cần, nhưng không xóa element
                viewportElement.innerHTML = ''; // Làm sạch viewport
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
            // Khi quét thành công, gọi callback của muster.js
            onScanSuccess(decodedText);
            // Sau khi quét được 1 mã, chúng ta sẽ tạm dừng Html5Qrcode để tránh quét liên tục
            // và chờ người dùng tương tác.
            html5QrCode.pause(true); // Tạm dừng quét nhưng vẫn giữ camera hoạt động
        },
        (errorMessage) => {
            // Log lỗi mà không hiển thị cho người dùng
            // console.warn(`Scan error: ${errorMessage}`);
        }
    ).catch((err) => {
        console.error("Không thể khởi động camera:", err);
        if (onError) onError(err);
        stopScanner(); // Đảm bảo dừng nếu khởi động thất bại
    });

    // Trả về hàm dừng để muster.js có thể điều khiển
    return stopScanner;
}
