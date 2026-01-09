/**
 * UpdateProfileWorkflow definition
 *
 * ユーザーのプロフィールを更新するワークフローです。
 * 権限に応じて直接実行または承認リクエストを送信します。
 *
 * 処理の流れ:
 * 1. ローディングモーダルを即座に表示
 * 2. 権限チェック・フォーム構築
 * 3. モーダルを本来のフォームに更新
 * 4. フォーム送信を処理
 * 5. 権限に応じて直接実行 or 承認リクエスト
 *
 * @module workflows/update_profile_workflow
 */

import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ShowProfileUpdateFormDefinition } from "../functions/show_profile_update_form/mod.ts";

/**
 * プロフィール更新ワークフロー
 *
 * ユーザーのプロフィール情報を更新します。
 * Admin/Ownerは直接実行可能、一般ユーザーは承認リクエストを送信します。
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
