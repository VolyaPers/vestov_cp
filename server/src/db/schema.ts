import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  date,
  jsonb,
  varchar,
} from 'drizzle-orm/pg-core'

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  password: text('password'), // Nullable for OAuth-only users
  fullName: text('full_name').notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  role: varchar('role', { length: 20 }).notNull().default('client'), // 'admin' | 'team_member' | 'client'
  position: text('position'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone'), // IANA timezone e.g. "America/New_York"
  teamMemberId: integer('team_member_id'), // Foreign key to team_members table (for role='team_member')
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  authProvider: varchar('auth_provider', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Clients table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  contactPerson: text('contact_person'),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'inactive'
  contractType: varchar('contract_type', { length: 20 }), // 'outstaffing' | 'outsourcing' | optional
  contractStart: date('contract_start'),
  contractEnd: date('contract_end'),
  billingRate: decimal('billing_rate', { precision: 10, scale: 2 }),
  billingCycle: varchar('billing_cycle', { length: 20 }), // 'monthly' | 'weekly' | 'hourly'
  activeServices: jsonb('active_services'),
  teamSize: integer('team_size').default(0),
  logoUrl: text('logo_url'), // URL to client logo
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Team Members table
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 20 }),
  skills: jsonb('skills'), // array of strings
  bio: text('bio'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }), // base rate
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),
  isBillable: boolean('is_billable').notNull().default(true), // true for developers/devops, false for HR/PM/internal
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'bench' | 'active'
  clientId: integer('client_id').references(() => clients.id),
  startDate: date('start_date').notNull(),
  location: text('location'),
  timezone: text('timezone'), // IANA timezone e.g. "Europe/Kyiv"
  avatarUrl: text('avatar_url'),
  position: text('position'),
  isDeveloper: boolean('is_developer').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Service Types table
export const serviceTypes = pgTable('service_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: varchar('category', { length: 20 }).notNull(), // 'outstaffing' | 'outsourcing'
  billingModel: varchar('billing_model', { length: 20 }).notNull(), // 'hourly' | 'monthly' | 'fixed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Client Services junction table
export const clientServices = pgTable('client_services', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  serviceTypeId: integer('service_type_id').references(() => serviceTypes.id).notNull(),
  rate: decimal('rate', { precision: 10, scale: 2 }),
  serviceLevelPrice: decimal('service_level_price', { precision: 10, scale: 2 }), // Optional service-level pricing
  serviceTitle: text('service_title'), // Optional friendly name for the service
  slackChannelId: varchar('slack_channel_id', { length: 255 }), // Slack channel ID for shift notifications
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Document Folders table (for organizing documents by service)
export const documentFolders = pgTable('document_folders', {
  id: serial('id').primaryKey(),
  clientServiceId: integer('client_service_id').references(() => clientServices.id).notNull(),
  name: text('name').notNull(),
  parentFolderId: integer('parent_folder_id'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Documents table
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  documentTitle: text('document_title'), // Optional user-friendly title
  type: varchar('type', { length: 50 }), // Document type (optional)
  fileSize: integer('file_size'),
  url: text('url').notNull(),
  userId: integer('user_id').references(() => users.id),
  clientId: integer('client_id').references(() => clients.id),
  clientServiceId: integer('client_service_id').references(() => clientServices.id),
  folderId: integer('folder_id').references(() => documentFolders.id),
  visibleToClient: boolean('visible_to_client').default(false).notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Client Contacts table
export const clientContacts = pgTable('client_contacts', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  fullName: text('full_name').notNull(),
  position: text('position'),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  notes: text('notes'),
  isPrimary: boolean('is_primary').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Time Entries table
export const timeEntries = pgTable('time_entries', {
  id: serial('id').primaryKey(),
  taskName: text('task_name').notNull(),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
  date: date('date').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  teamMemberId: integer('team_member_id').references(() => teamMembers.id),
  billable: boolean('billable').default(true),
  approved: boolean('approved').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  senderId: integer('sender_id').references(() => users.id).notNull(),
  receiverId: integer('receiver_id').references(() => users.id).notNull(),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Service Requests table
export const serviceRequests = pgTable('service_requests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'denied'
  requestDate: timestamp('request_date').defaultNow().notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  responseDate: timestamp('response_date'),
  responseMessage: text('response_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Financial Data table
export const financialData = pgTable('financial_data', {
  id: serial('id').primaryKey(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'revenue' | 'expense' | 'budget'
  category: text('category'),
  userId: integer('user_id').references(() => users.id),
  clientId: integer('client_id').references(() => clients.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Financial Transactions table
export const financialTransactions = pgTable('financial_transactions', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull(), // 'income' | 'expense' | 'salary' | 'extra_payment'
  category: text('category'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  transactionDate: date('transaction_date').notNull(),
  teamMemberId: integer('team_member_id').references(() => teamMembers.id),
  clientId: integer('client_id').references(() => clients.id),
  invoiceId: integer('invoice_id').references(() => invoices.id),
  isRecurring: boolean('is_recurring').default(false),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Integration Settings table
export const integrationSettings = pgTable('integration_settings', {
  id: serial('id').primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull().unique(), // 'stripe', 'payoneer'
  credentials: text('credentials').notNull().default(''), // AES-256-GCM encrypted JSON
  isActive: boolean('is_active').default(false),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Salary Rate History table
export const salaryRateHistory = pgTable('salary_rate_history', {
  id: serial('id').primaryKey(),
  teamMemberId: integer('team_member_id').references(() => teamMembers.id).notNull(),
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  note: text('note'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Feedback table
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  clientId: integer('client_id').references(() => clients.id),
  clientServiceId: integer('client_service_id').references(() => clientServices.id),
  teamMemberId: integer('team_member_id').references(() => teamMembers.id),
  rating: integer('rating'), // 1-5 scale
  comments: text('comments'),
  feedbackType: varchar('feedback_type', { length: 50 }), // 'general' | 'team_member'
  status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'reviewed'
  adminResponse: text('admin_response'),
  adminRespondedBy: integer('admin_responded_by').references(() => users.id),
  adminRespondedAt: timestamp('admin_responded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Employment Cycles table
export const employmentCycles = pgTable('employment_cycles', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  cycleStart: date('cycle_start').notNull(),
  cycleEnd: date('cycle_end').notNull(),
  cycleMidpoint: date('cycle_midpoint').notNull(), // For 50/50 vacation split
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Leave Types table
export const leaveTypes = pgTable('leave_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isDeductible: boolean('is_deductible').default(true),
  halfDaySupported: boolean('half_day_supported').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Leave Balances table
export const leaveBalances = pgTable('leave_balances', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  employmentCycleId: integer('employment_cycle_id').references(() => employmentCycles.id).notNull(),
  leaveTypeId: integer('leave_type_id').references(() => leaveTypes.id).notNull(),
  totalDays: decimal('total_days', { precision: 5, scale: 1 }).notNull().default('0'),
  adjustmentDays: decimal('adjustment_days', { precision: 5, scale: 1 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Leave Requests table
export const leaveRequests = pgTable('leave_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  leaveTypeId: integer('leave_type_id').references(() => leaveTypes.id).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'denied' | 'canceled'
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  halfDayStart: boolean('half_day_start').default(false),
  halfDayEnd: boolean('half_day_end').default(false),
  daysCount: decimal('days_count', { precision: 5, scale: 1 }).notNull(),
  reason: text('reason'),
  requestedBy: integer('requested_by').references(() => users.id).notNull(),
  decisionBy: integer('decision_by').references(() => users.id),
  decisionAt: timestamp('decision_at'),
  decisionReason: text('decision_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Leave Request Events table (Audit Trail)
export const leaveRequestEvents = pgTable('leave_request_events', {
  id: serial('id').primaryKey(),
  leaveRequestId: integer('leave_request_id').references(() => leaveRequests.id).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  actorId: integer('actor_id').references(() => users.id).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Workspace Reimbursement Requests table
export const reimbursementRequests = pgTable('reimbursement_requests', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  year: integer('year').notNull(), // Calendar year for the request
  careerYear: integer('career_year').notNull(), // Career year (1-based) when the request was made
  expenseAmount: decimal('expense_amount', { precision: 10, scale: 2 }).notNull(), // Total expense
  reimbursementAmount: decimal('reimbursement_amount', { precision: 10, scale: 2 }).notNull(), // 50% of expense, capped
  description: text('description').notNull(), // What was purchased
  category: varchar('category', { length: 50 }), // e.g., 'laptop', 'desk', 'chair', etc.
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'confirmed'
  requestedBy: integer('requested_by').references(() => users.id).notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  approvalNote: text('approval_note'),
  evidenceUrl: text('evidence_url'), // URL to uploaded receipt/product image
  confirmedAt: timestamp('confirmed_at'), // When employee confirmed with evidence
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Client Service Team Members junction table (formerly clientServiceDevelopers)
export const clientServiceTeamMembers = pgTable('client_service_team_members', {
  id: serial('id').primaryKey(),
  clientServiceId: integer('client_service_id').references(() => clientServices.id).notNull(),
  teamMemberId: integer('team_member_id').references(() => teamMembers.id).notNull(),
  employmentType: varchar('employment_type', { length: 20 }).notNull(), // 'fulltime' | 'part_time'
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  fixedPrice: decimal('fixed_price', { precision: 10, scale: 2 }),
  workSchedule: jsonb('work_schedule'), // {"monday": "full", "tuesday": "full", "wednesday": "half", "thursday": "off", "friday": "full", "saturday": "off", "sunday": "off"}
  isActive: boolean('is_active').default(true),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Invoices table
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).unique().notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Invoice Services table (what services are included in each invoice)
export const invoiceServices = pgTable('invoice_services', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id).notNull(),
  clientServiceId: integer('client_service_id').references(() => clientServices.id).notNull(),
  serviceLevelPrice: decimal('service_level_price', { precision: 10, scale: 2 }),
  calculatedAmount: decimal('calculated_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Invoice Developers table (which developers worked on invoiced services)
export const invoiceDevelopers = pgTable('invoice_developers', {
  id: serial('id').primaryKey(),
  invoiceServiceId: integer('invoice_service_id').references(() => invoiceServices.id).notNull(),
  clientServiceTeamMemberId: integer('client_service_team_member_id').references(() => clientServiceTeamMembers.id).notNull(),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  fixedPrice: decimal('fixed_price', { precision: 10, scale: 2 }),
  hoursWorked: decimal('hours_worked', { precision: 8, scale: 2 }),
  calculatedAmount: decimal('calculated_amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Leave Allocation Settings table (cycle-based leave allocations)
export const leaveAllocationSettings = pgTable('leave_allocation_settings', {
  id: serial('id').primaryKey(),
  cycleNumber: integer('cycle_number').notNull(), // 1st cycle, 2nd cycle, 3rd cycle, etc.
  leaveTypeId: integer('leave_type_id').references(() => leaveTypes.id).notNull(),
  allocatedDays: decimal('allocated_days', { precision: 5, scale: 1 }).notNull(),
  isDefault: boolean('is_default').default(false), // marks the default allocation for cycles beyond configured ones
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Client Users table (many-to-many relationship between users and clients)
export const clientUsers = pgTable('client_users', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  accessLevel: varchar('access_level', { length: 20 }).notNull().default('read'), // 'read' | 'write' | 'admin'
  isActive: boolean('is_active').default(true),
  assignedBy: integer('assigned_by').references(() => users.id).notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Shift Schedules table (expected work schedules for employees)
export const shiftSchedules = pgTable('shift_schedules', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: varchar('start_time', { length: 5 }).notNull(), // Format: "HH:MM" (e.g., "09:00")
  endTime: varchar('end_time', { length: 5 }).notNull(), // Format: "HH:MM" (e.g., "18:00")
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Shift Schedule Overrides table (day-specific shift time overrides)
export const shiftScheduleOverrides = pgTable('shift_schedule_overrides', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  overrideDate: varchar('override_date', { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  isDayOff: boolean('is_day_off').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Shifts table (actual work shifts logged by employees)
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id').references(() => teamMembers.id).notNull(),
  scheduleId: integer('schedule_id').references(() => shiftSchedules.id), // Optional reference to expected schedule
  serviceId: integer('service_id').references(() => clientServices.id), // Service this shift is for (determines Slack channel)
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'), // Null if shift is still active
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active' | 'on_break' | 'completed'
  isLate: boolean('is_late').default(false), // True if started late according to schedule
  lateMinutes: integer('late_minutes').default(0), // How many minutes late
  notes: text('notes'), // Optional notes about the shift
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Shift Breaks table (breaks during a shift)
export const shiftBreaks = pgTable('shift_breaks', {
  id: serial('id').primaryKey(),
  shiftId: integer('shift_id').references(() => shifts.id).notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'), // Null if break is still active
  breakType: varchar('break_type', { length: 20 }).default('regular'), // 'regular' | 'lunch' | 'other'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})