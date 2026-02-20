import { pgTable, foreignKey, serial, text, varchar, integer, timestamp, numeric, unique, boolean, date, jsonb, uniqueIndex, index, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const documents = pgTable("documents", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	type: varchar({ length: 50 }).notNull(),
	fileSize: integer("file_size"),
	url: text().notNull(),
	userId: integer("user_id"),
	clientId: integer("client_id"),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "documents_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "documents_client_id_clients_id_fk"
		}),
]);

export const feedback = pgTable("feedback", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	clientId: integer("client_id"),
	teamMemberId: integer("team_member_id"),
	rating: integer(),
	comments: text(),
	feedbackType: varchar("feedback_type", { length: 50 }),
	status: varchar({ length: 20 }).default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "feedback_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "feedback_client_id_clients_id_fk"
		}),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "feedback_team_member_id_team_members_id_fk"
		}),
]);

export const financialData = pgTable("financial_data", {
	id: serial().primaryKey().notNull(),
	month: integer().notNull(),
	year: integer().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	type: varchar({ length: 50 }).notNull(),
	category: text(),
	userId: integer("user_id"),
	clientId: integer("client_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "financial_data_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "financial_data_client_id_clients_id_fk"
		}),
]);

export const leaveBalances = pgTable("leave_balances", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	employmentCycleId: integer("employment_cycle_id").notNull(),
	leaveTypeId: integer("leave_type_id").notNull(),
	totalDays: numeric("total_days", { precision: 5, scale:  1 }).default('0').notNull(),
	adjustmentDays: numeric("adjustment_days", { precision: 5, scale:  1 }).default('0'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "leave_balances_employee_id_team_members_id_fk"
		}),
	foreignKey({
			columns: [table.employmentCycleId],
			foreignColumns: [employmentCycles.id],
			name: "leave_balances_employment_cycle_id_employment_cycles_id_fk"
		}),
	foreignKey({
			columns: [table.leaveTypeId],
			foreignColumns: [leaveTypes.id],
			name: "leave_balances_leave_type_id_leave_types_id_fk"
		}),
]);

export const leaveTypes = pgTable("leave_types", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	isDeductible: boolean("is_deductible").default(true),
	halfDaySupported: boolean("half_day_supported").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("leave_types_name_unique").on(table.name),
]);

export const leaveRequests = pgTable("leave_requests", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	leaveTypeId: integer("leave_type_id").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	halfDayStart: boolean("half_day_start").default(false),
	halfDayEnd: boolean("half_day_end").default(false),
	daysCount: numeric("days_count", { precision: 5, scale:  1 }).notNull(),
	reason: text(),
	requestedBy: integer("requested_by").notNull(),
	decisionBy: integer("decision_by"),
	decisionAt: timestamp("decision_at", { mode: 'string' }),
	decisionReason: text("decision_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "leave_requests_employee_id_team_members_id_fk"
		}),
	foreignKey({
			columns: [table.leaveTypeId],
			foreignColumns: [leaveTypes.id],
			name: "leave_requests_leave_type_id_leave_types_id_fk"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [users.id],
			name: "leave_requests_requested_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.decisionBy],
			foreignColumns: [users.id],
			name: "leave_requests_decision_by_users_id_fk"
		}),
]);

export const leaveRequestEvents = pgTable("leave_request_events", {
	id: serial().primaryKey().notNull(),
	leaveRequestId: integer("leave_request_id").notNull(),
	status: varchar({ length: 20 }).notNull(),
	actorId: integer("actor_id").notNull(),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.leaveRequestId],
			foreignColumns: [leaveRequests.id],
			name: "leave_request_events_leave_request_id_leave_requests_id_fk"
		}),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [users.id],
			name: "leave_request_events_actor_id_users_id_fk"
		}),
]);

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	senderId: integer("sender_id").notNull(),
	receiverId: integer("receiver_id").notNull(),
	read: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_sender_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.receiverId],
			foreignColumns: [users.id],
			name: "messages_receiver_id_users_id_fk"
		}),
]);

export const serviceRequests = pgTable("service_requests", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	requestDate: timestamp("request_date", { mode: 'string' }).defaultNow().notNull(),
	userId: integer("user_id").notNull(),
	responseDate: timestamp("response_date", { mode: 'string' }),
	responseMessage: text("response_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "service_requests_user_id_users_id_fk"
		}),
]);

export const timeEntries = pgTable("time_entries", {
	id: serial().primaryKey().notNull(),
	taskName: text("task_name").notNull(),
	hours: numeric({ precision: 5, scale:  2 }).notNull(),
	date: date().notNull(),
	userId: integer("user_id").notNull(),
	teamMemberId: integer("team_member_id"),
	billable: boolean().default(true),
	approved: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "time_entries_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "time_entries_team_member_id_team_members_id_fk"
		}),
]);

export const serviceTypes = pgTable("service_types", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	category: varchar({ length: 20 }).notNull(),
	billingModel: varchar("billing_model", { length: 20 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	invoiceDate: date("invoice_date").notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	description: text(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	dueDate: date("due_date"),
	paidAt: timestamp("paid_at", { mode: 'string' }),
	notes: text(),
	createdBy: integer("created_by").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "invoices_client_id_clients_id_fk"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "invoices_created_by_users_id_fk"
		}),
	unique("invoices_invoice_number_unique").on(table.invoiceNumber),
]);

export const invoiceServices = pgTable("invoice_services", {
	id: serial().primaryKey().notNull(),
	invoiceId: integer("invoice_id").notNull(),
	clientServiceId: integer("client_service_id").notNull(),
	serviceLevelPrice: numeric("service_level_price", { precision: 10, scale:  2 }),
	calculatedAmount: numeric("calculated_amount", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoices.id],
			name: "invoice_services_invoice_id_invoices_id_fk"
		}),
	foreignKey({
			columns: [table.clientServiceId],
			foreignColumns: [clientServices.id],
			name: "invoice_services_client_service_id_client_services_id_fk"
		}),
]);

export const invoiceDevelopers = pgTable("invoice_developers", {
	id: serial().primaryKey().notNull(),
	invoiceServiceId: integer("invoice_service_id").notNull(),
	clientServiceTeamMemberId: integer("client_service_team_member_id").notNull(),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	fixedPrice: numeric("fixed_price", { precision: 10, scale:  2 }),
	hoursWorked: numeric("hours_worked", { precision: 8, scale:  2 }),
	calculatedAmount: numeric("calculated_amount", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoiceServiceId],
			foreignColumns: [invoiceServices.id],
			name: "invoice_developers_invoice_service_id_invoice_services_id_fk"
		}),
	foreignKey({
			columns: [table.clientServiceTeamMemberId],
			foreignColumns: [clientServiceTeamMembers.id],
			name: "invoice_developers_client_service_team_member_id_fkey"
		}).onDelete("cascade"),
]);

export const leaveAllocationSettings = pgTable("leave_allocation_settings", {
	id: serial().primaryKey().notNull(),
	cycleNumber: integer("cycle_number").notNull(),
	leaveTypeId: integer("leave_type_id").notNull(),
	allocatedDays: numeric("allocated_days", { precision: 5, scale:  1 }).notNull(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.leaveTypeId],
			foreignColumns: [leaveTypes.id],
			name: "leave_allocation_settings_leave_type_id_leave_types_id_fk"
		}),
]);

export const clientContacts = pgTable("client_contacts", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	fullName: text("full_name").notNull(),
	position: text(),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	notes: text(),
	isPrimary: boolean("is_primary").default(false),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "client_contacts_client_id_clients_id_fk"
		}),
]);

export const teamMembers = pgTable("team_members", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	role: text().notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 20 }),
	skills: jsonb(),
	bio: text(),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	monthlyRate: numeric("monthly_rate", { precision: 10, scale:  2 }),
	status: varchar({ length: 20 }).default('active').notNull(),
	clientId: integer("client_id"),
	startDate: date("start_date").notNull(),
	location: text(),
	timezone: text(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isBillable: boolean("is_billable").default(true).notNull(),
	employmentType: varchar("employment_type", { length: 20 }).default('fulltime'),
	position: text(),
	isDeveloper: boolean("is_developer").default(false).notNull(),
	showOnCalendar: boolean("show_on_calendar").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "team_members_client_id_clients_id_fk"
		}),
	unique("team_members_email_unique").on(table.email),
]);

export const clientUsers = pgTable("client_users", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	userId: integer("user_id").notNull(),
	accessLevel: varchar("access_level", { length: 20 }).default('read').notNull(),
	isActive: boolean("is_active").default(true),
	assignedBy: integer("assigned_by").notNull(),
	assignedAt: timestamp("assigned_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("client_users_client_id_user_id_unique").using("btree", table.clientId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "client_users_client_id_clients_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "client_users_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assignedBy],
			foreignColumns: [users.id],
			name: "client_users_assigned_by_users_id_fk"
		}),
]);

export const reimbursementRequests = pgTable("reimbursement_requests", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	year: integer().notNull(),
	expenseAmount: numeric("expense_amount", { precision: 10, scale:  2 }).notNull(),
	reimbursementAmount: numeric("reimbursement_amount", { precision: 10, scale:  2 }).notNull(),
	description: text().notNull(),
	category: varchar({ length: 50 }),
	status: varchar({ length: 20 }).default('pending').notNull(),
	requestedBy: integer("requested_by").notNull(),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow().notNull(),
	approvedBy: integer("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	approvalNote: text("approval_note"),
	evidenceUrl: text("evidence_url"),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	careerYear: integer("career_year").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "reimbursement_requests_employee_id_team_members_id_fk"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [users.id],
			name: "reimbursement_requests_requested_by_users_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "reimbursement_requests_approved_by_users_id_fk"
		}),
]);

export const employmentCycles = pgTable("employment_cycles", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	cycleStart: date("cycle_start").notNull(),
	cycleEnd: date("cycle_end").notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	cycleMidpoint: date("cycle_midpoint").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "employment_cycles_employee_id_team_members_id_fk"
		}),
]);

export const clients = pgTable("clients", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	industry: text(),
	contactPerson: text("contact_person"),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	address: text(),
	status: varchar({ length: 20 }).default('active').notNull(),
	contractType: varchar("contract_type", { length: 20 }).notNull(),
	contractStart: date("contract_start"),
	contractEnd: date("contract_end"),
	billingRate: numeric("billing_rate", { precision: 10, scale:  2 }),
	billingCycle: varchar("billing_cycle", { length: 20 }),
	activeServices: jsonb("active_services"),
	teamSize: integer("team_size").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	logoUrl: text("logo_url"),
});

export const shiftSchedules = pgTable("shift_schedules", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	dayOfWeek: integer("day_of_week").notNull(),
	startTime: varchar("start_time", { length: 5 }).notNull(),
	endTime: varchar("end_time", { length: 5 }).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("shift_schedules_employee_id_idx").using("btree", table.employeeId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "shift_schedules_employee_id_fkey"
		}),
]);

export const shiftScheduleOverrides = pgTable("shift_schedule_overrides", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	overrideDate: date("override_date").notNull(),
	startTime: varchar("start_time", { length: 5 }).notNull(),
	endTime: varchar("end_time", { length: 5 }).notNull(),
	isDayOff: boolean("is_day_off").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "shift_schedule_overrides_employee_id_fkey"
		}),
	unique("shift_schedule_overrides_employee_id_override_date_key").on(table.employeeId, table.overrideDate),
]);

export const scriptExecutionLog = pgTable("script_execution_log", {
	id: serial().primaryKey().notNull(),
	scriptName: varchar("script_name", { length: 255 }).notNull(),
	executedAt: timestamp("executed_at", { mode: 'string' }).defaultNow(),
	status: varchar({ length: 50 }).notNull(),
}, (table) => [
	unique("script_execution_log_script_name_key").on(table.scriptName),
]);

export const shiftBreaks = pgTable("shift_breaks", {
	id: serial().primaryKey().notNull(),
	shiftId: integer("shift_id").notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	breakType: varchar("break_type", { length: 20 }).default('regular'),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("shift_breaks_shift_id_idx").using("btree", table.shiftId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "shift_breaks_shift_id_fkey"
		}),
]);

export const userInvites = pgTable("user_invites", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	email: varchar({ length: 255 }).notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	createdBy: integer("created_by"),
	source: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_invites_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("user_invites_user_id_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_invites_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "user_invites_created_by_fkey"
		}),
	unique("user_invites_token_hash_key").on(table.tokenHash),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	password: text(),
	fullName: text("full_name").notNull(),
	email: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 20 }).default('client').notNull(),
	position: text(),
	avatarUrl: text("avatar_url"),
	timezone: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	isActive: boolean("is_active").default(true),
	lastLoginAt: timestamp("last_login_at", { mode: 'string' }),
	teamMemberId: integer("team_member_id"),
	googleId: varchar("google_id", { length: 255 }),
	authProvider: varchar("auth_provider", { length: 50 }),
}, (table) => [
	index("idx_users_auth_provider").using("btree", table.authProvider.asc().nullsLast().op("text_ops")),
	index("idx_users_google_id").using("btree", table.googleId.asc().nullsLast().op("text_ops")),
	index("idx_users_team_member_id").using("btree", table.teamMemberId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "users_team_member_id_fk"
		}).onDelete("set null"),
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
	unique("users_google_id_key").on(table.googleId),
]);

export const shifts = pgTable("shifts", {
	id: serial().primaryKey().notNull(),
	employeeId: integer("employee_id").notNull(),
	scheduleId: integer("schedule_id"),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }),
	status: varchar({ length: 20 }).default('active').notNull(),
	isLate: boolean("is_late").default(false),
	lateMinutes: integer("late_minutes").default(0),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	serviceId: integer("service_id"),
}, (table) => [
	index("idx_shifts_service_id").using("btree", table.serviceId.asc().nullsLast().op("int4_ops")),
	index("shifts_employee_id_idx").using("btree", table.employeeId.asc().nullsLast().op("int4_ops")),
	index("shifts_start_time_idx").using("btree", table.startTime.asc().nullsLast().op("timestamp_ops")),
	index("shifts_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [teamMembers.id],
			name: "shifts_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [shiftSchedules.id],
			name: "shifts_schedule_id_fkey"
		}),
	foreignKey({
			columns: [table.serviceId],
			foreignColumns: [clientServices.id],
			name: "shifts_service_id_fkey"
		}),
]);

export const userSessions = pgTable("user_sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const clientServiceTeamMembers = pgTable("client_service_team_members", {
	id: serial().primaryKey().notNull(),
	clientServiceId: integer("client_service_id").notNull(),
	teamMemberId: integer("team_member_id").notNull(),
	employmentType: varchar("employment_type", { length: 20 }).notNull(),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	fixedPrice: numeric("fixed_price", { precision: 10, scale:  2 }),
	isActive: boolean("is_active").default(true),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	workSchedule: jsonb("work_schedule"),
}, (table) => [
	foreignKey({
			columns: [table.clientServiceId],
			foreignColumns: [clientServices.id],
			name: "client_service_developers_client_service_id_client_services_id_"
		}),
	foreignKey({
			columns: [table.teamMemberId],
			foreignColumns: [teamMembers.id],
			name: "client_service_team_members_team_member_id_fkey"
		}).onDelete("cascade"),
]);

export const clientServices = pgTable("client_services", {
	id: serial().primaryKey().notNull(),
	clientId: integer("client_id").notNull(),
	serviceTypeId: integer("service_type_id").notNull(),
	rate: numeric({ precision: 10, scale:  2 }),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	serviceLevelPrice: numeric("service_level_price", { precision: 10, scale:  2 }),
	slackChannelId: varchar("slack_channel_id", { length: 255 }),
	serviceTitle: text("service_title"),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "client_services_client_id_clients_id_fk"
		}),
	foreignKey({
			columns: [table.serviceTypeId],
			foreignColumns: [serviceTypes.id],
			name: "client_services_service_type_id_service_types_id_fk"
		}),
]);
