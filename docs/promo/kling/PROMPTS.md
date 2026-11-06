# Video giới thiệu English Street: ảnh và prompt cho Kling

10 ảnh trong thư mục này là ảnh chụp thật từ game (1600×900, tỉ lệ 16:9, góc nhìn ngang).
Prompt viết bằng tiếng Anh vì Kling hiểu tiếng Anh tốt nhất.

Có 2 cách làm. Chọn một.

---

## Cách A: một video duy nhất 30 giây (Kling 4.0, keyframe)

Vào **Image to Video**, chọn model **Kling 4.0**, rồi điền như sau:
- First frame: `01-bridge.png`
- Keyframes: lần lượt 02 → 09
- Tail frame (khung cuối): `10-street-night.png`
- Thời lượng: 30 giây. Độ phân giải: 720p, hoặc 1080p nếu gói cho phép.

**Ước tính:** khoảng 150–450 credit (5–15 credit/giây). Trước khi bấm Generate, xem số credit Kling hiện trên nút.

Prompt:

```
A cheerful promo for a cosy low-poly 3D multiplayer game world, bright cartoon style, smooth flat colours,
chibi characters with big round heads. The camera glides continuously like a drone through one connected town:
starting on a wooden footbridge over a sparkling blue river with ducks swimming and weeping willows on the bank,
rising over a busy main street of colourful shops where friendly shopkeepers wave from their doorways,
through the gate of Sunny Hills Zoo past a kangaroo hopping and a crocodile sliding into its pond,
into Green Valley Farm where cows and a horse trot in their pen and a farmer smiles at his market stall,
past the purple Star Cinema with its glowing marquee, the blue Maple School gate and a playground,
along supermarket aisles, and finally the main street at night with warm windows and glowing street lamps.
The small chibi kid in a blue T-shirt walks through every scene. Gentle smooth camera moves,
soft daylight turning into evening, happy and welcoming mood.
Keep the exact low-poly game art style, the same buildings, signs and characters. No realistic humans,
no new text, no logos, no flicker, no warping of buildings.
```

---

## Cách B: 10 clip ngắn rồi ghép lại

Mỗi ảnh tạo 1 clip **Image to Video**, dài 5 giây, 720p. Model đề xuất: **Kling 3.0 Turbo** (rẻ và ổn với 1 ảnh).
Thêm câu dưới đây vào cuối **mọi** prompt để giữ đúng phong cách game:

```
Keep the exact low-poly cartoon game art style, flat colours and chibi characters. No realistic humans,
no new text or logos, no warping, no flicker.
```

**Ước tính:** khoảng 15–40 credit/clip, tức 150–400 credit cho 10 clip. Vẫn nên xem số credit trên nút Generate trước khi bấm.
Muốn tiết kiệm thì chỉ làm 5 clip quan trọng: 01, 02, 04, 05, 10.

| Ảnh | Prompt |
|---|---|
| `01-bridge.png` | Slow drone push-in along the wooden footbridge. The river ripples and sparkles, two ducks paddle across, willow branches sway in the breeze. The chibi kid walks forward across the bridge towards the town. |
| `02-main-street.png` | Camera slowly trucks right along the main street. The chibi kid walks towards the road, shopkeepers in the doorways wave, a small white cat trots along the pavement, trees sway gently. |
| `03-zoo-gate.png` | Camera pushes forward through the orange "Sunny Hills Zoo" gate. The chibi kid walks in, the zookeeper in a sun hat waves from the hut at the back, animals move in their pens. |
| `04-zoo-inside.png` | The kangaroo hops in its pen, the crocodile slides into the blue pond, a penguin waddles in the foreground. The chibi kid looks left and right, excited. Slow gentle orbit to the right. |
| `05-farm-animals.png` | Cows, a brown horse and a donkey trot and graze inside the wooden pen. A fluffy sheep wanders in the foreground. The chibi kid leans on the fence watching. Slow push-in. |
| `06-farm-market.png` | The blond farmer at the red-and-white "Farm Market" stall arranges vegetables and turns to greet the chibi kid walking up. The big red barn and windmill in the background, windmill blades turning. |
| `07-cinema.png` | The marquee lights of "Now Showing" twinkle on and off. The chibi kid walks along the red carpet towards the cinema door. Slow push-in, warm magical mood. |
| `08-school.png` | The chibi kid walks through the blue "Maple School" gate. Swings sway gently in the playground on the right, a basketball bounces on the court. Camera follows from behind. |
| `09-supermarket.png` | The chibi kid walks down the supermarket aisle between shelves of colourful products, turning his head to look at the shelves. Smooth camera follows at the same height. |
| `10-street-night.png` | Night on the main street: warm window lights flicker on one by one, street lamps glow, a cyclist rides past, fireflies drift above the grass. Slow pull-back and rise, calm and cosy ending. |

Thứ tự ghép đề xuất: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10.
Có thể thêm chữ ở cuối video bằng CapCut. Nên thêm chữ ở bước ghép vì Kling hay làm méo chữ.

---

## Ghi chú

- Ảnh 03–09 có nhân vật nhìn từ phía sau. Prompt để nhân vật đi về phía trước, vì quay mặt lại thì Kling dễ vẽ sai khuôn mặt.
- Ảnh 01 và 02 có bảng tên "Mai" trên đầu nhân vật. Nếu Kling làm méo chữ này, thêm câu `the floating name label stays sharp and unchanged` vào prompt.
- Nếu cần nhạc nền, bật audio của Kling hoặc ghép nhạc ở bước dựng. Gợi ý: `upbeat cheerful ukulele and glockenspiel, light and playful`.
