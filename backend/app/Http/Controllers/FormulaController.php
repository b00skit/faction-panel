<?php

namespace App\Http\Controllers;

use App\Models\Faction;
use App\Services\FormulaEvaluatorService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FormulaController extends Controller
{
    protected FormulaEvaluatorService $evaluator;

    public function __construct(FormulaEvaluatorService $evaluator)
    {
        $this->evaluator = $evaluator;
    }

    public function evaluate(Request $request, string $shortname)
    {
        $faction = Faction::where('shortname', $shortname)->firstOrFail();
        $user = Auth::user();

        // Must be superadmin, faction leader, or faction member
        if (!$user->is_superadmin && !$faction->users()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'formula' => 'required|string',
        ]);

        try {
            $result = $this->evaluator->evaluate($validated['formula'], $faction->id);

            return response()->json([
                'success' => true,
                'result' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }
}
