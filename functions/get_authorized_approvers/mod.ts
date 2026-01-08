/**
 * GetAuthorizedApprovers function
 *
 * Fetches Admin and Owner users who can approve profile update requests.
 * Uses the users.list API to retrieve all users and filters for those with
 * admin or owner privileges.
 *
 * @module functions/get_authorized_approvers
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";

/**
 * Function definition for GetAuthorizedApprovers
 *
 * @example
 * ```typescript
 * // Use in workflow
 * const approversStep = workflow.addStep(GetAuthorizedApproversDefinition, {
 *   exclude_user_id: workflow.inputs.user_id,
 * });
 * ```
 */
export const GetAuthorizedApproversDefinition = DefineFunction({
  callback_id: "get_authorized_approvers",
  title: "承認者取得",
  description: "承認可能なAdmin/Ownerユーザーを取得します",
  source_file: "functions/get_authorized_approvers/mod.ts",
  input_parameters: {
    properties: {
      exclude_user_id: {
        type: Schema.slack.types.user_id,
        description: "結果から除外するユーザーID（リクエスト者自身など）",
      },
    },
    required: [],
  },
  output_parameters: {
    properties: {
      approver_ids: {
        type: Schema.types.array,
        items: { type: Schema.types.string },
        description: "承認可能なユーザーIDの一覧",
      },
      approvers_json: {
        type: Schema.types.string,
        description: "承認者詳細情報（JSON形式）",
      },
      count: {
        type: Schema.types.integer,
        description: "承認者の人数",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["approver_ids", "count"],
  },
});

/**
 * Approver information returned by this function
 */
interface Approver {
  id: string;
  name: string;
  real_name?: string;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
}

/**
 * admin.users.list APIのレスポンス型
 */
interface AdminUsersListResponse {
  ok: boolean;
  users?: Array<{
    id: string;
    username?: string;
    full_name?: string;
    email?: string;
    is_admin?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_bot?: boolean;
    deleted?: boolean;
    is_active?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

/**
 * ワークスペースの team_id を取得します
 *
 * @param client - Slack APIクライアント
 * @returns ワークスペースのteam_id
 * @throws {Error} auth.test API call fails
 */
async function getWorkspaceTeamId(
  // deno-lint-ignore no-explicit-any
  client: any,
): Promise<string> {
  const response = await client.auth.test();

  if (!response.ok) {
    throw new Error(
      t("errors.api_call_failed", {
        error: response.error ?? t("errors.unknown_error"),
      }),
    );
  }

  const teamId = response.team_id as string;

  if (!teamId) {
    throw new Error(t("errors.missing_team_id"));
  }

  return teamId;
}

/**
 * Admin API を使用してプライベートチャンネル作成権限を持つユーザーを取得します
 *
 * @param adminToken - 管理者のユーザートークン（xoxp-...）
 * @param teamId - ワークスペースのチームID
 * @param excludeUserId - 除外するユーザーID（オプション）
 * @returns 権限を持つユーザーのリスト
 * @throws {Error} APIリクエストに失敗した場合
 */
async function getApproversWithAdminApi(
  adminToken: string,
  teamId: string,
  excludeUserId?: string,
): Promise<Approver[]> {
  console.log(t("logs.fetching_authorized_users"));

  const approvers: Approver[] = [];
  let cursor: string | undefined;

  // 無限ループを防ぐための最大ページ数制限
  const MAX_PAGES = 50;
  let pageCount = 0;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.warn(
        t("logs.max_page_limit_reached", { limit: MAX_PAGES }),
      );
      break;
    }

    const params = new URLSearchParams({
      team_id: teamId,
      limit: "200",
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    console.log(
      "[GetAuthorizedApprovers] Calling admin.users.list with cursor:",
      cursor,
    );

    const response = await fetch(
      `https://slack.com/api/admin.users.list?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${adminToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );

    const result: AdminUsersListResponse = await response.json();

    console.log(
      "[GetAuthorizedApprovers] Response ok:",
      result.ok,
      "error:",
      result.error,
      "users count:",
      result.users?.length,
    );

    if (!result.ok) {
      throw new Error(
        t("errors.api_call_failed", {
          error: result.error ?? t("errors.unknown_error"),
        }),
      );
    }

    if (result.users) {
      for (const user of result.users) {
        // ボット、削除済み、ゲストユーザーを除外
        if (
          user.is_bot || user.deleted || user.is_restricted ||
          user.is_ultra_restricted
        ) {
          continue;
        }

        // Skip excluded user
        if (excludeUserId && user.id === excludeUserId) {
          continue;
        }

        // 管理者またはオーナーのみを抽出（重複を防ぐ）
        if (user.is_admin || user.is_owner || user.is_primary_owner) {
          // 既に追加済みのユーザーはスキップ
          if (approvers.some((u) => u.id === user.id)) {
            continue;
          }

          approvers.push({
            id: user.id,
            name: user.username ?? "",
            real_name: user.full_name ?? "",
            is_admin: user.is_admin ?? false,
            is_owner: user.is_owner ?? false,
            is_primary_owner: user.is_primary_owner ?? false,
          });
        }
      }
    }

    // カーソルチェックの改善: 空文字列、undefined、同じカーソルの場合はループ終了
    const newCursor = result.response_metadata?.next_cursor;
    if (!newCursor || newCursor === "" || newCursor === cursor) {
      break;
    }
    cursor = newCursor;
  } while (true);

  console.log(
    t("logs.authorized_users_fetched", { count: approvers.length }),
  );

  return approvers;
}

/**
 * GetAuthorizedApprovers function implementation
 *
 * Retrieves all Admin and Owner users from the workspace who can
 * approve profile update requests.
 *
 * @param inputs - Function inputs
 * @param inputs.exclude_user_id - Optional user ID to exclude from results
 * @param client - Slack API client
 * @param env - Environment variables
 * @returns List of authorized approvers
 *
 * @throws {Error} When admin.users.list API call fails
 */
export default SlackFunction(
  GetAuthorizedApproversDefinition,
  async ({ inputs, client, env }) => {
    // Initialize i18n system
    await initI18n();

    try {
      // 環境変数から Admin User Token を取得
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;

      if (!adminToken) {
        throw new Error(t("errors.missing_admin_token"));
      }

      // ワークスペースの team_id を取得
      const teamId = await getWorkspaceTeamId(client);

      // Admin API で権限を持つユーザーを取得
      const approvers = await getApproversWithAdminApi(
        adminToken,
        teamId,
        inputs.exclude_user_id,
      );

      return {
        outputs: {
          approver_ids: approvers.map((a) => a.id),
          approvers_json: JSON.stringify(approvers),
          count: approvers.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.api_call_failed", { error: message }));
      return {
        error: t("errors.api_call_failed", { error: message }),
        outputs: {
          approver_ids: [],
          approvers_json: "[]",
          count: 0,
        },
      };
    }
  },
);
