# Koryu 変更ログ 2026-05-24

## 概要
コンタクト詳細・つながり一覧・プロフィール設定のUX全面改善。
「交流」の深さを可視化し、SNSで繋がっている相手を一目で識別できるようにした。

---

## 1. コンタクト詳細ページ（`pages/contacts/[id].js`）

### SNS表示順の変更
- 自分のプロフィールに同じSNSが設定されているもの（`isMatch: true`）を上位表示
- 共通SNSがないものは下位に表示
- 例：自分がLINE・WhatsApp登録済み → LINEとWhatsAppが上位、Facebookは下位

### 交流ボタンのUI改善
- **文言変更**：「繋がった」→「交流する」／「繋がり済み」→「交流済み ✓」
- **レイアウト変更**：縦積み（全幅ボタン）→ 横並び（SNSリンク＋右にコンパクトボタン）
- スタイル：`connected-btn-compact` クラスで実装、押した後は緑表示

### セクション構成の変更
| 変更前 | 変更後 |
|--------|--------|
| 今すぐ繋がる | SNSで繋がる |
| （メール送信なし） | メール（新設：SNSと交流履歴の間） |
| ＋ 記録を追加 | ＋ 交流を追加 |

### メール送信セクション（新設）
- SNSセクションと交流履歴の間に独立セクションとして配置
- 表示条件：`isOwner && (displayEmail || contact.koryu_user_id)`
- KoryuユーザーはkorYu_user_idで判定するためdisplayEmailが空でも表示

---

## 2. つながり一覧（`pages/contacts.js`）

### バッジ表示の全面変更
- **変更前**：「未送信」「送信済み」バッジ
- **変更後**：`🔗 交流X回` 形式のインジケーター

#### 表示ルール
| 条件 | 表示 |
|------|------|
| SNS未接続 & 交流0回 | 非表示 |
| 交流1回以上 | 交流X回 |
| SNS接続あり | 🔗アイコン追加 |

### SNS接続済みコンタクトのカード色変更
- SNSで交流済み（`connected_sns` に1件以上）のカードを緑トーンに変更
- `background: rgba(22, 163, 74, 0.1)`
- `border: 1px solid rgba(22, 163, 74, 0.3)`
- `boxShadow: inset 3px 0 0 #16a34a`（左ボーダーアクセント）

### APIの変更（`pages/api/contacts/list.js`）
- クエリに `encounters(count)` を追加
- レスポンスに `encounter_count` フィールドを追加

---

## 3. プロフィール設定（`pages/settings/profile.js`）

### アコーディオンヘッダーのスタイル調整
- フォントサイズ：→ 13px
- 色：`rgba(255,255,255,0.85)` → `rgba(255,255,255,0.65)`
- chevron色：`#3a3a4a`（ほぼ不可視）→ `rgba(255,255,255,0.3)`

### 署名プレビューの削除
- 所属・連絡先セクションからQRコード付き署名プレビューを削除
- セクション区切り線も合わせて削除

### 統一保存FAB（新設）
- **変更前**：各セクション（SNSリンク・所属連絡先）に個別「保存する」ボタン
- **変更後**：変更検知時のみ画面下部に浮かぶ統一「💾 変更を保存」ボタン

#### 動作フロー
```
フィールドを触る
    ↓
isDirty = true → 画面下部に保存FABが出現
    ↓ クリック
update-sns + affiliations を順番に実行
    ↓ 成功
isDirty = false（FAB消える）
```

#### 実装詳細
- `isDirty` / `isSaving` stateで管理
- 全フォームフィールドのonChangeに `setIsDirty(true)` を追加
- `handleUnifiedSave()` 関数でSNS・所属を順次保存
- FABはプレビューボタンの直前に配置（`bottom: 80px`、`zIndex: 49`）

---

## 今後の課題（Pending）

- **メールボタンの表示問題**：KoryuユーザーでもdisplayEmailが空になるケースがある（show_emailフラグの影響）→ profiles テーブルからメアドを直接取得するフォールバック実装
- **useRequireAuth の401対応**：Invalid token時に自動ログアウト＋ログイン画面へリダイレクト
- **Google Ads LP**：Typeペルソナ向けのビフォーアフターLP作成
