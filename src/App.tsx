import { useEffect, useState } from 'react'
import { sampleComplaints, type Complaint, type ComplaintPriority, type ComplaintStatus } from './data/complaints'

type PageId = 'dashboard' | 'registry' | 'master-cases' | 'institutions' | 'bureaus' | 'transfers' | 'assistant'

type IconName = 'grid' | 'file' | 'layers' | 'building' | 'landmark' | 'transfer' | 'sparkles' | 'search' | 'bell' | 'menu' | 'close' | 'arrow' | 'clock' | 'check' | 'more' | 'chevron'

const navigation: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'registry', label: 'Complaint Registry', icon: 'file' },
  { id: 'master-cases', label: 'Master Cases', icon: 'layers' },
  { id: 'institutions', label: 'Institutions', icon: 'building' },
  { id: 'bureaus', label: 'Bureaus', icon: 'landmark' },
  { id: 'transfers', label: 'Transfers & Coordination', icon: 'transfer' },
  { id: 'assistant', label: 'Help Assistant', icon: 'sparkles' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    file: <><path d="M13.5 3.5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z" /><path d="M13 3.5V10h7M8 14h8M8 17.5h6" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2" /></>,
    landmark: <><path d="m3 9 9-5 9 5M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18M2 18h20" /></>,
    transfer: <><path d="M7 7h13l-3-3m3 3-3 3M17 17H4l3 3m-3-3 3-3" /></>,
    sparkles: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6L5 15Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  }

  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const kpis = [
  { label: 'Total complaints', value: '2,486', change: '+12.8%', note: 'vs. previous period', icon: 'file' as IconName, tone: 'indigo' },
  { label: 'Awaiting review', value: '184', change: '23 due soon', note: 'within the next 7 days', icon: 'clock' as IconName, tone: 'amber' },
  { label: 'Resolved this month', value: '342', change: '+8.2%', note: 'vs. previous period', icon: 'check' as IconName, tone: 'green' },
  { label: 'Active institutions', value: '38', change: 'Across 6 regions', note: 'demo organizational data', icon: 'building' as IconName, tone: 'blue' },
]

const cases = [
  { ref: 'CG-2024-0842', title: 'Delayed pension disbursement', institution: 'Public Benefits Office', date: 'Oct 24, 2024', status: 'Under review', tone: 'review' },
  { ref: 'CG-2024-0841', title: 'Municipal services request', institution: 'City Services Bureau', date: 'Oct 24, 2024', status: 'In progress', tone: 'progress' },
  { ref: 'CG-2024-0840', title: 'Permit application follow-up', institution: 'Regional Planning Dept.', date: 'Oct 23, 2024', status: 'Resolved', tone: 'resolved' },
  { ref: 'CG-2024-0839', title: 'Public records request', institution: 'Records & Archives Office', date: 'Oct 23, 2024', status: 'Under review', tone: 'review' },
]

const modules: Record<Exclude<PageId, 'dashboard'>, { title: string; description: string; icon: IconName }> = {
  registry: { title: 'Complaint Registry', description: 'A centralized workspace for receiving, reviewing, and tracking incoming complaints.', icon: 'file' },
  'master-cases': { title: 'Master Cases', description: 'Bring related complaints together to identify shared issues and coordinate case resolution.', icon: 'layers' },
  institutions: { title: 'Institutions', description: 'Manage the public institutions responsible for responding to complaints.', icon: 'building' },
  bureaus: { title: 'Bureaus', description: 'View and organize bureaus, their responsibilities, and their institutional relationships.', icon: 'landmark' },
  transfers: { title: 'Transfers & Coordination', description: 'Coordinate case transfers and keep cross-institution handoffs moving.', icon: 'transfer' },
  assistant: { title: 'Help Assistant', description: 'A future guided assistant for finding information about the CaseGraph workspace.', icon: 'sparkles' },
}

function Sidebar({ active, onNavigate, mobileOpen, onClose }: { active: PageId; onNavigate: (id: PageId) => void; mobileOpen: boolean; onClose: () => void }) {
  return <>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation menu" onClick={onClose} />}
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="brand-row"><div className="brand-mark"><span /><span /><span /><span /></div><div className="brand-name">casegraph<span>AI</span></div><button className="icon-button sidebar-close" aria-label="Close navigation menu" onClick={onClose}><Icon name="close" /></button></div>
      <div className="workspace-picker"><div className="workspace-avatar">CG</div><div className="workspace-copy"><strong>Public Services</strong><span>Demo workspace</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="nav-list">{navigation.map((item) => <button key={item.id} className={`nav-item${active === item.id ? ' active' : ''}`} aria-current={active === item.id ? 'page' : undefined} onClick={() => { onNavigate(item.id); onClose() }}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'registry' && <span className="nav-count">12</span>}</button>)}</nav>
      <div className="sidebar-footer"><div className="help-card"><div className="help-icon"><Icon name="sparkles" size={17} /></div><strong>Need a hand?</strong><p>Explore the help center for guidance.</p><button onClick={() => { onNavigate('assistant'); onClose() }}>Visit help center <Icon name="arrow" size={14} /></button></div><div className="sidebar-version"><span className="online-dot" />Demo environment <span>v0.1</span></div></div>
    </aside>
  </>
}

function Header({ title, onMenu, search, onSearchChange, showSearch }: { title: string; onMenu: () => void; search: string; onSearchChange: (value: string) => void; showSearch: boolean }) {
  return <header className="topbar"><div className="topbar-left"><button className="icon-button menu-toggle" aria-label="Open navigation menu" onClick={onMenu}><Icon name="menu" /></button><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{title}</strong></div></div><div className="topbar-actions">{showSearch && <label className="search-box"><Icon name="search" size={17} /><input aria-label="Filter demo complaints" placeholder="Filter demo complaints..." value={search} onChange={(event) => onSearchChange(event.target.value)} /><kbd>LOCAL</kbd></label>}<span className="icon-button notification-button unavailable-control" aria-label="Notifications unavailable in demo" title="Notifications unavailable in demo"><Icon name="bell" /><span /></span><div className="topbar-divider" /><div className="profile-button unavailable-control" aria-label="Profile menu unavailable in demo" title="Profile menu unavailable in demo"><div className="profile-avatar">AM</div><div className="profile-copy"><strong>Alex Morgan</strong><span>Administrator · demo</span></div><Icon name="chevron" size={14} /></div></div></header>
}

const statusOptions: ComplaintStatus[] = ['Awaiting review', 'In progress', 'Resolved']
const priorityOptions: ComplaintPriority[] = ['Urgent', 'High', 'Normal', 'Low']
const dateLabel = (date: string) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))

function ComplaintDetails({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="detail-overlay"><button className="detail-backdrop" aria-label="Close complaint details" onClick={onClose} /><aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header className="detail-header"><div><span className="detail-kicker">SYNTHETIC COMPLAINT</span><div className="detail-reference">{complaint.reference}</div></div><button className="icon-button" aria-label="Close complaint details" onClick={onClose}><Icon name="close" /></button></header><div className="detail-body"><h2 id="detail-title">{complaint.title}</h2><div className="detail-badges"><StatusBadge status={complaint.status} /><PriorityBadge priority={complaint.priority} /></div><section className="detail-section"><h3>Original submission</h3><p className="original-submission">{complaint.originalText}</p><p className="detail-helper">Original sample text shown as stored. It has not been summarized or rewritten.</p></section><section className="detail-section"><h3>Complaint details</h3><dl className="detail-metadata"><div><dt>Institution</dt><dd>{complaint.institution}</dd></div><div><dt>Bureau</dt><dd>{complaint.bureau}</dd></div><div><dt>Date received</dt><dd>{dateLabel(complaint.receivedAt)}</dd></div><div><dt>Reporter</dt><dd>{complaint.reporterType}</dd></div><div><dt>Category</dt><dd>{complaint.category}</dd></div><div><dt>Priority</dt><dd>{complaint.priority}</dd></div></dl></section><section className="detail-section"><h3>Master case</h3>{complaint.masterCase ? <div className="master-association"><Icon name="layers" size={16} /><div><strong>{complaint.masterCase.title}</strong><span>{complaint.masterCase.id} · demo association</span></div></div> : <p className="detail-muted">No master case association in this sample.</p>}</section><section className="detail-section"><h3>Synthetic activity timeline</h3><ol className="activity-list">{complaint.activity.map((entry) => <li key={entry.id}><span className="activity-marker" /><div><p>{entry.description}</p><time dateTime={entry.date}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.date))}</time></div></li>)}</ol></section><section className="ai-placeholder"><div className="ai-placeholder-icon"><Icon name="sparkles" size={17} /></div><div><strong>AI match suggestions</strong><p>Placeholder only. Matching is not available in this demo.</p></div><span className="demo-pill">NOT ACTIVE</span></section></div></aside></div>
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const tone = status === 'Awaiting review' ? 'review' : status === 'In progress' ? 'progress' : 'resolved'
  return <span className={`status-badge ${tone}`}><i />{status}</span>
}

function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  return <span className={`priority-badge priority-${priority.toLowerCase()}`}><i />{priority}</span>
}

function ComplaintRegistry({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [bureau, setBureau] = useState('')
  const [selected, setSelected] = useState<Complaint | null>(null)
  const bureaus = [...new Set(sampleComplaints.map((complaint) => complaint.bureau))].sort()
  const normalizedSearch = search.trim().toLowerCase()
  const filtered = sampleComplaints.filter((complaint) => {
    const matchesSearch = !normalizedSearch || [complaint.reference, complaint.title, complaint.originalText, complaint.institution, complaint.bureau].some((value) => value.toLowerCase().includes(normalizedSearch))
    return matchesSearch && (!status || complaint.status === status) && (!priority || complaint.priority === priority) && (!bureau || complaint.bureau === bureau)
  })
  const activeFilters = Boolean(search || status || priority || bureau)
  const resetFilters = () => { onSearchChange(''); setStatus(''); setPriority(''); setBureau('') }
  const counts = {
    total: sampleComplaints.length,
    awaiting: sampleComplaints.filter((complaint) => complaint.status === 'Awaiting review').length,
    progress: sampleComplaints.filter((complaint) => complaint.status === 'In progress').length,
    resolved: sampleComplaints.filter((complaint) => complaint.status === 'Resolved').length,
  }

  return <main className="page-content registry-content"><div className="registry-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> CASE MANAGEMENT <span className="demo-label">DEMO DATA</span></div><h1>Complaint Registry</h1><p className="welcome-copy">Review and track complaints submitted across your service network.</p></div></div><div className="registry-notice"><span className="notice-icon">i</span><p><strong>Demonstration records only.</strong> All complaints, people, organizations, and activity shown here are synthetic examples for interface preview.</p></div>
    <section className="registry-summary" aria-label="Complaint counts from local demo dataset"><SummaryCard label="Total complaints" value={counts.total} tone="indigo" /><SummaryCard label="Awaiting review" value={counts.awaiting} tone="amber" /><SummaryCard label="In progress" value={counts.progress} tone="blue" /><SummaryCard label="Resolved" value={counts.resolved} tone="green" /></section>
    <section className="panel registry-panel"><div className="registry-panel-heading"><div><h2>All complaints</h2><p>{filtered.length} of {sampleComplaints.length} synthetic sample records</p></div><span className="demo-pill">SYNTHETIC DATASET</span></div><div className="registry-filters"><label className="registry-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} aria-label="Search complaints by reference, title, original text, institution, or bureau" placeholder="Search reference, complaint, institution, bureau..." /></label><label className="filter-control"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label className="filter-control"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority"><option value="">All priorities</option>{priorityOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label className="filter-control bureau-filter"><span>Bureau</span><select value={bureau} onChange={(event) => setBureau(event.target.value)} aria-label="Filter by bureau"><option value="">All bureaus</option>{bureaus.map((option) => <option key={option}>{option}</option>)}</select></label><button className="clear-filters" onClick={resetFilters} disabled={!activeFilters}><Icon name="close" size={14} />Clear filters</button></div>
      <div className="registry-table-scroll"><table className="registry-table"><thead><tr><th>REFERENCE ID</th><th>COMPLAINT</th><th>INSTITUTION</th><th>BUREAU</th><th>DATE RECEIVED</th><th>PRIORITY</th><th>STATUS</th><th>MASTER CASE</th></tr></thead><tbody>{filtered.map((complaint) => <tr key={complaint.id} tabIndex={0} aria-label={`Open complaint ${complaint.reference}: ${complaint.title}`} onClick={() => setSelected(complaint)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(complaint) } }}><td className="registry-ref">{complaint.reference}</td><td className="registry-title-cell"><strong>{complaint.title}</strong><span>Original submission available in details</span></td><td>{complaint.institution}</td><td>{complaint.bureau}</td><td>{dateLabel(complaint.receivedAt)}</td><td><PriorityBadge priority={complaint.priority} /></td><td><StatusBadge status={complaint.status} /></td><td>{complaint.masterCase ? <span className="master-case-cell"><Icon name="layers" size={13} />{complaint.masterCase.id}</span> : <span className="no-master-case">—</span>}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="registry-empty"><div className="empty-search-icon"><Icon name="search" size={20} /></div><strong>No complaints match these filters</strong><p>Try a different search term or clear the selected filters to see all synthetic examples.</p><button className="clear-empty" onClick={resetFilters}>Clear all filters</button></div>}</div><div className="registry-table-foot">Showing all matching synthetic examples · No pagination</div>
    </section>{selected && <ComplaintDetails complaint={selected} onClose={() => setSelected(null)} />}</main>
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className="registry-summary-card"><span className={`summary-icon ${tone}`}><Icon name={tone === 'indigo' ? 'file' : tone === 'amber' ? 'clock' : tone === 'blue' ? 'transfer' : 'check'} size={17} /></span><span className="summary-label">{label}</span><strong>{value}</strong><span className="summary-note">from demo sample dataset</span></article>
}

function KpiCard({ item }: { item: (typeof kpis)[number] }) {
  return <article className="kpi-card"><div className={`kpi-icon ${item.tone}`}><Icon name={item.icon} size={18} /></div><span className="kpi-menu" aria-hidden="true"><Icon name="more" size={18} /></span><div className="kpi-label">{item.label}</div><div className="kpi-value">{item.value}</div><div className="kpi-foot"><span className={`kpi-change ${item.tone}`}>{item.change}</span><span>{item.note}</span></div></article>
}

function VolumeChart() {
  const bars = [34, 48, 41, 57, 45, 66, 51, 43, 62, 53, 72, 57, 47, 64, 53, 78, 61, 47, 67, 56, 73, 60, 84, 64, 52, 72, 61, 88]
  return <div className="volume-chart"><div className="chart-y-labels"><span>300</span><span>200</span><span>100</span><span>0</span></div><div className="chart-plot"><div className="chart-grid"><i /><i /><i /><i /></div><div className="bar-row">{bars.map((height, index) => <div className="bar-group" key={index}><span style={{ height: `${height}%` }} /><span style={{ height: `${Math.max(height * 0.44, 11)}%` }} /></div>)}</div><div className="chart-x-labels"><span>Oct 01</span><span>Oct 07</span><span>Oct 14</span><span>Oct 21</span><span>Oct 28</span></div></div></div>
}

function StatusPanel() {
  return <div className="status-panel"><div className="donut-wrap"><div className="donut"><div className="donut-center"><strong>2,486</strong><span>complaints</span></div></div></div><div className="status-legend"><div><i className="dot dot-indigo" /><span>Resolved</span><strong>1,248</strong><small>50.2%</small></div><div><i className="dot dot-blue" /><span>In progress</span><strong>814</strong><small>32.7%</small></div><div><i className="dot dot-amber" /><span>Under review</span><strong>424</strong><small>17.1%</small></div></div></div>
}

function Dashboard({ onNavigate, search }: { onNavigate: (id: PageId) => void; search: string }) {
  const filteredCases = cases.filter((item) => `${item.ref} ${item.title} ${item.institution} ${item.status}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <main className="page-content"><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> OVERVIEW <span className="demo-label">DEMO DATA</span></div><h1>Good morning, Alex <span className="wave">✦</span></h1><p className="welcome-copy">Here’s what’s happening across your complaint network.</p></div><div className="date-chip"><Icon name="clock" size={15} /> Tuesday, October 29, 2024</div></div>
    <section className="kpi-grid" aria-label="Demo key performance indicators">{kpis.map((item) => <KpiCard key={item.label} item={item} />)}</section>
    <section className="analytics-grid" aria-label="Illustrative analytics"><article className="panel volume-panel"><div className="panel-header"><div><h2>Complaint volume</h2><p>Illustrative submissions over time</p></div><span className="period-select">Last 30 days <Icon name="chevron" size={14} /></span></div><div className="chart-legend"><span><i className="legend-dot primary" />Received</span><span><i className="legend-dot secondary" />Resolved</span><span className="illustrative-note">Illustrative data</span></div><VolumeChart /></article><article className="panel status-panel-card"><div className="panel-header"><div><h2>Case status</h2><p>Illustrative status breakdown</p></div><span className="icon-button panel-more unavailable-control" aria-hidden="true"><Icon name="more" /></span></div><StatusPanel /><div className="status-footnote">Illustrative mock data for interface preview</div></article></section>
    <section className="panel cases-panel"><div className="panel-header cases-heading"><div><div className="title-with-mark"><h2>Recent complaints</h2><span className="demo-pill">SYNTHETIC EXAMPLES</span></div><p>Example records for interface preview only</p></div><button className="view-all" onClick={() => onNavigate('registry')}>View registry <Icon name="arrow" size={15} /></button></div><div className="table-scroll"><table><thead><tr><th>REFERENCE</th><th>COMPLAINT</th><th>INSTITUTION</th><th>DATE RECEIVED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredCases.map((item) => <tr key={item.ref}><td className="case-ref">{item.ref}</td><td className="case-title">{item.title}</td><td>{item.institution}</td><td>{item.date}</td><td><span className={`status-badge ${item.tone}`}><i />{item.status}</span></td><td><span className="icon-button row-more unavailable-control" aria-hidden="true"><Icon name="more" size={17} /></span></td></tr>)}</tbody></table>{filteredCases.length === 0 && <p className="empty-search">No synthetic examples match “{search}”. Try another reference, complaint, institution, or status.</p>}</div><button className="mobile-view-all" onClick={() => onNavigate('registry')}>View registry <Icon name="arrow" size={15} /></button></section>
    <div className="demo-disclaimer">This dashboard uses demonstration data only. Figures and records shown are synthetic and do not represent real complaints.</div>
  </main>
}

function ModulePage({ page }: { page: Exclude<PageId, 'dashboard'> }) {
  const module = modules[page]
  return <main className="page-content module-content"><div className="eyebrow"><span className="eyebrow-dot" /> WORKSPACE MODULE</div><h1>{module.title}</h1><p className="welcome-copy">{module.description}</p><section className="module-placeholder"><div className="module-icon"><Icon name={module.icon} size={24} /></div><span className="demo-pill">COMING SOON</span><h2>Your {module.title.toLowerCase()} workspace</h2><p>This module is part of the CaseGraph AI interface preview. Its tools and records will be available here as the product develops.</p><div className="placeholder-rule" /><div className="placeholder-meta"><span><i className="online-dot" />Module navigation is working</span><span>Demo environment</span></div></section></main>
}

function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])
  const currentTitle = activePage === 'dashboard' ? 'Dashboard' : modules[activePage].title

  return <div className="app-shell"><Sidebar active={activePage} onNavigate={(page) => { setActivePage(page); setSearch('') }} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><div className="main-column"><Header title={currentTitle} onMenu={() => setMobileOpen(true)} search={search} onSearchChange={setSearch} showSearch={activePage !== 'registry'} />{activePage === 'dashboard' ? <Dashboard onNavigate={setActivePage} search={search} /> : activePage === 'registry' ? <ComplaintRegistry search={search} onSearchChange={setSearch} /> : <ModulePage page={activePage} />}</div></div>
}

export default App
