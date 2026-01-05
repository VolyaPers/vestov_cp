import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import { FileText, Download, Eye, Calendar, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'

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

export function ClientDocuments() {
  const [, params] = useRoute('/client/documents/:clientId')
  if (!hasRouteParam(params, 'clientId')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'clientId')
  const [documents, setDocuments] = useState<DocumentWithUploader[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithUploader | null>(null)

  useEffect(() => {
    const loadDocuments = async () => {
      if (!clientId) return

      try {
        const documentsResponse = await api.request(`/documents/client/${clientId}`)
        setDocuments(documentsResponse)
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [clientId])

  const handleDocumentDownload = async (documentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/documents/download/${documentId}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      const blob = await response.blob()
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
          <p className="text-gray-600">Your project documents and files</p>
        </div>
      </div>

      {documents.length > 0 ? (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.document.id} className="hover:shadow-md transition-shadow" data-testid="document-item">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="p-2 bg-gray-100 rounded">
                      <FileText className="h-6 w-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{doc.document.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <Badge variant="outline" className="text-xs">
                          {doc.document.type}
                        </Badge>
                        <span className="flex items-center space-x-1">
                          <span>{formatFileSize(doc.document.fileSize)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Uploaded: {new Date(doc.document.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>By: {doc.uploadedBy.fullName}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {canPreview(doc.document.name) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDocumentPreview(doc)}
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
                      title="Download document"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
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
    </div>
  )
}