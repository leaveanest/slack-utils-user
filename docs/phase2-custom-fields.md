# Phase 2: カスタムフィールド更新機能

## 📋 現状

### 実装済み（Phase 1）

- ✅ UpdateProfileWorkflow（プロフィール更新）
- ✅ update_profile_shortcut（ショートカットトリガー）
- ✅ 関連関数4つ（ShowProfileUpdateForm, CheckUserPermissions,
  UpdateUserProfile, GetAuthorizedApprovers）
- ✅ 全テスト（70テスト合格）

### 未実装（Phase 2）

- ⏳ UpdateCustomFieldsWorkflow（カスタムフィールド更新）
- ⏳ update_custom_fields_shortcut（トリガーは定義済みだが無効化が必要）
- ⏳ 関連関数（未実装）

## 🚨 現在の問題

### P2 Badge警告内容

```
The workflow is exported and registered, but the only step is commented out,
so the workflow executes no steps at all. As a result, invoking the shortcut
will immediately complete without showing any form or performing updates.
```

### 問題の詳細

1. **ワークフローが空**:
   `workflows/update_custom_fields_workflow.ts`の48-57行目がコメントアウト
2. **manifest.tsに登録済み**: ユーザーがショートカットを実行可能
3. **トリガーが存在**:
   `triggers/update_custom_fields_shortcut.ts`が登録されている
4. **デッドエンド**: 実行すると何もせずに即座に完了

### 推奨対応

Phase 2実装時まで、以下をmanifest.tsからコメントアウト：

```typescript
workflows: [
  UpdateProfileWorkflow,
  // UpdateCustomFieldsWorkflow, // TODO: Phase 2で実装
],
```

## 📝 Phase 2実装計画

### 必要な関数

#### 1. ShowCustomFieldsUpdateForm

**目的**: カスタムフィールド更新フォームを表示

**入力パラメータ**:

```typescript
{
  interactivity: Schema.slack.types.interactivity,
  user_id: Schema.slack.types.user_id,
  channel_id: Schema.slack.types.channel_id,
}
```

**出力パラメータ**:

```typescript
{
  success: Schema.types.boolean,
  target_user_id?: Schema.slack.types.user_id,
  custom_field_updates?: Schema.types.string, // JSON形式
  approver_id?: Schema.slack.types.user_id,
  reason?: Schema.types.string,
}
```

**実装パターン**: ShowProfileUpdateFormと同様

1. ローディングモーダル即時表示
2. 並列処理：
   - 権限チェック（CheckUserPermissions）
   - カスタムフィールド定義取得（GetCustomFieldDefinitions）
   - 承認者リスト取得（GetAuthorizedApprovers）
3. モーダル更新（本来のフォーム）
4. フォーム送信処理
5. 承認フロー処理

#### 2. GetCustomFieldDefinitions

**目的**: Slackワークスペースのカスタムフィールド定義を取得

**API**: `team.profile.get`

- スコープ: `team:read`（既にmanifest.tsに追加済み）

**入力パラメータ**:

```typescript
{
  // 入力不要（ワークスペース全体のカスタムフィールド定義を取得）
}
```

**出力パラメータ**:

```typescript
{
  fields: Schema.types.array, // カスタムフィールドの定義配列
  fields_json: Schema.types.string, // JSON形式
  count: Schema.types.integer,
  error?: Schema.types.string,
}
```

**カスタムフィールド構造例**:

```json
{
  "id": "Xf12345",
  "label": "部門",
  "type": "text",
  "hint": "所属部門を入力してください",
  "possible_values": ["営業", "開発", "人事"] // selectの場合
}
```

#### 3. UpdateCustomFields

**目的**: ユーザーのカスタムフィールドを更新

**API**: `users.profile.set`（Admin User Token使用）

- プロフィール更新と同じエンドポイント
- `profile.fields`配列にカスタムフィールドを含める

**入力パラメータ**:

```typescript
{
  user_id: Schema.slack.types.user_id,
  custom_field_updates: Schema.types.string, // JSON形式
  requester_id: Schema.slack.types.user_id,
}
```

**出力パラメータ**:

```typescript
{
  success: Schema.types.boolean,
  updated_fields: Schema.types.array,
  error?: Schema.types.string,
}
```

### ワークフロー構成

```typescript
// workflows/update_custom_fields_workflow.ts（Phase 2実装例）

const UpdateCustomFieldsWorkflow = DefineWorkflow({
  callback_id: "update_custom_fields_workflow",
  title: "カスタムフィールドを更新",
  description: "ユーザーのカスタムフィールド情報を更新します",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
});

// ステップ1: フォーム表示・権限チェック・送信処理
UpdateCustomFieldsWorkflow.addStep(
  ShowCustomFieldsUpdateFormDefinition,
  {
    interactivity: UpdateCustomFieldsWorkflow.inputs.interactivity,
    user_id: UpdateCustomFieldsWorkflow.inputs.user_id,
    channel_id: UpdateCustomFieldsWorkflow.inputs.channel_id,
  },
);

export default UpdateCustomFieldsWorkflow;
```

## 🔄 既存コードの再利用

### 再利用可能な関数

- ✅ CheckUserPermissions（権限チェック）
- ✅ GetAuthorizedApprovers（承認者取得）
- ✅ i18nシステム（多言語対応）
- ✅ Zodバリデーション

### 再利用可能なパターン

- ✅ ローディングモーダル → フォーム更新
- ✅ 承認フロー（Block Actions: approve/deny）
- ✅ Admin User Token使用パターン

## 📚 参考情報

### Slack API

#### team.profile.get

カスタムフィールド定義を取得

```bash
curl https://slack.com/api/team.profile.get \
  -H "Authorization: Bearer xoxb-..." \
  -H "Content-Type: application/json"
```

**レスポンス例**:

```json
{
  "ok": true,
  "profile": {
    "fields": [
      {
        "id": "Xf12345",
        "label": "部門",
        "type": "text",
        "hint": "所属部門を入力してください"
      },
      {
        "id": "Xf67890",
        "label": "オフィス",
        "type": "options_list",
        "possible_values": ["東京", "大阪", "福岡"]
      }
    ]
  }
}
```

#### users.profile.set（カスタムフィールド付き）

```bash
curl -X POST https://slack.com/api/users.profile.set \
  -H "Authorization: Bearer xoxp-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "U12345678",
    "profile": {
      "fields": {
        "Xf12345": {
          "value": "開発部",
          "alt": ""
        }
      }
    }
  }'
```

### 必要なスコープ

- ✅ `team:read`（カスタムフィールド定義取得）- 既にmanifest.tsに追加済み
- ✅ `users.profile:write`（Admin User Token経由）

### i18nメッセージ（追加が必要）

#### locales/en.json

```json
{
  "form": {
    "custom_field_label": "Custom Field: {label}",
    "custom_field_placeholder": "Enter {label}",
    "custom_field_hint": "{hint}"
  },
  "messages": {
    "custom_fields_updated": "✅ Custom fields updated successfully",
    "custom_field_change": "• {label}: {old} → {new}"
  },
  "errors": {
    "custom_field_update_failed": "Failed to update custom fields: {error}",
    "custom_field_definitions_not_found": "Custom field definitions not found"
  },
  "logs": {
    "fetching_custom_field_definitions": "Fetching custom field definitions...",
    "custom_field_definitions_fetched": "Fetched {count} custom field definitions"
  }
}
```

## ✅ 実装チェックリスト（Phase 2開始時）

### 準備

- [ ] manifest.tsから`UpdateCustomFieldsWorkflow`のコメントアウトを解除
- [ ] i18nメッセージを追加（en.json, ja.json）
- [ ] 環境変数の確認（SLACK_ADMIN_USER_TOKEN）

### 関数実装

- [ ] `functions/get_custom_field_definitions/mod.ts`
- [ ] `functions/get_custom_field_definitions/test.ts`
- [ ] `functions/update_custom_fields/mod.ts`
- [ ] `functions/update_custom_fields/test.ts`
- [ ] `functions/show_custom_fields_update_form/mod.ts`
- [ ] `functions/show_custom_fields_update_form/test.ts`

### ワークフロー

- [ ] `workflows/update_custom_fields_workflow.ts`のステップ実装

### テスト

- [ ] 全関数のユニットテスト（正常系・異常系）
- [ ] ワークフロー統合テスト
- [ ] 権限パターンのテスト（Admin/Owner/一般ユーザー）

### manifest更新

- [ ] manifest.tsに関数を追加
- [ ] manifest.tsにワークフローを追加（コメントアウト解除）

### CI/CD

- [ ] `deno fmt --check`
- [ ] `deno lint`
- [ ] `deno check manifest.ts`
- [ ] `deno test --allow-all`

### デプロイ

- [ ] Slack CLIでデプロイ
- [ ] ショートカット動作確認
- [ ] 承認フローテスト

## 🔗 関連ファイル

### 現在存在するファイル

- `workflows/update_custom_fields_workflow.ts`（ステップがコメントアウト）
- `triggers/update_custom_fields_shortcut.ts`（定義済み）
- `docs/slack-utils-user-spec.md`（仕様書）

### 参考実装

- `functions/show_profile_update_form/mod.ts`（フォーム表示パターン）
- `functions/update_user_profile/mod.ts`（プロフィール更新パターン）
- `workflows/update_profile_workflow.ts`（ワークフロー構成）

## 📌 備考

- Phase 1（プロフィール更新）は完全に動作し、テストも全て合格
- Phase 2はPhase 1の実装パターンをそのまま適用可能
- カスタムフィールド機能は独立しているため、既存機能への影響なし
- 後日このリポジトリに追加実装すればOK

---

**作成日**: 2026-01-08 **作成者**: Claude Sonnet 4.5
