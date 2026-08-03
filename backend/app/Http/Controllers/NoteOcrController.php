<?php

namespace App\Http\Controllers;

use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NoteOcrController extends Controller
{
    use ApiResponse;

    private const MODELS = [
        'gemini-2.5-flash',
        'gemini-2.0-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.0-flash',
    ];

    private const GEMINI_LIMITS = ['rpm' => 15, 'rpd' => 500];

    private const OCR_PROMPT = <<<'PROMPT'
You are a precise image-to-text OCR assistant. Extract ALL visible text from this image as copyable text while preserving the original layout and formatting.

FORMATTING RULES (use the "blocks" array):
- Numbered section titles like "1. Automatic Receipt Snapshot" → type "heading", level 3
- Large titles → type "heading", level 2
- Subtitles → type "heading", level 3
- Normal body text → type "paragraph". Use **bold** for bold/emphasized words, *italic* for italic, `code` for inline code.
- Bullet points (•, -, *) → type "bulletList" with "items" array. Each item can use **bold** inline.
- Numbered steps inside a section → type "orderedList" with "items" array
- Code or monospace blocks → type "codeBlock"
- Block quotes → type "blockquote"
- Blank lines between sections — start a new block

TABLE RULES (use "tables" array):
- Read tables ROW BY ROW (left to right), NEVER column by column
- Each horizontal row in the image = one row array
- Put column titles in "headers"

Set content_type to: "table" (only tables), "text" (docs/books/screenshots), or "mixed" (both).
Extract every word visible. Preserve paragraph breaks, list structure, and emphasis exactly as shown.
PROMPT;

    private function responseSchema(): array
    {
        $blockSchema = [
            'type' => 'object',
            'properties' => [
                'type' => [
                    'type' => 'string',
                    'enum' => ['heading', 'paragraph', 'bulletList', 'orderedList', 'codeBlock', 'blockquote'],
                ],
                'level' => ['type' => 'integer'],
                'text' => ['type' => 'string'],
                'items' => [
                    'type' => 'array',
                    'items' => ['type' => 'string'],
                ],
            ],
            'required' => ['type'],
        ];

        return [
            'type' => 'object',
            'properties' => [
                'content_type' => [
                    'type' => 'string',
                    'enum' => ['table', 'text', 'mixed'],
                ],
                'title' => ['type' => 'string'],
                'blocks' => [
                    'type' => 'array',
                    'items' => $blockSchema,
                ],
                'tables' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'headers' => [
                                'type' => 'array',
                                'items' => ['type' => 'string'],
                            ],
                            'rows' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'array',
                                    'items' => ['type' => 'string'],
                                ],
                            ],
                        ],
                        'required' => ['headers', 'rows'],
                    ],
                ],
                'text' => ['type' => 'string'],
            ],
            'required' => ['content_type'],
        ];
    }

    public function extractText(Request $request)
    {
        $validated = $request->validate([
            'image' => 'required|image|max:10240',
        ]);

        $keys = $this->loadGeminiKeys();
        if (empty($keys)) {
            return $this->error('OCR service unavailable. Use offline mode.', 503);
        }

        $file = $validated['image'];
        $mimeType = $file->getMimeType() ?: 'image/jpeg';
        $base64 = base64_encode(file_get_contents($file->getRealPath()));

        $result = $this->executeWithModelAndKeyRotation($keys, $mimeType, $base64);

        if (!$result) {
            return $this->error('All Gemini API keys are rate-limited. Wait a minute or use offline mode.', 503);
        }

        $response = $result['response'];

        if (!$response->successful()) {
            Log::warning('Note OCR Gemini error', [
                'status' => $response->status(),
                'model' => $result['model'] ?? null,
                'key_prefix' => substr($result['key'] ?? '', 0, 8),
                'body' => substr($response->body(), 0, 500),
            ]);
            return $this->error('Failed to extract text from image.', 502);
        }

        $rawJson = data_get($response->json(), 'candidates.0.content.parts.0.text');

        if (!is_string($rawJson) || trim($rawJson) === '') {
            return $this->error('No readable text found in the image.', 422);
        }

        $parsed = json_decode($rawJson, true);
        if (!is_array($parsed)) {
            return $this->error('Failed to parse OCR result.', 422);
        }

        $parsed = $this->normalizeParsed($parsed);
        $text = $this->buildPlainTextFromParsed($parsed);

        if (trim($text) === '') {
            return $this->error('No readable text found in the image.', 422);
        }

        return $this->success([
            'text' => $text,
            'structured' => $parsed,
            'provider' => 'gemini',
            'model' => $result['model'],
            'key_index' => $result['key_index'],
        ], 'Text extracted successfully');
    }

    private function normalizeParsed(array $parsed): array
    {
        if (!empty($parsed['blocks']) || !empty($parsed['tables'])) {
            return $parsed;
        }

        if (array_is_list($parsed) && !empty($parsed[0]) && is_array($parsed[0])) {
            $first = $parsed[0];
            $headers = array_keys($first);
            $rows = array_map(fn ($row) => array_values($row), $parsed);

            return [
                'content_type' => 'table',
                'tables' => [['headers' => $headers, 'rows' => $rows]],
            ];
        }

        if (!empty($parsed['text']) && empty($parsed['blocks'])) {
            $parsed['blocks'] = $this->markdownToBlocks($parsed['text']);
        }

        return $parsed;
    }

    private function markdownToBlocks(string $markdown): array
    {
        $blocks = [];
        $lines = preg_split('/\r\n|\r|\n/', trim($markdown));

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '') {
                continue;
            }
            if (preg_match('/^#{1,3}\s+(.+)$/', $trimmed, $m)) {
                $blocks[] = ['type' => 'heading', 'level' => strlen(explode(' ', $trimmed)[0]), 'text' => $m[1]];
            } elseif (preg_match('/^\d+\.\s+(.+)$/', $trimmed, $m)) {
                $blocks[] = ['type' => 'heading', 'level' => 3, 'text' => $trimmed];
            } elseif (preg_match('/^[-*•]\s+(.+)$/', $trimmed, $m)) {
                $blocks[] = ['type' => 'bulletList', 'items' => [$m[1]]];
            } else {
                $blocks[] = ['type' => 'paragraph', 'text' => $trimmed];
            }
        }

        return $blocks;
    }

    private function buildPlainTextFromParsed(array $parsed): string
    {
        $parts = [];

        if (!empty($parsed['title'])) {
            $parts[] = $parsed['title'];
        }

        foreach ($parsed['blocks'] ?? [] as $block) {
            $parts[] = $this->blockToPlainText($block);
        }

        foreach ($parsed['tables'] ?? [] as $table) {
            $headers = $table['headers'] ?? [];
            $rows = $table['rows'] ?? [];
            if (empty($headers)) {
                continue;
            }

            $parts[] = '| ' . implode(' | ', $headers) . ' |';
            $parts[] = '| ' . implode(' | ', array_fill(0, count($headers), '---')) . ' |';
            foreach ($rows as $row) {
                $cells = [];
                for ($i = 0; $i < count($headers); $i++) {
                    $cells[] = $row[$i] ?? '';
                }
                $parts[] = '| ' . implode(' | ', $cells) . ' |';
            }
        }

        if (!empty($parsed['text']) && empty($parsed['blocks'])) {
            $parts[] = trim($parsed['text']);
        }

        return trim(implode("\n\n", array_filter($parts)));
    }

    private function blockToPlainText(array $block): string
    {
        return match ($block['type'] ?? '') {
            'heading' => $block['text'] ?? '',
            'paragraph' => $block['text'] ?? '',
            'codeBlock' => $block['text'] ?? '',
            'blockquote' => '> ' . ($block['text'] ?? ''),
            'bulletList' => implode("\n", array_map(fn ($i) => '- ' . $i, $block['items'] ?? [])),
            'orderedList' => implode("\n", array_map(
                fn ($i, $idx) => ($idx + 1) . '. ' . $i,
                $block['items'] ?? [],
                array_keys($block['items'] ?? [])
            )),
            default => $block['text'] ?? '',
        };
    }

    private function loadGeminiKeys(): array
    {
        $keys = [];
        for ($i = 1; $i <= 4; $i++) {
            $key = env("GEMINI_API_KEY_{$i}");
            if (!empty($key)) {
                $keys[] = trim($key);
            }
        }

        if (empty($keys)) {
            $raw = env('GEMINI_API_KEY');
            if (!empty($raw)) {
                $keys = array_values(array_filter(array_map('trim', explode(',', $raw))));
            }
        }

        return array_values(array_filter($keys, fn ($k) => str_starts_with($k, 'AIza') || str_starts_with($k, 'AQ.')));
    }

    private function executeWithModelAndKeyRotation(array $keys, string $mimeType, string $base64): ?array
    {
        foreach (self::MODELS as $model) {
            $keysTried = 0;
            $keysRateLimited = 0;

            foreach ($keys as $keyIndex => $key) {
                $keysTried++;
                $keyHash = md5($key);
                $keyPrefix = substr($key, 0, 8);

                if ($this->isKeyBlocked($keyHash)) {
                    $keysRateLimited++;
                    continue;
                }

                try {
                    $response = Http::timeout(90)->post(
                        "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}",
                        [
                            'contents' => [[
                                'parts' => [
                                    ['text' => self::OCR_PROMPT],
                                    [
                                        'inline_data' => [
                                            'mime_type' => $mimeType,
                                            'data' => $base64,
                                        ],
                                    ],
                                ],
                            ]],
                            'generationConfig' => [
                                'temperature' => 0,
                                'maxOutputTokens' => 8192,
                                'responseMimeType' => 'application/json',
                                'responseSchema' => $this->responseSchema(),
                            ],
                        ]
                    );

                    if ($response->status() === 429) {
                        if ($this->isModelQuotaExhausted($response->body(), $model)) {
                            break;
                        }
                        $this->handleRateLimit($keyHash, $response->body());
                        $keysRateLimited++;
                        continue;
                    }

                    if ($response->status() === 401) {
                        Cache::put("api_key_rate_limited_{$keyHash}", 'invalid', now()->addHours(24));
                        continue;
                    }

                    if ($response->status() >= 500) {
                        continue;
                    }

                    if ($response->successful()) {
                        $this->incrementUsageCounters($keyHash);
                        return [
                            'response' => $response,
                            'key' => $key,
                            'key_index' => $keyIndex + 1,
                            'model' => $model,
                        ];
                    }
                } catch (\Throwable $e) {
                    Log::warning("Note OCR failed ({$model}, {$keyPrefix}): " . $e->getMessage());
                    continue;
                }
            }
        }

        return null;
    }

    private function isKeyBlocked(string $keyHash): bool
    {
        if (Cache::has("api_key_rate_limited_{$keyHash}")) {
            return true;
        }

        $limits = self::GEMINI_LIMITS;
        if ((int) Cache::get("api_key_rpm_count_{$keyHash}", 0) >= $limits['rpm']) {
            return true;
        }
        if ((int) Cache::get("api_key_rpd_count_{$keyHash}", 0) >= $limits['rpd']) {
            return true;
        }

        return false;
    }

    private function isModelQuotaExhausted(string $responseBody, string $model): bool
    {
        $body = strtolower($responseBody);

        return str_contains($body, 'limit: 0')
            && (str_contains($body, strtolower($model)) || str_contains($body, 'free_tier'));
    }

    private function handleRateLimit(string $keyHash, string $responseBody): void
    {
        $body = strtolower($responseBody);
        $isRpd = str_contains($body, 'per day')
            || (str_contains($body, 'daily') && !str_contains($body, 'limit: 0'));

        if ($isRpd) {
            Cache::put("api_key_rate_limited_{$keyHash}", 'rpd', now()->endOfDay());
            Cache::put("api_key_rpd_count_{$keyHash}", self::GEMINI_LIMITS['rpd'], now()->endOfDay());
        } else {
            Cache::put("api_key_rate_limited_{$keyHash}", 'rpm', now()->addSeconds(60));
            Cache::put("api_key_rpm_count_{$keyHash}", self::GEMINI_LIMITS['rpm'], now()->addSeconds(60));
        }
    }

    private function incrementUsageCounters(string $keyHash): void
    {
        $rpmCacheKey = "api_key_rpm_count_{$keyHash}";
        if (!Cache::has($rpmCacheKey)) {
            Cache::put($rpmCacheKey, 1, 60);
        } else {
            Cache::increment($rpmCacheKey);
        }

        $rpdCacheKey = "api_key_rpd_count_{$keyHash}";
        if (!Cache::has($rpdCacheKey)) {
            Cache::put($rpdCacheKey, 1, now()->endOfDay());
        } else {
            Cache::increment($rpdCacheKey);
        }
    }
}
