import { relations } from "drizzle-orm/relations";
import { users, documents, clients, feedback, teamMembers, financialData, leaveBalances, employmentCycles, leaveTypes, leaveRequests, leaveRequestEvents, messages, serviceRequests, timeEntries, invoices, invoiceServices, clientServices, invoiceDevelopers, clientServiceTeamMembers, leaveAllocationSettings, clientContacts, clientUsers, reimbursementRequests, shiftSchedules, shifts, shiftBreaks, userInvites, serviceTypes } from "./schema";

export const documentsRelations = relations(documents, ({one}) => ({
	user: one(users, {
		fields: [documents.userId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [documents.clientId],
		references: [clients.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	documents: many(documents),
	feedbacks: many(feedback),
	financialData: many(financialData),
	leaveRequests_requestedBy: many(leaveRequests, {
		relationName: "leaveRequests_requestedBy_users_id"
	}),
	leaveRequests_decisionBy: many(leaveRequests, {
		relationName: "leaveRequests_decisionBy_users_id"
	}),
	leaveRequestEvents: many(leaveRequestEvents),
	messages_senderId: many(messages, {
		relationName: "messages_senderId_users_id"
	}),
	messages_receiverId: many(messages, {
		relationName: "messages_receiverId_users_id"
	}),
	serviceRequests: many(serviceRequests),
	timeEntries: many(timeEntries),
	invoices: many(invoices),
	clientUsers_userId: many(clientUsers, {
		relationName: "clientUsers_userId_users_id"
	}),
	clientUsers_assignedBy: many(clientUsers, {
		relationName: "clientUsers_assignedBy_users_id"
	}),
	reimbursementRequests_requestedBy: many(reimbursementRequests, {
		relationName: "reimbursementRequests_requestedBy_users_id"
	}),
	reimbursementRequests_approvedBy: many(reimbursementRequests, {
		relationName: "reimbursementRequests_approvedBy_users_id"
	}),
	userInvites_userId: many(userInvites, {
		relationName: "userInvites_userId_users_id"
	}),
	userInvites_createdBy: many(userInvites, {
		relationName: "userInvites_createdBy_users_id"
	}),
	teamMember: one(teamMembers, {
		fields: [users.teamMemberId],
		references: [teamMembers.id]
	}),
}));

export const clientsRelations = relations(clients, ({many}) => ({
	documents: many(documents),
	feedbacks: many(feedback),
	financialData: many(financialData),
	invoices: many(invoices),
	clientContacts: many(clientContacts),
	teamMembers: many(teamMembers),
	clientUsers: many(clientUsers),
	clientServices: many(clientServices),
}));

export const feedbackRelations = relations(feedback, ({one}) => ({
	user: one(users, {
		fields: [feedback.userId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [feedback.clientId],
		references: [clients.id]
	}),
	teamMember: one(teamMembers, {
		fields: [feedback.teamMemberId],
		references: [teamMembers.id]
	}),
}));

export const teamMembersRelations = relations(teamMembers, ({one, many}) => ({
	feedbacks: many(feedback),
	leaveBalances: many(leaveBalances),
	leaveRequests: many(leaveRequests),
	timeEntries: many(timeEntries),
	client: one(clients, {
		fields: [teamMembers.clientId],
		references: [clients.id]
	}),
	reimbursementRequests: many(reimbursementRequests),
	employmentCycles: many(employmentCycles),
	shiftSchedules: many(shiftSchedules),
	users: many(users),
	shifts: many(shifts),
	clientServiceTeamMembers: many(clientServiceTeamMembers),
}));

export const financialDataRelations = relations(financialData, ({one}) => ({
	user: one(users, {
		fields: [financialData.userId],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [financialData.clientId],
		references: [clients.id]
	}),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({one}) => ({
	teamMember: one(teamMembers, {
		fields: [leaveBalances.employeeId],
		references: [teamMembers.id]
	}),
	employmentCycle: one(employmentCycles, {
		fields: [leaveBalances.employmentCycleId],
		references: [employmentCycles.id]
	}),
	leaveType: one(leaveTypes, {
		fields: [leaveBalances.leaveTypeId],
		references: [leaveTypes.id]
	}),
}));

export const employmentCyclesRelations = relations(employmentCycles, ({one, many}) => ({
	leaveBalances: many(leaveBalances),
	teamMember: one(teamMembers, {
		fields: [employmentCycles.employeeId],
		references: [teamMembers.id]
	}),
}));

export const leaveTypesRelations = relations(leaveTypes, ({many}) => ({
	leaveBalances: many(leaveBalances),
	leaveRequests: many(leaveRequests),
	leaveAllocationSettings: many(leaveAllocationSettings),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({one, many}) => ({
	teamMember: one(teamMembers, {
		fields: [leaveRequests.employeeId],
		references: [teamMembers.id]
	}),
	leaveType: one(leaveTypes, {
		fields: [leaveRequests.leaveTypeId],
		references: [leaveTypes.id]
	}),
	user_requestedBy: one(users, {
		fields: [leaveRequests.requestedBy],
		references: [users.id],
		relationName: "leaveRequests_requestedBy_users_id"
	}),
	user_decisionBy: one(users, {
		fields: [leaveRequests.decisionBy],
		references: [users.id],
		relationName: "leaveRequests_decisionBy_users_id"
	}),
	leaveRequestEvents: many(leaveRequestEvents),
}));

export const leaveRequestEventsRelations = relations(leaveRequestEvents, ({one}) => ({
	leaveRequest: one(leaveRequests, {
		fields: [leaveRequestEvents.leaveRequestId],
		references: [leaveRequests.id]
	}),
	user: one(users, {
		fields: [leaveRequestEvents.actorId],
		references: [users.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	user_senderId: one(users, {
		fields: [messages.senderId],
		references: [users.id],
		relationName: "messages_senderId_users_id"
	}),
	user_receiverId: one(users, {
		fields: [messages.receiverId],
		references: [users.id],
		relationName: "messages_receiverId_users_id"
	}),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({one}) => ({
	user: one(users, {
		fields: [serviceRequests.userId],
		references: [users.id]
	}),
}));

export const timeEntriesRelations = relations(timeEntries, ({one}) => ({
	user: one(users, {
		fields: [timeEntries.userId],
		references: [users.id]
	}),
	teamMember: one(teamMembers, {
		fields: [timeEntries.teamMemberId],
		references: [teamMembers.id]
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	client: one(clients, {
		fields: [invoices.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [invoices.createdBy],
		references: [users.id]
	}),
	invoiceServices: many(invoiceServices),
}));

export const invoiceServicesRelations = relations(invoiceServices, ({one, many}) => ({
	invoice: one(invoices, {
		fields: [invoiceServices.invoiceId],
		references: [invoices.id]
	}),
	clientService: one(clientServices, {
		fields: [invoiceServices.clientServiceId],
		references: [clientServices.id]
	}),
	invoiceDevelopers: many(invoiceDevelopers),
}));

export const clientServicesRelations = relations(clientServices, ({one, many}) => ({
	invoiceServices: many(invoiceServices),
	shifts: many(shifts),
	clientServiceTeamMembers: many(clientServiceTeamMembers),
	client: one(clients, {
		fields: [clientServices.clientId],
		references: [clients.id]
	}),
	serviceType: one(serviceTypes, {
		fields: [clientServices.serviceTypeId],
		references: [serviceTypes.id]
	}),
}));

export const invoiceDevelopersRelations = relations(invoiceDevelopers, ({one}) => ({
	invoiceService: one(invoiceServices, {
		fields: [invoiceDevelopers.invoiceServiceId],
		references: [invoiceServices.id]
	}),
	clientServiceTeamMember: one(clientServiceTeamMembers, {
		fields: [invoiceDevelopers.clientServiceTeamMemberId],
		references: [clientServiceTeamMembers.id]
	}),
}));

export const clientServiceTeamMembersRelations = relations(clientServiceTeamMembers, ({one, many}) => ({
	invoiceDevelopers: many(invoiceDevelopers),
	clientService: one(clientServices, {
		fields: [clientServiceTeamMembers.clientServiceId],
		references: [clientServices.id]
	}),
	teamMember: one(teamMembers, {
		fields: [clientServiceTeamMembers.teamMemberId],
		references: [teamMembers.id]
	}),
}));

export const leaveAllocationSettingsRelations = relations(leaveAllocationSettings, ({one}) => ({
	leaveType: one(leaveTypes, {
		fields: [leaveAllocationSettings.leaveTypeId],
		references: [leaveTypes.id]
	}),
}));

export const clientContactsRelations = relations(clientContacts, ({one}) => ({
	client: one(clients, {
		fields: [clientContacts.clientId],
		references: [clients.id]
	}),
}));

export const clientUsersRelations = relations(clientUsers, ({one}) => ({
	client: one(clients, {
		fields: [clientUsers.clientId],
		references: [clients.id]
	}),
	user_userId: one(users, {
		fields: [clientUsers.userId],
		references: [users.id],
		relationName: "clientUsers_userId_users_id"
	}),
	user_assignedBy: one(users, {
		fields: [clientUsers.assignedBy],
		references: [users.id],
		relationName: "clientUsers_assignedBy_users_id"
	}),
}));

export const reimbursementRequestsRelations = relations(reimbursementRequests, ({one}) => ({
	teamMember: one(teamMembers, {
		fields: [reimbursementRequests.employeeId],
		references: [teamMembers.id]
	}),
	user_requestedBy: one(users, {
		fields: [reimbursementRequests.requestedBy],
		references: [users.id],
		relationName: "reimbursementRequests_requestedBy_users_id"
	}),
	user_approvedBy: one(users, {
		fields: [reimbursementRequests.approvedBy],
		references: [users.id],
		relationName: "reimbursementRequests_approvedBy_users_id"
	}),
}));

export const shiftSchedulesRelations = relations(shiftSchedules, ({one, many}) => ({
	teamMember: one(teamMembers, {
		fields: [shiftSchedules.employeeId],
		references: [teamMembers.id]
	}),
	shifts: many(shifts),
}));

export const shiftBreaksRelations = relations(shiftBreaks, ({one}) => ({
	shift: one(shifts, {
		fields: [shiftBreaks.shiftId],
		references: [shifts.id]
	}),
}));

export const shiftsRelations = relations(shifts, ({one, many}) => ({
	shiftBreaks: many(shiftBreaks),
	teamMember: one(teamMembers, {
		fields: [shifts.employeeId],
		references: [teamMembers.id]
	}),
	shiftSchedule: one(shiftSchedules, {
		fields: [shifts.scheduleId],
		references: [shiftSchedules.id]
	}),
	clientService: one(clientServices, {
		fields: [shifts.serviceId],
		references: [clientServices.id]
	}),
}));

export const userInvitesRelations = relations(userInvites, ({one}) => ({
	user_userId: one(users, {
		fields: [userInvites.userId],
		references: [users.id],
		relationName: "userInvites_userId_users_id"
	}),
	user_createdBy: one(users, {
		fields: [userInvites.createdBy],
		references: [users.id],
		relationName: "userInvites_createdBy_users_id"
	}),
}));

export const serviceTypesRelations = relations(serviceTypes, ({many}) => ({
	clientServices: many(clientServices),
}));