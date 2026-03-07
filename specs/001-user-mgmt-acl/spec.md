# Đặc tả tính năng: Quản lý người dùng với phân quyền dựa trên vai trò (ACL)

**Nhánh tính năng**: `001-user-mgmt-acl`
**Ngày tạo**: 2026-03-07
**Trạng thái**: Bản nháp
**Nguồn**: requirement.md & system_design.md

## Làm rõ

### Phiên 2026-03-07

- Q: Bài post là loại nội dung gì và ai được phép thực hiện CRUD? → A: Mọi USER đã đăng nhập đều tạo được bài post của mình; chỉ chủ bài (tác giả) hoặc ADMIN mới được sửa/xóa.
- Q: Bài post có trạng thái (nháp/đã xuất bản) hay luôn hiển thị ngay sau khi tạo? → A: Không có trạng thái — bài post luôn công khai và hiển thị ngay sau khi tạo thành công.
- Q: Khách chưa đăng nhập có thể đọc bài post không? → A: Không — phải đăng nhập mới xem được bài post, nhất quán với toàn hệ thống bảo vệ.
- Q: Danh sách bài post có cần phân trang hoặc tìm kiếm/lọc không? → A: Có phân trang kết hợp tìm kiếm theo tiêu đề.
- Q: Nếu tài khoản người dùng bị xóa hoàn toàn, bài post của họ sẽ như thế nào? → A: Giữ lại bài post, hiển thị tác giả là "Người dùng đã xóa" (anonymous).
- Q: Hệ thống có cần lưu nhật ký hành động của Admin không? → A: Không — audit log ngoài phạm vi phiên bản này.
- Q: Tìm kiếm bài post theo tiêu đề hoạt động theo kiểu nào? → A: Chứa từ khóa (contains), không phân biệt hoa/thường.
- Q: Khi nhà cung cấp danh tính gián đoạn, hệ thống xử lý như thế nào? → A: Hiển thị thông báo lỗi thân thiện trên trang đăng nhập; người dùng đã đăng nhập giữ nguyên phiên hiện tại.
- Q: Danh sách bài post mặc định sắp xếp theo thứ tự nào? → A: Mới nhất trước — bài tạo gần nhất hiển thị đầu danh sách.

## Kịch bản người dùng & Kiểm thử *(bắt buộc)*

### Kịch bản 1 - Đăng nhập an toàn (Ưu tiên: P1)

Người dùng đã có tài khoản truy cập ứng dụng và đăng nhập bằng địa chỉ email cùng mật khẩu. Hệ thống xác minh danh tính, tải hồ sơ và quyền hạn của họ, rồi chuyển hướng đến trang dashboard chính. Nếu thông tin đăng nhập sai, một thông báo lỗi rõ ràng sẽ hiển thị. Phiên đăng nhập được duy trì cho đến khi người dùng chủ động đăng xuất.

**Lý do ưu tiên cao nhất**: Xác thực là cổng vào của toàn bộ hệ thống. Không có tính năng này, không có kịch bản nào khác có thể hoạt động. Mọi kịch bản còn lại đều phụ thuộc vào việc đăng nhập hoạt động đúng.

**Kiểm thử độc lập**: Có thể kiểm thử bằng cách dùng một tài khoản đã đăng ký, nhập đúng thông tin đăng nhập và xác nhận trang dashboard hiển thị tên người dùng. Khách chưa đăng nhập truy cập vào trang được bảo vệ phải bị chuyển về trang đăng nhập.

**Kịch bản chấp nhận**:

1. **Cho** người dùng đã đăng ký với email và mật khẩu hợp lệ, **Khi** họ gửi form đăng nhập, **Thì** họ được chuyển đến dashboard và tên hiển thị của họ xuất hiện.
2. **Cho** khách chưa đăng nhập với thông tin không hợp lệ, **Khi** họ gửi form đăng nhập, **Thì** một thông báo lỗi hiển thị và họ vẫn ở lại trang đăng nhập.
3. **Cho** người dùng đang đăng nhập trên một trang được bảo vệ, **Khi** phiên hết hạn hoặc họ đăng xuất, **Thì** họ bị chuyển về trang đăng nhập.
4. **Cho** khách chưa đăng nhập, **Khi** họ nhập trực tiếp một URL được bảo vệ vào trình duyệt, **Thì** họ bị chuyển về trang đăng nhập.

---

### Kịch bản 2 - Người dùng quản lý bài post (CRUD) (Ưu tiên: P2)

Người dùng đã đăng nhập điều hướng đến khu vực bài post và có thể xem danh sách tất cả bài post trong hệ thống. Họ có thể tạo bài post mới với tiêu đề và nội dung. Sau khi tạo, bài post xuất hiện trong danh sách chung và tác giả có thể chỉnh sửa hoặc xóa bài của mình. ADMIN có thể sửa và xóa bất kỳ bài post nào.

**Lý do ưu tiên**: Đây là nghiệp vụ cốt lõi thứ hai của ứng dụng. Đây là thực thể nội dung chính mà hệ thống xây dựng xung quanh.

**Kiểm thử độc lập**: Có thể kiểm thử bằng cách đăng nhập với bất kỳ tài khoản nào, tạo một bài post mới, xác nhận nó xuất hiện trong danh sách, chỉnh sửa nó, rồi xóa nó. Sau đó xác nhận một người dùng khác (không phải tác giả, không phải Admin) không thể sửa hay xóa bài đó.

**Kịch bản chấp nhận**:

1. **Cho** bất kỳ người dùng đã đăng nhập, **Khi** xem trang bài post, **Thì** danh sách tất cả bài post hiển thị với tiêu đề và tên tác giả.
2. **Cho** người dùng đã đăng nhập, **Khi** tạo bài post mới với tiêu đề và nội dung hợp lệ, **Thì** bài post xuất hiện trong danh sách và được gắn với tài khoản của họ.
3. **Cho** tác giả của một bài post, **Khi** họ chỉnh sửa nội dung và lưu, **Thì** bài post được cập nhật và hiển thị nội dung mới.
4. **Cho** tác giả của một bài post, **Khi** họ xóa bài, **Thì** bài post bị xóa khỏi danh sách.
5. **Cho** người dùng không phải tác giả và không phải ADMIN, **Khi** họ cố chỉnh sửa hoặc xóa bài post của người khác, **Thì** họ nhận được thông báo "Không có quyền" và thao tác không được thực hiện.
6. **Cho** ADMIN, **Khi** họ chỉnh sửa hoặc xóa bài post của bất kỳ người dùng nào, **Thì** thao tác thành công.

---

### Kịch bản 3 - Admin quản lý người dùng (CRUD) (Ưu tiên: P3)

Admin truy cập vào mục Quản lý người dùng và có thể xem danh sách toàn bộ người dùng trong hệ thống. Admin có thể tạo tài khoản người dùng mới, xem chi tiết, cập nhật tên hiển thị hoặc trạng thái, và vô hiệu hóa tài khoản.

**Lý do ưu tiên**: Các thao tác CRUD trên người dùng là nghiệp vụ quản trị. Phụ thuộc vào xác thực (P1) và là nền tảng để phân quyền (P4).

**Kiểm thử độc lập**: Có thể kiểm thử bằng cách đăng nhập với tài khoản Admin, vào trang Quản lý người dùng, tạo một người dùng mới, xác nhận họ xuất hiện trong danh sách, chỉnh sửa thông tin, sau đó vô hiệu hóa. Người dùng không phải Admin thực hiện các thao tác tương tự phải bị từ chối.

**Kịch bản chấp nhận**:

1. **Cho** Admin trên trang Quản lý người dùng, **Khi** xem danh sách, **Thì** tất cả người dùng hiển thị với tên, email và trạng thái.
2. **Cho** Admin, **Khi** tạo người dùng mới với email hợp lệ, **Thì** người dùng xuất hiện trong danh sách và có thể đăng nhập bằng email đó.
3. **Cho** Admin đang xem chi tiết một người dùng, **Khi** cập nhật tên hiển thị hoặc trạng thái và lưu, **Thì** thay đổi được phản ánh ngay lập tức trong danh sách.
4. **Cho** Admin, **Khi** vô hiệu hóa một người dùng, **Thì** người dùng đó không thể đăng nhập vào hệ thống.
5. **Cho** người dùng không phải Admin, **Khi** cố truy cập mục Quản lý người dùng, **Thì** họ nhận được thông báo "Không có quyền truy cập" và không thấy bất kỳ dữ liệu người dùng nào.

---

### Kịch bản 4 - Admin phân quyền vai trò (Ưu tiên: P4)

Admin chọn một người dùng cụ thể và thay đổi vai trò của họ (ví dụ: từ USER lên ADMIN hoặc ngược lại). Thay đổi có hiệu lực ngay ở hành động tiếp theo của người dùng được phân quyền — phiên đăng nhập hiện tại không bị gián đoạn, nhưng yêu cầu tiếp theo sẽ phản ánh quyền hạn mới.

**Lý do ưu tiên**: Quản lý vai trò là nền tảng của hệ thống ACL. Tính năng này phụ thuộc vào Quản lý người dùng (P3).

**Kiểm thử độc lập**: Có thể kiểm thử bằng cách đăng nhập Admin, thay đổi vai trò của người dùng khác từ USER thành ADMIN, đăng nhập với tài khoản đó trong một phiên riêng, và xác nhận người dùng đó giờ có quyền truy cập vào các trang chỉ dành cho Admin.

**Kịch bản chấp nhận**:

1. **Cho** Admin đang xem hồ sơ một người dùng, **Khi** thay đổi vai trò và lưu, **Thì** vai trò mới được xác nhận trong giao diện.
2. **Cho** người dùng vừa được nâng từ USER lên ADMIN, **Khi** thực hiện hành động tiếp theo, **Thì** hệ thống áp dụng quyền hạn ADMIN mới.
3. **Cho** người dùng vừa bị hạ từ ADMIN xuống USER, **Khi** cố truy cập một endpoint chỉ dành cho Admin, **Thì** họ nhận được phản hồi "Không có quyền truy cập".

---

### Kịch bản 5 - Kiểm soát quyền truy cập theo vai trò (Ưu tiên: P5)

Người dùng đã đăng nhập chỉ có thể truy cập các trang và thực hiện các thao tác được phép theo vai trò của họ. ADMIN có thể thực hiện mọi thao tác CRUD trên cả người dùng và bài post. USER chỉ có thể tạo bài post mới, sửa/xóa bài post của chính mình, và xem hồ sơ cá nhân. Mọi nỗ lực truy cập tài nguyên bị cấm đều bị từ chối kèm thông báo rõ ràng.

**Lý do ưu tiên**: Đây là lớp thực thi của hệ thống ACL, phụ thuộc vào xác thực (P1) và phân quyền vai trò (P4).

**Kiểm thử độc lập**: Có thể kiểm thử bằng cách đăng nhập với tài khoản USER, cố điều hướng đến trang Quản lý người dùng dành cho Admin, xác nhận bị từ chối. Sau đó tạo bài post và xác nhận thành công. Cố sửa bài post của người khác và xác nhận bị từ chối.

**Kịch bản chấp nhận**:

1. **Cho** người dùng có vai trò USER, **Khi** điều hướng đến bất kỳ trang chỉ dành cho Admin, **Thì** họ thấy thông báo "Không có quyền truy cập" và không thể xem nội dung trang.
2. **Cho** người dùng có vai trò ADMIN, **Khi** điều hướng đến bất kỳ trang nào trong ứng dụng, **Thì** họ có thể truy cập toàn bộ nội dung và thực hiện tất cả thao tác CRUD.
3. **Cho** bất kỳ người dùng đã xác thực nào, **Khi** xem trang hồ sơ cá nhân của chính mình, **Thì** họ có thể xem thông tin của mình bất kể vai trò là gì.
4. **Cho** người dùng có vai trò USER, **Khi** cố sửa hoặc xóa bài post của người dùng khác, **Thì** họ nhận được thông báo "Không có quyền" và thao tác không được thực hiện.

---

### Trường hợp ngoại lệ (Edge Cases)

- Điều gì xảy ra khi một người dùng bị vô hiệu hóa trong khi họ đang có phiên đăng nhập hoạt động? Yêu cầu tiếp theo của họ phải bị từ chối và chuyển về trang đăng nhập.
- Điều gì xảy ra khi Admin duy nhất cố hạ vai trò của chính mình? Hệ thống phải ngăn thao tác này để đảm bảo luôn có ít nhất một Admin.
- Điều gì xảy ra khi người dùng đăng nhập lần đầu với tài khoản hợp lệ từ nhà cung cấp danh tính nhưng chưa có hồ sơ trong cơ sở dữ liệu? Hệ thống tự động tạo hồ sơ mặc định với vai trò USER.
- Điều gì xảy ra khi Admin tạo người dùng với email đã tồn tại? Hệ thống hiển thị thông báo lỗi trùng email rõ ràng.
- Điều gì xảy ra nếu dữ liệu vai trò trong bộ nhớ đệm bị lỗi thời? Bộ nhớ đệm phải được xóa ngay sau khi vai trò thay đổi để tránh người dùng giữ lại quyền hạn cũ.
- Điều gì xảy ra khi người dùng bị vô hiệu hóa nhưng còn bài post? Các bài post vẫn hiển thị trong danh sách nhưng không thể chỉnh sửa cho đến khi tài khoản được kích hoạt lại (hoặc ADMIN can thiệp).
- Điều gì xảy ra khi Admin xóa hoàn toàn (hard delete) tài khoản người dùng? Các bài post của họ được giữ nguyên trong hệ thống nhưng tên tác giả hiển thị là "Người dùng đã xóa".
- Điều gì xảy ra khi tạo bài post với tiêu đề hoặc nội dung rỗng? Hệ thống từ chối và hiển thị thông báo lỗi validation rõ ràng.
- Điều gì xảy ra khi nhà cung cấp danh tính (dịch vụ xác thực bên ngoài) gián đoạn? Trang đăng nhập hiển thị thông báo lỗi thân thiện "Không thể đăng nhập lúc này, vui lòng thử lại sau"; người dùng đang có phiên hoạt động không bị ảnh hưởng.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Xác thực:**

- **YC-001**: Hệ thống PHẢI cho phép người dùng đăng nhập bằng địa chỉ email và mật khẩu hợp lệ thông qua nhà cung cấp danh tính.
- **YC-002**: Hệ thống PHẢI từ chối đăng nhập với thông tin không hợp lệ và hiển thị thông báo lỗi thân thiện với người dùng.
- **YC-003**: Hệ thống PHẢI bảo vệ tất cả các trang và endpoint dữ liệu để chỉ người dùng đã xác thực mới truy cập được.
- **YC-004**: Hệ thống PHẢI chuyển hướng người dùng chưa xác thực về trang đăng nhập khi họ cố truy cập tài nguyên được bảo vệ.
- **YC-013**: Hệ thống PHẢI tự động tạo hồ sơ người dùng mặc định với vai trò USER khi người dùng đăng nhập thành công lần đầu mà chưa có hồ sơ trong hệ thống.

**Quản lý bài post:**

- **YC-015**: Hệ thống PHẢI cho phép mọi người dùng đã xác thực xem danh sách bài post theo trang (phân trang), sắp xếp mặc định theo thứ tự mới nhất trước, hiển thị tiêu đề và tên tác giả; khách chưa đăng nhập bị chặn và chuyển về trang đăng nhập.
- **YC-015b**: Hệ thống PHẢI cho phép người dùng tìm kiếm bài post theo tiêu đề; kết quả trả về các bài có tiêu đề **chứa** chuỗi từ khóa nhập vào (không phân biệt chữ hoa/thường); ví dụ: từ khóa "hello" khớp với tiêu đề "Hello World".
- **YC-016**: Hệ thống PHẢI cho phép mọi người dùng đã xác thực tạo bài post mới với tối thiểu tiêu đề và nội dung; bài post được gắn với tài khoản tác giả.
- **YC-017**: Hệ thống PHẢI cho phép tác giả của một bài post chỉnh sửa tiêu đề và nội dung bài post của chính mình.
- **YC-018**: Hệ thống PHẢI cho phép tác giả của một bài post xóa bài post của chính mình.
- **YC-019**: Hệ thống PHẢI cho phép ADMIN chỉnh sửa và xóa bài post của bất kỳ người dùng nào.
- **YC-020**: Hệ thống PHẢI từ chối thao tác sửa/xóa bài post của người dùng không phải tác giả và không phải ADMIN, trả về thông báo lỗi rõ ràng.
- **YC-021**: Hệ thống PHẢI từ chối tạo bài post với tiêu đề hoặc nội dung rỗng và hiển thị thông báo validation.

**Quản lý người dùng (Admin):**

- **YC-005**: Hệ thống PHẢI cho phép Admin xem danh sách phân trang toàn bộ người dùng đã đăng ký, hiển thị tên, email và trạng thái.
- **YC-006**: Hệ thống PHẢI cho phép Admin tạo tài khoản người dùng mới với tối thiểu địa chỉ email và tên hiển thị.
- **YC-007**: Hệ thống PHẢI cho phép Admin cập nhật tên hiển thị và trạng thái tài khoản (hoạt động/vô hiệu hóa) của người dùng.
- **YC-008**: Hệ thống PHẢI cho phép Admin vô hiệu hóa người dùng, ngay lập tức ngăn người dùng đó thực hiện thêm bất kỳ thao tác nào.
- **YC-008b**: Hệ thống PHẢI cho phép Admin xóa hoàn toàn tài khoản người dùng; khi xóa, các bài post của người dùng đó được giữ lại và hiển thị tác giả là "Người dùng đã xóa".
- **YC-009**: Hệ thống PHẢI cho phép Admin gán một vai trò (ADMIN hoặc USER) cho bất kỳ người dùng nào.
- **YC-014**: Hệ thống PHẢI cho phép bất kỳ người dùng đã xác thực nào xem và cập nhật hồ sơ cá nhân của mình (tên hiển thị).

**Kiểm soát quyền truy cập:**

- **YC-010**: Hệ thống PHẢI thực thi kiểm soát quyền truy cập dựa trên vai trò trên mọi thao tác được bảo vệ, từ chối và trả về thông báo lỗi rõ ràng khi người dùng không có vai trò phù hợp.
- **YC-011**: Hệ thống PHẢI xóa dữ liệu vai trò đã lưu trong bộ nhớ đệm của người dùng ngay sau khi vai trò của họ thay đổi, để quyền hạn mới có hiệu lực ở yêu cầu tiếp theo.
- **YC-012**: Hệ thống PHẢI ngăn Admin cuối cùng bị hạ cấp hoặc vô hiệu hóa, đảm bảo luôn tồn tại ít nhất một Admin.

### Các thực thể dữ liệu chính

- **Người dùng (User)**: Đại diện cho một người đã xác thực trong hệ thống. Được nhận diện bằng ID duy nhất từ nhà cung cấp danh tính. Có địa chỉ email, tên hiển thị và trạng thái tài khoản (hoạt động/vô hiệu hóa).
- **Vai trò (Role)**: Mức quyền hạn được đặt tên, xác định những thao tác nào Người dùng có thể thực hiện. Hệ thống hỗ trợ tối thiểu hai vai trò: ADMIN (toàn quyền) và USER (quyền hạn giới hạn).
- **Phân công vai trò (User-Role)**: Mối liên kết giữa Người dùng và Vai trò của họ. Mỗi người dùng có đúng một vai trò tại một thời điểm. Có thể thay đổi bởi Admin.
- **Bài post (Post)**: Đơn vị nội dung do người dùng tạo ra. Có tiêu đề và nội dung (đều bắt buộc). Không có trạng thái — hiển thị công khai ngay lập tức sau khi tạo. Được gắn với một Người dùng tác giả duy nhất. Hiển thị cho tất cả người dùng đã xác thực. Chỉ tác giả hoặc ADMIN mới có thể sửa hoặc xóa.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **TC-001**: Người dùng có thể hoàn thành quá trình đăng nhập (nhập thông tin và đến được dashboard) trong vòng 10 giây với kết nối internet thông thường.
- **TC-002**: Admin có thể hoàn thành toàn bộ vòng đời tạo người dùng, phân quyền và vô hiệu hóa trong vòng 3 phút mà không cần tra cứu tài liệu.
- **TC-003**: Thay đổi quyền hạn dựa trên vai trò có hiệu lực ngay ở yêu cầu tiếp theo của người dùng được phân quyền — không có độ trễ nào ngoài yêu cầu đang xử lý.
- **TC-004**: 100% các yêu cầu đến endpoint được bảo vệ bị từ chối với người dùng chưa xác thực hoặc không có quyền; không có rò rỉ dữ liệu ngoài ý muốn nào xảy ra.
- **TC-005**: Hồ sơ người dùng mới được tạo tự động khi đăng nhập lần đầu mà không cần Admin thực hiện thêm thao tác thủ công nào.
- **TC-006**: Hệ thống thực thi đúng kiểm soát quyền truy cập cho tất cả các vai trò trong 100% kịch bản kiểm thử bao gồm vai trò ADMIN và USER.
- **TC-007**: Người dùng có thể tạo, chỉnh sửa và xóa bài post của mình trong vòng 2 phút mà không cần hướng dẫn.
- **TC-008**: Thao tác sửa/xóa bài post của người không có quyền bị từ chối trong 100% trường hợp kiểm thử.

## Giả định

- Việc đăng ký tài khoản (sign-up) được xử lý hoàn toàn bởi nhà cung cấp danh tính. Bản thân ứng dụng không cung cấp form tự đăng ký; người dùng mới được tạo bởi Admin hoặc cấp phát từ bên ngoài.
- Mỗi người dùng có đúng một vai trò tại một thời điểm (không hỗ trợ đa vai trò trong phiên bản này).
- Tài khoản Admin đầu tiên được khởi tạo thủ công hoặc qua script thiết lập ngoài phạm vi tính năng này.
- Trạng thái "vô hiệu hóa" tương đương với "xóa mềm" — hồ sơ được giữ lại trong cơ sở dữ liệu nhưng người dùng không thể đăng nhập.
- Địa chỉ email là bất biến sau khi tài khoản được tạo; việc thay đổi email đòi hỏi thao tác ở cấp nhà cung cấp danh tính, ngoài phạm vi ứng dụng này.
- Hai vai trò mặc định (ADMIN, USER) là đủ cho phiên bản này; việc tạo vai trò tùy chỉnh/động nằm ngoài phạm vi.
- Bộ nhớ đệm vai trò sử dụng thời gian sống tối đa 1 giờ; việc xóa cache tường minh khi vai trò thay đổi là bắt buộc để đảm bảo thực thi gần thời gian thực.
- Bài post của người dùng bị vô hiệu hóa vẫn được giữ lại trong hệ thống và hiển thị công khai cho người dùng khác.
- Khi tài khoản bị xóa hoàn toàn, bài post được giữ lại nhưng tên tác giả thay thành "Người dùng đã xóa"; không có bài post nào bị xóa theo tầng (cascade delete).
- Mỗi bài post thuộc về đúng một tác giả; không hỗ trợ đồng tác giả trong phiên bản này.
- Nhật ký hành động của Admin (audit log) nằm ngoài phạm vi phiên bản này; không có yêu cầu ghi lại lịch sử thay đổi vai trò hay xóa tài khoản.
