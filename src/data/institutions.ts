export type InstitutionType = 'Department' | 'Public authority' | 'Municipal office' | 'Service office'

export type Institution = {
  id: string
  name: string
  type: InstitutionType
  location: string
  bureauIds: string[]
  description: string
}

// Synthetic directory records. IDs are shared with bureau and complaint sample data.
export const sampleInstitutions: Institution[] = [
  { id: 'institution-demo-001', name: 'Public Benefits Office', type: 'Service office', location: 'North District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a01'], description: 'Example office coordinating benefit and pension service requests.' },
  { id: 'institution-demo-002', name: 'City Services Bureau', type: 'Municipal office', location: 'Central District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a02'], description: 'Example municipal institution handling local public works and neighborhood services.' },
  { id: 'institution-demo-003', name: 'Regional Planning Department', type: 'Department', location: 'West District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a03'], description: 'Example department overseeing planning and building permit services.' },
  { id: 'institution-demo-004', name: 'Records & Archives Office', type: 'Service office', location: 'Central District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a04'], description: 'Example office coordinating records access and archival information requests.' },
  { id: 'institution-demo-005', name: 'Regional Water Authority', type: 'Public authority', location: 'South District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a05'], description: 'Example public authority responsible for water connection services.' },
  { id: 'institution-demo-006', name: 'Department of Community Education', type: 'Department', location: 'East District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a06'], description: 'Example department coordinating education and student support services.' },
  { id: 'institution-demo-007', name: 'Business Licensing Office', type: 'Service office', location: 'Central District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a07'], description: 'Example office managing small business license services.' },
  { id: 'institution-demo-008', name: 'Civic Facilities Office', type: 'Municipal office', location: 'Central District', bureauIds: ['8b8f6d5e-223e-4f56-9c20-31bfa4d83a08'], description: 'Example office coordinating civic building operations and accessibility.' },
]
