# TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG VIỆT - HÀN
**KHOA KHOA HỌC MÁY TÍNH**

**CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM**  
**Độc lập - Tự do - Hạnh phúc**

---

*Đà Nẵng, ngày 1 tháng 9 năm 2026*

## ĐỀ CƯƠNG THỰC TẬP DOANH NGHIỆP

### Thông tin người thực hiện
- **Họ và tên sinh viên:** HỒ THANH HUY
- **MSSV:** 22IT111
- **Ngành:** Khoa Học Máy Tính
- **Lớp:** 22GIT
- **Điện thoại:** 0975177082
- **Email:** huyht.22git@vku.udn.vn
- **Giảng viên hướng dẫn:** PGS.TS NGUYỄN THANH BÌNH

---

### Tên đồ án
**THỰC TẬP TỐT NGHIỆP**  
*(Đề tài nghiên cứu ứng dụng: Nghiên cứu thiết kế và xây dựng hệ thống ví phi lưu ký Seedless và giải pháp mua tiền mã hóa tức thì bằng tiền pháp định (Instant Fiat-to-Crypto Onramp) ứng dụng công nghệ Passkeys và Account Abstraction trên mạng Solana - RampFi)*

---

### Mô tả

#### 1. Tổng quan đề tài
Thực tập tại doanh nghiệp (**Thien An Studio - Đà Nẵng**) là cơ hội để sinh viên tiếp cận môi trường làm việc thực tế chuyên nghiệp trong lĩnh vực Web3 và Công nghệ Tài chính (Fintech), nắm vững quy trình phát triển sản phẩm phần mềm thương mại, tìm hiểu cơ cấu tổ chức, phương pháp quản lý dự án Agile/Scrum/Waterfall Hybrid và văn hóa doanh nghiệp tại một công ty công nghệ di động & blockchain hàng đầu.

Trong quá trình thực tập, sinh viên được tham gia trực tiếp nghiên cứu, phân tích kiến trúc và xây dựng hệ thống **RampFi** — giải pháp ví phi lưu ký thế hệ mới loại bỏ hoàn toàn 12–24 từ khóa khôi phục (Seedless Solana Wallet) kết hợp cổng nạp tiền pháp định sang tiền mã hóa tức thì (Instant Fiat-to-Crypto Onramp). Hệ thống giải quyết triệt để rào cản trải nghiệm người dùng (UX Friction) của Web3 bằng cách kết hợp giữa ứng dụng Frontend (Next.js 16, React 18, TypeScript, TailwindCSS), công nghệ sinh trắc học Passkeys (chuẩn WebAuthn/FIDO2 tích hợp phần cứng Apple Secure Enclave / Android Keystore), cơ chế Trừu tượng hóa tài khoản Account Abstraction (LazorKit SDK & Smart Wallet PDA), kỹ thuật giải quyết lệch đường cong mật mã Curve Mismatch (secp256r1 vs Ed25519 qua SIMD-0075 precompile), cơ chế khóa phiên Session Keys cho phép giao dịch 1 chạm (1-Tap UX), bộ gom thanh khoản Jupiter Swap API V6, hạ tầng backend server (Express.js, Node.js, MongoDB) và nghiên cứu tích hợp Zero-Knowledge Proofs (ZKP2P / Circom) cho phép xác thực giao dịch chuyển khoản ngân hàng không cần niềm tin (Trustless Bank Onramp).

#### 2. Mục tiêu dự kiến
- **Hiểu rõ cơ cấu tổ chức & văn hóa doanh nghiệp:** Nắm bắt mô hình tổ chức, quy trình R&D sản phẩm Web3/Fintech, phân định chức năng giữa các phòng ban (Frontend, Blockchain/Smart Contract Dev, Backend, QA/QC, Product) tại Thien An Studio.
- **Nắm vững quy trình phát triển phần mềm chuyên nghiệp:** Thành thạo quy trình làm việc Agile/Scrum, kiểm soát phiên bản Git/GitHub flow, quản lý sprint backlog, áp dụng tiêu chuẩn Clean Architecture và lập trình an toàn trong môi trường phi tập trung.
- **Nghiên cứu & Làm chủ công nghệ lõi:**
  - *Passkeys & Mật mã Sinh trắc học (WebAuthn/FIDO2):* Nghiên cứu cơ chế tạo cặp khóa bất đối xứng trên đường cong `secp256r1` inside chip bảo mật phần cứng Secure Enclave, giải quyết vấn đề rò rỉ private key và loại bỏ hoàn toàn seed phrase.
  - *Curve Mismatch & SIMD-0075 Precompile:* Xây dựng giải pháp cầu nối mật mã giữa chuẩn `secp256r1` (Passkeys) và `Ed25519` (chuẩn gốc của Solana), ứng dụng SIMD-0075 precompile để xác thực chữ ký sinh trắc học trực tiếp trên on-chain chỉ tốn ~8,200 Compute Units (thay vì 800k+ CU).
  - *Account Abstraction & Gasless Paymaster (LazorKit SDK):* Thiết kế ví thông minh Smart Wallet PDA (Program Derived Address) và triển khai dịch vụ Paymaster tự động tài trợ phí gas (Lamports), giúp người dùng mới thực hiện giao dịch hoàn toàn miễn phí gas (Gasless UX).
  - *Session Keys Architecture:* Xây dựng cơ chế cấp phép khóa phiên tạm thời (Ephemeral Ed25519 Key) được giới hạn thời gian sống (TTL) và ngân sách giao dịch, giúp loại bỏ việc phải xác thực FaceID/TouchID liên tục cho từng thao tác vi mô.
  - *Instant Fiat-to-Crypto Onramp & VietQR Automation:* Triển khai cổng nạp tiền pháp định bằng mã VietQR tĩnh/động kết hợp tự động quét webhook và đối soát ngân hàng để mint/chuyển giao SPL tokens (SOL, USDC, BTC) về ví người dùng trong dưới 30 giây.
  - *Jupiter Swap API V6 Integration:* Tích hợp API bộ gom thanh khoản hàng đầu Solana để tính toán định tuyến thông minh (Smart Routing) và thực hiện hoán đổi token với độ trượt giá (slippage) tối thiểu.
  - *Nghiên cứu ZKP2P (Trustless Onramp R&D):* Khảo sát mạch ZK (Circom) và ZK-Regex xác minh chữ ký DKIM trong email xác nhận thanh toán ngân hàng nhằm bảo vệ quyền riêng tư người dùng tuyệt đối.
- **Phát triển kỹ năng mềm:** Nâng cao tư duy phản biện, kỹ năng phân tích thiết kế hệ thống phân tán, giải quyết sự cố mạng blockchain, làm việc nhóm và giao tiếp kỹ thuật.
- **Xây dựng báo cáo chi tiết:** Tổng hợp kết quả thực nghiệm, phân tích mã nguồn và xây dựng Báo cáo thực tập doanh nghiệp chỉn chu (phiên bản tiếng Việt và tiếng Anh).

#### 3. Kết quả đề tài
- **Hệ thống ứng dụng Ví & Onramp RampFi (Next.js 16, TypeScript, LazorKit SDK):** Hoàn thiện các module lõi (Passkey Registration/Login, Smart Wallet PDA Deployer, Session Key Manager, Gasless Paymaster integration, Jupiter Swap V6 interface, Instant VietQR Onramp, Device Import/Export QR Code) hoạt động mượt mà trên môi trường Solana Devnet.
- **Hệ thống Backend API & Database (Express.js, Node.js, MongoDB):** Server xử lý đối soát thanh toán VietQR tự động, nạp/rút tiền, cache tỷ giá crypto realtime, lưu trữ lịch sử giao dịch và quản lý telemetry logs theo thời gian thực.
- **Hạ tầng Blockchain & Paymaster Service:** Cấu hình thành công LazorKit RPC / Paymaster Url, kết nối Helius RPC Nodes và tích hợp hợp đồng thông minh Smart Wallet PDA tương thích hoàn toàn với Solana SIMD-0075.
- **Báo cáo thực tập doanh nghiệp:** Bản báo cáo đề cương chi tiết và bộ báo cáo thực tập tổng kết (tiếng Việt & tiếng Anh) phản ánh đầy đủ quá trình nghiên cứu, thiết kế kiến trúc (UML diagrams), cài đặt và thực nghiệm tại doanh nghiệp.

#### 4. Nội dung thực hiện
1. Tìm hiểu về doanh nghiệp Thien An Studio, định hướng nghiên cứu & phát triển sản phẩm Web3/Blockchain năm 2026.
2. Tiếp nhận dự án RampFi, khảo sát hiện trạng công nghệ ví điện tử Web3 và các thách thức kỹ thuật (Rào cản 12/24 từ seed phrase, rủi ro Curve Mismatch giữa secp256r1 và Ed25519, phí gas khởi tạo ví, độ trễ Onramp từ Fiat).
3. Lập kế hoạch phát triển theo từng giai đoạn (Phase 0: Môi trường & Solana/LazorKit Setup; Phase 1: Passkeys Auth & Smart Wallet PDA; Phase 2: Paymaster Gasless & Session Keys; Phase 3: Jupiter Swap & VietQR Onramp; Phase 4: ZKP2P R&D & Testing).
4. Cài đặt & cấu hình môi trường phát triển: Next.js 16, React 18, TypeScript, LazorKit SDK (`@lazorkit/wallet`), `@solana/web3.js`, Jupiter Aggregator V6, Express.js, MongoDB, TailwindCSS, HTTPS SSL Certs cho WebAuthn.
5. Thực thi lập trình các module lõi ví phi lưu ký và server backend đối soát.
6. Thực hiện kiểm thử toàn diện: Unit tests, đo đạc độ trễ RPC và thời gian phản hồi sinh trắc học, kiểm thử tính an toàn của Session Keys, thử nghiệm đồng bộ thiết bị qua QR Code.
7. Tổng hợp tài liệu, hoàn thiện báo cáo và bảo vệ đề cương/báo cáo thực tập.

---

### Kế hoạch thực hiện

| Thời gian | Nội dung thực hiện | Kết quả thực hiện |
| :--- | :--- | :--- |
| **Tuần 1** | **Giới thiệu & Khảo sát hệ thống:**<br>• Tổng quan về doanh nghiệp Thien An Studio, môi trường làm việc, quy trình phát triển sản phẩm Web3.<br>• Nghiên cứu kiến trúc tổng quan dự án RampFi (Frontend Next.js, Smart Wallet PDA, Backend Express/MongoDB, Solana RPC).<br>• Thực hiện Phase 0: Cấu hình môi trường phát triển (HTTPS certs cho WebAuthn local, LazorKit Devnet RPC, Express backend server). | • Nắm vững cơ cấu tổ chức và quy trình làm việc Agile/Scrum tại công ty.<br>• Thiết lập thành công môi trường phát triển full-stack (Next.js 16, TypeScript, Express, MongoDB, Solana Devnet).<br>• Khởi chạy hệ thống dev local mượt mà, sẵn sàng tích hợp các module mật mã. |
| **Tuần 2** | **Nghiên cứu Passkeys, Curve Mismatch & Smart Wallet PDA:**<br>• Phân tích rủi ro mất tài sản do Seed Phrase và rào cản Curve Mismatch (secp256r1 vs Ed25519) trên Solana.<br>• Tích hợp LazorKit SDK (`@lazorkit/wallet`) giao tiếp với WebAuthn API (FaceID/TouchID) tạo khóa trên Apple Secure Enclave / Android Keystore.<br>• Triển khai cơ chế tự động khởi tạo và ánh xạ ví thông minh Smart Wallet PDA từ Credential ID mà không cần nạp trước SOL. | • Đóng gói thành công module đăng ký/đăng nhập sinh trắc học bằng Passkeys loại bỏ hoàn toàn 12/24 từ seed phrase.<br>• Khởi tạo thành công Smart Wallet PDA on-chain bảo mật phần cứng.<br>• Xác thực chữ ký `secp256r1` trực tiếp qua SIMD-0075 precompile tối ưu chi phí Compute Units. |
| **Tuần 3** | **Phát triển Paymaster Gasless, Session Keys & VietQR Onramp:**<br>• Tích hợp LazorKit Paymaster tự động tài trợ phí gas (Lamports) cho người dùng mới.<br>• Triển khai bộ quản lý Session Keys (Ephemeral Ed25519 Key trong bộ nhớ) với quy tắc giới hạn TTL và Compute Budget, cho phép giao dịch 1-Tap UX.<br>• Xây dựng module Instant VietQR Onramp kết hợp Express.js backend tự động đối soát ngân hàng và phân phối SPL Tokens (SOL/USDC/BTC) về ví trong 30 giây.<br>• Tích hợp Jupiter Swap API V6 cho phép hoán đổi token tối ưu định tuyến. | • Thực thi giao dịch nạp tiền & chuyển token hoàn toàn miễn phí gas (Gasless UX).<br>• Hoàn thành Session Keys loại bỏ phiền hà quét FaceID liên tục khi giao dịch.<br>• Xây dựng thành công luồng mua crypto bằng VietQR tự động khớp lệnh và cấp phát token tức thì.<br>• Hoán đổi token tức thì qua Jupiter V6 với trượt giá tối thiểu. |
| **Tuần 4** | **Nghiên cứu ZKP2P, Thử nghiệm hệ thống & Hoàn thiện Báo cáo:**<br>• Khảo sát & R&D công nghệ ZKP2P (Circom & ZK-Regex) xác minh chữ ký DKIM trong email chuyển khoản ngân hàng không cần trung gian.<br>• Đánh giá tổng kết hệ thống (Stress test độ trễ RPC, đo đạc Compute Units, kiểm thử đồng bộ ví QR Code qua nhiều thiết bị).<br>• Hoàn thiện bản Báo cáo thực tập doanh nghiệp chi tiết (phiên bản tiếng Việt và tiếng Anh). | • Nắm vững nguyên lý ZKP2P áp dụng cho Trustless Fiat-to-Crypto Onramp.<br>• Hệ thống RampFi vận hành ổn định 100% trên Solana Devnet với tốc độ onboarding dưới 30 giây.<br>• Hoàn thành Báo cáo thực tập đầy đủ, nhận phản hồi và đánh giá cao từ Doanh nghiệp & GVHD. |

---

<br>

| Đà Nẵng, ngày 1 tháng 9 năm 2026<br>**Giảng viên hướng dẫn**<br>*(Ký và ghi rõ họ tên)* | Đà Nẵng, ngày 1 tháng 9 năm 2026<br>**Sinh viên thực hiện**<br>*(Ký và ghi rõ họ tên)* |
| :---: | :---: |
| <br><br><br>**PGS.TS NGUYỄN THANH BÌNH** | <br><br><br>**HỒ THANH HUY** |
