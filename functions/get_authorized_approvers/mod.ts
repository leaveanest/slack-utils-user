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
import { t } from "../../lib/i18n/mod.ts";

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
      approvers: {
        type: Schema.types.array,
        items: {
          type: Schema.types.object,
          properties: {
            id: { type: Schema.types.string },
            name: { type: Schema.types.string },
            real_name: { type: Schema.types.string },
            is_admin: { type: Schema.types.boolean },
            is_owner: { type: Schema.types.boolean },
            is_primary_owner: { type: Schema.types.boolean },
          },
          required: ["id", "name", "is_admin", "is_owner"],
        },
        description: "承認可能なユーザーの一覧",
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
    required: ["approvers", "count"],
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
 * GetAuthorizedApprovers function implementation
 *
 * Retrieves all Admin and Owner users from the workspace who can
 * approve profile update requests.
 *
 * @param inputs - Function inputs
 * @param inputs.exclude_user_id - Optional user ID to exclude from results
 * @param client - Slack API client
 * @returns List of authorized approvers
 *
 * @throws {Error} When users.list API call fails
 */
export default SlackFunction(
  GetAuthorizedApproversDefinition,
  async ({ inputs, client }) => {
    console.log(t("logs.fetching_authorized_users"));

    try {
      const approvers: Approver[] = [];
      let cursor: string | undefined;

      // Paginate through all users
      do {
        const response = await client.users.list({
          cursor,
          limit: 200,
        });

        if (!response.ok) {
          const errorCode = response.error ?? "unknown_error";
          console.error(t("errors.api_call_failed", { error: errorCode }));
          return {
            error: t("errors.api_call_failed", { error: errorCode }),
            outputs: {
              approvers: [],
              count: 0,
            },
          };
        }

        // Filter for Admin/Owner users
        if (response.members) {
          for (const member of response.members) {
            // Skip bots and deleted users
            if (member.is_bot || member.deleted) {
              continue;
            }

            // Skip excluded user
            if (
              inputs.exclude_user_id && member.id === inputs.exclude_user_id
            ) {
              continue;
            }

            // Include Admin, Owner, or Primary Owner
            if (member.is_admin || member.is_owner || member.is_primary_owner) {
              approvers.push({
                id: member.id ?? "",
                name: member.name ?? "",
                real_name: member.real_name,
                is_admin: member.is_admin ?? false,
                is_owner: member.is_owner ?? false,
                is_primary_owner: member.is_primary_owner ?? false,
              });
            }
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      console.log(
        t("logs.authorized_users_fetched", { count: approvers.length }),
      );

      return {
        outputs: {
          approvers,
          count: approvers.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.api_call_failed", { error: message }));
      return {
        error: t("errors.api_call_failed", { error: message }),
        outputs: {
          approvers: [],
          count: 0,
        },
      };
    }
  },
);
