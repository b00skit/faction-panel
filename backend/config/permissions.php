<?php

return [
    'categories' => [
        'rosters' => [
            'name' => 'Rosters',
            'permissions' => [
                'view_faction_roster' => [
                    'name' => 'View Faction Roster',
                    'description' => 'Allows the user to see the entire faction roster.',
                    'type' => 'VIEW',
                ],
                'global_roster_moderation' => [
                    'name' => 'Global Roster Moderation',
                    'description' => 'Grants full control over all rosters (modify, delete, reorder).',
                    'type' => 'MODIFY',
                ],
                'create_roster' => [
                    'name' => 'Create Rosters',
                    'description' => 'Allows creating new rosters for the faction.',
                    'type' => 'CREATE',
                ],
                'modify_roster_variables' => [
                    'name' => 'Modify Roster Variables',
                    'description' => 'Allows managing global datasets used across rosters.',
                    'type' => 'MODIFY',
                ],
                'modify_roster_flags' => [
                    'name' => 'Modify Roster Flags',
                    'description' => 'Allows managing conditional formatting flags for rosters.',
                    'type' => 'MODIFY',
                ],
                'utilize_sandbox_rosters' => [
                    'name' => 'Utilize Sandbox Rosters',
                    'description' => 'Allows utilizing sandbox rosters.',
                    'type' => 'VIEW',
                ],
            ],
        ],
        'groups' => [
            'name' => 'Group Management',
            'permissions' => [
                'view_groups' => [
                    'name' => 'View Groups',
                    'description' => 'Allows viewing all groups within the faction.',
                    'type' => 'VIEW',
                ],
                'create_groups' => [
                    'name' => 'Create Groups',
                    'description' => 'Allows creating new groups.',
                    'type' => 'CREATE',
                ],
                'remove_groups' => [
                    'name' => 'Remove Groups',
                    'description' => 'Allows deleting groups.',
                    'type' => 'DELETE',
                ],
                'modify_groups' => [
                    'name' => 'Modify Groups',
                    'description' => 'Allows editing group details (name, color).',
                    'type' => 'MODIFY',
                ],
                'manage_group_members' => [
                    'name' => 'Manage Group Members',
                    'description' => 'Allows adding/removing members and promoting group leaders.',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'gtaw_sync' => [
            'name' => 'GTA:W Sync',
            'permissions' => [
                'sync_gtaw' => [
                    'name' => 'Sync with GTA:W',
                    'description' => 'Allows the user to manually trigger a synchronization with GTA World.',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'administration' => [
            'name' => 'Administration',
            'permissions' => [
                'view_admin_page' => [
                    'name' => 'View Administration Page',
                    'description' => 'Allows access to the administration dashboard.',
                    'type' => 'VIEW',
                ],
                'view_faction_details' => [
                    'name' => 'View Faction Details',
                    'description' => 'Allows viewing the basic faction information tab.',
                    'type' => 'VIEW',
                ],
                'modify_faction_details' => [
                    'name' => 'Modify Faction Details',
                    'description' => 'Allows editing faction details (name, color, etc.).',
                    'type' => 'MODIFY',
                ],
                'view_permissions' => [
                    'name' => 'View Permissions',
                    'description' => 'Allows viewing of role permissions.',
                    'type' => 'VIEW',
                ],
                'modify_permissions' => [
                    'name' => 'Modify Permissions',
                    'description' => 'Allows changing permissions for any role.',
                    'type' => 'MODIFY',
                ],
                'view_users' => [
                    'name' => 'View Users',
                    'description' => 'Allows viewing the faction member list in administration.',
                    'type' => 'VIEW',
                ],
                'remove_users' => [
                    'name' => 'Remove Users',
                    'description' => 'Allows removing members from the faction.',
                    'type' => 'DELETE',
                ],
                'change_ranks' => [
                    'name' => 'Change Ranks',
                    'description' => 'Allows changing a member\'s rank/role.',
                    'type' => 'MODIFY',
                ],
                'create_ranks' => [
                    'name' => 'Create Ranks',
                    'description' => 'Allows creation of new faction ranks/roles.',
                    'type' => 'CREATE',
                ],
                'delete_ranks' => [
                    'name' => 'Delete Ranks',
                    'description' => 'Allows deletion of faction ranks/roles.',
                    'type' => 'DELETE',
                ],
                'modify_ranks' => [
                    'name' => 'Modify Ranks',
                    'description' => 'Allows editing of rank names and properties.',
                    'type' => 'MODIFY',
                ],
                'manage_invites' => [
                    'name' => 'Manage Invites',
                    'description' => 'Allows creating and deleting faction invite links.',
                    'type' => 'MODIFY',
                ],
                'modify_global_quick_search' => [
                    'name' => 'Modify Global Quick Search',
                    'description' => 'Allows configuring the global quick search feature for the faction.',
                    'type' => 'MODIFY',
                ],
                'manage_user_fields' => [
                    'name' => 'Manage User Fields',
                    'description' => 'Allows managing faction-bound custom user fields.',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'records' => [
            'name' => 'Faction Records',
            'permissions' => [
                'view_faction_records' => [
                    'name' => 'View Faction Records',
                    'description' => 'Allows viewing the faction records system.',
                    'type' => 'VIEW',
                ],
                'create_faction_record_database' => [
                    'name' => 'Create Faction Record Database',
                    'description' => 'Allows creating new record databases.',
                    'type' => 'CREATE',
                ],
                'global_faction_record_moderation' => [
                    'name' => 'Global Faction Record Moderation',
                    'description' => 'Grants full control over all record databases (modify, delete).',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'forms' => [
            'name' => 'Faction Forms',
            'permissions' => [
                'view_faction_forms' => [
                    'name' => 'View Faction Forms',
                    'description' => 'Allows viewing the faction forms system.',
                    'type' => 'VIEW',
                ],
                'create_faction_forms' => [
                    'name' => 'Create Faction Forms',
                    'description' => 'Allows creating new forms.',
                    'type' => 'CREATE',
                ],
                'global_faction_form_moderation' => [
                    'name' => 'Global Faction Form Moderation',
                    'description' => 'Grants full control over all forms (modify, delete).',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'audit_logs' => [
            'name' => 'Audit Logs',
            'permissions' => [
                'view_audit_logs' => [
                    'name' => 'View Audit Logs',
                    'description' => 'Allows viewing the faction audit logs.',
                    'type' => 'VIEW',
                ],
            ],
        ],
        'statistics' => [
            'name' => 'Statistics',
            'permissions' => [
                'view_statistics' => [
                    'name' => 'View Statistics',
                    'description' => 'Allows viewing the faction statistics system.',
                    'type' => 'VIEW',
                ],
                'create_statistics_model' => [
                    'name' => 'Create Statistics Model',
                    'description' => 'Allows creating new statistics models.',
                    'type' => 'CREATE',
                ],
                'global_statistics_moderation' => [
                    'name' => 'Global Statistics Model Moderator',
                    'description' => 'Grants full control over all statistics models (modify, delete).',
                    'type' => 'MODIFY',
                ],
                'view_all_statistics_models' => [
                    'name' => 'View all Statistics Models',
                    'description' => 'Allows viewing all statistics models without moderation ability.',
                    'type' => 'VIEW',
                ],
            ],
        ],
        'snapshots' => [
            'name' => 'Faction Snapshots',
            'permissions' => [
                'view_snapshots' => [
                    'name' => 'View Faction Snapshots',
                    'description' => 'Allows viewing the list of faction backups.',
                    'type' => 'VIEW',
                ],
                'create_snapshot' => [
                    'name' => 'Create Faction Snapshot',
                    'description' => 'Allows creating a manual backup of the faction.',
                    'type' => 'CREATE',
                ],
                'restore_snapshot' => [
                    'name' => 'Restore from Faction Snapshot',
                    'description' => 'Allows restoring the faction state from a backup.',
                    'type' => 'MODIFY',
                ],
                'delete_snapshot' => [
                    'name' => 'Delete Faction Snapshot',
                    'description' => 'Allows deleting existing backups.',
                    'type' => 'DELETE',
                ],
            ],
        ],
        'hierarchies' => [
            'name' => 'Faction Hierarchies',
            'permissions' => [
                'view_faction_hierarchy' => [
                    'name' => 'View Faction Hirarchy',
                    'description' => 'Allows the user to see the faction hierarchies.',
                    'type' => 'VIEW',
                ],
                'global_hierarchy_moderation' => [
                    'name' => 'Global Faction Hirarchy Moderator',
                    'description' => 'Grants full control over all hierarchies (modify, delete, reorder).',
                    'type' => 'MODIFY',
                ],
                'create_hierarchy' => [
                    'name' => 'Create new Faction Hirarchies',
                    'description' => 'Allows creating new hierarchies for the faction.',
                    'type' => 'CREATE',
                ],
            ],
        ],
        'kanban' => [
            'name' => 'Faction Kanban',
            'permissions' => [
                'view_faction_projects' => [
                    'name' => 'View Faction Projects',
                    'description' => 'Allows viewing the projects tab and list.',
                    'type' => 'VIEW',
                ],
                'create_project' => [
                    'name' => 'Create Kanban Projects',
                    'description' => 'Allows creating new Kanban projects for the faction.',
                    'type' => 'CREATE',
                ],
                'global_kanban_moderation' => [
                    'name' => 'Global Kanban Moderator',
                    'description' => 'Grants full administrative access to all projects, card types, columns, and cards.',
                    'type' => 'MODIFY',
                ],
            ],
        ],
        'system' => [
            'name' => 'System',
            'permissions' => [
                'administrator' => [
                    'name' => 'Administrator',
                    'description' => 'Grants full administrative access to the faction. (Equivalent to Faction Leader)',
                    'type' => 'MODIFY',
                ],
            ],
        ],
    ],
];
