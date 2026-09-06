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
import { useCustomAlert } from '@/components/ui/custom-alert'

interface EnhancedInvoiceFormProps {
  clientId: number
  clientName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialServiceId?: number | null
}

interface ClientServiceOption {
  id: number
  serviceId: number
  serviceName: string
  serviceTitle?: string
  serviceCategory: string
  billingModel: string
  serviceLevelPrice?: number
  isActive: boolean
  developers: Array<{
    id: number
    teamMemberId: number
    developerName: string
    developerAvatarUrl?: string
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
  onSuccess,
  initialServiceId = null
}: EnhancedInvoiceFormProps) {
  const { showAlert } = useCustomAlert()
  const queryClient = useQueryClient()

  // Get default dates
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)).toISOString().split('T')[0]
  const lastOfMonth = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 0)).toISOString().split('T')[0]

  // Form state
  const [activeTab, setActiveTab] = useState<'manual' | 'service-based'>('service-based')
  const [invoiceData, setInvoiceData] = useState<CreateInvoiceData>({
    clientId,
    amount: 0,
    invoiceDate: today,
    periodStart: firstOfMonth,
    periodEnd: lastOfMonth,
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
  const [isAddDeveloperDialogOpen, setIsAddDeveloperDialogOpen] = useState(false)
  const [selectedServiceForDeveloper, setSelectedServiceForDeveloper] = useState<number | null>(null)
  const [selectedDeveloperToAdd, setSelectedDeveloperToAdd] = useState<number | null>(null)
  const [developerRates, setDeveloperRates] = useState({ hourlyRate: 0, fixedPrice: 0, hoursWorked: 0 })
  const [developerPricingMode,setDeveloperPricingMode]=useState<'hourly'|'fixed'>('hourly')
  const [addingDeveloper,setAddingDeveloper]=useState(false)
  const [excludedDeveloperIds,setExcludedDeveloperIds]=useState<number[]>([])
  const [lastPricedRequest,setLastPricedRequest]=useState('')

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
      setLocalClientServices(serviceOptions.clientServices.map(service=>({...service,developers:service.developers.filter(dev=>!excludedDeveloperIds.includes(dev.id))})))
      if (initialServiceId && serviceOptions.clientServices.some(service => service.id === initialServiceId)) {
        setSelectedServices(previous=>previous.length?previous:[initialServiceId])
      }

      // Initialize developer rates for all existing developers
      const initialRates: any = {}
      serviceOptions.clientServices.forEach(service => {
        service.developers.forEach(dev => {
          if (!initialRates[dev.id]) {
            // Initialize with default values (this ensures all developers are in the rates object)
            initialRates[dev.id] = dev.fixedPrice !== null && dev.fixedPrice !== undefined
              ? { fixedPrice: Number(dev.fixedPrice) }
              : { hourlyRate: Number(dev.hourlyRate || 0), hoursWorked: 0 }

          }
        })
      })


      setInvoiceData(prev => ({
        ...prev,
        developerRates: { ...initialRates, ...prev.developerRates }
      }))
    }
  }, [serviceOptions?.clientServices, initialServiceId])

  // Calculate pricing mutation
  const calculatePricingMutation = useMutation({
    mutationFn: (data: {
      serviceIds: number[]
      periodStart: string
      periodEnd: string
      developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
      servicePrices?: { [key: number]: number }
    }) => api.calculateServicePricing(clientId, data),
    onSuccess: (data) => {
      setPricingCalculation(data.services)
      setCalculatedTotal(data.totalAmount)
      setInvoiceData(prev => ({
        ...prev,
        amount: data.totalAmount,
        serviceIds: selectedServices
      }))
    },
    onError: (error: any) => {
      console.error('Pricing calculation failed:', error)
    }
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => api.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', 'client', clientId] })
      handleClose()
      onSuccess()
    },
    onError: (error: any) => {
      showAlert({ message: error.message || 'Failed to create invoice', type: 'error' })
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
      showAlert({ message: 'Service added to client successfully!', type: 'success' })
    },
    onError: (error: any) => {
      showAlert({ message: error.message || 'Failed to add service to client', type: 'error' })
    }
  })

  const selectedRates = () => Object.fromEntries(localClientServices.filter(service=>selectedServices.includes(service.id)).flatMap(service=>service.developers.map(dev=>[dev.id,invoiceData.developerRates[dev.id] || (dev.fixedPrice != null ? {fixedPrice:Number(dev.fixedPrice)} : {hourlyRate:Number(dev.hourlyRate || 0),hoursWorked:0})])))
  const pricingRequest=JSON.stringify({serviceIds:selectedServices,periodStart:invoiceData.periodStart,periodEnd:invoiceData.periodEnd,developerRates:selectedRates(),servicePrices:customServicePrices})
  const [pricingError,setPricingError]=useState('')
  const [pricingLoading,setPricingLoading]=useState(false)
  useEffect(()=>{
    let active=true
    if(activeTab!=='service-based'||!selectedServices.length||!invoiceData.periodStart||!invoiceData.periodEnd){setPricingCalculation(null);setCalculatedTotal(0);return}
    setPricingLoading(true);setPricingError('')
    const timer=setTimeout(()=>{
      api.calculateServicePricing(clientId,{serviceIds:selectedServices,periodStart:invoiceData.periodStart,periodEnd:invoiceData.periodEnd,developerRates:selectedRates(),servicePrices:customServicePrices}).then(data=>{if(active){setPricingCalculation(data.services);setCalculatedTotal(data.totalAmount);setLastPricedRequest(pricingRequest)}}).catch(error=>{if(active){setPricingError(error instanceof Error?error.message:'Pricing is unavailable');setPricingCalculation(null);setCalculatedTotal(0)}}).finally(()=>{if(active)setPricingLoading(false)})
    },150)
    return()=>{active=false;clearTimeout(timer)}
  },[selectedServices,invoiceData.periodStart,invoiceData.periodEnd,invoiceData.developerRates,localClientServices,activeTab,customServicePrices])

  const handleServiceToggle = (serviceId: number) => {
    setSelectedServices(prev => {
      const isCurrentlySelected = prev.includes(serviceId)

      if (isCurrentlySelected) {
        // Removing service - remove it from selected list
        return prev.filter(id => id !== serviceId)
      } else {
        // Adding service - add it to selected list and create default rates
        const newSelectedServices = [...prev, serviceId]

        // CRITICAL FIX: When selecting a service, immediately create default rates for its developers
        // This ensures the server calculation returns a meaningful total instead of $0
        const service = localClientServices.find(s => s.id === serviceId)
        if (service && service.developers) {

          // Update developer rates to include defaults for this service's developers
          setInvoiceData(prevInvoice => {
            const updatedDeveloperRates = { ...prevInvoice.developerRates }

            service.developers.forEach(dev => {
              if (!updatedDeveloperRates[dev.id]) {
                // Create default rates based on developer data
                const defaultRates = dev.fixedPrice != null ? {fixedPrice:Number(dev.fixedPrice)} : {hourlyRate:Number(dev.hourlyRate || 0),hoursWorked:0}

                updatedDeveloperRates[dev.id] = defaultRates
              }
            })

            return {
              ...prevInvoice,
              developerRates: updatedDeveloperRates
            }
          })
        }

        return newSelectedServices
      }
    })
  }

  const handleDeveloperRateChange = (developerId: number, field: 'hourlyRate' | 'fixedPrice' | 'hoursWorked', value: string) => {
    const numValue = value === '' ? undefined : (parseFloat(value) || 0)


    setInvoiceData(prev => {
      const currentRates = prev.developerRates?.[developerId] || {}
      const updatedRates = { ...currentRates }

      if (numValue === undefined) {
        delete updatedRates[field]
      } else {
        updatedRates[field] = numValue
      }

      return {
        ...prev,
        developerRates: {
          ...prev.developerRates,
          [developerId]: updatedRates
        }
      }
    })
  }

  const handleRemoveDeveloper = (serviceId: number, developerId: number) => {

    setExcludedDeveloperIds(previous=>[...previous,developerId])
    // Update local client services to remove the developer from UI
    setLocalClientServices(prevServices => {
      return prevServices.map(service => {
        if (service.id === serviceId) {
          return {
            ...service,
            developers: service.developers.filter(dev => dev.id !== developerId)
          }
        }
        return service
      })
    })

    // Remove developer rates from invoiceData and trigger server recalculation
    setInvoiceData(prev => {
      const updatedDeveloperRates = { ...prev.developerRates }
      delete updatedDeveloperRates[developerId]


      return {
        ...prev,
        developerRates: updatedDeveloperRates
      }
    })

    // The useEffect will automatically trigger a server recalculation
    // since developerRates changed, which will update the totals correctly
  }


  const handleOpenAddServiceDialog = (service: AvailableService) => {
    setSelectedServiceToAdd(service)
    setServiceRate(0)
    setIsAddServiceDialogOpen(true)
  }

  const handleOpenAddDeveloperDialog = (serviceId: number) => {
    setSelectedServiceForDeveloper(serviceId)
    setSelectedDeveloperToAdd(null)
    setDeveloperPricingMode('hourly')
    setDeveloperRates({ hourlyRate: 0, fixedPrice: 0, hoursWorked: 0 })
    setIsAddDeveloperDialogOpen(true)
  }

  const handleAddDeveloperSubmit = () => {
    if (!selectedDeveloperToAdd) return
    handleAddDeveloper(selectedDeveloperToAdd, developerPricingMode==='fixed'?{fixedPrice:developerRates.fixedPrice}:{hourlyRate:developerRates.hourlyRate,hoursWorked:developerRates.hoursWorked})
  }

  const handleAddDeveloper = async (developerId:number,rates:{hourlyRate?:number,fixedPrice?:number,hoursWorked?:number}) => {
    if(!selectedServiceForDeveloper||addingDeveloper)return
    setAddingDeveloper(true)
    try{
      await api.request(`/services/clients/${clientId}/services/${selectedServiceForDeveloper}/developers`,{method:'POST',body:JSON.stringify({teamMemberId:developerId,employmentType:'fulltime',hourlyRate:rates.fixedPrice!==undefined?null:rates.hourlyRate,fixedPrice:rates.fixedPrice ?? null,startDate:invoiceData.periodStart})})
      const fresh=await api.getClientServiceOptions(clientId)
      const assignment=fresh.clientServices.find(service=>service.id===selectedServiceForDeveloper)?.developers.find(dev=>dev.teamMemberId===developerId)
      if(!assignment)throw new Error('The project assignment could not be loaded. Refresh the project and retry.')
      setLocalClientServices(prev=>prev.map(service=>service.id===selectedServiceForDeveloper?{...service,developers:[...service.developers.filter(dev=>dev.id!==assignment.id),assignment]}:service))
      setInvoiceData(prev=>({...prev,developerRates:{...prev.developerRates,[assignment.id]:rates.fixedPrice!==undefined?{fixedPrice:rates.fixedPrice}:{hourlyRate:rates.hourlyRate || 0,hoursWorked:rates.hoursWorked || 0}}}))
      setExcludedDeveloperIds(previous=>previous.filter(id=>id!==assignment.id))
      setIsAddDeveloperDialogOpen(false);setSelectedServiceForDeveloper(null)
    }catch(error){showAlert({message:error instanceof Error?error.message:'Could not add project member',type:'error'})}finally{setAddingDeveloper(false)}
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

    setPricingLoading(true)
  }

  const getFinalTotal = () => calculatedTotal

  const handleCreateInvoice = () => {
    if(activeTab==='service-based' && (pricingLoading || pricingError || !pricingCalculation || lastPricedRequest!==pricingRequest)){showAlert({message:pricingError || 'Wait for the invoice preview to finish',type:'warning'});return}
    const finalData: CreateInvoiceData = {
      ...invoiceData,
      serviceIds: activeTab === 'service-based' ? selectedServices : undefined,
      useServicePricing: activeTab === 'service-based',
      developerRates: activeTab === 'service-based' ? selectedRates() : undefined,
      servicePrices: activeTab === 'service-based' ? customServicePrices : undefined,
      amount: activeTab === 'manual' ? invoiceData.amount : getFinalTotal()
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
    setExcludedDeveloperIds([])
    setLastPricedRequest('')
    setInvoiceData({
      clientId,
      amount: 0,
      invoiceDate: today,
      periodStart: firstOfMonth,
      periodEnd: lastOfMonth,
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
                    {clientServices.map((service: ClientServiceOption) => {
                      const displayServiceName = service.serviceTitle || service.serviceName

                      return (
                      <Card key={service.id} className="border-2 border-dashed border-gray-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={selectedServices.includes(service.id)}
                                onCheckedChange={() => handleServiceToggle(service.id)}
                              />
                              <div>
                                <CardTitle className="text-base">{displayServiceName}</CardTitle>
                                <CardDescription>
                                  {service.serviceTitle && `${service.serviceName} • `}
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
                              {service.developers.map((developer) => {
                                const devId = developer.id
                                const devRates = invoiceData.developerRates?.[devId] || {}

                                // Determine if we're in fixed mode based on what fields have values
                                const hasFixedPrice = devRates.fixedPrice !== undefined && devRates.fixedPrice !== null
                                const hasHourlyRate = devRates.hourlyRate !== undefined && devRates.hourlyRate !== null
                                const hasHoursWorked = devRates.hoursWorked !== undefined && devRates.hoursWorked !== null

                                // If we have fixed price, we're in fixed mode
                                // If we have hourly rate or hours worked, we're in hourly mode
                                // Otherwise, check defaults
                                let isFixed = false
                                if (hasFixedPrice) {
                                  isFixed = true
                                } else if (hasHourlyRate || hasHoursWorked) {
                                  isFixed = false
                                } else {
                                  // No user input yet, check defaults
                                  isFixed = developer.fixedPrice !== null && developer.fixedPrice !== undefined
                                }

                                return (
                                  <div key={developer.id} className="p-3 bg-gray-50 rounded space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium text-sm">{developer.developerName}</div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-white rounded-md border p-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // Switch to hourly - update all fields in one state update
                                              setInvoiceData(prev => ({
                                                ...prev,
                                                developerRates: {
                                                  ...prev.developerRates,
                                                  [devId]: {
                                                    hourlyRate: devRates.hourlyRate ?? parseFloat(developer.hourlyRate || '0'),
                                                    hoursWorked: devRates.hoursWorked || 0,
                                                    fixedPrice: undefined // Clear fixed price
                                                  }
                                                }
                                              }))
                                            }}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              !isFixed
                                                ? 'bg-blue-500 text-white'
                                                : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                          >
                                            Hourly
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              // Switch to fixed - update all fields in one state update
                                              setInvoiceData(prev => ({
                                                ...prev,
                                                developerRates: {
                                                  ...prev.developerRates,
                                                  [devId]: {
                                                    fixedPrice: devRates.fixedPrice ?? parseFloat(developer.fixedPrice || '0'),
                                                    hourlyRate: undefined, // Clear hourly rate
                                                    hoursWorked: undefined  // Clear hours worked
                                                  }
                                                }
                                              }))
                                            }}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              isFixed
                                                ? 'bg-blue-500 text-white'
                                                : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                          >
                                            Fixed
                                          </button>
                                        </div>
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

                                    {!isFixed ? (
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-600">Hourly Rate ($)</label>
                                          <Input
                                            type="number"
                                            placeholder="0.00"
                                            value={devRates.hourlyRate ?? developer.hourlyRate ?? ''}
                                            onChange={(e) => handleDeveloperRateChange(devId, 'hourlyRate', e.target.value)}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-600">Hours Worked</label>
                                          <Input
                                            type="number"
                                            placeholder="0"
                                            value={devRates.hoursWorked || ''}
                                            onChange={(e) => handleDeveloperRateChange(devId, 'hoursWorked', e.target.value)}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <label className="text-xs text-gray-600">Fixed Price ($)</label>
                                        <Input
                                          type="number"
                                          placeholder="0.00"
                                          value={devRates.fixedPrice ?? developer.fixedPrice ?? ''}
                                          onChange={(e) => handleDeveloperRateChange(devId, 'fixedPrice', e.target.value)}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                    )}

                                    <div className="text-right text-sm font-medium text-green-600">
                                      Total: ${(() => {
                                        // Try to get calculated amount from server first, otherwise calculate locally
                                        if (pricingCalculation) {
                                          const serviceCalc = pricingCalculation.find(calc =>
                                            localClientServices.some(service =>
                                              service.id === calc.serviceId &&
                                              service.developers.some(dev => dev.id === developer.id)
                                            )
                                          )
                                          const serverDev = serviceCalc?.developers.find(dev =>
                                            dev.id === developer.id
                                          )
                                          if (serverDev?.amount !== undefined) {
                                            return parseFloat(serverDev.amount.toString()).toLocaleString()
                                          }
                                        }

                                        // Fallback to local calculation
                                        const hourlyRate = devRates.hourlyRate ?? parseFloat(developer.hourlyRate || '0')
                                        const hoursWorked = devRates.hoursWorked || 0
                                        const fixedPrice = devRates.fixedPrice ?? parseFloat(developer.fixedPrice || '0')
                                        const total = isFixed ? fixedPrice : (hourlyRate * hoursWorked)
                                        return total.toLocaleString()
                                      })()}
                                    </div>
                                  </div>
                                )
                              })}
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
                      )
                    })}
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
                        <span className="font-medium">{calc.serviceTitle || calc.serviceName}</span>
                        <span className="font-bold">
                          ${Number(calc.finalAmount).toFixed(2)}
                        </span>
                      </div>
                      {calc.serviceLevelPrice !== undefined && (
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
                            const hourlyRate=Number(dev.hourlyRate || 0), hoursWorked=Number(dev.hoursWorked || 0), amount=Number(dev.amount)
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
          {pricingError && <p role="alert" className="text-sm text-red-600">{pricingError}</p>}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateInvoice}
            disabled={
              createInvoiceMutation.isPending || (activeTab === 'service-based' && (pricingLoading || !!pricingError)) ||
              (activeTab === 'manual' && !invoiceData.amount) ||
              (activeTab === 'service-based' && selectedServices.length === 0)
            }
          >
            {createInvoiceMutation.isPending ? 'Creating...' : pricingLoading ? 'Calculating...' : 'Create Invoice'}
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
            <Select value={selectedDeveloperToAdd?.toString() || ''} onValueChange={(value) => {
              const devId = parseInt(value)
              setSelectedDeveloperToAdd(devId)
              // Set default rate from developer profile if available
              const dev = allDevelopers?.find((d: any) => d.id === devId)
              if (dev && dev.hourlyRate) {
                setDeveloperRates(prev => ({ ...prev, hourlyRate: dev.hourlyRate }))
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a developer" />
              </SelectTrigger>
              <SelectContent>
                {allDevelopers?.filter((dev: any) => {
                  // Filter out developers already assigned to this service
                  const service = localClientServices.find(s => s.id === selectedServiceForDeveloper)
                  return !service?.developers.some(assigned => assigned.teamMemberId === dev.id)
                }).map((developer: any) => (
                  <SelectItem key={developer.id} value={developer.id.toString()} label={developer.name}>
                    {developer.name} {developer.hourlyRate && `($${developer.hourlyRate}/hr)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeveloperPricingMode('hourly')
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    developerPricingMode === 'hourly'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Hourly Billing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeveloperPricingMode('fixed')
                  }}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    developerPricingMode === 'fixed'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Fixed Price
                </button>
              </div>
            </div>

            {(developerPricingMode === 'hourly') ? (
              <div className="grid grid-cols-2 gap-3">
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
                  <p className="text-xs text-muted-foreground">Adding a person also creates their project assignment from the invoice period start.</p><Label htmlFor="hoursWorked">Hours Worked</Label>
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
              </div>
            ) : (
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
            )}

            {(developerRates.hourlyRate > 0 || developerRates.fixedPrice > 0) && (
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">Total Amount:</span>
                  <span className="text-lg font-bold text-green-600">
                    ${(developerPricingMode === 'fixed'
                      ? developerRates.fixedPrice
                      : (developerRates.hourlyRate * developerRates.hoursWorked)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
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
            disabled={!selectedDeveloperToAdd || addingDeveloper}
          >
            Add Developer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
