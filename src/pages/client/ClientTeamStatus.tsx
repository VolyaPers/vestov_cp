import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronLeft, ChevronRight, Clock, HeartPulse, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useClientWorkspace, ClientLoadError } from '@/lib/clientWorkspace'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

interface Member { employeeId: number; assignmentId: number; projectId: number; name: string; position: string; email: string; avatarUrl?: string; timezone: string }
interface Day { date: string; employeeId: number; projectIds: number[]; projectAvailability: { projectId: number; workingMinutes: number }[]; timezone: string; startAt: string | null; endAt: string | null; startTime: string | null; endTime: string | null; workingMinutes: number; absenceMinutes: number; absenceUnits: number; isDayOff: boolean; isScheduleConfigured: boolean; isOverride: boolean; leaveType: string | null }
interface CalendarData { projects: { id: number; title: string }[]; members: Member[]; days: Day[] }
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const timezoneDate = (instant: string, formatter: Intl.DateTimeFormat) => {
  const parts = formatter.formatToParts(new Date(instant))
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`
}

export function ClientTeamStatus() {
  const { clientId } = useClientWorkspace()
  const [month, setMonth] = useState(() => localDate().slice(0, 7))
  const [projectId, setProjectId] = useState('all')
  const [personId, setPersonId] = useState('all')
  const [selectedDate, setSelectedDate] = useState(localDate())
  useShiftEvents()
  const calendar = useQuery({ queryKey: ['clientCalendar', clientId, month], queryFn: () => api.getClientCalendar(clientId!, month) as Promise<CalendarData>, enabled: !!clientId, refetchInterval: 300_000 })
  const shifts = useQuery({ queryKey: ['clientTeamShifts', clientId], queryFn: () => api.getClientTeamShifts(clientId), enabled: !!clientId, refetchInterval: 60_000 })
  useShiftUpdateListener(() => { void shifts.refetch() })
  const user = useQuery({ queryKey: ['currentUser'], queryFn: api.getCurrentUser })
  const viewerTimezone = user.data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const dateFormatter = useMemo(() => {
    try { return new Intl.DateTimeFormat('en-CA', {timeZone: viewerTimezone, year:'numeric', month:'2-digit', day:'2-digit'}) }
    catch { return new Intl.DateTimeFormat('en-CA', {timeZone:'UTC', year:'numeric', month:'2-digit', day:'2-digit'}) }
  }, [viewerTimezone])
  const zone = dateFormatter.resolvedOptions().timeZone
  const timeFormatter = useMemo(()=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hour12:false}),[zone])
  const projects = calendar.data?.projects || []
  const members = calendar.data?.members || []
  const visibleMembers = members.filter(member => projectId === 'all' || member.projectId === Number(projectId))
  const people = new Map(visibleMembers.map(member => [member.employeeId, member]))
  const selectedPerson = people.has(Number(personId)) ? personId : 'all'
  const days = useMemo(() => (calendar.data?.days || []).filter(day => (selectedPerson === 'all' || day.employeeId === Number(selectedPerson)) && (projectId === 'all' || day.projectIds.includes(Number(projectId)))).map(day => ({
    ...day, workingMinutes: projectId === 'all' ? day.workingMinutes : day.projectAvailability.find(project => project.projectId === Number(projectId))?.workingMinutes || 0, displayDate: day.startAt && day.absenceUnits < 1 ? timezoneDate(day.startAt, dateFormatter) : day.date,
  })), [calendar.data, projectId, selectedPerson, dateFormatter])
  const [year, monthNumber] = month.split('-').map(Number)
  const numberOfDays = new Date(year, monthNumber, 0).getDate()
  const padding = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const currentShifts = (shifts.data?.shifts || []).filter((shift: any) => people.has(shift.employeeId))
  const shiftTime = (instant: string) => timeFormatter.format(new Date(instant))
  const moveMonth = (offset: number) => {
    const next = new Date(year, monthNumber - 1 + offset, 1)
    const key = localDate(next).slice(0, 7)
    setMonth(key); setSelectedDate(`${key}-01`)
  }
  const retry = () => { calendar.refetch(); shifts.refetch() }
  if (!calendar.data && calendar.isLoading) return <p role="status" className="p-8">Loading your team calendar…</p>
  if (!calendar.data && calendar.isError) return <ClientLoadError message="Unable to load team availability. Please retry to view the schedule." onRetry={retry} />
  const selectedDays = days.filter(day => day.displayDate === selectedDate)
  const describeDay = (day: Day) => day.leaveType ? `${day.leaveType}${day.absenceUnits === 0.5 ? ' · half day' : ''}` : !day.isScheduleConfigured ? 'Schedule not set' : day.isDayOff ? 'Day off' : day.workingMinutes ? `${Number((day.workingMinutes / 60).toFixed(2))}h available` : 'No shift scheduled'
  return <div className="space-y-6">
    <PageHero eyebrow="Client Workspace" title="Your team calendar" description="Project participation, planned availability and live shifts for your selected client workspace." theme="teal" meta={<span>Times: {zone}. Full-day absence dates follow the employee’s local calendar.</span>} />
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="calendar-project" className="text-sm font-medium">Project</label>
      <select id="calendar-project" value={projectId} onChange={event => {setProjectId(event.target.value); setPersonId('all')}} className="max-w-full rounded-xl border bg-white px-3 py-2">
        <option value="all">All projects</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
      <label htmlFor="calendar-person" className="text-sm font-medium">Team member</label>
      <select id="calendar-person" className="max-w-full rounded-xl border bg-white px-3 py-2" value={selectedPerson} onChange={event=>setPersonId(event.target.value)}>
        <option value="all">All team members</option>{[...people.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(person=><option key={person.employeeId} value={person.employeeId}>{person.name} · {person.position}</option>)}
      </select>
      <Button variant="outline" onClick={retry}>Refresh</Button>
      {(calendar.isFetching || shifts.isFetching) && <span className="text-sm text-muted-foreground" role="status">Updating…</span>}
    </div>
    {shifts.isError && <ClientLoadError message="Live shift status is unavailable. You can still use the planned calendar." onRetry={()=>shifts.refetch()}/>}
    {calendar.isError && <ClientLoadError message="Showing the last loaded schedule. Refresh to check for changes." onRetry={()=>calendar.refetch()}/>}
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricTile label="People this month" value={people.size} hint="Unique people in the selected projects" icon={<Users className="h-5 w-5" />} />
      <MetricTile label="Working now" value={!shifts.data || shifts.isError ? '—' : currentShifts.filter((shift: any) => shift.status === 'active').length} hint="Open shifts in your current team" icon={<Clock className="h-5 w-5" />} />
      <MetricTile label="On break" value={!shifts.data || shifts.isError ? '—' : currentShifts.filter((shift: any) => shift.status === 'on_break').length} hint="Live break status" icon={<HeartPulse className="h-5 w-5" />} />
    </div>
    {!shifts.isError && currentShifts.length > 0 && <Card><CardContent className="p-5"><SectionHeading title="Live shifts" icon={<Clock className="h-5 w-5" />} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{currentShifts.map((shift: any) => <div key={shift.id} className="rounded-xl border p-3"><p className="font-medium">{shift.employee?.name}</p><p className="text-sm text-muted-foreground">{shift.status === 'on_break' ? 'On break' : 'Working'} · started {shiftTime(shift.startTime)}</p></div>)}</div></CardContent></Card>}
    <Card><CardContent className="p-3 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><Button aria-label="Previous month" variant="outline" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button><h2 className="font-semibold">{new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><Button aria-label="Next month" variant="outline" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button></div>
      <div className="overflow-x-auto"><div className="min-w-0">
        <div className="grid grid-cols-7 text-center text-sm text-muted-foreground">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="pb-2">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: padding }, (_, index) => <div key={`pad-${index}`} />)}
          {Array.from({ length: numberOfDays }, (_, index) => {
            const date = `${month}-${String(index + 1).padStart(2, '0')}`
            const events = days.filter(day => day.displayDate === date && (day.workingMinutes > 0 || day.absenceUnits > 0 || day.isOverride))
            return <button type="button" key={date} onClick={() => setSelectedDate(date)} aria-label={`View ${date}`} aria-pressed={selectedDate === date} className={`min-w-0 min-h-14 sm:min-h-28 rounded-lg border p-1 sm:p-2 text-left ${selectedDate === date ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-white'}`}><span className="text-sm font-semibold">{index + 1}</span><span className="block text-xs text-muted-foreground sm:hidden">{events.length || ''}</span><div className="mt-1 hidden space-y-1 sm:block">{events.slice(0, 3).map(day => <div key={`${day.employeeId}-${day.date}`} title={`${people.get(day.employeeId)?.name}: ${describeDay(day)} (source ${day.date}, ${day.timezone})`} className={`truncate rounded px-1 py-0.5 text-[10px] ${day.absenceUnits ? 'bg-rose-50 text-rose-800' : day.isDayOff ? 'bg-slate-100 text-slate-600' : day.isOverride ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{people.get(day.employeeId)?.name} {day.absenceUnits === 0.5 ? '½' : day.leaveType ? '· away' : ''}</div>)}{events.length > 3 && <p className="text-xs text-muted-foreground">+{events.length - 3} more</p>}</div></button>
          })}
        </div>
      </div></div>
    </CardContent></Card>
    <Card><CardContent className="p-5"><SectionHeading title={`Availability · ${selectedDate}`} description="Select a date to see every team member, scheduled hours and approved absence." icon={<Calendar className="h-5 w-5" />} />
      {!selectedDays.length ? <EmptyState title="No team participation on this date" description="Choose another date or project." /> : <div className="grid gap-3 md:grid-cols-2">{selectedDays.map(day => <div key={`${day.employeeId}-${day.date}`} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{people.get(day.employeeId)?.name}<span className="block text-sm font-normal text-muted-foreground">{people.get(day.employeeId)?.position}</span></p><Badge variant="outline">{describeDay(day)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{day.projectIds.map(id => projects.find(project => project.id === id)?.title).filter(Boolean).join(' · ')}</p>{day.startAt && day.endAt && <p className="mt-2 text-sm">Scheduled {shiftTime(day.startAt)}–{shiftTime(day.endAt)} {zone}{timezoneDate(day.endAt, dateFormatter) !== day.displayDate ? ` · ends ${timezoneDate(day.endAt, dateFormatter)}` : ''}{day.isOverride ? ' · adjusted shift' : ''}</p>}{day.isScheduleConfigured && <p className="mt-1 text-sm font-medium">Available {Number((day.workingMinutes / 60).toFixed(2))} h</p>}<p className="mt-1 text-xs text-muted-foreground">Employee date {day.date} · {day.timezone}</p></div>)}</div>}
    </CardContent></Card>
  </div>
}
