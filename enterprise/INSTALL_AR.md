# دليل تثبيت نِظام Enterprise Edition

> النسخة المؤسسية — كل البيانات على سيرفر شركتك، بدون الحاجة لخدمة سحابية.

---

## 📋 المتطلبات

قبل ما تبدأ، اتأكد إن السيرفر اللي هتركب عليه فيه:

| البرنامج | الإصدار الأدنى | لينك التحميل |
|---|---|---|
| **Windows** | 10/11 Pro أو Windows Server 2019+ | — |
| **Docker Desktop** | 4.20+ | <https://www.docker.com/products/docker-desktop> |
| **Node.js** | 18+ | <https://nodejs.org> |
| **RAM** | 8 GB كحد أدنى (16 GB يُفضل) | — |
| **Disk** | 20 GB متاحة | — |
| **CPU** | 4 cores | — |

> 💡 **ليه Docker؟** بيخلي التركيب على أي ويندوز نفس الخطوات بالظبط، وبيعزل النظام عن باقي البرامج. تركيب مرة واحدة وخلاص.

---

## 🚀 خطوات التركيب (15 دقيقة)

### الخطوة 1 — تركيب Docker Desktop

1. حمّل من اللينك فوق وثبّت **بصلاحيات Administrator**.
2. شغّل Docker Desktop وستنّاه يفتح بالكامل (Icon أخضر في الـ tray).
3. تأكد إنه شغّال:
   ```powershell
   docker --version
   docker compose version
   ```

### الخطوة 2 — تركيب Node.js

1. حمّل Node 20 LTS من <https://nodejs.org>.
2. التركيب الافتراضي تمام، اضغط Next على كل شاشة.
3. تأكد:
   ```powershell
   node --version
   ```

### الخطوة 3 — نسخ ملفات نِظام Enterprise

استلمت الملفات من الموزّع (USB أو لينك):

```
nidham-enterprise/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── kong/kong.yml
├── migrations/  (14 ملف SQL)
└── scripts/
    ├── install.ps1
    ├── start.ps1
    ├── stop.ps1
    ├── backup.ps1
    ├── restore.ps1
    ├── apply-migrations.ps1
    └── generate-keys.mjs
```

انسخ الفولدر ده على القرص الصلب للسيرفر، مثلًا في `C:\nidham`.

### الخطوة 4 — تعديل ملف الإعدادات

افتح `C:\nidham\.env.example` بـ Notepad واحفظه باسم **`.env`** (بدون امتداد).

عدّل القيم دي:

```ini
# IP السيرفر — لازم يبقى static علشان الأجهزة التانية تتصل عليه
SITE_URL=http://192.168.1.10:8000

# مفتاح Gemini AI (من https://aistudio.google.com/apikey)
GEMINI_API_KEY=ضع_مفتاحك_هنا

# لو هتفعّل تأكيد الإيميل بريد (اختياري)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

> ⚠️ **مهم:** غيّر `192.168.1.10` لـ IP السيرفر الفعلي في شبكتك.
> لمعرفة الـ IP: في PowerShell شغّل `ipconfig` وشوف "IPv4 Address" لكارت الشبكة المتصل.

### الخطوة 5 — تشغيل سكريبت التركيب

فتح PowerShell **as Administrator** وادخل لمجلد nidham:

```powershell
cd C:\nidham
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

السكريبت هيعمل:
1. ✅ يتأكد إن Docker شغّال
2. ✅ يولّد مفاتيح JWT آمنة
3. ✅ يبني الـ Docker images
4. ✅ يشغّل كل الخدمات
5. ✅ يطبّق الـ 14 migration على قاعدة البيانات
6. ✅ يطبع لك العناوين

**أول مرة بياخد من 5 لـ 10 دقايق** عشان بيحمّل الصور (~2 GB).

---

## ✅ اتأكد إن التركيب نجح

افتح المتصفح على:
- **http://localhost:3000** — لازم تشوف صفحة تسجيل الدخول
- **http://localhost:8000/rest/v1/** — لازم ترجع JSON صغير (الـ API شغّال)

سجل **أول مستخدم** بـ Sign Up — هيتعمل تلقائيًا كـ Admin للشركة.

---

## 🌐 إعداد الوصول من أجهزة الـ HR التانية

دلوقتي السيرفر شغّال على الجهاز ده فقط. عشان باقي HR في الشركة يدخلوا:

### 1. فتح Firewall على السيرفر

في PowerShell كـ Admin:

```powershell
New-NetFirewallRule -DisplayName "Nidham App"  -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "Nidham API"  -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

### 2. على باقي الأجهزة

افتحوا المتصفح على:
```
http://192.168.1.10:3000
```
(غيّر `192.168.1.10` لـ IP السيرفر بتاعك)

---

## 💾 النسخ الاحتياطي اليومي (مهم جدًا!)

### أنشئ Task ينسخ احتياطي تلقائيًا

في PowerShell كـ Admin:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\nidham\scripts\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "03:00"
Register-ScheduledTask -TaskName "Nidham Daily Backup" `
  -Action $action -Trigger $trigger -RunLevel Highest
```

هيشتغل كل يوم الساعة 3 صباحًا. النسخ تتحفظ في `C:\nidham\backups\` ويحتفظ بآخر 30 يوم.

### نسخة احتياطية يدوية الآن

```powershell
powershell C:\nidham\scripts\backup.ps1
```

### استعادة من نسخة احتياطية

```powershell
powershell C:\nidham\scripts\restore.ps1 -BackupFile C:\nidham\backups\nidham-20260101-030000.sql.gz
```

> 📌 **توصية**: انقل ملفات الباك أب لـ external drive أو سحابة (OneDrive/Google Drive) كل أسبوع.

---

## 🔄 الأوامر اليومية

| الأمر | الوظيفة |
|---|---|
| `powershell scripts\start.ps1` | تشغيل النظام |
| `powershell scripts\stop.ps1` | إيقاف النظام (الداتا تتحفظ) |
| `powershell scripts\backup.ps1` | نسخة احتياطية يدوية |
| `docker compose logs -f app` | متابعة الـ logs لو فيه مشكلة |
| `docker compose restart app` | إعادة تشغيل التطبيق فقط |

---

## 🆘 حل المشاكل الشائعة

### المشكلة: Docker مش شغّال
**الحل**: افتح Docker Desktop. اتأكد إن الـ icon أخضر في الـ system tray.

### المشكلة: Port 3000 / 8000 شغّالة من برنامج تاني
**الحل**: عدّل في `.env`:
```ini
APP_PORT=3030
KONG_HTTP_PORT=8080
SITE_URL=http://192.168.1.10:8080
```
وأعد التشغيل.

### المشكلة: مش فاكر كلمة سر السوبر أدمن
**الحل**: المستخدم اللي عمل Sign Up أول مرة هو الأدمن. لو نسي:
```powershell
docker exec -it nidham-db psql -U postgres -d postgres
# داخل psql:
delete from auth.users where email = 'البريد القديم';
```
وارجع للموقع اعمل Sign Up من جديد.

### المشكلة: عايز أوقف النظام نهائيًا أمسح كل حاجة
```powershell
cd C:\nidham
docker compose down -v   # -v يمسح الـ volume كمان
```
> ⚠️ ده **يمسح كل البيانات نهائيًا**. خد backup الأول!

---

## 📞 الدعم الفني

- البريد: nidhamhr@proton.me
- الواتساب: +20 1055356622
- ساعات العمل: 9 ص — 6 م (السبت — الخميس)

تحت ضمان الدعم السنوي: حل المشاكل عن بُعد + ترقيات لإصدارات جديدة.

---

**Version 1.0.0 · Nidham Enterprise Edition**
