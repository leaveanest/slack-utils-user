# カスタムフィールド Phase 2: UpdateCustomFields + ShowCustomFieldsForm実装

## ブランチ名

```
feature/custom-fields-update
```

## 参考実装

**必ず以下のリポジトリを参照してください：**

- **GitHub**: https://github.com/leaveanest/slack-utils-channel

特に以下のファイルを参考に：

- `functions/show_private_channel_form/mod.ts` - モーダル表示 + 承認フロー
- `functions/request_private_channel/mod.ts` - Admin
  API呼び出し、承認/却下ボタン
- `functions/check_private_channel_permissions/mod.ts` - 権限チェックパターン

## ツールの使用方針

### 必須ツール

1. **Serena** - 既存コードの参照
   - ShowProfileUpdateFormの実装パターンを参照（モーダル + 承認フロー）
   - Block Kitの構築パターン

2. **Context7** - Slack SDK ドキュメント参照
   - views.open、addViewSubmissionHandler の使い方

3. **Web検索** - Slack API仕様の確認
   - `users.profile.set` でのカスタムフィールド更新方法
   - Block Kit の static_select, datepicker 要素

### Serena使用例

```
mcp_serena_search_for_pattern({ substring_pattern: "views.open", relative_path: "functions/" })
mcp_serena_search_for_pattern({ substring_pattern: "addViewSubmissionHandler", relative_path: "functions/" })
mcp_serena_find_symbol({ name_path: "ShowProfileUpdateFormDefinition" })
```

## 事前準備

1. `docs/slack-utils-user-custom-fields-spec.md` の Phase 2 セクションを確認
2. **Serena**で `show_profile_update_form/mod.ts` を参照
3. **Web検索**で以下を確認:
   - `users.profile.set` でのカスタムフィールド更新ペイロード
   - Block Kit の input 要素（static_select, datepicker）

## タスク

### 1. UpdateCustomFields関数の実装

- [ ] `functions/update_custom_fields/mod.ts`
  - UpdateCustomFieldsDefinition（関数定義）
  - Admin User Tokenを使用してAPI呼び出し
  - updateCustomFieldsWithAdminApi ヘルパー関数

- [ ] `functions/update_custom_fields/test.ts`
  - 正常系: フィールド更新成功
  - 異常系: Admin Token未設定
  - 異常系: 不正なJSON形式
  - 異常系: APIエラー

### 2. ShowCustomFieldsForm関数の実装

- [ ] `functions/show_custom_fields_form/mod.ts`
  - ShowCustomFieldsFormDefinition（関数定義）
  - team.profile.get でフィールド定義を取得
  - フィールドタイプに応じたBlock Kit要素を生成
    - `text` → `plain_text_input`
    - `options_list` → `static_select`
    - `date` → `datepicker`
  - モーダル表示
  - addViewSubmissionHandler で送信処理
  - 権限チェック（CheckUserPermissions呼び出し）
  - Admin/Owner → 直接更新
  - 一般ユーザー → 承認リクエスト送信

- [ ] `functions/show_custom_fields_form/test.ts`
  - 正常系: モーダル表示
  - 正常系: フィールドなしの場合のメッセージ
  - 異常系: API エラー

### 3. i18nメッセージの追加（必要に応じて）

- [ ] `locales/ja.json` に追加
- [ ] `locales/en.json` に追加

## カスタムフィールド更新のペイロード

```json
{
  "user": "U123ABC456",
  "profile": {
    "fields": {
      "Xf111111ABC": {
        "value": "開発部",
        "alt": ""
      },
      "Xf333333ABC": {
        "value": "2024-04-01",
        "alt": ""
      }
    }
  }
}
```

## Block Kit要素の生成パターン

### options_list（選択肢）

```typescript
{
  type: "input",
  block_id: `field_${field.id}`,
  element: {
    type: "static_select",
    action_id: `input_${field.id}`,
    options: field.possible_values.map((v) => ({
      text: { type: "plain_text", text: v },
      value: v,
    })),
  },
  label: { type: "plain_text", text: field.label },
}
```

### date（日付）

```typescript
{
  type: "input",
  block_id: `field_${field.id}`,
  element: {
    type: "datepicker",
    action_id: `input_${field.id}`,
  },
  label: { type: "plain_text", text: field.label },
}
```

### text（テキスト）

```typescript
{
  type: "input",
  block_id: `field_${field.id}`,
  element: {
    type: "plain_text_input",
    action_id: `input_${field.id}`,
  },
  label: { type: "plain_text", text: field.label },
}
```

## 注意事項

- **保護フィールド**（`is_protected: true`）はフォームに表示しない
- **非表示フィールド**（`is_hidden: true`）はフォームに表示しない
- モーダル送信時のフィールド値取得方法はタイプによって異なる:
  - `static_select` → `selected_option.value`
  - `datepicker` → `selected_date`
  - `plain_text_input` → `value`

## 権限チェックフロー

1. 操作者がAdmin/Ownerか確認
2. Admin/Owner → 直接UpdateCustomFields実行
3. 一般ユーザー → 承認リクエストを承認チャンネルに送信

## 完了条件

- `deno task check` が通る
- `deno task lint` が通る
- `deno task test` が通る
- `slack run` でモーダルが表示される
