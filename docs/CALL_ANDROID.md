# Gọi (Agora) trên Android — hướng dẫn test & hạn chế

## Không dùng Expo Go cho gọi thật

- `react-native-agora` là **native module**. Trên **Expo Go** mặc định **không** tải được module này; màn `/call` sẽ hiển thị thông báo thay vì kết nối RTC.
- Cách hợp lệ: **development build** (`npx expo prebuild` rồi `npx expo run:android`) hoặc **EAS** (`development` / `preview` / `production` APK).

## Cấu hình backend khi test máy thật (LAN)

- Backend nên lắng nghe trên tất cả interface (`0.0.0.0`) theo tài liệu dự án.
- Trên điện thoại thật, dùng **IP LAN máy chạy backend** (ví dụ `http://192.168.1.10:3000`), **không** dùng `localhost` / `10.0.2.2` (chỉ phù hợp emulator).
- Tạo file `.env` trong `mobile/` từ `.env.example` (hoặc thiết lập biến khi build EAS):

  - `EXPO_PUBLIC_API_BASE_URL` — URL API có `/api/v1` nếu ứng dụng dùng prefix đó theo `src/config/env.ts`
  - `EXPO_PUBLIC_SOCKET_URL` — origin Socket.IO (cùng host:port hợp lệ từ điện thoại tới server)
  - `EXPO_PUBLIC_AGORA_APP_ID` — App ID Agora (có thể thống nhất với `extra` trong build)

- Điện thoại và PC phải cùng mạng nếu không cấu hình VPN / tunneling.

## Share màn hình (Android)

- Cần **bản build có native**; đã khai báo quyền/foreground service trong cấu hình Expo; sau khi đổi native, chạy lại **prebuild** hoặc build EAS.
- Kiểm tra trên thiết bị thật: bật “Share màn hình” trong màn hình gọi, bên còn lại thấy nguồn video từ màn hình.

## Checklist kiểm thử tối thiểu (LAN)

- [ ] Gọi 1-1: âm thanh, bật/tắt mic
- [ ] Gọi 1-1: video, bật/tắt camera
- [ ] Nhóm: ít nhất 3 thiên, ai vào sau vẫn thấy/kết nối (late join)
- [ ] Tắt / mở camera, mic từng bên; kết thúc cuộc; rời nhóm
- [ ] **Một thiết bị Android** share màn hình, ít nhất **một người** xem được
- [ ] Lỗi thường gặp: token hết hạn, sai URL API/socket, firewall chặn port trên PC

## Troubleshooting nhanh

- **Không join được / lỗi Agora:** kiểm tra App ID, token từ `GET /agora/rtc-token`, channel name khớp tín hiệu socket, và thời gian đồng bộ thiết bị (NTP).
- **Socket không kết nối:** trùng `EXPO_PUBLIC_SOCKET_URL`, HTTPS/WSS nếu server bắt buộc TLS, và cùng WiFi với PC.
