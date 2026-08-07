import type { Client, ClientService } from '@/types/common'

/**
 * ClientDetails type used in admin/client pages
 * This extends Client with a services array that has additional fields
 */
export interface ClientDetails {
  id: number
  name: string
  industry?: string
  status: 'active' | 'inactive' | 'prospect'
  contractType?: 'outstaffing' | 'outsourcing' | 'hybrid'
  contractStart?: string
  contractEnd?: string
  billingCycle?: string
  teamSize?: number
  logoUrl?: string
  createdAt: string
  services: Array<ClientService>
}

/**
 * Converts a Client from the API to ClientDetails format
 * Handles service mapping and ensures all required fields are present
 */
export function convertClientToClientDetails(client: Client): ClientDetails {
  return {
    ...client,
    services: (client.services || []).map((service) => ({
      id: service.id,
      serviceTypeId: service.serviceTypeId,
      serviceTypeName: service.serviceTypeName || service.serviceType?.name || '',
      serviceDescription: service.serviceDescription || service.serviceType?.description,
      serviceCategory: service.serviceCategory || (service.serviceType?.category as any) || 'outstaffing',
      billingModel: service.billingModel || (service.serviceType?.billingModel as any) || 'hourly',
      rate: service.rate,
      serviceTitle: service.serviceTitle,
      serviceLevelPrice: service.serviceLevelPrice,
      startDate: service.startDate,
      endDate: service.endDate,
      isActive: service.isActive,
      slackChannelId: service.slackChannelId,
      clickupListId: service.clickupListId,
      clickupListName: service.clickupListName,
      projectBotEnabled: service.projectBotEnabled,
      projectBotDailyUpdateEnabled: service.projectBotDailyUpdateEnabled,
      projectBotDailyUpdateTime: service.projectBotDailyUpdateTime,
      projectBotTimezone: service.projectBotTimezone,
      projectBotAuthorizedSlackUserIds: service.projectBotAuthorizedSlackUserIds,
      createdAt: service.createdAt || service.startDate,
    })),
  }
}
