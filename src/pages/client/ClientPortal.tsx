import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { Building, FileText, DollarSign, Users, Calendar, Mail, Phone, Download, Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { parseLocalDate } from '@/lib/utils'
import { convertClientToClientDetails, type ClientDetails } from '@/lib/clientHelpers'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

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
  const { showAlert } = useCustomAlert()
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
      showAlert({ message: error.message || 'Failed to download document', type: 'error' })
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
      <EmptyState
        title="Access denied"
        description="You do not have permission to view this client portal."
      />
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHero
        eyebrow="Client Portal"
        title={client.name}
        description={client.industry || 'Company overview'}
        theme="amber"
        meta={
          <>
            <Badge className={client.status === 'active' ? 'bg-emerald-100 text-emerald-800' : client.status === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
              {client.status}
            </Badge>
            {client.contractType && (
              <Badge variant="outline" className="border-white/20 bg-white/10 capitalize text-white">
                {client.contractType}
              </Badge>
            )}
            <span className="h-1 w-1 rounded-full bg-slate-400"></span>
            <span>{documents.length} shared documents</span>
            <span className="h-1 w-1 rounded-full bg-slate-400"></span>
            <span>{invoices.length} invoices</span>
          </>
        }
      />

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile label="Team Size" value={getUniqueTeamSize()} hint="Assigned delivery specialists" icon={<Users className="h-5 w-5" />} tone="primary" />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile label="Active Services" value={client.services.filter(s => s.isActive).length} hint="Current delivery lanes" icon={<Building className="h-5 w-5" />} tone="emerald" />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile label="Documents" value={documents.length} hint="Shared files and folders" icon={<FileText className="h-5 w-5" />} tone="violet" />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile label="Invoices" value={invoices.length} hint="Billing history in portal" icon={<DollarSign className="h-5 w-5" />} tone="amber" />
        </div>
      </div>

      <Card className="content-auto">
        <CardHeader>
          <SectionHeading title="Contract Information" description="Current contract details and timeline" icon={<Calendar className="h-5 w-5" />} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {client.contractStart && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Start Date</p>
                  <p className="text-sm text-muted-foreground">{new Date(client.contractStart).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {client.contractEnd && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">End Date</p>
                  <p className="text-sm text-muted-foreground">{new Date(client.contractEnd).toLocaleDateString()}</p>
                </div>
              </div>
            )}
            {client.billingCycle && (
              <div className="flex items-center space-x-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Billing Cycle</p>
                  <p className="text-sm capitalize text-muted-foreground">{client.billingCycle}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="content-auto">
        <CardHeader>
          <SectionHeading title="Your Services" description="Services and team members assigned to your project" icon={<Building className="h-5 w-5" />} />
        </CardHeader>
        <CardContent>
          {client.services.length > 0 ? (
            <div className="space-y-6">
              {client.services.map((service) => (
                <div key={service.id} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-white/70">
                  <div className="border-b border-border/60 bg-muted/45 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <h4 className="font-medium text-foreground">{service.serviceTypeName}</h4>
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
                      <p className="mb-2 text-sm text-muted-foreground">{service.serviceDescription}</p>
                    )}
                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                      <span>Started: {parseLocalDate(service.startDate).toLocaleDateString()}</span>
                      {service.endDate && (
                        <span>Ended: {parseLocalDate(service.endDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="p-4">
                    <h5 className="mb-3 text-sm font-medium text-foreground">Your Team</h5>
                    {serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                        {serviceDevelopers[service.id].map((developer) => (
                          <div key={developer.id} className="rounded-[1rem] border border-border/60 bg-white/80 p-3">
                            <div className="mb-2 flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{developer.name}</p>
                                <p className="truncate text-sm text-muted-foreground">{developer.email}</p>
                              </div>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
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
                      <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No services assigned" description="This portal does not currently have active services attached." />
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      {contacts.length > 0 && (
        <Card className="content-auto">
          <CardHeader>
            <SectionHeading title="Contact Information" description="Your main points of contact" icon={<Mail className="h-5 w-5" />} />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded-[1rem] border border-border/60 bg-white/75 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{contact.fullName}</h4>
                    {contact.isPrimary && (
                      <Star className="h-4 w-4 text-yellow-500 fill-current" aria-label="Primary Contact" />
                    )}
                  </div>
                  {contact.position && (
                    <p className="mb-2 text-sm text-muted-foreground">{contact.position}</p>
                  )}
                  <div className="space-y-1">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="mt-2 text-xs italic text-muted-foreground">"{contact.notes}"</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card className="content-auto">
        <CardHeader>
          <SectionHeading title="Documents" description="Your project documents and files" icon={<FileText className="h-5 w-5" />} />
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.document.id} className="flex flex-col gap-3 rounded-[1rem] border border-border/60 bg-white/75 p-4 transition hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium text-gray-900">{doc.document.name}</p>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            {doc.serviceTitle || doc.serviceName}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
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
      <Card className="content-auto">
        <CardHeader>
          <SectionHeading title="Invoices" description="Your billing history and invoice status" icon={<DollarSign className="h-5 w-5" />} />
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border p-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start gap-3">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span>Period: {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}</span>
                          <span>Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {invoice.description && (
                      <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
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
