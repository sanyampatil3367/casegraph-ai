import assert from 'node:assert/strict'
import { sampleComplaints } from '../src/data/complaints.ts'
import { matchingEvaluationExamples } from '../src/data/matchingEvaluation.ts'
import {
  calculateInverseDocumentFrequencies,
  generateIdfWeightedMatchPairs,
  generateLocalMatchPairs,
  idfWeightedSimilarity,
  jaccardSimilarity,
  tokenizeComplaint,
} from '../src/lib/localMatching.ts'

const threshold = 0.2
const evaluationCorpus = matchingEvaluationExamples.flatMap((example) => example.complaints)
const inverseDocumentFrequencies = calculateInverseDocumentFrequencies(evaluationCorpus)
const reports = matchingEvaluationExamples.map((example) => {
  const [left, right] = example.complaints
  const leftTokens = tokenizeComplaint(left)
  const rightTokens = tokenizeComplaint(right)
  const jaccard = jaccardSimilarity(leftTokens, rightTokens)
  const idfWeighted = idfWeightedSimilarity(leftTokens, rightTokens, inverseDocumentFrequencies)
  const result = (score) => ({ ...score, predicted: score.similarity >= threshold ? 'related' : 'unrelated' })
  const jaccardResult = result(jaccard)
  const idfResult = result(idfWeighted)
  return {
    ...example,
    jaccard: { ...jaccardResult, correct: jaccardResult.predicted === example.expected },
    idfWeighted: { ...idfResult, correct: idfResult.predicted === example.expected },
  }
})

const orderedComplaintIds = (pair) => [pair.left.id, pair.right.id].sort()
const serializePairs = (pairs) => pairs.map((pair) => ({ ids: orderedComplaintIds(pair), similarity: pair.similarity, sharedTokens: pair.sharedTokens }))
const generated = generateLocalMatchPairs(sampleComplaints)
const reversedInput = generateLocalMatchPairs([...sampleComplaints].reverse())
const generatedIdf = generateIdfWeightedMatchPairs(sampleComplaints)
const reversedIdfInput = generateIdfWeightedMatchPairs([...sampleComplaints].reverse())
const pairKeys = generated.map((pair) => pair.id)
const expectedUniquePairCount = new Set(sampleComplaints.map((complaint) => complaint.id)).size
  * (new Set(sampleComplaints.map((complaint) => complaint.id)).size - 1) / 2

assert.deepEqual(serializePairs(generated), serializePairs(reversedInput), 'Pair output must be deterministic regardless of input order')
assert.deepEqual(serializePairs(generatedIdf), serializePairs(reversedIdfInput), 'IDF pair output must be deterministic regardless of input order')
assert.equal(new Set(pairKeys).size, pairKeys.length, 'Pair IDs must be unique')
assert.ok(generated.every((pair) => pair.left.id !== pair.right.id), 'Matcher must not compare a complaint with itself')
assert.equal(new Set(generated.map((pair) => orderedComplaintIds(pair).join('|'))).size, generated.length, 'Matcher must not output reversed duplicate pairs')
assert.ok(generatedIdf.every((pair) => pair.left.id !== pair.right.id), 'IDF matcher must not compare a complaint with itself')
assert.equal(new Set(generatedIdf.map((pair) => orderedComplaintIds(pair).join('|'))).size, generatedIdf.length, 'IDF matcher must not output reversed duplicate pairs')
assert.ok(generated.length <= expectedUniquePairCount, 'Output cannot exceed all possible distinct complaint pairs')
assert.equal(idfWeightedSimilarity([], [], inverseDocumentFrequencies).similarity, 0, 'Two empty vectors must score zero')
assert.equal(idfWeightedSimilarity(['unknown'], [], inverseDocumentFrequencies).similarity, 0, 'A one-sided empty vector must score zero')

function evaluateMetrics(method) {
  const counts = { truePositive: 0, trueNegative: 0, falsePositive: 0, falseNegative: 0 }
  for (const report of reports) {
    const predicted = report[method].predicted
    if (report.expected === 'related' && predicted === 'related') counts.truePositive += 1
    else if (report.expected === 'unrelated' && predicted === 'unrelated') counts.trueNegative += 1
    else if (report.expected === 'unrelated') counts.falsePositive += 1
    else counts.falseNegative += 1
  }
  const precision = counts.truePositive + counts.falsePositive === 0 ? null : counts.truePositive / (counts.truePositive + counts.falsePositive)
  const recall = counts.truePositive + counts.falseNegative === 0 ? null : counts.truePositive / (counts.truePositive + counts.falseNegative)
  const f1 = precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall)
  return { ...counts, precision, recall, f1 }
}

const jaccardMetrics = evaluateMetrics('jaccard')
const idfMetrics = evaluateMetrics('idfWeighted')
const percentage = (value) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`

console.log(`Synthetic lexical matching comparison (threshold: ${(threshold * 100).toFixed(0)}%; six synthetic pairs do not establish real-world accuracy)`)
console.log(`IDF corpus: ${evaluationCorpus.length} complaint texts across all six pairs; labels are excluded from document-frequency and score calculation.`)
for (const report of reports) {
  const outcome = report.jaccard.correct === report.idfWeighted.correct
    ? report.jaccard.correct ? 'both correct' : 'both incorrect'
    : report.idfWeighted.correct ? 'IDF improved' : 'IDF worse'
  const delta = (report.idfWeighted.similarity - report.jaccard.similarity) * 100
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp`
  console.log(`${report.id}: expected ${report.expected} · Jaccard ${(report.jaccard.similarity * 100).toFixed(1)}% (${report.jaccard.predicted}) · IDF ${(report.idfWeighted.similarity * 100).toFixed(1)}% (${report.idfWeighted.predicted}) · Δ ${deltaLabel} · ${outcome}`)
}
console.log(`Jaccard metrics: ${JSON.stringify({ ...jaccardMetrics, precision: percentage(jaccardMetrics.precision), recall: percentage(jaccardMetrics.recall), f1: percentage(jaccardMetrics.f1) })}`)
console.log(`IDF metrics: ${JSON.stringify({ ...idfMetrics, precision: percentage(idfMetrics.precision), recall: percentage(idfMetrics.recall), f1: percentage(idfMetrics.f1) })}`)
console.log(`Pair-generation checks: Jaccard ${generated.length} and IDF ${generatedIdf.length} nonzero-overlap pairs; deterministic input-order checks, no self-pairs, and no reversed duplicates passed.`)
