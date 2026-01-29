import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import {
  FileText,
  Download,
  Eye,
  Calendar,
  User,
  Folder,
  ChevronDown,
  ChevronRight,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'

interface Document {
  id: number
  name: string
  documentTitle: string | null
  type: string | null
  fileSize: number
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

interface ClientService {
  id: number
  clientId: number
  serviceTypeName: string
  serviceCategory: string
  serviceTitle: string | null
  startDate: string
}

interface ServiceDocuments {
  folders: DocumentFolder[]
  rootDocuments: DocumentWithUploader[]
  service: ClientService
}

export function ClientDocuments() {
  const [, params] = useRoute('/client/documents/:clientId')
  if (!hasRouteParam(params, 'clientId')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'clientId')

  const [services, setServices] = useState<ClientService[]>([])
  const [serviceDocuments, setServiceDocuments] = useState<Record<number, ServiceDocuments>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadingServices, setLoadingServices] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [viewingFolder, setViewingFolder] = useState<DocumentFolder | null>(null)
  const [isFolderViewDialogOpen, setIsFolderViewDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithUploader | null>(null)

  useEffect(() => {
    const loadServices = async () => {
      if (!clientId) return

      try {
        // Get client data which includes services
        const clientData = await api.request(`/client/${clientId}`)
        if (clientData?.services) {
          setServices(clientData.services.filter((s: any) => s.isActive))
          // Auto-expand all services
          setExpandedServices(new Set(clientData.services.map((s: any) => s.id)))
          // Load documents for each service
          for (const service of clientData.services.filter((s: any) => s.isActive)) {
            loadServiceDocuments(service.id)
          }
        }
      } catch (error) {
        console.error('Failed to load services:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadServices()
  }, [clientId])

  const loadServiceDocuments = async (serviceId: number) => {
    if (loadingServices.has(serviceId)) return

    try {
      setLoadingServices(prev => new Set(prev).add(serviceId))
      const data = await api.getServiceDocumentsClientVisible(serviceId)
      setServiceDocuments(prev => ({ ...prev, [serviceId]: data }))
    } catch (error) {
      console.error('Error loading service documents:', error)
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

  const handleDocumentPreview = (doc: DocumentWithUploader) => {
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

  const renderDocument = (doc: DocumentWithUploader) => (
    <Card key={doc.document.id} className="hover:shadow-md transition-shadow" data-testid="document-item">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="p-2 bg-gray-100 rounded flex-shrink-0">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-1 truncate">
                {doc.document.documentTitle || doc.document.name}
              </h3>
              {doc.document.documentTitle && (
                <p className="text-xs text-gray-400 truncate mb-1">{doc.document.name}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                {doc.document.type && (
                  <Badge variant="outline" className="text-xs">
                    {doc.document.type}
                  </Badge>
                )}
                <span>{formatFileSize(doc.document.fileSize)}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(doc.document.createdAt).toLocaleDateString()}
                </span>
                {doc.uploadedBy && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {doc.uploadedBy.fullName}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
            {canPreview(doc.document.name) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getPreviewUrl(doc.document.id), '_blank')}
                className="text-green-600 hover:text-green-700"
                title="Open preview in new tab"
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

  const openFolderViewDialog = (folder: DocumentFolder) => {
    setViewingFolder(folder)
    setIsFolderViewDialogOpen(true)
  }

  const renderFolderCard = (folder: DocumentFolder) => (
    <div
      key={folder.id}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => openFolderViewDialog(folder)}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-yellow-50 rounded-lg">
          <Folder className="h-5 w-5 text-yellow-500" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{folder.name}</h4>
          <p className="text-xs text-gray-500">
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
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )
    }

    if (!docs) {
      return (
        <div className="p-4 text-center text-gray-500">
          <p>Loading documents...</p>
        </div>
      )
    }

    const hasContent = docs.folders.length > 0 || docs.rootDocuments.length > 0

    if (!hasContent) {
      return (
        <div className="p-4 text-center text-gray-500">
          <FileText className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p>No documents available for this service yet</p>
        </div>
      )
    }

    return (
      <div className="p-4 space-y-4">
        {/* Folders Grid */}
        {docs.folders.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
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
              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg">
          <FileText className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600">
            Your project documents and files
            {getTotalDocuments() > 0 && (
              <span className="ml-2 text-sm">({getTotalDocuments()} documents)</span>
            )}
          </p>
        </div>
      </div>

      {services.length > 0 ? (
        <div className="space-y-4">
          {services.map(service => (
            <Card key={service.id}>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleService(service.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedServices.has(service.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
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
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                          }
                        >
                          {service.serviceCategory}
                        </Badge>
                        <span className="text-gray-500">
                          Started {new Date(service.startDate).toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
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
              </CardHeader>

              {expandedServices.has(service.id) && (
                <CardContent className="border-t">
                  {renderServiceContent(service)}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents available</h3>
            <p className="text-gray-600">Your project documents will appear here when they're uploaded.</p>
          </CardContent>
        </Card>
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
    </div>
  )
}
