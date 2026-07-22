export interface Role {
  id: number;
  name: string;
  weight: number;
  color: string;
  type: 'primary' | 'secondary';
  faction_id: number;
  permissions?: any[];
}

export interface Member {
  id: string;
  rank: string;
  name: string;
  position: string;
  callsign: string;
  isAlt?: boolean;
  isNpc?: boolean;
  isActing?: boolean;
  rankColor?: string;
}

export interface Unit {
  id: string;
  name: string;
  members: Member[];
}

export interface Bureau {
  id: string;
  name: string;
  color: string;
  leadership: Member[];
  units: Unit[];
}

export interface Division {
  id: string;
  name: string;
  color: string;
  leadership: Member[];
  bureaus: Bureau[];
}

export interface RosterContent {
  id: number;
  section_id: number;
  roster_id?: number;
  order: number;
  type: 'predefined' | 'defined' | 'spacer';
  color?: string | null;
  content: any;
  notes?: Record<string, string> | null;
  updated_at?: string;
  editing_by?: number | null;
  editing_at?: string | null;
  editing_col?: string | null;
  editor?: {
    id: number;
    username: string;
  };
}

export interface RosterColumn {
  id: string;
  name: string;
  type: string;
  options?: any[];
  checkboxes?: any[];
  tags?: any[];
  flags?: number[];
  flag_settings?: any;
  dataset_id?: number | null;
  source_column_id?: string | null;
  linked_database_id?: number | null;
  data_field_id?: string | null;
  database_field_id?: string | null;
  autofill_value?: string;
}

export interface RosterSection {
  id: number;
  roster_id: number;
  name: string;
  image_url?: string | null;
  shortname: string;
  color?: string;
  type: 'master' | 'section' | 'subsection' | 'content';
  data_source?: 'manual' | 'dynamic';
  order: number;
  parent_id?: number | null;
  section_options?: any;
  columns?: RosterColumn[] | null;
  use_roster_columns?: boolean;
  layout_settings?: any;
  subsections_per_row?: number;
  content_html?: string | null;
  children?: RosterSection[];
  contents?: RosterContent[];
  counts?: any;
}

export interface Roster {
  id: number;
  faction_id: number;
  name: string;
  shortname: string;
  color: string;
  order: number;
  roster_options: any;
  columns?: RosterColumn[] | null;
  layout_settings?: any;
  default_sections_per_row?: number;
  root_sections?: RosterSection[];
  created_by: number | null;
}

export interface Group {
  id: number;
  faction_id: number;
  name: string;
  color: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  members?: any[];
  leaders?: any[];
}

export interface RosterPermission {
  id: number;
  roster_id: number;
  group_id: number | null;
  role_id: number | null;
  permissions: string[];
  group?: Group;
  role?: Role;
}

export interface FactionRecordDatabase {
  id: number;
  faction_id: number;
  name: string;
  description: string | null;
  allow_details_view: boolean;
  data_overview_display: string;
  data_entry_display: string;
  record_shortcode: string | null;
  database_structure: any[];
  permissions: any;
  is_api_database: boolean;
  api_database_type: string | null;
  is_published: boolean;
  detail_customization?: any;
  created_by: number | null;
  creator?: {
    id: number;
    username: string;
  };
  entries?: any[];
}

export interface RosterDatasetOption {
    id?: number;
    value: string;
    color: string | null;
    is_bold: boolean;
    order: number;
}

export interface RosterDataset {
    id: number;
    name: string;
    record_database_id: number | null;
    record_database?: FactionRecordDatabase;
    options: RosterDatasetOption[];
}

export interface FactionRecordPermission {
  id: number;
  database_id: number;
  group_id: number | null;
  role_id: number | null;
  permissions: string[];
  group?: Group;
  role?: Role;
}

export interface MembershipTier {
  id: number;
  name: string;
  max_factions: number;
  allow_custom_branding: boolean;
  users_count?: number;
}

export interface User {
  id: number;
  username: string;
  avatar_url?: string | null;
  gtaw_id: number | null;
  gtaw_username: string | null;
  gtaw_linked: boolean;
  is_superadmin: boolean;
  membership_tier_id: number | null;
  membership_tier?: MembershipTier;
  max_factions: number;
  allow_custom_branding: boolean;
  factions_count?: number;
  roles?: Role[];
}

export interface HelpCategory {
  id: number;
  name: string;
  icon: string | null;
  order: number;
  articles_count?: number;
  articles?: HelpArticle[];
}

export interface HelpArticle {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  content: string;
  order: number;
  is_published: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  category?: HelpCategory;
}

export interface StatisticsModel {
  id: number;
  faction_id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  widgets_count?: number;
  widgets?: StatisticsWidget[];
  creator?: {
    id: number;
    username: string;
  };
  user_permissions?: {
    view_statistics: boolean;
    modify_statistics: boolean;
    delete_statistics: boolean;
  };
}

export interface StatisticsWidget {
  id: number;
  statistics_model_id: number;
  name: string;
  type: 'pie' | 'bar' | 'line' | 'table' | 'stat' | 'radar';
  configuration: any;
  cache_result: any;
  last_calculated_at: string | null;
  is_intensive: boolean;
  order: number;
  width: number;
}

export interface StatisticsPermission {
  id: number;
  statistics_model_id: number;
  group_id: number | null;
  role_id: number | null;
  permissions: string[];
  group?: Group;
  role?: Role;
}

export interface Faction {
  id: number;
  name: string;
  shortname: string;
  color: string;
  image_url: string | null;
  header_image: string | null;
  favicon: string | null;
  visibility: 'public' | 'hidden' | 'private';
  access: 'joinable' | 'invite-only' | 'private';
  gtaw_faction_id: number | null;
  faction_leader: number;
  allow_branding: boolean;
  quick_search_enabled: boolean;
  quick_search_settings?: {
    database_id: number | null;
    column_id: string | null;
    exact_match_only: boolean;
  };
  roster_template?: any;
  leader?: User;
  users_count?: number;
}

export interface FormField {
  id: number;
  form_section_id: number;
  type: string;
  label: string;
  name: string;
  options?: any;
  validation_rules?: any;
  order: number;
  points: number;
  is_required: boolean;
  has_grading: boolean;
  is_automatic_scored: boolean;
  correct_answer?: string;
  prefill_type?: string | null;
  width?: number;
  default_value?: string | null;
  description?: string | null;
  placeholder?: string | null;
  is_disabled?: boolean;
  is_multi?: boolean;
}

export interface FormSection {
  id: number;
  form_stage_id: number;
  name: string;
  description: string | null;
  order: number;
  fields?: FormField[];
}

export interface FormStage {
  id: number;
  form_id: number;
  name: string;
  submit_status_id: number | null;
  required_points?: number;
  order: number;
  description?: string | null;
  sections?: FormSection[];
}

export interface FormStatus {
  id: number;
  form_id: number;
  stage_ids: number[];
  name: string;
  order: number;
  is_hidden: boolean;
  is_locked: boolean;
  is_closed: boolean;
  is_failed: boolean;
  is_passed: boolean;
  is_archived: boolean;
  system_key?: string | null;
  stages?: FormStage[];
}

export interface Form {
  id: number;
  faction_id: number;
  name: string;
  type: 'standard' | 'quiz';
  description: string | null;
  metadata?: any;
  is_public: boolean;
  requires_gtaw_login: boolean;
  cooldown_seconds: number;
  cooldown_only_on_fail: boolean;
  max_submissions: number | null;
  is_enabled: boolean;
  pass_points?: number;
  is_automatic_grading: boolean;
  created_by: number | null;
  creator?: {
    id: number;
    username: string;
  };
  stages?: FormStage[];
  statuses?: FormStatus[];
}

export interface FormResponse {
  id: number;
  form_submission_id: number;
  form_field_id: number;
  value: any;
  points_awarded: number;
  reviewer_comment: string | null;
  is_graded: boolean;
  correctness?: 'correct' | 'partially_correct' | 'incorrect' | null;
  field?: FormField;
}

export interface FormComment {
  id: number;
  form_submission_id: number;
  user_id: number;
  comment: string;
  is_internal: boolean;
  created_at: string;
  user?: {
    id: number;
    username: string;
  };
}

export interface FormSubmission {
  id: number;
  form_id: number;
  user_id: number | null;
  current_stage_id: number | null;
  current_status_id: number | null;
  started_at: string;
  submitted_at: string | null;
  metadata?: any;
  form?: Form;
  current_stage?: FormStage;
  current_status?: FormStatus;
  user?: {
    id: number;
    username: string;
  };
  responses?: FormResponse[];
  comments?: FormComment[];
}

export interface FormPermission {
  id: number;
  form_id: number;
  group_id: number | null;
  role_id: number | null;
  permissions: string[];
  group?: Group;
  role?: Role;
}

export type AutomationOperator =
  | 'equals' | 'not_equals' | 'contains'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'is_empty' | 'is_not_empty';

export interface AutomationCondition {
  type?: 'field' | 'field_points' | 'field_correctness' | 'points' | 'status';
  field_id?: number;
  operator: AutomationOperator;
  value: string;
}

export interface FormAutomation {
  id: number;
  form_id: number;
  name: string | null;
  trigger: 'on_stage_submit' | 'on_final_submit' | 'on_status_change';
  trigger_status_id: number | null;
  trigger_stage_id: number | null;
  condition_logic: 'all' | 'any';
  conditions: AutomationCondition[] | null;
  action: 'set_status' | 'add_comment' | 'give_group' | 'continue_to_next_stage';
  action_status_id: number | null;
  action_comment: string | null;
  action_comment_internal: boolean;
  action_group_id: number | null;
  is_enabled: boolean;
  order: number;
  trigger_status?: FormStatus;
  trigger_stage?: FormStage;
  action_status?: FormStatus;
  action_group?: Group;
}

export interface Notification {
  id: number;
  faction_id: number | null;
  notification_scheme_id: number | null;
  scheme_name?: string | null;
  type: 'system' | 'user' | 'faction';
  title: string;
  message: string;
  link?: string | null;
  data?: any;
  is_read: boolean;
  created_at: string;
  faction_shortname?: string | null;
}

export interface NotificationSchemePermission {
  id: number;
  notification_scheme_id: number;
  role_id: number | null;
  group_id: number | null;
  permissions: string[];
  role?: Role;
  group?: Group;
}

export interface NotificationScheme {
  id: number;
  faction_id: number;
  name: string;
  trigger_type: 'database_entry_created' | 'database_entry_updated' | 'roster_row_created' | 'roster_row_updated' | 'faction_updated';
  target_id: number | null;
  conditions: any[] | null;
  read_type: 'global' | 'user_bound';
  text_template: string | null;
  created_by: number | null;
  permissions?: NotificationSchemePermission[];
}

export interface ChangelogItem {
  type: 'Feature' | 'Modification' | 'Backend' | 'Fix';
  content: string;
}

export interface ChangelogEntry {
  id: number;
  version: string;
  title: string;
  body?: string | null;
  items?: ChangelogItem[] | null;
  released_at: string;
  order: number;
}

export interface KanbanCardType {
  id: number;
  name: string;
  color: string;
  icon: string;
  settings: {
    description: boolean;
    subtasks: boolean;
    color: boolean;
    icon: boolean;
    comments: boolean;
    assignee: boolean;
    priority: boolean;
  };
}

export interface KanbanPriority {
  id: number;
  name: string;
  color: string;
  icon: string;
  order: number;
  is_default: boolean;
}

export interface KanbanLabel {
  id: number;
  project_id: number;
  name: string;
  color: string;
}

export interface KanbanSubtask {
  id: number;
  card_id: number;
  title: string;
  is_completed: boolean;
  order: number;
}

export interface KanbanComment {
  id: number;
  card_id: number;
  user_id: number | null;
  comment: string;
  created_at: string;
  user?: {
    id: number;
    username: string;
    avatar_url?: string | null;
  };
}

export interface KanbanRow {
  id: number;
  project_id: number;
  name: string;
  order: number;
  is_visible?: boolean;
  is_default?: boolean;
  cards?: KanbanCard[];
}

export interface KanbanCard {
  id: number;
  project_id: number;
  status_id: number;
  row_id?: number | null;
  card_type_id: number;
  priority_id: number | null;
  title: string;
  description: string | null;
  color: string | null;
  order: number;
  count?: number | null;
  created_by: number | null;
  is_archived?: boolean;
  card_type?: KanbanCardType;
  priority?: KanbanPriority | null;
  status?: KanbanStatus;
  row?: KanbanRow | null;
  assignees?: User[];
  labels?: KanbanLabel[];
  subtasks?: KanbanSubtask[] | { completed: number; total: number } | null;
  comments?: KanbanComment[] | number | null;
  linked_cards?: KanbanCard[];
  created_at?: string;
  updated_at?: string;
}

export interface KanbanProject {
  id: number;
  faction_id: number;
  name: string;
  color: string;
  description?: string | null;
  order: number;
  created_by: number | null;
  prefix?: string | null;
  show_prefix?: boolean;
  enable_project_management?: boolean;
  statuses?: KanbanStatus[];
  rows?: KanbanRow[];
  labels?: KanbanLabel[];
  permissions?: any[];
  user_permissions?: {
    view_project: boolean;
    add_card: boolean;
    modify_card: boolean;
    view_card_details: boolean;
    manage_statuses: boolean;
    manage_labels: boolean;
    modify_project: boolean;
  };
}

export interface KanbanStatus {
  id: number;
  project_id: number;
  name: string;
  order: number;
  is_visible?: boolean;
  is_default?: boolean;
  cards?: KanbanCard[];
}
