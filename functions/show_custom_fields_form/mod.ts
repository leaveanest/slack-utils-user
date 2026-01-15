/**
 * ShowCustomFieldsForm function
 *
 * Displays a modal form for updating custom fields with approval workflow support.
 * Fetches custom field definitions from team.profile.get API and
 * creates appropriate input elements based on field types.
 * For non-admin users, requires approval from admins/owners.
 *
 * @module functions/show_custom_fields_form
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import type { CustomFieldDefinitionDetail } from "../../lib/types/custom_fields.ts";

// Callback IDs for modal and block actions
const FORM_CALLBACK_ID = "custom_fields_form_modal";
const APPROVE_ACTION_ID = "approve_custom_fields_update";
const DENY_ACTION_ID = "deny_custom_fields_update";
const TARGET_USER_ACTION_ID = "target_user_select";

/**
 * Slack client type definition
 */
interface SlackClient {
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
  conversations: {
    open: (params: { users: string }) => Promise<{
      ok: boolean;
      error?: string;
      channel?: { id: string };
    }>;
  };
  chat: {
    postMessage: (params: {
      channel: string;
      text: string;
      blocks?: unknown[];
    }) => Promise<{ ok: boolean; error?: string }>;
    postEphemeral: (params: {
      channel: string;
      user: string;
      text: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    update: (params: {
      channel: string;
      ts: string;
      text: string;
      blocks?: unknown[];
    }) => Promise<{ ok: boolean; error?: string }>;
  };
}

/**
 * Admin users list API response type
 */
interface AdminUsersListResponse {
  ok: boolean;
  error?: string;
  users?: Array<{
    id: string;
    username?: string;
    full_name?: string;
    is_admin?: boolean;
    is_owner?: boolean;
    is_primary_owner?: boolean;
    is_bot?: boolean;
    deleted?: boolean;
    is_restricted?: boolean;
    is_ultra_restricted?: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
}

/**
 * Fetch approvers result type
 */
interface FetchApproversResult {
  approvers: Array<{ id: string; name: string; real_name?: string }>;
  error?: string;
}

/**
 * Function definition for ShowCustomFieldsForm
 *
 * @example
 * ```typescript
 * // Use in workflow
 * workflow.addStep(ShowCustomFieldsFormDefinition, {
 *   interactivity: workflow.inputs.interactivity,
 *   user_id: workflow.inputs.user_id,
 *   channel_id: workflow.inputs.channel_id,
 * });
 * ```
 */
export const ShowCustomFieldsFormDefinition = DefineFunction({
  callback_id: "show_custom_fields_form",
  title: "カスタムフィールド更新フォーム表示",
  description: "カスタムフィールド更新用のモーダルフォームを表示します",
  source_file: "functions/show_custom_fields_form/mod.ts",
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
 * Block element type for input blocks
 */
interface BlockElement {
  type: string;
  block_id: string;
  optional: boolean;
  element: Record<string, unknown>;
  label: {
    type: string;
    text: string;
  };
  hint?: {
    type: string;
    text: string;
  };
}

/**
 * Creates a Block Kit input element based on field type
 *
 * @param field - Custom field definition
 * @param currentValue - Optional current value for the field
 * @param blockIdSuffix - Optional suffix for block_id to force Slack to use new initial values
 * @returns Block Kit input block
 */
function createFieldInput(
  field: CustomFieldDefinitionDetail,
  currentValue?: string,
  blockIdSuffix?: string,
): BlockElement {
  // Use suffix to force Slack to treat as new field and apply initial values
  const blockId = `field_${field.id}${blockIdSuffix ?? ""}`;
  const actionId = `input_${field.id}`;

  switch (field.type) {
    case "options_list":
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "static_select",
          action_id: actionId,
          placeholder: {
            type: "plain_text",
            text: t("messages.select_field_placeholder"),
          },
          options: (field.possible_values || []).map((v) => ({
            text: { type: "plain_text", text: v },
            value: v,
          })),
          ...(currentValue && {
            initial_option: {
              text: { type: "plain_text", text: currentValue },
              value: currentValue,
            },
          }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        ...(field.hint && {
          hint: {
            type: "plain_text",
            text: field.hint,
          },
        }),
      };

    case "date":
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "datepicker",
          action_id: actionId,
          ...(currentValue && { initial_date: currentValue }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        ...(field.hint && {
          hint: {
            type: "plain_text",
            text: field.hint,
          },
        }),
      };

    case "text":
    default:
      return {
        type: "input",
        block_id: blockId,
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: actionId,
          ...(currentValue && { initial_value: currentValue }),
        },
        label: {
          type: "plain_text",
          text: field.label,
        },
        ...(field.hint && {
          hint: {
            type: "plain_text",
            text: field.hint,
          },
        }),
      };
  }
}

/**
 * team.profile.get API response field type
 */
interface ProfileField {
  id: string;
  ordering: number;
  label: string;
  hint: string;
  type: string;
  possible_values: string[] | null;
  options?: {
    is_scim: boolean;
    is_protected: boolean;
  };
  is_hidden: boolean;
  section_id: string;
}

/**
 * Field change with old and new values for diff display
 */
interface FieldChange {
  old: string;
  new: string;
}

/**
 * Check if user is admin or owner
 */
async function checkUserPermissions(
  client: SlackClient,
  userId: string,
): Promise<{ isAdminOrOwner: boolean; error?: string }> {
  console.log("[checkUserPermissions] Calling users.info with userId:", userId);
  const response = await client.users.info({ user: userId });
  console.log(
    "[checkUserPermissions] Response ok:",
    response.ok,
    "error:",
    response.error,
  );
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
 * Fetch authorized approvers (admins and owners)
 */
async function fetchApprovers(
  adminToken: string,
  teamId: string,
  excludeUserId?: string,
): Promise<FetchApproversResult> {
  const approvers: Array<{ id: string; name: string; real_name?: string }> = [];
  let cursor: string | undefined;

  const MAX_PAGES = 50;
  let pageCount = 0;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      console.warn(t("logs.max_page_limit_reached", { limit: MAX_PAGES }));
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
      "[fetchApprovers] Calling admin.users.list with cursor:",
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
      "[fetchApprovers] Response ok:",
      result.ok,
      "error:",
      result.error,
      "users count:",
      result.users?.length,
    );

    if (!result.ok) {
      const errorCode = result.error ?? "unknown_error";
      console.error(t("errors.api_call_failed", { error: errorCode }));
      return {
        approvers: [],
        error: t("errors.api_call_failed", { error: errorCode }),
      };
    }

    if (result.users) {
      for (const user of result.users) {
        if (
          user.is_bot || user.deleted || user.is_restricted ||
          user.is_ultra_restricted
        ) continue;
        if (excludeUserId && user.id === excludeUserId) continue;
        if (user.is_admin || user.is_owner || user.is_primary_owner) {
          if (approvers.some((u) => u.id === user.id)) {
            continue;
          }

          approvers.push({
            id: user.id,
            name: user.username ?? "",
            real_name: user.full_name ?? "",
          });
        }
      }
    }

    const newCursor = result.response_metadata?.next_cursor;
    if (!newCursor || newCursor === "" || newCursor === cursor) {
      break;
    }
    cursor = newCursor;
  } while (true);

  return { approvers };
}

/**
 * Send a direct message to a user
 */
async function sendDirectMessage(
  client: SlackClient,
  userId: string,
  text: string,
  blocks?: unknown[],
): Promise<{ ok: boolean; error?: string }> {
  const openResult = await client.conversations.open({ users: userId });
  if (!openResult.ok) {
    console.error(
      t("errors.api_call_failed", { error: openResult.error ?? "unknown" }),
    );
    return { ok: false, error: openResult.error };
  }

  const dmChannelId = openResult.channel?.id;
  if (!dmChannelId) {
    console.error(t("errors.api_call_failed", { error: "no_channel_id" }));
    return { ok: false, error: "no_channel_id" };
  }

  const messageParams: { channel: string; text: string; blocks?: unknown[] } = {
    channel: dmChannelId,
    text,
  };
  if (blocks) {
    messageParams.blocks = blocks;
  }

  const postResult = await client.chat.postMessage(messageParams);
  if (!postResult.ok) {
    console.error(
      t("errors.api_call_failed", { error: postResult.error ?? "unknown" }),
    );
  }
  return { ok: postResult.ok, error: postResult.error };
}

/**
 * Build approval request message blocks
 */
function buildApprovalMessage(
  requesterId: string,
  targetUserId: string,
  changes: Record<string, FieldChange>,
  fieldLabels: Record<string, string>,
  approverIds?: string[],
) {
  const changesText = Object.entries(changes)
    .map(([fieldId, change]) =>
      t("messages.field_change", {
        field: fieldLabels[fieldId] ?? fieldId,
        old: change.old || t("messages.no_changes"),
        new: change.new,
      })
    )
    .join("\n");

  const approverMentions = approverIds?.map((id) => `<@${id}>`).join(", ") ??
    "";

  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: t("messages.custom_fields_approval_request_header"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: t("messages.custom_fields_approval_request_details", {
          requester: requesterId,
          target: targetUserId,
          changes: changesText,
        }),
      },
    },
  ];

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
          field_labels: fieldLabels,
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
          field_labels: fieldLabels,
          approver_ids: approverIds,
        }),
      },
    ],
  });

  return blocks;
}

/**
 * Update custom fields via Slack API
 */
async function updateCustomFields(
  targetUserId: string,
  fieldUpdates: Record<string, string>,
  adminToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const fields: Record<string, { value: string; alt: string }> = {};
  for (const [fieldId, value] of Object.entries(fieldUpdates)) {
    fields[fieldId] = { value, alt: "" };
  }

  const updateResponse = await fetch(
    "https://slack.com/api/users.profile.set",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        user: targetUserId,
        profile: { fields },
      }),
    },
  );

  const result = await updateResponse.json();
  return { ok: result.ok, error: result.error };
}

/**
 * ShowCustomFieldsForm function implementation
 *
 * Displays a modal form for updating custom fields. The form includes:
 * - Target user selector (defaults to the operator)
 * - Input fields for each non-hidden, non-protected custom field
 *
 * @param inputs - Function inputs
 * @param inputs.interactivity - Interactivity context for opening modal
 * @param inputs.user_id - Operator's user ID
 * @param inputs.channel_id - Source channel ID
 * @param client - Slack API client
 * @returns Success status or completed: false to wait for modal submission
 */
export default SlackFunction(
  ShowCustomFieldsFormDefinition,
  async ({ inputs, client, env }) => {
    // Initialize i18n system
    await initI18n();

    console.log(t("logs.modal_opened"));

    try {
      // 1. Show loading modal first
      const loadingResult = await client.views.open({
        trigger_id: inputs.interactivity.interactivity_pointer,
        view: {
          type: "modal",
          callback_id: FORM_CALLBACK_ID,
          title: {
            type: "plain_text",
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
          ],
        },
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

      // 2. Get admin token and team_id
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          error: t("errors.missing_admin_token"),
          outputs: { success: false },
        };
      }

      // Get team_id using auth.test
      const authResponse = await client.auth.test();
      if (!authResponse.ok || !authResponse.team_id) {
        return {
          error: t("errors.api_call_failed", {
            error: authResponse.error ?? "no_team_id",
          }),
          outputs: { success: false },
        };
      }
      const teamId = authResponse.team_id as string;

      // 3. Fetch permissions, approvers, and custom fields in parallel
      console.log(t("logs.fetching_custom_fields"));
      const [permResult, approversResult, profileResponse] = await Promise.all([
        checkUserPermissions(client as unknown as SlackClient, inputs.user_id),
        fetchApprovers(adminToken, teamId, inputs.user_id),
        client.team.profile.get({}),
      ]);

      if (permResult.error) {
        return {
          error: t("errors.api_call_failed", { error: permResult.error }),
          outputs: { success: false },
        };
      }

      if (approversResult.error) {
        return {
          error: approversResult.error,
          outputs: { success: false },
        };
      }

      if (!profileResponse.ok) {
        throw new Error(
          t("errors.api_call_failed", {
            error: profileResponse.error ?? t("errors.unknown_error"),
          }),
        );
      }

      const isAdminOrOwner = permResult.isAdminOrOwner;
      const approvers = approversResult.approvers;

      console.log(
        t("logs.authorized_users_fetched", { count: approvers.length }),
      );

      // Filter out hidden and protected fields
      const fields = ((profileResponse.profile?.fields || []) as ProfileField[])
        .filter((f) => !f.is_hidden && !f.options?.is_protected);

      console.log(t("logs.custom_fields_fetched", { count: fields.length }));

      // Build field labels map
      const fieldLabels: Record<string, string> = {};
      for (const field of fields) {
        fieldLabels[field.id] = field.label;
      }

      // 4. Fetch target user's current profile values
      console.log(t("logs.fetching_user_profile", { userId: inputs.user_id }));
      const userProfileResponse = await client.users.profile.get({
        user: inputs.user_id,
      });

      // Extract current custom field values (field_id -> value mapping)
      const currentValues: Record<string, string> = {};
      if (userProfileResponse.ok && userProfileResponse.profile?.fields) {
        const profileFields = userProfileResponse.profile.fields as Record<
          string,
          { value?: string }
        >;
        for (const [fieldId, fieldData] of Object.entries(profileFields)) {
          if (fieldData.value) {
            currentValues[fieldId] = fieldData.value;
          }
        }
        console.log(
          t("logs.user_profile_fetched", {
            count: Object.keys(currentValues).length,
          }),
        );
      }

      if (fields.length === 0) {
        // Show message when no fields are available
        await client.views.update({
          view_id: viewId,
          view: {
            type: "modal",
            callback_id: FORM_CALLBACK_ID,
            title: {
              type: "plain_text",
              text: t("messages.custom_fields_form_title"),
            },
            close: { type: "plain_text", text: t("messages.close_button") },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: t("messages.no_custom_fields"),
                },
              },
            ],
          },
        });
        return { outputs: { success: true } };
      }

      // 5. Build form blocks
      const blocks: object[] = [
        {
          type: "input",
          block_id: "target_user_block",
          dispatch_action: true, // Enable BlockActionsHandler on selection change
          element: {
            type: "users_select",
            action_id: TARGET_USER_ACTION_ID,
            initial_user: inputs.user_id,
          },
          label: {
            type: "plain_text",
            text: t("form.target_user_label"),
          },
          hint: {
            type: "plain_text",
            text: t("form.target_user_hint"),
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${t("messages.custom_fields_form_description")}*`,
          },
        },
      ];

      // Add input element for each field with current values
      // Use target user ID as suffix to force Slack to use initial values on user change
      const blockIdSuffix = `_${inputs.user_id}`;
      for (const field of fields) {
        blocks.push(
          createFieldInput(
            field as unknown as CustomFieldDefinitionDetail,
            currentValues[field.id],
            blockIdSuffix,
          ),
        );
      }

      // Add approver selection for non-admin users
      if (!isAdminOrOwner && approvers.length > 0) {
        blocks.push({ type: "divider" });
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
            options: approvers.map((a) => ({
              text: {
                type: "plain_text" as const,
                text: a.real_name ?? a.name,
              },
              value: a.id,
            })),
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
      } else if (!isAdminOrOwner && approvers.length === 0) {
        // Show warning when no approvers are available
        blocks.push({ type: "divider" });
        blocks.push({
          type: "section",
          block_id: "no_approvers_warning_block",
          text: {
            type: "mrkdwn",
            text: t("form.no_approvers_warning"),
          },
        });
      }

      // 6. Update modal with the form
      const viewResponse = await client.views.update({
        view_id: viewId,
        view: {
          type: "modal",
          callback_id: FORM_CALLBACK_ID,
          private_metadata: JSON.stringify({
            channel_id: inputs.channel_id,
            operator_id: inputs.user_id,
            is_admin_or_owner: isAdminOrOwner,
            approvers_available: approvers.length > 0,
            approvers: approvers,
            field_labels: fieldLabels,
            fields: fields, // Store field definitions for rebuilding on user change
            target_user_id: inputs.user_id,
          }),
          title: {
            type: "plain_text",
            text: t("messages.custom_fields_form_title"),
          },
          submit: {
            type: "plain_text",
            text: isAdminOrOwner
              ? t("form.submit_button")
              : t("form.request_button"),
          },
          close: {
            type: "plain_text",
            text: t("form.cancel_button"),
          },
          blocks,
        },
      });

      if (!viewResponse.ok) {
        console.error(
          t("errors.modal_update_failed", { error: viewResponse.error ?? "" }),
        );
        return {
          error: t("errors.modal_update_failed", {
            error: viewResponse.error ?? "",
          }),
          outputs: { success: false },
        };
      }

      console.log(t("logs.modal_opened"));

      // Return completed: false to wait for modal submission
      return { completed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("ShowCustomFieldsForm error:", message);
      return { error: message };
    }
  },
)
  // Modal submission handler
  .addViewSubmissionHandler(
    [FORM_CALLBACK_ID],
    async ({ view, client, env, body }) => {
      await initI18n();
      console.log(t("logs.form_submitted"));

      const metadata = JSON.parse(view.private_metadata || "{}");
      const operatorId = metadata.operator_id;
      const isAdminOrOwner = metadata.is_admin_or_owner ?? false;
      const approversAvailable = metadata.approvers_available ?? false;
      const fieldLabels = metadata.field_labels ?? {};
      const sourceChannelId = metadata.channel_id;
      const values = view.state.values;

      // Get target user
      const targetUserId = values.target_user_block?.target_user_select
        ?.selected_user;
      if (!targetUserId) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.user_not_selected") },
        };
      }

      // Get approver IDs (for non-admin users)
      const approverIds =
        values.approver_block?.approvers?.selected_options?.map(
          (opt: { value: string }) => opt.value,
        ) ?? [];

      // Collect field updates
      // Block IDs have format: field_${fieldId}_${targetUserId}
      const fieldUpdates: Record<string, string> = {};
      for (const [blockId, blockValue] of Object.entries(values)) {
        if (blockId.startsWith("field_")) {
          // Extract field ID by removing "field_" prefix and "_U..." suffix
          const withoutPrefix = blockId.replace("field_", "");
          // Find the last underscore followed by user ID pattern (U or W followed by alphanumeric)
          const suffixMatch = withoutPrefix.match(/_[UW][A-Z0-9]+$/);
          const fieldId = suffixMatch
            ? withoutPrefix.slice(
              0,
              withoutPrefix.length - suffixMatch[0].length,
            )
            : withoutPrefix;
          const actionId = `input_${fieldId}`;
          const element = (blockValue as Record<string, unknown>)[actionId] as {
            selected_option?: { value: string };
            selected_date?: string;
            value?: string;
          };

          let value: string | undefined;
          if (element?.selected_option?.value) {
            value = element.selected_option.value;
          } else if (element?.selected_date) {
            value = element.selected_date;
          } else if (element?.value) {
            value = element.value;
          }

          if (value) {
            fieldUpdates[fieldId] = value;
          }
        }
      }

      if (Object.keys(fieldUpdates).length === 0) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.no_fields_to_update") },
        };
      }

      // Fetch current field values to show before/after diff
      const userProfileResponse = await client.users.profile.get({
        user: targetUserId,
      });
      const currentValues: Record<string, string> = {};
      if (userProfileResponse.ok && userProfileResponse.profile?.fields) {
        const profileFields = userProfileResponse.profile.fields as Record<
          string,
          { value?: string }
        >;
        for (const [fieldId, fieldData] of Object.entries(profileFields)) {
          if (fieldData.value) {
            currentValues[fieldId] = fieldData.value;
          }
        }
      }

      // Build changes with old and new values for diff display
      const changes: Record<string, FieldChange> = {};
      for (const [fieldId, newValue] of Object.entries(fieldUpdates)) {
        changes[fieldId] = {
          old: currentValues[fieldId] ?? "",
          new: newValue,
        };
      }

      // Get Admin User Token
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.missing_admin_token") },
        };
      }

      const isSelf = operatorId === targetUserId;

      // Determine if direct execution is allowed
      // Admin/Owner can always execute directly
      // For custom fields, non-admin users always need approval when updating other users
      const canExecuteDirectly = isAdminOrOwner || isSelf;

      if (canExecuteDirectly) {
        // Direct execution
        console.log(t("logs.updating_custom_fields"));
        const result = await updateCustomFields(
          targetUserId,
          fieldUpdates,
          adminToken,
        );

        if (!result.ok) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.custom_field_update_failed", {
                error: result.error ?? "",
              }),
            },
          };
        }

        console.log(t("logs.custom_fields_updated"));

        // Build changes text with before → after diff for notification
        const changesText = Object.entries(changes)
          .map(([fieldId, change]) =>
            t("messages.field_change", {
              field: fieldLabels[fieldId] ?? fieldId,
              old: change.old || t("messages.no_changes"),
              new: change.new,
            })
          )
          .join("\n");

        // Send success notification via DM to operator
        await sendDirectMessage(
          client as unknown as SlackClient,
          operatorId,
          t("messages.custom_fields_updated"),
        );

        // Send channel notification to the source channel
        if (sourceChannelId) {
          await client.chat.postMessage({
            channel: sourceChannelId,
            text: t("messages.custom_fields_update_notification", {
              target: targetUserId,
              updater: operatorId,
              changes: changesText,
            }),
          });
        }

        // Complete the function
        await client.functions.completeSuccess({
          function_execution_id: body.function_data.execution_id,
          outputs: {
            success: true,
            approval_required: false,
            updated_user_id: targetUserId,
          },
        });
      } else {
        // Approval required
        // Check if approvers are available
        if (!approversAvailable) {
          return {
            response_action: "errors",
            errors: {
              target_user_block: t("errors.no_approvers_available"),
            },
          };
        }

        if (!approverIds || approverIds.length === 0) {
          return {
            response_action: "errors",
            errors: {
              approver_block: t("errors.no_approver_selected"),
            },
          };
        }

        // Send approval request to source channel
        const blocks = buildApprovalMessage(
          operatorId,
          targetUserId,
          changes,
          fieldLabels,
          approverIds,
        );

        if (sourceChannelId) {
          await client.chat.postMessage({
            channel: sourceChannelId,
            blocks,
            text: t("messages.custom_fields_approval_request_header"),
          });
        }

        // Send DM notification to each approver
        for (const approverId of approverIds) {
          await sendDirectMessage(
            client as unknown as SlackClient,
            approverId,
            t("messages.approval_request_dm", {
              requester: operatorId,
              target: targetUserId,
            }),
          );
        }

        // Notify requester via DM
        await sendDirectMessage(
          client as unknown as SlackClient,
          operatorId,
          t("messages.approval_request_sent"),
        );

        // DO NOT call completeSuccess here!
        // The function must remain incomplete to handle BlockActions (approve/deny buttons)
        // completeSuccess will be called in the BlockActionsHandler
      }

      return;
    },
  )
  // Handle approval action
  .addBlockActionsHandler(
    [APPROVE_ACTION_ID],
    async ({ action, body, client, env }) => {
      await initI18n();
      console.log(
        t("logs.processing_approval", {
          action: "approve",
          reviewer: body.user.id,
        }),
      );

      const data = JSON.parse(action.value);
      const {
        requester_id,
        target_user_id,
        changes,
        field_labels,
        approver_ids,
      } = data;
      const reviewerId = body.user.id;

      // Check if reviewer is authorized
      if (approver_ids && !approver_ids.includes(reviewerId)) {
        // Check if reviewer is admin/owner
        const permResult = await checkUserPermissions(
          client as unknown as SlackClient,
          reviewerId,
        );
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

      // Extract new values for API call (changes has { old, new } format)
      const newValues: Record<string, string> = {};
      for (const [fieldId, change] of Object.entries(changes)) {
        if (typeof change === "object" && change !== null && "new" in change) {
          const changeObj = change as { old: string; new: string };
          newValues[fieldId] = changeObj.new;
        } else {
          // Fallback for old format (string value)
          newValues[fieldId] = String(change);
        }
      }

      // Update custom fields
      console.log(t("logs.updating_custom_fields"));
      const result = await updateCustomFields(
        target_user_id,
        newValues,
        adminToken,
      );

      if (!result.ok) {
        await client.chat.postEphemeral({
          channel: body.channel?.id ?? "",
          user: reviewerId,
          text: t("errors.custom_field_update_failed", {
            error: result.error ?? "",
          }),
        });
        return;
      }

      console.log(t("logs.custom_fields_updated"));

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

      // Build changes text with before → after diff for notification
      const changesText = Object.entries(changes)
        .map(([fieldId, change]) => {
          if (
            typeof change === "object" && change !== null && "new" in change
          ) {
            const changeObj = change as { old: string; new: string };
            return t("messages.field_change", {
              field: field_labels[fieldId] ?? fieldId,
              old: changeObj.old || t("messages.no_changes"),
              new: changeObj.new,
            });
          } else {
            // Fallback for old format
            return `• ${field_labels[fieldId] ?? fieldId}: ${String(change)}`;
          }
        })
        .join("\n");

      // Notify requester via DM
      await sendDirectMessage(
        client as unknown as SlackClient,
        requester_id,
        t("messages.custom_fields_update_notification", {
          target: target_user_id,
          updater: reviewerId,
          changes: changesText,
        }),
      );

      // Complete the function
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: true,
          approval_required: true,
          updated_user_id: target_user_id,
        },
      });
    },
  )
  // Handle denial action
  .addBlockActionsHandler(
    [DENY_ACTION_ID],
    async ({ action, body, client }) => {
      await initI18n();
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
        const permResult = await checkUserPermissions(
          client as unknown as SlackClient,
          reviewerId,
        );
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

      // Notify requester via DM
      await sendDirectMessage(
        client as unknown as SlackClient,
        requester_id,
        t("messages.request_denied", {
          approver: reviewerId,
          requester: requester_id,
          target: target_user_id,
        }),
      );

      // Complete the function
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: false,
          approval_required: true,
          updated_user_id: target_user_id,
        },
      });
    },
  )
  // Handle target user selection change
  .addBlockActionsHandler(
    [TARGET_USER_ACTION_ID],
    async ({ action, body, client }) => {
      await initI18n();
      console.log(
        "[BlockActionsHandler] Target user selection changed:",
        action.selected_user,
      );

      // Get selected user ID from the action
      const selectedUserId = action.selected_user;
      if (!selectedUserId) {
        console.error("[BlockActionsHandler] No user selected");
        return;
      }

      // Get metadata from the view
      const view = body.view;
      if (!view) {
        console.error("[BlockActionsHandler] No view found in body");
        return;
      }

      const metadata = JSON.parse(view.private_metadata ?? "{}");
      const {
        operator_id: operatorId,
        is_admin_or_owner: isAdminOrOwner,
        approvers,
        approvers_available: approversAvailable,
        channel_id: channelId,
        field_labels: fieldLabels,
        fields,
      } = metadata;

      // Fetch the selected user's profile to get current custom field values
      console.log(t("logs.fetching_user_profile", { userId: selectedUserId }));
      const userProfileResponse = await client.users.profile.get({
        user: selectedUserId,
      });

      // Extract current custom field values
      const currentValues: Record<string, string> = {};
      if (userProfileResponse.ok && userProfileResponse.profile?.fields) {
        const profileFields = userProfileResponse.profile.fields as Record<
          string,
          { value?: string }
        >;
        for (const [fieldId, fieldData] of Object.entries(profileFields)) {
          if (fieldData.value) {
            currentValues[fieldId] = fieldData.value;
          }
        }
        console.log(
          t("logs.user_profile_fetched", {
            count: Object.keys(currentValues).length,
          }),
        );
      }

      // Rebuild form blocks with new user's values
      const blocks: object[] = [
        {
          type: "input",
          block_id: "target_user_block",
          dispatch_action: true,
          element: {
            type: "users_select",
            action_id: TARGET_USER_ACTION_ID,
            initial_user: selectedUserId,
          },
          label: {
            type: "plain_text",
            text: t("form.target_user_label"),
          },
          hint: {
            type: "plain_text",
            text: t("form.target_user_hint"),
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${t("messages.custom_fields_form_description")}*`,
          },
        },
      ];

      // Add input element for each field with selected user's current values
      // Use target user ID as suffix to force Slack to use initial values
      const blockIdSuffix = `_${selectedUserId}`;
      for (const field of fields ?? []) {
        blocks.push(
          createFieldInput(
            field as CustomFieldDefinitionDetail,
            currentValues[field.id],
            blockIdSuffix,
          ),
        );
      }

      // Add approver selection for non-admin users
      if (!isAdminOrOwner && approversAvailable && approvers?.length > 0) {
        blocks.push({ type: "divider" });
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
            options: approvers.map((
              a: { id: string; name: string; real_name?: string },
            ) => ({
              text: {
                type: "plain_text" as const,
                text: a.real_name ?? a.name,
              },
              value: a.id,
            })),
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
      } else if (!isAdminOrOwner && !approversAvailable) {
        blocks.push({ type: "divider" });
        blocks.push({
          type: "section",
          block_id: "no_approvers_warning_block",
          text: {
            type: "mrkdwn",
            text: t("form.no_approvers_warning"),
          },
        });
      }

      // Update the modal with new values
      const updateResult = await client.views.update({
        view_id: view.id,
        view: {
          type: "modal",
          callback_id: FORM_CALLBACK_ID,
          private_metadata: JSON.stringify({
            channel_id: channelId,
            operator_id: operatorId,
            is_admin_or_owner: isAdminOrOwner,
            approvers_available: approversAvailable,
            approvers: approvers,
            field_labels: fieldLabels,
            fields: fields,
            target_user_id: selectedUserId,
          }),
          title: {
            type: "plain_text",
            text: t("messages.custom_fields_form_title"),
          },
          submit: {
            type: "plain_text",
            text: isAdminOrOwner
              ? t("form.submit_button")
              : t("form.request_button"),
          },
          close: {
            type: "plain_text",
            text: t("form.cancel_button"),
          },
          blocks,
        },
      });

      if (!updateResult.ok) {
        console.error(
          t("errors.modal_update_failed", { error: updateResult.error ?? "" }),
        );
      } else {
        console.log(
          "[BlockActionsHandler] Modal updated with new user's custom field values",
        );
      }
    },
  )
  // Handle modal close without submission
  .addViewClosedHandler(
    [FORM_CALLBACK_ID],
    async ({ body, client }) => {
      await initI18n();
      console.log(t("logs.modal_closed"));

      // Complete the function with cancelled status
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: false,
        },
      });
    },
  );
