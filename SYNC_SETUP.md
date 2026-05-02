# 啟用同一份旅程同步

這個 App 已經支援 Firebase Firestore。完成以下設定後，大家打開同一個分享連結，例如：

```text
https://syue-liu.github.io/travel-planner-app/?trip=tokyo2026
```

就會共同編輯同一份旅程。

## 你需要建立的 Firebase 設定

1. 到 Firebase Console 建立一個專案。
2. 在專案中新增 Web App。
3. 複製 Firebase config，格式會像：

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

4. 把它改成 `firebase-config.js` 需要的格式：

```js
window.TRAVEL_APP_FIREBASE = {
  apiKey: "...",
  authDomain: "...firebaseapp.com",
  projectId: "...",
  storageBucket: "...appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

5. 在 Firebase Console 啟用 Firestore Database。
6. Firestore rules 可先用本專案的 `firestore.rules`。

## 注意

目前規則是「知道旅程連結的人都可以讀寫」，符合共同編輯需求，但不適合放敏感資料。之後若要改成登入後才能編輯，可以再加入 Firebase Auth。
