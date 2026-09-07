import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { EmploymentPolicyNotice, employmentLabels } from './EmploymentPolicyNotice'

type Kind = keyof typeof employmentLabels
export function CreateTeamMemberDialog({ open, onOpenChange, users, onCreated }: { open:boolean; onOpenChange:(open:boolean)=>void; users:Array<{id:number;fullName:string;email:string}>; onCreated:()=>Promise<void> }) {
  const [type,setType]=useState<Kind>('fulltime')
  const [userId,setUserId]=useState('')
  const [name,setName]=useState(''),[email,setEmail]=useState(''),[position,setPosition]=useState('')
  const [startDate,setStartDate]=useState(()=>new Date().toISOString().slice(0,10))
  const [saving,setSaving]=useState(false),[error,setError]=useState('')
  async function submit(event:React.FormEvent) {
    event.preventDefault();setSaving(true);setError('')
    try {
      await api.request('/admin/team-members',{method:'POST',body:JSON.stringify(type==='freelancer'?{employmentType:type,name,email,position,startDate}:{employmentType:type,userId:Number(userId)})})
      await onCreated();onOpenChange(false)
    } catch(error) {setError(error instanceof Error?error.message:'Unable to create team member')} finally {setSaving(false)}
  }
  return <Dialog open={open} onOpenChange={value=>{if(!saving)onOpenChange(value)}}><DialogContent role="dialog" aria-modal="true" aria-labelledby="create-team-title" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
    <DialogHeader><DialogTitle id="create-team-title">Add team member</DialogTitle><DialogDescription>Choose the employment type and add a team profile.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="new-employment-type">Employment type</Label><select id="new-employment-type" className="h-10 w-full rounded-md border bg-white px-3" value={type} onChange={e=>{setType(e.target.value as Kind);setError('')}}>{Object.entries(employmentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      <EmploymentPolicyNotice type={type}/>
      {type==='freelancer'?<>
        <div className="space-y-2"><Label htmlFor="freelancer-name">Name</Label><Input id="freelancer-name" required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="space-y-2"><Label htmlFor="freelancer-email">Contact email</Label><Input id="freelancer-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><p className="text-xs text-muted-foreground">Contact details only. No user account or invitation is created.</p></div>
        <div className="space-y-2"><Label htmlFor="freelancer-position">Position</Label><Input id="freelancer-position" placeholder="e.g. Designer" value={position} onChange={e=>setPosition(e.target.value)}/></div>
        <div className="space-y-2"><Label htmlFor="freelancer-start">Start date</Label><Input id="freelancer-start" type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
      </>:<div className="space-y-2"><Label htmlFor="new-member-user">User account</Label><select id="new-member-user" required className="h-10 w-full rounded-md border bg-white px-3" value={userId} onChange={e=>setUserId(e.target.value)}><option value="">Select a user</option>{users.map(user=><option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}</select>{!users.length&&<p className="text-sm text-muted-foreground">Create an employee user in Users first.</p>}</div>}
      {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="button" variant="outline" disabled={saving} onClick={()=>onOpenChange(false)} className="w-full">Cancel</Button>
      <Button type="submit" disabled={saving||(type!=='freelancer'&&!userId)} className="w-full">{saving?'Adding…':'Add team member'}</Button>
    </form>
  </DialogContent></Dialog>
}
