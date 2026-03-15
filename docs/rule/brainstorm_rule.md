# Brainstorm Rule



## Mục đích
File này là prompt template cho bước brainstorm. Tag vào khi cần Claude đưa ra các hướng tiếp cận cho một feature — trước khi đi vào thiết kế chi tiết hay code.

## Input cần tag
```
[Mô tả feature ngắn gọn]
@CLAUDE.md @docs/spec.md @docs/decisions.md @docs/rule/brainstorm_rule.md
```

## Rule cho Claude

**Yêu cầu bắt buộc:**
- Đưa ra đúng 2-3 hướng tiếp cận (không ít hơn, không nhiều hơn)
- Mỗi hướng phải độc lập — không phải biến thể nhỏ của nhau
- Chưa đề cập file cụ thể, schema, hay code — chỉ phân tích conceptual
- Cuối cùng: Claude đề xuất hướng phù hợp nhất + lý do ngắn (không quyết định hộ user)
- Hãy tập trung vào việc scale, security & consistency

**Format mỗi hướng:**
```
### Hướng X: [Tên ngắn gọn]
Mô tả: [1 câu]
- Ưu: [tối đa 3 bullet]
- Nhược: [tối đa 3 bullet]
- Phù hợp khi: [điều kiện cụ thể]
```

## Output
Ghi vào `specs/{feature}/design.md` — **tạo file mới** với cấu trúc:

```markdown
# Design: {Tên feature}

## Options

### Hướng A: ...
### Hướng B: ...
### Hướng C: ...

## Đề xuất
Claude đề xuất Hướng X vì: [lý do ngắn]

---
<!-- Phần System Design sẽ được append ở bước tiếp theo -->
```

## Kết thúc bước này khi
User confirm chọn hướng nào → chuyển sang System Design.
