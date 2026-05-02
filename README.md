# 互動旅遊行程規劃器

這是一個可部署到 GitHub Pages 的旅遊行程與記帳小工具。手機請用 GitHub Pages 網址開啟，不要用 `file:///Users/...`，因為那是電腦本機檔案，手機讀不到。

## 功能

- 每天行程分頁瀏覽
- 地點可新增、編輯、刪除
- 地址可開 Google Maps 與導航
- 電話欄位可直接撥號，適合餐廳訂位
- 記帳可自動分類
- 可選付款人與分帳對象，自動算誰要轉給誰
- 封面可選預設圖、貼圖片網址、或直接上傳圖片
- 旅行結束後可封存完整旅程 JSON，日後可匯入還原
- 帳目可匯出 CSV
- 可設定旅行總預算
- 支援常見外幣，會折合成新台幣分帳
- 可上傳收據照片，嘗試 OCR 辨識品項與金額並自動分類
- 常用地點模板與地點排序
- 可接 Firebase Firestore 做多人共同編輯

## GitHub Pages

部署後首頁會是 `index.html`。同一個旅程會用網址中的 `?trip=代碼` 識別，例如：

```text
https://你的帳號.github.io/專案名稱/?trip=summer2026
```

## 多人共同編輯設定

GitHub Pages 只負責把網頁放到網路上。若要讓知道連結的人共同編輯同一份資料，還需要一個雲端資料庫。

目前程式已支援 Firebase Firestore：

1. 到 Firebase 建立專案。
2. 建立 Web App，複製 Firebase config。
3. 把 `firebase-config.example.js` 複製成 `firebase-config.js`。
4. 將裡面的 `YOUR_...` 換成你的 Firebase config。
5. 在 Firestore 建立 `trips` collection。

測試用 Firestore rules 可以先用：

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read, write: if true;
    }
  }
}
```

注意：這代表知道旅程連結的人都能讀寫該旅程資料，符合「知道連結的人都可以編輯」，但不適合放敏感資訊。
