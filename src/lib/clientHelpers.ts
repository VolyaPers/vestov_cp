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
  services: Array<{
    id: number
    serviceTypeName: string
    serviceDescription?: string
    serviceCategory: string
    billingModel: string
    rate?: number
    serviceLevelPrice?: number
    startDate: string
    endDate?: string
    isActive: boolean
    createdAt: string
  }>
}

/**
 * Converts a Client from the API to ClientDetails format
 * Handles service mapping and ensures all required fields are present
 */
export function convertClientToClientDetails(client: Client): ClientDetails {
  return {
    ...client,
    services: (client.services || []).map((service: ClientService) => ({
      id: service.id,
      serviceTypeName: service.serviceType?.name || '',
      serviceDescription: undefined,
      serviceCategory: service.serviceType?.category || 'outstaffing',
      billingModel: service.serviceType?.billingModel || 'hourly',
      rate: service.rate,
      serviceLevelPrice: service.serviceLevelPrice,
      startDate: service.startDate,
      endDate: service.endDate,
      isActive: service.isActive,
      createdAt: service.startDate, // Fallback if createdAt not available
    })),
  }
}

