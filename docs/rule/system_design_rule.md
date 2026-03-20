# System Design Rule

## Mục đích
File này là prompt template cho bước system design. Tag vào sau khi đã chọn hướng tiếp cận từ brainstorm — để Claude đào sâu chi tiết kỹ thuật trước khi tạo tasks.

## Input cần tag
```
Tao chọn Hướng X.
@specs/{feature}/design.md @CLAUDE.md @docs/decisions.md @docs/rule/system_design_rule.md
```

## Rule cho Claude

**Bắt buộc cover đủ các phần sau:**

**1. User flow**
- Đặt trước data flow — define *what* cần xảy ra trước khi đi vào *how*
- Chọn format theo số actor:
  - ≥ 2 actor có interaction qua lại → sequence diagram dạng text
  - 1 actor, flow tuyến tính → numbered list
- Sequence diagram format:
  ```
  Actor A       Actor B       Actor C
    |               |               |
    |-- action -->  |               |
    |               |-- action -->  |
    |               |<- response -- |
    |<- response -- |               |
  ```
- Numbered list format:
  ```
  1. User làm X → thấy Y
  2. User làm Z → hệ thống phản hồi W
  ```

**2. Data flow**
- Dùng text diagram: `A → B → C`
- Bao gồm: client → server → DB → response
- Đủ rõ để biết data đi qua đâu, ai xử lý gì

**3. DB changes**
- Chỉ ghi những gì thêm hoặc sửa (không cần schema đầy đủ)
- Format: `Table | Field | Kiểu | Lý do`
- Nếu không thay đổi DB: ghi rõ "Không cần thay đổi DB"

**4. API changes**
- Nếu có endpoint mới: draft shape tạm (method, path, request body, response body)
- Đánh dấu [TBD] chỗ chưa chắc
- Nếu không có endpoint mới: ghi rõ "Không có endpoint mới"

**5. Edge cases**
- Liệt kê 3-5 edge case quan trọng nhất
- Mỗi edge case viết đủ 3 phần:
  - **Tình huống**: mô tả cụ thể — ai làm gì, hệ thống ở trạng thái nào, điều gì xảy ra (dùng ví dụ thực tế nếu giúp rõ hơn)
  - **Nguyên nhân**: tại sao đây là vấn đề về mặt kỹ thuật
  - **Xử lý**: solution cụ thể, đủ để implement (không chung chung)

**6. Risks**
- Top 2-3 risk kỹ thuật, tập trung vào scale, security & consistency
- Mỗi risk viết đủ 3 phần:
  - **Vấn đề**: mô tả kỹ thuật + hậu quả nếu không xử lý
  - **Nguyên nhân**: tại sao risk này tồn tại trong thiết kế hiện tại
  - **Mitigation**: giải pháp cụ thể, nếu accepted thì ghi rõ lý do accept

**7. Files cần thay đổi**
- Table: `File | Loại thay đổi | Ghi chú`
- Loại thay đổi: Tạo mới / Sửa / Không đổi

**Quyết định kỹ thuật:**
- Nếu có quyết định quan trọng (chọn thư viện, pattern, cách handle edge case) → append ngay vào `docs/decisions.md` với format:
```markdown
## YYYY-MM-DD — [Tên quyết định]
Chọn [X] thay vì [Y]. Lý do: ... Hệ quả: ...
```

## Output
Append section mới vào `specs/{feature}/design.md`:

```markdown
## System Design

### User flow
[sequence diagram hoặc numbered list]

### Data flow
[diagram]

### DB changes
| Table | Field | Kiểu | Lý do |
|-------|-------|------|-------|

### API changes
[draft endpoints hoặc "Không có endpoint mới"]

### Edge cases
- **[Tên case]**
  - Tình huống: [mô tả cụ thể]
  - Nguyên nhân: [tại sao là vấn đề]
  - Xử lý: [solution]

### Risks
- **[Tên risk]**
  - Vấn đề: [mô tả + hậu quả nếu không xử lý]
  - Nguyên nhân: [tại sao risk này tồn tại]
  - Mitigation: [giải pháp, hoặc "Accepted vì..."]

### Files cần thay đổi
| File | Loại thay đổi | Ghi chú |
|------|--------------|---------|
```

## Sau bước này
- Nếu có endpoint mới → update `docs/api_contract.md`
- Nếu có quyết định lớn → đã append vào `docs/decisions.md`
- Chuyển sang bước Tasks
