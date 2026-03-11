# System Design Rule

## Mục đích
File này là prompt template cho bước system design. Tag vào sau khi đã chọn hướng tiếp cận từ brainstorm — để Claude đào sâu chi tiết kỹ thuật trước khi tạo tasks.

## Input cần tag
```
Tao chọn Hướng X.
@specs/{feature}/design.md @CLAUDE.md @docs/rule/system_design_rule.md
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
- Mỗi edge case: mô tả tình huống + cách xử lý ngắn gọn

**6. Risks**
- Top 2-3 risk kỹ thuật
- Mỗi risk: mô tả + mitigation cụ thể
- Hãy tập trung vào việc scale, security & consistency

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
- **[Tên case]**: [tình huống] → [cách xử lý]

### Risks
- **[Tên risk]**: [mô tả] → Mitigation: [cách giảm thiểu]

### Files cần thay đổi
| File | Loại thay đổi | Ghi chú |
|------|--------------|---------|
```

## Sau bước này
- Nếu có endpoint mới → update `docs/api_contract.md`
- Nếu có quyết định lớn → đã append vào `docs/decisions.md`
- Chuyển sang bước Tasks
