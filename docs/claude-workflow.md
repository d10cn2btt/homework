# Claude Workflow — Cách làm việc hiệu quả với Claude Code

## Tư duy cốt lõi

Claude không có bộ nhớ giữa các session. Mọi thứ muốn Claude biết phải được đưa vào text.
Nhiệm vụ của mày: duy trì các files làm "bộ nhớ thay thế" cho Claude.

---

## Các files cần duy trì

| File | Chứa gì | Claude đọc khi nào |
|------|---------|-------------------|
| `CLAUDE.md` | Stack, architecture, conventions bắt buộc | **Tự động** mỗi session |
| `docs/spec.md` | Raw specs từ khách hàng — không sửa | Mày paste vào khi cần |
| `docs/decisions.md` | Quyết định kỹ thuật toàn project + lý do | Mày paste vào khi cần |
| `docs/api_contract.md` | Shape của tất cả API endpoints | Mày paste vào khi cần |
| `specs/{feature}/design.md` | Brainstorm + system design + lý do chọn hướng | Mày paste vào khi cần |
| `specs/{feature}/tasks.md` | Task list implementation của feature | Mày paste vào khi cần |

**Phân biệt `decisions.md` vs `design.md`:**
- `design.md` — full context của 1 feature: options đã cân nhắc, ưu nhược điểm, quyết định + lý do chi tiết
- `decisions.md` — distill những quyết định quan trọng nhất ra toàn project, ngắn gọn, ai join cũng đọc được

---

## Bước 1 — Setup project mới (làm 1 lần duy nhất)

**1a. Lưu raw specs vào `docs/spec.md`**

Paste nguyên văn specs từ khách hàng vào, không sửa. Đây là nguồn gốc để tra cứu sau này.

**1b. Làm rõ specs với Claude**
```
Đây là specs của tao: [dán vào]
Hỏi tao tối đa 5 câu để làm rõ phần mơ hồ.
Tập trung vào: ai dùng app, data nào lưu, edge cases quan trọng.
```

**1c. Tạo `CLAUDE.md`**
```
Dựa vào specs này, tạo CLAUDE.md với:
stack đã chọn, architecture 2-3 câu, conventions bắt buộc.
Ngắn gọn, tối đa 60 dòng.
```

**1d. Tạo `docs/api_contract.md`** (nếu có backend)
```
Dựa vào specs, draft tất cả endpoints cần thiết.
Format: method, path, auth required, request body, response body.
Đánh dấu [TBD] chỗ chưa chắc.
```

**1e. Tạo `docs/decisions.md`** — file trống, điền dần khi code:
```markdown
# Decision Log
<!-- Format: ## YYYY-MM-DD — Tên quyết định -->
<!-- Ghi lý do, không chỉ ghi kết quả -->
```

---

## Bước 2 — Khi thêm feature mới

### Feature nhỏ (< 2 giờ)
Không cần tạo file mới. Nói thẳng:
```
@docs/decisions.md
[Mô tả task cụ thể]
```

---

### Feature vừa (nửa ngày đến 2 ngày)

**Làm rõ specs:**
```
Tao muốn thêm: [mô tả].
@CLAUDE.md @docs/spec.md
Hỏi tao tối đa 3 câu để làm rõ phần mơ hồ.
```

**Cập nhật `api_contract.md`** (nếu có API mới):
```
Draft thêm endpoints mới cho feature này vào api_contract.md.
```

**Tạo `specs/{feature}/tasks.md`:**
```
@CLAUDE.md @docs/api_contract.md
Break down feature này thành tasks nhỏ, mỗi task xong trong 1 session.
Nhóm: Backend → Tests → Frontend. Format: checkbox list.
```

**Code từng task** — mỗi task = 1 session:
```
@docs/decisions.md @specs/{feature}/tasks.md
Task hiện tại: [copy task cụ thể]
```

---

### Feature lớn (nhiều ngày) — cần brainstorm trước

**Brainstorm options:**
```
Tao cần build: [mô tả feature to].
@CLAUDE.md @docs/spec.md
Đưa ra 2-3 cách tiếp cận khác nhau. Mỗi cách: ưu, nhược, phù hợp khi nào.
Chưa cần code, chỉ cần phân tích.
```

**Chọn hướng và đào sâu:**
```
Tao chọn cách [X] vì [lý do].
Design chi tiết hơn: data flow, DB schema cần thêm/sửa, edge cases, risk lớn nhất.
```

**Lưu toàn bộ vào `specs/{feature}/design.md`:**
```markdown
# Design: [Tên feature]

## Các hướng đã cân nhắc
### Hướng 1: [Tên]
- Ưu: ...
- Nhược: ...

### Hướng 2: [Tên]
- Ưu: ...
- Nhược: ...

## Quyết định: Hướng X
Lý do: ...

## System design
- Data flow: ...
- DB thay đổi: ...
- Edge cases: ...
- Risk: ...
```

**Distill quyết định quan trọng vào `docs/decisions.md`** (ngắn gọn, không cần full context):
```markdown
## YYYY-MM-DD — [Tên quyết định]
Chọn [X] thay vì [Y]. Lý do: ... Hệ quả: ...
```

Rồi làm tiếp: cập nhật `api_contract.md` nếu cần → tạo `tasks.md` → code từng task.
Nếu thay đổi scope tổng thể → cập nhật `docs/spec.md` và `CLAUDE.md`.

---

## Bước 3 — Khi quay lại sau 1-2 tuần

Đọc lại: `CLAUDE.md` → `docs/decisions.md` → `specs/{feature}/tasks.md`

Nói với Claude:
```
Tao vừa quay lại project sau X ngày.
@docs/decisions.md @specs/{feature}/design.md @specs/{feature}/tasks.md
Tóm tắt: đang làm đến đâu, task tiếp theo là gì, có risk gì cần lưu ý.
```

---

## Khi nào update file nào

| Tình huống | Cần update |
|-----------|------------|
| Phải giải thích cho Claude cùng 1 thứ lần 2 | `decisions.md` |
| Thêm endpoint mới | `api_contract.md` |
| Task xong | Tick checkbox trong `tasks.md` |
| Scope project thay đổi lớn | `docs/spec.md` + `CLAUDE.md` |
| Chọn thư viện, pattern, cách handle edge case | `decisions.md` |
| Brainstorm / system design feature lớn | `specs/{feature}/design.md` |

---

## Dự án đang chạy, chưa có structure này

Không cần làm lại từ đầu. Cho Claude đọc code, tự tạo docs:

```
Đọc các files này: @[list file hoặc folder quan trọng]
Sau đó tạo cho tao:
- CLAUDE.md: stack thực tế, conventions đang dùng trong code
- docs/decisions.md: các quyết định kỹ thuật mày đọc được từ code
- docs/api_contract.md: tất cả endpoints hiện có
Chỉ ghi những gì mày thấy trong code, đừng bịa.
```

Review lại output — Claude đúng ~80%, 20% còn lại mày sửa tay.
Bắt đầu với `CLAUDE.md` là đủ, hai file kia bổ sung dần khi làm việc.

---

## Folder structure

```
project/
├── CLAUDE.md                          ← auto-read mỗi session
├── docs/
│   ├── spec.md                        ← raw specs từ khách hàng, không sửa
│   ├── decisions.md                   ← quyết định toàn project, cập nhật liên tục
│   └── api_contract.md                ← cập nhật khi thêm endpoint
└── specs/
    ├── 001-user-auth/
    │   ├── design.md                  ← brainstorm + system design + lý do
    │   └── tasks.md                   ← implementation checklist
    └── 002-google-login/
        ├── design.md
        └── tasks.md
```
