export type ComplaintStatus = 'Awaiting review' | 'In progress' | 'Resolved'
export type ComplaintPriority = 'Low' | 'Normal' | 'High' | 'Urgent'

export type ComplaintActivity = {
  id: string
  date: string
  description: string
}

export type Complaint = {
  id: string
  reference: string
  title: string
  originalText: string
  institution: string
  bureau: string
  receivedAt: string
  status: ComplaintStatus
  priority: ComplaintPriority
  reporterType: string
  category: string
  masterCase: { id: string; title: string } | null
  activity: ComplaintActivity[]
}

// Interface preview records only. Replace this source with a service adapter when one exists.
export const sampleComplaints: Complaint[] = [
  {
    id: 'complaint-demo-001', reference: 'CG-2024-0842', title: 'Delayed pension disbursement',
    originalText: 'I am writing to formally request assistance regarding my pension payment for September 2024. The payment has not been credited to my account, despite the status on the portal showing it as processed. I have contacted the local office twice and was advised to wait, but have not received a clear update. Please review the disbursement and advise on the expected resolution timeline.',
    institution: 'Public Benefits Office', bureau: 'Pension Services Bureau', receivedAt: '2024-10-24', status: 'Awaiting review', priority: 'High', reporterType: 'Resident', category: 'Benefits & pensions',
    masterCase: { id: 'master-demo-001', title: 'September pension payment delays' },
    activity: [{ id: 'activity-001', date: '2024-10-24T09:15:00', description: 'Synthetic complaint received through the online portal' }, { id: 'activity-002', date: '2024-10-24T09:16:00', description: 'Demo record added to the review queue' }],
  },
  {
    id: 'complaint-demo-002', reference: 'CG-2024-0841', title: 'Streetlight outage near community park',
    originalText: 'Hello, the street light outside Greenfield community park has been off for about two weeks. It gets very dark after 7pm and the path is hard to use safely. Could someone please check it? The pole number is GF-118.',
    institution: 'City Services Bureau', bureau: 'Public Works Bureau', receivedAt: '2024-10-24', status: 'In progress', priority: 'Normal', reporterType: 'Resident', category: 'Public infrastructure',
    masterCase: null,
    activity: [{ id: 'activity-003', date: '2024-10-24T10:05:00', description: 'Synthetic complaint received through the service desk' }, { id: 'activity-004', date: '2024-10-25T14:30:00', description: 'Demo routing assigned to Public Works Bureau' }],
  },
  {
    id: 'complaint-demo-003', reference: 'CG-2024-0840', title: 'Permit application status request',
    originalText: 'With reference to building permit application BP-77104 submitted on 2 October 2024, I would be grateful if you could confirm whether any further documentation is required. The online tracker has remained unchanged for ten business days.',
    institution: 'Regional Planning Department', bureau: 'Building Permits Bureau', receivedAt: '2024-10-23', status: 'Resolved', priority: 'Low', reporterType: 'Applicant', category: 'Permits & licensing',
    masterCase: null,
    activity: [{ id: 'activity-005', date: '2024-10-23T08:40:00', description: 'Synthetic complaint received by email' }, { id: 'activity-006', date: '2024-10-24T11:20:00', description: 'Demo response recorded and case marked resolved' }],
  },
  {
    id: 'complaint-demo-004', reference: 'CG-2024-0839', title: 'Public records request follow-up',
    originalText: 'Following up on my request for the 2023 neighborhood maintenance schedule. It has been 18 days since I submitted the form and I have not received an acknowledgement or reference number. Please let me know if the request was received.',
    institution: 'Records & Archives Office', bureau: 'Information Access Bureau', receivedAt: '2024-10-23', status: 'Awaiting review', priority: 'Normal', reporterType: 'Resident', category: 'Records & information',
    masterCase: { id: 'master-demo-002', title: 'Acknowledgement delays for records requests' },
    activity: [{ id: 'activity-007', date: '2024-10-23T12:10:00', description: 'Synthetic complaint received via web form' }],
  },
  {
    id: 'complaint-demo-005', reference: 'CG-2024-0838', title: 'Water connection application update',
    originalText: 'Hi, my water connection application no. WTR-99381 abhi tak pending dikha raha hai. Documents 10 din pehle submit kiye the and helpline pe call kiya but koi update nahi mila. Please status bata dijiye.',
    institution: 'Regional Water Authority', bureau: 'Water Connections Bureau', receivedAt: '2024-10-22', status: 'In progress', priority: 'High', reporterType: 'Applicant', category: 'Water & utilities',
    masterCase: null,
    activity: [{ id: 'activity-008', date: '2024-10-22T15:50:00', description: 'Synthetic complaint received through the online portal' }, { id: 'activity-009', date: '2024-10-23T09:10:00', description: 'Demo assignment sent to Water Connections Bureau' }],
  },
  {
    id: 'complaint-demo-006', reference: 'CG-2024-0837', title: 'School transport route change',
    originalText: 'Namaskara, namma area ge school bus route last week inda change aagide. Munche stop mane hatra ittu, eega tumba doora ide. Elderly parents ge makkalanna kalisodu kashta agide. Dayavittu old stop bagge consider madi.',
    institution: 'Department of Community Education', bureau: 'Student Services Bureau', receivedAt: '2024-10-22', status: 'Awaiting review', priority: 'Urgent', reporterType: 'Parent / guardian', category: 'Education & student services',
    masterCase: { id: 'master-demo-003', title: 'School transport route feedback' },
    activity: [{ id: 'activity-010', date: '2024-10-22T07:35:00', description: 'Synthetic complaint received through the community desk' }],
  },
  {
    id: 'complaint-demo-007', reference: 'CG-2024-0836', title: 'Duplicate fee charged for license renewal',
    originalText: 'I renewed my small business license online and the payment page charged the renewal fee twice. Both transactions appear on my bank statement with the same date and reference. Kindly review the duplicate charge and advise how it can be refunded.',
    institution: 'Business Licensing Office', bureau: 'Trade & Licensing Bureau', receivedAt: '2024-10-21', status: 'In progress', priority: 'Normal', reporterType: 'Business owner', category: 'Permits & licensing',
    masterCase: null,
    activity: [{ id: 'activity-011', date: '2024-10-21T16:25:00', description: 'Synthetic complaint received by email' }, { id: 'activity-012', date: '2024-10-22T10:00:00', description: 'Demo payment review requested' }],
  },
  {
    id: 'complaint-demo-008', reference: 'CG-2024-0835', title: 'Accessible entrance lift out of service',
    originalText: 'The passenger lift at the east entrance of the civic center has been unavailable on three visits this month. The posted notice has no repair date. Please provide an update and information about an accessible alternative entrance while repairs are underway.',
    institution: 'Civic Facilities Office', bureau: 'Building Operations Bureau', receivedAt: '2024-10-20', status: 'Resolved', priority: 'High', reporterType: 'Visitor', category: 'Accessibility & facilities',
    masterCase: { id: 'master-demo-004', title: 'Civic center lift service reports' },
    activity: [{ id: 'activity-013', date: '2024-10-20T11:05:00', description: 'Synthetic complaint received at the service counter' }, { id: 'activity-014', date: '2024-10-21T13:40:00', description: 'Demo accessibility update provided and case marked resolved' }],
  },
]
