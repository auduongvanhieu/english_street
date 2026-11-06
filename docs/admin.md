# Trang quản trị (Admin) — hướng dẫn nhanh

Địa chỉ: **https://englishstreet.coffeesos.online/admin/** (bản dev: http://localhost:5173/admin/).

## Vào trang admin
1. Tạo tài khoản bình thường trong game (Đăng ký).
2. Cấp quyền trên máy chủ:
   ```bash
   cd /home/sm/apps/english-street && set -a && . ./.env && set +a
   pnpm --filter @es/api admin:grant ten@email.com admin    # hoặc editor / player
   ```
3. Mở `/admin/`, đăng nhập bằng email + mật khẩu đó.
   - Phiên đăng nhập dài 12 giờ và mất khi đóng tab.
   - Bật **Bảo mật tài khoản → Xác thực 2 bước** cho tài khoản admin.

| Vai trò | Được làm |
|---|---|
| `editor` | Nội dung (NPC, nhiệm vụ, bài test, 4 khu, tên thú, luật nông trại, bản dịch), xem thống kê |
| `admin` | Tất cả, kèm người chơi, báo cáo, online, cài đặt, mã beta, thông báo, nhật ký |

`ADMIN_TOKEN` trong `.env` vẫn dùng được cho script: `Authorization: Bearer …`.

## Nội dung: sửa là có hiệu lực ngay
- **YAML trong git là bản gốc**: `packages/quests/content`. Mỗi lần lưu trong admin tạo một bản đè, lưu trong database (`ContentDoc`).
- **Áp dụng ngay**: game dùng bản mới trong vài giây, không cần deploy.
- **Nhãn trên mỗi mục** cho biết nó đến từ đâu: *bản gốc YAML*, *đã sửa*, *tạo trong admin* hoặc *đã ẩn*.
- **Khôi phục bản gốc**: bỏ bản đè, quay về YAML.
- **Lịch sử**: mọi phiên bản đều giữ lại, khôi phục được từng bản.
- **Đưa thay đổi về git**: bấm **YAML**, chép vào file tương ứng trong `packages/quests/content`, commit, rồi bấm **Khôi phục bản gốc** để bỏ bản đè.
- **Hai người cùng sửa một mục**: người lưu sau nhận báo "đã có người sửa", phải tải lại trang trước khi lưu.
- **Kiểm tra trước khi lưu** (sai thì không lưu được):
  - nhiệm vụ phải trỏ tới NPC có thật;
  - ID không được trùng;
  - thẻ từ phải thuộc danh mục có thật;
  - giá không được âm;
  - không xoá được NPC khi còn nhiệm vụ dùng NPC đó.

### Bản dịch
- **Tự động**: sửa nội dung một khu thì các chuỗi mới hoặc đã đổi được Claude dịch sang mọi ngôn ngữ trong vài phút. Cần `ANTHROPIC_API_KEY`.
- **Sửa tay**: ở trang **Bản dịch**. Bản sửa tay được giữ nguyên, trừ khi câu tiếng Anh gốc đổi.
- **Từ báo cáo của người chơi**: khi người chơi bấm "dịch sai", thẻ đó hiện ở tab **Báo dịch sai** của khu, kèm link sang trang sửa.

### Tên thú, luật nông trại, hết hàng (trang 🌍)
- **Nông trại**: giá bán, thời gian lớn, bật/tắt từng loại cây; số quả mỗi lần thu, số ô đất (tối đa 6), coins tối đa mỗi giờ, XP từng việc.
- **Tên thú**:
  - sở thú: mỗi chuồng 1–5 tên, mỗi tên là một con;
  - thú đi dạo trên phố và ở góc vuốt ve.
- **Hết hàng hôm nay**: món nhà hàng và sản phẩm siêu thị bị đánh dấu sẽ không gọi/mua được, và NPC biết là đã hết.

### Thử nói chuyện với NPC
Mở NPC hoặc nhiệm vụ, chọn tab **Thử nói chuyện**.
- Hội thoại dùng Claude thật nên tính vào ngân sách.
- Mỗi admin có giới hạn lượt thử mỗi ngày, mặc định 100.
- Các phiên thử không được tính vào thống kê.

## Người chơi
- **Tìm kiếm**: theo tên, email hoặc id; lọc theo khách, có tài khoản, bị khoá, bị tắt chat, trình độ, ngôn ngữ.
- **Chi tiết một người**: tiến độ, hội thoại các nhiệm vụ (bấm vào từng dòng), sổ tay, kho nông trại, báo cáo, hoạt động.
- **Các thao tác** (đều ghi vào Nhật ký):
  - **Khoá tài khoản**: người chơi bị đá ra ngay và không vào lại hay đăng nhập được.
  - **Tắt chat**: không gửi được tin nhắn. Người chơi được báo.
  - **Đá ra khỏi game**.
  - **Đăng xuất mọi nơi**.
  - **Mật khẩu tạm**: chưa có dịch vụ email, nên admin nhận một mật khẩu tạm để gửi cho người chơi.
  - **Xoá tài khoản**: phải gõ đúng tên để xác nhận.
- **Khách**: có thể khoá theo id khách, nhưng khách đổi trình duyệt là có id mới. Muốn chặn spam theo mạng thì dùng giới hạn khách theo IP trong Cài đặt.

### Cài đặt trong game của từng người chơi
Trang chi tiết người chơi có thẻ **Cài đặt trong game**: đồ hoạ, ngôn ngữ, phụ đề, IPA, tắt giọng đọc, tốc độ đọc, tiếng chim, kiểu mic, giờ và thời tiết. Thẻ hiện giá trị mà game của người đó báo về lần gần nhất.
- Bấm **Lưu và áp dụng**: nếu người chơi đang online, server game đẩy cài đặt xuống máy họ và đổi ngay, có thông báo nhỏ trong game. Nếu đang offline, cài đặt được giữ lại và áp dụng ở lần vào game tiếp theo.
- Mục **Thiết bị** có dòng 🎨 Đồ hoạ: chất lượng, FPS đo được, tỉ lệ điểm ảnh, số draw call.

## Thống kê
- **Nơi được ghé nhiều nhất**: lượt vào và thời gian ở lại từng khu, NPC được nói chuyện nhiều nhất, xe buýt.
- **Bản đồ nhiệt**: vị trí người chơi được ghi 30 giây một lần.
- **Người chơi**: số người mỗi ngày, người mới, chi phí Claude, ngôn ngữ, trình độ, thiết bị, phễu người mới, tỉ lệ quay lại.
- **Học tập**: nhiệm vụ, loại lỗi, quiz, từ hay sai.
- **Kinh tế game**: coins phát ra và tiêu đi, món bán chạy.

Cách tính số liệu:
- Số liệu gộp theo ngày (UTC), tự tính lại mỗi giờ. Nút **Tính lại** chạy ngay.
- Chi phí Claude theo ngày chỉ có từ khi trang admin chạy, vì trước đó chi phí chỉ nằm trong Redis của ngày hiện tại.
- Sự kiện gốc (bảng `Event`) không bị xoá tự động.

## Vận hành
- **Cài đặt**: giới hạn khách theo IP, ngân sách và model Claude, chế độ bảo trì, bộ lọc chat. Lưu là áp dụng ngay.
- **Bảo trì**: người chơi thấy thông báo thay cho con phố. Tab có đăng nhập admin vẫn bấm "Tiếp tục (staff)" để vào.
- **Thông báo**: hiện ngay cho mọi người đang chơi, và cho người vào sau cho tới hết hạn.
- **Mã mời beta**: chỉ có tác dụng khi `BETA_CODES` trong `.env` khác rỗng (beta kín đang bật).
- **Nhật ký**: ghi ai làm gì, lúc nào, kèm thay đổi trước và sau. Thay đổi nội dung hoàn tác được ngay từ nhật ký.

## Sao lưu
- Cron chạy `infra/vps/backup.sh` lúc 03:30 hằng ngày.
- File nằm ở `~/backups/english-street/`, giữ 14 bản gần nhất.
- Khôi phục: `pnpm --filter @es/api db:restore <file> --yes`. Lệnh này thay **toàn bộ** dữ liệu.

## Kiểm thử
- `pnpm --filter @es/quests test`: lớp nội dung (đè, ẩn, khôi phục, giá, luật nông trại).
- `node scripts/admin-e2e.mjs`: chạy toàn bộ API admin trên API và game server đang chạy. CI chạy với Postgres và Redis mới.
