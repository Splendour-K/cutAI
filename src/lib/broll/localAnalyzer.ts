import type { AutoEditorAnalysisRequest } from '@/types/autoEditor';
import type { EditDecisionList, ARollSegment, BRollSuggestion } from '@/types/autoEditor';
import type { TranscriptSegment } from '@/hooks/useVideoAnalysis';

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','have','are','was','were','will','would','could','should','about','what','when','where','which','into','your','you','they','their','there','been','being','but','not','can','all','any','video','clip','like','just','get','got','also'
]);

// RAKE-like phrase extractor to capture meaningful multi-word phrases (noun phrases)
function extractCandidatePhrases(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  const phrases: string[] = [];
  let buffer: string[] = [];
  for (const t of tokens) {
    if (STOPWORDS.has(t) || t.length <= 2) {
      if (buffer.length > 0) {
        phrases.push(buffer.join(' '));
        buffer = [];
      }
    } else {
      buffer.push(t);
    }
  }
  if (buffer.length > 0) phrases.push(buffer.join(' '));

  // Also include single high-value tokens
  const singleTokens = tokens.filter(t => t.length > 3 && !STOPWORDS.has(t));
  return Array.from(new Set([...phrases, ...singleTokens]));
}

function scorePhrases(phrases: string[], text: string) {
  const scores: Record<string, number> = {};
  const lower = text.toLowerCase();
  for (const p of phrases) {
    // score by term frequency and length (prefer longer meaningful phrases)
    const occurrences = (lower.match(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    scores[p] = occurrences * (1 + p.split(' ').length * 0.5);
  }
  return scores;
}

function topKFromScores(scores: Record<string, number>, k = 3) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(e => e[0]);
}

function jaccardSimilarity(a: string, b: string) {
  const sa = new Set(a.split(/\s+/));
  const sb = new Set(b.split(/\s+/));
  const inter = new Set([...sa].filter(x => sb.has(x)));
  const union = new Set([...sa, ...sb]);
  return inter.size / (union.size || 1);
}

// Maximal Marginal Relevance (MMR) style pick to ensure diversity among queries
function pickDiverse(queries: string[], limit = 6) {
  if (queries.length <= limit) return queries;
  const selected: string[] = [];
  const remaining = [...queries];
  // seed with highest-ranked (assume input order is rank)
  selected.push(remaining.shift()!);
  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const q = remaining[i];
      // diversity score = min similarity to already selected
      const sim = Math.max(...selected.map(s => jaccardSimilarity(s, q)));
      const score = -sim; // prefer lower similarity
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected.slice(0, limit);
}

export async function analyzeAutoEdit(
  transcript: { fullText: string; segments: TranscriptSegment[] },
  videoDuration: number,
  options?: Partial<AutoEditorAnalysisRequest>
): Promise<EditDecisionList> {
  // Create A-roll segments directly from transcript segments
  const aRollSegments: ARollSegment[] = transcript.segments.map((seg, i) => ({
    id: `seg-${i}`,
    originalStartTime: seg.startTime,
    originalEndTime: seg.endTime,
    newStartTime: seg.startTime,
    newEndTime: seg.endTime,
    duration: Math.max(0.5, seg.endTime - seg.startTime),
    content: seg.text,
    isIncluded: true,
    cutType: 'hard',
  }));

  // Generate B-roll suggestions using phrase extraction and diversity
  const rawCandidates = transcript.segments
    .filter(s => (s.endTime - s.startTime) >= 1.5)
    .map((s, idx) => {
      const phrases = extractCandidatePhrases(s.text);
      const scores = scorePhrases(phrases, s.text);
      const top = topKFromScores(scores, 3);
      const queries = top.length > 0 ? top : [s.text.split(' ').slice(0, 6).join(' ')];
      return queries.map(q => ({
        id: `broll-${idx}-${Math.floor(s.startTime * 10)}-${q.slice(0,10).replace(/\s+/g,'-')}`,
        startTime: s.startTime,
        endTime: Math.min(s.endTime, s.startTime + 4),
        preferredDuration: Math.min(4, s.endTime - s.startTime) || 2,
        reason: `Suggested for: "${s.text.slice(0,80)}"`,
        searchQuery: q,
        status: 'suggested' as const,
      } as BRollSuggestion));
    })
    .flat();

  // Rank candidates by phrase score (approx by presence order), then pick diverse set
  const initialRanked = rawCandidates; // already ordered by segments
  const uniqueQueries = Array.from(new Set(initialRanked.map(c => c.searchQuery)));
  const selectedQueries = pickDiverse(uniqueQueries, 6);

  const bRollSuggestions: BRollSuggestion[] = selectedQueries.map((q, i) => {
    const sample = initialRanked.find(c => c.searchQuery === q)!;
    return {
      ...sample,
      id: `broll-selected-${i}-${Math.floor(sample.startTime * 10)}`,
    } as BRollSuggestion;
  });

  // Basic pacing analysis
  const pacing = {
    averageSegmentDuration: videoDuration / Math.max(transcript.segments.length, 1),
    suggestedCutFrequency: Math.max(1, Math.round(transcript.segments.length / 10)),
    energyLevel: 'medium' as const,
    rhythmPattern: 'natural' as const,
    hooks: [],
    slowSections: [],
  };

  const edl: EditDecisionList = {
    projectId: options?.projectId || 'local-scan',
    createdAt: new Date().toISOString(),
    originalDuration: videoDuration,
    editedDuration: videoDuration,
    aRollSegments,
    removedSections: [],
    bRollSuggestions,
    zoomEffects: [],
    pacing,
    style: 'vlog',
    editingNotes: ['Local analyzer suggestions (suggestions-only mode)'],
  };

  return edl;
}
