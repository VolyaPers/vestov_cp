import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useShiftUpdateListener } from '@/hooks/useSocket'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const duration = (minutes: number) => `${Math.floor(Math.max(0, minutes) / 60)}h ${Math.floor(Math.max(0, minutes) % 60)}m`
export function ShiftHistory({ administration = false }: { administration?: boolean }) {
  const { data, isLoading, error, refetch } = useQuery<{ shifts: any[] }>({
    queryKey: [administration ? 'adminShiftHistory' : 'employeeShiftHistory'],
    queryFn: () => api.request(`/shifts/${administration ? 'admin/' : ''}history?limit=100`),
    refetchInterval: 60000,
  })
  useShiftUpdateListener(useCallback(() => { refetch() }, [refetch]))
  const rows = (data?.shifts || []).map(row => ({ ...row, ...(row.shift || {}), employee: row.employee }))
  const instant = (date: string, timezone: string) => new Date(date).toLocaleString('en-GB', { timeZone: timezone || 'UTC', dateStyle: 'medium', timeStyle: 'short' })
  return <Card>
    <CardHeader className="flex flex-row items-start justify-between gap-4">
      <div><CardTitle>Recorded shifts</CardTitle><CardDescription>Latest 100 shifts. Work time excludes breaks; notes do not change recorded start time.</CardDescription></div>
      <Button size="sm" variant="outline" onClick={() => refetch()}>Refresh</Button>
    </CardHeader>
    <CardContent>
      {error ? <p role="alert" className="text-sm text-red-600">{error.message}</p> : isLoading ? <p role="status">Loading shifts…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No recorded shifts yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <thead><tr className="border-b text-muted-foreground">{administration && <th className="p-2">Employee</th>}<th className="p-2">Start / finish</th><th className="p-2">Work</th><th className="p-2">Breaks</th><th className="p-2">Notes</th></tr></thead>
        <tbody>{rows.map(shift => <tr key={shift.id} className="border-b last:border-0 align-top">
          {administration && <td className="p-2">{shift.employee?.name}</td>}
          <td className="p-2 whitespace-nowrap"><div>{instant(shift.startTime, shift.timezone)}</div><div className="text-muted-foreground">{shift.endTime ? instant(shift.endTime, shift.timezone) : shift.status === 'on_break' ? 'On break' : 'In progress'}</div><div className="text-xs text-muted-foreground">{shift.timezone || 'UTC'}</div></td>
          <td className="p-2 whitespace-nowrap">{duration(shift.workingMinutes || 0)}</td><td className="p-2 whitespace-nowrap">{duration(shift.breakMinutes || 0)}</td>
          <td className="p-2 max-w-xs break-words"><div>{shift.notes || '—'}</div>{shift.breaks?.filter((b: any) => b.notes).map((b: any) => <div className="text-xs text-muted-foreground mt-1" key={b.id}>Break: {b.notes}</div>)}</td>
        </tr>)}</tbody>
      </table></div>}
    </CardContent>
  </Card>
}
