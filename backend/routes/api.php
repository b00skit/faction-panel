<?php

use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChangelogController;
use App\Http\Controllers\CreditController;
use App\Http\Controllers\DatasetController;
use App\Http\Controllers\FactionController;
use App\Http\Controllers\FactionRecordController;
use App\Http\Controllers\FactionRecordEntryController;
use App\Http\Controllers\FactionRecordPermissionController;
use App\Http\Controllers\FactionSnapshotController;
use App\Http\Controllers\FactionUserFieldController;
use App\Http\Controllers\FormAutomationController;
use App\Http\Controllers\FormController;
use App\Http\Controllers\FormFieldController;
use App\Http\Controllers\FormPermissionController;
use App\Http\Controllers\FormSectionController;
use App\Http\Controllers\FormStageController;
use App\Http\Controllers\FormStatusController;
use App\Http\Controllers\FormSubmissionController;
use App\Http\Controllers\FormulaController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\HelpAdminController;
use App\Http\Controllers\HelpController;
use App\Http\Controllers\HierarchyController;
use App\Http\Controllers\HierarchyNodeController;
use App\Http\Controllers\HierarchyPermissionController;
use App\Http\Controllers\IntegrationController;
use App\Http\Controllers\InviteController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationSchemeController;
use App\Http\Controllers\QuickSearchController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RosterContentController;
use App\Http\Controllers\RosterController;
use App\Http\Controllers\RosterFlagController;
use App\Http\Controllers\RosterPermissionController;
use App\Http\Controllers\RosterRevisionController;
use App\Http\Controllers\RosterSectionController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\StatisticsController;
use App\Http\Controllers\StatisticsPermissionController;
use App\Http\Controllers\StatisticsWidgetController;
use App\Http\Controllers\SuperadminController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\KanbanProjectController;
use App\Http\Controllers\KanbanProjectPermissionController;
use App\Http\Controllers\KanbanCardTypeController;
use App\Http\Controllers\KanbanStatusController;
use App\Http\Controllers\KanbanLabelController;
use App\Http\Controllers\KanbanCardController;
use App\Http\Controllers\KanbanCommentController;
use App\Http\Controllers\KanbanSubtaskController;
use App\Http\Controllers\KanbanPriorityController;
use Illuminate\Support\Facades\Route;

Route::get('/setup/status', [SetupController::class, 'status']);
Route::post('/setup', [SetupController::class, 'setup']);

Route::get('/changelog', [ChangelogController::class, 'index']);

Route::post('/login', [AuthController::class, 'login']);
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');
Route::post('/register', [AuthController::class, 'register']);
Route::get('/auth/registration-status', [AuthController::class, 'registrationStatus']);
Route::get('/auth/gtaw/redirect', [AuthController::class, 'gtawRedirect']);
Route::post('/auth/gtaw/callback', [AuthController::class, 'gtawCallback']);
Route::get('/site-settings/public', [SuperadminController::class, 'getPublicSettings']);
Route::get('/credits', [CreditController::class, 'index']);

Route::get('/invites/{code}', [InviteController::class, 'show']);

Route::get('/factions/all', [FactionController::class, 'getAllFactions']);
Route::get('/permissions/config', [RoleController::class, 'getGlobalConfig']);

// Public/Guest Faction Access
Route::get('/factions/{shortname}', [FactionController::class, 'show']);
Route::get('/factions/{shortname}/permissions', [FactionController::class, 'getPermissions']);
Route::get('/factions/{shortname}/rosters', [RosterController::class, 'index']);
Route::get('/factions/{shortname}/hierarchies', [HierarchyController::class, 'index']);
Route::get('/factions/{shortname}/kanban/projects', [KanbanProjectController::class, 'index']);
Route::get('/kanban/card-types', [KanbanCardTypeController::class, 'index']);
Route::get('/kanban/priorities', [KanbanPriorityController::class, 'index']);
Route::post('/rosters/resolve-links', [RosterController::class, 'resolveLinks']);
Route::get('/factions/{shortname}/datasets', [DatasetController::class, 'index']);
Route::get('/factions/{shortname}/flags', [RosterFlagController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/user/unlink-gtaw', [AuthController::class, 'unlinkGtaw']);
    Route::post('/user/change-password', [AuthController::class, 'changePassword']);
    Route::put('/user/settings', [AuthController::class, 'updateSettings']);
    // Superadmin Routes
    Route::get('/superadmin/users', [SuperadminController::class, 'getUsers']);
    Route::post('/superadmin/users', [SuperadminController::class, 'storeUser']);
    Route::put('/superadmin/users/{user}', [SuperadminController::class, 'updateUser']);
    Route::delete('/superadmin/users/{user}', [SuperadminController::class, 'deleteUser']);
    Route::get('/superadmin/factions', [SuperadminController::class, 'getFactions']);
    Route::put('/superadmin/factions/{faction}', [SuperadminController::class, 'updateFaction']);
    Route::delete('/superadmin/factions/{faction}', [SuperadminController::class, 'deleteFaction']);
    Route::post('/superadmin/impersonate/{user}', [SuperadminController::class, 'impersonate']);

    // Superadmin System Notifications
    Route::get('/superadmin/notifications', [SuperadminController::class, 'getSystemNotifications']);
    Route::post('/superadmin/notifications', [SuperadminController::class, 'storeSystemNotification']);
    Route::delete('/superadmin/notifications/{notification}', [SuperadminController::class, 'deleteSystemNotification']);

    // Site Settings
    Route::get('/superadmin/settings', [SuperadminController::class, 'getSettings']);
    Route::put('/superadmin/settings', [SuperadminController::class, 'updateSettings']);

    // Membership Tier Routes
    Route::get('/superadmin/membership-tiers', [SuperadminController::class, 'getMembershipTiers']);
    Route::post('/superadmin/membership-tiers', [SuperadminController::class, 'storeMembershipTier']);
    Route::put('/superadmin/membership-tiers/{tier}', [SuperadminController::class, 'updateMembershipTier']);
    Route::delete('/superadmin/membership-tiers/{tier}', [SuperadminController::class, 'deleteMembershipTier']);

    // Credits Management Routes
    Route::post('/superadmin/credits', [CreditController::class, 'store']);
    Route::put('/superadmin/credits/{credit}', [CreditController::class, 'update']);
    Route::delete('/superadmin/credits/{credit}', [CreditController::class, 'destroy']);
    Route::put('/superadmin/credits/reorder', [CreditController::class, 'reorder']);

    // Changelog Management
    Route::post('/superadmin/changelog', [ChangelogController::class, 'store']);
    Route::put('/superadmin/changelog/{entry}', [ChangelogController::class, 'update']);
    Route::delete('/superadmin/changelog/{entry}', [ChangelogController::class, 'destroy']);

    Route::post('/invites/{code}/join', [InviteController::class, 'join']);

    // Invite Management
    Route::get('/factions/{shortname}/invites', [InviteController::class, 'index']);
    Route::post('/factions/{shortname}/invites', [InviteController::class, 'store']);
    Route::delete('/invites/{id}', [InviteController::class, 'destroy']);

    // Faction routes (Authenticated)
    Route::get('/factions', [FactionController::class, 'index']);
    Route::post('/factions', [FactionController::class, 'store']);
    Route::put('/factions/{faction}', [FactionController::class, 'update']);
    Route::post('/factions/{shortname}/upload-branding', [UploadController::class, 'uploadBranding']);

    Route::delete('/factions/{faction}', [FactionController::class, 'destroy']);
    Route::post('/factions/join', [FactionController::class, 'join']);
    Route::post('/factions/{faction}/leave', [FactionController::class, 'leave']);

    // User Management within Factions
    Route::get('/factions/{shortname}/users', [FactionController::class, 'getMembers']);
    Route::get('/factions/{shortname}/members', [FactionController::class, 'getMembers']);
    Route::post('/factions/{shortname}/sync-roster-data', [FactionController::class, 'syncRosterData']);
    Route::get('/factions/{shortname}/users/{member}', [FactionController::class, 'getMemberProfile']);
    Route::get('/factions/{shortname}/members/{member}', [FactionController::class, 'getMemberProfile']);

    // Custom User Fields
    Route::get('/factions/{shortname}/user-fields', [FactionUserFieldController::class, 'index']);
    Route::post('/factions/{shortname}/user-fields', [FactionUserFieldController::class, 'store']);
    Route::put('/user-fields/{field}', [FactionUserFieldController::class, 'update']);
    Route::delete('/user-fields/{field}', [FactionUserFieldController::class, 'destroy']);
    Route::put('/factions/{shortname}/users/{member}/user-fields', [FactionUserFieldController::class, 'updateUserValues']);

    Route::delete('/factions/{faction}/users/{user}', [FactionController::class, 'removeMember']);
    Route::put('/factions/{faction}/users/{user}/roles', [FactionController::class, 'updateMemberRoles']);

    // Role & Permission Management
    Route::get('/factions/{shortname}/roles', [RoleController::class, 'index']);
    Route::post('/factions/{shortname}/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
    Route::put('/roles/{role}/permissions', [RoleController::class, 'updatePermissions']);

    // Roster Management
    Route::post('/factions/{shortname}/rosters', [RosterController::class, 'store']);
    Route::put('/rosters/{roster}', [RosterController::class, 'update']);
    Route::delete('/rosters/{roster}', [RosterController::class, 'destroy']);
    Route::put('/factions/{shortname}/rosters/reorder', [RosterController::class, 'reorder']);

    // Roster Section Management
    Route::post('/rosters/{roster}/sections', [RosterSectionController::class, 'store']);
    Route::put('/sections/{section}', [RosterSectionController::class, 'update']);
    Route::delete('/sections/{section}', [RosterSectionController::class, 'destroy']);
    Route::put('/rosters/{roster}/sections/reorder', [RosterSectionController::class, 'reorder']);

    // Roster Content Management
    Route::post('/sections/{section}/contents', [RosterContentController::class, 'store']);
    Route::put('/contents/{content}', [RosterContentController::class, 'update']);
    Route::put('/contents/{content}/notes', [RosterContentController::class, 'updateNote']);
    Route::get('/contents/{content}/cell-history', [RosterContentController::class, 'cellHistory']);
    Route::post('/contents/{content}/lock', [RosterContentController::class, 'lock']);
    Route::post('/contents/{content}/unlock', [RosterContentController::class, 'unlock']);
    Route::delete('/contents/{content}', [RosterContentController::class, 'destroy']);
    Route::put('/sections/{section}/contents/reorder', [RosterContentController::class, 'reorder']);
    Route::put('/sections/{section}/contents/batch', [RosterContentController::class, 'batchUpdate']);

    // Group Management
    Route::get('/factions/{shortname}/groups', [GroupController::class, 'index']);
    Route::post('/factions/{shortname}/groups', [GroupController::class, 'store']);
    Route::put('/groups/{group}', [GroupController::class, 'update']);
    Route::delete('/groups/{group}', [GroupController::class, 'destroy']);
    Route::post('/groups/{group}/members', [GroupController::class, 'addMember']);
    Route::delete('/groups/{group}/members/{user}', [GroupController::class, 'removeMember']);
    Route::put('/groups/{group}/members/{user}/toggle-leader', [GroupController::class, 'toggleLeader']);

    // Roster Revision Management
    Route::get('/rosters/{roster}/revisions', [RosterRevisionController::class, 'index']);
    Route::get('/rosters/{roster}/revisions/{revision}', [RosterRevisionController::class, 'show']);
    Route::post('/rosters/{roster}/revisions/{revision}/restore', [RosterRevisionController::class, 'restore']);

    // Roster Permission Management
    Route::get('/rosters/{roster}/permissions', [RosterPermissionController::class, 'index']);
    Route::put('/rosters/{roster}/permissions', [RosterPermissionController::class, 'update']);
    Route::delete('/rosters/{roster}/permissions/{permissionId}', [RosterPermissionController::class, 'destroy']);
    Route::get('/rosters/{roster}/exclusions', [RosterPermissionController::class, 'getExclusions']);
    Route::post('/rosters/{roster}/exclusions', [RosterPermissionController::class, 'addExclusion']);
    Route::delete('/rosters/{roster}/exclusions/{roleId}', [RosterPermissionController::class, 'removeExclusion']);

    // Roster Dataset Management
    Route::post('/factions/{shortname}/datasets', [DatasetController::class, 'store']);
    Route::put('/datasets/{dataset}', [DatasetController::class, 'update']);
    Route::delete('/datasets/{dataset}', [DatasetController::class, 'destroy']);

    // Roster Flag Management
    Route::post('/factions/{shortname}/flags', [RosterFlagController::class, 'store']);
    Route::put('/flags/{flag}', [RosterFlagController::class, 'update']);
    Route::delete('/flags/{flag}', [RosterFlagController::class, 'destroy']);
    Route::post('/flags/{flag}/recalculate', [RosterFlagController::class, 'recalculate']);

    // Faction Record Management
    Route::get('/factions/{shortname}/records', [FactionRecordController::class, 'index']);
    Route::post('/factions/{shortname}/records', [FactionRecordController::class, 'store']);
    Route::get('/factions/{shortname}/records/{database}', [FactionRecordController::class, 'show']);
    Route::put('/factions/{shortname}/records/{database}', [FactionRecordController::class, 'update']);
    Route::delete('/factions/{shortname}/records/{database}', [FactionRecordController::class, 'destroy']);

    // Faction Record Permissions
    Route::get('/factions/{shortname}/records/{database}/permissions', [FactionRecordPermissionController::class, 'index']);
    Route::put('/factions/{shortname}/records/{database}/permissions', [FactionRecordPermissionController::class, 'update']);
    Route::delete('/factions/{shortname}/records/{database}/permissions/{permission}', [FactionRecordPermissionController::class, 'destroy']);

    // Faction Record Entries
    Route::get('/factions/{shortname}/records/{database}/entries', [FactionRecordEntryController::class, 'index']);
    Route::post('/factions/{shortname}/records/{database}/entries', [FactionRecordEntryController::class, 'store']);
    Route::get('/factions/{shortname}/records/{database}/entries/{entry}', [FactionRecordEntryController::class, 'show']);
    Route::put('/factions/{shortname}/records/{database}/entries/{entry}', [FactionRecordEntryController::class, 'update']);
    Route::delete('/factions/{shortname}/records/{database}/entries/{entry}', [FactionRecordEntryController::class, 'destroy']);

    // Audit Logs
    Route::get('/factions/{shortname}/audit-logs', [AuditLogController::class, 'index']);

    // Statistics Management
    Route::get('/factions/{shortname}/statistics', [StatisticsController::class, 'index']);
    Route::post('/factions/{shortname}/statistics', [StatisticsController::class, 'store']);
    Route::get('/statistics/{model}', [StatisticsController::class, 'show']);
    Route::put('/statistics/{model}', [StatisticsController::class, 'update']);
    Route::delete('/statistics/{model}', [StatisticsController::class, 'destroy']);
    Route::post('/statistics/{model}/recalculate', [StatisticsController::class, 'recalculate']);
    Route::post('/factions/{shortname}/formulas/evaluate', [FormulaController::class, 'evaluate']);

    // Statistics Widgets
    Route::post('/statistics/{model}/widgets', [StatisticsWidgetController::class, 'store']);
    Route::put('/statistics-widgets/{widget}', [StatisticsWidgetController::class, 'update']);
    Route::delete('/statistics-widgets/{widget}', [StatisticsWidgetController::class, 'destroy']);
    Route::post('/statistics-widgets/{widget}/recalculate', [StatisticsWidgetController::class, 'recalculate']);
    Route::put('/statistics/{model}/widgets/reorder', [StatisticsWidgetController::class, 'reorder']);

    // Statistics Permissions
    Route::get('/statistics/{model}/permissions', [StatisticsPermissionController::class, 'index']);
    Route::put('/statistics/{model}/permissions', [StatisticsPermissionController::class, 'update']);
    Route::delete('/statistics/{model}/permissions/{permissionId}', [StatisticsPermissionController::class, 'destroy']);

    // Faction Snapshots
    Route::get('/factions/{shortname}/snapshots', [FactionSnapshotController::class, 'index']);
    Route::post('/factions/{shortname}/snapshots', [FactionSnapshotController::class, 'store']);
    Route::post('/factions/{shortname}/snapshots/upload', [FactionSnapshotController::class, 'upload']);
    Route::get('/snapshots/{snapshot}/download', [FactionSnapshotController::class, 'download']);
    Route::post('/snapshots/{snapshot}/restore', [FactionSnapshotController::class, 'restore']);
    Route::delete('/snapshots/{snapshot}', [FactionSnapshotController::class, 'destroy']);
    Route::get('/factions/{shortname}/audit-logs/{auditLog}', [AuditLogController::class, 'show']);

    // Quick Search
    Route::put('/factions/{shortname}/quick-search/settings', [QuickSearchController::class, 'updateSettings']);
    Route::get('/factions/{shortname}/quick-search', [QuickSearchController::class, 'search']);

    // Faction Forms Management
    Route::get('/factions/{shortname}/forms', [FormController::class, 'index']);
    Route::post('/factions/{shortname}/forms', [FormController::class, 'store']);
    Route::get('/factions/{shortname}/forms/{form}', [FormController::class, 'show']);
    Route::put('/factions/{shortname}/forms/{form}', [FormController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}', [FormController::class, 'destroy']);

    // Faction Form Permissions
    Route::get('/factions/{shortname}/forms/{form}/permissions', [FormPermissionController::class, 'index']);
    Route::put('/factions/{shortname}/forms/{form}/permissions', [FormPermissionController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/permissions/{permissionId}', [FormPermissionController::class, 'destroy']);

    // Faction Form Editor Components
    // Stages
    Route::post('/factions/{shortname}/forms/{form}/stages', [FormStageController::class, 'store']);
    Route::put('/factions/{shortname}/forms/{form}/stages/{stage}', [FormStageController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/stages/{stage}', [FormStageController::class, 'destroy']);
    Route::put('/factions/{shortname}/forms/{form}/stages/reorder', [FormStageController::class, 'reorder']);

    // Sections
    Route::post('/factions/{shortname}/forms/{form}/stages/{stage}/sections', [FormSectionController::class, 'store']);
    Route::put('/factions/{shortname}/forms/{form}/sections/{section}', [FormSectionController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/sections/{section}', [FormSectionController::class, 'destroy']);
    Route::put('/factions/{shortname}/forms/{form}/stages/{stage}/sections/reorder', [FormSectionController::class, 'reorder']);
    Route::post('/factions/{shortname}/forms/{form}/sections/{section}/move', [FormSectionController::class, 'move']);

    // Fields
    Route::post('/factions/{shortname}/forms/{form}/sections/{section}/fields', [FormFieldController::class, 'store']);
    Route::put('/factions/{shortname}/forms/{form}/fields/{field}', [FormFieldController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/fields/{field}', [FormFieldController::class, 'destroy']);
    Route::put('/factions/{shortname}/forms/{form}/sections/{section}/fields/reorder', [FormFieldController::class, 'reorder']);
    Route::post('/factions/{shortname}/forms/{form}/fields/{field}/move', [FormFieldController::class, 'move']);

    // Statuses
    Route::post('/factions/{shortname}/forms/{form}/statuses', [FormStatusController::class, 'store']);
    Route::put('/factions/{shortname}/forms/{form}/statuses/{status}', [FormStatusController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/statuses/{status}', [FormStatusController::class, 'destroy']);
    Route::put('/factions/{shortname}/forms/{form}/statuses/reorder', [FormStatusController::class, 'reorder']);

    // Automations
    Route::get('/factions/{shortname}/forms/{form}/automations', [FormAutomationController::class, 'index']);
    Route::post('/factions/{shortname}/forms/{form}/automations', [FormAutomationController::class, 'store']);
    Route::put('/factions/{shortname}/forms/{form}/automations/{automation}', [FormAutomationController::class, 'update']);
    Route::delete('/factions/{shortname}/forms/{form}/automations/{automation}', [FormAutomationController::class, 'destroy']);

    // Form Submissions
    Route::get('/factions/{shortname}/submissions', [FormSubmissionController::class, 'globalIndex']);
    Route::get('/factions/{shortname}/my-submissions', [FormSubmissionController::class, 'mySubmissions']);
    Route::get('/factions/{shortname}/forms/{form}/submissions', [FormSubmissionController::class, 'index']);
    Route::post('/factions/{shortname}/forms/{form}/submissions/start', [FormSubmissionController::class, 'start']);
    Route::post('/factions/{shortname}/forms/{form}/submissions/{submission}/submit', [FormSubmissionController::class, 'submit']);
    Route::get('/factions/{shortname}/forms/submissions/{submission}', [FormSubmissionController::class, 'show']);
    Route::put('/factions/{shortname}/forms/submissions/{submission}/status', [FormSubmissionController::class, 'updateStatus']);
    Route::post('/factions/{shortname}/forms/submissions/{submission}/advance', [FormSubmissionController::class, 'advance']);
    Route::post('/factions/{shortname}/forms/submissions/{submission}/conclude', [FormSubmissionController::class, 'conclude']);
    Route::post('/factions/{shortname}/forms/submissions/{submission}/retake', [FormSubmissionController::class, 'retake']);
    Route::post('/factions/{shortname}/forms/submissions/{submission}/comments', [FormSubmissionController::class, 'addComment']);
    Route::post('/factions/{shortname}/forms/submissions/{submission}/grade', [FormSubmissionController::class, 'gradeResponses']);

    // GTA:W Integration
    Route::get('/factions/{shortname}/integrations/gtaw/available', [IntegrationController::class, 'getAvailableFactions']);
    Route::post('/factions/{shortname}/integrations/gtaw/setup', [IntegrationController::class, 'setupGtaw']);
    Route::post('/factions/{shortname}/integrations/gtaw/sync', [IntegrationController::class, 'syncGtaw']);
    Route::post('/factions/{shortname}/integrations/gtaw/prune', [IntegrationController::class, 'pruneGtaw']);
    Route::get('/factions/{shortname}/integrations/gtaw/automation', [IntegrationController::class, 'getAutomationSettings']);
    Route::post('/factions/{shortname}/integrations/gtaw/automation', [IntegrationController::class, 'saveAutomationSettings']);

    // Help Center Public Routes
    Route::get('/help/categories', [HelpController::class, 'getCategories']);
    Route::get('/help/categories/{category}/articles', [HelpController::class, 'getCategoryArticles']);
    Route::get('/help/articles/search', [HelpController::class, 'search']);
    Route::get('/help/articles/{slug}', [HelpController::class, 'getArticle']);

    // Help Center Admin Routes
    Route::prefix('help/admin')->group(function () {
        Route::get('/categories', [HelpAdminController::class, 'getCategories']);
        Route::post('/categories', [HelpAdminController::class, 'storeCategory']);
        Route::put('/categories/{category}', [HelpAdminController::class, 'updateCategory']);
        Route::delete('/categories/{category}', [HelpAdminController::class, 'deleteCategory']);

        Route::get('/articles', [HelpAdminController::class, 'getArticles']);
        Route::post('/articles', [HelpAdminController::class, 'storeArticle']);
        Route::put('/articles/{article}', [HelpAdminController::class, 'updateArticle']);
        Route::delete('/articles/{article}', [HelpAdminController::class, 'deleteArticle']);
    });

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read']);
    Route::post('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::post('/notifications/schemes/{scheme}/read-all', [NotificationController::class, 'readScheme']);

    // Notification Schemes
    Route::get('/factions/{shortname}/notification-schemes', [NotificationSchemeController::class, 'index']);
    Route::post('/factions/{shortname}/notification-schemes', [NotificationSchemeController::class, 'store']);
    Route::put('/notification-schemes/{scheme}', [NotificationSchemeController::class, 'update']);
    Route::delete('/notification-schemes/{scheme}', [NotificationSchemeController::class, 'destroy']);

    // Hierarchy Management
    Route::post('/factions/{shortname}/hierarchies', [HierarchyController::class, 'store']);
    Route::put('/hierarchies/{hierarchy}', [HierarchyController::class, 'update']);
    Route::delete('/hierarchies/{hierarchy}', [HierarchyController::class, 'destroy']);
    Route::put('/factions/{shortname}/hierarchies/reorder', [HierarchyController::class, 'reorder']);

    // Hierarchy Node Management
    Route::post('/hierarchies/{hierarchy}/nodes', [HierarchyNodeController::class, 'store']);
    Route::put('/hierarchy-nodes/{node}', [HierarchyNodeController::class, 'update']);
    Route::delete('/hierarchy-nodes/{node}', [HierarchyNodeController::class, 'destroy']);
    Route::put('/hierarchies/{hierarchy}/nodes/reorder', [HierarchyNodeController::class, 'reorder']);

    // Hierarchy Permission Management
    Route::get('/hierarchies/{hierarchy}/permissions', [HierarchyPermissionController::class, 'index']);
    Route::put('/hierarchies/{hierarchy}/permissions', [HierarchyPermissionController::class, 'update']);
    Route::delete('/hierarchies/{hierarchy}/permissions/{permissionId}', [HierarchyPermissionController::class, 'destroy']);

    // Kanban Project Management
    Route::post('/factions/{shortname}/kanban/projects', [KanbanProjectController::class, 'store']);
    Route::put('/kanban/projects/{project}', [KanbanProjectController::class, 'update']);
    Route::delete('/kanban/projects/{project}', [KanbanProjectController::class, 'destroy']);
    Route::put('/factions/{shortname}/kanban/projects/reorder', [KanbanProjectController::class, 'reorder']);
    Route::get('/kanban/projects/{project}/assignees', [KanbanProjectController::class, 'getAssignees']);

    // Kanban Project Permission Management
    Route::get('/kanban/projects/{project}/permissions', [KanbanProjectPermissionController::class, 'index']);
    Route::put('/kanban/projects/{project}/permissions', [KanbanProjectPermissionController::class, 'update']);
    Route::delete('/kanban/projects/{project}/permissions/{permissionId}', [KanbanProjectPermissionController::class, 'destroy']);

    // Kanban Card Type Management
    Route::post('/kanban/card-types', [KanbanCardTypeController::class, 'store']);
    Route::put('/kanban/card-types/{cardType}', [KanbanCardTypeController::class, 'update']);
    Route::delete('/kanban/card-types/{cardType}', [KanbanCardTypeController::class, 'destroy']);

    // Kanban Priority Management
    Route::post('/kanban/priorities', [KanbanPriorityController::class, 'store']);
    Route::put('/kanban/priorities/{priority}', [KanbanPriorityController::class, 'update']);
    Route::delete('/kanban/priorities/{priority}', [KanbanPriorityController::class, 'destroy']);

    // Kanban Status (Column) Management
    Route::post('/kanban/projects/{project}/statuses', [KanbanStatusController::class, 'store']);
    Route::put('/kanban/statuses/{status}', [KanbanStatusController::class, 'update']);
    Route::delete('/kanban/statuses/{status}', [KanbanStatusController::class, 'destroy']);
    Route::put('/kanban/projects/{project}/statuses/reorder', [KanbanStatusController::class, 'reorder']);

    // Kanban Label Management
    Route::get('/kanban/projects/{project}/labels', [KanbanLabelController::class, 'index']);
    Route::post('/kanban/projects/{project}/labels', [KanbanLabelController::class, 'store']);
    Route::put('/kanban/labels/{label}', [KanbanLabelController::class, 'update']);
    Route::delete('/kanban/labels/{label}', [KanbanLabelController::class, 'destroy']);

    // Kanban Card Management
    Route::get('/kanban/cards/{card}', [KanbanCardController::class, 'show']);
    Route::post('/kanban/projects/{project}/cards', [KanbanCardController::class, 'store']);
    Route::put('/kanban/cards/{card}', [KanbanCardController::class, 'update']);
    Route::delete('/kanban/cards/{card}', [KanbanCardController::class, 'destroy']);
    Route::post('/kanban/cards/{card}/move', [KanbanCardController::class, 'move']);
    Route::get('/kanban/projects/{project}/archived', [KanbanProjectController::class, 'archivedCards']);
    Route::post('/kanban/cards/{card}/archive', [KanbanCardController::class, 'archiveCard']);
    Route::post('/kanban/cards/{card}/restore', [KanbanCardController::class, 'restoreCard']);
    Route::get('/kanban/cards/{card}/activity', [KanbanCardController::class, 'activity']);

    // Kanban Comment Management
    Route::post('/kanban/cards/{card}/comments', [KanbanCommentController::class, 'store']);
    Route::delete('/kanban/comments/{comment}', [KanbanCommentController::class, 'destroy']);

    // Kanban Subtask Management
    Route::post('/kanban/cards/{card}/subtasks', [KanbanSubtaskController::class, 'store']);
    Route::put('/kanban/subtasks/{subtask}', [KanbanSubtaskController::class, 'update']);
    Route::delete('/kanban/subtasks/{subtask}', [KanbanSubtaskController::class, 'destroy']);
    Route::put('/kanban/cards/{card}/subtasks/reorder', [KanbanSubtaskController::class, 'reorder']);
});
