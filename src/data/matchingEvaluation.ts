import type { MatchableComplaint } from '../lib/localMatching'

export type ExpectedMatchLabel = 'related' | 'unrelated'

export type MatchingEvaluationExample = {
  id: string
  description: string
  expected: ExpectedMatchLabel
  complaints: [MatchableComplaint, MatchableComplaint]
}

/** Manually labelled synthetic evaluation examples; labels are not passed to the matcher and have not been independently expert-reviewed. */
export const matchingEvaluationExamples: MatchingEvaluationExample[] = [
  {
    id: 'near-identical-cross-institution',
    description: 'Near-identical billing complaints submitted to different institutions',
    expected: 'related',
    complaints: [
      { id: 'eval-near-a', title: 'Duplicate water bill payment', originalText: 'My water bill payment was charged twice on 12 May. Please refund the duplicate payment.' },
      { id: 'eval-near-b', title: 'Duplicate water bill payment', originalText: 'My water bill payment was charged twice on 12 May. Please refund the duplicate payment.' },
    ],
  },
  {
    id: 'same-issue-paraphrase',
    description: 'Paraphrases describing a delayed pension payment',
    expected: 'related',
    complaints: [
      { id: 'eval-paraphrase-a', title: 'Pension payment not received', originalText: 'My pension for June has not arrived in my bank account.' },
      { id: 'eval-paraphrase-b', title: 'Missing retirement benefit', originalText: 'The monthly retirement allowance is absent from my account.' },
    ],
  },
  {
    id: 'keyword-overlap-different-issues',
    description: 'Shared service keywords but different underlying issues',
    expected: 'unrelated',
    complaints: [
      { id: 'eval-keyword-a', title: 'Water connection delay', originalText: 'My water connection application is delayed and the service office has not provided an update.' },
      { id: 'eval-keyword-b', title: 'Water bill amount dispute', originalText: 'The water bill amount is incorrect and the service office has not corrected my charge.' },
    ],
  },
  {
    id: 'spelling-punctuation-variation',
    description: 'Same road repair report with spelling and punctuation variation',
    expected: 'related',
    complaints: [
      { id: 'eval-spelling-a', title: 'Road pothole repair request', originalText: 'There is a large pothole on Oak Road. Please repair it before someone is hurt.' },
      { id: 'eval-spelling-b', title: 'Road pothole repair request', originalText: 'Theres a large pot-hole on Oak Road please repair it before someone gets hurt' },
    ],
  },
  {
    id: 'unrelated-zero-overlap',
    description: 'Unrelated housing and library complaints with no shared content terms',
    expected: 'unrelated',
    complaints: [
      { id: 'eval-unrelated-a', title: 'Heating repair', originalText: 'Radiator broken cold flat.' },
      { id: 'eval-unrelated-b', title: 'Library opening hours', originalText: 'Library closes early Sundays.' },
    ],
  },
  {
    id: 'multilingual-paraphrase',
    description: 'Related issue phrased in English and Romanized Kannada',
    expected: 'related',
    complaints: [
      { id: 'eval-multilingual-a', title: 'School bus stop moved', originalText: 'The school bus stop moved far from our home and my child cannot walk there safely.' },
      { id: 'eval-multilingual-b', title: 'School route concern', originalText: 'Namma mane hatra idda bus stop doora hogide, magu alli nadedu hogodu surakshita alla.' },
    ],
  },
]
