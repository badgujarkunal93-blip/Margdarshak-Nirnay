import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { jsPDF } from 'jspdf'
import { closestCenter, DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpenCheck,
  Database,
  Download,
  FileText,
  GraduationCap,
  GripVertical,
  Home,
  ListChecks,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import {
  demoCapListItems,
  demoCapLists,
  demoColleges,
  demoCutoffs,
  demoShortlists,
  demoStudents,
} from './data/demo'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type {
  Branch,
  CapList,
  CapListItem,
  Category,
  College,
  Cutoff,
  GeneratedPreference,
  SafetyLabel,
  Shortlist,
  Student,
} from './types'

const ADMIN_EMAIL = 'admin@margdarshak.in'
const ADMIN_PASSWORD = 'MargAdmin2025'
const AUTH_KEY = 'margdarshak_nirnay_admin'
const categories: Category[] = ['General', 'OBC', 'SC', 'ST', 'VJ', 'NT', 'NT1', 'NT2', 'NT3', 'EWS']
const whatsappMessage =
  'Your Margdarshak CAP list is ready! Login to khoj.margdarshak.in to view and download your preference list.'

type DashboardData = {
  students: Student[]
  colleges: College[]
  cutoffs: Cutoff[]
  shortlists: Shortlist[]
  capLists: CapList[]
  capListItems: CapListItem[]
  branches: Branch[]
}

const emptyData: DashboardData = {
  students: [],
  colleges: [],
  cutoffs: [],
  shortlists: [],
  capLists: [],
  capListItems: [],
  branches: [],
}

function App() {
  const [adminAuthed, setAdminAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === 'true')
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [data, setData] = useState<DashboardData>(emptyData)

  const loadSupabaseData = async () => {
    setLoading(true)

    const cacheKey = 'nirnay_dashboard_data'
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setData(parsed)
        setLoading(false)
        return
      } catch (e) {
        sessionStorage.removeItem(cacheKey)
      }
    }

    // Load branches in pages to bypass the 1,000 row limit
    const branchesList: any[] = []
    let branchesPage = 0
    const branchesPageSize = 1000
    while (true) {
      const { data: pageBranches, error } = await supabase
        .from('branches')
        .select('*')
        .range(branchesPage * branchesPageSize, (branchesPage + 1) * branchesPageSize - 1)
      if (error) throw error
      if (!pageBranches || pageBranches.length === 0) break
      branchesList.push(...pageBranches)
      if (pageBranches.length < branchesPageSize) break
      branchesPage++
    }

    const [
      { data: students },
      { data: dbColleges },
      { data: shortlists },
      { data: capLists },
      { data: capItems },
    ] = await Promise.all([
      supabase.from('students').select('*').order('created_at', { ascending: false }),
      supabase.from('colleges').select('*').order('name'),
      supabase.from('shortlists').select('*').order('priority_order'),
      supabase.from('cap_lists').select('*').order('updated_at', { ascending: false }),
      supabase.from('cap_list_items').select('*').order('priority_order'),
    ])

    const colleges = (dbColleges ?? []).map((c: any) => ({
      ...c,
      location: c.city || c.address || '',
      branches: branchesList.filter((b) => b.college_id === c.id).map((b) => b.branch_name || b.name || ''),
    })) as College[]

    const freshData = {
      students: (students ?? []) as Student[],
      colleges,
      cutoffs: [],
      shortlists: (shortlists ?? []) as Shortlist[],
      capLists: (capLists ?? []) as CapList[],
      capListItems: (capItems ?? []) as CapListItem[],
      branches: branchesList as Branch[],
    }
    setData(freshData)
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(freshData))
    } catch (e) {
      console.warn('Failed to cache data in sessionStorage', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!adminAuthed) return
    if (isDemo) return
    if (isSupabaseConfigured) {
      void loadSupabaseData()
    } else {
      enterDemo()
    }
  }, [adminAuthed, isDemo])

  useEffect(() => {
    if (!adminAuthed || !isSupabaseConfigured || isDemo) return

    const channel = supabase
      .channel('nirnay-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        const incoming = payload.new as Student
        setData((current) => ({
          ...current,
          students: [incoming, ...current.students.filter((student) => student.id !== incoming.id)].sort((a, b) =>
            (b.created_at ?? '').localeCompare(a.created_at ?? ''),
          ),
        }))
        setToast(`${incoming.name} updated their shortlist just now`)
        window.setTimeout(() => setToast(''), 4000)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [adminAuthed, isDemo])

  useEffect(() => {
    if (adminAuthed && data !== emptyData) {
      try {
        sessionStorage.setItem('nirnay_dashboard_data', JSON.stringify(data))
      } catch (e) {
        console.warn('Failed to cache data in sessionStorage', e)
      }
    }
  }, [data, adminAuthed])

  const enterDemo = () => {
    setIsDemo(true)
    setAdminAuthed(true)
    localStorage.setItem(AUTH_KEY, 'true')
    setData({
      students: demoStudents,
      colleges: demoColleges,
      cutoffs: demoCutoffs,
      shortlists: demoShortlists,
      capLists: demoCapLists,
      capListItems: demoCapListItems,
      branches: [],
    })
  }

  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) throw new Error('Invalid admin credentials.')
      localStorage.setItem(AUTH_KEY, 'true')
      setAdminAuthed(true)
      return
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) throw error

    if (authData.user?.email !== ADMIN_EMAIL) {
      await supabase.auth.signOut()
      throw new Error('Unauthorized: Only the admin account can access this dashboard.')
    }

    localStorage.setItem(AUTH_KEY, 'true')
    setAdminAuthed(true)
  }

  const logout = () => {
    sessionStorage.removeItem('nirnay_dashboard_data')
    localStorage.removeItem(AUTH_KEY)
    setAdminAuthed(false)
    setIsDemo(false)
    setData(emptyData)
    if (isSupabaseConfigured) {
      void supabase.auth.signOut()
    }
  }

  const saveCapList = async (studentId: string, notes: string, preferences: GeneratedPreference[]) => {
    if (isDemo) {
      const capListId = `cap-${studentId}`
      const nextList: CapList = {
        id: capListId,
        student_id: studentId,
        counsellor_notes: notes,
        updated_at: new Date().toISOString(),
      }
      const nextItems: CapListItem[] = preferences.map((item) => ({
        id: `cap-item-${item.id}`,
        cap_list_id: capListId,
        college_id: item.college_id,
        branch: item.branch,
        priority_order: item.priority_order,
        safety_label: item.safety_label,
        notes: item.notes,
      }))
      setData((current) => ({
        ...current,
        capLists: [nextList, ...current.capLists.filter((list) => list.student_id !== studentId)],
        capListItems: [...current.capListItems.filter((item) => item.cap_list_id !== capListId), ...nextItems],
      }))
      return
    }

    const existing = data.capLists.find((list) => list.student_id === studentId)
    const { data: savedList, error: listError } = existing
      ? await supabase
          .from('cap_lists')
          .update({ counsellor_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single()
      : await supabase.from('cap_lists').insert({ student_id: studentId, counsellor_notes: notes }).select('*').single()

    if (listError) throw listError
    const capList = savedList as CapList
    await supabase.from('cap_list_items').delete().eq('cap_list_id', capList.id)

    const payload = preferences.map((item) => ({
      cap_list_id: capList.id,
      college_id: item.college_id,
      branch: item.branch,
      priority_order: item.priority_order,
      safety_label: item.safety_label,
      notes: item.notes,
    }))
    const { data: savedItems, error: itemsError } = await supabase.from('cap_list_items').insert(payload).select('*')
    if (itemsError) throw itemsError

    setData((current) => ({
      ...current,
      capLists: [capList, ...current.capLists.filter((list) => list.id !== capList.id)],
      capListItems: [...current.capListItems.filter((item) => item.cap_list_id !== capList.id), ...((savedItems ?? []) as CapListItem[])],
    }))
  }

  const confirmPayment = async (studentId: string) => {
    if (isDemo) {
      setData((current) => ({
        ...current,
        students: current.students.map((student) =>
          student.id === studentId ? { ...student, payment_status: 'confirmed' } : student
        ),
      }))
      return
    }

    const { data: updated, error } = await supabase
      .from('students')
      .update({ payment_status: 'confirmed' })
      .eq('id', studentId)
      .select('*')
      .single()

    if (error) throw error

    setData((current) => ({
      ...current,
      students: current.students.map((student) =>
        student.id === studentId ? (updated as Student) : student
      ),
    }))
  }

  const addCutoffRows = async (rows: Cutoff[]) => {
    if (isDemo) {
      setData((current) => ({ ...current, cutoffs: [...rows, ...current.cutoffs] }))
      return
    }

    const payload = rows.map(({ id: _id, ...row }) => row)
    const { data: inserted, error } = await supabase.from('cutoffs').insert(payload).select('*')
    if (error) throw error
    setData((current) => ({ ...current, cutoffs: [...((inserted ?? []) as Cutoff[]), ...current.cutoffs] }))
  }

  const fetchCutoffsOnDemand = async () => {
    if (data.cutoffs.length > 0 || isDemo || !isSupabaseConfigured) return
    setLoading(true)
    try {
      const cutoffsList: any[] = []
      let pageNum = 0
      const pageSize = 1000
      while (true) {
        const { data: pageCutoffs, error: fetchErr } = await supabase
          .from('cutoffs')
          .select('*')
          .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        if (fetchErr) throw fetchErr
        if (!pageCutoffs || pageCutoffs.length === 0) break
        cutoffsList.push(...pageCutoffs)
        if (pageCutoffs.length < pageSize) break
        pageNum++
      }

      const mapped = cutoffsList.map((c: any) => {
        const branchObj = data.branches.find((b) => b.branch_code === c.branch_code)
        return {
          ...c,
          branch: branchObj ? (branchObj.branch_name || branchObj.name || '') : c.branch_code || '',
          round: `Round ${c.round}`,
          rank_cutoff: c.closing_rank ?? c.opening_rank ?? 0,
        }
      }) as Cutoff[]

      setData((current) => ({
        ...current,
        cutoffs: mapped,
      }))
    } catch (e) {
      console.error('Failed to load cutoffs on demand', e)
    } finally {
      setLoading(false)
    }
  }

  if (!adminAuthed) return <AdminLogin onLogin={login} />

  return (
    <AdminShell isDemo={isDemo} onLogout={logout}>
      {toast ? <Toast message={toast} /> : null}
      {loading ? (
        <LoadingPanel label="Loading Margdarshak Nirnay..." />
      ) : (
        <Routes>
          <Route path="/" element={<DashboardPage data={data} onConfirm={confirmPayment} />} />
          <Route path="/students" element={<StudentsPage data={data} />} />
          <Route path="/students/:id" element={<StudentDetailPage data={data} onSaveCapList={saveCapList} onConfirm={confirmPayment} isDemo={isDemo} />} />
          <Route path="/cap-lists" element={<CapListsPage data={data} />} />
          <Route path="/cutoffs" element={<CutoffPage data={data} onAddRows={addCutoffRows} onLoadCutoffs={fetchCutoffsOnDemand} />} />
          <Route path="/export" element={<ExportPage data={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AdminShell>
  )
}

function AdminLogin({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#185FA5] px-8 text-white">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <section>
          <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-orange-100">
            <ShieldCheck className="size-4" />
            Margdarshak Nirnay
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight">मार्गदर्शक निर्णय</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-50">
            Counsellor dashboard for student shortlist monitoring, CAP list generation, cutoff import,
            and printable exports.
          </p>
        </section>

        <form onSubmit={submit} className="rounded-md bg-white p-7 text-slate-950 shadow-2xl">
          <div className="grid size-12 place-items-center rounded-md bg-[#185FA5] text-white">
            <LockKeyhole className="size-6" />
          </div>
          <h2 className="mt-5 text-2xl font-black text-[#185FA5]">Admin login</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">Enter your counsellor admin credentials to access Nirnay.</p>
          <label className="mt-6 grid gap-2 text-sm font-bold text-[#185FA5]">
            Email
            <input className="input" placeholder="admin@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="mt-4 grid gap-2 text-sm font-bold text-[#185FA5]">
            Password
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
          <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 py-3 font-black text-white hover:bg-orange-600">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
            Login
          </button>
        </form>
      </div>
    </main>
  )
}

function AdminShell({ isDemo, onLogout, children }: { isDemo: boolean; onLogout: () => void; children: React.ReactNode }) {
  const nav = [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/students', label: 'Students', icon: Users },
    { to: '/cap-lists', label: 'CAP Lists', icon: ListChecks },
    { to: '/cutoffs', label: 'Cut-off Data', icon: Database },
    { to: '/export', label: 'Export', icon: FileText },
  ]

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-slate-50">
      <aside className="sticky top-0 h-screen bg-[#185FA5] px-4 py-5 text-white">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-[#F97316]">
            <GraduationCap className="size-6" />
          </span>
          <span>
            <span className="block text-base font-black leading-none">Margdarshak Nirnay</span>
            <span className="block text-xs font-bold text-orange-100">मार्गदर्शक निर्णय</span>
          </span>
        </Link>
        <nav className="mt-8 grid gap-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition ${
                  isActive ? 'bg-white text-[#185FA5]' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4">
          {isDemo ? <div className="mb-3 rounded-md bg-[#F97316] px-3 py-2 text-center text-xs font-black">Demo mode</div> : null}
          <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-3 text-sm font-bold text-blue-100 hover:bg-white/10">
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="min-w-0 p-6">{children}</main>
    </div>
  )
}

function DashboardPage({ data, onConfirm }: { data: DashboardData; onConfirm: (studentId: string) => Promise<void> }) {
  const recent = data.students.slice(0, 6)
  const changed = data.students.filter(isRecentlyUpdated)
  const pendingPayments = data.students.filter((student) => student.payment_status === 'pending')
  const byTier = {
    Explorer: data.students.filter((student) => student.membership_tier === 'Explorer').length,
    Guide: data.students.filter((student) => student.membership_tier === 'Guide').length,
  }

  return (
    <div className="grid gap-5">
      <PageHeader icon={Home} title="Dashboard" text="Overview of Margdarshak registrations and shortlist activity." />
      <section className="grid grid-cols-4 gap-4">
        <Stat label="Total students" value={data.students.length.toString()} />
        <Stat label="Explorer" value={byTier.Explorer.toString()} />
        <Stat label="Guide" value={byTier.Guide.toString()} />
        <Stat label="Updated 24h" value={changed.length.toString()} accent />
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="Pending payments">
          <div className="grid gap-3">
            {pendingPayments.length ? (
              pendingPayments.map((student) => (
                <div key={student.id} className="rounded-md border border-orange-200 bg-orange-50/50 p-3 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <Link to={`/students/${student.id}`} className="font-black text-[#185FA5] hover:underline">
                      {student.name}
                    </Link>
                    <p className="mt-1 font-bold text-slate-500">{student.membership_tier} · ₹{tierPrice(student.membership_tier)}</p>
                  </div>
                  <button
                    onClick={() => onConfirm(student.id)}
                    className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Confirm
                  </button>
                </div>
              ))
            ) : (
              <EmptyState title="All clear!" text="No pending payment activations." />
            )}
          </div>
        </Panel>
        <Panel title="Recent registrations">
          <div className="grid gap-3">
            {recent.map((student) => <StudentMini key={student.id} student={student} />)}
          </div>
        </Panel>
        <Panel title="Shortlists updated (24h)">
          <div className="grid gap-3">
            {changed.length ? changed.map((student) => <StudentMini key={student.id} student={student} highlight />) : <EmptyState title="No recent updates" text="Student shortlist activity will appear here." />}
          </div>
        </Panel>
      </section>
    </div>
  )
}

function StudentsPage({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState('')
  const [category, setCategory] = useState('')
  const filtered = data.students.filter((student) => {
    const text = `${student.name} ${student.phone} ${student.email}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (!tier || student.membership_tier === tier) && (!category || student.category === category)
  })

  return (
    <div className="grid gap-5">
      <PageHeader icon={Users} title="Students" text="All registered students with shortlist activity highlights." />
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[1fr_220px_220px] gap-3">
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, phone, email" />
          <select className="input" value={tier} onChange={(event) => setTier(event.target.value)}>
            <option value="">All tiers</option>
            <option value="Explorer">Explorer</option>
            <option value="Guide">Guide</option>
          </select>
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </section>
      <DataTable>
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <th className="table-cell">Name</th>
            <th className="table-cell">Rank</th>
            <th className="table-cell">Category</th>
            <th className="table-cell">District</th>
            <th className="table-cell">Tier</th>
            <th className="table-cell">Payment</th>
            <th className="table-cell">Phone</th>
            <th className="table-cell">Registered</th>
            <th className="table-cell">Shortlist updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((student) => (
            <tr key={student.id} className={`hover:bg-blue-50/50 ${isRecentlyUpdated(student) ? 'border-l-4 border-emerald-400 bg-emerald-50/30' : 'border-l-4 border-transparent'}`}>
              <td className="table-cell">
                <Link to={`/students/${student.id}`} className="font-black text-[#185FA5] hover:underline">{student.name}</Link>
              </td>
              <td className="table-cell font-bold">{student.rank.toLocaleString('en-IN')}</td>
              <td className="table-cell">{student.category ?? 'Pending'}</td>
              <td className="table-cell">{student.region ?? 'All'}</td>
              <td className="table-cell"><TierPill tier={student.membership_tier ?? 'No plan'} /></td>
              <td className="table-cell">
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-black ring-1 ${
                  student.payment_status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-orange-50 text-orange-700 ring-orange-200'
                }`}>
                  {student.payment_status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </span>
              </td>
              <td className="table-cell">{student.phone}</td>
              <td className="table-cell">{formatDate(student.created_at)}</td>
              <td className="table-cell">{formatDate(student.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}

function CapListsPage({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-5">
      <PageHeader icon={ListChecks} title="CAP Lists" text="Generate and manage final preference lists from each student profile." />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.students.map((student) => {
          const list = data.capLists.find((item) => item.student_id === student.id)
          const count = list ? data.capListItems.filter((item) => item.cap_list_id === list.id).length : 0
          return (
            <Link key={student.id} to={`/students/${student.id}`} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:border-[#185FA5]/30">
              <p className="font-black text-[#185FA5]">{student.name}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">Rank {student.rank.toLocaleString('en-IN')} · {student.category ?? 'NA'}</p>
              <p className="mt-4 text-sm font-bold text-slate-500">{count ? `${count} saved preferences` : 'No saved list yet'}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StudentDetailPage({ data, onSaveCapList, onConfirm, isDemo }: { data: DashboardData; onSaveCapList: (studentId: string, notes: string, preferences: GeneratedPreference[]) => Promise<void>; onConfirm: (studentId: string) => Promise<void>; isDemo: boolean }) {
  const { id } = useParams()
  const student = data.students.find((item) => item.id === id)
  const [category, setCategory] = useState<Category>((student?.category ?? 'General') as Category)
  const [district, setDistrict] = useState(student?.region ?? '')
  const [notes, setNotes] = useState('')
  const [preferences, setPreferences] = useState<GeneratedPreference[]>([])
  const [selectedCollege, setSelectedCollege] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor))

  const [localCutoffs, setLocalCutoffs] = useState<Cutoff[]>([])
  const [loadingLocalCutoffs, setLoadingLocalCutoffs] = useState(false)

  useEffect(() => {
    if (isDemo || !isSupabaseConfigured) {
      setLocalCutoffs(data.cutoffs)
      setLoadingLocalCutoffs(false)
      return
    }

    const fetchLocalCutoffs = async () => {
      setLoadingLocalCutoffs(true)
      try {
        // Find the latest year available in the database
        const { data: maxYearData } = await supabase
          .from('cutoffs')
          .select('year')
          .order('year', { ascending: false })
          .limit(1)
        const latestYear = maxYearData && maxYearData[0] ? maxYearData[0].year : 2024

        // Fetch page 0 of cutoffs for the latest year and the student's category
        const pageSize = 1000
        const { data: firstPage, error: firstPageError, count } = await supabase
          .from('cutoffs')
          .select('college_id,branch_code,category,round,year,closing_rank,opening_rank', { count: 'exact' })
          .eq('category', category)
          .eq('year', latestYear)
          .range(0, pageSize - 1)

        if (firstPageError) throw firstPageError
        const rawCutoffs = [...(firstPage ?? [])]

        if (count && count > pageSize) {
          const remainingPages = Math.ceil(count / pageSize) - 1
          const promises = Array.from({ length: remainingPages }, (_, i) => {
            const pageNum = i + 1
            return supabase
              .from('cutoffs')
              .select('college_id,branch_code,category,round,year,closing_rank,opening_rank')
              .eq('category', category)
              .eq('year', latestYear)
              .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
          })

          const results = await Promise.all(promises)
          for (const res of results) {
            if (res.error) throw res.error
            if (res.data) {
              rawCutoffs.push(...res.data)
            }
          }
        }

        const mapped = rawCutoffs.map((c: any) => {
          const branchObj = data.branches.find((b) => b.branch_code === c.branch_code)
          return {
            ...c,
            branch: branchObj ? (branchObj.branch_name || branchObj.name || '') : c.branch_code || '',
            round: `Round ${c.round}`,
            rank_cutoff: c.closing_rank ?? c.opening_rank ?? 0,
          }
        }) as Cutoff[]

        setLocalCutoffs(mapped)
      } catch (err) {
        console.error('Error fetching local cutoffs:', err)
      } finally {
        setLoadingLocalCutoffs(false)
      }
    }

    void fetchLocalCutoffs()
  }, [category, isDemo, data.branches])

  if (!student) return <EmptyState title="Student not found" text="Return to Students and select a valid student." />

  const shortlist = data.shortlists.filter((item) => item.student_id === student.id).sort((a, b) => a.priority_order - b.priority_order)
  const selectedCollegeRecord = data.colleges.find((college) => college.id === selectedCollege)

  const generateCapList = () => {
    const shortlistPrefs = shortlist
      .map((item): GeneratedPreference | null => {
        const college = data.colleges.find((entry) => entry.id === item.college_id)
        const cutoff = localCutoffs.find((entry) => entry.college_id === item.college_id && entry.branch === item.branch && entry.category === category)
        if (!college) return null
        const rank = cutoffRank(cutoff)
        return {
          id: `${item.college_id}-${item.branch}`,
          college_id: item.college_id,
          college_name: college.name,
          district: college.district,
          branch: item.branch,
          cutoff_rank: rank ?? 0,
          safety_label: safetyForRank(student.rank, rank),
          priority_order: item.priority_order,
          notes: item.notes ?? 'Student shortlisted this option.',
          from_shortlist: true,
        }
      })
      .filter((item): item is GeneratedPreference => Boolean(item))

    const shortlistKeys = new Set(shortlistPrefs.map((item) => item.id))
    const generated = localCutoffs
      .filter((cutoff) => cutoff.category === category)
      .map((cutoff): GeneratedPreference | null => {
        const college = data.colleges.find((item) => item.id === cutoff.college_id)
        if (!college) return null
        const rank = cutoffRank(cutoff)
        return {
          id: `${cutoff.college_id}-${cutoff.branch}`,
          college_id: cutoff.college_id,
          college_name: college.name,
          district: college.district,
          branch: cutoff.branch,
          cutoff_rank: rank ?? 0,
          safety_label: safetyForRank(student.rank, rank),
          priority_order: 0,
          notes: '',
          from_shortlist: false,
        }
      })
      .filter((item): item is GeneratedPreference => Boolean(item))
      .filter((item) => !shortlistKeys.has(item.id))
      .sort((a, b) => {
        const districtScore = Number(b.district === district) - Number(a.district === district)
        if (districtScore !== 0) return districtScore
        return Math.abs(a.cutoff_rank - student.rank) - Math.abs(b.cutoff_rank - student.rank)
      })

    const merged = [...shortlistPrefs, ...generated].slice(0, 60).map((item, index) => ({ ...item, priority_order: index + 1 }))
    setPreferences(merged)
    setStatus(`Generated ${merged.length} preferences.`)
  }

  const dragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : ''
    if (!overId || activeId === overId) return
    const activeIndex = preferences.findIndex((item) => item.id === activeId)
    const overIndex = preferences.findIndex((item) => item.id === overId)
    if (activeIndex < 0 || overIndex < 0) return
    const next = [...preferences]
    const [moved] = next.splice(activeIndex, 1)
    next.splice(overIndex, 0, moved)
    setPreferences(next.map((item, index) => ({ ...item, priority_order: index + 1 })))
  }

  const addManual = () => {
    const college = data.colleges.find((item) => item.id === selectedCollege)
    if (!college || !selectedBranch) return
    const cutoff = localCutoffs.find((item) => item.college_id === college.id && item.branch === selectedBranch && item.category === category)
    const rank = cutoffRank(cutoff)
    setPreferences((current) => [
      ...current,
      {
        id: `${college.id}-${selectedBranch}-${Date.now()}`,
        college_id: college.id,
        college_name: college.name,
        district: college.district,
        branch: selectedBranch,
        cutoff_rank: rank ?? 0,
        safety_label: safetyForRank(student.rank, rank),
        priority_order: current.length + 1,
        notes: 'Manually added by counsellor.',
        from_shortlist: false,
      },
    ])
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSaveCapList(student.id, notes, preferences)
      setStatus(`Saved. WhatsApp: "${whatsappMessage}"`)
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : 'Could not save CAP list.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader icon={UserRound} title={student.name} text="Generate and edit this student's CAP preference list." />
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title="Student profile">
          <div className="grid grid-cols-6 gap-3">
            <Info label="Rank" value={student.rank.toLocaleString('en-IN')} />
            <Info label="Category" value={student.category ?? 'Pending'} />
            <Info label="District" value={student.region ?? 'All'} />
            <Info label="Tier" value={student.membership_tier ?? 'No plan'} />
            <Info label="Payment" value={student.payment_status === 'confirmed' ? 'Confirmed' : 'Pending'} />
            <Info label="Phone" value={student.phone} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <label className="grid gap-2 text-sm font-bold text-[#185FA5]">
              Confirm category
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#185FA5]">
              Home district
              <input className="input" value={district} onChange={(event) => setDistrict(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#185FA5]">
              Counsellor notes
              <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            {student.payment_status === 'pending' ? (
              <button
                onClick={async () => {
                  try {
                    setStatus('Confirming payment...')
                    await onConfirm(student.id)
                    setStatus('Payment confirmed successfully.')
                  } catch {
                    setStatus('Failed to confirm payment.')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-700 shadow-sm"
              >
                Confirm Payment Receipt
              </button>
            ) : null}
            <button
              onClick={generateCapList}
              disabled={loadingLocalCutoffs}
              className="inline-flex items-center gap-2 rounded-md bg-[#F97316] px-4 py-3 font-black text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {loadingLocalCutoffs ? <Loader2 className="size-4 animate-spin" /> : null}
              {loadingLocalCutoffs ? 'Loading data...' : 'Generate CAP List'}
            </button>
            <button onClick={save} disabled={!preferences.length || saving} className="inline-flex items-center gap-2 rounded-md bg-[#185FA5] px-4 py-3 font-black text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </button>
          </div>
          {status ? <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-bold text-[#185FA5]">{status}</p> : null}
        </Panel>
        <Panel title="Shortlist from Khoj">
          <div className="grid gap-3">
            {shortlist.length ? shortlist.map((item) => {
              const college = data.colleges.find((entry) => entry.id === item.college_id)
              return <div key={item.id} className="rounded-md bg-blue-50 p-3 text-sm font-bold text-[#185FA5]">{item.priority_order}. {college?.name ?? item.college_id} · {item.branch}</div>
            }) : <p className="text-sm font-semibold text-slate-500">No shortlist yet.</p>}
          </div>
        </Panel>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
          <select className="input" value={selectedCollege} onChange={(event) => { setSelectedCollege(event.target.value); setSelectedBranch('') }}>
            <option value="">Add college manually</option>
            {data.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
          </select>
          <select className="input" value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}>
            <option value="">Select branch</option>
            {selectedCollegeRecord?.branches.map((branch) => <option key={branch}>{branch}</option>)}
          </select>
          <button onClick={addManual} className="inline-flex items-center gap-2 rounded-md border border-[#185FA5]/20 px-4 py-2 font-black text-[#185FA5] hover:bg-blue-50">
            <Plus className="size-4" /> Add
          </button>
        </div>
      </section>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <div className="grid gap-3">
          {preferences.map((item) => (
            <PreferenceRow
              key={item.id}
              item={item}
              onNotes={(value) => setPreferences((current) => current.map((entry) => entry.id === item.id ? { ...entry, notes: value } : entry))}
              onRemove={() => setPreferences((current) => current.filter((entry) => entry.id !== item.id).map((entry, index) => ({ ...entry, priority_order: index + 1 })))}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function PreferenceRow({ item, onNotes, onRemove }: { item: GeneratedPreference; onNotes: (value: string) => void; onRemove: () => void }) {
  const draggable = useDraggable({ id: item.id })
  const droppable = useDroppable({ id: item.id })
  const style = draggable.transform ? { transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` } : undefined
  return (
    <div ref={droppable.setNodeRef} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div ref={draggable.setNodeRef} style={style} className="grid grid-cols-[54px_1fr_120px_160px_1fr_44px] items-center gap-3">
        <button {...draggable.listeners} {...draggable.attributes} className="flex items-center gap-2 text-slate-400">
          <GripVertical className="size-5" />
          <span className="font-black text-[#185FA5]">{item.priority_order}</span>
        </button>
        <div>
          <p className="font-black text-[#185FA5]">{item.college_name}</p>
          <p className="text-sm font-semibold text-slate-500">{item.branch} {item.from_shortlist ? '· shortlist' : ''}</p>
        </div>
        <p className="font-bold text-slate-700">{item.cutoff_rank ? item.cutoff_rank.toLocaleString('en-IN') : 'NA'}</p>
        <SafetyPill label={item.safety_label} />
        <input className="input" value={item.notes} onChange={(event) => onNotes(event.target.value)} />
        <button onClick={onRemove} className="rounded-md bg-red-50 p-2 text-red-700"><Trash2 className="size-4" /></button>
      </div>
    </div>
  )
}

function CutoffPage({ data, onAddRows, onLoadCutoffs }: { data: DashboardData; onAddRows: (rows: Cutoff[]) => Promise<void>; onLoadCutoffs: () => Promise<void> }) {
  const [college, setCollege] = useState('')
  const [branch, setBranch] = useState('')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState('')
  const [round, setRound] = useState('')
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (data.cutoffs.length === 0) {
        setFetching(true)
        await onLoadCutoffs()
        setFetching(false)
      }
    }
    void load()
  }, [onLoadCutoffs, data.cutoffs.length])

  const filtered = data.cutoffs.filter((cutoff) =>
    (!college || cutoff.college_id === college) &&
    (!branch || cutoff.branch === branch) &&
    (!category || cutoff.category === category) &&
    (!year || cutoff.year === Number(year)) &&
    (!round || cutoff.round === round)
  )
  const branches = Array.from(new Set(data.cutoffs.map((cutoff) => cutoff.branch))).sort()
  const rounds = Array.from(new Set(data.cutoffs.map((cutoff) => cutoff.round))).sort()

  const importCsv = async (file: File) => {
    const text = await file.text()
    const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean)
    const headers = headerLine.split(',').map((item) => item.trim())
    const parsed = rows.map((line, index) => {
      const values = line.split(',').map((item) => item.trim())
      const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]]))
      return {
        id: `csv-${Date.now()}-${index}`,
        college_id: row.college_id,
        branch: row.branch,
        category: row.category as Category,
        round: row.round,
        year: Number(row.year),
        rank_cutoff: Number(row.rank_cutoff),
      } satisfies Cutoff
    }).filter((row) => row.college_id && row.branch && row.category && row.round && row.year && row.rank_cutoff)
    await onAddRows(parsed)
  }

  if (fetching) {
    return (
      <div className="grid gap-5">
        <PageHeader icon={Database} title="Cut-off Data" text="Filter and bulk import cutoff rows." />
        <LoadingPanel label="Loading cut-off data from database..." />
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      <PageHeader icon={Database} title="Cut-off Data" text="Filter and bulk import cutoff rows." />
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[1fr_1fr_150px_120px_150px_auto] gap-3">
          <select className="input" value={college} onChange={(event) => setCollege(event.target.value)}>
            <option value="">All colleges</option>
            {data.colleges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="input" value={branch} onChange={(event) => setBranch(event.target.value)}>
            <option value="">All branches</option>
            {branches.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Category</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="input" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" />
          <select className="input" value={round} onChange={(event) => setRound(event.target.value)}>
            <option value="">Round</option>
            {rounds.map((item) => <option key={item}>{item}</option>)}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#F97316] px-4 py-2 font-black text-white">
            <Upload className="size-4" />
            CSV
            <input type="file" accept=".csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file) }} />
          </label>
        </div>
      </section>
      <DataTable>
        <thead><tr className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500"><th className="table-cell">College</th><th className="table-cell">Branch</th><th className="table-cell">Category</th><th className="table-cell">Round</th><th className="table-cell">Year</th><th className="table-cell">Rank</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((cutoff) => {
            const collegeName = data.colleges.find((item) => item.id === cutoff.college_id)?.name ?? cutoff.college_id
            return <tr key={cutoff.id}><td className="table-cell font-black text-[#185FA5]">{collegeName}</td><td className="table-cell">{cutoff.branch}</td><td className="table-cell">{cutoff.category}</td><td className="table-cell">{cutoff.round}</td><td className="table-cell">{cutoff.year}</td><td className="table-cell font-bold">{cutoffRank(cutoff).toLocaleString('en-IN')}</td></tr>
          })}
        </tbody>
      </DataTable>
    </div>
  )
}


function ExportPage({ data }: { data: DashboardData }) {
  const [studentId, setStudentId] = useState(data.students[0]?.id ?? '')
  const student = data.students.find((item) => item.id === studentId)
  const capList = data.capLists.find((item) => item.student_id === studentId)
  const items = capList ? data.capListItems.filter((item) => item.cap_list_id === capList.id).sort((a, b) => a.priority_order - b.priority_order) : []

  const exportPdf = () => {
    if (!student || !items.length) return
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.setTextColor(24, 95, 165)
    doc.text('Margdarshak', 14, 18)
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text(`Student: ${student.name}`, 14, 30)
    doc.text(`Rank: ${student.rank.toLocaleString('en-IN')} | Category: ${student.category ?? 'NA'} | District: ${student.region ?? 'NA'}`, 14, 38)
    let y = 52
    doc.setFontSize(10)
    doc.text('Priority', 14, y)
    doc.text('College', 35, y)
    doc.text('Branch', 104, y)
    doc.text('Safety', 150, y)
    doc.text('Notes', 172, y)
    y += 7
    items.forEach((item) => {
      const college = data.colleges.find((entry) => entry.id === item.college_id)
      doc.text(String(item.priority_order), 14, y)
      doc.text((college?.name ?? item.college_id).slice(0, 34), 35, y)
      doc.text(item.branch.slice(0, 22), 104, y)
      doc.text(item.safety_label, 150, y)
      doc.text((item.notes ?? '').slice(0, 20), 172, y)
      y += 8
      if (y > 280) {
        doc.addPage()
        y = 18
      }
    })
    doc.setFontSize(9)
    doc.text('Generated by Margdarshak - margdarshak.in', 14, 290)
    doc.save(`${student.name.replace(/\s+/g, '-')}-margdarshak-cap-list.pdf`)
  }

  return (
    <div className="grid gap-5">
      <PageHeader icon={Download} title="Export" text="Generate a printable PDF of the final CAP preference list." />
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <select className="input" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {data.students.map((item) => <option key={item.id} value={item.id}>{item.name} · Rank {item.rank}</option>)}
          </select>
          <button onClick={exportPdf} disabled={!items.length} className="inline-flex items-center gap-2 rounded-md bg-[#F97316] px-4 py-2 font-black text-white hover:bg-orange-600 disabled:opacity-50">
            <Download className="size-4" /> Export PDF
          </button>
        </div>
      </section>
      {student ? <CapListPreview student={student} data={data} /> : null}
    </div>
  )
}

function CapListPreview({ student, data }: { student: Student; data: DashboardData }) {
  const capList = data.capLists.find((item) => item.student_id === student.id)
  const items = capList ? data.capListItems.filter((item) => item.cap_list_id === capList.id).sort((a, b) => a.priority_order - b.priority_order) : []
  return (
    <Panel title={`${student.name} final list`}>
      <div className="grid gap-3">
        {items.length ? items.map((item) => {
          const college = data.colleges.find((entry) => entry.id === item.college_id)
          return <div key={item.id} className="rounded-md border border-slate-200 p-4"><div className="flex justify-between gap-4"><div><p className="font-black text-[#185FA5]">{item.priority_order}. {college?.name ?? item.college_id}</p><p className="text-sm font-semibold text-slate-600">{item.branch}</p>{item.notes ? <p className="mt-2 text-sm text-slate-500">{item.notes}</p> : null}</div><SafetyPill label={item.safety_label} /></div></div>
        }) : <EmptyState title="No saved CAP list" text="Generate and save a list from the student detail page first." />}
      </div>
    </Panel>
  )
}

function Toast({ message }: { message: string }) {
  return <div className="fixed right-6 top-6 z-50 rounded-md bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-xl">{message}</div>
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-md border p-4 shadow-sm ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}><p className="text-3xl font-black text-[#185FA5]">{value}</p><p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p></div>
}

function StudentMini({ student, highlight = false }: { student: Student; highlight?: boolean }) {
  return <Link to={`/students/${student.id}`} className={`rounded-md border p-3 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><p className="font-black text-[#185FA5]">{student.name}</p><p className="mt-1 text-sm font-semibold text-slate-600">Rank {student.rank.toLocaleString('en-IN')} · {student.membership_tier ?? 'No plan'}</p></Link>
}

function TierPill({ tier }: { tier: string }) {
  return <span className="rounded-md bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">{tier}</span>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black text-[#185FA5]">{title}</h2>{children}</section>
}

function SafetyPill({ label }: { label: SafetyLabel }) {
  const classes = label === 'SAFE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : label === 'MODERATE' ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
  return <span className={`rounded-md px-2 py-1 text-xs font-black ring-1 ${classes}`}>{label}</span>
}

function PageHeader({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <header className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-md bg-blue-50 text-[#185FA5]"><Icon className="size-6" /></span><div><h1 className="text-3xl font-black text-[#185FA5]">{title}</h1><p className="mt-1 font-semibold text-slate-600">{text}</p></div></div></header>
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"><table className="w-full border-collapse text-sm">{children}</table></section>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-1 font-black text-[#185FA5]">{value}</p></div>
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="grid min-h-[420px] place-items-center rounded-md border border-slate-200 bg-white"><div className="text-center"><Loader2 className="mx-auto size-8 animate-spin text-[#F97316]" /><p className="mt-4 font-bold text-[#185FA5]">{label}</p></div></div>
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center"><BookOpenCheck className="mx-auto size-10 text-slate-300" /><h2 className="mt-4 text-xl font-black text-[#185FA5]">{title}</h2><p className="mt-2 font-semibold text-slate-600">{text}</p></div>
}

function isRecentlyUpdated(student: Student) {
  if (!student.updated_at) return false
  return Date.now() - new Date(student.updated_at).getTime() < 24 * 60 * 60 * 1000
}

function formatDate(value?: string) {
  if (!value) return 'NA'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function cutoffRank(cutoff: Cutoff | null | undefined) {
  return cutoff?.closing_rank ?? cutoff?.rank_cutoff ?? 0
}

function safetyForRank(rank: number, cutoffRank: number | null | undefined): SafetyLabel {
  const cutoff = cutoffRank ?? 0
  if (!cutoff) return 'REACH'
  if (cutoff >= rank * 1.1) return 'SAFE'
  if (cutoff >= rank * 0.9) return 'MODERATE'
  return 'REACH'
}

function tierPrice(tier: string | null | undefined): string {
  const prices: Record<string, string> = { Explorer: '199', Guide: '299' }
  return prices[tier ?? ''] ?? '199'
}

export default App
