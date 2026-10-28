export type BureauCategory = 'Benefits & pensions' | 'Public infrastructure' | 'Permits & licensing' | 'Records & information' | 'Water & utilities' | 'Education & student services' | 'Building operations'

export type Bureau = {
  id: string
  name: string
  description: string
  category: BureauCategory
  institutionIds: string[]
}

// UUIDs are stable synthetic identifiers shared with the institution and complaint samples.
export const sampleBureaus: Bureau[] = [
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a01', name: 'Pension Services Bureau', description: 'Example team coordinating pension disbursement and benefit payment inquiries.', category: 'Benefits & pensions', institutionIds: ['institution-demo-001'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a02', name: 'Public Works Bureau', description: 'Example team handling neighborhood infrastructure, lighting, and maintenance reports.', category: 'Public infrastructure', institutionIds: ['institution-demo-002'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a03', name: 'Building Permits Bureau', description: 'Example team reviewing building permit applications and status requests.', category: 'Permits & licensing', institutionIds: ['institution-demo-003'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a04', name: 'Information Access Bureau', description: 'Example team coordinating public records and information access requests.', category: 'Records & information', institutionIds: ['institution-demo-004'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a05', name: 'Water Connections Bureau', description: 'Example team handling water connection applications and utility service inquiries.', category: 'Water & utilities', institutionIds: ['institution-demo-005'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a06', name: 'Student Services Bureau', description: 'Example team coordinating school transport and student support concerns.', category: 'Education & student services', institutionIds: ['institution-demo-006'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a07', name: 'Trade & Licensing Bureau', description: 'Example team supporting business licensing and fee-related service requests.', category: 'Permits & licensing', institutionIds: ['institution-demo-007'] },
  { id: '8b8f6d5e-223e-4f56-9c20-31bfa4d83a08', name: 'Building Operations Bureau', description: 'Example team coordinating civic building access, lifts, and facility maintenance.', category: 'Building operations', institutionIds: ['institution-demo-008'] },
]
