# Đặc tả tính năng: Màn hình tạo người dùng mới cho Admin

**Nhánh tính năng**: `001-admin-create-user`
**Ngày tạo**: 2026-03-08
**Trạng thái**: Bản nháp
**Nguồn**: "Bên admin đang bị thiếu màn tạo user"

## Làm rõ

### Phiên 2026-03-08

- Q: Khi tạo người dùng mới, Admin có thể chọn vai trò ngay tại form không, hay luôn mặc định USER và đổi sau? → A: Luôn tạo với vai trò USER mặc định; Admin đổi vai trò sau trên trang chi tiết người dùng.
- Q: Nếu tài khoản tạo thành công trong hệ thống xác thực nhưng lưu DB thất bại, hệ thống xử lý thế nào? → A: Xóa tài khoản trong hệ thống xác thực (rollback hoàn toàn) và trả về thông báo lỗi cho Admin.
- Q: Sau khi tạo người dùng thành công, hệ thống thông báo kết quả thế nào? → A: Redirect về danh sách người dùng kèm thông báo thành công thoáng qua (toast/banner).

## Kịch bản người dùng & Kiểm thử *(bắt buộc)*

### Kịch bản 1 - Admin tạo tài khoản người dùng mới (Ưu tiên: P1)

Admin điều hướng đến trang Quản lý người dùng và nhấn nút "Thêm người dùng". Hệ thống hiển thị form tạo tài khoản với các trường: email, tên hiển thị và mật khẩu tạm thời. Admin điền đầy đủ thông tin và xác nhận. Hệ thống tạo tài khoản mới và chuyển hướng Admin về danh sách người dùng, nơi người dùng vừa tạo xuất hiện ngay lập tức.

**Lý do ưu tiên cao nhất**: Đây là nghiệp vụ cốt lõi của tính năng — không có form tạo người dùng thì Admin không thể thêm tài khoản mới vào hệ thống.

**Kiểm thử độc lập**: Đăng nhập với tài khoản Admin, nhấn "Thêm người dùng", điền form hợp lệ (email mới chưa tồn tại, tên hiển thị, mật khẩu ≥ 6 ký tự) và xác nhận tài khoản xuất hiện trong danh sách sau khi gửi.

**Kịch bản chấp nhận**:

1. **Cho** Admin đang ở trang Quản lý người dùng, **Khi** nhấn nút "Thêm người dùng", **Thì** hệ thống điều hướng đến trang/form tạo người dùng mới.
2. **Cho** Admin đã điền email hợp lệ, tên hiển thị và mật khẩu, **Khi** gửi form, **Thì** tài khoản mới được tạo và Admin được chuyển về danh sách với người dùng mới xuất hiện.
3. **Cho** Admin đã tạo người dùng thành công, **Khi** người dùng mới đăng nhập bằng email và mật khẩu đã được cấp, **Thì** đăng nhập thành công.

---

### Kịch bản 2 - Validation form tạo người dùng (Ưu tiên: P2)

Admin cố gắng gửi form tạo người dùng với dữ liệu không hợp lệ (email trùng, email sai định dạng, mật khẩu quá ngắn hoặc bỏ trống bắt buộc). Hệ thống từ chối và hiển thị thông báo lỗi rõ ràng giúp Admin biết cần sửa gì.

**Lý do ưu tiên**: Validation ngăn tạo dữ liệu xấu vào hệ thống và hướng dẫn Admin sửa lỗi nhanh chóng.

**Kiểm thử độc lập**: Thử gửi form với từng trường hợp lỗi riêng biệt và xác nhận thông báo lỗi phù hợp xuất hiện, tài khoản không được tạo.

**Kịch bản chấp nhận**:

1. **Cho** Admin gửi form với email đã tồn tại trong hệ thống, **Khi** form được gửi, **Thì** hệ thống hiển thị thông báo "Email đã được sử dụng" và không tạo tài khoản mới.
2. **Cho** Admin gửi form với email sai định dạng, **Khi** form được gửi, **Thì** hệ thống hiển thị thông báo lỗi định dạng email.
3. **Cho** Admin gửi form với mật khẩu ít hơn 6 ký tự, **Khi** form được gửi, **Thì** hệ thống hiển thị yêu cầu độ dài mật khẩu tối thiểu.
4. **Cho** Admin để trống trường bắt buộc (email hoặc mật khẩu), **Khi** gửi form, **Thì** hệ thống chặn gửi và chỉ rõ trường bị thiếu.

---

### Kịch bản 3 - Kiểm soát quyền truy cập form tạo người dùng (Ưu tiên: P3)

Người dùng không phải Admin cố truy cập trang tạo người dùng bằng cách nhập trực tiếp URL. Hệ thống từ chối và trả về thông báo không có quyền.

**Lý do ưu tiên**: Đảm bảo tính năng nhạy cảm chỉ Admin mới truy cập được, ngăn người dùng thường lợi dụng URL trực tiếp.

**Kiểm thử độc lập**: Đăng nhập với tài khoản USER thông thường, nhập trực tiếp URL `/admin/users/new` và xác nhận nhận thông báo từ chối quyền.

**Kịch bản chấp nhận**:

1. **Cho** người dùng có vai trò USER, **Khi** truy cập trực tiếp trang tạo người dùng, **Thì** họ nhận thông báo "Không có quyền truy cập" và không thấy form.
2. **Cho** người dùng chưa đăng nhập, **Khi** truy cập trang tạo người dùng, **Thì** họ bị chuyển về trang đăng nhập.

---

### Trường hợp ngoại lệ (Edge Cases)

- Điều gì xảy ra khi Admin gửi form nhưng kết nối mạng bị gián đoạn? Hệ thống hiển thị thông báo lỗi kết nối, form giữ nguyên dữ liệu đã nhập để Admin thử lại.
- Điều gì xảy ra khi Admin tạo người dùng với email đã tồn tại trong nhà cung cấp danh tính nhưng chưa có trong DB ứng dụng? Hệ thống trả về lỗi trùng email rõ ràng.
- Điều gì xảy ra khi Admin nhấn nút tạo hai lần liên tiếp (double-click)? Nút tạo bị vô hiệu hóa ngay sau lần nhấn đầu tiên để tránh tạo trùng.
- Điều gì xảy ra khi Admin hủy form giữa chừng? Admin được chuyển về danh sách người dùng, không có tài khoản nào được tạo.
- Điều gì xảy ra khi tài khoản được tạo thành công trong hệ thống xác thực nhưng lưu hồ sơ vào cơ sở dữ liệu thất bại? Hệ thống xóa tài khoản vừa tạo trong hệ thống xác thực (rollback hoàn toàn) và hiển thị thông báo lỗi cho Admin để thử lại.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

- **FR-001**: Hệ thống PHẢI cung cấp một trang/form riêng để Admin tạo tài khoản người dùng mới, truy cập từ nút "Thêm người dùng" trên trang danh sách.
- **FR-002**: Form tạo người dùng PHẢI có tối thiểu ba trường: địa chỉ email (bắt buộc), tên hiển thị (tùy chọn), mật khẩu tạm thời (bắt buộc, tối thiểu 6 ký tự). Form KHÔNG có trường chọn vai trò — vai trò mặc định là USER và chỉ thay đổi được sau khi tài khoản đã được tạo.
- **FR-003**: Hệ thống PHẢI từ chối tạo tài khoản với email đã tồn tại và hiển thị thông báo lỗi trùng email rõ ràng.
- **FR-004**: Hệ thống PHẢI từ chối tạo tài khoản với email sai định dạng và hiển thị thông báo validation.
- **FR-005**: Hệ thống PHẢI từ chối tạo tài khoản với mật khẩu ít hơn 6 ký tự.
- **FR-006**: Sau khi tạo thành công, hệ thống PHẢI chuyển Admin trở về trang danh sách người dùng, hiển thị thông báo thành công thoáng qua, và người dùng mới xuất hiện trong danh sách ngay lập tức.
- **FR-007**: Hệ thống PHẢI vô hiệu hóa nút gửi form trong khi đang xử lý yêu cầu để tránh gửi trùng.
- **FR-008**: Hệ thống PHẢI từ chối truy cập trang tạo người dùng từ người dùng không phải Admin và trả về thông báo không có quyền.
- **FR-009**: Tài khoản được tạo thành công PHẢI có thể đăng nhập ngay bằng email và mật khẩu đã cung cấp.
- **FR-010**: Nếu lưu hồ sơ vào cơ sở dữ liệu thất bại sau khi tài khoản xác thực đã được tạo, hệ thống PHẢI tự động xóa tài khoản xác thực đó (rollback) và trả về thông báo lỗi cho Admin; không để lại "ghost account" tồn tại trong hệ thống xác thực mà không có hồ sơ tương ứng.

### Các thực thể dữ liệu chính

- **Người dùng mới (New User)**: Tài khoản được tạo bởi Admin. Có địa chỉ email (duy nhất trong hệ thống), tên hiển thị, mật khẩu tạm thời. Mặc định được gán vai trò USER khi tạo.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: Admin có thể hoàn thành việc tạo một tài khoản người dùng mới (từ nhấn nút đến thấy người dùng trong danh sách) trong vòng 60 giây.
- **SC-002**: 100% yêu cầu tạo người dùng với dữ liệu không hợp lệ bị từ chối kèm thông báo lỗi cụ thể.
- **SC-003**: Người dùng được tạo thành công có thể đăng nhập ngay lập tức sau khi Admin xác nhận tạo.
- **SC-004**: 100% nỗ lực truy cập trang tạo người dùng từ tài khoản không phải Admin bị từ chối.

## Giả định

- Tài khoản được tạo mặc định có vai trò USER; Admin có thể thay đổi vai trò sau đó trên trang chi tiết người dùng.
- Admin đặt mật khẩu tạm thời cho người dùng mới; không có cơ chế gửi email đặt lại mật khẩu tự động trong phạm vi tính năng này.
- Địa chỉ email là bất biến sau khi tạo; không thể thay đổi email qua giao diện Admin trong tính năng này.
- Tên hiển thị là tùy chọn; nếu bỏ trống, hệ thống dùng phần trước ký tự "@" của email làm tên mặc định.
- Trạng thái tài khoản khi tạo mặc định là ACTIVE.
