<?php

use App\Models\Faction;
use App\Models\Hierarchy;
use App\Models\HierarchyNode;
use App\Models\Roster;
use App\Models\RosterContent;
use App\Models\RosterSection;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->user = User::factory()->create(['is_superadmin' => true]);
    $this->faction = Faction::factory()->create();
    $this->user->factions()->attach($this->faction->id);
});

test('can create a hierarchy', function () {
    $response = $this->actingAs($this->user)
        ->postJson("/api/factions/{$this->faction->shortname}/hierarchies", [
            'name' => 'Command Structure',
            'color' => '#10b981',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Command Structure');

    $this->assertDatabaseHas('hierarchies', [
        'name' => 'Command Structure',
        'faction_id' => $this->faction->id,
    ]);

    // Check that a root node was automatically created
    $hierarchy = Hierarchy::where('name', 'Command Structure')->first();
    $this->assertDatabaseHas('hierarchy_nodes', [
        'hierarchy_id' => $hierarchy->id,
        'title' => 'Office of the Director',
    ]);
});

test('can update a hierarchy', function () {
    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'Old Structure',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/hierarchies/{$hierarchy->id}", [
            'name' => 'New Structure',
            'color' => '#ef4444',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('name', 'New Structure')
        ->assertJsonPath('color', '#ef4444');

    $this->assertDatabaseHas('hierarchies', [
        'id' => $hierarchy->id,
        'name' => 'New Structure',
        'color' => '#ef4444',
    ]);
});

test('can delete a hierarchy', function () {
    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'To Delete',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/hierarchies/{$hierarchy->id}");

    $response->assertStatus(200);
    $this->assertSoftDeleted('hierarchies', ['id' => $hierarchy->id]);
});

test('can manage hierarchy nodes and test two-way sync with roster', function () {
    // 1. Create a roster, section, and roster content row
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Personnel Roster',
        'shortname' => 'PERS',
        'color' => '#3b82f6',
        'order' => 0,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text'],
        ],
        'created_by' => $this->user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Command Staff',
        'shortname' => 'CMD',
        'type' => 'section',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $rosterContent = RosterContent::create([
        'section_id' => $section->id,
        'type' => 'predefined',
        'content' => ['name' => 'John Doe', 'rank' => 'Lieutenant'],
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // 2. Create a hierarchy connected to this roster
    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'Chain of Command',
        'color' => '#ffffff',
        'roster_id' => $roster->id,
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // 3. Create a node
    $node = HierarchyNode::create([
        'hierarchy_id' => $hierarchy->id,
        'title' => 'Top Office',
        'color' => '#ffffff',
        'slots' => [
            [
                'id' => 'slot_1',
                'roster_content_id' => null,
                'label' => 'Director',
                'value' => 'VACANT',
            ]
        ],
        'order' => 0,
    ]);

    // 4. Update the node, linking the slot to the RosterContent entry and changing name/rank values
    $response = $this->actingAs($this->user)
        ->putJson("/api/hierarchy-nodes/{$node->id}", [
            'slots' => [
                [
                    'id' => 'slot_1',
                    'roster_content_id' => $rosterContent->id,
                    'label' => 'Chief of Police', // New rank label
                    'value' => 'Jane Doe',        // New name value
                ]
            ]
        ]);

    $response->assertStatus(200);

    // Verify the hierarchy node slots data
    $node->refresh();
    expect($node->slots[0]['roster_content_id'])->toBe($rosterContent->id);
    expect($node->slots[0]['label'])->toBe('Chief of Police');
    expect($node->slots[0]['value'])->toBe('Jane Doe');

    // Verify two-way editing: the RosterContent row should be updated in the database
    $rosterContent->refresh();
    expect($rosterContent->content['name'])->toBe('Jane Doe');
    expect($rosterContent->content['rank'])->toBe('Chief of Police');
});

test('can auto-link a node to a roster section and fetch dynamic slots', function () {
    // 1. Create a roster, section, and roster contents
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Personnel Roster',
        'shortname' => 'PERS',
        'color' => '#3b82f6',
        'order' => 0,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text'],
        ],
        'created_by' => $this->user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Command Staff',
        'shortname' => 'CMD',
        'type' => 'section',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $row1 = RosterContent::create([
        'section_id' => $section->id,
        'type' => 'predefined',
        'content' => ['name' => 'Alice Smith', 'rank' => 'Captain'],
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $row2 = RosterContent::create([
        'section_id' => $section->id,
        'type' => 'predefined',
        'content' => ['name' => 'Bob Jones', 'rank' => 'Lieutenant'],
        'order' => 1,
        'created_by' => $this->user->id,
    ]);

    // 2. Create a hierarchy
    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'Command',
        'color' => '#ffffff',
        'roster_id' => $roster->id,
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    // 3. Create a node with auto-link config
    $node = HierarchyNode::create([
        'hierarchy_id' => $hierarchy->id,
        'title' => 'Command Card',
        'color' => '#ffffff',
        'slots' => [],
        'roster_sync_config' => [
            'enabled' => true,
            'section_id' => $section->id,
            'row_start' => 1,
            'row_end' => 2,
            'key_col' => 'rank',
            'value_col' => 'name',
            'label_color' => '#ff0000',
            'label_bold' => true,
            'value_color' => null,
            'value_bold' => false,
        ],
        'order' => 0,
    ]);

    // 4. Fetch list of hierarchies from index, check that slots are resolved dynamically
    $response = $this->actingAs($this->user)
        ->getJson("/api/factions/{$this->faction->shortname}/hierarchies");

    $response->assertStatus(200);
    
    // Find the node in the tree and check its slots
    $data = $response->json();
    $fetchedHierarchy = collect($data)->firstWhere('id', $hierarchy->id);
    $fetchedNode = $fetchedHierarchy['nodes_tree'][0];

    expect($fetchedNode['slots'])->toHaveCount(2);
    expect($fetchedNode['slots'][0]['label'])->toBe('Captain');
    expect($fetchedNode['slots'][0]['value'])->toBe('Alice Smith');
    expect($fetchedNode['slots'][0]['label_color'])->toBe('#ff0000');
    expect($fetchedNode['slots'][0]['label_bold'])->toBeTrue();
    expect($fetchedNode['slots'][0]['value_bold'])->toBeFalse();

    expect($fetchedNode['slots'][1]['label'])->toBe('Lieutenant');
    expect($fetchedNode['slots'][1]['value'])->toBe('Bob Jones');
});

test('can validate and store sync config overrides and default bolding to true if unspecified', function () {
    $roster = Roster::create([
        'faction_id' => $this->faction->id,
        'name' => 'Personnel Roster',
        'shortname' => 'PERS',
        'color' => '#3b82f6',
        'order' => 0,
        'columns' => [
            ['id' => 'name', 'name' => 'Name', 'type' => 'text'],
            ['id' => 'rank', 'name' => 'Rank', 'type' => 'text'],
        ],
        'created_by' => $this->user->id,
    ]);

    $section = RosterSection::create([
        'roster_id' => $roster->id,
        'name' => 'Command Staff',
        'shortname' => 'CMD',
        'type' => 'section',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $row = RosterContent::create([
        'section_id' => $section->id,
        'type' => 'predefined',
        'content' => ['name' => 'Alice Smith', 'rank' => 'Captain'],
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'Structure',
        'color' => '#ffffff',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    $node = HierarchyNode::create([
        'hierarchy_id' => $hierarchy->id,
        'title' => 'Division',
        'color' => '#ffffff',
        'slots' => [],
        'order' => 0,
    ]);

    $response = $this->actingAs($this->user)
        ->putJson("/api/hierarchy-nodes/{$node->id}", [
            'roster_sync_config' => [
                'enabled' => true,
                'section_id' => $section->id,
                'label_color' => '#aabbcc',
                'label_bold' => false,
            ]
        ]);

    $response->assertStatus(200);
    
    $data = $response->json();
    expect($data['slots'][0]['label_bold'])->toBeFalse();
    expect($data['slots'][0]['value_bold'])->toBeTrue();
    expect($data['slots'][0]['label_color'])->toBe('#aabbcc');
    expect($data['slots'][0]['value_color'])->toBeNull();
});

test('hierarchy and node modifications invalidate cache and broadcast HierarchyUpdated event', function () {
    Event::fake([App\Events\HierarchyUpdated::class]);

    // 1. Create hierarchy (should trigger event & invalidate cache)
    $hierarchy = Hierarchy::create([
        'faction_id' => $this->faction->id,
        'name' => 'Cache Test Hierarchy',
        'color' => '#123456',
        'order' => 0,
        'created_by' => $this->user->id,
    ]);

    Event::assertDispatched(App\Events\HierarchyUpdated::class, function ($event) use ($hierarchy) {
        return $event->factionId === $this->faction->id && $event->hierarchyId === $hierarchy->id;
    });

    // 2. Create node (should trigger event & invalidate cache)
    Event::fake([App\Events\HierarchyUpdated::class]);
    $node = HierarchyNode::create([
        'hierarchy_id' => $hierarchy->id,
        'title' => 'Cache Test Node',
        'color' => '#123456',
        'slots' => [],
        'order' => 0,
    ]);

    Event::assertDispatched(App\Events\HierarchyUpdated::class, function ($event) use ($hierarchy) {
        return $event->factionId === $this->faction->id && $event->hierarchyId === $hierarchy->id;
    });

    // 3. Test caching in index
    Cache::flush();
    $versionKey = "diagrams_version_{$this->faction->id}";
    Cache::put($versionKey, 1);

    // Call index once to cache it
    $response1 = $this->actingAs($this->user)
        ->getJson("/api/factions/{$this->faction->shortname}/hierarchies");
    $response1->assertStatus(200);

    // Modify hierarchy directly in DB (bypass model events) to see if cache returns old values
    Hierarchy::where('id', $hierarchy->id)->update(['name' => 'Bypassed Name']);

    $response2 = $this->actingAs($this->user)
        ->getJson("/api/factions/{$this->faction->shortname}/hierarchies");
    $response2->assertStatus(200);
    // Should still have old name because of cache!
    expect($response2->json()[0]['name'])->toBe('Cache Test Hierarchy');

    // Trigger update on hierarchy (should invalidate cache)
    $this->actingAs($this->user)
        ->putJson("/api/hierarchies/{$hierarchy->id}", [
            'name' => 'Invalidated Name',
        ]);

    // Check index again
    $response3 = $this->actingAs($this->user)
        ->getJson("/api/factions/{$this->faction->shortname}/hierarchies");
    $response3->assertStatus(200);
    // Should now have the new name!
    expect($response3->json()[0]['name'])->toBe('Invalidated Name');
});

