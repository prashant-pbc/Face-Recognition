# AEGIS Live Face Gate — Desi Style Complete Tutorial

Bhai, yeh app attendance system nahi hai.
Yeh simple baat hai: **camera ke saamne asli insaan hai ya photo/phone video hai**, aur agar asli insaan enrolled hai to uski details dikhao.

Socho gate pe security wala khada hai. Photo dikhane se andar nahi milta. Khud aana padta hai.

---

## 1) App kya karti hai, 2 line mein

1. **Admin** laptop camera se live person ko database mein daalta hai.
2. **Recognition** screen pe agar wahi asli insaan camera ke saamne aaye, naam/ID dikhta hai. Photo, print, ya phone pe video chalane se reject.

Data kahan jaata hai? Koi MySQL/Postgres nahi.
Sirf local file: `backend/data/sqlite3.db`

---

## 2) Pehle laptop pe kya chahiye

- **Python 3.11** (3.15 mat use karna, OpenCV toot jaayega)
- **Node.js + npm**
- Webcam
- Windows ho to project folder mein double-click: `start.bat`

`start.bat` kya karta hai:

1. `backend\.venv` naam ka alag Python environment banata hai
2. Usme FastAPI, OpenCV, onnxruntime install karta hai
3. Face models download karta hai
4. Frontend `npm install` karta hai (pehli baar)
5. Backend start: `http://127.0.0.1:8000`
6. UI start: `http://localhost:5173`

Linux/Mac pe same kaam: `bash start.sh`

Browser kholo: `http://localhost:5173`
Camera permission **Allow** karna. Bina camera ke yeh app andhi hai.

---

## 3) Do screens, do kaam

Upar navbar mein do buttons:

| Button | Kaun use kare | Kya hota hai |
|---|---|---|
| **Recognition** | Koi bhi | Live match. Login nahi chahiye |
| **Admin** | Sirf admin | Login ke baad naya person enroll |

Default password:

- Username: `admin`
- Password: `liveface-admin`

Admin ke bina koi naya chehra database mein nahi jaata. Recognition public hai, enroll private hai. Yeh jaan-bujh ke hai.

---

## 4) Pehli baar person kaise add karo

1. **Admin** dabao
2. Login karo
3. Right side pe **Full name** aur **Person ID** bharo
   - Example: Name `Aisha Khan`, ID `STU-1042`
   - ID unique hona chahiye. Same ID dobara nahi chalega
4. **Start live capture**
5. Camera mein ek second seedha dekho (calibration)
6. **Ek baar blink** karo — aankh band, phir kholo
7. App khud 2 frames pakadti hai aur `sqlite3.db` mein save karti hai

HUD pe yeh dekhna:

- `look at the camera` = abhi baseline le raha hai, 1 second wait
- `1 live face` = ready
- `blink…` = aankh band detect hui
- `blinks 1` = ho gaya, save start

Agar **Retry save** aaye, neeche red message padho. Ab 500 ki jagah asli reason dikhega, jaise:

- `Live face required (no_face)` — face frame se bahar
- `A person with this ID already exists` — ID pehle se hai
- `Need at least 2 live frames` — capture adhoora

---

## 5) Recognition kaise chalti hai

1. **Recognition** page kholo
2. Enrolled person camera ke saamne aaye
3. Prompt follow karo: **Blink once**
4. Auto on ho to blink ke baad scan khud chalta hai
5. Result:

| Result | Matlab |
|---|---|
| **Live match** | Asli insaan + database mein mila. Naam, ID, notes, thumbnail |
| **Not in sqlite3.db** | Asli insaan hai, lekin enroll nahi hua |
| **Not a live person** | Photo, screen, video, ya challenge fail |

Yahan trick yeh hai: pehle **liveness**, phir **match**.
Photo dikhane pe match try bhi nahi hota. Pehle hi reject.

---

## 6) Asli chehra vs photo — yeh 3 darwaze hain

Har scan pe yeh teen checks hote hain. Ek bhi fail = bahar.

### A. Camera wali liveness (browser, MediaPipe)

Webcam se landmarks nikalte hain.

- Blink: aankh band hui, phir khuli. Still photo nahi blink karti.
- Head turn (backup challenge): head left/right hila.
- Flat/screen hint: phone screen aksar “flat” dikhti hai.

Pehle 18 frames se **baseline** banti hai: teri normal open-eye size.
Isliye start pe 1 second seedha dekho. Warna “eyes closed” galat fire hota tha. Woh bug fix ho chuka hai.

### B. Quality (backend)

- Face dikhna chahiye
- Ek hi face
- Size chhota nahi
- Blur nahi
- Edge pe chipka hua nahi

### C. Anti-spoof model

Face crop pe MiniFASNet / texture check.
Print photo aur phone screen ko “fake” score milta hai.

**Limit samajh lo:** bahut mehnga replay attack (high quality video + perfect lighting) 100% block nahi. Student project ke liye blink + spoof + quality kaafi hai.

---

## 7) Chehra database mein kaise save hota hai

Bahut log sochte hain video store hoti hai. **Nahi.**

Flow:

```text
Webcam frame
   -> YuNet: face box nikaalo
   -> SFace: face align karo
   -> 128 numbers ka vector banao (embedding)
   -> vector ko normalize karo
   -> sqlite3.db ke embeddings table mein bytes ki tarah rakh do
```

Tables `backend/data/sqlite3.db` ke andar:

- `people` — name, person_id, notes, thumbnail path
- `embeddings` — har person ke 2 vectors (2 live frames)
- `admins` / `admin_sessions` — login
- `scan_events` — match/reject/unknown/enroll log

Thumbnail alag file: `backend/data/thumbs/1.jpg`
Yeh sirf UI ke liye chhoti photo hai, matching isse nahi hoti.

Matching isse hoti hai:

```text
naya vector  ·  stored vector   =  cosine similarity
agar score >= 0.38  ->  yahi aadmi hai
warna            ->  unknown
```

Same person: 0.5 se 0.9
Dusra person: kam
Threshold `MATCH_THRESHOLD = 0.38` file `backend/app/config.py` mein hai.

---

## 8) Folder map — kaun si file kya karti hai

```text
start.bat / start.sh     Windows/Linux start
frontend/                React UI (Vite, port 5173)
  src/App.jsx            Recognition vs Admin
  src/Login.jsx          Admin login
  src/Admin.jsx          Enroll + registry + scan log
  src/Recognize.jsx      Live match screen
  src/liveness.js        Blink / head-turn
  src/useCamera.js       Webcam + MediaPipe loop
backend/
  .venv/                 Python environment (Windows script yahi banata hai)
  data/sqlite3.db        Saari records
  models/                YuNet + SFace onnx
  app/main.py            APIs
  app/face_engine.py     Detect + embedding
  app/anti_spoof.py      Photo/screen reject
  app/auth.py            Admin token
  app/liveness.py        Server-side challenge check
```

Frontend camera chalata hai. Backend dimaag hai: spoof, embedding, SQLite.

API prefix `/api` Vite proxy se backend 8000 pe jaata hai. Isliye browser ko sirf 5173 kholna hai.

---

## 9) Request ka pura safar (ek enroll)

1. Admin login -> `POST /api/auth/login` -> token milta hai
2. Token browser `localStorage` mein `liveface_admin_token`
3. Blink complete -> 2 JPEG frames (base64)
4. `POST /api/enroll` with name, ID, images, blink signals
5. Backend:
   - token check
   - pehle frame pe blink verify
   - har frame pe face + spoof
   - embedding nikaalo
   - `people` + `embeddings` insert
6. UI pe naam list mein aa jaata hai

Recognition almost same, bas API `POST /api/analyze` hai, login nahi.

---

## 10) Demo script (project dikhana ho to)

1. Admin: khud ko enroll karo, blink karke save.
2. Recognition: khud aao -> **Live match**
3. Phone pe apni photo dikhao -> **Not a live person**
4. Printout dikhao -> reject
5. Koi dusra aadmi aaye jo enroll nahi -> **Not in sqlite3.db**

Yahi 4 scenes examiner ko samajh aa jaate hain.

---

## 11) Common dukh-dard

**Blink count nahi badhta**
Refresh karo. 1 second camera dekho, phir slowly blink. Jaldi se palak nahi, band-khol.

**Turn left pe kuch nahi hota**
Ab default challenge blink hai. Head-turn code pada hai, pehle use nahi ho raha taaki enroll atke nahi.

**Internal Server Error / Retry save**
Purana bug tha: SQLite timezone vs Python timezone. Fix ho chuka. Refresh + dubara login.

**Python 3.15**
Mat. 3.11 use karo. `start.bat` venv `backend\.venv` mein banata hai.

**Camera nahi khulti**
HTTPS/localhost chahiye. Doosri app webcam pakde hue to band karo. Browser permission check karo.

**Match nahi ho raha enrolled hone ke baad**
Lighting same rakho. Bahut door mat khade. Pehle Recognition pe blink complete hone do. Threshold 0.38 hai, bohot dark/side face pe fail ho sakta hai.

**ID already exists**
Woh person pehle se `sqlite3.db` mein hai. Admin list se Remove, ya naya ID do.

---

## 12) Security, seedha-seedha

- Admin password code mein default hai: demo ke liye. Real use mein badalna.
- Face vector reverse karke original photo nahi banti, lekin biometric data hai. File ko sambhaal ke rakhna.
- Attendance, GPS, cloud face API, phone app — v1 mein nahi.

---

## 13) 30-second revision

App = **darwaza**.
Admin = **register**.
Recognition = **check**.
SQLite = **register ki copy**.
Blink = **tu photo nahi, tu zinda hai**.
Embedding = **chehre ka mathematical fingerprint**.
Match = **do fingerprints kitna milte hain**.

Bas. Camera ke saamne aao, blink karo, andar naam aa jaaye. Photo se nahi.
