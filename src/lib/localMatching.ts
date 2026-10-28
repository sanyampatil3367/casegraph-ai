import type { Complaint } from '../data/complaints'

export type MatchableComplaint = Pick<Complaint, 'id' | 'title' | 'originalText'>

export type LocalMatchPair<T extends MatchableComplaint = Complaint> = {
  id: string
  left: T
  right: T
  similarity: number
  sharedTokens: string[]
  unionTokenCount: number
}

const stopWords = new Set([
  'a', 'about', 'after', 'all', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
  'can', 'could', 'did', 'do', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'him', 'his',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'kindly', 'me', 'my', 'of', 'on', 'or', 'our', 'please',
  'regarding', 'she', 'should', 'so', 'some', 'that', 'the', 'their', 'them', 'there', 'these', 'they',
  'this', 'those', 'to', 'too', 'was', 'we', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'would',
  'you', 'your',
])

/** Normalize original complaint text, lowercase it, split on non-letters/digits, and remove common English stop words. */
export function tokenizeComplaint(complaint: Pick<MatchableComplaint, 'originalText'>): string[] {
  const normalized = complaint.originalText.normalize('NFKC').toLocaleLowerCase('en')
  return normalized.match(/[\p{L}\p{N}]+/gu)?.filter((token) => !stopWords.has(token)) ?? []
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Jaccard similarity = unique shared tokens / unique tokens in either complaint. */
export function jaccardSimilarity(leftTokens: string[], rightTokens: string[]): { similarity: number; sharedTokens: string[]; unionTokenCount: number } {
  const left = new Set(leftTokens)
  const right = new Set(rightTokens)
  const sharedTokens = [...left].filter((token) => right.has(token)).sort(compareText)
  const unionTokenCount = new Set([...left, ...right]).size
  return { similarity: unionTokenCount === 0 ? 0 : sharedTokens.length / unionTokenCount, sharedTokens, unionTokenCount }
}

/** IDF(t) = ln((N + 1) / (df(t) + 1)) + 1, with add-one smoothing. */
export function calculateInverseDocumentFrequencies(complaints: MatchableComplaint[]): Map<string, number> {
  const documentFrequency = new Map<string, number>()
  const documents = complaints.map((complaint) => new Set(tokenizeComplaint(complaint)))

  for (const document of documents) {
    for (const token of document) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
  }

  return new Map([...documentFrequency].map(([token, frequency]) => [
    token,
    Math.log((documents.length + 1) / (frequency + 1)) + 1,
  ]))
}

/** Cosine similarity over binary term vectors weighted by IDF. Empty vectors score zero. */
export function idfWeightedSimilarity(
  leftTokens: string[],
  rightTokens: string[],
  inverseDocumentFrequencies: ReadonlyMap<string, number>,
): { similarity: number; sharedTokens: string[]; unionTokenCount: number } {
  const left = new Set(leftTokens)
  const right = new Set(rightTokens)
  const sharedTokens = [...left].filter((token) => right.has(token)).sort(compareText)
  const unionTokenCount = new Set([...left, ...right]).size
  const weight = (token: string) => inverseDocumentFrequencies.get(token) ?? 1
  const dotProduct = sharedTokens.reduce((sum, token) => sum + weight(token) ** 2, 0)
  const leftNorm = Math.sqrt([...left].reduce((sum, token) => sum + weight(token) ** 2, 0))
  const rightNorm = Math.sqrt([...right].reduce((sum, token) => sum + weight(token) ** 2, 0))
  const similarity = leftNorm === 0 || rightNorm === 0 ? 0 : dotProduct / (leftNorm * rightNorm)

  return { similarity, sharedTokens, unionTokenCount }
}

/** Produce stable non-self pairs once each. Zero-overlap pairs are omitted as they have no lexical match signal. */
function generatePairs<T extends MatchableComplaint>(
  complaints: T[],
  scoreTokens: (leftTokens: string[], rightTokens: string[]) => { similarity: number; sharedTokens: string[]; unionTokenCount: number },
): LocalMatchPair<T>[] {
  const sortedComplaints = [...complaints].sort((a, b) => compareText(a.id, b.id) || compareText(a.title, b.title) || compareText(a.originalText, b.originalText))
  const uniqueComplaints = sortedComplaints.filter((complaint, index) => index === 0 || complaint.id !== sortedComplaints[index - 1].id)
  const tokenSets = new Map(uniqueComplaints.map((complaint) => [complaint.id, tokenizeComplaint(complaint)]))
  const pairs: LocalMatchPair<T>[] = []
  const seen = new Set<string>()

  for (let leftIndex = 0; leftIndex < uniqueComplaints.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < uniqueComplaints.length; rightIndex += 1) {
      const left = uniqueComplaints[leftIndex]
      const right = uniqueComplaints[rightIndex]
      if (left.id === right.id) continue

      const pairKey = `${left.id.length}:${left.id}|${right.id.length}:${right.id}`
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      const score = scoreTokens(tokenSets.get(left.id) ?? [], tokenSets.get(right.id) ?? [])
      if (score.sharedTokens.length === 0) continue
      pairs.push({ id: pairKey, left, right, ...score })
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity || compareText(a.id, b.id))
}

/** Existing Jaccard baseline used by the application UI. */
export function generateLocalMatchPairs<T extends MatchableComplaint>(complaints: T[]): LocalMatchPair<T>[] {
  return generatePairs(complaints, jaccardSimilarity)
}

/** IDF-weighted companion method; IDF is calculated from this complaint corpus only. */
export function generateIdfWeightedMatchPairs<T extends MatchableComplaint>(complaints: T[]): LocalMatchPair<T>[] {
  const sortedUniqueComplaints = [...complaints]
    .sort((a, b) => compareText(a.id, b.id) || compareText(a.title, b.title) || compareText(a.originalText, b.originalText))
    .filter((complaint, index, sorted) => index === 0 || complaint.id !== sorted[index - 1].id)
  const idf = calculateInverseDocumentFrequencies(sortedUniqueComplaints)
  return generatePairs(sortedUniqueComplaints, (left, right) => idfWeightedSimilarity(left, right, idf))
}
