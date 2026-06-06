# نشر OneMail

## 🚀 الطريقة 1: Firebase Hosting (يدوي - سهل)

شغّل هذا الأمر في terminal على **جهازك**:

```bash
# سجل الدخول لـ Firebase (سيفتح متصفح)
firebase login

# ارجع للـ terminal واشغل:
firebase deploy --only hosting
```

التطبيق سيكون متاحاً على: `https://onemail-onecode.web.app`

## 🚀 الطريقة 2: GitHub Actions (تلقائي)

1. ارفع المشروع إلى GitHub
2. اذهب إلى Settings → Secrets → Actions
3. أضف الأسرار التالية:
   - `VITE_FIREBASE_API_KEY` = `AIzaSyB1APHciGKZDK7t1k85nCKgnGGDMfytmzg`
   - `VITE_FIREBASE_AUTH_DOMAIN` = `onemail-onecode.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID` = `onemail-onecode`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `onemail-onecode.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `83880691663`
   - `VITE_FIREBASE_APP_ID` = `1:83880691663:web:e97c00f15c12005d3374ba`
   - `FIREBASE_SERVICE_ACCOUNT` = (محتويات ملف service-account.json كاملاً)
4. ادفع كودك إلى `main` و سينشر تلقائياً

## 🖥️ الطريقة 3: تشغيل محلي للتطوير

```bash
# Terminal 1 - Frontend
cd frontend
npm run dev
# → http://localhost:5173

# Terminal 2 - Backend
cd backend
# ضع service-account.json في مجلد backend/
npm start
# → http://localhost:3001
```

## 📦 Backend - نشر على Render / Railway

```bash
# ابني صورة Docker أو استخدم Git deploy
cd backend
# ادفع الكود إلى Render/Railway مباشرة
```

تأكد من تعيين المتغيرات في منصة الاستضافة:
- `PORT` = 3001
- `CLIENT_URL` = `https://onemail-onecode.web.app`
- `FIREBASE_SERVICE_ACCOUNT_PATH` = مسار service-account.json
- `ANTHROPIC_API_KEY` = مفتاح Claude API
