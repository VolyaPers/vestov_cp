import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calculator, Plus, X, DollarSign, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdvancedDatePicker, DateRangePicker } from '@/components/ui/advanced-date-picker'
import { api } from '@/lib/api'
import { CreateInvoiceData, ServicePricingCalculation } from '@/types/invoice'

interface EnhancedInvoiceFormProps {
  clientId: number
  clientName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ClientServiceOption {
  id: number
  serviceId: number
  serviceName: string
  serviceCategory: string
  billingModel: string
  serviceLevelPrice?: number
  isActive: boolean
  developers: Array<{
    id: number
    developerId: number
    developerName: string
    hourlyRate?: string
    fixedPrice?: string
    employmentType: string
    isActive: boolean
  }>
}

interface AvailableService {
  id: number
  name: string
  category: string
  billingModel: string
}

export function EnhancedInvoiceForm({ 
  clientId, 
  clientName, 
  isOpen, 
  onClose, 
  onSuccess 
}: EnhancedInvoiceFormProps) {
  const queryClient = useQueryClient()
  
  // Get default dates
  const today = new Date().toISOString().split('T')[0]

  // Form state
  const [activeTab, setActiveTab] = useState<'manual' | 'service-based'>('service-based')
  const [invoiceData, setInvoiceData] = useState<CreateInvoiceData>({
    clientId,
    amount: 0,
    invoiceDate: today,
    periodStart: '',
    periodEnd: '',
    description: '',
    notes: '',
    paidAt: '',
    serviceIds: [],
    useServicePricing: true,
    developerRates: {}
  })
  
  const [selectedServices, setSelectedServices] = useState<number[]>([])
  const [pricingCalculation, setPricingCalculation] = useState<ServicePricingCalculation[] | null>(null)
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0)
  const [isAddServiceDialogOpen, setIsAddServiceDialogOpen] = useState(false)
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<AvailableService | null>(null)
  const [serviceRate, setServiceRate] = useState<number>(0)
  const [customServicePrices, setCustomServicePrices] = useState<{ [serviceId: number]: number }>({})
  const [localClientServices, setLocalClientServices] = useState<ClientServiceOption[]>([])
  const [hasManualChanges, setHasManualChanges] = useState(false)
  const [isAddDeveloperDialogOpen, setIsAddDeveloperDialogOpen] = useState(false)
  const [selectedServiceForDeveloper, setSelectedServiceForDeveloper] = useState<number | null>(null)
  const [selectedDeveloperToAdd, setSelectedDeveloperToAdd] = useState<number | null>(null)
  const [developerRates, setDeveloperRates] = useState({ hourlyRate: 0, fixedPrice: 0, hoursWorked: 0 })

  // Fetch client service options
  const { data: serviceOptions, isLoading: isLoadingServices } = useQuery({
    queryKey: ['client-service-options', clientId],
    queryFn: () => api.getClientServiceOptions(clientId),
    enabled: isOpen,
  })

  // Fetch all developers for adding to services
  const { data: allDevelopers } = useQuery({
    queryKey: ['all-developers'],
    queryFn: () => api.getDevelopers(),
    enabled: isOpen,
  })

  // Initialize local client services when data is loaded
  useEffect(() => {
    if (serviceOptions?.clientServices) {
      setLocalClientServices(serviceOptions.clientServices)
    }
  }, [serviceOptions?.clientServices])

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: (data: {
      serviceIds: number[]
      periodStart: string
      periodEnd: string
      developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
    }) => api.calculateServicePricing(clientId, data),
    onSuccess: (data) => {
      // Only update if we haven't made manual changes (like removing developers)
      if (!hasManualChanges) {
        console.log('Updating pricing calculation from server (no manual changes)')
        setPricingCalculation(data.services)
        setCalculatedTotal(data.totalAmount)
        setInvoiceData(prev => ({ 
          ...prev, 
          amount: data.totalAmount,
          serviceIds: selectedServices
        }))
      } else {
        console.log('Skipping pricing calculation update (manual changes exist)')
      }
    },
    onError: (error: any) => {
      console.error('Pricing calculation failed:', error)
    }
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: api.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
      handleClose()
      onSuccess()
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to create invoice')
    }
  })

  // Add service to client mutation
  const addServiceToClientMutation = useMutation({
    mutationFn: (data: { serviceTypeId: number; rate?: number; startDate: string }) => 
      api.addServiceToClient(clientId, data),
    onSuccess: () => {
      // Refresh service options to show the newly added service
      queryClient.invalidateQueries({ queryKey: ['client-service-options', clientId] })
      setIsAddServiceDialogOpen(false)
      setSelectedServiceToAdd(null)
      setServiceRate(0)
      alert('Service added to client successfully!')
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to add service to client')
    }
  })

  // Calculate pricing when services or period changes
  useEffect(() => {
    if (activeTab === 'service-based' && selectedServices.length > 0 && invoiceData.periodStart && invoiceData.periodEnd) {
      calculatePricingMutation.mutate({
        serviceIds: selectedServices,
        periodStart: invoiceData.periodStart,
        periodEnd: invoiceData.periodEnd,
        developerRates: invoiceData.developerRates
      })
    }
  }, [selectedServices, invoiceData.periodStart, invoiceData.periodEnd, invoiceData.developerRates])

  const handleServiceToggle = (serviceId: number) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  const handleDeveloperRateChange = (developerId: number, field: 'hourlyRate' | 'fixedPrice' | 'hoursWorked', value: string) => {
    const numValue = parseFloat(value) || 0
    
    console.log('Developer rate change:', { developerId, field, value, numValue })
    
    setInvoiceData(prev => ({
      ...prev,
      developerRates: {
        ...prev.developerRates,
        [developerId]: {
          ...prev.developerRates?.[developerId],
          [field]: numValue || undefined
        }
      }
    }))
    
    // Recalculate total based on updated developer rates
    recalculateTotal(developerId, field, numValue)
  }

  const handleRemoveDeveloper = (serviceId: number, developerId: number) => {
    // Mark that we have manual changes to prevent server overwrites
    setHasManualChanges(true)
    
    // Update local client services to remove the developer from UI
    setLocalClientServices(prevServices => {
      const updated = prevServices.map(service => {
        if (service.id === serviceId) {
          const newService = {
            ...service,
            developers: service.developers.filter(dev => dev.id !== developerId)
          }
          return newService
        }
        return service
      })
      return updated
    })
    
    // Update pricing calculation to remove the developer
    setPricingCalculation(prevCalculation => {
      if (!prevCalculation) {
        console.log('No pricing calculation to update')
        return prevCalculation
      }
      
      const updatedCalculation = prevCalculation.map(serviceCalc => {
        console.log('Processing service calc:', serviceCalc.serviceId, 'looking for:', serviceId)
        if (serviceCalc.serviceId === serviceId) {
          console.log('Found matching service, current developers:', serviceCalc.developers)
          const updatedDevelopers = serviceCalc.developers.filter(dev => {
            console.log('Checking developer:', {
              dev,
              devId: dev.id,
              devDeveloperId: dev.developerId,
              targetId: developerId
            })
            // Try both id and developerId fields
            return dev.id !== developerId && dev.developerId !== developerId
          })
          console.log('Updated developers after filtering:', updatedDevelopers)
          
          const developerTotal = updatedDevelopers.reduce((sum, dev) => {
            // Get developer ID (try both fields)
            const devId = dev.developerId || dev.id
            
            // Get current user input values for this developer
            const userRates = invoiceData.developerRates?.[devId] || {}
            const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
            const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
            const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
            
            // Calculate amount based on current user input
            const amount = fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked)
            
            console.log('Adding developer to total:', {
              name: dev.name,
              devId,
              developerId: dev.developerId,
              originalCalculatedAmount: dev.calculatedAmount,
              userRates,
              hourlyRate,
              hoursWorked,
              fixedPrice,
              calculatedAmount: amount,
              runningSum: sum + amount
            })
            return sum + amount
          }, 0)
          console.log('New developer total:', developerTotal)
          
          const customServicePrice = customServicePrices[serviceCalc.serviceId]
          const finalAmount = customServicePrice !== undefined ? customServicePrice : developerTotal
          
          console.log('Final amount calculation:', {
            customServicePrice,
            developerTotal,
            finalAmount
          })
          
          return {
            ...serviceCalc,
            developers: updatedDevelopers,
            developerTotal,
            finalAmount
          }
        }
        return serviceCalc
      })
      
      console.log('Updated calculation:', updatedCalculation)
      
      // Recalculate total
      const newTotal = updatedCalculation.reduce((total, calc) => {
        const customPrice = customServicePrices[calc.serviceId]
        const amountToAdd = customPrice !== undefined ? customPrice : calc.finalAmount
        console.log('Adding to total:', {
          serviceId: calc.serviceId,
          customPrice,
          finalAmount: calc.finalAmount,
          amountToAdd,
          runningTotal: total + amountToAdd
        })
        return total + amountToAdd
      }, 0)
      
      console.log('NEW TOTAL CALCULATED:', newTotal)
      setCalculatedTotal(newTotal)
      
      return updatedCalculation
    })
    
    // Remove developer rates from invoiceData
    setInvoiceData(prev => {
      const updatedDeveloperRates = { ...prev.developerRates }
      delete updatedDeveloperRates[developerId]
      
      return {
        ...prev,
        developerRates: updatedDeveloperRates
      }
    })
  }
  
  const recalculateTotal = (developerId: number, field: 'hourlyRate' | 'fixedPrice' | 'hoursWorked', value: number) => {
    if (!pricingCalculation) {
      console.log('No pricing calculation available')
      return
    }
    
    // Mark that we have manual changes
    setHasManualChanges(true)
    
    // Create a copy of pricing calculation with updated values
    const updatedCalculation = pricingCalculation.map(serviceCalc => {
      const updatedDevelopers = serviceCalc.developers.map(dev => {
        if (dev.developerId === developerId || dev.id === developerId) {
          const updatedDev = { ...dev }
          if (field === 'hourlyRate') {
            updatedDev.hourlyRate = value
            updatedDev.calculatedAmount = value * (dev.hoursWorked || 0)
          } else if (field === 'fixedPrice') {
            updatedDev.fixedPrice = value
            updatedDev.calculatedAmount = value
          } else if (field === 'hoursWorked') {
            updatedDev.hoursWorked = value
            updatedDev.calculatedAmount = (dev.hourlyRate || 0) * value
          }
          return updatedDev
        }
        return dev
      })
      
      // Recalculate service total using the same logic as removal
      const developerTotal = updatedDevelopers.reduce((sum, dev) => {
        const devId = dev.developerId || dev.id
        const userRates = invoiceData.developerRates?.[devId] || {}
        const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
        const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
        const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
        const amount = fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked)
        return sum + amount
      }, 0)
      
      const customServicePrice = customServicePrices[serviceCalc.serviceId]
      const finalAmount = customServicePrice !== undefined ? customServicePrice : developerTotal
      
      return {
        ...serviceCalc,
        developers: updatedDevelopers,
        developerTotal,
        finalAmount
      }
    })
    
    // Update pricing calculation state
    setPricingCalculation(updatedCalculation)
    
    // Calculate and update total
    const newTotal = updatedCalculation.reduce((total, calc) => {
      const customPrice = customServicePrices[calc.serviceId]
      return total + (customPrice !== undefined ? customPrice : calc.finalAmount)
    }, 0)
    
    setCalculatedTotal(newTotal)
  }

  const handleOpenAddServiceDialog = (service: AvailableService) => {
    setSelectedServiceToAdd(service)
    setServiceRate(0)
    setIsAddServiceDialogOpen(true)
  }

  const handleOpenAddDeveloperDialog = (serviceId: number) => {
    setSelectedServiceForDeveloper(serviceId)
    setSelectedDeveloperToAdd(null)
    setDeveloperRates({ hourlyRate: 0, fixedPrice: 0, hoursWorked: 0 })
    setIsAddDeveloperDialogOpen(true)
  }

  const handleAddDeveloperSubmit = () => {
    if (!selectedDeveloperToAdd) return
    handleAddDeveloper(selectedDeveloperToAdd, developerRates)
  }

  const handleAddDeveloper = (developerId: number, rates: { hourlyRate?: number, fixedPrice?: number, hoursWorked?: number }) => {
    if (!selectedServiceForDeveloper || !allDevelopers) return
    
    const developer = allDevelopers.find((dev: any) => dev.id === developerId)
    if (!developer) return

    // Mark that we have manual changes
    setHasManualChanges(true)

    // Add developer to local client services (UI)
    setLocalClientServices(prevServices => {
      return prevServices.map(service => {
        if (service.id === selectedServiceForDeveloper) {
          const newDeveloper = {
            id: developer.id,
            developerName: developer.name,
            hourlyRate: rates.hourlyRate || developer.hourlyRate || 0,
            fixedPrice: rates.fixedPrice || 0,
            hoursWorked: rates.hoursWorked || 0
          }
          return {
            ...service,
            developers: [...service.developers, newDeveloper]
          }
        }
        return service
      })
    })

    // Add developer to pricing calculation
    setPricingCalculation(prevCalculation => {
      if (!prevCalculation) return prevCalculation
      
      return prevCalculation.map(serviceCalc => {
        if (serviceCalc.serviceId === selectedServiceForDeveloper) {
          const amount = rates.fixedPrice || (rates.hourlyRate || 0) * (rates.hoursWorked || 0)
          const newDeveloper = {
            developerId: developer.id,
            id: developer.id,
            name: developer.name,
            hourlyRate: rates.hourlyRate || developer.hourlyRate || 0,
            fixedPrice: rates.fixedPrice || 0,
            hoursWorked: rates.hoursWorked || 0,
            calculatedAmount: amount,
            amount
          }
          
          const updatedDevelopers = [...serviceCalc.developers, newDeveloper]
          const developerTotal = updatedDevelopers.reduce((sum, dev) => {
            const devId = dev.developerId || dev.id
            const userRates = invoiceData.developerRates?.[devId] || {}
            const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
            const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
            const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
            return sum + (fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked))
          }, 0)
          
          const customServicePrice = customServicePrices[serviceCalc.serviceId]
          const finalAmount = customServicePrice !== undefined ? customServicePrice : developerTotal
          
          return {
            ...serviceCalc,
            developers: updatedDevelopers,
            developerTotal,
            finalAmount
          }
        }
        return serviceCalc
      })
    })

    // Update calculated total
    const newTotal = (pricingCalculation || []).reduce((total, calc) => {
      if (calc.serviceId === selectedServiceForDeveloper) {
        const customPrice = customServicePrices[calc.serviceId]
        const amount = rates.fixedPrice || (rates.hourlyRate || 0) * (rates.hoursWorked || 0)
        return total + (customPrice !== undefined ? customPrice : calc.developerTotal + amount)
      }
      const customPrice = customServicePrices[calc.serviceId]
      return total + (customPrice !== undefined ? customPrice : calc.finalAmount)
    }, 0)
    
    setCalculatedTotal(newTotal)
    
    // Close dialog
    setIsAddDeveloperDialogOpen(false)
    setSelectedServiceForDeveloper(null)
  }

  const handleAddServiceWithRate = () => {
    if (!selectedServiceToAdd) return
    
    addServiceToClientMutation.mutate({
      serviceTypeId: selectedServiceToAdd.id,
      rate: serviceRate > 0 ? serviceRate : undefined,
      startDate: new Date().toISOString().split('T')[0]
    })
  }

  const updateCustomServicePrice = (serviceId: number, price: number) => {
    setCustomServicePrices(prev => ({
      ...prev,
      [serviceId]: price
    }))
    
    // Recalculate total with custom prices
    if (pricingCalculation) {
      const newTotal = pricingCalculation.reduce((total, calc) => {
        const customPrice = serviceId === calc.serviceId ? price : customServicePrices[calc.serviceId]
        return total + (customPrice !== undefined ? customPrice : calc.finalAmount)
      }, 0)
      setCalculatedTotal(newTotal)
    }
  }

  const getFinalTotal = () => {
    if (!pricingCalculation) return calculatedTotal
    
    const total = pricingCalculation.reduce((total, calc) => {
      const customPrice = customServicePrices[calc.serviceId]
      
      if (customPrice !== undefined) {
        return total + customPrice
      }
      
      // Calculate total using current user input values
      const developerTotal = calc.developers.reduce((sum, dev) => {
        const devId = dev.developerId || dev.id
        const userRates = invoiceData.developerRates?.[devId] || {}
        const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
        const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
        const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
        const amount = fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked)
        return sum + amount
      }, 0)
      
      return total + developerTotal
    }, 0)
    
    return total
  }

  const handleCreateInvoice = () => {
    const finalData: CreateInvoiceData = {
      ...invoiceData,
      serviceIds: activeTab === 'service-based' ? selectedServices : undefined,
      useServicePricing: activeTab === 'service-based',
      amount: activeTab === 'manual' ? invoiceData.amount : getFinalTotal(),
      // Automatically set status to 'paid' if paid date is provided
      status: invoiceData.paidAt ? 'paid' : (invoiceData.status || 'draft')
    }

    createInvoiceMutation.mutate(finalData)
  }

  const handleClose = () => {
    // Reset form state
    setActiveTab('service-based')
    setSelectedServices([])
    setPricingCalculation(null)
    setCalculatedTotal(0)
    setCustomServicePrices({})
    setLocalClientServices([])
    setHasManualChanges(false)
    setInvoiceData({
      clientId,
      amount: 0,
      invoiceDate: today,
      periodStart: '',
      periodEnd: '',
      description: '',
      notes: '',
      paidAt: '',
      serviceIds: [],
      useServicePricing: true,
      developerRates: {}
    })
    onClose()
  }

  const clientServices = localClientServices.length > 0 ? localClientServices : (serviceOptions?.clientServices || [])
  const availableServices = serviceOptions?.availableServices || []

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice for {clientName}</DialogTitle>
            <DialogDescription>
              Choose between manual entry or service-based pricing calculation
            </DialogDescription>
          </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="service-based">
              <Calculator className="h-4 w-4 mr-2" />
              Service-Based Pricing
            </TabsTrigger>
            <TabsTrigger value="manual">
              <DollarSign className="h-4 w-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="service-based" className="space-y-6">
            {/* Basic Invoice Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <AdvancedDatePicker
                  id="invoiceDate"
                  label="Invoice Date"
                  value={invoiceData.invoiceDate}
                  onChange={(date) => setInvoiceData({ ...invoiceData, invoiceDate: date || '' })}
                />
              </div>
              <div>
                <Label>Calculated Total</Label>
                <div className="p-2 bg-green-50 border rounded-md text-green-800 font-semibold">
                  ${getFinalTotal().toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <DateRangePicker
                startDate={invoiceData.periodStart}
                endDate={invoiceData.periodEnd}
                onStartDateChange={(date) => setInvoiceData(prev => ({ ...prev, periodStart: date || '' }))}
                onEndDateChange={(date) => setInvoiceData(prev => ({ ...prev, periodEnd: date || '' }))}
                startLabel="Period Start"
                endLabel="Period End"
              />
            </div>

            {/* Service Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Select Services to Invoice</Label>
              
              {isLoadingServices ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Client's Active Services */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Active Services</h4>
                    {clientServices.map((service: ClientServiceOption) => (
                      <Card key={service.id} className="border-2 border-dashed border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={selectedServices.includes(service.id)}
                                onCheckedChange={() => handleServiceToggle(service.id)}
                              />
                              <div>
                                <CardTitle className="text-base">{service.serviceName}</CardTitle>
                                <CardDescription>
                                  {service.serviceCategory} • {service.billingModel} billing
                                  {service.serviceLevelPrice && (
                                    <span className="ml-2 text-green-600 font-medium">
                                      ${parseFloat(service.serviceLevelPrice.toString()).toLocaleString()}/mo
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline">
                              <Users className="h-3 w-3 mr-1" />
                              {service.developers.length} developers
                            </Badge>
                          </div>
                        </CardHeader>
                        
                        {selectedServices.includes(service.id) && service.developers.length > 0 && (
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <h5 className="font-medium text-sm">Assigned Developers</h5>
                              {/* Header row with field labels */}
                              <div className="grid grid-cols-5 gap-2 px-3 py-1 text-xs font-medium text-gray-600">
                                <div>Developer</div>
                                <div>Hourly Rate ($)</div>
                                <div>Hours Worked</div>
                                <div>Fixed Price ($)</div>
                                <div className="text-center">Action</div>
                              </div>
                              {service.developers.map((developer) => (
                                <div key={developer.id} className="grid grid-cols-5 gap-2 p-3 bg-gray-50 rounded">
                                  <div className="font-medium text-sm">{developer.developerName}</div>
                                  <div>
                                    <Input
                                      type="number"
                                      placeholder="Hourly Rate"
                                      defaultValue={developer.hourlyRate || ''}
                                      onChange={(e) => handleDeveloperRateChange(developer.id, 'hourlyRate', e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Input
                                      type="number"
                                      placeholder="Hours Worked"
                                      onChange={(e) => handleDeveloperRateChange(developer.id, 'hoursWorked', e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Input
                                      type="number"
                                      placeholder="Fixed Price"
                                      defaultValue={developer.fixedPrice || ''}
                                      onChange={(e) => handleDeveloperRateChange(developer.id, 'fixedPrice', e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="flex justify-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveDeveloper(service.id, developer.id)}
                                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-center pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAddDeveloperDialog(service.id)}
                                  className="h-8 text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Developer
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        )}

                        {selectedServices.includes(service.id) && service.developers.length === 0 && (
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <h5 className="font-medium text-sm">Assigned Developers</h5>
                              <div className="text-center py-4">
                                <p className="text-sm text-gray-500 mb-2">No developers assigned</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAddDeveloperDialog(service.id)}
                                  className="h-8 text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Developer
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>

                  {/* Available Services to Add */}
                  {availableServices.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-700">Available Services to Add</h4>
                      {availableServices.map((service: AvailableService) => (
                        <div key={service.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
                          <div className="flex-1">
                            <div className="font-medium">{service.name}</div>
                            <div className="text-sm text-gray-500">{service.category} • {service.billingModel} billing</div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenAddServiceDialog(service)}
                            disabled={addServiceToClientMutation.isPending}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {addServiceToClientMutation.isPending ? 'Adding...' : 'Add Service'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pricing Breakdown */}
            {pricingCalculation && (
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-base">Pricing Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pricingCalculation.map((calc, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{calc.serviceName}</span>
                        <span className="font-bold">
                          ${(() => {
                            const customPrice = customServicePrices[calc.serviceId]
                            if (customPrice !== undefined) {
                              return customPrice.toLocaleString()
                            }
                            
                            // Calculate total using current user input values
                            const developerTotal = calc.developers.reduce((sum, dev) => {
                              const devId = dev.developerId || dev.id
                              const userRates = invoiceData.developerRates?.[devId] || {}
                              const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
                              const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
                              const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
                              const amount = fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked)
                              return sum + amount
                            }, 0)
                            
                            return developerTotal.toLocaleString()
                          })()}
                        </span>
                      </div>
                      {calc.serviceLevelPrice && (
                        <div className="flex items-center gap-2 text-sm">
                          <label className="text-gray-600">Service price:</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={customServicePrices[calc.serviceId] !== undefined 
                              ? customServicePrices[calc.serviceId] 
                              : calc.finalAmount}
                            onChange={(e) => updateCustomServicePrice(calc.serviceId, parseFloat(e.target.value) || 0)}
                            className="w-24 h-6 text-sm"
                          />
                        </div>
                      )}
                      {calc.developers.length > 0 && (
                        <div className="text-sm text-gray-600 ml-4">
                          {calc.developers.map((dev, i) => {
                            // Calculate using current user input values
                            const devId = dev.developerId || dev.id
                            const userRates = invoiceData.developerRates?.[devId] || {}
                            const hourlyRate = userRates.hourlyRate || dev.hourlyRate || 0
                            const hoursWorked = userRates.hoursWorked || dev.hoursWorked || 0
                            const fixedPrice = userRates.fixedPrice || dev.fixedPrice || 0
                            const amount = fixedPrice > 0 ? fixedPrice : (hourlyRate * hoursWorked)
                            
                            return (
                              <div key={i}>
                                {dev.name}: ${amount.toLocaleString()}
                                {hoursWorked > 0 && hourlyRate > 0 && ` (${hoursWorked}h @ $${hourlyRate}/h)`}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div>
              <Label htmlFor="manualAmount">Amount *</Label>
              <Input
                id="manualAmount"
                type="number"
                step="0.01"
                value={invoiceData.amount}
                onChange={(e) => setInvoiceData({ 
                  ...invoiceData, 
                  amount: parseFloat(e.target.value) || 0 
                })}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <AdvancedDatePicker
                id="manualInvoiceDate"
                label="Invoice Date"
                value={invoiceData.invoiceDate}
                onChange={(date) => setInvoiceData({ ...invoiceData, invoiceDate: date || '' })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <DateRangePicker
                  startDate={invoiceData.periodStart}
                  endDate={invoiceData.periodEnd}
                  onStartDateChange={(date) => setInvoiceData(prev => ({ ...prev, periodStart: date || '' }))}
                  onEndDateChange={(date) => setInvoiceData(prev => ({ ...prev, periodEnd: date || '' }))}
                  startLabel="Period Start"
                  endLabel="Period End"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Common Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={invoiceData.description}
                onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
                placeholder="Services provided..."
              />
            </div>
            <div>
              <AdvancedDatePicker
                id="dueDate"
                label="Due Date"
                value={invoiceData.dueDate || ''}
                onChange={(date) => setInvoiceData({ ...invoiceData, dueDate: date || '' })}
              />
            </div>
            <div>
              <AdvancedDatePicker
                id="paidAt"
                label="Paid Date"
                value={invoiceData.paidAt || ''}
                onChange={(date) => setInvoiceData({ ...invoiceData, paidAt: date || '' })}
              />
              {invoiceData.paidAt && (
                <div className="text-sm text-green-600 mt-1">
                  ✓ Invoice will be marked as paid
                </div>
              )}
              {!invoiceData.paidAt && (
                <div className="text-sm text-gray-500 mt-1">
                  Leave empty for unpaid invoice
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateInvoice}
            disabled={
              createInvoiceMutation.isPending || 
              (activeTab === 'manual' && !invoiceData.amount) ||
              (activeTab === 'service-based' && selectedServices.length === 0)
            }
          >
            {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Service Dialog */}
    <Dialog open={isAddServiceDialogOpen} onOpenChange={setIsAddServiceDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Service to Client</DialogTitle>
          <DialogDescription>
            Set the pricing for {selectedServiceToAdd?.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Service</Label>
            <div className="p-3 bg-gray-50 rounded border">
              <div className="font-medium">{selectedServiceToAdd?.name}</div>
              <div className="text-sm text-gray-500">
                {selectedServiceToAdd?.category} • {selectedServiceToAdd?.billingModel} billing
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="serviceRate">
              Service Rate {selectedServiceToAdd?.billingModel === 'hourly' ? '(per hour)' : 
                           selectedServiceToAdd?.billingModel === 'fixed' ? '(fixed price)' : 
                           '(monthly rate)'} - Optional
            </Label>
            <Input
              id="serviceRate"
              type="number"
              step="0.01"
              value={serviceRate || ''}
              onChange={(e) => setServiceRate(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <div className="text-sm text-gray-500 mt-1">
              Leave empty to set pricing later or use developer rates
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsAddServiceDialogOpen(false)
              setSelectedServiceToAdd(null)
              setServiceRate(0)
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddServiceWithRate}
            disabled={addServiceToClientMutation.isPending}
          >
            {addServiceToClientMutation.isPending ? 'Adding...' : 'Add Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Add Developer Dialog */}
    <Dialog open={isAddDeveloperDialogOpen} onOpenChange={setIsAddDeveloperDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Developer to Service</DialogTitle>
          <DialogDescription>
            Select a developer and set their pricing for this service
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="developer">Developer</Label>
            <Select onValueChange={(value) => setSelectedDeveloperToAdd(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a developer" />
              </SelectTrigger>
              <SelectContent>
                {allDevelopers?.filter((dev: any) => {
                  // Filter out developers already assigned to this service
                  const service = localClientServices.find(s => s.id === selectedServiceForDeveloper)
                  return !service?.developers.some(assigned => assigned.id === dev.id)
                }).map((developer: any) => (
                  <SelectItem key={developer.id} value={developer.id.toString()}>
                    {developer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                value={developerRates.hourlyRate || ''}
                onChange={(e) => setDeveloperRates(prev => ({ 
                  ...prev, 
                  hourlyRate: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.00"
              />
            </div>
            
            <div>
              <Label htmlFor="hoursWorked">Hours Worked</Label>
              <Input
                id="hoursWorked"
                type="number"
                value={developerRates.hoursWorked || ''}
                onChange={(e) => setDeveloperRates(prev => ({ 
                  ...prev, 
                  hoursWorked: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0"
              />
            </div>
            
            <div>
              <Label htmlFor="fixedPrice">Fixed Price ($)</Label>
              <Input
                id="fixedPrice"
                type="number"
                step="0.01"
                value={developerRates.fixedPrice || ''}
                onChange={(e) => setDeveloperRates(prev => ({ 
                  ...prev, 
                  fixedPrice: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Use either hourly rate + hours worked OR fixed price. Fixed price takes priority.
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsAddDeveloperDialogOpen(false)
              setSelectedServiceForDeveloper(null)
              setSelectedDeveloperToAdd(null)
              setDeveloperRates({ hourlyRate: 0, fixedPrice: 0, hoursWorked: 0 })
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddDeveloperSubmit}
            disabled={!selectedDeveloperToAdd}
          >
            Add Developer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}