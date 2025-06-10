import { Html5Qrcode } from "html5-qrcode";

/**
 * Initializes and starts the barcode scanner using the camera.
 * @param {function(string): void} onScanSuccess - Callback when a barcode is successfully scanned, receiving the code as a string.
 * @param {function(Error, Html5Qrcode): void} onError - Callback for camera initialization errors, receiving the error and the Html5Qrcode instance.
 * @returns {{stop: function(): void, instance: Html5Qrcode}} An object containing a function to stop the scanner and the Html5Qrcode instance.
 */
export function startBarcodeScanner(onScanSuccess, onError) {
    const scannerViewportId = "barcode-scanner-viewport"; // ID of the div where the camera will be displayed
    let html5QrCode = null;

    const viewportElement = document.getElementById(scannerViewportId);
    if (!viewportElement) {
        const errorMessage = `HTML element with ID "${scannerViewportId}" not found.`;
        console.error(`Error: ${errorMessage}`);
        onError(new Error(errorMessage), null);
        return { stop: () => { }, instance: null };
    }

    // Ensure the viewport is clear before initializing
    viewportElement.innerHTML = '';
    html5QrCode = new Html5Qrcode(scannerViewportId);

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 } // Size of the scanning box
    };

    const stopScanner = () => {
        if (html5QrCode && html5QrCode.isScanning()) {
            html5QrCode.stop().then(() => {
                console.log("Scanner stopped.");
                viewportElement.innerHTML = ''; // Clear the viewport after stopping
            }).catch((err) => {
                console.warn("Error stopping scanner:", err);
                viewportElement.innerHTML = ''; // Still attempt to clear
            });
        }
    };

    html5QrCode.start(
        { facingMode: "environment" }, // Prefer the rear camera
        config,
        (decodedText) => {
            onScanSuccess(decodedText);
            // The pause/resume of scanning is controlled by muster.js using html5QrCodeInstance.pause() / resume().
        },
        (errorMessage) => {
            // Log errors without displaying them to the user (e.g., QR/barcode not found)
            // console.warn(`Scan error: ${errorMessage}`);
        }
    ).catch((err) => {
        console.error("Could not start camera:", err);
        onError(err, html5QrCode); // Pass the instance when there's an error so muster.js can handle it
        stopScanner(); // Ensure it stops if startup fails
    });

    return { stop: stopScanner, instance: html5QrCode }; // Return both the stop function and the instance
}
