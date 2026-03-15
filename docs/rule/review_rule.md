# Review Rule

## Mục đích
File này là prompt template cho bước review sau khi code xong toàn bộ tasks của một feature. Tag vào để Claude review toàn diện trước khi merge.

## Input cần tag
```
@CLAUDE.md @specs/{feature}/tasks.md @docs/rule/review_rule.md
```

## Rule cho Claude

**Chạy review theo 4 lớp, theo thứ tự:**

### Lớp 1 — Conventions (đối chiếu CLAUDE.md)
- Service layer có chứa toàn bộ DB/Redis logic không? Controller có query DB trực tiếp không?
- File nào > 300 dòng? Function nào > 40 dòng?
- Có `console.log`, dead code, hoặc commented-out code không?
- Credentials có bị hardcode không? Có dùng `.env` đúng không?

### Lớp 2 — Security
- Auth middleware (`auth.mdw.js`) có được áp dụng đúng route không?
- ACL middleware có check role trước khi cho phép action không?
- Input từ request body có được validate trước khi dùng không?
- Có SQL injection risk nào qua Prisma raw query không?

### Lớp 3 — Logic & Edge Cases
- Các edge cases đã được define trong `design.md` có được handle không?
- Cache Redis (`user:roles:{uid}`) có bị invalidate đúng chỗ sau khi update không?
- Error response có nhất quán format không (status code + message)?
- Async/await có được handle đúng, không bỏ sót `try/catch` ở tầng controller không?

### Lớp 4 — Tests
- Mỗi service function có ít nhất 1 happy path test không?
- Các error path (unauthorized, not found, validation fail) có được test không?
- Test có mock đúng dependencies (Redis, Prisma) không?
- Nếu feature có endpoint mới: `docs/api_contract.md` đã được update chưa?

## Cách report

Với mỗi issue tìm được, ghi rõ:
```
[Lớp] File: path/to/file.js (dòng X)
Vấn đề: mô tả cụ thể
Fix: gợi ý sửa ngắn gọn
```

Nếu không có issue: ghi "Review passed. Không phát hiện vấn đề."

## Output

Không tạo file mới. Report thẳng trong chat.
Nếu có issue nghiêm trọng (security, logic sai) → fix luôn.
Nếu là convention / style → hỏi user trước khi sửa.

## Khi nào chạy
```
Sau khi tick xong toàn bộ checkbox trong specs/{feature}/tasks.md
→ Trước khi tạo PR
```
