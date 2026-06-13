<?php

namespace App\Http\Controllers;

use App\Models\ChangelogEntry;
use Illuminate\Http\Request;

class ChangelogController extends Controller
{
    public function index()
    {
        $this->audit('changelog.index', 'Viewed changelog entries');

        return response()->json(
            ChangelogEntry::orderBy('order', 'asc')->orderBy('released_at', 'desc')->get()
        );
    }

    public function store(Request $request)
    {
        if (! $request->user() || ! $request->user()->is_superadmin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'version' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'body' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.type' => 'required_with:items|string|in:Feature,Modification,Backend,Fix',
            'items.*.content' => 'required_with:items|string',
            'released_at' => 'required|date',
            'order' => 'sometimes|integer|min:0',
        ]);

        $entry = ChangelogEntry::create($data);

        $this->audit('changelog.create', "Created changelog entry '{$entry->title}' ({$entry->version})", null, $entry);

        return response()->json($entry, 201);
    }

    public function update(Request $request, ChangelogEntry $entry)
    {
        if (! $request->user() || ! $request->user()->is_superadmin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'version' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'body' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.type' => 'required_with:items|string|in:Feature,Modification,Backend,Fix',
            'items.*.content' => 'required_with:items|string',
            'released_at' => 'sometimes|date',
            'order' => 'sometimes|integer|min:0',
        ]);

        $oldValues = $entry->getOriginal();
        $entry->update($data);

        $this->audit('changelog.update', "Updated changelog entry '{$entry->title}' ({$entry->version})", null, $entry, $oldValues, $entry->getDirty());

        return response()->json($entry->fresh());
    }

    public function destroy(Request $request, ChangelogEntry $entry)
    {
        if (! $request->user() || ! $request->user()->is_superadmin) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->audit('changelog.delete', "Deleted changelog entry '{$entry->title}' ({$entry->version})", null, $entry, $entry->getAttributes());

        $entry->delete();

        return response()->json(null, 204);
    }
}
