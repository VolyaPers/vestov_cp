/** Isolated UI fixture server. Never imported by production. No external calls. */
import {createRequire} from 'node:module'
const require=createRequire(new URL('../../server/package.json',import.meta.url))
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
if(!process.env.TEST_DATABASE_URL || !/^\/vestov_ui_test_/.test(new URL(process.env.TEST_DATABASE_URL).pathname) || !['localhost','127.0.0.1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname))throw new Error('Explicit disposable local UI test DB required')
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL
for(const key of ['SLACK_BOT_TOKEN','SENDGRID_API_KEY','INVITE_EMAIL_WEBHOOK_URL','EMAIL_WEBHOOK_URL','RESEND_WEBHOOK_URL','GOOGLE_CLIENT_SECRET','CLERK_SECRET_KEY'])process.env[key]=''
process.env.SLACK_NOTIFICATIONS_ENABLED='false'
process.env.UPLOADS_DIR=path.resolve('output/fix-2026-09-06/ui-uploads')
const {db,pool}=await import('../../server/src/db/index.js')
const s=await import('../../server/src/db/schema.js')
const {eq}=await import('drizzle-orm')
const express=require('express')
const session=require('express-session')
const passport=require('passport')
const {createServer}=await import('node:http')
const {setupPassport}=await import('../../server/src/auth/passport.js')
const app=express(),server=createServer(app)
app.use(express.json())
const sessionMiddleware=session({secret:randomUUID(),resave:false,saveUninitialized:false,name:'vestov.sid',cookie:{httpOnly:true,sameSite:'lax'}})
app.use(sessionMiddleware);setupPassport(pool);app.use(passport.initialize());app.use(passport.session())
const fixture=await (async()=> {
 try{return JSON.parse(await fs.readFile('output/fix-2026-09-06/ui-fixtures.json','utf8'))}catch{}
const today=new Date().toISOString().slice(0,10)
const [a,b]=await db.insert(s.clients).values([{name:'QA Acme',status:'active',email:'qa-client@example.test'},{name:'QA Other company',status:'active'}]).returning()
const [employee,second]=await db.insert(s.teamMembers).values([{name:'QA Anna Employee',email:'qa-anna@example.test',position:'Engineer',startDate:'2026-01-01',monthlyRate:'2000.00',timezone:'Europe/Kyiv',employmentType:'fulltime',isBillable:true},{name:'QA Ben Employee',email:'qa-ben@example.test',position:'Designer',startDate:'2025-01-01',monthlyRate:'1500.00',timezone:'Europe/Kyiv',employmentType:'fulltime',isBillable:true}]).returning()
const people=await db.insert(s.users).values([{username:'qa-admin',email:'qa-admin@example.test',fullName:'QA Admin',role:'admin',authProvider:'clerk'},{username:'qa-employee',email:employee.email,fullName:employee.name,role:'team_member',teamMemberId:employee.id,authProvider:'clerk'},{username:'qa-client',email:'qa-client@example.test',fullName:'QA Client',role:'client',authProvider:'clerk'},{username:'qa-outsider',email:'qa-outsider@example.test',fullName:'QA Outsider',role:'client',authProvider:'clerk'}]).returning()
const roles={admin:people[0],employee:people[1],client:people[2],outsider:people[3]}
await db.insert(s.clientUsers).values([{userId:roles.client.id,clientId:a.id,accessLevel:'write',assignedBy:roles.admin.id},{userId:roles.client.id,clientId:b.id,accessLevel:'read',assignedBy:roles.admin.id},{userId:roles.outsider.id,clientId:b.id,accessLevel:'read',assignedBy:roles.admin.id}])
const [type]=await db.insert(s.serviceTypes).values({name:'QA Development',category:'outstaffing',billingModel:'hourly'}).returning()
const services=await db.insert(s.clientServices).values([{clientId:a.id,serviceTypeId:type.id,serviceTitle:'QA Alpha',startDate:'2026-01-01',rate:'50'},{clientId:a.id,serviceTypeId:type.id,serviceTitle:'QA Beta',startDate:'2026-01-01',rate:'60'},{clientId:b.id,serviceTypeId:type.id,serviceTitle:'QA Other',startDate:'2026-01-01',rate:'70'}]).returning()
await db.insert(s.clientServiceTeamMembers).values([{clientServiceId:services[0].id,teamMemberId:employee.id,employmentType:'fulltime',startDate:'2026-01-01',hourlyRate:'50'},{clientServiceId:services[1].id,teamMemberId:employee.id,employmentType:'part_time',startDate:'2026-01-01',hourlyRate:'60'},{clientServiceId:services[0].id,teamMemberId:second.id,employmentType:'fulltime',startDate:'2026-01-01',hourlyRate:'45'}])
await db.insert(s.shiftSchedules).values([1,2,3,4,5].map(dayOfWeek=>({employeeId:employee.id,dayOfWeek,startTime:'09:00',endTime:'18:00',isActive:true})))
await db.insert(s.clientContacts).values({clientId:a.id,fullName:'QA Contact',email:'qa-contact@example.test',isPrimary:true})
await db.insert(s.leaveTypes).values([{name:'Vacation',isDeductible:true,halfDaySupported:true},{name:'Sick Leave',isDeductible:true,halfDaySupported:true},{name:'Personal Leave',isDeductible:true,halfDaySupported:true}]).onConflictDoNothing()
await fs.mkdir(path.join(process.env.UPLOADS_DIR,'documents'),{recursive:true})
await fs.writeFile(path.join(process.env.UPLOADS_DIR,'documents','qa.txt'),'Private QA document')
await db.insert(s.documents).values({name:'QA contract.txt',url:'/uploads/documents/qa.txt',userId:roles.admin.id,clientId:a.id,clientServiceId:services[0].id,visibleToClient:true})
await db.insert(s.invoices).values({invoiceNumber:'QA-2026-001',clientId:a.id,amount:'100.25',status:'sent',invoiceDate:today,periodStart:today.slice(0,7)+'-01',periodEnd:today,dueDate:today,createdBy:roles.admin.id})
return {roles,clients:[a,b],employeeIds:[employee.id,second.id],serviceIds:services.map(x=>x.id)}
})()
const roles=fixture.roles
process.env.WORKFLOW_OWNER_USER_IDS=String(roles.admin.id)
process.env.WORKFLOW_DEPUTY_USER_IDS=''
app.get('/api/__fixture__/as/:role',(req,res)=>{
 const user=roles[req.params.role as keyof typeof roles];if(!user)return res.sendStatus(404)
 req.login(user as any,error=>error?res.sendStatus(500):res.redirect(user.role==='admin'?'/admin/dashboard':user.role==='team_member'?'/employee/dashboard':'/client/dashboard'))
})
app.post('/api/__fixture__/logout',(req,res)=>req.logout(()=>res.json({ok:true})))
let summaryUnavailable = false
app.get('/api/__fixture__/summary/:state',(req,res)=>{
 if((req.user as any)?.role!=='admin')return res.sendStatus(403)
 summaryUnavailable=req.params.state==='unavailable'
 res.redirect('/admin/dashboard')
})
app.use('/api/admin/dashboard/summary',(_req,res,next)=>summaryUnavailable?res.status(503).json({error:'QA fixture: summary temporarily unavailable'}):next())
for(const [base,file,name] of [['','auth','authRouter'],['/admin','admin','adminRouter'],['/client','client','clientRouter'],['/services','services','servicesRouter'],['/invoices','invoice','invoiceRouter'],['/vacation','client-calendar','clientCalendarRouter'],['/vacation','vacation','default'],['/documents','documents','documentsRouter'],['/uploads','uploads','uploadsRouter'],['/client-contacts','client-contacts','clientContactsRouter'],['/users','users','default'],['/reimbursements','reimbursements','default'],['/roadmap','roadmap','default'],['/shifts','shifts','default'],['/feedback','feedback','feedbackRouter'],['/finances','finances','financesRouter'],['/settings','settings','settingsRouter'],['/search','search','searchRouter'],['/clickup','clickup','clickupRouter'],['/project-bot','project-bot','projectBotRouter'],['/workflow','workflow','workflowRouter']]){
 const module=await import(`../../server/src/routes/${file}.ts`);app.use('/api'+base,module[name])
}
app.use((error:any,_req:any,res:any,_next:any)=>{console.error(error.message);res.status(500).json({error:error.message})})
const {initializeSocket}=await import('../../server/src/socket.js');initializeSocket(server,['http://127.0.0.1:5178'],sessionMiddleware)
await fs.writeFile('output/fix-2026-09-06/ui-fixtures.json',JSON.stringify(fixture,null,2))
server.listen(3018,'127.0.0.1',()=>console.log('Isolated fixture backend ready. UI role entry: http://127.0.0.1:5178/api/__fixture__/as/admin'))
process.once('SIGTERM',()=>{server.close();pool.end();process.exit(0)})
