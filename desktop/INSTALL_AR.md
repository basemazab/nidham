# دليل بناء Nidham Desktop وتركيبه على أجهزة الـ HR

## 🎯 الفكرة في 30 ثانية

بدل ما كل HR يفتح المتصفح ويكتب رابط نِظام كل مرة، نديهم **برنامج**:
- Icon على الـ Desktop
- يفتح زي Outlook بضغطة واحدة
- أول مرة بس بيسأل "إيه سيرفر شركتك؟"
- بعد كده يفتح على Dashboard مباشرة

البرنامج بياخد ملف واحد: **`Nidham-1.0.0 Setup.exe`** (~ 80 MB) ينقّل لـ HR على USB أو مشاركة Network.

---

## 📋 المتطلبات للبناء (مرة واحدة بس)

| البرنامج | الإصدار |
|---|---|
| Windows 10/11 | — |
| Node.js | 20 LTS أو أحدث |
| npm | (بييجي مع Node) |

> 💡 الـ build بيتعمل على جهاز واحد (جهازك). الـ HR machines لا يحتاجون أي حاجة من ده.

---

## 🛠 خطوات البناء

### 1. ادخل لمجلد desktop

افتح PowerShell:

```powershell
cd C:\Users\hr2\projects\nidham\desktop
```

### 2. حمّل الـ dependencies

```powershell
npm install
```

⏱ بياخد **~ 3 دقايق** أول مرة (بينزّل Electron + electron-forge).

### 3. (اختياري) ضع شعار Nidham

اقرا `assets/README.md` — محتاج تحط ملفين:
- `assets/icon.png` (512×512)
- `assets/icon.ico` (multi-resolution)

لو ما عملتش ده، البرنامج هيشتغل لكن بأيقونة Electron الافتراضية.

### 4. ابني الـ Installer

```powershell
npm run make
```

⏱ بياخد **~ 5 دقايق**. النتيجة هتلاقيها في:

```
desktop\out\make\squirrel.windows\x64\
└── Nidham-1.0.0 Setup.exe   ← ده الملف اللي تنقّله لـ HR
```

---

## 📦 توزيع البرنامج على HR

### الطريقة 1 — USB / Network Share

1. انسخ `Nidham-1.0.0 Setup.exe` على USB أو فولدر مشترك.
2. على كل جهاز HR:
   - Double-click الـ `Setup.exe`
   - **مهم**: لو ظهر "Windows protected your PC" → اضغط **More info** → **Run anyway**
     (ده طبيعي لأن البرنامج مش signed بـ Microsoft cert. مش هيظهر للـ HR لو اشتركت في code-signing certificate لاحقًا.)
   - التركيب بياخد 30 ثانية
   - البرنامج يفتح لوحده

### الطريقة 2 — رفع على Google Drive / OneDrive

ارفع الـ Setup.exe على Drive وابعت اللينك لـ HR.

---

## 🖱 تجربة HR لأول مرة

1. ضغط على **Nidham** على الـ Desktop (icon أزرق فيه "ن")
2. ظهر له شاشة فيها سؤال: **"رابط السيرفر؟"**
3. كتب الـ URL اللي انت إديته له:
   - **لو على سيرفر داخلي**: `http://192.168.1.10:3001`
   - **لو على الـ Cloud**: `https://nidhamhr.com`
4. ضغط **"اختبر الاتصال"** — لازم تظهر علامة ✓
5. ضغط **"احفظ وادخل"**
6. البرنامج فتح على صفحة تسجيل الدخول لنِظام
7. سجّل دخوله بحسابه (نفس الـ email/password)

من هنا ورايح، كل مرة يفتح البرنامج يدخل على Dashboard مباشرة بدون أي خطوات.

---

## 🔄 إصدار جديد لاحقًا

لما تغيّر حاجة في Nidham وعايز تطلق نسخة جديدة من الـ Desktop:

1. عدّل `desktop/package.json` → غيّر `"version": "1.0.0"` لـ `"1.1.0"`.
2. شغّل `npm run make` تاني.
3. وزّع الـ Setup.exe الجديد على HR.

في المستقبل، لما نفعّل **Auto-Update** (Phase 2)، الـ HR هياخد التحديثات تلقائيًا بدون ما توزّع ملف يدوي.

---

## 🆘 مشاكل شائعة

### "npm not recognized"
Node مش مركّب. حمّل من <https://nodejs.org/>.

### "npm install" بطيء أو متجمّد
امسح `node_modules` و `.vite` و `out` وحاول تاني:
```powershell
Remove-Item -Recurse -Force node_modules,.vite,out
npm install
```

### "Cannot find module 'electron'" أثناء البناء
شغّل `npm install` تاني — معناه الـ dependencies مش كاملة.

### الـ Setup.exe بيقول "ESRP failed" أو "package error"
عادةً مشاكل قرص الـ build. تأكد إن عندك على الأقل 2 GB متاحة.

---

## 📞 الدعم

تواصل: <https://wa.me/201055356622>
