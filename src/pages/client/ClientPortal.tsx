import { AccountContact } from '@/components/AccountContact'
import { StripeInvoiceButton } from '@/components/StripeInvoiceButton'
import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { Building, FileText, DollarSign, Users, Calendar, Mail, Phone, Download, Eye, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ClientLoadError, isCurrentAssignment, useClientDocumentPreview } from '@/lib/clientWorkspace'
import { api } from '@/lib/api'
import { formatDate, parseLocalDate } from '@/lib/utils'
import { convertClientToClientDetails, type ClientDetails } from '@/lib/clientHelpers'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { CardSkeleton, EmptyState, MetricTile, MetricTileSkeleton, PageHero, PageHeroSkeleton, SectionHeading } from '@/components/page-primitives'

interface ServiceDeveloper {
  id: number
  developerId: number
  name: string
  email: string
  skills: string[]
  hourlyRate?: number
  fixedPrice?: number
  employmentType: 'fulltime' | 'part_time' | 'freelancer'
  isActive: boolean
  startDate: string
  endDate?: string
}

interface Document {
  id: number
  name: string
  type: string
  fileSize: number | null
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
  stripeInvoiceId?: string | null
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
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [isClientLoading, setIsClientLoading] = useState(true)
  const [serviceDevelopers, setServiceDevelopers] = useState<Record<number, ServiceDeveloper[]>>({})
  const [isDevelopersLoading, setIsDevelopersLoading] = useState(true)
  const [documents, setDocuments] = useState<DocumentWithService[]>([])
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(true)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [isContactsLoading, setIsContactsLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithService | null>(null)

  const preview = useClientDocumentPreview(previewDocument?.document.id, isPreviewDialogOpen)

  useEffect(() => {
    const loadClientData = async () => {
      if (!clientId) return

      try {
        setLoadError('')
        setIsClientLoading(true)
        // Load client details
        const clientResponse = await api.getClient(clientId)
        setClient(convertClientToClientDetails(clientResponse))
        setIsClientLoading(false)

        const activeServices = (clientResponse.services || []).filter(service => isCurrentAssignment(service))

        // Load service developers, documents, contacts, and invoices independently so each
        // section can reveal as soon as its own data is ready.
        setIsDevelopersLoading(true)
        setIsDocumentsLoading(true)
        setIsContactsLoading(true)
        setIsInvoicesLoading(true)

        const developersPromise = (async () => {
          const developersData = await api.getServiceDeveloperAssignments({ clientId: parseInt(clientId) })
          setServiceDevelopers(developersData as Record<number, ServiceDeveloper[]>)
        })().catch(() => setLoadError('Unable to load team assignments. Please retry.')).finally(() => {
          setIsDevelopersLoading(false)
        })

        const documentsPromise = (async () => {
          try {
            const allDocs: DocumentWithService[] = []
            for (const service of activeServices) {
              try {
                const serviceDocsResponse = await api.getServiceDocumentsClientVisible(service.id)
                const serviceName = service.serviceTypeName || service.serviceType?.name || 'Service'
                const serviceTitle = service.serviceTitle

                if (serviceDocsResponse.rootDocuments) {
                  for (const doc of serviceDocsResponse.rootDocuments) {
                    allDocs.push({ ...doc, serviceName, serviceTitle })
                  }
                }
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
                setLoadError('Unable to load some project documents. Please retry.')
              }
            }
            setDocuments(allDocs)
          } catch (error) {
            setLoadError('Unable to load documents. Please retry.')
          }
        })().finally(() => {
          setIsDocumentsLoading(false)
        })

        const contactsPromise = (async () => {
          try {
            const contactsResponse = await api.request(`/client-contacts/client/${clientId}`)
            setContacts(contactsResponse)
          } catch (error) {
            setLoadError('Unable to load contacts. Please retry.')
          }
        })().finally(() => {
          setIsContactsLoading(false)
        })

        const invoicesPromise = (async () => {
          try {
            const invoicesResponse = await api.request(`/invoices/client/${clientId}`)
            setInvoices(invoicesResponse)
          } catch (error) {
            setLoadError('Unable to load invoices. Please retry.')
          }
        })().finally(() => {
          setIsInvoicesLoading(false)
        })

        await Promise.allSettled([developersPromise, documentsPromise, contactsPromise, invoicesPromise])
      } catch (error) {
        setLoadError('Unable to load this client workspace. Please retry.')
        setIsClientLoading(false)
      } finally {
        setIsClientLoading(false)
      }
    }

    loadClientData()
  }, [clientId, retry])

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
    return preview.url || 'about:blank'
  }

  const canPreview = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop()
    return ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif'].includes(ext || '')
  }

  const formatFileSize = (bytes: unknown) => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'Size unavailable'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.max(0, Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k))))
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
    Object.entries(serviceDevelopers).forEach(([serviceId, developers]) => {
      if (!client?.services.some(service => service.id === Number(serviceId) && isCurrentAssignment(service))) return
      developers.forEach(dev => {
        if (isCurrentAssignment(dev)) {
          uniqueDeveloperIds.add(dev.developerId)
        }
      })
    })
    return uniqueDeveloperIds.size
  }

  if (isClientLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PageHeroSkeleton />

        <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
              <MetricTileSkeleton />
            </div>
          ))}
        </div>

        <CardSkeleton titleWidth="w-40" lines={3} />
        <CardSkeleton titleWidth="w-32" lines={4} />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <CardSkeleton titleWidth="w-36" lines={4} tall />
          <CardSkeleton titleWidth="w-44" lines={4} tall />
        </div>
      </div>
    )
  }

  if (!client && loadError) return <ClientLoadError message={loadError} onRetry={() => setRetry(value => value + 1)} />

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
      {loadError && <ClientLoadError message={loadError} onRetry={() => setRetry(value => value + 1)} />}
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
              <Badge variant="outline" className="hero-meta-pill capitalize">
                {client.contractType}
              </Badge>
            )}
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <span>{isDocumentsLoading ? 'Loading documents...' : `${documents.length} shared documents`}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <span>{isInvoicesLoading ? 'Loading invoices...' : `${invoices.length} invoices`}</span>
          </>
        }
      />

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          {isDevelopersLoading ? (
            <MetricTileSkeleton />
          ) : (
            <MetricTile label="Team Size" value={getUniqueTeamSize()} hint="Assigned delivery specialists" icon={<Users className="h-5 w-5" />} tone="primary" />
          )}
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile label="Active Services" value={client.services.filter(service => isCurrentAssignment(service)).length} hint="Current projects" icon={<Building className="h-5 w-5" />} tone="emerald" />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          {isDocumentsLoading ? (
            <MetricTileSkeleton />
          ) : (
            <MetricTile label="Documents" value={documents.length} hint="Shared files and folders" icon={<FileText className="h-5 w-5" />} tone="violet" />
          )}
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          {isInvoicesLoading ? (
            <MetricTileSkeleton />
          ) : (
            <MetricTile label="Invoices" value={invoices.length} hint="Billing history in portal" icon={<DollarSign className="h-5 w-5" />} tone="amber" />
          )}
        </div>
      </div>

      <AccountContact/>

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
                  <p className="text-sm text-muted-foreground">{formatDate(client.contractStart)}</p>
                </div>
              </div>
            )}
            {client.contractEnd && (
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">End Date</p>
                  <p className="text-sm text-muted-foreground">{formatDate(client.contractEnd)}</p>
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
          <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={showHistory} onChange={event => setShowHistory(event.target.checked)} />Show past and upcoming projects and assignments</label>
          {isDevelopersLoading ? (
            <CardSkeleton titleWidth="w-32" lines={4} tall />
          ) : client.services.filter(service => showHistory || isCurrentAssignment(service)).length > 0 ? (
            <div className="space-y-6">
              {client.services.filter(service => showHistory || isCurrentAssignment(service)).map((service) => (
                <div key={service.id} className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-white/70">
                  <div className="border-b border-border/60 bg-muted/45 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <h4 className="font-medium text-foreground">{service.serviceTitle || service.serviceTypeName}</h4>
                      <Badge className={service.serviceCategory === 'outstaffing' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {service.serviceCategory}
                      </Badge>
                      <Badge variant="outline">
                        {service.billingModel}
                      </Badge>
                      {!isCurrentAssignment(service) && (
                        <Badge variant="outline" className="text-red-600">
                          {service.startDate > new Date().toISOString().slice(0, 10) ? 'Scheduled' : 'Ended'}
                        </Badge>
                      )}
                    </div>
                    {service.serviceDescription && (
                      <p className="mb-2 text-sm text-muted-foreground">{service.serviceDescription}</p>
                    )}
                    <div className="flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
                      <span>Started: {formatDate(parseLocalDate(service.startDate))}</span>
                      {service.endDate && (
                        <span>Ended: {formatDate(parseLocalDate(service.endDate))}</span>
                      )}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="p-4">
                    <h5 className="mb-3 text-sm font-medium text-foreground">Your Team</h5>
                    {serviceDevelopers[service.id] && serviceDevelopers[service.id].some(developer => showHistory || isCurrentAssignment(developer)) ? (
                      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                        {serviceDevelopers[service.id].filter(developer => showHistory || isCurrentAssignment(developer)).map((developer) => (
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
                                {developer.employmentType === 'fulltime' ? 'Full-time' : developer.employmentType === 'part_time' ? 'Part-time' : 'Freelancer'}
                              </Badge>
                              {!isCurrentAssignment(developer) && (
                                <Badge variant="outline" className="text-red-600 text-xs">
                                  {developer.startDate > new Date().toISOString().slice(0, 10) ? 'Scheduled' : 'Ended'}
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
      {isContactsLoading ? (
        <CardSkeleton titleWidth="w-36" lines={4} tall />
      ) : contacts.length > 0 && (
        <Card className="content-auto">
          <CardHeader>
            <SectionHeading title="Company contacts" description="Contacts listed for your company" icon={<Mail className="h-5 w-5" />} />
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
          {isDocumentsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[1rem] border border-border/60 bg-white/75 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-md bg-slate-200/80 animate-pulse" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-2/5 rounded-full bg-slate-200/80 animate-pulse" />
                      <div className="h-3 w-3/4 rounded-full bg-slate-200/80 animate-pulse" />
                    </div>
                    <div className="h-9 w-24 rounded-full bg-slate-200/80 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length > 0 ? (
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
                          <span>Uploaded: {formatDate(doc.document.createdAt)}</span>
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
                          <span>Period: {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}</span>
                          <span>Due: {invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    {invoice.description && (
                      <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
                    {invoice.stripeInvoiceId && <StripeInvoiceButton id={invoice.id}/>}
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
              {preview.error && <ClientLoadError message={preview.error} onRetry={preview.retry} />}
              {!preview.url && !preview.error && <p role="status">Loading preview…</p>}
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
