export interface Invoice {
  id: number
  clientId: number
  invoiceNumber: string
  amount: string // decimal as string for precision
  invoiceDate: string // ISO date string
  periodStart: string // ISO date string  
  periodEnd: string // ISO date string
  description?: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dueDate?: string // ISO date string
  paidAt?: string // ISO timestamp string
  notes?: string
  createdBy: number
  createdAt: string // ISO timestamp string
  updatedAt: string // ISO timestamp string
  // Service integration
  serviceIds?: number[] // Array of service IDs included in this invoice
  services?: InvoiceService[] // Full service details with pricing
}

export interface InvoiceService {
  id: number
  serviceId: number
  serviceName: string
  serviceTitle?: string
  serviceTypeName?: string
  serviceCategory: string
  billingModel: string
  serviceLevelPrice?: number
  calculatedAmount: number
  developers: InvoiceDeveloper[]
}

export interface InvoiceDeveloper {
  id: number
  developerId: number
  developerName: string
  hourlyRate?: number
  fixedPrice?: number
  hoursWorked?: number
  calculatedAmount: number
}

export interface CreateInvoiceData {
  clientId: number
  amount?: number // Optional if calculated from services
  invoiceDate?: string // defaults to today
  periodStart?: string // defaults to last month start
  periodEnd?: string // defaults to last month end
  description?: string
  dueDate?: string
  paidAt?: string // paid date
  notes?: string
  // Service-based invoice creation
  serviceIds?: number[] // Services to include
  useServicePricing?: boolean // Whether to calculate from services
  developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
  servicePrices?: { [key: number]: number }
}

export interface UpdateInvoiceData {
  amount?: number
  invoiceDate?: string
  periodStart?: string
  periodEnd?: string
  description?: string
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dueDate?: string
  paidAt?: string
  notes?: string
  serviceIds?: number[]
  developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
  servicePrices?: { [key: number]: number }
}

export interface InvoiceListItem extends Omit<Invoice, 'createdBy'> {
  clientName?: string
}

export interface ServicePricingCalculation {
  serviceId: number
  serviceName: string
  serviceTitle?: string
  serviceTypeName?: string
  serviceLevelPrice?: number
  developerTotal: number
  finalAmount: number
  developers: Array<{
    id: number
    name: string
    hourlyRate?: number
    fixedPrice?: number
    hoursWorked?: number
    amount: number
  }>
}
