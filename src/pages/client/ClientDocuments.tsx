import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Folder,
  ChevronDown,
  ChevronRight,
  Building2,
  Upload,
  UserCircle,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClientLoadError, isCurrentAssignment, useClientDocumentPreview } from '@/lib/clientWorkspace'
import { api } from '@/lib/api'
import { formatDate, parseLocalDate } from '@/lib/utils'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'
import type { ClientService } from '@/types/common'

interface Document {
  id: number
  name: string
  documentTitle: string | null
  type: string | null
  fileSize: number | null
  url: string
  folderId: number | null
  visibleToClient: boolean
  createdAt: string
  lastUpdated: string
}

interface DocumentWithUploader {
  document: Document
  uploadedBy: {
    id: number
    fullName: string
    email: string
  } | null
}

interface DocumentFolder {
  id: number
  name: string
  parentFolderId: number | null
  documents: DocumentWithUploader[]
}

interface ServiceDocuments {
  folders: DocumentFolder[]
  rootDocuments: DocumentWithUploader[]
  service: ClientService
}

export function ClientDocuments() {
  const { showAlert } = useCustomAlert()
  const [, params] = useRoute('/client/documents/:clientId')
  if (!hasRouteParam(params, 'clientId')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'clientId')

  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [services, setServices] = useState<ClientService[]>([])
  const [serviceDocuments, setServiceDocuments] = useState<Record<number, ServiceDocuments>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadingServices, setLoadingServices] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [viewingFolder, setViewingFolder] = useState<DocumentFolder | null>(null)
  const [isFolderViewDialogOpen, setIsFolderViewDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithUploader | null>(null)

  const preview = useClientDocumentPreview(previewDocument?.document.id, isPreviewDialogOpen)

  // Access level for the current user (read, write, or admin)
  const [accessLevel, setAccessLevel] = useState<string | null>(null)

  // Upload states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<ClientService | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showFolderSelect, setShowFolderSelect] = useState(false)

  // Check if user can upload documents (write or admin access level)
  const canUpload = accessLevel === 'write' || accessLevel === 'admin'

  useEffect(() => {
    const loadServices = async () => {
      if (!clientId) return

      try {
        setIsLoading(true)
        setLoadError('')
        setServiceDocuments({})
        setAccessLevel(null)
        // Get client data which includes services and access level
        const clientData = await api.getClient(clientId)

        // Set the user's access level for this client
        if (clientData?.accessLevel) {
          setAccessLevel(clientData.accessLevel)
        }

        if (clientData?.services) {
          setServices(clientData.services.filter(service => isCurrentAssignment(service)))
          // Auto-expand all services
          setExpandedServices(new Set(clientData.services.map((s: any) => s.id)))
          // Load documents for each service
          for (const service of clientData.services.filter(service => isCurrentAssignment(service))) {
            loadServiceDocuments(service.id)
          }
        }
      } catch (error) {
        setLoadError('Unable to load project documents. Please retry.')
      } finally {
        setIsLoading(false)
      }
    }

    loadServices()
  }, [clientId, retry])

  const loadServiceDocuments = async (serviceId: number) => {
    if (loadingServices.has(serviceId)) return

    try {
      setLoadingServices(prev => new Set(prev).add(serviceId))
      const data = await api.getServiceDocumentsClientVisible(serviceId)
      setServiceDocuments(prev => ({ ...prev, [serviceId]: data }))
    } catch (error) {
      setLoadError('Some project documents could not be loaded. Please retry.')
    } finally {
      setLoadingServices(prev => {
        const newSet = new Set(prev)
        newSet.delete(serviceId)
        return newSet
      })
    }
  }

  const toggleService = (serviceId: number) => {
    // Reset viewing folder when toggling service
    setViewingFolder(null)

    setExpandedServices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId)
      } else {
        newSet.add(serviceId)
      }
      return newSet
    })
  }


  const openUploadDialog = (service: ClientService, folderId: number | null = null) => {
    setSelectedService(service)
    setTargetFolderId(folderId)
    setShowFolderSelect(folderId === null)
    setIsUploadDialogOpen(true)
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setDocumentTitle('')
    setTargetFolderId(null)
    setShowFolderSelect(false)
  }

  const handleUploadDocument = async () => {
    if (!selectedFile || !selectedService) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('document', selectedFile)
      formData.append('clientId', clientId.toString())
      formData.append('clientServiceId', selectedService.id.toString())
      if (documentTitle.trim()) {
        formData.append('documentTitle', documentTitle.trim())
      }
      // Documents uploaded by clients are always visible to clients
      formData.append('visibleToClient', 'true')
      if (targetFolderId) {
        formData.append('folderId', targetFolderId.toString())
      }

      await api.uploadServiceDocument(formData)
      await loadServiceDocuments(selectedService.id)
      setIsUploadDialogOpen(false)
      resetUploadForm()
      showAlert({ message: 'Document uploaded successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Error uploading document:', error)
      showAlert({ message: error.message || 'Failed to upload document', type: 'error' })
    } finally {
      setIsUploading(false)
    }
  }

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

  const getTotalDocuments = () => {
    let total = 0
    Object.values(serviceDocuments).forEach(sd => {
      total += sd.rootDocuments.length
      sd.folders.forEach(f => {
        total += f.documents.length
      })
    })
    return total
  }

  const getTotalFolders = () => {
    return Object.values(serviceDocuments).reduce((total, service) => total + service.folders.length, 0)
  }

  const renderDocument = (doc: DocumentWithUploader) => {
    return (
      <Card
        key={doc.document.id}
        className="border-white/80 bg-white/92 shadow-[0_22px_45px_-34px_rgba(15,23,42,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-34px_rgba(15,23,42,0.48)]"
        data-testid="document-item"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex-shrink-0 rounded-[0.95rem] bg-primary/10 p-2.5 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="truncate font-semibold text-foreground">
                    {doc.document.documentTitle || doc.document.name}
                  </h3>
                </div>
                {doc.document.documentTitle && (
                  <p className="mb-1 truncate text-xs text-muted-foreground">{doc.document.name}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {doc.document.type && (
                    <Badge variant="outline" className="text-xs">
                      {doc.document.type}
                    </Badge>
                  )}
                  <span>{formatFileSize(doc.document.fileSize)}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(doc.document.createdAt)}
                  </span>
                  {doc.uploadedBy && <Badge variant="outline" className="text-xs">{doc.uploadedBy.fullName || 'Uploader'}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
              {canPreview(doc.document.name) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPreviewDocument(doc); setIsPreviewDialogOpen(true) }}
                  className="text-green-600 hover:text-green-700"
                  title="Preview document"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDocumentDownload(doc.document.id, doc.document.name)}
                className="text-blue-600 hover:text-blue-700"
                title="Download this document"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const openFolderViewDialog = (folder: DocumentFolder) => {
    setViewingFolder(folder)
    setIsFolderViewDialogOpen(true)
  }

  const renderFolderCard = (folder: DocumentFolder) => (
    <div
      key={folder.id}
      className="cursor-pointer rounded-[1.2rem] border border-border/70 bg-white/85 p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.4)]"
      onClick={() => openFolderViewDialog(folder)}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-[0.95rem] bg-amber-100 p-2.5 text-amber-700">
          <Folder className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{folder.name}</h4>
          <p className="text-xs text-muted-foreground">
            {folder.documents.length} document{folder.documents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {folder.documents.length}
        </Badge>
      </div>
    </div>
  )

  const renderServiceContent = (service: ClientService) => {
    const docs = serviceDocuments[service.id]
    const isLoadingDocs = loadingServices.has(service.id)

    if (isLoadingDocs) {
      return (
        <div className="p-4 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      )
    }

    if (!docs) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <p>Loading documents...</p>
        </div>
      )
    }

    const hasContent = docs.folders.length > 0 || docs.rootDocuments.length > 0

    if (!hasContent) {
      return (
        <div className="p-4">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No documents yet"
            description="Files uploaded to this service will appear here."
          />
        </div>
      )
    }

    return (
      <div className="p-4 space-y-4">
        {/* Folders Grid */}
        {docs.folders.length > 0 && (
          <div>
            <h5 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Folders
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.folders.map(folder => renderFolderCard(folder))}
            </div>
          </div>
        )}

        {/* Root documents */}
        {docs.rootDocuments.length > 0 && (
          <div className={docs.folders.length > 0 ? 'border-t pt-4' : ''}>
            {docs.folders.length > 0 && (
              <h5 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                General Documents
              </h5>
            )}
            <div className="space-y-2">
              {docs.rootDocuments.map(doc => renderDocument(doc))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (loadError) return <ClientLoadError message={loadError} onRetry={() => setRetry(value => value + 1)} />

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Client Workspace"
        title="Document center"
        description="Access service folders, client-uploaded files, and shared project documents from a single structured workspace."
        theme="ocean"
        meta={(
          <>
            <span className="hero-meta-pill">
              Access: {accessLevel || 'read'}
            </span>
            <span className="hero-meta-pill">
              {services.length} service{services.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Documents"
          value={getTotalDocuments()}
          hint="Across all visible services"
          icon={<FileText className="h-5 w-5" />}
          tone="primary"
        />
        <MetricTile
          label="Folders"
          value={getTotalFolders()}
          hint="Structured project archives"
          icon={<Folder className="h-5 w-5" />}
          tone="amber"
        />
        <MetricTile
          label="Upload Access"
          value={canUpload ? 'Enabled' : 'Read only'}
          hint={canUpload ? 'You can add new client documents' : 'Uploads require write or admin access'}
          icon={<Upload className="h-5 w-5" />}
          tone={canUpload ? 'emerald' : 'slate'}
        />
      </div>

      {services.length > 0 ? (
        <div className="space-y-4">
          <SectionHeading
            title="Services and folders"
            description="Each service keeps its own file stream, folders, and general documents."
            icon={<Building2 className="h-5 w-5" />}
          />
          {services.map(service => (
            <Card key={service.id} className="overflow-hidden border-white/80 bg-white/90">
              <CardHeader
                className="cursor-pointer transition-colors hover:bg-muted/25"
                onClick={() => toggleService(service.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedServices.has(service.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="rounded-[0.95rem] bg-primary/10 p-2.5 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{service.serviceTypeName}</CardTitle>
                        {service.serviceTitle && (
                          <Badge className="bg-indigo-600 text-white">
                            {service.serviceTitle}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={service.serviceCategory === 'outstaffing'
                            ? 'border-sky-200 bg-sky-50 text-sky-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }
                        >
                          {service.serviceCategory}
                        </Badge>
                        <span className="text-muted-foreground">
                          Started {formatDate(parseLocalDate(service.startDate))}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canUpload && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          openUploadDialog(service)
                        }}
                        title="Upload a document"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </Button>
                    )}
                    {serviceDocuments[service.id] && (
                      <Badge variant="secondary">
                        {serviceDocuments[service.id].rootDocuments.length +
                          serviceDocuments[service.id].folders.reduce(
                            (acc, f) => acc + f.documents.length,
                            0
                          )}{' '}
                        documents
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedServices.has(service.id) && (
                <CardContent className="border-t border-border/70">
                  {renderServiceContent(service)}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No documents available"
          description="Project files will appear here once the first service documents are uploaded."
        />
      )}

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

      {/* Folder View Dialog */}
      <Dialog open={isFolderViewDialogOpen} onOpenChange={setIsFolderViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-yellow-500" />
              {viewingFolder?.name}
            </DialogTitle>
            <DialogDescription>
              {viewingFolder?.documents.length || 0} document{(viewingFolder?.documents.length || 0) !== 1 ? 's' : ''} in this folder
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {viewingFolder?.documents && viewingFolder.documents.length > 0 ? (
              viewingFolder.documents.map(doc => renderDocument(doc))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No documents in this folder</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="w-full">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document to {selectedService?.serviceTypeName}
              {targetFolderId && serviceDocuments[selectedService?.id || 0]?.folders.find(f => f.id === targetFolderId)
                ? ` / ${serviceDocuments[selectedService?.id || 0]?.folders.find(f => f.id === targetFolderId)?.name}`
                : ''
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="documentFile">Select File</Label>
              <Input
                id="documentFile"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
              />
              {selectedFile && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="documentTitle">Document Title (optional)</Label>
              <Input
                id="documentTitle"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Enter a title for this document"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to use the filename
              </p>
            </div>

            {/* Folder select - only show when uploading from service level */}
            {showFolderSelect && selectedService && serviceDocuments[selectedService.id]?.folders.length > 0 && (
              <div>
                <Label htmlFor="selectFolder">Select Folder (optional)</Label>
                <Select
                  value={targetFolderId?.toString() || 'none'}
                  onValueChange={(value) => setTargetFolderId(value === 'none' ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No folder (General Documents)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      No folder (General Documents)
                    </SelectItem>
                    {serviceDocuments[selectedService.id]?.folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id.toString()}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to add to General Documents
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <p>Supported formats: PDF, Word, Excel, Images, Text</p>
              <p>Maximum file size: 10MB</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsUploadDialogOpen(false)
              resetUploadForm()
            }}>
              Cancel
            </Button>
            <Button onClick={handleUploadDocument} disabled={isUploading || !selectedFile}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
