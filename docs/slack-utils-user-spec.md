# slack-utils-user 仕様書

## 文書情報

| 項目       | 内容       |
| ---------- | ---------- |
| バージョン | 1.0.0      |
| 作成日     | 2026-01-07 |
| ステータス | Draft      |

---

## 1. 概要

### 1.1 アプリケーション説明

slack-utils-userは、Slackユーザーのプロフィールおよびカスタムフィールドを管理するためのワークフローアプリケーションです。

管理者（Admin/Owner）は直接プロフィールを更新でき、一般ユーザーは承認リクエストを通じて更新を依頼できます。

### 1.2 主な特徴

- **承認ワークフロー**: slack-utils-channelと同様の承認パターンを採用
- **権限ベースアクセス制御**: Admin/Owner/一般ユーザーで異なる操作権限
- **フィールド別権限設定**: フィールドごとに編集可能な権限を設定可能
- **多言語対応**: 日本語（デフォルト）/ 英語対応
- **Enterprise Grid対応**: 大規模組織での利用を想定

### 1.3 参考リポジトリ

- **slack-utils-channel**: <https://github.com/leaveanest/slack-utils-channel>
  - 承認ワークフローのパターン
  - i18n構造
  - プロジェクト構成

---

## 2. 機能一覧

### 2.1 コア機能

| 機能ID | 機能名                     | 説明                                             | 優先度 |
| ------ | -------------------------- | ------------------------------------------------ | ------ |
| F001   | プロフィール更新           | display_name, title, phone等の標準フィールド更新 | 高     |
| F002   | カスタムフィールド更新     | 部署、従業員番号等のカスタムフィールド更新       | 高     |
| F003   | カスタムフィールド定義取得 | ワークスペースのカスタムフィールド一覧取得       | 中     |
| F004   | 権限チェック               | 操作者の権限確認（Admin/Owner/一般）             | 高     |
| F005   | 承認リクエスト             | 一般ユーザーからの更新リクエスト送信             | 高     |
| F006   | 承認/却下処理              | Admin/Ownerによる承認または却下                  | 高     |

### 2.2 更新可能フィールド

#### 標準フィールド

| フィールド | API名        | 説明            | 自己編集 | 承認編集 | Admin専用 |
| ---------- | ------------ | --------------- | -------- | -------- | --------- |
| 表示名     | display_name | Slackでの表示名 | ✅       | -        | -         |
| 代名詞     | pronouns     | 代名詞          | ✅       | -        | -         |
| 電話番号   | phone        | 連絡先電話番号  | ✅       | -        | -         |
| 役職       | title        | 役職・肩書き    | ❌       | ✅       | -         |
| 入社日     | start_date   | 入社日          | ❌       | ❌       | ✅        |

#### カスタムフィールド（例）

| フィールド | 説明           | 形式                | 自己編集 | 承認編集 | Admin専用 |
| ---------- | -------------- | ------------------- | -------- | -------- | --------- |
| 部署       | 所属部署       | text / options_list | ❌       | ✅       | -         |
| 勤務地     | オフィス所在地 | options_list        | ❌       | ✅       | -         |
| 従業員番号 | 社員番号       | text                | ❌       | ❌       | ✅        |
| 役職レベル | 職位階層       | options_list        | ❌       | ❌       | ✅        |
| スキル     | 技術スキル     | tags                | ✅       | -        | -         |

---

## 3. 権限モデル

### 3.1 操作権限マトリクス

| 操作者        | 自分のプロフィール    | 他ユーザーのプロフィール |
| ------------- | --------------------- | ------------------------ |
| Primary Owner | ✅ 直接実行           | ✅ 直接実行              |
| Owner         | ✅ 直接実行           | ✅ 直接実行              |
| Admin         | ✅ 直接実行           | ✅ 直接実行              |
| 一般ユーザー  | ✅ 許可フィールドのみ | 🔄 承認リクエスト        |

### 3.2 承認フロー

```
┌─────────────────────────────────────────────────────────────────┐
│                    プロフィール更新リクエスト                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  権限チェック    │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
       ┌──────────┐    ┌──────────┐    ┌──────────┐
       │Admin/Owner│    │自分+許可  │    │それ以外  │
       │          │    │フィールド │    │          │
       └──────────┘    └──────────┘    └──────────┘
              │               │               │
              ▼               ▼               ▼
        直接実行         直接実行       承認リクエスト
              │               │               │
              │               │               ▼
              │               │      ┌─────────────────┐
              │               │      │承認チャンネルに  │
              │               │      │リクエスト送信    │
              │               │      └─────────────────┘
              │               │               │
              │               │               ▼
              │               │      ┌─────────────────┐
              │               │      │ Admin/Owner     │
              │               │      │ 承認 or 却下    │
              │               │      └─────────────────┘
              │               │               │
              │               │    ┌──────────┴──────────┐
              │               │    │                     │
              │               │    ▼                     ▼
              │               │  承認                  却下
              │               │    │                     │
              │               │    ▼                     ▼
              │               │  更新実行            通知のみ
              │               │    │                     │
              └───────────────┴────┴─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  結果通知        │
                    └─────────────────┘
```

### 3.3 設定オプション

```typescript
interface PermissionConfig {
  // 承認を要求するかどうか
  require_approval: boolean; // default: true

  // 承認リクエスト送信先チャンネル
  approval_channel_id: string; // 必須

  // 一般ユーザーが自分で編集可能なフィールド
  allowed_self_edit_fields: string[]; // default: ["display_name", "pronouns", "phone"]

  // Admin専用フィールド（承認でも変更不可）
  admin_only_fields: string[]; // default: ["start_date", "employee_id"]

  // 承認可能なユーザー/グループ
  allowed_approvers?: string[]; // 未設定の場合は全Admin/Owner
}
```

---

## 4. API仕様

### 4.1 使用するSlack API

#### Bot Token API

| API                  | 用途                       | スコープ             |
| -------------------- | -------------------------- | -------------------- |
| `users.profile.get`  | ユーザープロフィール取得   | `users.profile:read` |
| `team.profile.get`   | カスタムフィールド定義取得 | `team:read`          |
| `users.list`         | ユーザー一覧取得           | `users:read`         |
| `users.info`         | ユーザー詳細取得           | `users:read`         |
| `chat.postMessage`   | メッセージ送信             | `chat:write`         |
| `conversations.open` | DM開始                     | `im:write`           |

#### User Token API（Admin権限）

| API                 | 用途             | スコープ              |
| ------------------- | ---------------- | --------------------- |
| `users.profile.set` | プロフィール更新 | `users.profile:write` |

### 4.2 必要スコープ

```typescript
// manifest.ts
botScopes: [
  "commands",                // スラッシュコマンド
  "chat:write",              // メッセージ送信
  "chat:write.public",       // 公開チャンネルへの送信
  "users:read",              // ユーザー情報読み取り
  "users.profile:read",      // プロフィール読み取り
  "team:read",               // チーム情報読み取り（カスタムフィールド定義取得に必要）
  "im:write",                // DM送信
],
```

### 4.3 環境変数

```bash
# .env
# Slack App Configuration
SLACK_APP_NAME=Slack Utils User
SLACK_APP_DESCRIPTION=ユーザープロフィール管理ワークフロー

# Admin User Token（他ユーザーのプロフィール更新に必須）
# 従来型 Slack App から取得した User OAuth Token
SLACK_ADMIN_USER_TOKEN=xoxp-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxx

# 承認チャンネルID
SLACK_APPROVAL_CHANNEL_ID=C0123456789

# ロケール設定（デフォルト: ja）
LOCALE=ja
```

### 4.4 API制限

| API                 | 制限                                          |
| ------------------- | --------------------------------------------- |
| `users.profile.set` | 1ユーザーあたり10回/分、全体30プロフィール/分 |
| `users.list`        | Tier 2 (20+ req/min)                          |
| `team.profile.get`  | Tier 2 (20+ req/min)                          |

---

## 5. 関数定義

### 5.1 関数一覧

| 関数名                    | callback_id                    | 説明                                 |
| ------------------------- | ------------------------------ | ------------------------------------ |
| UpdateUserProfile         | `update_user_profile`          | プロフィール更新（承認後実行）       |
| UpdateCustomFields        | `update_custom_fields`         | カスタムフィールド更新（承認後実行） |
| GetCustomFieldDefinitions | `get_custom_field_definitions` | カスタムフィールド定義取得           |
| CheckUserPermissions      | `check_user_permissions`       | 操作者の権限チェック                 |
| ShowProfileUpdateForm     | `show_profile_update_form`     | プロフィール更新フォーム表示         |
| GetAuthorizedApprovers    | `get_authorized_approvers`     | 承認可能なAdmin/Owner取得            |

### 5.2 UpdateUserProfile

```typescript
// functions/update_user_profile/mod.ts

export const UpdateUserProfileDefinition = DefineFunction({
  callback_id: "update_user_profile",
  title: "プロフィール更新",
  description: "ユーザーのプロフィール情報を更新します",
  source_file: "functions/update_user_profile/mod.ts",
  input_parameters: {
    properties: {
      target_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新対象のユーザーID",
      },
      display_name: {
        type: Schema.types.string,
        description: "表示名（オプション）",
      },
      title: {
        type: Schema.types.string,
        description: "役職（オプション）",
      },
      phone: {
        type: Schema.types.string,
        description: "電話番号（オプション）",
      },
      pronouns: {
        type: Schema.types.string,
        description: "代名詞（オプション）",
      },
    },
    required: ["target_user_id"],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "更新成功かどうか",
      },
      updated_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新されたフィールド一覧",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["success"],
  },
});
```

### 5.3 CheckUserPermissions

```typescript
// functions/check_user_permissions/mod.ts

export const CheckUserPermissionsDefinition = DefineFunction({
  callback_id: "check_user_permissions",
  title: "権限チェック",
  description: "操作者の権限を確認します",
  source_file: "functions/check_user_permissions/mod.ts",
  input_parameters: {
    properties: {
      operator_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      target_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新対象のユーザーID",
      },
      requested_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新を要求するフィールド一覧",
      },
    },
    required: ["operator_id", "target_user_id", "requested_fields"],
  },
  output_parameters: {
    properties: {
      can_execute_directly: {
        type: Schema.types.boolean,
        description: "直接実行可能かどうか",
      },
      requires_approval: {
        type: Schema.types.boolean,
        description: "承認が必要かどうか",
      },
      denied_fields: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "更新が拒否されたフィールド（Admin専用等）",
      },
      is_admin: {
        type: Schema.types.boolean,
        description: "操作者がAdminかどうか",
      },
      is_owner: {
        type: Schema.types.boolean,
        description: "操作者がOwnerかどうか",
      },
    },
    required: ["can_execute_directly", "requires_approval"],
  },
});
```

### 5.4 ShowProfileUpdateForm

```typescript
// functions/show_profile_update_form/mod.ts

export const ShowProfileUpdateFormDefinition = DefineFunction({
  callback_id: "show_profile_update_form",
  title: "プロフィール更新フォーム表示",
  description: "プロフィール更新用のモーダルフォームを表示します",
  source_file: "functions/show_profile_update_form/mod.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        description: "インタラクティブコンテキスト",
      },
      user_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
        description: "リクエスト元チャンネル",
      },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "処理成功かどうか",
      },
      approval_required: {
        type: Schema.types.boolean,
        description: "承認リクエストが送信されたかどうか",
      },
      updated_user_id: {
        type: Schema.slack.types.user_id,
        description: "更新されたユーザーID",
      },
    },
    required: ["success"],
  },
});
```

---

## 6. ワークフロー定義

### 6.1 ワークフロー一覧

| ワークフロー名             | callback_id                     | 説明                       |
| -------------------------- | ------------------------------- | -------------------------- |
| UpdateProfileWorkflow      | `update_profile_workflow`       | プロフィール更新（メイン） |
| UpdateCustomFieldsWorkflow | `update_custom_fields_workflow` | カスタムフィールド更新     |

### 6.2 UpdateProfileWorkflow

```typescript
// workflows/update_profile_workflow.ts

import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ShowProfileUpdateFormDefinition } from "../functions/show_profile_update_form/mod.ts";

/**
 * プロフィール更新ワークフロー
 *
 * ユーザーのプロフィールを更新します。
 * 権限に応じて直接実行または承認リクエストを送信します。
 *
 * 処理の流れ:
 * 1. ローディングモーダルを即座に表示
 * 2. 権限チェック・フォーム構築
 * 3. モーダルを本来のフォームに更新
 * 4. フォーム送信を処理
 * 5. 権限に応じて直接実行 or 承認リクエスト
 */
const UpdateProfileWorkflow = DefineWorkflow({
  callback_id: "update_profile_workflow",
  title: "プロフィールを更新",
  description: "ユーザーのプロフィール情報を更新します",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        description: "フォームを開くためのインタラクティブコンテキスト",
      },
      user_id: {
        type: Schema.slack.types.user_id,
        description: "操作者のユーザーID",
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
        description: "リクエスト元チャンネル",
      },
    },
    required: ["interactivity", "user_id", "channel_id"],
  },
});

// フォーム表示→権限チェック→実行/承認リクエストを1つの関数で処理
UpdateProfileWorkflow.addStep(
  ShowProfileUpdateFormDefinition,
  {
    interactivity: UpdateProfileWorkflow.inputs.interactivity,
    user_id: UpdateProfileWorkflow.inputs.user_id,
    channel_id: UpdateProfileWorkflow.inputs.channel_id,
  },
);

export default UpdateProfileWorkflow;
```

---

## 7. トリガー定義

### 7.1 トリガー一覧

| トリガー名                 | 種類           | 説明                                 |
| -------------------------- | -------------- | ------------------------------------ |
| UpdateProfileShortcut      | ショートカット | プロフィール更新ショートカット       |
| UpdateCustomFieldsShortcut | ショートカット | カスタムフィールド更新ショートカット |

### 7.2 UpdateProfileShortcut

```typescript
// triggers/update_profile_shortcut.ts

import { Trigger } from "deno-slack-sdk/mod.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import UpdateProfileWorkflow from "../workflows/update_profile_workflow.ts";

const UpdateProfileShortcut: Trigger<typeof UpdateProfileWorkflow.definition> =
  {
    type: TriggerTypes.Shortcut,
    name: "プロフィールを更新",
    description: "ユーザーのプロフィール情報を更新します",
    workflow: `#/workflows/${UpdateProfileWorkflow.definition.callback_id}`,
    inputs: {
      interactivity: {
        value: TriggerContextData.Shortcut.interactivity,
      },
      user_id: {
        value: TriggerContextData.Shortcut.user_id,
      },
      channel_id: {
        value: TriggerContextData.Shortcut.channel_id,
      },
    },
  };

export default UpdateProfileShortcut;
```

---

## 8. i18n メッセージ定義

### 8.1 ファイル構成

```
locales/
├── en.json    # 英語
└── ja.json    # 日本語（デフォルト）
```

### 8.2 デフォルトロケール設定

```typescript
// lib/i18n/mod.ts

/**
 * デフォルトロケールは日本語
 */
let currentLocale = "ja";

export function detectLocale(): SupportedLocale {
  try {
    const locale = Deno.env.get("LOCALE") || Deno.env.get("LANG") || "ja";
    const langCode = locale.split(/[_.]/)[0].toLowerCase();
    return SUPPORTED_LOCALES.includes(langCode as SupportedLocale)
      ? langCode as SupportedLocale
      : "ja"; // デフォルトは日本語
  } catch (_error) {
    return "ja";
  }
}
```

### 8.3 メッセージ定義（日本語: ja.json）

```json
{
  "errors": {
    "unknown_error": "予期しないエラーが発生しました",
    "api_error": "APIリクエストに失敗しました: {message}",
    "api_call_failed": "API呼び出しに失敗しました: {error}",
    "invalid_input": "無効な入力です",
    "user_not_found": "ユーザーが見つかりません: {userId}",
    "profile_update_failed": "プロフィールの更新に失敗しました: {error}",
    "custom_field_update_failed": "カスタムフィールドの更新に失敗しました: {error}",
    "permission_denied": "この操作を実行する権限がありません",
    "field_not_allowed": "フィールド '{field}' の更新は許可されていません",
    "admin_only_field": "フィールド '{field}' は管理者のみ更新可能です",
    "missing_admin_token": "管理者トークン (SLACK_ADMIN_USER_TOKEN) が設定されていません",
    "missing_approval_channel": "承認チャンネルIDが設定されていません",
    "not_authorized_approver": "この承認を行う権限がありません。<@{approver}> のみが承認または却下できます。",
    "not_authorized_approver_multiple": "この承認を行う権限がありません。{approvers} のみが承認または却下できます。",
    "no_approver_selected": "承認者を1人以上選択してください",
    "modal_open_failed": "フォームを開けませんでした: {error}",
    "modal_update_failed": "フォームの更新に失敗しました: {error}",
    "no_fields_to_update": "更新するフィールドが指定されていません",
    "rate_limit_exceeded": "APIレート制限に達しました。しばらくしてから再試行してください"
  },
  "messages": {
    "profile_updated": "✅ プロフィールが更新されました",
    "profile_updated_for_user": "✅ <@{userId}> のプロフィールが更新されました",
    "custom_fields_updated": "✅ カスタムフィールドが更新されました",
    "approval_request_sent": "✅ 承認リクエストを送信しました。承認者の対応をお待ちください。",
    "approval_request_header": "📝 プロフィール更新リクエスト",
    "approval_request_details": "*リクエスト者:* <@{requester}>\n*対象ユーザー:* <@{target}>\n*更新内容:*\n{changes}",
    "approve_button": "✅ 承認",
    "deny_button": "❌ 却下",
    "request_approved": "✅ *承認されました*\n\n<@{approver}> が <@{requester}> からの <@{target}> のプロフィール更新リクエストを承認しました。",
    "request_denied": "❌ *却下されました*\n\n<@{approver}> が <@{requester}> からの <@{target}> のプロフィール更新リクエストを却下しました。",
    "approved_at": "承認日時: {time}",
    "denied_at": "却下日時: {time}",
    "update_success_notification": "🎉 プロフィールが更新されました！\n\n*対象:* <@{target}>\n*更新者:* <@{updater}>\n*更新内容:*\n{changes}",
    "no_changes": "変更はありません",
    "field_change": "• {field}: {old} → {new}",
    "loading_form": "⏳ フォームを読み込み中...",
    "processing": "処理中..."
  },
  "form": {
    "title": "プロフィール更新",
    "submit_button": "更新",
    "cancel_button": "キャンセル",
    "request_button": "リクエスト送信",
    "target_user_label": "対象ユーザー",
    "target_user_placeholder": "更新するユーザーを選択",
    "target_user_hint": "自分以外のユーザーを選択した場合、承認が必要になることがあります",
    "display_name_label": "表示名",
    "display_name_placeholder": "山田 太郎",
    "display_name_hint": "Slackで表示される名前",
    "title_label": "役職",
    "title_placeholder": "シニアエンジニア",
    "title_hint": "役職や肩書き",
    "phone_label": "電話番号",
    "phone_placeholder": "03-1234-5678",
    "phone_hint": "連絡先電話番号",
    "pronouns_label": "代名詞",
    "pronouns_placeholder": "彼/彼女",
    "pronouns_hint": "代名詞（任意）",
    "department_label": "部署",
    "department_placeholder": "開発部",
    "department_hint": "所属部署",
    "location_label": "勤務地",
    "location_placeholder": "東京オフィス",
    "location_hint": "勤務地・オフィス",
    "employee_id_label": "従業員番号",
    "employee_id_placeholder": "EMP-12345",
    "employee_id_hint": "従業員番号（管理者のみ編集可）",
    "approver_label": "承認者",
    "approver_placeholder": "承認者を選択",
    "approver_hint": "管理者またはオーナーのみ選択可能です",
    "approver_label_multiple": "承認者（複数選択可）",
    "approver_placeholder_multiple": "承認者を選択",
    "approver_hint_multiple": "選択した承認者のいずれかが承認できます",
    "reason_label": "変更理由",
    "reason_placeholder": "異動のため / 昇進のため",
    "reason_hint": "変更理由（承認者への参考情報）",
    "loading_title": "しばらくお待ちください...",
    "loading_message": "⏳ *フォームを読み込み中...*\n\nプロフィール更新フォームを準備しています。",
    "loading_hint": "数秒かかる場合があります"
  },
  "logs": {
    "starting": "ワークフローを開始します...",
    "completed": "ワークフローが完了しました",
    "checking_permissions": "ユーザー {userId} の権限を確認中...",
    "permissions_checked": "権限確認完了: is_admin={isAdmin}, is_owner={isOwner}",
    "updating_profile": "ユーザー {userId} のプロフィールを更新中...",
    "profile_updated": "プロフィール更新完了: {fields}",
    "sending_approval_request": "承認リクエストを送信中: 対象={target}, 承認者={approver}",
    "approval_request_sent": "承認リクエストを送信しました",
    "processing_approval": "承認を処理中: action={action}, reviewer={reviewer}",
    "fetching_custom_fields": "カスタムフィールド定義を取得中...",
    "custom_fields_fetched": "{count} 件のカスタムフィールドを取得しました",
    "fetching_authorized_users": "承認可能なユーザーを取得中...",
    "authorized_users_fetched": "{count} 人の承認者を取得しました",
    "modal_opened": "モーダルを開きました",
    "form_submitted": "フォームが送信されました"
  },
  "validation": {
    "display_name_too_long": "表示名は80文字以内で入力してください",
    "title_too_long": "役職は100文字以内で入力してください",
    "phone_invalid": "電話番号の形式が正しくありません",
    "required_field": "{field} は必須です"
  }
}
```

### 8.4 メッセージ定義（英語: en.json）

```json
{
  "errors": {
    "unknown_error": "An unexpected error occurred",
    "api_error": "API request failed: {message}",
    "api_call_failed": "API call failed: {error}",
    "invalid_input": "Invalid input provided",
    "user_not_found": "User not found: {userId}",
    "profile_update_failed": "Failed to update profile: {error}",
    "custom_field_update_failed": "Failed to update custom fields: {error}",
    "permission_denied": "You do not have permission to perform this action",
    "field_not_allowed": "Updating field '{field}' is not allowed",
    "admin_only_field": "Field '{field}' can only be updated by administrators",
    "missing_admin_token": "Admin user token (SLACK_ADMIN_USER_TOKEN) is not configured",
    "missing_approval_channel": "Approval channel ID is not configured",
    "not_authorized_approver": "You are not authorized to approve this request. Only <@{approver}> can approve or deny.",
    "not_authorized_approver_multiple": "You are not authorized to approve this request. Only {approvers} can approve or deny.",
    "no_approver_selected": "Please select at least one approver",
    "modal_open_failed": "Failed to open the form: {error}",
    "modal_update_failed": "Failed to update the form: {error}",
    "no_fields_to_update": "No fields specified for update",
    "rate_limit_exceeded": "API rate limit exceeded. Please try again later"
  },
  "messages": {
    "profile_updated": "✅ Profile has been updated",
    "profile_updated_for_user": "✅ Profile for <@{userId}> has been updated",
    "custom_fields_updated": "✅ Custom fields have been updated",
    "approval_request_sent": "✅ Approval request sent. Please wait for the approver's response.",
    "approval_request_header": "📝 Profile Update Request",
    "approval_request_details": "*Requester:* <@{requester}>\n*Target User:* <@{target}>\n*Changes:*\n{changes}",
    "approve_button": "✅ Approve",
    "deny_button": "❌ Deny",
    "request_approved": "✅ *Approved*\n\n<@{approver}> approved the profile update request from <@{requester}> for <@{target}>.",
    "request_denied": "❌ *Denied*\n\n<@{approver}> denied the profile update request from <@{requester}> for <@{target}>.",
    "approved_at": "Approved at: {time}",
    "denied_at": "Denied at: {time}",
    "update_success_notification": "🎉 Profile has been updated!\n\n*Target:* <@{target}>\n*Updated by:* <@{updater}>\n*Changes:*\n{changes}",
    "no_changes": "No changes",
    "field_change": "• {field}: {old} → {new}",
    "loading_form": "⏳ Loading form...",
    "processing": "Processing..."
  },
  "form": {
    "title": "Update Profile",
    "submit_button": "Update",
    "cancel_button": "Cancel",
    "request_button": "Send Request",
    "target_user_label": "Target User",
    "target_user_placeholder": "Select user to update",
    "target_user_hint": "Approval may be required when selecting another user",
    "display_name_label": "Display Name",
    "display_name_placeholder": "John Doe",
    "display_name_hint": "Name displayed in Slack",
    "title_label": "Title",
    "title_placeholder": "Senior Engineer",
    "title_hint": "Job title or position",
    "phone_label": "Phone",
    "phone_placeholder": "+1-555-1234",
    "phone_hint": "Contact phone number",
    "pronouns_label": "Pronouns",
    "pronouns_placeholder": "he/him, she/her",
    "pronouns_hint": "Pronouns (optional)",
    "department_label": "Department",
    "department_placeholder": "Engineering",
    "department_hint": "Department or team",
    "location_label": "Location",
    "location_placeholder": "Tokyo Office",
    "location_hint": "Work location or office",
    "employee_id_label": "Employee ID",
    "employee_id_placeholder": "EMP-12345",
    "employee_id_hint": "Employee ID (admin only)",
    "approver_label": "Approver",
    "approver_placeholder": "Select approver",
    "approver_hint": "Only admins and owners can be selected",
    "approver_label_multiple": "Approvers",
    "approver_placeholder_multiple": "Select approvers",
    "approver_hint_multiple": "Any selected approver can approve",
    "reason_label": "Reason",
    "reason_placeholder": "Transfer / Promotion",
    "reason_hint": "Reason for change (for approver reference)",
    "loading_title": "Please wait...",
    "loading_message": "⏳ *Loading form...*\n\nPreparing profile update form.",
    "loading_hint": "This may take a few seconds"
  },
  "logs": {
    "starting": "Starting workflow...",
    "completed": "Workflow completed",
    "checking_permissions": "Checking permissions for user {userId}...",
    "permissions_checked": "Permissions checked: is_admin={isAdmin}, is_owner={isOwner}",
    "updating_profile": "Updating profile for user {userId}...",
    "profile_updated": "Profile updated: {fields}",
    "sending_approval_request": "Sending approval request: target={target}, approver={approver}",
    "approval_request_sent": "Approval request sent",
    "processing_approval": "Processing approval: action={action}, reviewer={reviewer}",
    "fetching_custom_fields": "Fetching custom field definitions...",
    "custom_fields_fetched": "Fetched {count} custom fields",
    "fetching_authorized_users": "Fetching authorized approvers...",
    "authorized_users_fetched": "Found {count} authorized approvers",
    "modal_opened": "Modal opened",
    "form_submitted": "Form submitted"
  },
  "validation": {
    "display_name_too_long": "Display name must be 80 characters or less",
    "title_too_long": "Title must be 100 characters or less",
    "phone_invalid": "Invalid phone number format",
    "required_field": "{field} is required"
  }
}
```

---

## 9. プロジェクト構成

```
slack-utils-user/
├── .github/
│   └── workflows/
│       ├── deno-ci.yml              # CI/CD
│       ├── i18n-auto-translate.yml  # 自動翻訳
│       └── release-please.yml       # リリース自動化
├── assets/
│   └── icon.png                     # アプリアイコン
├── docs/
│   ├── i18n-guide.md               # i18nガイド
│   └── testing-guide.md            # テストガイド
├── functions/
│   ├── update_user_profile/
│   │   ├── mod.ts                  # プロフィール更新関数
│   │   └── test.ts                 # テスト
│   ├── update_custom_fields/
│   │   ├── mod.ts                  # カスタムフィールド更新関数
│   │   └── test.ts
│   ├── check_user_permissions/
│   │   ├── mod.ts                  # 権限チェック関数
│   │   └── test.ts
│   ├── get_custom_field_definitions/
│   │   ├── mod.ts                  # カスタムフィールド定義取得
│   │   └── test.ts
│   ├── show_profile_update_form/
│   │   ├── mod.ts                  # フォーム表示関数
│   │   └── test.ts
│   └── get_authorized_approvers/
│       ├── mod.ts                  # 承認者取得関数
│       └── test.ts
├── lib/
│   ├── i18n/
│   │   ├── mod.ts                  # i18nモジュール
│   │   ├── check.ts                # 整合性チェック
│   │   └── test.ts
│   ├── types/
│   │   ├── mod.ts                  # 型定義
│   │   └── profile.ts              # プロフィール型
│   └── validation/
│       ├── mod.ts                  # バリデーション
│       └── schemas.ts              # Zodスキーマ
├── locales/
│   ├── en.json                     # 英語
│   └── ja.json                     # 日本語（デフォルト）
├── scripts/
│   ├── translate.ts                # 翻訳スクリプト
│   └── setup-git-hooks.sh          # Git hooks設定
├── triggers/
│   ├── update_profile_shortcut.ts  # プロフィール更新ショートカット
│   └── update_custom_fields_shortcut.ts
├── workflows/
│   ├── update_profile_workflow.ts  # プロフィール更新ワークフロー
│   └── update_custom_fields_workflow.ts
├── .env.example                    # 環境変数サンプル
├── .gitignore
├── CHANGELOG.md
├── LICENSE
├── README.md
├── deno.jsonc                      # Denoタスク設定
├── import_map.json                 # 依存関係
├── manifest.ts                     # Slackマニフェスト
└── slack.json                      # Slack CLI設定
```

---

## 10. 制約事項

### 10.1 Slack API制限

| 制約             | 詳細                                                               |
| ---------------- | ------------------------------------------------------------------ |
| 有料プラン必須   | 他ユーザーのプロフィール更新には有料プラン（Pro以上）が必要        |
| Admin User Token | 他ユーザーの更新には従来型Slack Appから取得したxoxp-トークンが必要 |
| 権限レベル制限   | 自分より上位の権限を持つユーザーのプロフィールは更新不可           |
| レート制限       | 1ユーザーあたり10回/分、全体30プロフィール/分                      |

### 10.2 Enterprise Grid考慮事項

| 項目       | 対応                                        |
| ---------- | ------------------------------------------- |
| Team ID    | ワークスペース識別にteam_idが必要な場合あり |
| Org Admin  | 組織全体の管理にはOrg Admin権限が必要       |
| データ分離 | ワークスペース間でのデータ参照不可          |

### 10.3 カスタムフィールド制限

| 制限             | 詳細                                       |
| ---------------- | ------------------------------------------ |
| フィールド数上限 | ワークスペースごとに最大約20フィールド     |
| 型制限           | text, options_list, date のみサポート      |
| 管理者設定       | カスタムフィールドの追加・削除は管理者のみ |

---

## 11. 今後の拡張計画

### Phase 2: slack-utils-user-status

- ユーザーステータス変更機能
- プリセットステータス
- 有効期限設定

### Phase 2: slack-utils-user-search

- 条件付きユーザー検索
- カスタムフィールド検索
- Admin/Owner/Guestフィルタ

### Phase 3: slack-utils-usergroup

- ユーザーグループ更新
- グループ一覧取得
- 有効化/無効化

---

## 12. 実装詳細

### 12.1 manifest.ts

```typescript
// manifest.ts
import { Manifest } from "deno-slack-sdk/mod.ts";
import { UpdateUserProfileDefinition } from "./functions/update_user_profile/mod.ts";
import { UpdateCustomFieldsDefinition } from "./functions/update_custom_fields/mod.ts";
import { CheckUserPermissionsDefinition } from "./functions/check_user_permissions/mod.ts";
import { GetCustomFieldDefinitionsDefinition } from "./functions/get_custom_field_definitions/mod.ts";
import { ShowProfileUpdateFormDefinition } from "./functions/show_profile_update_form/mod.ts";
import { GetAuthorizedApproversDefinition } from "./functions/get_authorized_approvers/mod.ts";
import UpdateProfileWorkflow from "./workflows/update_profile_workflow.ts";
import UpdateCustomFieldsWorkflow from "./workflows/update_custom_fields_workflow.ts";

const APP_NAME = Deno.env.get("SLACK_APP_NAME") || "Slack Utils User";
const APP_DESCRIPTION = Deno.env.get("SLACK_APP_DESCRIPTION") ||
  "ユーザープロフィール管理ワークフロー";

export default Manifest({
  name: APP_NAME,
  description: APP_DESCRIPTION,
  icon: "assets/icon.png",
  workflows: [
    UpdateProfileWorkflow,
    UpdateCustomFieldsWorkflow,
  ],
  functions: [
    UpdateUserProfileDefinition,
    UpdateCustomFieldsDefinition,
    CheckUserPermissionsDefinition,
    GetCustomFieldDefinitionsDefinition,
    ShowProfileUpdateFormDefinition,
    GetAuthorizedApproversDefinition,
  ],
  outgoingDomains: [],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "users:read",
    "users.profile:read",
    "team:read",
    "im:write",
  ],
});
```

### 12.2 import_map.json

```json
{
  "imports": {
    "deno-slack-sdk/": "https://deno.land/x/deno_slack_sdk@2.15.1/",
    "deno-slack-api/": "https://deno.land/x/deno_slack_api@2.8.0/",
    "std/": "https://deno.land/std@0.224.0/",
    "zod": "https://deno.land/x/zod@v3.23.8/mod.ts",
    "mock-fetch/": "https://deno.land/x/mock_fetch@0.3.0/"
  }
}
```

### 12.3 deno.jsonc

```jsonc
{
  "tasks": {
    "fmt": "deno fmt",
    "fmt:check": "deno fmt --check",
    "lint": "deno lint",
    "check": "deno check manifest.ts",
    "test": "LOCALE=ja deno test --allow-all",
    "test:coverage": "LOCALE=ja deno test --allow-all --coverage=cov",
    "coverage": "deno coverage cov --html"
  },
  "fmt": {
    "exclude": ["CHANGELOG.md", "cov/"]
  },
  "lint": {
    "exclude": ["cov/"]
  },
  "importMap": "import_map.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 12.4 .env.example

```bash
# Slack App Configuration
SLACK_APP_NAME=Slack Utils User
SLACK_APP_DESCRIPTION=ユーザープロフィール管理ワークフロー

# Admin User Token（他ユーザーのプロフィール更新に必須）
# 従来型 Slack App から取得した User OAuth Token（xoxp-で始まる）
# 必要なスコープ: users.profile:write
SLACK_ADMIN_USER_TOKEN=xoxp-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxx

# 承認チャンネルID（承認リクエストの送信先）
SLACK_APPROVAL_CHANNEL_ID=C0123456789

# ロケール設定（デフォルト: ja）
# サポート: ja, en
LOCALE=ja
```

### 12.5 slack.json

```json
{
  "hooks": {
    "get-manifest": "deno run -q --config=deno.jsonc --allow-read --allow-net --allow-env manifest.ts"
  },
  "environments": {
    "local": {
      "env_file": ".env"
    }
  }
}
```

### 12.6 GitHub Actions: deno-ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x

      - name: Verify formatting
        run: deno task fmt:check

      - name: Run linter
        run: deno task lint

      - name: Type check
        run: deno task check

      - name: Run tests
        env:
          LOCALE: ja
        run: deno task test
```

### 12.7 テストパターン

```typescript
// functions/update_user_profile/test.ts
import { assertEquals, assertExists } from "std/assert/mod.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { UpdateUserProfileDefinition } from "./mod.ts";

// 関数テスターの作成
const { createContext } = SlackFunctionTester(UpdateUserProfileDefinition);

Deno.test("UpdateUserProfile - 正常系: プロフィール更新成功", async () => {
  const inputs = {
    target_user_id: "U12345678",
    display_name: "山田 太郎",
    title: "シニアエンジニア",
  };

  const context = createContext({ inputs });

  // モックの設定
  const mockClient = {
    users: {
      profile: {
        set: async () => ({ ok: true }),
      },
    },
  };

  // テスト実行
  const result = await handler(context, mockClient);

  assertEquals(result.success, true);
  assertExists(result.updated_fields);
});

Deno.test("UpdateUserProfile - 異常系: ユーザーが見つからない", async () => {
  const inputs = {
    target_user_id: "U_INVALID",
  };

  const context = createContext({ inputs });

  const mockClient = {
    users: {
      profile: {
        set: async () => ({ ok: false, error: "user_not_found" }),
      },
    },
  };

  const result = await handler(context, mockClient);

  assertEquals(result.success, false);
  assertExists(result.error);
});
```

### 12.8 バリデーションスキーマ

```typescript
// lib/validation/schemas.ts
import { z } from "zod";

/**
 * ユーザーID形式のバリデーション
 */
export const userIdSchema = z.string()
  .regex(/^U[A-Z0-9]{8,}$/, "Invalid user ID format");

/**
 * チャンネルID形式のバリデーション
 */
export const channelIdSchema = z.string()
  .regex(/^[CDG][A-Z0-9]{8,}$/, "Invalid channel ID format");

/**
 * 空でない文字列のバリデーション
 */
export const nonEmptyStringSchema = z.string().min(1, "Cannot be empty");

/**
 * 表示名のバリデーション
 */
export const displayNameSchema = z.string()
  .max(80, "Display name must be 80 characters or less")
  .optional();

/**
 * 役職のバリデーション
 */
export const titleSchema = z.string()
  .max(100, "Title must be 100 characters or less")
  .optional();

/**
 * 電話番号のバリデーション
 */
export const phoneSchema = z.string()
  .regex(/^[\d\-+\s()]*$/, "Invalid phone number format")
  .optional();

/**
 * プロフィール更新入力のバリデーション
 */
export const profileUpdateInputSchema = z.object({
  target_user_id: userIdSchema,
  display_name: displayNameSchema,
  title: titleSchema,
  phone: phoneSchema,
  pronouns: z.string().max(50).optional(),
});
```

### 12.9 型定義

```typescript
// lib/types/profile.ts

/**
 * Slackプロフィールフィールド
 */
export interface ProfileFields {
  display_name?: string;
  title?: string;
  phone?: string;
  pronouns?: string;
  start_date?: string;
}

/**
 * カスタムフィールド定義
 */
export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: "text" | "options_list" | "date";
  options?: string[];
  hint?: string;
  is_hidden?: boolean;
}

/**
 * ユーザー権限情報
 */
export interface UserPermissions {
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}

/**
 * 承認リクエスト情報
 */
export interface ApprovalRequest {
  request_id: string;
  requester_id: string;
  target_user_id: string;
  approver_ids: string[];
  changes: ProfileChange[];
  reason?: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

/**
 * プロフィール変更情報
 */
export interface ProfileChange {
  field: string;
  old_value?: string;
  new_value?: string;
}

/**
 * 承認者情報
 */
export interface AuthorizedApprover {
  id: string;
  name: string;
  real_name?: string;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}
```

---

## 13. 参考リンク

- [Slack API: users.profile.set](https://api.slack.com/methods/users.profile.set)
- [Slack API: users.profile.get](https://api.slack.com/methods/users.profile.get)
- [Slack API: team.profile.get](https://api.slack.com/methods/team.profile.get)
- [Slack Platform Functions Reference](https://api.slack.com/reference/functions)
- [slack-utils-channel](https://github.com/leaveanest/slack-utils-channel)
- [Deno Slack SDK](https://api.slack.com/automation/deno-slack-sdk)
