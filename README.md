# ดินแดนสวรรค์ · Sky Realm

MMORPG บนเว็บ ทำด้วย three.js (3D) และ JavaScript ล้วน ไม่ต้อง build

## รัน

```bash
npm start                       # node server.js → http://localhost:3000  (Node 18+, ไม่มี dependency)
npm test                        # unit test ของระบบความคืบหน้า (ไม่ต้องใช้เบราว์เซอร์)
```

ตอน deploy บน Vercel ไม่มี `server.js` เกมจะทำงานในโหมดออฟไลน์ (บันทึกในเบราว์เซอร์นั้น) ดูหัวข้อ Deploy ด้านล่าง

## ฟีเจอร์

- **ล่ามอนสเตอร์:** สไลม์ หมาป่าเงา โกเลมลาวา มีเลเวล HP ความเร็ว และ AI แบบ idle / chase / return / ตาย-เกิดใหม่
- **การเดิน:** ตัวละครและมอนสเตอร์หาเส้นทางอ้อมต้นไม้และกำแพงด้วย A* (`nav.js`) และคลิกพื้นเพื่อเดินไปยังจุดนั้น
- **ท่าโจมตี:** โจมตีปกติ (แกว่งอาวุธ), สกิล (ร่ายเวท), ฟื้นฟู (กางแขน) มีวงแหวนที่เท้าและประกายตอนโดน
- **ออโต้:** กด T หรือปุ่มออโต้ ตัวละครจะหาเป้า เดินไปหา โจมตีพื้นฐาน ใช้สกิลและยาเอง
- **EXP, เลเวล, ของตก:** ทุกการล่าแสดงการ์ดของที่ได้รับ (EXP, เหรียญ, ไอเท็มตามความหายาก)
- **เควส:** เรื่องหลัก "เจตนารมณ์แห่งสวรรค์" และเควสข้างอีก 2 เรื่อง คุยกับ NPC เพื่อรับและส่งภารกิจ
- **แมพ:** ดินแดนสวรรค์ (เมือง), ป่าวิญญาณ (เลเวล 1+), เหมืองลาวาร้อน (เลเวล 8+) เดินเข้าพอร์ทเพื่อย้ายแมพ
- **ร้านค้า:** พ่อค้าโคเบ ขายยาและอุปกรณ์ ไอเท็มสวมใส่ได้ (อาวุธ/เกราะ) ค่าพลังปรับตามอุปกรณ์
- **ตาย:** ฟื้นคืนชีพที่ดินแดนสวรรค์ด้วย HP 30%
- **บันทึก:** ความคืบหน้าบันทึกอัตโนมัติ ทั้งเลเวล ของ เควส และตำแหน่ง
- **Character Lab** (`character-lab.html`) และ **Skill Lab** (`skill-lab.html`): ออกแบบตัวละครและสกิล/เอฟเฟกต์ 3D

## ปุ่มลัด

| ปุ่ม | การทำงาน |
|------|-----------|
| WASD / ลูกศร | เดิน (คลิกพื้นหรือมอนสเตอร์เพื่อเดินไปหาได้เช่นกัน) |
| Space | โจมตีเป้าหมายที่ใกล้ที่สุด |
| 1-6 | ใช้สกิล (สกิลจะปลดล็อกตามเลเวล) |
| Q | ยาฟื้นพลัง |
| E | คุยกับ NPC ที่อยู่ใกล้ |
| T | เปิด/ปิดออโต้ |
| I / O / K / J / M / C | กระเป๋า / อุปกรณ์ / สกิล / ภารกิจ / แผนที่ / ตัวละคร |
| Enter | พิมพ์แชต |

## Deploy บน Vercel

โปรเจกต์นี้เป็น static site (`vercel.json` ตั้ง `outputDirectory` เป็น `public`):

- ไม่มี API ฝั่งเซิร์ฟเวอร์ เกมจึงใช้ **โหมดออฟไลน์** โดยเก็บบัญชี ตัวละคร และความคืบหน้าใน localStorage ของเบราว์เซอร์
- Google Login ใช้ไม่ได้ในโหมดนี้
- ถ้าต้องการบัญชีจริงที่ข้ามเครื่องได้ ต้องเพิ่ม API (Vercel Functions) และฐานข้อมูล

## ทดสอบ

- `npm test` รันการทดสอบหน่วย: การเดินหาเส้นทาง (nav), กฎความคืบหน้า: EXP และการเลื่อนเลเวล, เควสและการนับ, การซ่อมข้อมูลเซฟที่เสียหาย, ค่าพลังจากอุปกรณ์, การล็อกแมพ
- `tests/e2e.mjs` เล่นจริงในเบราว์เซอร์: สร้างตัวละคร, รับเควส, ย้ายแมพ, ออโต้ล่าจนได้ของและ EXP, เปิดกระเป๋า/ภารกิจ, บันทึกและโหลดกลับ, การล็อกเหมือง, การตาย
  - ตั้งค่าครั้งเดียว: `npm i -D playwright && npx playwright install chromium`
  - รัน: `npm start` ในอีกเทอร์มินัล แล้ว `BASE=http://localhost:3000 node tests/e2e.mjs`
  - ทดสอบกับ static site: `cd public && python3 -m http.server 8000` แล้ว `BASE=http://localhost:8000 node tests/e2e.mjs`

## โครงสร้าง

```
public/
  index.html, character-lab.html, skill-lab.html, css/style.css
  js/
    config.js      อาชีพ, ตัวเลือกหน้าตา, สกิล, เมนู HUD
    data.js        ไอเท็ม, มอนสเตอร์, แมพ, พอร์ท, NPC, เควส (ข้อมูลล้วน)
    progress.js    กฎความคืบหน้า (EXP, ของ, เควส, ค่าพลัง) ไม่มี DOM
    icons.js       ไอคอน SVG (ไม่ใช้ emoji)
    api.js         เรียก API หรือโหมดออฟไลน์
    game.js        ลูปเกม, การเดิน, การต่อสู้, ออโต้, แมพ, NPC, บันทึก
    nav.js         ชนกับสิ่งกีดขวาง และ A* (ไม่มี three.js ทดสอบได้ใน Node)
    monster.js     โมเดลมอนสเตอร์ 3D และ AI
    hud.js         HUD, หน้าต่าง, การแจ้งเตือน, มินิแมพ (แสดงผลจากสถานะเกม)
    town.js, field.js   สร้างแมพเมือง และแมพภาคสนาม
    character.js, designer.js, menu.js, portal.js, stage.js, effects.js, thumb.js
    screens.js     ลำดับหน้าจอ
server.js          API + static server (Node, ไม่มี dependency)
tests/             progress.test.mjs (unit) และ e2e.mjs (เบราว์เซอร์)
```

## ยังไม่ได้ทำ

- ผู้เล่นหลายคนในแมพเดียวกัน (WebSocket) ปาร์ตี้ และแชตรวม
- สัตว์เลี้ยง แฟชั่น กิจกรรม และตลาดผู้เล่น
- มอนสเตอร์บอส, ดันเจียน, สกิลระดับสูงกว่า Lv 8
- บัญชีจริงบน Vercel (ดูหัวข้อ Deploy)

## Servers and admin panel

- Each server is a separate world. A new install starts with one server (`เซิร์ฟเวอร์ 1`). Characters belong to a server, and the character select screen has a server picker.
- Open a server, then open more as players grow. Servers can be set to **open**, **maintenance** (no new characters) or **closed**, and when population is low, one server can be merged into another (all its characters move, then it is removed).
- The admin panel is at `/admin.html`. It needs `ADMIN_TOKEN` in the environment; without it the admin API refuses every request. The panel can create, rename, change status, merge and delete servers; search characters, add gold or items, grant VIP for days, or delete a character; and publish announcements (to all servers or one) that show on the character select screen.
- VIP is decided by the server. The game client cannot switch it on. Note that gold and items are still saved from the client, so server-side checks for those are not in place yet.

```bash
ADMIN_TOKEN=change-me node server.js
```

The static build on Vercel has no server, so it runs one local world and no admin panel.

## Game settings from the admin panel

`/admin.html` has a **ตั้งค่าเกม** section. Every monster, map, dungeon, quest, NPC, class basics, the tower, and the global rates can be edited there as JSON.

- Saved values are stored on the server and applied when a player loads the game; defaults live in `public/js/data.js` and `public/js/config.js`.
- The server checks the shape against the default (a number stays a number, no unknown fields) and checks that quests, maps and dungeons only reference monsters, NPCs and items that exist.
- "คืนค่าเดิม" removes the override and returns the shipped value.
