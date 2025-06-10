export function fetchGoogleSheet(sheetName) {
    return new Promise((resolve, reject) => {
        const sheetId = "1SGEM_7CmuvhLY-WiwoWsCPfw7tub73fUNhKB6oI64s0";
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

        Papa.parse(url, {
            download: true,
            header: true,
            complete: function (results) {
                resolve(results.data);
            },
            error: function (err) {
                reject(err);
            }
        });
    });
}