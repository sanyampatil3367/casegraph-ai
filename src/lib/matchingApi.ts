import type { Complaint } from '../data/complaints'

export const LOCAL_MATCHING_API_URL = 'http://127.0.0.1:8000/api/v1/matches'
export const MATCHING_API_TIMEOUT_MS = 20_000
export const MINI_LM_MODEL_ID = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'

export type SemanticComplaintPair = {
  id: string
  left: Complaint
  right: Complaint
  similarity: number
  method: 'minilm'
}

type ApiComplaint = {
  id: string
  original_text: string
}

type ApiMatchPair = {
  pair_id: string
  complaint_a_id: string
  complaint_b_id: string
  similarity: number
}

type ApiMatchResponse = {
  model_id: string
  score_type: 'cosine_similarity'
  score_semantics: string
  threshold: number
  matches: ApiMatchPair[]
}

export class MatchingApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MatchingApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMatchResponse(value: unknown): ApiMatchResponse {
  if (!isRecord(value)
    || value.model_id !== MINI_LM_MODEL_ID
    || value.score_type !== 'cosine_similarity'
    || typeof value.score_semantics !== 'string'
    || !value.score_semantics.toLowerCase().includes('not a probability')
    || typeof value.threshold !== 'number'
    || !Number.isFinite(value.threshold)
    || value.threshold < -1
    || value.threshold > 1
    || !Array.isArray(value.matches)) {
    throw new MatchingApiError('The local matching service returned an invalid response.')
  }

  const matches: ApiMatchPair[] = value.matches.map((item) => {
    if (!isRecord(item)
      || typeof item.pair_id !== 'string'
      || !item.pair_id
      || typeof item.complaint_a_id !== 'string'
      || typeof item.complaint_b_id !== 'string'
      || typeof item.similarity !== 'number'
      || !Number.isFinite(item.similarity)
      || item.similarity < -1
      || item.similarity > 1) {
      throw new MatchingApiError('The local matching service returned an invalid pair.')
    }
    return {
      pair_id: item.pair_id,
      complaint_a_id: item.complaint_a_id,
      complaint_b_id: item.complaint_b_id,
      similarity: item.similarity,
    }
  })

  return {
    model_id: value.model_id,
    score_type: 'cosine_similarity',
    score_semantics: value.score_semantics,
    threshold: value.threshold,
    matches,
  }
}

export function adaptSemanticMatchResponse(value: unknown, complaints: Complaint[]): SemanticComplaintPair[] {
  const response = parseMatchResponse(value)
  const complaintById = new Map(complaints.map((complaint) => [complaint.id, complaint]))
  const seenPairIds = new Set<string>()
  const seenPairs = new Set<string>()

  const pairs = response.matches.map((match) => {
    const [leftId, rightId] = [match.complaint_a_id, match.complaint_b_id].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    const left = complaintById.get(leftId)
    const right = complaintById.get(rightId)
    const pairKey = [match.complaint_a_id, match.complaint_b_id].sort().join('\u0000')
    if (!left || !right || left.id === right.id || seenPairIds.has(match.pair_id) || seenPairs.has(pairKey)) {
      throw new MatchingApiError('The local matching service returned duplicate or unknown complaint pairs.')
    }
    seenPairIds.add(match.pair_id)
    seenPairs.add(pairKey)
    return { id: match.pair_id, left, right, similarity: match.similarity, method: 'minilm' as const }
  })

  return pairs.sort((left, right) => right.similarity - left.similarity || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
}

export async function requestSemanticMatches(complaints: Complaint[], threshold: number): Promise<SemanticComplaintPair[]> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), MATCHING_API_TIMEOUT_MS)
  const requestComplaints: ApiComplaint[] = complaints.map(({ id, originalText }) => ({ id, original_text: originalText }))

  try {
    let response: Response
    try {
      response = await fetch(LOCAL_MATCHING_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaints: requestComplaints, threshold }),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MatchingApiError('The local matching request timed out. The Jaccard fallback is being shown.')
      }
      throw new MatchingApiError('The local matching service could not be reached from the browser. Check that it is running with the Vite loopback CORS wrapper; the Jaccard fallback is being shown.')
    }

    if (response.status === 503) {
      throw new MatchingApiError('The local matching service or model is not ready. The Jaccard fallback is being shown.')
    }
    if (!response.ok) {
      throw new MatchingApiError(`The local matching service returned HTTP ${response.status}. The Jaccard fallback is being shown.`)
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new MatchingApiError('The local matching service returned invalid JSON. The Jaccard fallback is being shown.')
    }
    const parsed = parseMatchResponse(payload)
    if (parsed.threshold !== threshold || parsed.matches.some((match) => match.similarity < threshold)) {
      throw new MatchingApiError('The local matching service returned results for a different threshold.')
    }
    return adaptSemanticMatchResponse(parsed, complaints)
  } finally {
    window.clearTimeout(timeout)
  }
}
