import { useState, useEffect } from 'react'
import {
  FileText,
  Folder,
  FolderPlus,
  Upload,
  Download,
  Eye,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight,
  Building2,
  Search,
  Calendar,
  User,
  Check,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api } from '@/lib/api'

interface DocumentType {
  value: string
  label: string
}

interface DocumentFolder {
  id: number
  clientServiceId: number
  name: string
  parentFolderId: number | null
  createdBy: { id: number; fullName: string } | null
  createdAt: string
  documents: DocumentWithUploader[]
}

interface Document {
  id: number
  name: string
  documentTitle: string | null
  type: string | null
  fileSize: number
  url: string
  userId: number
  clientId: number
  clientServiceId: number | null
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

interface ClientService {
  id: number
  clientId: number
  serviceTypeId: number
  rate: number | null
  serviceLevelPrice: number | null
  serviceTitle: string | null
  startDate: string
  endDate: string | null
  isActive: boolean
  serviceTypeName: string
  serviceCategory: string
  billingModel: string
}

interface Client {
  id: number
  name: string
  industry: string | null
  status: string
  logoUrl: string | null
  services: ClientService[]
}

interface ServiceDocuments {
  folders: DocumentFolder[]
  rootDocuments: DocumentWithUploader[]
  service: ClientService
}

export function AdminDocumentsPage() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [serviceDocuments, setServiceDocuments] = useState<Record<number, ServiceDocuments>>({})
  const [loadingServices, setLoadingServices] = useState<Set<number>>(new Set())

  // Dialog states
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [isFolderViewDialogOpen, setIsFolderViewDialogOpen] = useState(false)

  // Form states
  const [selectedService, setSelectedService] = useState<ClientService | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<DocumentFolder | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [uploadDocumentType, setUploadDocumentType] = useState('')
  const [visibleToClient, setVisibleToClient] = useState(false)
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [previewDocument, setPreviewDocument] = useState<DocumentWithUploader | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [viewingFolder, setViewingFolder] = useState<DocumentFolder | null>(null)
  const [showFolderSelect, setShowFolderSelect] = useState(false)

  useEffect(() => {
    loadClients()
    loadDocumentTypes()
  }, [])

  const loadClients = async () => {
    try {
      setIsLoading(true)
      const data = await api.getClientsWithServices()
      setClients(data)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadDocumentTypes = async () => {
    try {
      const types = await api.request('/documents/types')
      setDocumentTypes(types)
    } catch (error) {
      console.error('Error loading document types:', error)
    }
  }

  const loadServiceDocuments = async (serviceId: number) => {
    if (loadingServices.has(serviceId)) return

    try {
      setLoadingServices(prev => new Set(prev).add(serviceId))
      const data = await api.getServiceDocuments(serviceId)
      setServiceDocuments(prev => ({ ...prev, [serviceId]: data }))
    } catch (error) {
      console.error('Error loading service documents:', error)
      // Set empty state on error so UI doesn't show infinite loading
      setServiceDocuments(prev => ({
        ...prev,
        [serviceId]: { folders: [], rootDocuments: [], service: null }
      }))
    } finally {
      setLoadingServices(prev => {
        const newSet = new Set(prev)
        newSet.delete(serviceId)
        return newSet
      })
    }
  }

  const toggleClient = (clientId: number) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev)
      if (newSet.has(clientId)) {
        newSet.delete(clientId)
      } else {
        newSet.add(clientId)
      }
      return newSet
    })
  }

  const toggleService = async (serviceId: number) => {
    const isExpanding = !expandedServices.has(serviceId)

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

    if (isExpanding && !serviceDocuments[serviceId]) {
      await loadServiceDocuments(serviceId)
    }
  }

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const handleCreateFolder = async () => {
    if (!selectedService || !newFolderName.trim()) return

    try {
      setIsSaving(true)
      await api.createDocumentFolder({
        clientServiceId: selectedService.id,
        name: newFolderName.trim(),
        parentFolderId: targetFolderId || undefined
      })
      await loadServiceDocuments(selectedService.id)
      setIsCreateFolderDialogOpen(false)
      setNewFolderName('')
      setTargetFolderId(null)
    } catch (error) {
      console.error('Error creating folder:', error)
      showAlert({ message: 'Failed to create folder', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRenameFolder = async () => {
    if (!selectedFolder || !newFolderName.trim()) return

    try {
      setIsSaving(true)
      await api.renameDocumentFolder(selectedFolder.id, newFolderName.trim())
      await loadServiceDocuments(selectedFolder.clientServiceId)
      setIsRenameFolderDialogOpen(false)
      setNewFolderName('')
      setSelectedFolder(null)
    } catch (error) {
      console.error('Error renaming folder:', error)
      showAlert({ message: 'Failed to rename folder', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteFolder = async (folder: DocumentFolder) => {
    const hasContent = folder.documents.length > 0
    const message = hasContent
      ? `This folder contains ${folder.documents.length} document(s). Do you want to delete the folder and all its contents?`
      : `Are you sure you want to delete the folder "${folder.name}"?`

    const confirmed = await showConfirm({
      title: 'Delete Folder',
      message,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.deleteDocumentFolder(folder.id, hasContent)
      await loadServiceDocuments(folder.clientServiceId)
    } catch (error) {
      console.error('Error deleting folder:', error)
      showAlert({ message: 'Failed to delete folder', type: 'error' })
    }
  }

  const handleUploadDocument = async () => {
    if (!selectedFile || !selectedService || !selectedClient) return

    try {
      setIsSaving(true)
      const formData = new FormData()
      formData.append('document', selectedFile)
      formData.append('clientId', selectedClient.id.toString())
      formData.append('clientServiceId', selectedService.id.toString())
      if (documentTitle.trim()) {
        formData.append('documentTitle', documentTitle.trim())
      }
      if (uploadDocumentType) {
        formData.append('type', uploadDocumentType)
      }
      formData.append('visibleToClient', visibleToClient.toString())
      if (targetFolderId) {
        formData.append('folderId', targetFolderId.toString())
      }

      await api.uploadServiceDocument(formData)
      await loadServiceDocuments(selectedService.id)
      setIsUploadDialogOpen(false)
      resetUploadForm()
    } catch (error) {
      console.error('Error uploading document:', error)
      showAlert({ message: 'Failed to upload document', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const resetUploadForm = () => {
    setSelectedFile(null)
    setDocumentTitle('')
    setUploadDocumentType('')
    setVisibleToClient(false)
    setTargetFolderId(null)
    setShowFolderSelect(false)
  }

  const handleToggleVisibility = async (doc: DocumentWithUploader) => {
    try {
      await api.updateDocumentVisibility(doc.document.id, !doc.document.visibleToClient)
      if (doc.document.clientServiceId) {
        const updatedData = await api.getServiceDocuments(doc.document.clientServiceId)
        setServiceDocuments(prev => ({ ...prev, [doc.document.clientServiceId!]: updatedData }))

        // Update viewingFolder if we're viewing a folder that contains this document
        if (viewingFolder && doc.document.folderId === viewingFolder.id) {
          const updatedFolder = updatedData.folders.find((f: DocumentFolder) => f.id === viewingFolder.id)
          if (updatedFolder) {
            setViewingFolder(updatedFolder)
          }
        }
      }
    } catch (error) {
      console.error('Error updating visibility:', error)
      showAlert({ message: 'Failed to update document visibility', type: 'error' })
    }
  }

  const handleDeleteDocument = async (doc: DocumentWithUploader) => {
    const confirmed = await showConfirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${doc.document.name}"?`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.request(`/documents/${doc.document.id}`, { method: 'DELETE' })

      // Close folder view modal if deleting from inside a folder
      if (viewingFolder && doc.document.folderId === viewingFolder.id) {
        setIsFolderViewDialogOpen(false)
        setViewingFolder(null)
      }

      if (doc.document.clientServiceId) {
        await loadServiceDocuments(doc.document.clientServiceId)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      showAlert({ message: 'Failed to delete document', type: 'error' })
    }
  }

  const handleDownloadDocument = async (doc: DocumentWithUploader) => {
    try {
      const blob = await api.requestBinary(`/documents/download/${doc.document.id}`)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.document.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading document:', error)
      showAlert({ message: 'Failed to download document', type: 'error' })
    }
  }

  const handlePreviewDocument = (doc: DocumentWithUploader) => {
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

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.services.some(s =>
      s.serviceTypeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.serviceTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const openUploadDialog = (client: Client, service: ClientService, folderId: number | null = null) => {
    setSelectedClient(client)
    setSelectedService(service)
    setTargetFolderId(folderId)
    // Show folder select only when opening from accordion (not from inside a folder)
    setShowFolderSelect(folderId === null)
    setIsUploadDialogOpen(true)
  }

  const openCreateFolderDialog = (service: ClientService, parentFolderId: number | null = null) => {
    setSelectedService(service)
    setTargetFolderId(parentFolderId)
    setIsCreateFolderDialogOpen(true)
  }

  const openRenameFolderDialog = (folder: DocumentFolder) => {
    setSelectedFolder(folder)
    setNewFolderName(folder.name)
    setIsRenameFolderDialogOpen(true)
  }

  const renderDocument = (doc: DocumentWithUploader) => (
    <div key={doc.document.id} className="p-4 bg-white border rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-4">
        {/* Document info */}
        <div className="flex items-start space-x-4 flex-1 min-w-0">
          <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
            <FileText className="h-6 w-6 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-gray-900 truncate">
              {doc.document.documentTitle || doc.document.name}
            </p>
            {doc.document.documentTitle && (
              <p className="text-sm text-gray-400 truncate">{doc.document.name}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
              {doc.document.type && (
                <Badge variant="outline" className="text-sm px-2 py-0.5">
                  {doc.document.type}
                </Badge>
              )}
              <span className="font-medium">{formatFileSize(doc.document.fileSize)}</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(doc.document.createdAt).toLocaleDateString()}
              </span>
              {doc.uploadedBy && (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {doc.uploadedBy.fullName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {canPreview(doc.document.name) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(getPreviewUrl(doc.document.id), '_blank')}
              title="Open preview in new tab"
              className="h-9 w-9 p-0"
            >
              <Eye className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadDocument(doc)}
            title="Download document"
            className="h-9 w-9 p-0"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteDocument(doc)}
            className="text-red-600 hover:text-red-700 h-9 w-9 p-0"
            title="Delete document"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Client visibility toggle - separate row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <button
          onClick={() => handleToggleVisibility(doc)}
          title={doc.document.visibleToClient ? 'Click to hide from client' : 'Click to make visible to client'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
            doc.document.visibleToClient ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              doc.document.visibleToClient ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className={`text-xs ${doc.document.visibleToClient ? 'text-green-700' : 'text-gray-500'}`}>
          Client Visibility
        </span>
      </div>
    </div>
  )

  const openFolderViewDialog = (folder: DocumentFolder) => {
    setViewingFolder(folder)
    setIsFolderViewDialogOpen(true)
  }

  const renderFolderCard = (folder: DocumentFolder, client: Client, service: ClientService) => (
    <div
      key={folder.id}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => openFolderViewDialog(folder)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yellow-50 rounded-lg">
            <Folder className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">{folder.name}</h4>
            <p className="text-xs text-gray-500">
              {folder.documents.length} document{folder.documents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">
          {folder.documents.length}
        </Badge>
      </div>
      <div className="flex items-center gap-1 justify-end border-t pt-3" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openUploadDialog(client, service, folder.id)}
          title="Upload document to this folder"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openRenameFolderDialog(folder)}
          title="Rename this folder"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeleteFolder(folder)}
          className="text-red-600 hover:text-red-700"
          title="Delete this folder"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const renderDocumentCard = (doc: DocumentWithUploader) => (
    <div
      key={doc.document.id}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      {/* Header with icon and document info */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => canPreview(doc.document.name) && window.open(getPreviewUrl(doc.document.id), '_blank')}
      >
        <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
          <FileText className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate">
            {doc.document.documentTitle || doc.document.name}
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
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

      {/* Actions row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        {/* Client visibility toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleVisibility(doc)}
            title={doc.document.visibleToClient ? 'Click to hide from client' : 'Click to make visible to client'}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
              doc.document.visibleToClient ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                doc.document.visibleToClient ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className={`text-xs ${doc.document.visibleToClient ? 'text-green-700' : 'text-gray-500'}`}>
            Client Visibility
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {canPreview(doc.document.name) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(getPreviewUrl(doc.document.id), '_blank')}
              title="Open preview in new tab"
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadDocument(doc)}
            title="Download document"
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteDocument(doc)}
            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  const renderServiceContent = (client: Client, service: ClientService) => {
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
        <div className="p-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )
    }

    const hasContent = docs.folders.length > 0 || docs.rootDocuments.length > 0

    return (
      <div className="p-4 space-y-4">
        {hasContent ? (
          <div className="space-y-4">
            {/* Folders Grid */}
            {docs.folders.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Folders
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docs.folders.map(folder => renderFolderCard(folder, client, service))}
                </div>
              </div>
            )}

            {/* General Documents as cards */}
            {docs.rootDocuments.length > 0 && (
              <div className={docs.folders.length > 0 ? 'border-t pt-4' : ''}>
                {docs.folders.length > 0 && (
                  <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    General Documents
                  </h5>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docs.rootDocuments.map(doc => renderDocumentCard(doc))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">No documents yet</p>
            <p className="text-sm text-gray-400 mt-1">Upload documents or create folders to organize them</p>
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
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Documents
            </h1>
            <p className="stripe-text-secondary text-lg">
              Manage documents by client and service
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search clients or services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Client Cards */}
      {filteredClients.length > 0 ? (
        <div className="space-y-4">
          {filteredClients.map(client => (
            <Card key={client.id}>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleClient(client.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedClients.has(client.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt={client.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                      <CardDescription>
                        {client.services.length} service{client.services.length !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedClients.has(client.id) && (
                <CardContent>
                  {client.services.length > 0 ? (
                    <div className="space-y-3">
                      {client.services.map(service => (
                        <div key={service.id} className="border rounded-lg overflow-hidden">
                          {/* Service Header */}
                          <div className="flex items-center justify-between p-4 bg-gray-50">
                            <div
                              className="flex items-center gap-3 cursor-pointer hover:opacity-80 flex-1"
                              onClick={() => toggleService(service.id)}
                            >
                              {expandedServices.has(service.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900">{service.serviceTypeName}</h4>
                                  {service.serviceTitle && (
                                    <Badge className="bg-indigo-600 text-white">
                                      {service.serviceTitle}
                                    </Badge>
                                  )}
                                  {!service.isActive && (
                                    <Badge variant="destructive" className="text-xs">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="outline"
                                    className={service.serviceCategory === 'outstaffing'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-green-50 text-green-700 border-green-200'
                                    }
                                  >
                                    {service.serviceCategory}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={service.billingModel === 'hourly'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : service.billingModel === 'monthly'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }
                                  >
                                    {service.billingModel}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openCreateFolderDialog(service)
                                }}
                                title="Create a new folder"
                              >
                                <FolderPlus className="h-4 w-4 mr-1" />
                                New Folder
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openUploadDialog(client, service)
                                }}
                                title="Upload a document"
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Upload
                              </Button>
                              {serviceDocuments[service.id] && (
                                <Badge variant="secondary" className="ml-2">
                                  {serviceDocuments[service.id].folders.length} folders,{' '}
                                  {serviceDocuments[service.id].rootDocuments.length +
                                    serviceDocuments[service.id].folders.reduce(
                                      (acc, f) => acc + f.documents.length,
                                      0
                                    )}{' '}
                                  docs
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Service Content */}
                          {expandedServices.has(service.id) && renderServiceContent(client, service)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>No services for this client</p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Add clients with services to manage their documents'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderDialogOpen} onOpenChange={setIsCreateFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a folder to organize documents for {selectedService?.serviceTypeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={isSaving || !newFolderName.trim()}>
              {isSaving ? 'Creating...' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isRenameFolderDialogOpen} onOpenChange={setIsRenameFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="renameFolderName">Folder Name</Label>
              <Input
                id="renameFolderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder} disabled={isSaving || !newFolderName.trim()}>
              {isSaving ? 'Saving...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
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

            {/* Show folder select only when uploading from accordion (not from inside a folder) */}
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
                    <SelectItem value="none" label="No folder (General Documents)">
                      No folder (General Documents)
                    </SelectItem>
                    {serviceDocuments[selectedService.id]?.folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id.toString()} label={folder.name}>
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

            <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
              <Checkbox
                id="visibleToClient"
                checked={visibleToClient}
                onCheckedChange={(checked) => setVisibleToClient(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="visibleToClient" className="cursor-pointer">
                  Allow client to view and download document
                </Label>
                <p className="text-sm text-gray-500">
                  If checked this document will be visible in the client portal
                </p>
              </div>
            </div>

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
            <Button onClick={handleUploadDocument} disabled={isSaving || !selectedFile}>
              {isSaving ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {isPreviewDialogOpen && previewDocument && (
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Preview: {previewDocument.document.name}</DialogTitle>
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
        <DialogContent className="w-full !max-w-[60rem]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Folder className="h-6 w-6 text-yellow-500" />
              </div>
              {viewingFolder?.name}
            </DialogTitle>
            <DialogDescription className="text-base">
              {viewingFolder?.documents.length || 0} document{(viewingFolder?.documents.length || 0) !== 1 ? 's' : ''} in this folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {viewingFolder?.documents && viewingFolder.documents.length > 0 ? (
              viewingFolder.documents.map(doc => renderDocument(doc))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <p className="text-lg">No documents in this folder</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
