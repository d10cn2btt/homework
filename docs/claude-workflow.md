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
Không cần tạo file mới. Mô tả thẳng task với Claude:
```
[Mô tả task cụ thể]
(Optional: @CLAUDE.md nếu cần nhớ convention)
```
Xong → nếu có quyết định đáng ghi (chọn thư viện, pattern): update `decisions.md`.

---

### Feature vừa & lớn — flow: Brainstorm → System Design → Tasks → Review

Mỗi bước là 1 session riêng. Output của bước trước là input của bước sau.

---

#### Step 1 — Brainstorm
**Input:**
```
Tao muốn thêm: [mô tả feature].
@CLAUDE.md @docs/spec.md @docs/decisions.md @docs/rule/brainstorm_rule.md
```
**Output:** `specs/{feature}/design.md` — các hướng tiếp cận + đề xuất của Claude

**Kết thúc khi:** mày confirm chọn hướng nào.

---

#### Step 2 — System Design
**Input:**
```
Tao chọn Hướng X.
@specs/{feature}/design.md @CLAUDE.md @docs/decisions.md @docs/rule/system_design_rule.md
```
**Output:**
- Append section "## System Design" vào `specs/{feature}/design.md` (data flow, DB changes, edge cases, risks, files cần sửa)
- Nếu có endpoint mới → update `docs/api_contract.md`
- Nếu có quyết định kỹ thuật quan trọng → Claude tự append vào `docs/decisions.md`

---

#### Step 3 — Tasks
**Input:**
```
@specs/{feature}/design.md @CLAUDE.md @docs/api_contract.md @docs/rule/task_rule.md
```
**Output:** `specs/{feature}/tasks.md` — checkbox list nhóm theo: Setup → Backend → Tests → Frontend

**Code từng task** — mỗi task = 1 session:
```
@docs/decisions.md @specs/{feature}/tasks.md
Task hiện tại: [copy task cụ thể]
```

---

#### Step 4 — Review
**Khi nào chạy:** sau khi tick xong toàn bộ checkbox trong `tasks.md`, trước khi tạo PR.

**Input:**
```
@CLAUDE.md @specs/{feature}/tasks.md @docs/rule/review_rule.md
Review feature này trước khi tao tạo PR.
```
**Claude sẽ review theo 4 lớp:** Conventions → Security → Logic & Edge Cases → Tests

**Output:** Report thẳng trong chat.
- Issue nghiêm trọng (security, logic sai) → Claude fix luôn
- Issue convention / style → Claude hỏi trước khi sửa

**Sau review:** nếu có quyết định kỹ thuật mới phát sinh → append vào `docs/decisions.md`.

---

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
| Review phát hiện quyết định kỹ thuật mới | `decisions.md` |

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
│   ├── api_contract.md                ← cập nhật khi thêm endpoint
│   └── rule/
│       ├── brainstorm_rule.md         ← tag ở Step 1, output 2-3 hướng tiếp cận
│       ├── system_design_rule.md      ← tag ở Step 2, output data flow + DB + edge cases
│       ├── task_rule.md               ← tag ở Step 3, output checkbox task list
│       └── review_rule.md             ← tag ở Step 4, review 4 lớp trước khi tạo PR
└── specs/
    ├── 001-admin-create-user/
    │   ├── design.md                  ← brainstorm + system design của feature
    │   └── tasks.md                   ← implementation checklist, tick khi xong
    └── 002-firebase-login/
        ├── design.md
        └── tasks.md
```

**Tại sao specs để theo từng feature, không gộp vào 1 file:**
- Khi làm feature X, chỉ tag `@specs/X/design.md` — không bị noise từ feature khác
- Mỗi feature có lifecycle riêng: design.md tạo ở brainstorm, tasks.md tick dần khi code
- `docs/spec.md` là raw customer requirements — khác với design/tasks của từng feature
