export function fetchGoogleSheet(sheetName) {
    return new Promise((resolve, reject) => {
        const sheetId = "1smT-D3AsLsoMo7_v-qOsoYaflX4ij2U6W1WHkCtBQkg";
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
