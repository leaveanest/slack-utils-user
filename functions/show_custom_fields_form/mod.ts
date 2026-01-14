/**
 * ShowCustomFieldsForm function
 *
 * Displays a modal form for updating custom fields.
 * Fetches custom field definitions from team.profile.get API and
 * creates appropriate input elements based on field types.
 *
 * @module functions/show_custom_fields_form
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import type { CustomFieldDefinitionDetail } from "../../lib/types/custom_fields.ts";

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
 * @returns Block Kit input block
 */
function createFieldInput(
  field: CustomFieldDefinitionDetail,
  currentValue?: string,
): BlockElement {
  const blockId = `field_${field.id}`;
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
  async ({ inputs, client }) => {
    // Initialize i18n system
    await initI18n();

    console.log(t("logs.modal_opened"));

    try {
      // 1. Fetch custom field definitions
      console.log(t("logs.fetching_custom_fields"));
      const profileResponse = await client.team.profile.get({});
      if (!profileResponse.ok) {
        throw new Error(
          t("errors.api_call_failed", {
            error: profileResponse.error ?? t("errors.unknown_error"),
          }),
        );
      }

      // Filter out hidden and protected fields
      const fields = ((profileResponse.profile?.fields || []) as ProfileField[])
        .filter((f) => !f.is_hidden && !f.options?.is_protected);

      console.log(t("logs.custom_fields_fetched", { count: fields.length }));

      if (fields.length === 0) {
        // Show message when no fields are available
        await client.views.open({
          trigger_id: inputs.interactivity.interactivity_pointer,
          view: {
            type: "modal",
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

      // 2. Build form blocks
      const blocks: object[] = [
        {
          type: "input",
          block_id: "target_user_block",
          element: {
            type: "users_select",
            action_id: "target_user_select",
            initial_user: inputs.user_id,
          },
          label: {
            type: "plain_text",
            text: t("form.target_user_label"),
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

      // Add input element for each field
      for (const field of fields) {
        blocks.push(
          createFieldInput(field as unknown as CustomFieldDefinitionDetail),
        );
      }

      // 3. Open the modal
      const viewResponse = await client.views.open({
        trigger_id: inputs.interactivity.interactivity_pointer,
        view: {
          type: "modal",
          callback_id: "custom_fields_form_modal",
          private_metadata: JSON.stringify({
            channel_id: inputs.channel_id,
            operator_id: inputs.user_id,
          }),
          title: {
            type: "plain_text",
            text: t("messages.custom_fields_form_title"),
          },
          submit: {
            type: "plain_text",
            text: t("form.submit_button"),
          },
          close: {
            type: "plain_text",
            text: t("form.cancel_button"),
          },
          blocks,
        },
      });

      if (!viewResponse.ok) {
        throw new Error(
          t("errors.modal_open_failed", {
            error: viewResponse.error ?? t("errors.unknown_error"),
          }),
        );
      }

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
    ["custom_fields_form_modal"],
    async ({ view, client, env, body }) => {
      await initI18n();

      const metadata = JSON.parse(view.private_metadata || "{}");
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

      // Collect field updates
      const fieldUpdates: Record<string, string> = {};
      for (const [blockId, blockValue] of Object.entries(values)) {
        if (blockId.startsWith("field_")) {
          const fieldId = blockId.replace("field_", "");
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

      // Get Admin User Token
      const adminToken = env.SLACK_ADMIN_USER_TOKEN;
      if (!adminToken) {
        return {
          response_action: "errors",
          errors: { target_user_block: t("errors.missing_admin_token") },
        };
      }

      // Build fields object for API
      const fields: Record<string, { value: string; alt: string }> = {};
      for (const [fieldId, value] of Object.entries(fieldUpdates)) {
        fields[fieldId] = { value, alt: "" };
      }

      // Update custom fields via API
      console.log(t("logs.updating_custom_fields"));
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
      if (!result.ok) {
        return {
          response_action: "errors",
          errors: {
            target_user_block: t("errors.custom_field_update_failed", {
              error: result.error,
            }),
          },
        };
      }

      console.log(t("logs.custom_fields_updated"));

      // Send success message to operator
      await client.chat.postMessage({
        channel: metadata.operator_id,
        text: t("messages.custom_fields_updated"),
      });

      // Complete the function to allow workflow to finish
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          success: true,
          updated_user_id: targetUserId,
        },
      });

      return { response_action: "clear" };
    },
  )
  // Handle modal close without submission
  .addViewClosedHandler(
    ["custom_fields_form_modal"],
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
