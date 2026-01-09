/**
 * Custom field type definitions for slack-utils-user
 *
 * Defines types for custom field definitions retrieved from team.profile.get API.
 *
 * @module lib/types/custom_fields
 */

/**
 * Custom field types supported by Slack
 */
export type CustomFieldType = "text" | "options_list" | "date";

/**
 * Custom field options from Slack API
 */
export interface CustomFieldOptions {
  /** Whether the field is managed by SCIM */
  is_scim: boolean;
  /** Whether the field is protected (Admin only) */
  is_protected: boolean;
}

/**
 * Custom field definition from team.profile.get API
 *
 * @example
 * ```typescript
 * const field: CustomFieldDefinitionDetail = {
 *   id: "Xf111111ABC",
 *   ordering: 0,
 *   label: "Department",
 *   hint: "Select your department",
 *   type: "options_list",
 *   possible_values: ["Sales", "Engineering", "HR"],
 *   options: { is_scim: false, is_protected: false },
 *   is_hidden: false,
 *   section_id: "123ABC",
 * };
 * ```
 */
export interface CustomFieldDefinitionDetail {
  /** Field ID (starts with Xf) */
  id: string;
  /** Display order */
  ordering: number;
  /** Label (display name) */
  label: string;
  /** Hint text */
  hint: string;
  /** Field type */
  type: CustomFieldType;
  /** Possible values (for options_list type) */
  possible_values: string[] | null;
  /** Field options */
  options: CustomFieldOptions;
  /** Whether the field is hidden */
  is_hidden: boolean;
  /** Section ID this field belongs to */
  section_id: string;
}

/**
 * Custom field section from team.profile.get API
 *
 * @example
 * ```typescript
 * const section: CustomFieldSection = {
 *   id: "123ABC",
 *   team_id: "T123456",
 *   section_type: "custom",
 *   label: "Company Info",
 *   order: 1,
 *   is_hidden: false,
 * };
 * ```
 */
export interface CustomFieldSection {
  /** Section ID */
  id: string;
  /** Team ID */
  team_id: string;
  /** Section type */
  section_type: string;
  /** Section label */
  label: string;
  /** Display order */
  order: number;
  /** Whether the section is hidden */
  is_hidden: boolean;
}

/**
 * Custom field update request
 *
 * @example
 * ```typescript
 * const update: CustomFieldUpdate = {
 *   field_id: "Xf111111ABC",
 *   value: "Engineering",
 *   alt: "",
 * };
 * ```
 */
export interface CustomFieldUpdate {
  /** Field ID */
  field_id: string;
  /** New value */
  value: string;
  /** Alternative text (optional) */
  alt?: string;
}

/**
 * Custom field update result
 *
 * @example
 * ```typescript
 * const result: CustomFieldUpdateResult = {
 *   success: true,
 *   updated_fields: ["Xf111111ABC", "Xf222222ABC"],
 * };
 * ```
 */
export interface CustomFieldUpdateResult {
  /** Whether the update was successful */
  success: boolean;
  /** List of updated field IDs */
  updated_fields: string[];
  /** Error message (on failure) */
  error?: string;
}

/**
 * Output field definition for GetCustomFieldDefinitions function
 *
 * Simplified version of CustomFieldDefinitionDetail for output
 */
export interface OutputCustomField {
  /** Field ID */
  id: string;
  /** Label (display name) */
  label: string;
  /** Field type */
  type: string;
  /** Hint text */
  hint: string;
  /** Possible values (for options_list type) */
  possible_values: string[];
  /** Whether the field is protected */
  is_protected: boolean;
}

/**
 * Output section definition for GetCustomFieldDefinitions function
 *
 * Simplified version of CustomFieldSection for output
 */
export interface OutputCustomFieldSection {
  /** Section ID */
  id: string;
  /** Section label */
  label: string;
}

/**
 * team.profile.get API response type
 */
export interface TeamProfileGetResponse {
  ok: boolean;
  profile?: {
    fields: CustomFieldDefinitionDetail[];
    sections: CustomFieldSection[];
  };
  error?: string;
}
