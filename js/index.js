import { fetchGoogleSheet } from './connect.js';

(async () => {
    try {
        const data = await fetchGoogleSheet("CONG_BO");
        const eventGrid = document.querySelector('.event-grid');

        data.reverse().forEach((row, index) => {
            const {
                status,
                nameEvent,
                time,
                position,
                object,
                form
            } = row;

            if (status !== "Duyệt") return;

            const linkHTML = form && form.trim() !== ""
                ? `👉 Link tham gia: <a href="${form}" target="_blank" rel="noopener">Tại đây</a>`
                : `👉 Link tham gia: <strong>Chưa công bố</strong>`;


            // Tạo HTML cho mỗi sự kiện
            const eventHTML = `
                <div class="event-card">
                    <div class="event-image">
                        <img src="./image/logo_MHX.png" alt="Hình sự kiện">
                    </div>
                    <div class="event-info">
                        <div class="event-name">🎉 ${nameEvent}</div>
                        <div class="event-time">🕒 Thời gian: ${time}</div>
                        <div class="event-location">📍 Địa điểm: ${position}</div>
                        <div class="event-target">👥 Đối tượng: ${object}</div>
                        <div class="event-link">${linkHTML}</div>
                    </div>
                </div>
            `;

            // Chèn vào grid
            eventGrid.insertAdjacentHTML('beforeend', eventHTML);
        });

    } catch (err) {
        console.error("❌ Lỗi khi lấy dữ liệu:", err);
    }
})();
