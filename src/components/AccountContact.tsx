import { Mail, MessageCircle, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export function AccountContact() {
  const link = 'flex items-center gap-3 py-1 text-sm font-medium text-primary hover:underline'
  return <Card><CardHeader><CardDescription>Your point of contact</CardDescription>
    <CardTitle>Volodymyr Shapovalov</CardTitle></CardHeader>
    <CardContent className="grid gap-2"><p className="mb-1 text-sm text-muted-foreground">Contact Vova about your team, schedule or invoices.</p>
      <a className={link} href="https://app.slack.com/team/U0738UZ8K9P" target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>Message Vova on Vestov Slack</a>
      <a className={link} href="tel:+380501420852"><Phone size={16}/>+380 50 142 08 52</a>
      <a className={link} href="mailto:v@vestov.com"><Mail size={16}/>v@vestov.com</a>
    </CardContent></Card>
}
