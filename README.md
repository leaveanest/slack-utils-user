# slack-utils-user

Slack
ユーザープロフィールとカスタムフィールドを管理するワークフローアプリケーションです。

[![CI](https://github.com/leaveanest/slack-utils-user/actions/workflows/ci.yml/badge.svg)](https://github.com/leaveanest/slack-utils-user/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 概要

- Slack ユーザープロフィール（表示名、役職、電話番号など）の更新機能
- カスタムフィールド（部門、入社日、従業員番号など）の更新機能
- 管理者承認ワークフローによる安全な他ユーザープロフィール更新
- Slack Deno SDK v2.x を利用し、関数・ワークフロー・トリガーを一貫して管理

## 機能一覧

### プロフィール更新ワークフロー

- **自分のプロフィール更新**: 一般ユーザーが自分の許可されたフィールドを更新
- **他ユーザープロフィール更新**: 管理者承認後に他ユーザーのプロフィールを更新
- **管理者直接更新**: Admin/Owner は承認なしで任意のユーザーを更新可能

### カスタムフィールド更新ワークフロー

- **カスタムフィールドフォーム表示**:
  ワークスペースに設定されたカスタムフィールドを動的に表示
- **現在値の自動取得**: モーダルを開くと現在の値が初期表示される
- **複数フィールドタイプ対応**: テキスト、日付、選択リストに対応

## 前提条件

- **Deno 1.37+** がインストールされていること
- **Slack CLI** が利用可能で、ワークスペースにログイン済みであること
- **Slack App** を作成できる権限を持っていること
- **Git** がインストールされていること（Git Hooks使用時）

## セットアップ

```bash
# リポジトリを取得
git clone https://github.com/leaveanest/slack-utils-user.git
cd slack-utils-user

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集

# Slack CLIでログイン
slack login

# Git hooks をセットアップ（推奨）
bash scripts/setup-git-hooks.sh
```

### 環境変数の設定

`.env` ファイルで以下の変数を設定してください：

```bash
# 必須: 他ユーザープロフィール更新用のAdmin User Token
# Slack API Apps で取得（users.profile:write スコープが必要）
SLACK_ADMIN_USER_TOKEN=xoxp-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# オプション: 承認リクエスト送信先チャンネル
SLACK_APPROVAL_CHANNEL_ID=C0123456789

# オプション: ロケール設定（デフォルト: ja）
LOCALE=ja
```

### Admin User Token の取得方法

1. [Slack API Apps](https://api.slack.com/apps) で従来型 App を作成
2. 「OAuth & Permissions」→「User Token Scopes」に `users.profile:write` を追加
3. 「Install to Workspace」でワークスペースにインストール
4. 「User OAuth Token」（`xoxp-` で始まる）をコピー
5. `.env` の `SLACK_ADMIN_USER_TOKEN` に設定

## 使い方

### ローカル開発

```bash
# アプリを起動
slack run

# トリガーを作成
slack trigger create --trigger-def triggers/update_profile_shortcut.ts
slack trigger create --trigger-def triggers/update_custom_fields_shortcut.ts
```

### Slack からの使用

1. Slack で任意のチャンネルを開く
2. メッセージ入力欄の「+」ボタンをクリック
3. 「ショートカット」または「ワークフロー」を選択
4. 「プロフィールを更新」または「カスタムフィールドを更新」を選択

## 開発

### コマンド一覧

```bash
# フォーマット
deno task fmt

# リント
deno task lint

# 型チェック
deno task check

# テスト
deno task test

# カバレッジ付きテスト
deno test --allow-all --coverage=cov
deno coverage cov --html

# i18n 整合性チェック
deno task i18n:check

# 全チェック（CI相当）
deno task cursor-ci
```

### テスト

```bash
# 全テストを実行
deno task test

# 特定の関数のテスト
deno test --allow-all functions/show_custom_fields_form/test.ts
```

## プロジェクト構成

```
slack-utils-user/
├── functions/              # Slack Functions
│   ├── check_user_permissions/    # 権限チェック
│   ├── get_authorized_approvers/  # 承認者取得
│   ├── get_custom_field_definitions/ # カスタムフィールド定義取得
│   ├── show_custom_fields_form/   # カスタムフィールドフォーム表示
│   ├── show_profile_update_form/  # プロフィール更新フォーム表示
│   ├── update_custom_fields/      # カスタムフィールド更新
│   └── update_user_profile/       # ユーザープロフィール更新
├── workflows/              # Slack Workflows
│   ├── update_custom_fields_workflow.ts
│   └── update_profile_workflow.ts
├── triggers/               # Slack Triggers
├── lib/                    # 共通ライブラリ
│   ├── i18n/              # 多言語対応
│   ├── types/             # 型定義
│   └── validation/        # Zodスキーマ
├── locales/               # 翻訳ファイル
│   ├── en.json            # 英語
│   └── ja.json            # 日本語
├── docs/                  # ドキュメント
├── .github/               # CI/CD
└── manifest.ts            # Slackアプリマニフェスト
```

## 多言語対応（I18n）

このプロジェクトは、英語と日本語の多言語対応をサポートしています。

### サポート言語

- **日本語 (ja)** - デフォルト言語
- **English (en)** - ベース言語

### 言語の切り替え

```bash
# 日本語で実行（デフォルト）
export LOCALE=ja
slack run

# 英語で実行
export LOCALE=en
slack run
```

### 自動翻訳

`locales/en.json` が更新されると、GitHub Actions
が自動的に日本語への翻訳を実行し、PR を作成します。

詳細は [`docs/i18n-guide.md`](docs/i18n-guide.md) を参照してください。

## 関連プロジェクト

- [slack-utils-channel](https://github.com/leaveanest/slack-utils-channel) -
  チャンネル管理ワークフロー

## コントリビューション

コントリビューションを歓迎します！詳細は [CONTRIBUTING.md](CONTRIBUTING.md)
を参照してください。

## ライセンス

本プロジェクトは MIT ライセンスで提供されています。詳細は [LICENSE](LICENSE)
を参照してください。

## セキュリティ

セキュリティに関する問題を発見した場合は、[SECURITY.md](SECURITY.md)
を参照してください。

## 行動規範

このプロジェクトは [Contributor Covenant](CODE_OF_CONDUCT.md)
行動規範を採用しています。
