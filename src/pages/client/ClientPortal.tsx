import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { Building, FileText, DollarSign, Users, Calendar, Mail, Phone, MapPin, Download, Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { convertClientToClientDetails, type ClientDetails } from '@/lib/clientHelpers'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'

interface ServiceDeveloper {
  id: number
  developerId: number
  name: string
  email: string
  skills: string[]
  hourlyRate?: number
  fixedPrice?: number
  employmentType: 'fulltime' | 'part_time'
  isActive: boolean
  startDate: string
  endDate?: string
}

interface Document {
  id: number
  name: string
  type: string
  fileSize: number
  url: string
  createdAt: string
  lastUpdated: string
}

interface DocumentWithUploader {
  document: Document
  uploadedBy: {
    id: number
    fullName: string
    email: string
  }
}

interface DocumentWithService extends DocumentWithUploader {
  serviceName: string
  serviceTitle?: string | null
}

interface ClientContact {
  id: number
  clientId: number
  fullName: string
  position?: string
  email?: string
  phone?: string
  notes?: string
  isPrimary: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Invoice {
  id: number
  invoiceNumber: string
  amount: number
  invoiceDate: string
  periodStart: string
  periodEnd: string
  description?: string
  status: string
  dueDate?: string
  paidAt?: string
  notes?: string
}

export function ClientPortal() {
  const [, params] = useRoute('/client/portal/:clientId')
  if (!hasRouteParam(params, 'clientId')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'clientId')
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serviceDevelopers, setServiceDevelopers] = useState<Record<number, ServiceDeveloper[]>>({})
  const [documents, setDocuments] = useState<DocumentWithService[]>([])
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithService | null>(null)

  useEffect(() => {
    const loadClientData = async () => {
      if (!clientId) return

      try {
        // Load client details
        const clientResponse = await api.getClient(clientId)
        setClient(convertClientToClientDetails(clientResponse))

        // Load service developers
        if (clientResponse.services.length > 0) {
          const developersData: Record<number, ServiceDeveloper[]> = {}
          for (const service of clientResponse.services) {
            try {
              const developers = await api.getServiceDevelopers(parseInt(clientId), service.id)
              developersData[service.id] = developers
            } catch (error) {
              console.error(`Failed to load developers for service ${service.id}:`, error)
              developersData[service.id] = []
            }
          }
          setServiceDevelopers(developersData)
        }

        // Load documents (visible to client) from all active services
        try {
          const allDocs: DocumentWithService[] = []
          for (const service of clientResponse.services.filter((s: any) => s.isActive)) {
            try {
              const serviceDocsResponse = await api.getServiceDocumentsClientVisible(service.id)
              const serviceName = service.serviceTypeName || service.serviceType?.name || 'Service'
              const serviceTitle = service.serviceTitle

              // Add root documents with service info
              if (serviceDocsResponse.rootDocuments) {
                for (const doc of serviceDocsResponse.rootDocuments) {
                  allDocs.push({ ...doc, serviceName, serviceTitle })
                }
              }
              // Add documents from folders with service info
              if (serviceDocsResponse.folders) {
                for (const folder of serviceDocsResponse.folders) {
                  if (folder.documents) {
                    for (const doc of folder.documents) {
                      allDocs.push({ ...doc, serviceName, serviceTitle })
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to load documents for service ${service.id}:`, error)
            }
          }
          setDocuments(allDocs)
        } catch (error) {
          console.error('Failed to load documents:', error)
        }

        // Load contacts
        try {
          const contactsResponse = await api.request(`/client-contacts/client/${clientId}`)
          setContacts(contactsResponse)
        } catch (error) {
          console.error('Failed to load contacts:', error)
        }

        // Load invoices
        try {
          const invoicesResponse = await api.request(`/invoices/client/${clientId}`)
          setInvoices(invoicesResponse)
        } catch (error) {
          console.error('Failed to load invoices:', error)
        }

      } catch (error) {
        console.error('Failed to load client data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadClientData()
  }, [clientId])

  const handleDocumentDownload = async (documentId: number, filename: string) => {
    try {
      const blob = await api.requestBinary(`/documents/download/${documentId}`)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Failed to download document:', error)
      alert(error.message || 'Failed to download document')
    }
  }

  const handleDocumentPreview = (doc: DocumentWithService) => {
    setPreviewDocument(doc)
    setIsPreviewDialogOpen(true)
  }

  const getPreviewUrl = (documentId: number) => {
    return `/api/documents/preview/${documentId}`
  }

  const canPreview = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop()
    return ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif'].includes(ext || '')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // Calculate unique team members across all services (no duplicates)
  const getUniqueTeamSize = () => {
    const uniqueDeveloperIds = new Set<number>()
    Object.values(serviceDevelopers).forEach(developers => {
      developers.forEach(dev => {
        if (dev.isActive) {
          uniqueDeveloperIds.add(dev.developerId)
        }
      })
    })
    return uniqueDeveloperIds.size
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">You don't have permission to view this client portal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              {client.name}
            </h1>
            <p className="stripe-text-secondary text-lg">
              {client.industry || 'Company Overview'}
            </p>
            <div className="flex items-center space-x-4 mt-3">
              <Badge className={client.status === 'active' ? 'bg-green-100 text-green-800' : client.status === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                {client.status}
              </Badge>
              {client.contractType && (
                <Badge variant="outline" className="capitalize">
                  {client.contractType}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="stripe-stat-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Team Size</p>
              <p className="text-2xl font-bold text-gray-900">{getUniqueTeamSize()}</p>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Building className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Services</p>
              <p className="text-2xl font-bold text-gray-900">{client.services.filter(s => s.isActive).length}</p>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Documents</p>
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Information</CardTitle>
          <CardDescription>Current contract details and timeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {client.contractStart && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Start Date</p>
                  <p className="text-sm text-gray-600">{new Date(client.contractStart).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {client.contractEnd && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">End Date</p>
                  <p className="text-sm text-gray-600">{new Date(client.contractEnd).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {client.billingCycle && (
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Billing Cycle</p>
                  <p className="text-sm text-gray-600 capitalize">{client.billingCycle}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle>Your Services</CardTitle>
          <CardDescription>Services and team members assigned to your project</CardDescription>
        </CardHeader>
        <CardContent>
          {client.services.length > 0 ? (
            <div className="space-y-6">
              {client.services.map((service) => (
                <div key={service.id} className="border rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{service.serviceTypeName}</h4>
                      <Badge className={service.serviceCategory === 'outstaffing' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {service.serviceCategory}
                      </Badge>
                      <Badge variant="outline">
                        {service.billingModel}
                      </Badge>
                      {!service.isActive && (
                        <Badge variant="outline" className="text-red-600">
                          Ended
                        </Badge>
                      )}
                    </div>
                    {service.serviceDescription && (
                      <p className="text-sm text-gray-600 mb-2">{service.serviceDescription}</p>
                    )}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>Started: {new Date(service.startDate).toLocaleDateString()}</span>
                      {service.endDate && (
                        <span>Ended: {new Date(service.endDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="p-4">
                    <h5 className="text-sm font-medium text-gray-900 mb-3">Your Team</h5>
                    {serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {serviceDevelopers[service.id].map((developer) => (
                          <div key={developer.id} className="p-3 bg-white border rounded">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{developer.name}</p>
                                <p className="text-sm text-gray-500">{developer.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={developer.employmentType === 'fulltime' ? 'default' : 'secondary'} className="text-xs">
                                {developer.employmentType === 'fulltime' ? 'Full-time' : 'Part-time'}
                              </Badge>
                              {!developer.isActive && (
                                <Badge variant="outline" className="text-red-600 text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            {developer.skills && developer.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {developer.skills.slice(0, 3).map((skill, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {skill}
                                  </Badge>
                                ))}
                                {developer.skills.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{developer.skills.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No team members assigned yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">No services assigned yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Your main points of contact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((contact) => (
                <div key={contact.id} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900">{contact.fullName}</h4>
                    {contact.isPrimary && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" aria-label="Primary Contact" />
                    )}
                  </div>
                  {contact.position && (
                    <p className="text-sm text-gray-600 mb-2">{contact.position}</p>
                  )}
                  <div className="space-y-1">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">"{contact.notes}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Your project documents and files</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.document.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900">{doc.document.name}</p>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {doc.serviceTitle || doc.serviceName}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {doc.document.type && (
                            <Badge variant="outline" className="text-xs">
                              {doc.document.type}
                            </Badge>
                          )}
                          <span>{formatFileSize(doc.document.fileSize)}</span>
                          <span>Uploaded: {new Date(doc.document.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPreview(doc.document.name) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDocumentPreview(doc)}
                        className="text-green-600 hover:text-green-700"
                        title="Preview document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDocumentDownload(doc.document.id, doc.document.name)}
                      className="text-blue-600 hover:text-blue-700"
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">No documents available yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Your billing history and invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>Period: {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}</span>
                          <span>Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {invoice.description && (
                      <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
                    <Badge className={
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">No invoices available yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      {isPreviewDialogOpen && previewDocument && (
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                Preview: {previewDocument.document.name}
              </DialogTitle>
            </DialogHeader>
            <div className="w-full h-[70vh] border rounded">
              {previewDocument.document.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={getPreviewUrl(previewDocument.document.id)}
                  className="w-full h-full"
                  title="Document Preview"
                />
              ) : previewDocument.document.name.toLowerCase().endsWith('.txt') ? (
                <iframe
                  src={getPreviewUrl(previewDocument.document.id)}
                  className="w-full h-full bg-white"
                  title="Document Preview"
                />
              ) : ['jpg', 'jpeg', 'png', 'gif'].some(ext =>
                  previewDocument.document.name.toLowerCase().endsWith(ext)
                ) ? (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <img
                    src={getPreviewUrl(previewDocument.document.id)}
                    alt="Document Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Preview not available</p>
                    <p className="text-sm">This file type cannot be previewed in the browser.</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}