export const employmentLabels = { fulltime: 'Full-time', part_time: 'Part-time', freelancer: 'Freelancer' } as const
export function EmploymentPolicyNotice({ type = 'fulltime' }: { type?: string }) {
  return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
    {type === 'freelancer'
      ? 'Freelancer: no portal account, invitations, monthly salary or employee benefits. Add project fees and record payments in this profile. Settle open salary periods and reimbursements before switching; any existing employee account will be disabled.'
      : type === 'part_time'
        ? 'Part-time: enter the actual monthly salary. Bonuses, paid leave, sick leave, personal days and reimbursement benefits are 50% of full-time. Converting from Freelancer creates or restores portal access and keeps previous project-payment history.'
        : 'Full-time: standard salary and employee benefits.'}
  </p>
}
