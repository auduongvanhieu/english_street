# Kim cương 💎 và nạp tiền (chuyển khoản VNĐ, USDT)

Game có hai loại tiền:
- **Xu 🪙:** thưởng cho việc học và chơi (nhiệm vụ, nông trại…), tiêu vào taxi, khách sạn, đồ thường.
- **Kim cương 💎:** chỉ có khi nạp tiền, cộng thêm quà nhỏ. Dùng để mua đồ đặc biệt, mua thêm lượt nói chuyện với NPC, hoặc đổi sang xu (chỉ một chiều).

Người chơi mua **gói kim cương** bằng một trong hai cách:
- **Chuyển khoản ngân hàng (VNĐ):** quét mã VietQR. SePay báo về qua webhook.
- **USDT:** gửi trên mạng TRC20 (Tron) hoặc BEP20 (BNB Chain). Server tự đọc blockchain để thấy tiền về.

Không có gói thuê bao. Bài học, nhiệm vụ, NPC và khu vực luôn miễn phí. Kim cương không khoá việc học.

## Kim cương dùng vào đâu

| Việc | Ở đâu | Cài đặt |
|---|---|---|
| **Đồ 💎:** tóc (băng, tím), màu áo (neon, vàng hồng), bảng tên (Kim cương, Lửa, Thiên hà), nội thất (giường hoàng gia, ghế vàng, đèn pha lê, đồng hồ vàng) | Tạo nhân vật; Phòng của tôi → Mua | `gemPrices` đổi giá từng món (id → giá) |
| **Lượt NPC thêm:** dùng sau khi hết lượt miễn phí trong ngày, không hết hạn | Bảng Kim cương → Lượt NPC; nút "Mua thêm" khi hết lượt | `gemTurnPack` (mặc định 20 lượt = 20 💎), `npcPaidDailyBudgetUsd` |
| **Đổi sang xu** (một chiều) | Bảng Kim cương → Đổi ra xu | `gemRate` (mặc định 1 💎 = 10 xu) |

**Quà miễn phí** (chỉ tài khoản đã đăng ký, khách thì không):
- mỗi 7 ngày chơi liên tiếp được `gemGiftStreak` (5 💎);
- mỗi chặng hành trình chính được `gemGiftChapter` (10 💎).

**Lượt NPC đã mua:**
- Lượt mua có ngân sách Claude riêng `npcPaidDailyBudgetUsd` (2 USD/ngày), cộng thêm ngoài ngân sách miễn phí. Nhờ vậy người đã trả tiền không bị chặn khi ngân sách miễn phí trong ngày đã hết.
- Lượt nào lỗi (NPC không trả lời) thì được trả lại.

Danh mục đồ 💎 nằm ở `packages/shared/src/avatar.ts` (`gems`) và `home.ts` (`gems`, `tint`, `glow`). Nội thất 💎 dùng lại mô hình có sẵn, chỉ pha màu.

## Mỗi phần nằm ở đâu

| Phần | File |
|---|---|
| Sổ cái: mọi lần cộng/trừ xu và kim cương đều đi qua `changeBalanceTx` (`currency` = `coin` / `gem`) | `apps/api/src/npc/attempts.ts` (`spend`, `addCoins`, `reward`) |
| Kim cương: giá đồ, đổi xu, lượt NPC, quà | `apps/api/src/gems/core.ts`, `apps/api/src/gems/routes.ts` |
| Đơn nạp, khớp tiền về, cộng kim cương | `apps/api/src/payments/core.ts` |
| Quét ví USDT (TronGrid, RPC BNB Chain) | `apps/api/src/payments/chain.ts` |
| API người chơi, webhook SePay, API admin | `apps/api/src/payments/routes.ts` |
| Kiểu dữ liệu dùng chung | `packages/shared/src/pay.ts` |
| Bảng "Kim cương" trong game (nạp, đổi xu, lượt NPC) | `apps/web/src/ui/TopUpPanel.tsx`, `apps/web/src/store/pay.ts` |
| Trang admin "Kim cương & nạp" | `apps/web/src/admin/pages/Payments.tsx` |
| Bảng DB | `CoinLedger`, `PaymentOrder`, `PaymentTx` (migration `20261110090000_payments`); `User.gems`, `User.npcBonusTurns`, `CoinLedger.currency` (migration `20261114090000_gems`) |

## Cách hoạt động

1. **Người chơi chọn gói và cách trả.** Server tạo đơn có mã riêng `ES` + 6 ký tự.
   - Đơn VNĐ dùng mã này làm **nội dung chuyển khoản**.
   - Đơn USDT có **số tiền định danh**: giá gói cộng 0,001–0,299 USDT, không trùng với đơn nào khác đang chờ trên cùng mạng.
2. **Mỗi khoản tiền về chỉ được xử lý một lần.** Mỗi giao dịch (`PaymentTx`, khoá duy nhất là nguồn + mã giao dịch) được lưu đúng một lần. Trong cùng một transaction, server tìm đơn, đánh dấu đã trả và cộng kim cương. Vì vậy webhook gửi lặp hay quét lại blockchain cũng không cộng hai lần.
3. **Lần nạp đầu** của mỗi người được gấp đôi kim cương (cài đặt `payFirstBonus`).
4. **Giao dịch không khớp đơn nào** vào mục admin → Kim cương & nạp → **Cần xử lý**:
   - chuyển thiếu;
   - không có mã đơn;
   - đơn đã trả rồi (chuyển hai lần);
   - sai cách trả.
5. **Đơn quá thời gian chờ** chuyển sang trạng thái "hết hạn". Nếu tiền về muộn, đơn vẫn được nhận và cộng kim cương.
6. **Trong app iOS/Android** không có nút nạp, vì quy định của store bắt dùng thanh toán trong ứng dụng.

## Cài đặt (admin → Kim cương & nạp → Cài đặt)

| Cài đặt | Ý nghĩa |
|---|---|
| `payMode` | `off` = ẩn; `test` = chỉ người trong `payTesters` (id hoặc email); `on` = mọi tài khoản đã đăng ký |
| `payVnd`, `payUsdt` | Bật/tắt từng cách trả |
| `payPacks` | Các gói: `id`, `gems`, `vnd`, `usdt` (mặc định 100 / 270 / 600 💎 = 20.000 / 50.000 / 100.000đ = 1 / 2 / 4 USDT) |
| `payBank`, `payBankAccount`, `payBankName` | Mã ngân hàng VietQR (MB, VCB, 970422…), số tài khoản, tên chủ tài khoản (không dấu) |
| `payTrc20Address`, `payBep20Address` | **Chỉ địa chỉ ví.** Không bao giờ đưa khoá riêng lên server. |
| `payBep20Confirmations` | Số block chờ trên BNB Chain (mặc định 15). TRC20 dùng trạng thái "confirmed" của Tron. |
| `payOrderMinutes` | Thời gian chờ mỗi đơn (mặc định 30 phút) |

Các khoá bí mật nằm trong `.env` của server:
- `SEPAY_API_KEY` (bắt buộc cho VNĐ);
- `TRONGRID_API_KEY` (không bắt buộc, giúp ít bị giới hạn);
- `BSC_RPC_URL` (mặc định `https://bsc-rpc.publicnode.com`; RPC mặc định của Binance không cho đọc log).

## Chỉ dùng USDT (chưa có SePay)

Cách trả nào chưa điền đủ cài đặt thì tự ẩn. Để trống `payBank`/`payBankAccount` thì game không hiện chuyển khoản, giá gói ghi bằng USDT. Chỉ cần làm bước 3 và 4 ở dưới với 2 địa chỉ ví. Có thể chỉ điền một ví, game chỉ hiện mạng đó.

Ví nhận tiền có thể là ví riêng (Trust Wallet, OKX Wallet…) hoặc địa chỉ nạp của sàn. Server chỉ đọc tiền vào địa chỉ đó trên blockchain.

## Bật lần đầu

1. **SePay:**
   - Tạo tài khoản và liên kết tài khoản ngân hàng.
   - Vào Webhooks → Thêm webhook:
     - URL: `https://englishstreet.coffeesos.online/api/pay/webhook/sepay`
     - Kiểu chứng thực: **API Key**
     - Chỉ nhận tiền vào.
2. **Đặt `SEPAY_API_KEY=<key>`** vào `/home/sm/apps/english-street/.env` rồi khởi động lại API (`deploy.sh restart`).
3. **Điền cài đặt trong admin:** điền ngân hàng và ví, đặt `payMode = test`, thêm email của bạn vào `payTesters`.
4. **Thử thật:**
   - nạp gói nhỏ nhất bằng chuyển khoản;
   - nạp 1 USDT trên mỗi mạng.

   Mỗi lần, kiểm tra kim cương được cộng trong game, có một dòng trong sổ cái và đơn "Đã thanh toán" trong admin.
5. **Mở cho mọi người:** đặt `payMode = on`.

## Đối soát và xử lý sự cố

- **Kiểm tra số liệu:**
  - Tổng tiền trong tab Tổng quan phải khớp với sao kê ngân hàng và lịch sử ví.
  - Mỗi lần cộng/trừ xu hoặc kim cương đều có một dòng trong `CoinLedger` (`currency`; `reason`: `purchase`, `refund`, `admin`, `reward`, `spend`, `transfer`, `exchange`). Tab Tổng quan có bảng "Kim cương đi đâu".
- **Người chơi chuyển sai nội dung hoặc thiếu tiền:** vào Cần xử lý → Xử lý. Hoặc gán cho đúng đơn (cộng kim cương theo gói), hoặc cộng kim cương thẳng cho người chơi (theo id).
- **Hoàn tiền:** tự chuyển trả tiền cho người chơi trước. Sau đó bấm **Hoàn** ở đơn: game lấy lại kim cương của đơn (nếu người chơi đã tiêu bớt thì lấy phần còn lại) và đánh dấu đơn "refunded".
- **Tab Tổng quan, mục "Kết nối":** cho thấy webhook SePay đã có key chưa và lần quét TRC20/BEP20 gần nhất có lỗi không.

## Kiểm thử

```bash
pnpm --filter @es/api test        # unit tests (không cần DB)
DATABASE_URL=postgresql://es:es@localhost:5433/english_street pnpm --filter @es/api test:db   # sổ cái + thanh toán + kim cương trên Postgres dev
```

## Lưu ý pháp lý

- **USDT:** tiền mã hoá không phải phương tiện thanh toán hợp pháp ở Việt Nam. Hỏi người hiểu luật trước khi bật USDT cho người chơi Việt Nam.
- **Doanh thu qua chuyển khoản:** cần kê khai thuế.
