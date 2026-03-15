# Bug Log

---

## BUG-001 — WebSocket realtime message bị drop, không hiển thị real-time

**Date:** 2026-03-09
**Severity:** Critical
**Feature:** Chat realtime (WebSocket)
**Status:** Fixed

---

### Nguyên nhân

Khi refactor service để thêm `MessageType` enum vào `Message` model (Prisma), hàm `saveMessage` bắt đầu trả về field `type` với giá trị `'USER'` (enum value từ DB):

```js
// chat.service.js — saveMessage trả về object này:
return {
  id: msg.id,
  roomId: msg.room_id,
  type: msg.type,      // <-- 'USER' (MessageType enum)
  senderId: msg.sender_id,
  ...
};
```

Trong `ws.handler.js`, object này được spread vào outbound frame:

```js
// TRƯỚC KHI FIX — BUG
const outbound = JSON.stringify({ type: 'message', ...savedMessage });
//                                ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^
//                                bị override bởi savedMessage.type = 'USER'
```

JavaScript spread hoạt động theo thứ tự: key đứng sau **override** key đứng trước nếu trùng tên. `savedMessage` spread sau `type: 'message'` nên `type` cuối cùng là `'USER'`, không phải `'message'`.

Frontend `useWebSocket.js` chỉ xử lý các frame có `type === 'message'` hoặc `type === 'system'`:

```js
if (frame.type === 'message' || frame.type === 'system') {
  setMessages((prev) => [...prev, frame]);
}
```

`frame.type === 'USER'` không match → message bị **silently drop** — không có lỗi, không có cảnh báo, chỉ đơn giản là không hiển thị.

---

### Root cause chain

```
Thêm MessageType enum vào schema
  → saveMessage() trả về { type: 'USER', ... }
    → { type: 'message', ...savedMessage } bị override
      → outbound frame có type: 'USER'
        → useWebSocket không nhận ra type này
          → message không append vào state
            → UI không update, phải F5 mới thấy
```

---

### Cách fix

Đảo thứ tự spread — đặt `type: 'message'` **sau** savedMessage để nó luôn thắng:

```js
// SAU KHI FIX
const outbound = JSON.stringify({ ...savedMessage, type: 'message' });
```

**File:** `backend/src/ws/ws.handler.js:23`

---

### Mức độ impact

| Dimension | Đánh giá |
|---|---|
| Severity | **Critical** — tính năng chat realtime hoàn toàn không hoạt động |
| Scope | Toàn bộ user, mọi room |
| Visibility | Silent failure — không có error log, không có console error |
| Detection | Khó phát hiện nếu không nhìn vào WS frame payload |
| Workaround | F5 để reload lịch sử (vẫn lấy được message qua REST API) |
| Data loss | Không — message vẫn được lưu vào DB đầy đủ |

---

### Bài học

- Khi field tên trùng giữa wrapper object và spread object, **thứ tự spread quyết định giá trị cuối cùng**.
- Khi thêm field mới vào service return value, cần kiểm tra tất cả nơi spread object đó.
- Nên đặt các field "cố định" của frame protocol (`type`, `version`...) **sau** spread để tránh bị override bởi data layer.

---
