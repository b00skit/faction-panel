<?php

namespace Database\Seeders;

use App\Models\Faction;
use App\Models\FactionRecordDatabase;
use App\Models\FactionRecordDatabasePermission;
use App\Models\FactionRecordEntry;
use App\Models\Form;
use App\Models\FormComment;
use App\Models\FormField;
use App\Models\FormResponse;
use App\Models\FormSection;
use App\Models\FormStage;
use App\Models\FormStatus;
use App\Models\FormSubmission;
use App\Models\Group;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterDataset;
use App\Models\RosterDatasetOption;
use App\Models\RosterFlag;
use App\Models\RosterPermission;
use App\Models\RosterSection;
use App\Models\StatisticsModel;
use App\Models\StatisticsWidget;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FactionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Seed/Find Users
        $superadmin = User::updateOrCreate(
            ['username' => 'testuser'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => true,
                'membership_tier_id' => 3, // Enterprise
            ]
        );

        $chiefHernandez = User::updateOrCreate(
            ['username' => 'chief_hernandez'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 3, // Enterprise
            ]
        );

        $captainMiller = User::updateOrCreate(
            ['username' => 'captain_miller'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $officerJones = User::updateOrCreate(
            ['username' => 'officer_jones'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $officerSmith = User::updateOrCreate(
            ['username' => 'officer_smith'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $chiefDavis = User::updateOrCreate(
            ['username' => 'chief_davis'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 2, // Premium
            ]
        );

        $firefighterDoe = User::updateOrCreate(
            ['username' => 'firefighter_doe'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $mechanicJack = User::updateOrCreate(
            ['username' => 'mechanic_jack'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1, // Bronze
            ]
        );

        $mechanicBob = User::updateOrCreate(
            ['username' => 'mechanic_bob'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $marabuntaLeader = User::updateOrCreate(
            ['username' => 'marabunta_leader'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        $regularUser = User::updateOrCreate(
            ['username' => 'regular_user'],
            [
                'password' => Hash::make('password'),
                'is_superadmin' => false,
                'membership_tier_id' => 1,
            ]
        );

        // 2. Seed Factions
        $lspd = Faction::updateOrCreate(
            ['shortname' => 'LSPD'],
            [
                'name' => 'Los Santos Police Department',
                'description' => 'To Protect and to Serve. The premier law enforcement agency in Los Santos.',
                'color' => '#1d4ed8',
                'visibility' => 'public',
                'access' => 'invite-only',
                'faction_leader' => $chiefHernandez->id,
                'created_by' => $chiefHernandez->id,
            ]
        );

        $lsfd = Faction::updateOrCreate(
            ['shortname' => 'LSFD'],
            [
                'name' => 'Los Santos Fire Department',
                'description' => 'Courage, Commitment, Compassion. LSFD provides fire protection and medical services.',
                'color' => '#b91c1c',
                'visibility' => 'public',
                'access' => 'invite-only',
                'faction_leader' => $chiefDavis->id,
                'created_by' => $chiefDavis->id,
            ]
        );

        $lsc = Faction::updateOrCreate(
            ['shortname' => 'LSC'],
            [
                'name' => 'Los Santos Customs',
                'description' => 'Your one-stop shop for vehicle repair, tuning, and custom upgrades.',
                'color' => '#047857',
                'visibility' => 'public',
                'access' => 'public',
                'faction_leader' => $mechanicJack->id,
                'created_by' => $mechanicJack->id,
            ]
        );

        $marabunta = Faction::updateOrCreate(
            ['shortname' => 'MG13'],
            [
                'name' => 'Marabunta Grande 13',
                'description' => 'A street gang operating in East Los Santos.',
                'color' => '#0e7490',
                'visibility' => 'private',
                'access' => 'invite-only',
                'faction_leader' => $marabuntaLeader->id,
                'created_by' => $marabuntaLeader->id,
            ]
        );

        // 3. Faction-User Pivot link (memberships)
        $lspd->users()->syncWithoutDetaching([
            $chiefHernandez->id,
            $captainMiller->id,
            $officerJones->id,
            $officerSmith->id,
            $superadmin->id,
        ]);

        $lsfd->users()->syncWithoutDetaching([
            $chiefDavis->id,
            $firefighterDoe->id,
            $superadmin->id,
        ]);

        $lsc->users()->syncWithoutDetaching([
            $mechanicJack->id,
            $mechanicBob->id,
            $superadmin->id,
        ]);

        $marabunta->users()->syncWithoutDetaching([
            $marabuntaLeader->id,
            $superadmin->id,
        ]);

        // Helper function to seed roles and their permissions
        $seedFactionRoles = function (Faction $faction, array $roleConfig) {
            $roles = [];
            foreach ($roleConfig as $config) {
                $role = Role::updateOrCreate(
                    [
                        'faction_id' => $faction->id,
                        'name' => $config['name'],
                    ],
                    [
                        'weight' => $config['weight'],
                        'color' => $config['color'] ?? '#6b7280',
                        'type' => $config['type'] ?? 'primary',
                    ]
                );

                // Set Permissions
                foreach ($config['permissions'] as $key => $val) {
                    Permission::updateOrCreate(
                        [
                            'role_id' => $role->id,
                            'permission_key' => $key,
                        ],
                        [
                            'value' => $val,
                        ]
                    );
                }
                $roles[$config['name']] = $role;
            }

            return $roles;
        };

        // 4. Seed LSPD Roles
        $lspdRoles = $seedFactionRoles($lspd, [
            [
                'name' => 'Administrator',
                'weight' => 100,
                'color' => '#dc2626',
                'type' => 'primary',
                'permissions' => ['administrator' => 'YES'],
            ],
            [
                'name' => 'Command',
                'weight' => 80,
                'color' => '#1e3a8a',
                'type' => 'primary',
                'permissions' => [
                    'view_admin_page' => 'YES',
                    'view_users' => 'YES',
                    'view_permissions' => 'YES',
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                    'view_groups' => 'YES',
                    'create_roster' => 'YES',
                    'global_roster_moderation' => 'YES',
                    'view_faction_records' => 'YES',
                    'create_faction_record_database' => 'YES',
                    'global_faction_record_moderation' => 'YES',
                    'view_faction_forms' => 'YES',
                    'global_faction_form_moderation' => 'YES',
                    'view_audit_logs' => 'YES',
                    'view_statistics' => 'YES',
                    'create_statistics_model' => 'YES',
                    'global_statistics_moderation' => 'YES',
                ],
            ],
            [
                'name' => 'Sergeant',
                'weight' => 60,
                'color' => '#1e40af',
                'type' => 'primary',
                'permissions' => [
                    'view_admin_page' => 'YES',
                    'view_users' => 'YES',
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                    'view_groups' => 'YES',
                    'view_faction_records' => 'YES',
                    'view_faction_forms' => 'YES',
                    'view_statistics' => 'YES',
                ],
            ],
            [
                'name' => 'Officer',
                'weight' => 40,
                'color' => '#3b82f6',
                'type' => 'primary',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                    'view_groups' => 'YES',
                    'view_faction_records' => 'YES',
                ],
            ],
            [
                'name' => 'Cadet',
                'weight' => 20,
                'color' => '#93c5fd',
                'type' => 'primary',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                ],
            ],
            [
                'name' => 'Public',
                'weight' => 0,
                'color' => '#6b7280',
                'type' => 'secondary',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                ],
            ],
        ]);

        // Link LSPD members to Roles
        $chiefHernandez->roles()->syncWithoutDetaching([$lspdRoles['Administrator']->id]);
        $captainMiller->roles()->syncWithoutDetaching([$lspdRoles['Command']->id]);
        $officerJones->roles()->syncWithoutDetaching([$lspdRoles['Sergeant']->id]);
        $officerSmith->roles()->syncWithoutDetaching([$lspdRoles['Officer']->id]);

        // Seed LSFD Roles
        $lsfdRoles = $seedFactionRoles($lsfd, [
            [
                'name' => 'Administrator',
                'weight' => 100,
                'color' => '#b91c1c',
                'permissions' => ['administrator' => 'YES'],
            ],
            [
                'name' => 'Command',
                'weight' => 80,
                'color' => '#dc2626',
                'permissions' => [
                    'view_admin_page' => 'YES',
                    'view_users' => 'YES',
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                    'view_groups' => 'YES',
                    'create_roster' => 'YES',
                    'global_roster_moderation' => 'YES',
                    'view_faction_records' => 'YES',
                    'view_audit_logs' => 'YES',
                ],
            ],
            [
                'name' => 'Firefighter',
                'weight' => 50,
                'color' => '#ef4444',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                    'view_groups' => 'YES',
                ],
            ],
            [
                'name' => 'Public',
                'weight' => 0,
                'color' => '#6b7280',
                'type' => 'secondary',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                ],
            ],
        ]);

        $chiefDavis->roles()->syncWithoutDetaching([$lsfdRoles['Administrator']->id]);
        $firefighterDoe->roles()->syncWithoutDetaching([$lsfdRoles['Firefighter']->id]);

        // Seed LSC Roles
        $lscRoles = $seedFactionRoles($lsc, [
            [
                'name' => 'Administrator',
                'weight' => 100,
                'color' => '#047857',
                'permissions' => ['administrator' => 'YES'],
            ],
            [
                'name' => 'Mechanic',
                'weight' => 50,
                'color' => '#10b981',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                ],
            ],
            [
                'name' => 'Public',
                'weight' => 0,
                'color' => '#6b7280',
                'type' => 'secondary',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                ],
            ],
        ]);

        $mechanicJack->roles()->syncWithoutDetaching([$lscRoles['Administrator']->id]);
        $mechanicBob->roles()->syncWithoutDetaching([$lscRoles['Mechanic']->id]);

        // Seed MG13 Roles
        $mgRoles = $seedFactionRoles($marabunta, [
            [
                'name' => 'Administrator',
                'weight' => 100,
                'color' => '#0e7490',
                'permissions' => ['administrator' => 'YES'],
            ],
            [
                'name' => 'Soldado',
                'weight' => 40,
                'color' => '#06b6d4',
                'permissions' => [
                    'view_faction_roster' => 'YES',
                    'utilize_sandbox_rosters' => 'YES',
                ],
            ],
            [
                'name' => 'Public',
                'weight' => 0,
                'color' => '#6b7280',
                'type' => 'secondary',
                'permissions' => [],
            ],
        ]);

        $marabuntaLeader->roles()->syncWithoutDetaching([$mgRoles['Administrator']->id]);

        // 5. Seed Groups
        $swatGroup = Group::updateOrCreate(
            ['faction_id' => $lspd->id, 'name' => 'Metro Division (SWAT)'],
            ['color' => '#1e3a8a', 'created_by' => $chiefHernandez->id]
        );

        $dbGroup = Group::updateOrCreate(
            ['faction_id' => $lspd->id, 'name' => 'Detective Bureau'],
            ['color' => '#4b5563', 'created_by' => $chiefHernandez->id]
        );

        // Attach SWAT group users
        $swatGroup->members()->syncWithoutDetaching([
            $captainMiller->id => ['is_leader' => true],
            $officerSmith->id => ['is_leader' => false],
        ]);

        // Attach Detective group users
        $dbGroup->members()->syncWithoutDetaching([
            $officerJones->id => ['is_leader' => true],
        ]);

        // 6. Seed Roster Datasets & Options
        $dutyStatusDataset = RosterDataset::create([
            'faction_id' => $lspd->id,
            'name' => 'Duty Status',
        ]);

        RosterDatasetOption::create([
            'roster_dataset_id' => $dutyStatusDataset->id,
            'value' => 'On Duty',
            'color' => '#059669',
            'is_bold' => true,
            'order' => 0,
        ]);

        RosterDatasetOption::create([
            'roster_dataset_id' => $dutyStatusDataset->id,
            'value' => 'Off Duty',
            'color' => '#6b7280',
            'is_bold' => false,
            'order' => 1,
        ]);

        RosterDatasetOption::create([
            'roster_dataset_id' => $dutyStatusDataset->id,
            'value' => 'LOA',
            'color' => '#d97706',
            'is_bold' => true,
            'order' => 2,
        ]);

        RosterDatasetOption::create([
            'roster_dataset_id' => $dutyStatusDataset->id,
            'value' => 'Suspended',
            'color' => '#dc2626',
            'is_bold' => true,
            'order' => 3,
        ]);

        $lspdRanksDataset = RosterDataset::create([
            'faction_id' => $lspd->id,
            'name' => 'LSPD Ranks',
        ]);

        $ranks = ['Chief of Police', 'Police Captain', 'Police Lieutenant', 'Police Sergeant', 'Police Officer III', 'Police Officer II', 'Police Officer I', 'Police Cadet'];
        foreach ($ranks as $index => $rankName) {
            RosterDatasetOption::create([
                'roster_dataset_id' => $lspdRanksDataset->id,
                'value' => $rankName,
                'color' => null,
                'is_bold' => ($index < 4),
                'order' => $index,
            ]);
        }

        // 7. Seed Rosters & Columns
        $lspdMainRoster = Roster::create([
            'faction_id' => $lspd->id,
            'name' => 'LSPD Main Roster',
            'shortname' => 'MAIN',
            'color' => '#1d4ed8',
            'order' => 0,
            'columns' => [
                ['id' => 'rank', 'name' => 'Rank', 'type' => 'dataset', 'dataset_id' => $lspdRanksDataset->id, 'checkboxes' => ['Acting']],
                ['id' => 'name', 'name' => 'Name', 'type' => 'text', 'checkboxes' => ['LOA']],
                ['id' => 'badge', 'name' => 'Badge', 'type' => 'text', 'checkboxes' => []],
                ['id' => 'status', 'name' => 'Status', 'type' => 'dataset', 'dataset_id' => $dutyStatusDataset->id, 'checkboxes' => []],
                ['id' => 'specialty', 'name' => 'Specialty', 'type' => 'text', 'checkboxes' => []],
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Seed Roster Flags
        RosterFlag::create([
            'faction_id' => $lspd->id,
            'name' => 'Officer on LOA',
            'icon' => 'clock',
            'color' => '#d97706',
            'rules' => [
                ['column' => 'status', 'operator' => 'equals', 'value' => 'LOA'],
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Roster Sections
        $cmdSection = RosterSection::create([
            'roster_id' => $lspdMainRoster->id,
            'name' => 'Command Staff',
            'shortname' => 'CMD',
            'color' => '#1e3a8a',
            'type' => 'master',
            'order' => 0,
            'created_by' => $chiefHernandez->id,
        ]);

        $patrolSection = RosterSection::create([
            'roster_id' => $lspdMainRoster->id,
            'name' => 'Patrol Division',
            'shortname' => 'PATROL',
            'color' => '#3b82f6',
            'type' => 'section',
            'order' => 1,
            'created_by' => $chiefHernandez->id,
        ]);

        $cadetSection = RosterSection::create([
            'roster_id' => $lspdMainRoster->id,
            'name' => 'Cadet Pool',
            'shortname' => 'CADET',
            'color' => '#93c5fd',
            'type' => 'subsection',
            'order' => 2,
            'created_by' => $chiefHernandez->id,
        ]);

        // Roster Content Rows
        // Chief Hernandez
        RosterContent::create([
            'section_id' => $cmdSection->id,
            'order' => 0,
            'type' => 'predefined',
            'content' => [
                'rank' => 'Chief of Police',
                'name' => 'Santiago Hernandez',
                'badge' => '1',
                'status' => 'On Duty',
                'specialty' => 'Administration',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Captain Miller
        RosterContent::create([
            'section_id' => $cmdSection->id,
            'order' => 1,
            'type' => 'predefined',
            'content' => [
                'rank' => 'Police Captain',
                'name' => 'Marcus Miller',
                'badge' => '5',
                'status' => 'On Duty',
                'specialty' => 'SWAT Commander',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Sgt Jones
        RosterContent::create([
            'section_id' => $patrolSection->id,
            'order' => 0,
            'type' => 'predefined',
            'content' => [
                'rank' => 'Police Sergeant',
                'name' => 'David Jones',
                'badge' => '12',
                'status' => 'On Duty',
                'specialty' => 'K9 Lead',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Officer Smith
        RosterContent::create([
            'section_id' => $patrolSection->id,
            'order' => 1,
            'type' => 'predefined',
            'content' => [
                'rank' => 'Police Officer III',
                'name' => 'John Smith',
                'badge' => '99',
                'status' => 'LOA',
                'specialty' => 'Traffic Patrol',
                'name_tags' => ['LOA'],
                'status_cb' => ['LOA'],
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Cadet
        RosterContent::create([
            'section_id' => $cadetSection->id,
            'order' => 0,
            'type' => 'predefined',
            'content' => [
                'rank' => 'Police Cadet',
                'name' => 'Lucas Brown',
                'badge' => '501',
                'status' => 'Off Duty',
                'specialty' => '-',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // SWAT Roster (Hidden, Private)
        $lspdSwatRoster = Roster::create([
            'faction_id' => $lspd->id,
            'name' => 'SWAT Tactical Roster',
            'shortname' => 'SWAT',
            'color' => '#1e293b',
            'order' => 1,
            'columns' => [
                ['id' => 'rank', 'name' => 'SWAT Rank', 'type' => 'text', 'checkboxes' => []],
                ['id' => 'name', 'name' => 'Assigned Operator', 'type' => 'text', 'checkboxes' => []],
                ['id' => 'callsign', 'name' => 'Element Callsign', 'type' => 'text', 'checkboxes' => []],
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        $swatMasterSection = RosterSection::create([
            'roster_id' => $lspdSwatRoster->id,
            'name' => 'Metro SWAT Operators',
            'shortname' => 'METRO',
            'type' => 'master',
            'order' => 0,
            'created_by' => $chiefHernandez->id,
        ]);

        RosterContent::create([
            'section_id' => $swatMasterSection->id,
            'order' => 0,
            'content' => [
                'rank' => 'SWAT Commander',
                'name' => 'Marcus Miller',
                'callsign' => '10-DAVID-1',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        RosterContent::create([
            'section_id' => $swatMasterSection->id,
            'order' => 1,
            'content' => [
                'rank' => 'SWAT Operator',
                'name' => 'John Smith',
                'callsign' => '10-DAVID-12',
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // SWAT Roster Permissions (Only SWAT Group can view)
        RosterPermission::create([
            'roster_id' => $lspdSwatRoster->id,
            'group_id' => $swatGroup->id,
            'permissions' => ['view_roster'],
        ]);

        // 8. Seed Record Databases & Entries
        $warrantsDb = FactionRecordDatabase::create([
            'faction_id' => $lspd->id,
            'name' => 'Active Arrest Warrants',
            'description' => 'Arrest warrants approved by Command staff or Judges.',
            'allow_details_view' => true,
            'data_overview_display' => 'table',
            'data_entry_display' => 'detailed',
            'record_shortcode' => 'WRN',
            'is_published' => true,
            'database_structure' => [
                ['id' => 'suspect', 'name' => 'Suspect Name', 'type' => 'text', 'required' => true],
                ['id' => 'charges', 'name' => 'Charges Filed', 'type' => 'text', 'required' => true],
                ['id' => 'bail', 'name' => 'Bail Amount', 'type' => 'text', 'required' => false],
                ['id' => 'status', 'name' => 'Status', 'type' => 'dropdown', 'options' => ['Active', 'Cleared', 'Recalled'], 'required' => true],
                ['id' => 'officer', 'name' => 'Issuing Officer', 'type' => 'text', 'required' => true],
            ],
            'created_by' => $chiefHernandez->id,
        ]);

        // Database Permissions: Sergeant can add and edit, Officer can only view.
        FactionRecordDatabasePermission::create([
            'database_id' => $warrantsDb->id,
            'role_id' => $lspdRoles['Sergeant']->id,
            'permissions' => ['view_database', 'add_entries', 'modify_entries'],
        ]);

        FactionRecordDatabasePermission::create([
            'database_id' => $warrantsDb->id,
            'role_id' => $lspdRoles['Officer']->id,
            'permissions' => ['view_database'],
        ]);

        // Database Entries
        FactionRecordEntry::create([
            'database_id' => $warrantsDb->id,
            'entry_id' => 1,
            'data' => [
                'suspect' => 'Jimmy Giraldo',
                'charges' => 'Grand Theft Auto, Felony Evading, Reckless Driving',
                'bail' => '$50,000',
                'status' => 'Active',
                'officer' => 'Sgt. David Jones',
            ],
            'is_active' => true,
            'created_by' => $officerJones->id,
        ]);

        FactionRecordEntry::create([
            'database_id' => $warrantsDb->id,
            'entry_id' => 2,
            'data' => [
                'suspect' => 'Clara Jenkins',
                'charges' => 'Assault with a Deadly Weapon, Brandishing a Firearm',
                'bail' => '$120,000',
                'status' => 'Cleared',
                'officer' => 'Capt. Marcus Miller',
            ],
            'is_active' => true,
            'created_by' => $captainMiller->id,
        ]);

        // 9. Seed Statistics Model
        $statsModel = StatisticsModel::create([
            'faction_id' => $lspd->id,
            'name' => 'LSPD Operations Dashboard',
            'description' => 'Real-time charts monitoring division counts and officer duty statuses.',
            'created_by' => $chiefHernandez->id,
        ]);

        // Add 2 Widgets to the Dashboard
        StatisticsWidget::create([
            'statistics_model_id' => $statsModel->id,
            'name' => 'Officer Status Overview',
            'type' => 'pie',
            'configuration' => [
                'mode' => 'grouped',
                'formula' => 'roster_rows(' . $lspdMainRoster->id . ')',
                'group_by_column' => 'status',
            ],
            'cache_result' => [
                ['name' => 'On Duty', 'value' => 3.0, 'color' => null],
                ['name' => 'Off Duty', 'value' => 1.0, 'color' => null],
                ['name' => 'LOA', 'value' => 1.0, 'color' => null],
                ['name' => 'Suspended', 'value' => 0.0, 'color' => null],
            ],
            'last_calculated_at' => now(),
            'is_intensive' => false,
            'order' => 0,
            'width' => 6,
        ]);

        StatisticsWidget::create([
            'statistics_model_id' => $statsModel->id,
            'name' => 'Active Warrant Counts',
            'type' => 'stat',
            'configuration' => [
                'mode' => 'series',
                'series' => [
                    ['name' => 'Active Warrants', 'color' => '#ef4444', 'formula' => 'database_count(' . $warrantsDb->id . ', "status", "Active")'],
                ],
            ],
            'cache_result' => [
                ['name' => 'Active Warrants', 'value' => 1.0, 'color' => '#ef4444'],
            ],
            'last_calculated_at' => now(),
            'is_intensive' => false,
            'order' => 1,
            'width' => 6,
        ]);

        // 10. Seed Forms & Application Flow
        $lspdForm = Form::create([
            'faction_id' => $lspd->id,
            'name' => 'LSPD Cadet Application',
            'type' => 'standard',
            'description' => 'Official recruitment form to join the Los Santos Police Department as an Academy Cadet.',
            'is_public' => true,
            'requires_gtaw_login' => true,
            'cooldown_seconds' => 86400 * 7, // 1 week
            'cooldown_only_on_fail' => true,
            'max_submissions' => 0, // unlimited attempts (subject to cooldown)
            'is_enabled' => true,
            'created_by' => $chiefHernandez->id,
        ]);

        // Form Stages
        $appStage = FormStage::create([
            'form_id' => $lspdForm->id,
            'name' => 'Stage 1: Written Application',
            'order' => 0,
        ]);

        $bgStage = FormStage::create([
            'form_id' => $lspdForm->id,
            'name' => 'Stage 2: Background Investigation',
            'order' => 1,
        ]);

        $interviewStage = FormStage::create([
            'form_id' => $lspdForm->id,
            'name' => 'Stage 3: Oral Interview',
            'order' => 2,
        ]);

        $academyStage = FormStage::create([
            'form_id' => $lspdForm->id,
            'name' => 'Stage 4: Police Academy',
            'order' => 3,
        ]);

        // Form Statuses
        $statusPending = FormStatus::create([
            'form_id' => $lspdForm->id,
            'system_key' => 'pending',
            'name' => 'Pending Review',
            'order' => 0,
        ]);

        $statusReview = FormStatus::create([
            'form_id' => $lspdForm->id,
            'system_key' => 'under_review',
            'name' => 'Under Review',
            'order' => 1,
        ]);

        $statusInterview = FormStatus::create([
            'form_id' => $lspdForm->id,
            'system_key' => 'interview_scheduled',
            'name' => 'Interview Scheduled',
            'order' => 2,
        ]);

        $statusAccepted = FormStatus::create([
            'form_id' => $lspdForm->id,
            'system_key' => 'accepted',
            'name' => 'Accepted',
            'order' => 3,
            'is_passed' => true,
            'is_locked' => true,
        ]);

        $statusDenied = FormStatus::create([
            'form_id' => $lspdForm->id,
            'system_key' => 'denied',
            'name' => 'Denied',
            'order' => 4,
            'is_failed' => true,
            'is_closed' => true,
        ]);

        // Map status stage pivots if necessary (based on migrations, we have form_status_stage)
        // Let's insert the pivots directly or call the relation.
        $statusPending->stages()->attach($appStage->id);
        $statusReview->stages()->attach($bgStage->id);
        $statusInterview->stages()->attach($interviewStage->id);
        $statusAccepted->stages()->attach($academyStage->id);
        $statusDenied->stages()->attach($appStage->id);

        // Associate submit status in Stage 1
        $appStage->update(['submit_status_id' => $statusPending->id]);

        // Form Sections (for Written Application stage)
        $personalSection = FormSection::create([
            'form_stage_id' => $appStage->id,
            'name' => 'Personal Information',
            'description' => 'Provide basic details about your GTA World character.',
            'order' => 0,
        ]);

        $experienceSection = FormSection::create([
            'form_stage_id' => $appStage->id,
            'name' => 'Prior Experience & Narrative',
            'description' => 'Detail your background and reason for applying.',
            'order' => 1,
        ]);

        // Form Fields
        // Section 1 fields
        $fieldName = FormField::create([
            'form_section_id' => $personalSection->id,
            'type' => 'text',
            'label' => 'Full Character Name',
            'name' => 'full_name',
            'is_required' => true,
            'order' => 0,
            'width' => 12,
        ]);

        $fieldDob = FormField::create([
            'form_section_id' => $personalSection->id,
            'type' => 'text',
            'label' => 'Date of Birth (DD/MMM/YYYY)',
            'name' => 'dob',
            'is_required' => true,
            'order' => 1,
            'width' => 6,
        ]);

        $fieldForum = FormField::create([
            'form_section_id' => $personalSection->id,
            'type' => 'text',
            'label' => 'GTA:W Forum Username',
            'name' => 'forum_name',
            'is_required' => true,
            'order' => 2,
            'width' => 6,
        ]);

        // Section 2 fields
        $fieldConvictions = FormField::create([
            'form_section_id' => $experienceSection->id,
            'type' => 'radio',
            'label' => 'Have you ever been convicted of a felony crime on GTA World?',
            'name' => 'convictions',
            'options' => ['Yes', 'No'],
            'is_required' => true,
            'order' => 0,
            'width' => 12,
        ]);

        $fieldMotivation = FormField::create([
            'form_section_id' => $experienceSection->id,
            'type' => 'textarea',
            'label' => 'Please explain in detail your motivation for joining the LSPD.',
            'name' => 'motivation',
            'is_required' => true,
            'order' => 1,
            'width' => 12,
        ]);

        // 11. Seed Form Submission 1 (Pending Review)
        $sub1 = FormSubmission::create([
            'form_id' => $lspdForm->id,
            'user_id' => $regularUser->id,
            'current_stage_id' => $appStage->id,
            'current_status_id' => $statusPending->id,
            'started_at' => now()->subHours(2),
            'submitted_at' => now()->subHours(1),
        ]);

        FormResponse::create([
            'form_submission_id' => $sub1->id,
            'form_field_id' => $fieldName->id,
            'value' => 'Frank Castle',
        ]);

        FormResponse::create([
            'form_submission_id' => $sub1->id,
            'form_field_id' => $fieldDob->id,
            'value' => '10/NOV/1990',
        ]);

        FormResponse::create([
            'form_submission_id' => $sub1->id,
            'form_field_id' => $fieldForum->id,
            'value' => 'ThePunisher',
        ]);

        FormResponse::create([
            'form_submission_id' => $sub1->id,
            'form_field_id' => $fieldConvictions->id,
            'value' => 'No',
        ]);

        FormResponse::create([
            'form_submission_id' => $sub1->id,
            'form_field_id' => $fieldMotivation->id,
            'value' => 'I want to clean up the streets of Los Santos and make it a safe place for families. I have a military background and disciplined training.',
        ]);

        // Add a comment to sub1
        FormComment::create([
            'form_submission_id' => $sub1->id,
            'user_id' => $officerJones->id,
            'comment' => 'The motivation statement is quite brief but acceptable. Let\'s check his forum history.',
            'is_internal' => true,
            'form_section_id' => $experienceSection->id,
        ]);
    }
}
