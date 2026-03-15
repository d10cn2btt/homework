# Task Rule

## Mục đích
File này là prompt template cho bước tạo task list. Tag vào sau khi system design xong — để Claude break down thành tasks cụ thể, có thể execute ngay.

## Input cần tag
```
@specs/{feature}/design.md @CLAUDE.md @docs/api_contract.md @docs/rule/task_rule.md
```

## Rule cho Claude

**Cấu trúc group (theo thứ tự):**
1. **Setup thủ công** — nếu có (config service bên ngoài, biến môi trường, v.v.)
2. **Backend** — service, controller, middleware, DB migration
3. **Tests** — unit test, integration test
4. **Frontend** — component, page, API call

**Mỗi task phải:**
- Xong trong 1 session (<2 giờ)
- Gắn với file cụ thể (không abstract như "implement logic")
- Rõ ràng đủ để execute mà không cần đọc thêm docs
- Format: `- [ ] \`file.js\` — mô tả ngắn gọn`

**Không được:**
- Gộp nhiều file vào 1 task nếu scope quá lớn
- Viết task kiểu "implement feature X" — phải nói rõ làm gì trong file nào
- Bỏ qua tasks phụ thuộc — nếu task B cần task A xong trước, chú thích rõ

**Task phụ thuộc:**
- Đánh dấu bằng comment: `<!-- cần hoàn thành task [tên] trước -->`
- Hoặc đặt task phụ thuộc ngay sau task gốc, indent thêm

## Output
Tạo file mới `specs/{feature}/tasks.md`:

```markdown
# Tasks: {feature-id}-{tên-feature}

## Setup thủ công
- [ ] [Mô tả bước config bên ngoài code]

## Backend
- [ ] `path/to/file.js` — mô tả ngắn gọn
- [ ] `path/to/file.js` — mô tả ngắn gọn

## Tests
- [ ] Test [tình huống A] — [kết quả mong đợi]
- [ ] Test [tình huống B] — [kết quả mong đợi]

## Frontend
- [ ] `path/to/Component.jsx` — mô tả ngắn gọn
- [ ] `path/to/Component.jsx` — mô tả ngắn gọn
```

## Khi code từng task
Mỗi task = 1 session riêng:
```
@docs/decisions.md @specs/{feature}/tasks.md
Task hiện tại: [copy task cụ thể từ tasks.md]
```
Sau khi code xong task → chạy `/simplify` để clean up code trước khi sang task tiếp theo.
