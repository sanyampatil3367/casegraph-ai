export type MasterCaseStatus = 'Under review' | 'In progress' | 'Resolved'

export type MasterCaseActivity = {
  id: string
  date: string
  description: string
}

export type MasterCase = {
  id: string
  title: string
  description: string
  category: string
  status: MasterCaseStatus
  complaintIds: string[]
  createdAt: string
  updatedAt: string
  activity: MasterCaseActivity[]
}

// Synthetic master cases reconcile to the existing complaint.masterCase links.
// Complaint, institution, and bureau details are always resolved from their source datasets.
export const sampleMasterCases: MasterCase[] = [
  {
    id: 'master-demo-001',
    title: 'September pension payment delays',
    description: 'Example follow-up on delayed pension disbursement and payment status communication.',
    category: 'Benefits & pensions',
    status: 'In progress',
    complaintIds: ['complaint-demo-001'],
    createdAt: '2024-10-24',
    updatedAt: '2024-10-25',
    activity: [
      { id: 'master-activity-001', date: '2024-10-24T09:20:00', description: 'Synthetic master case created from a sample pension complaint' },
      { id: 'master-activity-002', date: '2024-10-25T10:00:00', description: 'Demo review coordination noted for the sample record' },
    ],
  },
  {
    id: 'master-demo-002',
    title: 'Acknowledgement delays for records requests',
    description: 'Example case tracking acknowledgement and reference-number communication for public records requests.',
    category: 'Records & information',
    status: 'Under review',
    complaintIds: ['complaint-demo-004'],
    createdAt: '2024-10-23',
    updatedAt: '2024-10-23',
    activity: [
      { id: 'master-activity-003', date: '2024-10-23T12:20:00', description: 'Synthetic master case created from a sample records complaint' },
    ],
  },
  {
    id: 'master-demo-003',
    title: 'School transport route feedback',
    description: 'Example case for feedback about the location and accessibility of a school transport stop.',
    category: 'Education & student services',
    status: 'Under review',
    complaintIds: ['complaint-demo-006'],
    createdAt: '2024-10-22',
    updatedAt: '2024-10-22',
    activity: [
      { id: 'master-activity-004', date: '2024-10-22T07:45:00', description: 'Synthetic master case created from a sample school transport complaint' },
    ],
  },
  {
    id: 'master-demo-004',
    title: 'Civic center lift service reports',
    description: 'Example case tracking an accessibility concern and service update for a civic facility lift.',
    category: 'Accessibility & facilities',
    status: 'Resolved',
    complaintIds: ['complaint-demo-008'],
    createdAt: '2024-10-20',
    updatedAt: '2024-10-21',
    activity: [
      { id: 'master-activity-005', date: '2024-10-20T11:15:00', description: 'Synthetic master case created from a sample facilities complaint' },
      { id: 'master-activity-006', date: '2024-10-21T13:45:00', description: 'Demo case status marked resolved for the interface example' },
    ],
  },
]
