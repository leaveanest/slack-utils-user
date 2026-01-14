/**
 * UpdateCustomFieldsWorkflow definition
 *
 * ユーザーのカスタムフィールドを更新するワークフローです。
 * 権限に応じて直接実行または承認リクエストを送信します。
 *
 * 処理の流れ:
 * 1. ローディングモーダルを即座に表示
 * 2. 権限チェック・フォーム構築
 * 3. モーダルを本来のフォームに更新
 * 4. フォーム送信を処理
 * 5. 権限に応じて直接実行 or 承認リクエスト
 *
 * @module workflows/update_custom_fields_workflow
 */

import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ShowCustomFieldsFormDefinition } from "../functions/show_custom_fields_form/mod.ts";

/**
 * カスタムフィールド更新ワークフロー
 *
 * ユーザーのカスタムフィールド情報を更新します。
 * Admin/Ownerは直接実行可能、一般ユーザーは承認リクエストを送信します。
 */
const UpdateCustomFieldsWorkflow = DefineWorkflow({
  callback_id: "update_custom_fields_workflow",
  title: "カスタムフィールドを更新",
  description: "ユーザーのカスタムフィールド情報を更新します",
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
UpdateCustomFieldsWorkflow.addStep(
  ShowCustomFieldsFormDefinition,
  {
    interactivity: UpdateCustomFieldsWorkflow.inputs.interactivity,
    user_id: UpdateCustomFieldsWorkflow.inputs.user_id,
    channel_id: UpdateCustomFieldsWorkflow.inputs.channel_id,
  },
);

export default UpdateCustomFieldsWorkflow;
