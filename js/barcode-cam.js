// Ensure this code runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const addBarcodeBtn = document.getElementById('add-barcode-btn');

    if (addBarcodeBtn) {
        addBarcodeBtn.addEventListener('click', async () => {
            try {
                // Check if the browser supports BarcodeDetector
                if (!('BarcodeDetector' in window)) {
                    alert('Trình duyệt của bạn không hỗ trợ quét mã vạch trực tiếp. Vui lòng thử trên trình duyệt khác hoặc thiết bị có camera.');
                    return;
                }

                const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128'] }); // You can specify formats

                // Request access to the camera
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                const videoTrack = stream.getVideoTracks()[0];
                const imageCapture = new ImageCapture(videoTrack);

                alert('Đang mở camera để quét mã vạch. Vui lòng cấp quyền truy cập camera nếu được hỏi.');

                // Create a video element to display the camera feed (optional, but good for user experience)
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();

                // Append video to the body or a specific container
                document.body.appendChild(video); // You might want to append it to a dedicated div

                // Set a timeout to capture an image after a short delay (e.g., 2 seconds)
                // In a real application, you'd want a continuous scan or a user-initiated capture
                setTimeout(async () => {
                    try {
                        const bitmap = await imageCapture.grabFrame();
                        const barcodes = await barcodeDetector.detect(bitmap);

                        if (barcodes.length > 0) {
                            const result = barcodes[0].rawValue;
                            alert(`Mã vạch đã quét: ${result}`);
                        } else {
                            alert('Không tìm thấy mã vạch nào.');
                        }
                    } catch (detectError) {
                        alert(`Lỗi khi phát hiện mã vạch: ${detectError.message}`);
                    } finally {
                        // Stop the camera stream and remove the video element
                        videoTrack.stop();
                        video.remove();
                    }
                }, 2000); // Adjust delay as needed
            } catch (error) {
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    alert('Bạn đã từ chối quyền truy cập camera. Không thể quét mã vạch.');
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    alert('Không tìm thấy thiết bị camera.');
                } else {
                    alert(`Đã xảy ra lỗi khi truy cập camera: ${error.message}`);
                }
            }
        });
    } else {
        console.error('Button with ID "add-barcode-btn" not found.');
    }
});