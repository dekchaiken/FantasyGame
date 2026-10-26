# ดินแดนสวรรค์ · Sky Realm

เกม MMORPG บนเว็บ ทำด้วย three.js (3D) และ vanilla JS ไม่ต้อง build

## รันบนเครื่อง

```bash
node server.js                  # http://localhost:3000  (ต้องใช้ Node 18+)
PORT=8080 node server.js        # เปลี่ยนพอร์ต
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com node server.js   # เปิด Google Login
```

`server.js` ให้บริการหน้าเว็บ และ API บัญชี/ตัวละคร/สกิล ข้อมูลเก็บที่ `data/db.json` (ไม่ถูก commit)

## Deploy บน Vercel

โปรเจกต์นี้เป็น static site (`vercel.json` ตั้ง `outputDirectory` เป็น `public`) เมื่อ deploy บน Vercel:

- ไม่มี `server.js` จึงไม่มี API ฝั่งเซิร์ฟเวอร์ เกมจะสลับเป็น **โหมดออฟไลน์** อัตโนมัติ โดยเก็บบัญชีและตัวละครใน localStorage ของเบราว์เซอร์นั้น
- Google Login ใช้ไม่ได้ในโหมดนี้ เพราะต้องมีเซิร์ฟเวอร์ตรวจ token
- ถ้าต้องการบัญชีจริงที่ข้ามเครื่องได้ ต้องเพิ่ม API (Vercel Functions) และฐานข้อมูล เช่น Vercel Postgres/KV หรือ Supabase

## หน้าในเกม

| หน้า | ไฟล์ | สิ่งที่มี |
|------|------|-----------|
| Splash | `index.html` (`#splash`) | โลโก้และแถบโหลด |
| Login | `js/screens.js` | ฉาก 3D ของเกาะ, Guest, Google (ถ้าตั้งค่า) |
| เลือกตัวละคร | `js/screens.js` | ตัวละคร 3D ด้านซ้าย, การ์ดตัวละครด้านขวา (สูงสุด 3 ตัว) |
| สร้างตัวละคร | `js/designer.js` | เพศ, อาชีพ, ทรงผม, หน้า, ผิว, เสื้อ, กางเกง, รองเท้า, เสริม, สุ่ม |
| Loading เข้าโลก | `js/portal.js` | ตัวละครลอยขึ้นจากประตูมิติ |
| โลก "ดินแดนสวรรค์" | `js/town.js`, `js/game.js` | เกาะ 3D, เดิน WASD/ลูกศร/คลิกพื้น, กล้องตาม, HUD, สกิล 1-6 |
| Character Lab | `character-lab.html` | ออกแบบตัวละครโดยไม่ต้องล็อกอิน คัดลอกผลเป็น JSON |
| Skill Lab | `skill-lab.html` | ออกแบบสกิลและเอฟเฟกต์ 3D พร้อมพรีวิวสด |

## โครงสร้าง

```
public/
  index.html            หน้าหลัก (ทุก screen อยู่ในไฟล์นี้)
  character-lab.html    เว็บออกแบบตัวละคร
  skill-lab.html        เว็บออกแบบสกิล
  css/style.css
  js/
    config.js           อาชีพ, ตัวเลือกหน้าตา, สกิลเริ่มต้น, เมนู HUD
    api.js              เรียก API หรือใช้โหมดออฟไลน์
    character.js        สร้างตัวละคร 3D จาก appearance
    thumb.js            เรนเดอร์ตัวละครเป็นรูป (การ์ดและรูปโปรไฟล์)
    town.js             สร้างแมพ "ดินแดนสวรรค์"
    effects.js          เอฟเฟกต์สกิล 3D (burst, nova, slash, projectile, beam, heal)
    stage.js            canvas 3D เต็มจอที่อยู่ด้านหลัง UI
    menu.js             ฉากเมนู (login, เลือกตัวละคร, สร้างตัวละคร)
    designer.js         แผงออกแบบตัวละคร (ใช้ร่วมกันในเกมและ Character Lab)
    game.js             โลกในเกม, สกิล, หุ่นฝึก, HUD
    portal.js           อนิเมชันเข้าโลก
    screens.js          ลำดับหน้าจอทั้งหมด
    skill-lab.js, character-lab.js
  vendor/three/         three.js 0.160.0 (build/three.module.js, addons/RoundedBoxGeometry.js)
server.js               API + static server (Node, ไม่มี dependency)
```

## Appearance (ค่าที่บันทึกต่อ 1 ตัวละคร)

- `hairStyle` 0-5, `hair` สี, `faceStyle` 0-3, `eyeColor` สี, `skin` สี
- `top` / `bottom` / `shoes`: `{ style, color }` (กระโปรงเลือกได้เฉพาะเพศหญิง)
- `accessory` 0-3

`server.js` (`sanitizeAppearance`) และ `js/config.js` ต้องตรงกันเสมอ

## ยังไม่ได้ทำ

- ผู้เล่นหลายคนในแมพเดียวกัน (WebSocket), ปาร์ตี้, แชตรวม
- ระบบอุปกรณ์, สัตว์เลี้ยง, แฟชั่น, ร้านค้า และกิจกรรม (ตอนนี้เป็นหน้าว่าง)
- มอนสเตอร์ที่มี AI, เลเวล, ดรอป (ตอนนี้มีแค่หุ่นฝึก)
- บัญชีจริงบน Vercel (ดูหัวข้อ Deploy)
