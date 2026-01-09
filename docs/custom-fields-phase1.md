# カスタムフィールド Phase 1: GetCustomFieldDefinitions実装

## ブランチ名

```
feature/custom-fields-get-definitions
```

## 参考実装

**必ず以下のリポジトリを参照してください：**

- **GitHub**: https://github.com/leaveanest/slack-utils-channel

特に以下のファイルを参考に：

- `functions/get_authorized_users/mod.ts` - 関数定義パターン
- `lib/i18n/mod.ts` - i18n実装
- `lib/types/` - 型定義パターン

## ツールの使用方針

### 必須ツール

1. **Serena** - 既存コードの参照
   - 既存の関数実装パターンを参照
   - i18n実装の確認

2. **Context7** - Slack SDK ドキュメント参照
   - Deno Slack SDKのDefineFunction使用方法

3. **Web検索** - Slack API仕様の確認
   - `team.profile.get` APIのレスポンス形式を確認

### Serena使用例

```
mcp_serena_search_for_pattern({ substring_pattern: "DefineFunction", relative_path: "functions/" })
mcp_serena_find_symbol({ name_path: "initI18n" })
```

### Context7使用例

```
mcp_Context7_resolve-library-id({ libraryName: "deno slack sdk" })
mcp_Context7_get-library-docs({ context7CompatibleLibraryID: "/slackapi/deno-slack-sdk", topic: "functions" })
```

## 事前準備

1. `docs/slack-utils-user-custom-fields-spec.md` を読んで全体像を把握
2. **Web検索**で `team.profile.get` APIのレスポンス形式を確認
3. **Serena**で既存の関数実装パターンを確認

## タスク

### 1. 型定義の作成

- [ ] `lib/types/custom_fields.ts` - カスタムフィールド関連の型定義
  - CustomFieldType
  - CustomFieldOptions
  - CustomFieldDefinition
  - CustomFieldSection
  - CustomFieldUpdate
  - CustomFieldUpdateResult

- [ ] `lib/types/mod.ts` を更新してエクスポート追加

### 2. GetCustomFieldDefinitions関数の実装

- [ ] `functions/get_custom_field_definitions/mod.ts`
  - GetCustomFieldDefinitionsDefinition（関数定義）
  - team.profile.get APIを呼び出し
  - 非表示フィールドのフィルタリング
  - 出力用にフィールドを整形

### 3. テストの作成

- [ ] `functions/get_custom_field_definitions/test.ts`
  - 正常系: フィールド定義を取得できる
  - 正常系: フィールドがない場合は空配列
  - 異常系: APIエラー時
  - 正常系: 非表示フィールドのフィルタリング

### 4. i18nメッセージの追加

- [ ] `locales/ja.json` に追加:
  ```json
  {
    "errors": {
      "custom_field_not_found": "カスタムフィールドが見つかりません: {fieldId}",
      "invalid_field_value": "フィールド '{field}' の値が不正です: {value}",
      "protected_field": "フィールド '{field}' は保護されており、更新できません"
    },
    "messages": {
      "custom_fields_form_title": "カスタムフィールド更新",
      "custom_fields_form_description": "更新するカスタムフィールドを選択してください",
      "select_field_placeholder": "フィールドを選択...",
      "no_custom_fields": "このワークスペースにはカスタムフィールドが設定されていません"
    }
  }
  ```

- [ ] `locales/en.json` に対応する英語メッセージを追加

## 注意事項

- 仕様書のコードを参考に実装
- 全メッセージは `t()` 関数を使用
- JSDocコメント必須
- **Serena**で既存実装のパターンを確認してから実装

## team.profile.get レスポンス形式

```json
{
  "ok": true,
  "profile": {
    "fields": [
      {
        "id": "Xf111111ABC",
        "ordering": 0,
        "label": "部署",
        "hint": "所属部署を選択",
        "type": "options_list",
        "possible_values": ["営業部", "開発部"],
        "options": { "is_scim": false, "is_protected": false },
        "is_hidden": false,
        "section_id": "123ABC"
      }
    ],
    "sections": [...]
  }
}
```

## 完了条件

- `deno task check` が通る
- `deno task lint` が通る
- `deno task test` が通る
