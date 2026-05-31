<?php

namespace App\Http\Controllers;

use App\Models\AiTrainingLog;
use Illuminate\Http\Request;

class AiTrainingLogController extends Controller
{
    /**
     * Get all unreviewed local-missed logs, grouped by keyword with frequency count.
     * Only accessible to martinitokristan@gmail.com (enforced by is_admin middleware).
     */
    public function index()
    {
        $logs = AiTrainingLog::where('local_missed', true)
            ->where('reviewed', false)
            ->orderBy('keyword')
            ->orderBy('created_at', 'desc')
            ->get();

        // Group by keyword
        $grouped = $logs->groupBy('keyword')->map(function ($items, $keyword) {
            $first = $items->first();
            return [
                'keyword'          => $keyword ?? 'unknown',
                'count'            => $items->count(),
                'intent'           => $first->translated_intent,
                'example_input'    => $first->input_text,
                'ids'              => $items->pluck('id')->toArray(),
                'reasoning'        => $first->reasoning,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data'    => $grouped,
        ]);
    }

    /**
     * Mark selected log IDs as reviewed = true.
     */
    public function markReviewed(Request $request)
    {
        $request->validate([
            'ids'   => 'required|array',
            'ids.*' => 'integer|exists:ai_training_logs,id',
        ]);

        $logs = AiTrainingLog::whereIn('id', $request->ids)->get();

        // Map database intent names to chatRules.json verb keys
        $intentMap = [
            'log_expense' => 'expense_verbs',
            'deposit'     => 'deposit_verbs',
            'transfer'    => 'transfer_verbs',
            'create_debt' => 'debt_owe_verbs',
            'pay_debt'    => 'pay_debt_verbs',
        ];

        $filePath = base_path('../frontend/src/lib/chatRules.json');
        if (file_exists($filePath)) {
            $jsonString = file_get_contents($filePath);
            $rules = json_decode($jsonString, true);

            if (is_array($rules)) {
                $updated = false;
                foreach ($logs as $log) {
                    $intent = $log->translated_intent;
                    $keyword = trim($log->keyword);

                    // Skip empty/whitespace-only keywords or unsupported intents
                    if (empty($keyword) || !isset($intentMap[$intent])) {
                        continue;
                    }

                    $ruleKey = $intentMap[$intent];

                    if (isset($rules[$ruleKey]) && is_array($rules[$ruleKey])) {
                        // Check if verb already exists case-insensitively
                        $exists = false;
                        foreach ($rules[$ruleKey] as $existingVerb) {
                            if (strtolower($existingVerb) === strtolower($keyword)) {
                                $exists = true;
                                break;
                            }
                        }

                        if (!$exists) {
                            $rules[$ruleKey][] = $keyword;
                            $updated = true;
                        }
                    }
                }

                if ($updated) {
                    file_put_contents(
                        $filePath,
                        json_encode($rules, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    );
                }
            }
        }

        AiTrainingLog::whereIn('id', $request->ids)
            ->update(['reviewed' => true]);

        return response()->json(['success' => true]);
    }

    /**
     * Hard delete all records where reviewed = true to free up database storage.
     */
    public function clearReviewed()
    {
        $deleted = AiTrainingLog::where('reviewed', true)->delete();

        return response()->json([
            'success' => true,
            'deleted' => $deleted,
        ]);
    }
}
