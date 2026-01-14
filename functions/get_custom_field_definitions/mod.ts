/**
 * GetCustomFieldDefinitions function
 *
 * Retrieves custom field definitions from the workspace using team.profile.get API.
 * Filters out hidden fields by default and provides structured output for use in forms.
 *
 * @module functions/get_custom_field_definitions
 */

import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { initI18n, t } from "../../lib/i18n/mod.ts";
import type {
  CustomFieldDefinitionDetail,
  CustomFieldSection,
  OutputCustomField,
  OutputCustomFieldSection,
  TeamProfileGetResponse,
} from "../../lib/types/custom_fields.ts";

/**
 * Function definition for GetCustomFieldDefinitions
 *
 * @example
 * ```typescript
 * // Use in workflow
 * const fieldsStep = workflow.addStep(GetCustomFieldDefinitionsDefinition, {
 *   include_hidden: false,
 * });
 * ```
 */
export const GetCustomFieldDefinitionsDefinition = DefineFunction({
  callback_id: "get_custom_field_definitions",
  title: "カスタムフィールド定義取得",
  description: "ワークスペースのカスタムフィールド定義を取得します",
  source_file: "functions/get_custom_field_definitions/mod.ts",
  input_parameters: {
    properties: {
      include_hidden: {
        type: Schema.types.boolean,
        description: "非表示フィールドを含めるか",
        default: false,
      },
    },
    required: [],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "取得成功かどうか",
      },
      fields_json: {
        type: Schema.types.string,
        description:
          "カスタムフィールド定義の配列（JSON文字列）。各要素: {id, label, type, hint, possible_values, is_protected}",
      },
      sections_json: {
        type: Schema.types.string,
        description: "セクション定義の配列（JSON文字列）。各要素: {id, label}",
      },
      field_count: {
        type: Schema.types.integer,
        description: "取得したフィールド数",
      },
      error: {
        type: Schema.types.string,
        description: "エラーメッセージ（失敗時）",
      },
    },
    required: ["success"],
  },
});

/**
 * Transforms raw field data to output format
 *
 * @param field - Raw custom field definition from API
 * @returns Formatted output field
 */
function transformFieldToOutput(
  field: CustomFieldDefinitionDetail,
): OutputCustomField {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    hint: field.hint || "",
    possible_values: field.possible_values || [],
    is_protected: field.options?.is_protected || false,
  };
}

/**
 * Transforms raw section data to output format
 *
 * @param section - Raw custom field section from API
 * @returns Formatted output section
 */
function transformSectionToOutput(
  section: CustomFieldSection,
): OutputCustomFieldSection {
  return {
    id: section.id,
    label: section.label,
  };
}

/**
 * GetCustomFieldDefinitions function implementation
 *
 * Retrieves all custom field definitions from the workspace using team.profile.get API.
 * Optionally filters out hidden fields.
 *
 * @param inputs - Function inputs
 * @param inputs.include_hidden - Whether to include hidden fields (default: false)
 * @param client - Slack API client
 * @returns Custom field definitions and sections
 *
 * @example
 * ```typescript
 * // Result structure
 * {
 *   success: true,
 *   fields: [
 *     { id: "Xf123", label: "Department", type: "options_list", ... },
 *   ],
 *   sections: [
 *     { id: "S123", label: "Company Info" },
 *   ],
 *   field_count: 1,
 * }
 * ```
 */
export default SlackFunction(
  GetCustomFieldDefinitionsDefinition,
  async ({ inputs, client }) => {
    // Initialize i18n system
    await initI18n();

    console.log(t("logs.fetching_custom_fields"));

    try {
      // Call team.profile.get API
      const response = (await client.team.profile.get(
        {},
      )) as TeamProfileGetResponse;

      if (!response.ok) {
        throw new Error(
          t("errors.api_call_failed", {
            error: response.error ?? t("errors.unknown_error"),
          }),
        );
      }

      const profile = response.profile;

      // Return empty arrays if no profile or fields exist
      if (!profile || !profile.fields) {
        return {
          outputs: {
            success: true,
            fields_json: "[]",
            sections_json: "[]",
            field_count: 0,
          },
        };
      }

      // Filter hidden fields if not including them
      let fields: CustomFieldDefinitionDetail[] = profile.fields;
      if (!inputs.include_hidden) {
        fields = fields.filter((f) => !f.is_hidden);
      }

      // Transform fields to output format
      const outputFields: OutputCustomField[] = fields.map(
        transformFieldToOutput,
      );

      // Filter and transform sections to output format
      const outputSections: OutputCustomFieldSection[] = (
        profile.sections || []
      )
        .filter((s) => !s.is_hidden)
        .map(transformSectionToOutput);

      console.log(
        t("logs.custom_fields_fetched", { count: outputFields.length }),
      );

      return {
        outputs: {
          success: true,
          fields_json: JSON.stringify(outputFields),
          sections_json: JSON.stringify(outputSections),
          field_count: outputFields.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("GetCustomFieldDefinitions error:", message);

      return {
        outputs: {
          success: false,
          fields_json: "[]",
          sections_json: "[]",
          field_count: 0,
          error: message,
        },
      };
    }
  },
);
