/**
 * ShowProfileUpdateForm function
 *
 * Displays a modal form for updating user profiles with approval workflow support.
 * Handles both direct updates (for admins/self-editable fields) and approval requests.
 *
 * Flow:
 * 1. Show loading modal immediately (to avoid interactivity timeout)
 * 2. Fetch user permissions and available approvers
 * 3. Update modal with the profile update form
 * 4. Handle form submission → direct update or approval request
 * 5. Handle approval/denial from approvers
 *
 * @module functions/show_profile_update_form
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { t } from "../../lib/i18n/mod.ts";
import {
  DEFAULT_PERMISSION_CONFIG,
  type PermissionConfig,
} from "../../lib/types/profile.ts";

// Callback IDs for modal and block actions
const FORM_CALLBACK_ID = "profile_update_form";
const APPROVE_ACTION_ID = "approve_profile_update";
const DENY_ACTION_ID = "deny_profile_update";

/**
 * Function definition for ShowProfileUpdateForm
 */
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

/**
 * Get permission configuration from environment
 */
function getPermissionConfig(): PermissionConfig {
  return {
    ...DEFAULT_PERMISSION_CONFIG,
    approval_channel_id: Deno.env.get("SLACK_APPROVAL_CHANNEL_ID") ?? "",
  };
}

/**
 * Build loading modal view
 */
function buildLoadingView() {
  return {
    type: "modal" as const,
    callback_id: FORM_CALLBACK_ID,
    title: {
      type: "plain_text" as const,
      text: t("form.loading_title"),
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: t("form.loading_message"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: t("form.loading_hint"),
          },
        ],
      },
    ],
  };
}

/**
 * Build profile update form view
 */
function buildProfileFormView(
  operatorId: string,
  isAdminOrOwner: boolean,
  approvers: Array<{ id: string; name: string; real_name?: string }>,
) {
  const blocks: Array<Record<string, unknown>> = [];

  // Target user selection (for admins, can select any user)
  blocks.push({
    type: "input",
    block_id: "target_user_block",
    element: {
      type: "users_select",
      action_id: "target_user",
      placeholder: {
        type: "plain_text",
        text: t("form.target_user_placeholder"),
      },
      initial_user: operatorId,
    },
    label: {
      type: "plain_text",
      text: t("form.target_user_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.target_user_hint"),
    },
  });

  // Display name
  blocks.push({
    type: "input",
    block_id: "display_name_block",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "display_name",
      placeholder: {
        type: "plain_text",
        text: t("form.display_name_placeholder"),
      },
    },
    label: {
      type: "plain_text",
      text: t("form.display_name_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.display_name_hint"),
    },
  });

  // Title
  blocks.push({
    type: "input",
    block_id: "title_block",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "title",
      placeholder: {
        type: "plain_text",
        text: t("form.title_placeholder"),
      },
    },
    label: {
      type: "plain_text",
      text: t("form.title_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.title_hint"),
    },
  });

  // Phone
  blocks.push({
    type: "input",
    block_id: "phone_block",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "phone",
      placeholder: {
        type: "plain_text",
        text: t("form.phone_placeholder"),
      },
    },
    label: {
      type: "plain_text",
      text: t("form.phone_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.phone_hint"),
    },
  });

  // Pronouns
  blocks.push({
    type: "input",
    block_id: "pronouns_block",
    optional: true,
    element: {
      type: "plain_text_input",
      action_id: "pronouns",
      placeholder: {
        type: "plain_text",
        text: t("form.pronouns_placeholder"),
      },
    },
    label: {
      type: "plain_text",
      text: t("form.pronouns_label"),
    },
    hint: {
      type: "plain_text",
      text: t("form.pronouns_hint"),
    },
  });

  // Approver selection (only for non-admin users)
  if (!isAdminOrOwner && approvers.length > 0) {
    const approverOptions = approvers.map((a) => ({
      text: {
        type: "plain_text" as const,
        text: a.real_name ?? a.name,
      },
      value: a.id,
    }));

    blocks.push({
      type: "input",
      block_id: "approver_block",
      element: {
        type: "multi_static_select",
        action_id: "approvers",
        placeholder: {
          type: "plain_text",
          text: t("form.approver_placeholder_multiple"),
        },
        options: approverOptions,
      },
      label: {
        type: "plain_text",
        text: t("form.approver_label_multiple"),
      },
      hint: {
        type: "plain_text",
        text: t("form.approver_hint_multiple"),
      },
    });

    // Reason for change
    blocks.push({
      type: "input",
      block_id: "reason_block",
      optional: true,
      element: {
        type: "plain_text_input",
        action_id: "reason",
        placeholder: {
          type: "plain_text",
          text: t("form.reason_placeholder"),
        },
      },
      label: {
        type: "plain_text",
        text: t("form.reason_label"),
      },
      hint: {
        type: "plain_text",
        text: t("form.reason_hint"),
      },
    });
  }

  return {
    type: "modal" as const,
    callback_id: FORM_CALLBACK_ID,
    private_metadata: JSON.stringify({
      operator_id: operatorId,
      is_admin_or_owner: isAdminOrOwner,
    }),
    title: {
      type: "plain_text" as const,
      text: t("form.title"),
    },
    submit: {
      type: "plain_text" as const,
      text: isAdminOrOwner ? t("form.submit_button") : t("form.request_button"),
    },
    close: {
      type: "plain_text" as const,
      text: t("form.cancel_button"),
    },
    blocks,
  };
}

/**
 * Build approval request message blocks
 */
function buildApprovalMessage(
  requesterId: string,
  targetUserId: string,
  changes: Record<string, string>,
  reason?: string,
  approverIds?: string[],
) {
  const changesText = Object.entries(changes)
    .map(([field, value]) => `• *${field}*: ${value}`)
    .join("\n");

  const approverMentions = approverIds?.map((id) => `<@${id}>`).join(", ") ??
    "";

  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: t("messages.approval_request_header"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: t("messages.approval_request_details", {
          requester: requesterId,
          target: targetUserId,
          changes: changesText,
        }),
      },
    },
  ];

  if (reason) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${t("form.reason_label")}:* ${reason}`,
      },
    });
  }

  if (approverMentions) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `👤 ${t("form.approver_label_multiple")}: ${approverMentions}`,
        },
      ],
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: t("messages.approve_button"),
        },
        style: "primary",
        action_id: APPROVE_ACTION_ID,
        value: JSON.stringify({
          requester_id: requesterId,
          target_user_id: targetUserId,
          changes,
          approver_ids: approverIds,
        }),
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: t("messages.deny_button"),
        },
        style: "danger",
        action_id: DENY_ACTION_ID,
        value: JSON.stringify({
          requester_id: requesterId,
          target_user_id: targetUserId,
          changes,
          approver_ids: approverIds,
        }),
      },
    ],
  });

  return blocks;
}

/**
 * Check if user is admin or owner
 */
async function checkUserPermissions(
  client: {
    users: {
      info: (params: { user: string }) => Promise<{
        ok: boolean;
        error?: string;
        user?: {
          is_admin?: boolean;
          is_owner?: boolean;
          is_primary_owner?: boolean;
        };
      }>;
    };
  },
  userId: string,
): Promise<{ isAdminOrOwner: boolean; error?: string }> {
  const response = await client.users.info({ user: userId });
  if (!response.ok) {
    return { isAdminOrOwner: false, error: response.error };
  }

  const isAdminOrOwner = response.user?.is_admin ||
    response.user?.is_owner ||
    response.user?.is_primary_owner ||
    false;

  return { isAdminOrOwner };
}

/**
 * Fetch authorized approvers
 */
async function fetchApprovers(
  client: {
    users: {
      list: (params: { cursor?: string; limit: number }) => Promise<{
        ok: boolean;
        error?: string;
        members?: Array<{
          id?: string;
          name?: string;
          real_name?: string;
          is_admin?: boolean;
          is_owner?: boolean;
          is_primary_owner?: boolean;
          is_bot?: boolean;
          deleted?: boolean;
        }>;
        response_metadata?: { next_cursor?: string };
      }>;
    };
  },
  excludeUserId?: string,
): Promise<Array<{ id: string; name: string; real_name?: string }>> {
  const approvers: Array<{ id: string; name: string; real_name?: string }> = [];
  let cursor: string | undefined;

  do {
    const response = await client.users.list({ cursor, limit: 200 });
    if (!response.ok) break;

    if (response.members) {
      for (const member of response.members) {
        if (member.is_bot || member.deleted) continue;
        if (excludeUserId && member.id === excludeUserId) continue;
        if (member.is_admin || member.is_owner || member.is_primary_owner) {
          approvers.push({
            id: member.id ?? "",
            name: member.name ?? "",
            real_name: member.real_name,
          });
        }
      }
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return approvers;
}

/**
 * Update profile using Admin User Token
 */
async function updateProfile(
  userId: string,
  profile: Record<string, string>,
  adminToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${adminToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ user: userId, profile }),
  });
  const result = await response.json();
  return { ok: result.ok === true, error: result.error };
}

/**
 * Main function handler
 */
export default SlackFunction(
  ShowProfileUpdateFormDefinition,
  async ({ inputs, client }) => {
    const { interactivity, user_id, channel_id: _channel_id } = inputs;

    console.log(t("logs.starting"));

    try {
      // 1. Show loading modal immediately
      const loadingResult = await client.views.open({
        trigger_id: interactivity.interactivity_pointer,
        view: buildLoadingView(),
      });

      if (!loadingResult.ok) {
        console.error(
          t("errors.modal_open_failed", { error: loadingResult.error ?? "" }),
        );
        return {
          error: t("errors.modal_open_failed", {
            error: loadingResult.error ?? "",
          }),
          outputs: { success: false },
        };
      }

      const viewId = loadingResult.view?.id;

      // 2. Fetch user permissions and approvers in parallel
      const [permResult, approvers] = await Promise.all([
        checkUserPermissions(client, user_id),
        fetchApprovers(client, user_id),
      ]);

      if (permResult.error) {
        return {
          error: t("errors.api_call_failed", { error: permResult.error }),
          outputs: { success: false },
        };
      }

      console.log(
        t("logs.authorized_users_fetched", { count: approvers.length }),
      );

      // 3. Update modal with profile form
      const formView = buildProfileFormView(
        user_id,
        permResult.isAdminOrOwner,
        approvers,
      );
      const updateResult = await client.views.update({
        view_id: viewId,
        view: formView,
      });

      if (!updateResult.ok) {
        console.error(
          t("errors.modal_update_failed", { error: updateResult.error ?? "" }),
        );
        return {
          error: t("errors.modal_update_failed", {
            error: updateResult.error ?? "",
          }),
          outputs: { success: false },
        };
      }

      console.log(t("logs.modal_opened"));

      // Return incomplete to wait for form submission
      return { completed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(t("errors.api_call_failed", { error: message }));
      return {
        error: t("errors.api_call_failed", { error: message }),
        outputs: { success: false },
      };
    }
  },
)
  // Handle form submission
  .addViewSubmissionHandler(
    FORM_CALLBACK_ID,
    async ({ view, client, env }) => {
      console.log(t("logs.form_submitted"));

      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata ?? "{}");
      const operatorId = metadata.operator_id;
      const isAdminOrOwner = metadata.is_admin_or_owner;

      // Extract form values
      const targetUserId =
        values.target_user_block?.target_user?.selected_user ?? operatorId;
      const displayName = values.display_name_block?.display_name?.value ?? "";
      const title = values.title_block?.title?.value ?? "";
      const phone = values.phone_block?.phone?.value ?? "";
      const pronouns = values.pronouns_block?.pronouns?.value ?? "";
      const approverIds =
        values.approver_block?.approvers?.selected_options?.map(
          (opt: { value: string }) => opt.value,
        ) ?? [];
      const reason = values.reason_block?.reason?.value ?? "";

      // Build profile changes
      const changes: Record<string, string> = {};
      if (displayName) changes.display_name = displayName;
      if (title) changes.title = title;
      if (phone) changes.phone = phone;
      if (pronouns) changes.pronouns = pronouns;

      if (Object.keys(changes).length === 0) {
        return {
          response_action: "errors",
          errors: {
            display_name_block: t("errors.no_fields_to_update"),
          },
        };
      }

      const config = getPermissionConfig();
      const isSelf = operatorId === targetUserId;

      // Determine if direct execution is allowed
      const canExecuteDirectly = isAdminOrOwner ||
        (isSelf &&
          Object.keys(changes).every((f) =>
            config.allowed_self_edit_fields.includes(f)
          ));

      if (canExecuteDirectly) {
        // Direct execution
        const adminToken = env.SLACK_ADMIN_USER_TOKEN;
        if (!adminToken) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.missing_admin_token"),
            },
          };
        }

        const result = await updateProfile(targetUserId, changes, adminToken);
        if (!result.ok) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.profile_update_failed", {
                error: result.error ?? "",
              }),
            },
          };
        }

        // Send success notification
        await client.chat.postMessage({
          channel: operatorId,
          text: t("messages.profile_updated_for_user", {
            userId: targetUserId,
          }),
        });

        // Complete the function
        await client.functions.completeSuccess({
          function_execution_id: view.function_data?.execution_id ?? "",
          outputs: {
            success: true,
            approval_required: false,
            updated_user_id: targetUserId,
          },
        });
      } else {
        // Approval required
        if (!approverIds || approverIds.length === 0) {
          return {
            response_action: "errors",
            errors: {
              approver_block: t("errors.no_approver_selected"),
            },
          };
        }

        if (!config.approval_channel_id) {
          return {
            response_action: "errors",
            errors: {
              approver_block: t("errors.missing_approval_channel"),
            },
          };
        }

        // Send approval request
        const blocks = buildApprovalMessage(
          operatorId,
          targetUserId,
          changes,
          reason,
          approverIds,
        );

        await client.chat.postMessage({
          channel: config.approval_channel_id,
          blocks,
          text: t("messages.approval_request_header"),
        });

        // Notify requester
        await client.chat.postMessage({
          channel: operatorId,
          text: t("messages.approval_request_sent"),
        });

        // Complete the function
        await client.functions.completeSuccess({
          function_execution_id: view.function_data?.execution_id ?? "",
          outputs: {
            success: true,
            approval_required: true,
            updated_user_id: targetUserId,
          },
        });
      }

      return;
    },
  )
  // Handle approval action
  .addBlockActionsHandler(
    [APPROVE_ACTION_ID],
    async ({ action, body, client, env }) => {
      console.log(
        t("logs.processing_approval", {
          action: "approve",
          reviewer: body.user.id,
        }),
      );

      const data = JSON.parse(action.value);
      const { requester_id, target_user_id, changes, approver_ids } = data;
      const reviewerId = body.user.id;

      // Check if reviewer is authorized
      if (approver_ids && !approver_ids.includes(reviewerId)) {
        // Check if reviewer is admin/owner
        const permResult = await checkUserPermissions(client, reviewerId);
        if (!permResult.isAdminOrOwner) {
          await client.chat.postEphemeral({
            channel: body.channel?.id ?? "",
            user: reviewerId,
            text: t("errors.not_authorized_approver_multiple", {
              approvers: approver_ids.map((id: string) => `<@${id}>`).join(
                ", ",
              ),
            }),
          });
          return;
        }
      }

      // Get admin token
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        await client.chat.postEphemeral({
          channel: body.channel?.id ?? "",
          user: reviewerId,
          text: t("errors.missing_admin_token"),
        });
        return;
      }

      // Update profile
      const result = await updateProfile(target_user_id, changes, adminToken);
      if (!result.ok) {
        await client.chat.postEphemeral({
          channel: body.channel?.id ?? "",
          user: reviewerId,
          text: t("errors.profile_update_failed", {
            error: result.error ?? "",
          }),
        });
        return;
      }

      // Update the message to show approval
      const approvedText = t("messages.request_approved", {
        approver: reviewerId,
        requester: requester_id,
        target: target_user_id,
      });

      await client.chat.update({
        channel: body.channel?.id ?? "",
        ts: body.message?.ts ?? "",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: approvedText,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: t("messages.approved_at", {
                  time: new Date().toISOString(),
                }),
              },
            ],
          },
        ],
        text: approvedText,
      });

      // Notify requester
      await client.chat.postMessage({
        channel: requester_id,
        text: t("messages.update_success_notification", {
          target: target_user_id,
          updater: reviewerId,
          changes: Object.entries(changes).map(([k, v]) => `• ${k}: ${v}`).join(
            "\n",
          ),
        }),
      });
    },
  )
  // Handle denial action
  .addBlockActionsHandler(
    [DENY_ACTION_ID],
    async ({ action, body, client }) => {
      console.log(
        t("logs.processing_approval", {
          action: "deny",
          reviewer: body.user.id,
        }),
      );

      const data = JSON.parse(action.value);
      const { requester_id, target_user_id, approver_ids } = data;
      const reviewerId = body.user.id;

      // Check if reviewer is authorized
      if (approver_ids && !approver_ids.includes(reviewerId)) {
        const permResult = await checkUserPermissions(client, reviewerId);
        if (!permResult.isAdminOrOwner) {
          await client.chat.postEphemeral({
            channel: body.channel?.id ?? "",
            user: reviewerId,
            text: t("errors.not_authorized_approver_multiple", {
              approvers: approver_ids.map((id: string) => `<@${id}>`).join(
                ", ",
              ),
            }),
          });
          return;
        }
      }

      // Update the message to show denial
      const deniedText = t("messages.request_denied", {
        approver: reviewerId,
        requester: requester_id,
        target: target_user_id,
      });

      await client.chat.update({
        channel: body.channel?.id ?? "",
        ts: body.message?.ts ?? "",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: deniedText,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: t("messages.denied_at", {
                  time: new Date().toISOString(),
                }),
              },
            ],
          },
        ],
        text: deniedText,
      });

      // Notify requester
      await client.chat.postMessage({
        channel: requester_id,
        text: deniedText,
      });
    },
  );
