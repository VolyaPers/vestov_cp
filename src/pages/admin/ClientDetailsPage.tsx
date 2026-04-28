import { useState, useEffect } from 'react'
import { useRoute } from 'wouter'
import { ArrowLeft, Edit, Save, X, Building, Mail, Phone, MapPin, Calendar, DollarSign, Users, Plus, Trash2, Settings, FileText, Upload, Download, Eye, UserPlus, Star, Building2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InvoiceStatsChart } from '@/components/InvoiceStatsChart'
import { EnhancedInvoiceForm } from '@/components/EnhancedInvoiceForm'
import { useCustomAlert } from '@/components/ui/custom-alert'
import { api, resolveApiAssetUrl } from '@/lib/api'
import { parseLocalDate } from '@/lib/utils'
import { convertClientToClientDetails, type ClientDetails } from '@/lib/clientHelpers'
import { hasRouteParam, getRouteParam } from '@/lib/routeHelpers'
import type { ClientService } from '@/types/common'

interface ServiceType {
  id: number
  name: string
  description?: string
  category: 'outstaffing' | 'outsourcing'
  billingModel: 'hourly' | 'monthly' | 'fixed'
}

interface Developer {
  id: number
  name: string
  email: string
  skills: string[]
  hourlyRate?: number
  position?: string
  status?: string
  bio?: string
  location?: string
}

interface ServiceDeveloper {
  id: number
  developerId: number
  name: string
  email: string
  avatarUrl?: string
  skills: string[]
  hourlyRate?: number
  fixedPrice?: number
  workSchedule?: Record<string, string>
  employmentType: 'fulltime' | 'part_time' | 'freelancer'
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

interface DocumentType {
  value: string
  label: string
}

interface ClientContact {
  id: number
  clientId: number
  fullName: string
  position?: string
  email?: string
  phone?: string
  avatarUrl?: string
  notes?: string
  isPrimary: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
  position?: string
  avatarUrl?: string
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

interface ClientUser {
  id: number
  username: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
  position?: string
  avatarUrl?: string
  isActive: boolean
  lastLoginAt?: string
  assignmentId: number
  accessLevel: 'read' | 'write' | 'admin'
  assignmentActive: boolean
  assignedAt: string
  assignedBy: number
}

export function ClientDetailsPage() {
  const { showAlert, showConfirm } = useCustomAlert()
  const [, params] = useRoute('/admin/clients/:id')
  if (!hasRouteParam(params, 'id')) {
    return <div>Client ID not found</div>
  }
  const clientId = getRouteParam(params, 'id')
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    industry: '',
    status: 'active' as 'active' | 'inactive' | 'prospect',
    contractType: '' as '' | 'outstaffing' | 'outsourcing' | 'hybrid',
    contractStart: '',
    contractEnd: '',
    billingCycle: '' as '' | 'monthly' | 'weekly' | 'hourly',
    teamSize: ''
  })
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false)
  const [initialInvoiceServiceId, setInitialInvoiceServiceId] = useState<number | null>(null)
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [serviceDevelopers, setServiceDevelopers] = useState<Record<number, ServiceDeveloper[]>>({})
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isEditServiceDialogOpen, setIsEditServiceDialogOpen] = useState(false)
  const [selectedServiceForDeveloper, setSelectedServiceForDeveloper] = useState<number | null>(null)
  const [editingServiceData, setEditingServiceData] = useState<{
    serviceId: number
    clientId: number
    serviceTypeName: string
    rate?: number
    serviceLevelPrice?: number
    startDate: string
    endDate?: string
    isActive: boolean
    serviceTitle?: string
    slackChannelId?: string
  } | null>(null)
  const [newServiceData, setNewServiceData] = useState({
    serviceTypeId: '',
    rate: '',
    serviceTitle: '',
    startDate: new Date().toISOString().split('T')[0],
    slackChannelId: ''
  })
  const [newDeveloperData, setNewDeveloperData] = useState({
    developerId: '',
    employmentType: 'fulltime' as 'fulltime' | 'part_time' | 'freelancer',
    hourlyRate: '',
    fixedPrice: '',
    startDate: new Date().toISOString().split('T')[0],
  })
  const [isEditDeveloperDialogOpen, setIsEditDeveloperDialogOpen] = useState(false)
  const [editingDeveloper, setEditingDeveloper] = useState<{
    serviceId: number
    assignmentId: number
    name: string
    hourlyRate?: number
    fixedPrice?: number
    workSchedule?: Record<string, string>
  } | null>(null)
  const [editDeveloperData, setEditDeveloperData] = useState({
    hourlyRate: '',
    fixedPrice: '',
    workSchedule: {
      monday: 'full',
      tuesday: 'full',
      wednesday: 'full',
      thursday: 'full',
      friday: 'full',
      saturday: 'off',
      sunday: 'off',
    },
  })

  // Document management state
  const [documents, setDocuments] = useState<DocumentWithUploader[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadDocumentType, setUploadDocumentType] = useState('general')
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<DocumentWithUploader | null>(null)

  // Contact management state
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null)
  const [contactFormData, setContactFormData] = useState({
    fullName: '',
    position: '',
    email: '',
    phone: '',
    notes: '',
    isPrimary: false
  })
  const [contactAvatarFile, setContactAvatarFile] = useState<File | null>(null)
  const [isUploadingContactAvatar, setIsUploadingContactAvatar] = useState(false)
  const [showAllServiceAssignments, setShowAllServiceAssignments] = useState(false)

  // User management state
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [isAssignUserDialogOpen, setIsAssignUserDialogOpen] = useState(false)
  const [assignUserData, setAssignUserData] = useState({
    userId: '',
    accessLevel: 'read' as 'read' | 'write' | 'admin',
  })

  // Logo upload state
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)


  useEffect(() => {
    const loadClient = async () => {
      if (!clientId) return

      try {
        const response = await api.getClient(clientId)
        setClient(convertClientToClientDetails(response))
        // Populate edit data
        setEditData({
          name: response.name || '',
          industry: response.industry || '',
          status: response.status || 'active',
          contractType: response.contractType || '',
          contractStart: response.contractStart || '',
          contractEnd: response.contractEnd || '',
          billingCycle: response.billingCycle || '',
          teamSize: response.teamSize?.toString() || ''
        })
      } catch (error) {
        console.error('Failed to load client:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadClient()
    loadServiceTypes()
    loadDevelopers()
    loadDocuments()
    loadDocumentTypes()
    loadContacts()
    loadClientUsers()
    loadAvailableUsers()
  }, [clientId])

  // Load developers for service when client data changes
  useEffect(() => {
    if (client && client.services?.length > 0) {
      client.services?.forEach(service => {
        loadServiceDevelopers(service.id)
      })
    }
  }, [client])

  const loadServiceTypes = async () => {
    try {
      const response = await api.request('/services/service-types', {
        method: 'GET',
      })
      setServiceTypes(response)
    } catch (error) {
      console.error('Failed to load service types:', error)
    }
  }

  const loadDevelopers = async () => {
    try {
      const response = await api.getDevelopers()
      setDevelopers(response)
    } catch (error) {
      console.error('Failed to load developers:', error)
    }
  }

  const loadServiceDevelopers = async (serviceId: number) => {
    if (!clientId) return
    try {
      const response = await api.getServiceDevelopers(parseInt(clientId), serviceId)
      setServiceDevelopers(prev => ({
        ...prev,
        [serviceId]: response
      }))
    } catch (error) {
      console.error('Failed to load service developers:', error)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (!client) return
    // Reset edit data to original values
    setEditData({
      name: client.name || '',
      industry: client.industry || '',
      status: client.status || 'active',
      contractType: client.contractType || '',
      contractStart: client.contractStart || '',
      contractEnd: client.contractEnd || '',
      billingCycle: (client.billingCycle || '') as '' | 'monthly' | 'weekly' | 'hourly',
      teamSize: client.teamSize?.toString() || ''
    })
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!clientId) return

    setIsSaving(true)
    try {
      const updateData: any = {
        name: editData.name,
        industry: editData.industry,
        status: editData.status,
        contractType: editData.contractType || undefined,
        contractStart: editData.contractStart || undefined,
        contractEnd: editData.contractEnd || undefined,
        billingCycle: editData.billingCycle || undefined,
        teamSize: editData.teamSize ? parseInt(editData.teamSize) : undefined
      }

      await api.updateClient(clientId, updateData)

      // Refresh client data
      const response = await api.getClient(clientId) as any
      setClient({
        ...response,
        services: response.services || []
      } as ClientDetails)
      setIsEditing(false)

      showAlert({ message: 'Client updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update client:', error)
      showAlert({ message: error.message || 'Failed to update client', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddService = async () => {
    if (!clientId || !newServiceData.serviceTypeId || !newServiceData.startDate) {
      showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      await api.request(`/services/clients/${clientId}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceTypeId: parseInt(newServiceData.serviceTypeId),
          rate: newServiceData.rate ? parseFloat(newServiceData.rate) : null,
          serviceTitle: newServiceData.serviceTitle || null,
          startDate: newServiceData.startDate,
          slackChannelId: newServiceData.slackChannelId || null
        }),
      })

      // Refresh client data
      const response = await api.getClient(clientId)
      setClient(convertClientToClientDetails(response))
      setIsServiceDialogOpen(false)
      resetServiceForm()

      showAlert({ message: 'Service added successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to add service:', error)
      showAlert({ message: error.message || 'Failed to add service to client', type: 'error' })
    }
  }

  const handleRemoveService = async (serviceId: number, permanent: boolean = false) => {
    if (!clientId) return

    const message = permanent
      ? 'Are you sure you want to permanently delete this service assignment? This cannot be undone.'
      : 'Are you sure you want to deactivate this service assignment?'

    const confirmed = await showConfirm({
      title: permanent ? 'Delete Service' : 'Deactivate Service',
      message,
      type: 'warning',
      confirmText: permanent ? 'Delete' : 'Deactivate',
      cancelText: 'Cancel',
      destructive: permanent,
    })

    if (!confirmed) return

    try {
      const url = permanent
        ? `/services/clients/${clientId}/services/${serviceId}?permanent=true`
        : `/services/clients/${clientId}/services/${serviceId}`

      await api.request(url, {
        method: 'DELETE',
      })

      // Refresh client data
      const response = await api.getClient(clientId)
      setClient(convertClientToClientDetails(response))

      const successMessage = permanent
        ? 'Service assignment permanently deleted'
        : 'Service assignment deactivated successfully'
      showAlert({ message: successMessage, type: 'success' })
    } catch (error: any) {
      console.error('Failed to remove service:', error)
      showAlert({ message: error.message || 'Failed to remove service assignment', type: 'error' })
    }
  }

  const resetServiceForm = () => {
    setNewServiceData({
      serviceTypeId: '',
      rate: '',
      serviceTitle: '',
      startDate: new Date().toISOString().split('T')[0],
      slackChannelId: ''
    })
  }

  const handleAddDeveloperToService = (serviceId: number) => {
    setSelectedServiceForDeveloper(serviceId)
    setIsAddMemberDialogOpen(true)
  }

  const handleAddDeveloper = async () => {
    if (!clientId || !selectedServiceForDeveloper || !newDeveloperData.developerId || !newDeveloperData.startDate) {
      showAlert({ message: 'Please fill in all required fields', type: 'warning' })
      return
    }

    try {
      await api.addDeveloperToService(parseInt(clientId), selectedServiceForDeveloper, {
        teamMemberId: parseInt(newDeveloperData.developerId),
        employmentType: newDeveloperData.employmentType,
        hourlyRate: newDeveloperData.hourlyRate ? parseFloat(newDeveloperData.hourlyRate) : undefined,
        fixedPrice: newDeveloperData.fixedPrice ? parseFloat(newDeveloperData.fixedPrice) : undefined,
        startDate: newDeveloperData.startDate,
      })

      // Refresh service developers
      loadServiceDevelopers(selectedServiceForDeveloper)
      setIsAddMemberDialogOpen(false)
      resetDeveloperForm()

      showAlert({ message: 'Developer added to service successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to add developer:', error)
      showAlert({ message: error.message || 'Failed to add developer to service', type: 'error' })
    }
  }

  const handleRemoveDeveloper = async (serviceId: number, assignmentId: number, permanent = false) => {
    if (!clientId) return

    const message = permanent
      ? 'Are you sure you want to permanently remove this developer from the service?'
      : 'Are you sure you want to deactivate this developer assignment?'

    const confirmed = await showConfirm({
      title: permanent ? 'Remove Developer' : 'Deactivate Developer',
      message,
      type: 'warning',
      confirmText: permanent ? 'Remove' : 'Deactivate',
      cancelText: 'Cancel',
      destructive: permanent,
    })

    if (!confirmed) return

    try {
      await api.removeDeveloperFromService(parseInt(clientId), serviceId, assignmentId, permanent)

      // Refresh service developers
      loadServiceDevelopers(serviceId)

      const successMessage = permanent
        ? 'Developer assignment permanently removed'
        : 'Developer assignment deactivated successfully'
      showAlert({ message: successMessage, type: 'success' })
    } catch (error: any) {
      console.error('Failed to remove developer:', error)
      showAlert({ message: error.message || 'Failed to remove developer assignment', type: 'error' })
    }
  }

  const handleEditDeveloper = (serviceId: number, developer: ServiceDeveloper) => {
    const defaultSchedule = {
      monday: 'full',
      tuesday: 'full',
      wednesday: 'full',
      thursday: 'full',
      friday: 'full',
      saturday: 'off',
      sunday: 'off',
    }

    const workSchedule = developer.workSchedule && typeof developer.workSchedule === 'object' && 'monday' in developer.workSchedule
      ? developer.workSchedule as { monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string }
      : defaultSchedule

    setEditingDeveloper({
      serviceId,
      assignmentId: developer.id,
      name: developer.name,
      hourlyRate: developer.hourlyRate,
      fixedPrice: developer.fixedPrice,
      workSchedule,
    })
    setEditDeveloperData({
      hourlyRate: developer.hourlyRate?.toString() || '',
      fixedPrice: developer.fixedPrice?.toString() || '',
      workSchedule,
    })
    setIsEditDeveloperDialogOpen(true)
  }

  const handleSaveDeveloperPricing = async () => {
    if (!clientId || !editingDeveloper) return

    try {
      await api.updateDeveloperPricing(
        parseInt(clientId),
        editingDeveloper.serviceId,
        editingDeveloper.assignmentId,
        {
          hourlyRate: editDeveloperData.hourlyRate ? parseFloat(editDeveloperData.hourlyRate) : undefined,
          fixedPrice: editDeveloperData.fixedPrice ? parseFloat(editDeveloperData.fixedPrice) : undefined,
          workSchedule: editDeveloperData.workSchedule,
        }
      )

      // Refresh service developers
      loadServiceDevelopers(editingDeveloper.serviceId)
      setIsEditDeveloperDialogOpen(false)
      setEditingDeveloper(null)
      setEditDeveloperData({
        hourlyRate: '',
        fixedPrice: '',
        workSchedule: {
          monday: 'full',
          tuesday: 'full',
          wednesday: 'full',
          thursday: 'full',
          friday: 'full',
          saturday: 'off',
          sunday: 'off',
        },
      })

      showAlert({ message: 'Developer details updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update developer details:', error)
      showAlert({ message: error.message || 'Failed to update developer details', type: 'error' })
    }
  }

  const resetDeveloperForm = () => {
    setNewDeveloperData({
      developerId: '',
      employmentType: 'fulltime',
      hourlyRate: '',
      fixedPrice: '',
      startDate: new Date().toISOString().split('T')[0],
    })
  }

  const handleEditService = (service: ClientService) => {
    if (!clientId) return
    setEditingServiceData({
      serviceId: service.id,
      clientId: parseInt(clientId),
      serviceTypeName: service.serviceTypeName,
      rate: service.rate || undefined,
      serviceTitle: service.serviceTitle || '',
      serviceLevelPrice: service.serviceLevelPrice || undefined,
      startDate: service.startDate,
      endDate: service.endDate || undefined,
      isActive: service.isActive,
      slackChannelId: service.slackChannelId || ''
    })
    setIsEditServiceDialogOpen(true)
  }

  const handleUpdateService = async () => {
    if (!editingServiceData) return

    try {
      await api.updateClientService(editingServiceData.clientId, editingServiceData.serviceId, {
        rate: editingServiceData.rate,
        serviceTitle: editingServiceData.serviceTitle || null,
        serviceLevelPrice: editingServiceData.serviceLevelPrice,
        startDate: editingServiceData.startDate,
        endDate: editingServiceData.endDate,
        isActive: editingServiceData.isActive,
        slackChannelId: editingServiceData.slackChannelId || null
      })

      // Refresh client data
      const response = await api.getClient(editingServiceData.clientId.toString())
      setClient(convertClientToClientDetails(response))
      setIsEditServiceDialogOpen(false)
      setEditingServiceData(null)

      showAlert({ message: 'Service updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update service:', error)
      showAlert({ message: error.message || 'Failed to update service', type: 'error' })
    }
  }

  const resetEditServiceForm = () => {
    setEditingServiceData(null)
  }

  // Document management functions
  const loadDocuments = async () => {
    if (!clientId) return
    try {
      const response = await api.request(`/documents/client/${clientId}`, {
        method: 'GET',
      })
      setDocuments(response)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const loadDocumentTypes = async () => {
    try {
      const response = await api.request('/documents/types', {
        method: 'GET',
      })
      setDocumentTypes(response)
    } catch (error) {
      console.error('Failed to load document types:', error)
    }
  }

  const handleDocumentUpload = async () => {
    if (!clientId || !selectedFile) return

    setIsUploadingDocument(true)
    try {
      const formData = new FormData()
      formData.append('document', selectedFile)
      formData.append('clientId', clientId)
      formData.append('type', uploadDocumentType)

      await api.requestFormData('/documents/upload', formData)

      // Refresh documents list
      await loadDocuments()
      setIsDocumentDialogOpen(false)
      resetDocumentForm()
      showAlert({ message: 'Document uploaded successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to upload document:', error)
      showAlert({ message: error.message || 'Failed to upload document', type: 'error' })
    } finally {
      setIsUploadingDocument(false)
    }
  }

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
      showAlert({ message: error.message || 'Failed to download document', type: 'error' })
    }
  }

  const handleDocumentDelete = async (documentId: number, filename: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.request(`/documents/${documentId}`, {
        method: 'DELETE',
      })

      // Refresh documents list
      await loadDocuments()
      showAlert({ message: 'Document deleted successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to delete document:', error)
      showAlert({ message: error.message || 'Failed to delete document', type: 'error' })
    }
  }

  const resetDocumentForm = () => {
    setSelectedFile(null)
    setUploadDocumentType('general')
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

  // Contact management functions
  const loadContacts = async () => {
    if (!clientId) return
    try {
      const response = await api.request(`/client-contacts/client/${clientId}`, {
        method: 'GET',
      })
      setContacts(response)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  const handleCreateContact = async () => {
    if (!clientId || !contactFormData.fullName.trim()) {
      showAlert({ message: 'Full name is required', type: 'warning' })
      return
    }

    try {
      const response = await api.request(`/client-contacts/client/${clientId}`, {
        method: 'POST',
        body: JSON.stringify(contactFormData),
      })

      if (contactAvatarFile) {
        setIsUploadingContactAvatar(true)
        await api.uploadClientContactAvatar(response.id, contactAvatarFile)
        setIsUploadingContactAvatar(false)
      }

      // Refresh contacts list
      await loadContacts()
      setIsContactDialogOpen(false)
      resetContactForm()
      showAlert({ message: 'Contact created successfully!', type: 'success' })
    } catch (error: any) {
      setIsUploadingContactAvatar(false)
      console.error('Failed to create contact:', error)
      showAlert({ message: error.message || 'Failed to create contact', type: 'error' })
    }
  }

  const handleUpdateContact = async () => {
    if (!editingContact || !contactFormData.fullName.trim()) {
      showAlert({ message: 'Full name is required', type: 'warning' })
      return
    }

    try {
      await api.request(`/client-contacts/${editingContact.id}`, {
        method: 'PUT',
        body: JSON.stringify(contactFormData),
      })

      if (contactAvatarFile) {
        setIsUploadingContactAvatar(true)
        await api.uploadClientContactAvatar(editingContact.id, contactAvatarFile)
        setIsUploadingContactAvatar(false)
      }

      // Refresh contacts list
      await loadContacts()
      setIsContactDialogOpen(false)
      resetContactForm()
      showAlert({ message: 'Contact updated successfully!', type: 'success' })
    } catch (error: any) {
      setIsUploadingContactAvatar(false)
      console.error('Failed to update contact:', error)
      showAlert({ message: error.message || 'Failed to update contact', type: 'error' })
    }
  }

  const handleDeleteContact = async (contactId: number, contactName: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Contact',
      message: `Are you sure you want to delete "${contactName}"?`,
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    try {
      await api.request(`/client-contacts/${contactId}`, {
        method: 'DELETE',
      })

      // Refresh contacts list
      await loadContacts()
      showAlert({ message: 'Contact deleted successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to delete contact:', error)
      showAlert({ message: error.message || 'Failed to delete contact', type: 'error' })
    }
  }

  const handleEditContact = (contact: ClientContact) => {
    setEditingContact(contact)
    setContactFormData({
      fullName: contact.fullName,
      position: contact.position || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
      isPrimary: contact.isPrimary,
    })
    setContactAvatarFile(null)
    setIsContactDialogOpen(true)
  }

  const resetContactForm = () => {
    setContactFormData({
      fullName: '',
      position: '',
      email: '',
      phone: '',
      notes: '',
      isPrimary: false,
    })
    setContactAvatarFile(null)
    setIsUploadingContactAvatar(false)
    setEditingContact(null)
  }

  // User management functions
  const loadClientUsers = async () => {
    if (!clientId) return
    try {
      const response = await api.getClientUsers(Number(clientId))
      setClientUsers(response)
    } catch (error) {
      console.error('Failed to load client users:', error)
    }
  }

  const loadAvailableUsers = async () => {
    try {
      // Only load users with 'client' role
      const response = await api.getUsers({ role: 'client' })
      setAvailableUsers(response.users || [])
    } catch (error) {
      console.error('Failed to load available users:', error)
    }
  }


  const handleAssignUser = async () => {
    if (!assignUserData.userId || !clientId) {
      showAlert({ message: 'Please select a user', type: 'warning' })
      return
    }

    try {
      await api.assignUserToClient(Number(assignUserData.userId), Number(clientId), {
        accessLevel: assignUserData.accessLevel,
        assignedBy: 1 // TODO: Get current user ID
      })

      // Refresh client users
      await loadClientUsers()
      setIsAssignUserDialogOpen(false)
      resetAssignUserForm()
      showAlert({ message: 'User assigned to client successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to assign user:', error)
      showAlert({ message: error.message || 'Failed to assign user to client', type: 'error' })
    }
  }

  const handleUpdateUserAccess = async (userId: number, accessLevel: 'read' | 'write' | 'admin') => {
    if (!clientId) return

    try {
      await api.updateClientAssignment(userId, Number(clientId), { accessLevel })
      await loadClientUsers()
      showAlert({ message: 'User access level updated successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update user access:', error)
      showAlert({ message: error.message || 'Failed to update user access', type: 'error' })
    }
  }

  const handleRemoveUserFromClient = async (userId: number, userName: string) => {
    const confirmed = await showConfirm({
      title: 'Remove User',
      message: `Are you sure you want to remove "${userName}" from this client?`,
      type: 'warning',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    })

    if (!confirmed) return

    if (!clientId) return

    try {
      await api.removeUserFromClient(userId, Number(clientId))
      await loadClientUsers()
      showAlert({ message: 'User removed from client successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to remove user from client:', error)
      showAlert({ message: error.message || 'Failed to remove user from client', type: 'error' })
    }
  }

  const resetAssignUserForm = () => {
    setAssignUserData({
      userId: '',
      accessLevel: 'read',
    })
  }

  const handleUploadLogo = async () => {
    if (!clientId || !selectedLogoFile) {
      showAlert({ message: 'Please select a logo file', type: 'warning' })
      return
    }

    setIsUploadingLogo(true)
    try {
      const result = await api.uploadClientLogo(Number(clientId), selectedLogoFile)

      // Update client data with new logo
      if (client) {
        setClient({
          ...client,
          logoUrl: result.logoUrl
        })
      }

      setSelectedLogoFile(null)
      showAlert({ message: 'Logo uploaded successfully!', type: 'success' })
    } catch (error: any) {
      console.error('Failed to upload logo:', error)
      showAlert({ message: error.message || 'Failed to upload logo', type: 'error' })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && clientId) {
      setSelectedLogoFile(file)
      setIsUploadingLogo(true)
      try {
        const result = await api.uploadClientLogo(Number(clientId), file)

        // Update client data with new logo
        if (client) {
          setClient({
            ...client,
            logoUrl: result.logoUrl
          })
        }

        setSelectedLogoFile(null)
        // Clear the input
        e.target.value = ''
      } catch (error: any) {
        console.error('Failed to upload logo:', error)
        showAlert({ message: error.message || 'Failed to upload logo', type: 'error' })
      } finally {
        setIsUploadingLogo(false)
      }
    }
  }

  const openInvoiceForService = (serviceId: number) => {
    setInitialInvoiceServiceId(serviceId)
    setIsInvoiceFormOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-300/70"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Client Not Found</h2>
        <p className="mt-2 text-gray-600">The client you're looking for doesn't exist.</p>
        <Button className="mt-4" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  const visibleServiceAssignments = showAllServiceAssignments
    ? client.services || []
    : (client.services || []).filter(service => service.isActive)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="p-3 bg-primary/10 rounded-lg">
                {client.logoUrl ? (
                  <img
                    src={resolveApiAssetUrl(client.logoUrl)}
                    alt={`${client.name} logo`}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <Building className="h-8 w-8 text-primary" />
                )}
              </div>
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 text-white" />
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileSelected}
                  />
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-gray-600">{client.industry || 'Industry not specified'}</p>
              <div className="flex items-center space-x-4 mt-2">
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
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving} title="Cancel editing">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} title="Save changes">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit} title="Edit client details">
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          )}
        </div>
      </div>

      {/* Client Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Client contacts and communication details</CardDescription>
              </div>
              <Button
                onClick={() => setIsContactDialogOpen(true)}
                size="sm"
                variant="outline"
                className="gap-2"
                title="Add a new contact"
              >
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Client name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={editData.industry}
                    onChange={(e) => setEditData({ ...editData, industry: e.target.value })}
                    placeholder="e.g., Technology, Healthcare"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-900">Client Name</p>
                  <p className="text-sm text-gray-600">{client.name}</p>
                </div>
                {client.industry && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Industry</p>
                    <p className="text-sm text-gray-600">{client.industry}</p>
                  </div>
                )}

                {/* Contact Management Section */}
                {!isEditing && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">Additional Contacts</h4>
                      {contacts.length > 0 && (
                        <span className="text-xs text-gray-500">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {contacts.length > 0 ? (
                      <div className="space-y-3">
                        {contacts.map((contact) => (
                          <div key={contact.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex flex-1 min-w-0 items-start gap-3">
                              {contact.avatarUrl ? (
                                <img
                                  src={resolveApiAssetUrl(contact.avatarUrl)}
                                  alt={contact.fullName}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
                                  {contact.fullName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{contact.fullName}</p>
                                  {contact.isPrimary && (
                                    <Star className="h-3 w-3 text-yellow-500 fill-current" aria-label="Primary Contact" />
                                  )}
                                </div>
                                {contact.position && (
                                  <p className="text-xs text-gray-600 mb-1">{contact.position}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                  {contact.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate max-w-[120px]">{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                </div>
                                {contact.notes && (
                                  <p className="text-xs text-gray-600 mt-1 italic truncate">"{contact.notes}"</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditContact(contact)}
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Edit contact"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteContact(contact.id, contact.fullName)}
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete contact"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400 bg-gray-50 rounded-lg">
                        <UserPlus className="mx-auto h-6 w-6 mb-2" />
                        <p className="text-xs">No additional contacts</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract Details</CardTitle>
            <CardDescription>Contract and billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value: 'active' | 'inactive' | 'prospect') =>
                        setEditData({ ...editData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractType">Primary Contract Type</Label>
                    <Select
                      value={editData.contractType}
                      onValueChange={(value: string) =>
                        setEditData({ ...editData, contractType: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None specified</SelectItem>
                        <SelectItem value="outstaffing">Outstaffing</SelectItem>
                        <SelectItem value="outsourcing">Outsourcing</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contractStart">Contract Start Date</Label>
                    <Input
                      id="contractStart"
                      type="date"
                      value={editData.contractStart}
                      onChange={(e) => setEditData({ ...editData, contractStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractEnd">Contract End Date</Label>
                    <Input
                      id="contractEnd"
                      type="date"
                      value={editData.contractEnd}
                      onChange={(e) => setEditData({ ...editData, contractEnd: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billingCycle">Billing Cycle</Label>
                    <Select
                      value={editData.billingCycle}
                      onValueChange={(value: string) =>
                        setEditData({ ...editData, billingCycle: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select billing cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not specified</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teamSize">Expected Team Size</Label>
                    <Input
                      id="teamSize"
                      type="number"
                      value={editData.teamSize}
                      onChange={(e) => setEditData({ ...editData, teamSize: e.target.value })}
                      placeholder="5"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Status</p>
                    <p className="text-sm text-gray-600 capitalize">{client.status}</p>
                  </div>
                  {client.contractType && (
                    <div>
                      <p className="text-sm font-medium text-gray-900">Primary Contract Type</p>
                      <p className="text-sm text-gray-600 capitalize">{client.contractType}</p>
                    </div>
                  )}
                </div>

                {(client.contractStart || client.contractEnd) && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      {client.contractStart && (
                        <div>
                          <p className="text-sm font-medium text-gray-900">Start Date</p>
                          <p className="text-sm text-gray-600">{new Date(client.contractStart).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      )}
                      {client.contractEnd && (
                        <div>
                          <p className="text-sm font-medium text-gray-900">End Date</p>
                          <p className="text-sm text-gray-600">{new Date(client.contractEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      )}
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

                <div>
                  <p className="text-sm font-medium text-gray-900">Expected Team Size</p>
                  <p className="text-sm text-gray-600">{client.teamSize || 'Not specified'} {client.teamSize ? 'members' : ''}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Client Since</p>
                  <p className="text-sm text-gray-600">{new Date(client.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Invoice Management
            </CardTitle>
            <Button
              onClick={() => {
                setInitialInvoiceServiceId(null)
                setIsInvoiceFormOpen(true)
              }}
              size="sm"
              className="gap-2"
              title="Create a new invoice"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <InvoiceStatsChart clientId={client.id} />
        </CardContent>
      </Card>

      {/* Service Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Assignments</CardTitle>
              <CardDescription>Active Services</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showAllServiceAssignments}
                  onChange={(event) => setShowAllServiceAssignments(event.target.checked)}
                  className="rounded"
                />
                Show All
              </label>
              <Button onClick={() => setIsServiceDialogOpen(true)} title="Add a new service assignment">
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visibleServiceAssignments.length > 0 ? (
            <div className="space-y-4">
              {visibleServiceAssignments.map((service) => {
                const serviceDisplayTitle = service.serviceTitle || service.serviceTypeName

                return (
                <div key={service.id} className="border rounded-lg overflow-hidden">
                  {/* Service Header */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                    <div className="flex-1">
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-xl text-blue-800 tracking-tight">
                            {serviceDisplayTitle}
                          </h4>
                          <div className="flex items-center gap-2">
                            {service.serviceTitle && (
                              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm px-3 border-none flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {service.serviceTypeName}
                              </Badge>
                            )}
                            <Badge className={service.serviceCategory === 'outstaffing' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-green-100 text-green-800 border-green-200'}>
                              {service.serviceCategory}
                            </Badge>
                            <Badge variant="outline" className={service.billingModel === 'hourly' ? 'bg-amber-50 text-amber-700 border-amber-200' : service.billingModel === 'monthly' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                              {service.billingModel}
                            </Badge>
                            {service.slackChannelId && (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                Slack Notifications Active
                              </Badge>
                            )}
                            {!service.isActive && (
                              <Badge variant="destructive" className="animate-pulse">
                                Ended
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {service.serviceDescription && (
                        <p className="text-sm text-gray-600 mb-2">{service.serviceDescription}</p>
                      )}
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        {service.serviceLevelPrice ? (
                          <span>Service Price: ${service.serviceLevelPrice.toLocaleString()}/{service.billingModel === 'hourly' ? 'hr' : service.billingModel === 'monthly' ? 'month' : 'project'}</span>
                        ) : service.rate ? (
                          <span>Rate: ${service.rate.toLocaleString()}/{service.billingModel === 'hourly' ? 'hr' : service.billingModel === 'monthly' ? 'month' : 'project'}</span>
                        ) : (
                          serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 && (
                            <span>
                              Pricing: Individual developers ({serviceDevelopers[service.id].filter(d => d.isActive && (d.hourlyRate || d.fixedPrice)).length} with rates)
                            </span>
                          )
                        )}
                        <span>Started: {parseLocalDate(service.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        {service.endDate && (
                          <span>Ended: {parseLocalDate(service.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        )}
                        {service.slackChannelId && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                            Slack: {service.slackChannelId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditService(service)}
                        className="text-gray-600 hover:text-gray-700"
                        title="Edit service details"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {service.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInvoiceForService(service.id)}
                          className="text-emerald-600 hover:text-emerald-700"
                          title="Create invoice for this service"
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Invoice
                        </Button>
                      )}
                      {service.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddDeveloperToService(service.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Add developer to service"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Developer
                        </Button>
                      )}
                      {service.isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveService(service.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Deactivate service"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveService(service.id, true)}
                          className="text-red-700 hover:text-red-800 border-red-200"
                          title="Permanently delete service assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Developers Section */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-medium text-gray-900">Assigned Developers</h5>
                      {serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {serviceDevelopers[service.id].filter(dev => dev.isActive).length} active
                        </Badge>
                      )}
                    </div>

                    {serviceDevelopers[service.id] && serviceDevelopers[service.id].length > 0 ? (
                      <div className="space-y-2">
                        {serviceDevelopers[service.id].map((developer) => (
                          <div key={developer.id} className="flex items-center justify-between p-3 bg-white border rounded">
                            <div className="flex flex-1 items-start gap-3">
                              {developer.avatarUrl ? (
                                <img
                                  src={resolveApiAssetUrl(developer.avatarUrl)}
                                  alt={developer.name}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                                  {developer.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <p className="text-sm font-medium text-gray-900">{developer.name}</p>
                                <Badge variant={developer.employmentType === 'fulltime' ? 'default' : 'secondary'} className="text-xs">
                                  {developer.employmentType === 'fulltime' ? 'Full-time' : developer.employmentType === 'freelancer' ? 'Freelancer' : 'Part-time'}
                                </Badge>
                                {!developer.isActive && (
                                  <Badge variant="outline" className="text-red-600 text-xs">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>{developer.email}</span>
                                {developer.hourlyRate && <span>Rate: ${developer.hourlyRate}/hr</span>}
                                {developer.fixedPrice && <span>Fixed: ${developer.fixedPrice}</span>}
                                <span>Started: {parseLocalDate(developer.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                              </div>
                              {developer.workSchedule && (
                                <div className="flex items-center gap-1 mt-2">
                                  <span className="text-xs text-gray-600 mr-2">Schedule:</span>
                                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, idx) => {
                                    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                                    const dayValue = developer.workSchedule?.[dayNames[idx]] || 'off'
                                    return (
                                      <div
                                        key={idx}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${dayValue === 'full' ? 'bg-green-100 text-green-800' :
                                          dayValue === 'half' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-400'
                                          }`}
                                        title={`${dayNames[idx]}: ${dayValue}`}
                                      >
                                        {dayLetter}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {developer.skills && developer.skills.length > 0 && (
                                <div className="flex gap-1 mt-2">
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
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDeveloper(service.id, developer)}
                                className="text-blue-600 hover:text-blue-700"
                                title="Edit developer pricing"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {developer.isActive ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveDeveloper(service.id, developer.id)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Deactivate developer assignment"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveDeveloper(service.id, developer.id, true)}
                                  className="text-red-700 hover:text-red-800 border-red-200"
                                  title="Permanently remove developer assignment"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 border border-dashed rounded">
                        <Users className="mx-auto h-6 w-6 text-gray-300 mb-2" />
                        <p className="text-sm">No developers assigned to this service</p>
                      </div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Building className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {client.services?.length ? 'No Active Services' : 'No Services Assigned'}
              </h3>
              <p>
                {client.services?.length ? 'Turn on Show All to view ended services.' : "This client doesn't have any service assignments yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Service Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service to {client?.name}</DialogTitle>
            <DialogDescription>
              Assign a new service to this client with custom rates and start date.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceType">Service Type</Label>
              <Select
                value={newServiceData.serviceTypeId}
                onValueChange={(value) => setNewServiceData({ ...newServiceData, serviceTypeId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service type" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()} label={service.name}>
                      {service.name} ({service.category}) - {service.billingModel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rate">Service-Level Price (Optional)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                value={newServiceData.rate}
                onChange={(e) => setNewServiceData({ ...newServiceData, rate: e.target.value })}
                placeholder="Leave empty if pricing per developers"
              />
            </div>

            <div>
              <Label htmlFor="serviceTitle">Service Title (Optional)</Label>
              <Input
                id="serviceTitle"
                value={newServiceData.serviceTitle}
                onChange={(e) => setNewServiceData({ ...newServiceData, serviceTitle: e.target.value })}
                placeholder="e.g., Hotel Quotation Platform"
              />
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={newServiceData.startDate}
                onChange={(e) => setNewServiceData({ ...newServiceData, startDate: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Label htmlFor="slackChannelId" className="mb-0">Slack Channel ID (Optional)</Label>
                <Tooltip content={
                  <div className="space-y-2">
                    <p className="font-semibold">How to configure Slack notifications:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Create or select a channel in your Slack workspace.</li>
                      <li>Go to the <strong>Integrations</strong> tab and add the <span className="font-mono bg-white/10 px-1 rounded">Vestov Shifts</span> app.</li>
                      <li>Go to the <strong>About</strong> tab, copy the <strong>Channel ID</strong> at the bottom, and paste it here.</li>
                    </ol>
                    <p className="text-blue-200">Our bot will notify this channel whenever a developer starts, ends, or takes a break during their shift.</p>
                  </div>
                }>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors" />
                </Tooltip>
              </div>
              <Input
                id="slackChannelId"
                value={newServiceData.slackChannelId}
                onChange={(e) => setNewServiceData({ ...newServiceData, slackChannelId: e.target.value })}
                placeholder="e.g., C0123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                Notifications for this service will be sent to this channel instead of the default admin channel.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsServiceDialogOpen(false)
                resetServiceForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddService}>
              Add Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Developer Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member to Service</DialogTitle>
            <DialogDescription>
              Assign a developer to this service with employment type and compensation details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="developer">Team Member</Label>
              <Select
                value={newDeveloperData.developerId}
                onValueChange={(value) => setNewDeveloperData({ ...newDeveloperData, developerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member" />
                </SelectTrigger>
                <SelectContent>
                  {developers.map((developer) => (
                    <SelectItem key={developer.id} value={developer.id.toString()} label={developer.name}>
                      {developer.name} ({developer.position}) - {developer.skills?.slice(0, 2).join(', ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select
                value={newDeveloperData.employmentType}
                onValueChange={(value) => setNewDeveloperData({ ...newDeveloperData, employmentType: value as 'fulltime' | 'part_time' | 'freelancer' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fulltime">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hourlyRate">Hourly Rate (Optional)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={newDeveloperData.hourlyRate}
                  onChange={(e) => setNewDeveloperData({ ...newDeveloperData, hourlyRate: e.target.value })}
                  placeholder="e.g., 45.00"
                />
              </div>

              <div>
                <Label htmlFor="fixedPrice">Fixed Price (Optional)</Label>
                <Input
                  id="fixedPrice"
                  type="number"
                  step="0.01"
                  value={newDeveloperData.fixedPrice}
                  onChange={(e) => setNewDeveloperData({ ...newDeveloperData, fixedPrice: e.target.value })}
                  placeholder="e.g., 5000.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="devStartDate">Start Date</Label>
              <Input
                id="devStartDate"
                type="date"
                value={newDeveloperData.startDate}
                onChange={(e) => setNewDeveloperData({ ...newDeveloperData, startDate: e.target.value })}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <p><strong>Note:</strong> You can set either hourly rate or fixed price, or leave both empty if pricing is managed at service level.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMemberDialogOpen(false)
                resetDeveloperForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddDeveloper}>
              Add Developer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditServiceDialogOpen} onOpenChange={setIsEditServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service: {editingServiceData?.serviceTypeName}</DialogTitle>
            <DialogDescription>
              Update service pricing, dates, and status for this client assignment.
            </DialogDescription>
          </DialogHeader>

          {editingServiceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editRate">Legacy Rate (Optional)</Label>
                  <Input
                    id="editRate"
                    type="number"
                    step="0.01"
                    value={editingServiceData.rate || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      rate: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    placeholder="Legacy rate field"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="editServiceTitle">Service Title (Optional)</Label>
                  <Input
                    id="editServiceTitle"
                    value={editingServiceData.serviceTitle}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      serviceTitle: e.target.value
                    })}
                    placeholder="e.g., Hotel Quotation Platform"
                  />
                </div>

                <div>
                  <Label htmlFor="editServicePrice">Service-Level Price (Optional)</Label>
                  <Input
                    id="editServicePrice"
                    type="number"
                    step="0.01"
                    value={editingServiceData.serviceLevelPrice || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      serviceLevelPrice: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    placeholder="Service-level pricing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editStartDate">Start Date</Label>
                  <Input
                    id="editStartDate"
                    type="date"
                    value={editingServiceData.startDate}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      startDate: e.target.value
                    })}
                  />
                </div>

                <div>
                  <Label htmlFor="editEndDate">End Date (Optional)</Label>
                  <Input
                    id="editEndDate"
                    type="date"
                    value={editingServiceData.endDate || ''}
                    onChange={(e) => setEditingServiceData({
                      ...editingServiceData,
                      endDate: e.target.value || undefined
                    })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Label htmlFor="editSlackChannelId" className="mb-0">Slack Channel ID (Optional)</Label>
                  <Tooltip content={
                    <div className="space-y-2">
                      <p className="font-semibold">How to configure Slack notifications:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Create or select a channel in your Slack workspace.</li>
                        <li>Go to the <strong>Integrations</strong> tab and add the <span className="font-mono bg-white/10 px-1 rounded">Vestov Shifts</span> app.</li>
                        <li>Go to the <strong>About</strong> tab, copy the <strong>Channel ID</strong> at the bottom, and paste it here.</li>
                      </ol>
                      <p className="text-blue-200">Our bot will notify this channel whenever a developer starts, ends, or takes a break during their shift.</p>
                    </div>
                  }>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-500 hover:text-blue-600 transition-colors" />
                  </Tooltip>
                </div>
                <Input
                  id="editSlackChannelId"
                  value={editingServiceData.slackChannelId || ''}
                  onChange={(e) => setEditingServiceData({
                    ...editingServiceData,
                    slackChannelId: e.target.value
                  })}
                  placeholder="e.g., C0123456789"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Notifications for this service will be sent to this channel instead of the default admin channel.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editingServiceData.isActive}
                  onChange={(e) => setEditingServiceData({
                    ...editingServiceData,
                    isActive: e.target.checked
                  })}
                  className="rounded"
                />
                <Label htmlFor="editIsActive">Service is active</Label>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                <p><strong>Note:</strong> Set service-level price for fixed pricing, or leave empty if pricing comes from individual developers.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditServiceDialogOpen(false)
                resetEditServiceForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateService}>
              Update Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Developer Pricing Dialog */}
      <Dialog open={isEditDeveloperDialogOpen} onOpenChange={setIsEditDeveloperDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Developer Details: {editingDeveloper?.name}</DialogTitle>
            <DialogDescription>
              Update pricing and work schedule for this developer assignment.
            </DialogDescription>
          </DialogHeader>

          {editingDeveloper && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editHourlyRate">Hourly Rate (Optional)</Label>
                  <Input
                    id="editHourlyRate"
                    type="number"
                    step="0.01"
                    value={editDeveloperData.hourlyRate}
                    onChange={(e) => setEditDeveloperData({
                      ...editDeveloperData,
                      hourlyRate: e.target.value
                    })}
                    placeholder="Hourly rate ($/hr)"
                  />
                </div>

                <div>
                  <Label htmlFor="editFixedPrice">Fixed Price (Optional)</Label>
                  <Input
                    id="editFixedPrice"
                    type="number"
                    step="0.01"
                    value={editDeveloperData.fixedPrice}
                    onChange={(e) => setEditDeveloperData({
                      ...editDeveloperData,
                      fixedPrice: e.target.value
                    })}
                    placeholder="Fixed price ($)"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Work Schedule</Label>
                <div className="space-y-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                    <div key={day} className="flex items-center gap-4 p-3 border rounded">
                      <div className="w-24 font-medium capitalize">{day}</div>
                      <div className="flex gap-2 flex-1">
                        <Button
                          type="button"
                          variant={editDeveloperData.workSchedule[day] === 'full' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditDeveloperData({
                            ...editDeveloperData,
                            workSchedule: { ...editDeveloperData.workSchedule, [day]: 'full' }
                          })}
                          className="flex-1"
                        >
                          Full Day
                        </Button>
                        <Button
                          type="button"
                          variant={editDeveloperData.workSchedule[day] === 'half' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditDeveloperData({
                            ...editDeveloperData,
                            workSchedule: { ...editDeveloperData.workSchedule, [day]: 'half' }
                          })}
                          className="flex-1"
                        >
                          Half Day
                        </Button>
                        <Button
                          type="button"
                          variant={editDeveloperData.workSchedule[day] === 'off' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditDeveloperData({
                            ...editDeveloperData,
                            workSchedule: { ...editDeveloperData.workSchedule, [day]: 'off' }
                          })}
                          className="flex-1"
                        >
                          Off
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                <p><strong>Pricing:</strong> Set hourly rate, fixed price, or both depending on the pricing model.</p>
                <p className="mt-1"><strong>Schedule:</strong> Full Day = 8 hours, Half Day = 4 hours, Off = not working.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDeveloperDialogOpen(false)
                setEditingDeveloper(null)
                setEditDeveloperData({
                  hourlyRate: '',
                  fixedPrice: '',
                  workSchedule: {
                    monday: 'full',
                    tuesday: 'full',
                    wednesday: 'full',
                    thursday: 'full',
                    friday: 'full',
                    saturday: 'off',
                    sunday: 'off',
                  },
                })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDeveloperPricing}>
              Update Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Access Management
              </CardTitle>
              <CardDescription>Manage users who can access this client's portal</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAssignUserDialogOpen(true)}
                size="sm"
                className="gap-2"
                title="Assign a user to this client"
              >
                <UserPlus className="h-4 w-4" />
                Assign User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientUsers.length > 0 ? (
            <div className="space-y-4">
              {clientUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.fullName}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>@{user.username}</span>
                          <span>{user.email}</span>
                          {user.position && <span>{user.position}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Badge variant={user.role === 'admin' ? 'default' : user.role === 'team_member' ? 'secondary' : 'outline'}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                      <Badge className={
                        user.accessLevel === 'admin' ? 'bg-red-100 text-red-800' :
                          user.accessLevel === 'write' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                      }>
                        {user.accessLevel} access
                      </Badge>
                      {!user.assignmentActive && (
                        <Badge variant="outline" className="text-red-600">
                          Inactive
                        </Badge>
                      )}
                      <span className="text-gray-500">
                        Assigned: {new Date(user.assignedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                      {user.lastLoginAt && (
                        <span className="text-gray-500">
                          Last login: {new Date(user.lastLoginAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={user.accessLevel}
                      onValueChange={(value: 'read' | 'write' | 'admin') =>
                        handleUpdateUserAccess(user.id, value)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="write">Write</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveUserFromClient(user.id, user.fullName)}
                      className="text-red-600 hover:text-red-700"
                      title="Remove user from client"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Users Assigned</h3>
              <p>This client doesn't have any users with portal access yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <CardDescription>Client documents and files</CardDescription>
            </div>
            <Button onClick={() => setIsDocumentDialogOpen(true)} title="Upload a new document">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
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
                        <p className="font-medium text-gray-900">{doc.document.name}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <Badge variant="outline" className="text-xs">
                            {doc.document.type}
                          </Badge>
                          <span>{formatFileSize(doc.document.fileSize)}</span>
                          <span>Uploaded: {new Date(doc.document.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Uploaded by: {doc.uploadedBy.fullName} ({doc.uploadedBy.email})
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDocumentDelete(doc.document.id, doc.document.name)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Documents</h3>
              <p>This client doesn't have any documents uploaded yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Document Dialog */}
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document for {client?.name}</DialogTitle>
            <DialogDescription>
              Upload a document for this client. Supported formats: PDF, Word, Excel, Images, and Text files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="documentFile">Document File</Label>
              <Input
                id="documentFile"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <Select
                value={uploadDocumentType}
                onValueChange={setUploadDocumentType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <p><strong>File Limits:</strong> Maximum 10MB per file. Allowed types: PDF, Word, Excel, Images (JPG, PNG, GIF), and Text files.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDocumentDialogOpen(false)
                resetDocumentForm()
              }}
              disabled={isUploadingDocument}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDocumentUpload}
              disabled={!selectedFile || isUploadingDocument}
            >
              {isUploadingDocument ? 'Uploading...' : 'Upload Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog - Custom Wide Modal */}
      {isPreviewDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsPreviewDialogOpen(false)}
          />
          <div className="relative stripe-card rounded-lg w-[90vw] md:w-[70vw] max-h-[95vh] overflow-y-auto mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold leading-none tracking-tight text-slate-900">
                  Preview: {previewDocument?.document.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Document preview - {previewDocument ? formatFileSize(previewDocument.document.fileSize) : ''}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewDialogOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto">
              {previewDocument && (
                <div className="w-full h-[80vh] border rounded">
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
                        <Button
                          className="mt-4"
                          onClick={() => previewDocument && handleDocumentDownload(previewDocument.document.id, previewDocument.document.name)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download to View
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between w-full mt-6">
              <div className="text-sm text-gray-500">
                Uploaded by: {previewDocument?.uploadedBy.fullName} on{' '}
                {previewDocument ? new Date(previewDocument.document.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => previewDocument && handleDocumentDownload(previewDocument.document.id, previewDocument.document.name)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : `Add Contact for ${client?.name}`}
            </DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update contact information.' : 'Add a new point of contact for this client.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="contactFullName">Full Name *</Label>
              <Input
                id="contactFullName"
                value={contactFormData.fullName}
                onChange={(e) => setContactFormData({ ...contactFormData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="contactPosition">Position</Label>
              <Input
                id="contactPosition"
                value={contactFormData.position}
                onChange={(e) => setContactFormData({ ...contactFormData, position: e.target.value })}
                placeholder="e.g., CTO, Project Manager"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="contactAvatar">Contact Image</Label>
              <div className="mt-2 flex items-center gap-3">
                {editingContact?.avatarUrl && !contactAvatarFile && (
                  <img
                    src={resolveApiAssetUrl(editingContact.avatarUrl)}
                    alt={editingContact.fullName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <Input
                  id="contactAvatar"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(event) => setContactAvatarFile(event.target.files?.[0] || null)}
                />
              </div>
              {contactAvatarFile && (
                <p className="mt-1 text-xs text-gray-500">{contactAvatarFile.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="contactNotes">Notes</Label>
              <Textarea
                id="contactNotes"
                value={contactFormData.notes}
                onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                placeholder="Additional notes about this contact..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="contactIsPrimary"
                checked={contactFormData.isPrimary}
                onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="contactIsPrimary" className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Primary Contact
              </Label>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <p><strong>Note:</strong> Only one contact can be marked as primary at a time. Setting this as primary will automatically update any existing primary contact.</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsContactDialogOpen(false)
                resetContactForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingContact ? handleUpdateContact : handleCreateContact}
              disabled={isUploadingContactAvatar}
            >
              {isUploadingContactAvatar ? 'Uploading...' : editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Assign User Dialog */}
      <Dialog open={isAssignUserDialogOpen} onOpenChange={setIsAssignUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to {client?.name}</DialogTitle>
            <DialogDescription>
              Assign an existing client user to this client's portal. Only users with 'client' role can be assigned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="assignUser">Select User</Label>
              <Select
                value={assignUserData.userId}
                onValueChange={(value) => setAssignUserData({ ...assignUserData, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user to assign" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers
                    .filter(user => !clientUsers.some(cu => cu.id === user.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()} label={user.fullName}>
                        {user.fullName} (@{user.username}) - {user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignAccessLevel">Access Level</Label>
              <Select
                value={assignUserData.accessLevel}
                onValueChange={(value: 'read' | 'write' | 'admin') =>
                  setAssignUserData({ ...assignUserData, accessLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read - View only access</SelectItem>
                  <SelectItem value="write">Write - Can view and edit</SelectItem>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
              <p><strong>Access Levels:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Read:</strong> Can view client information, services, documents, and invoices</li>
                <li><strong>Write:</strong> Can edit client information and manage some resources</li>
                <li><strong>Admin:</strong> Full access to all client resources and settings</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignUserDialogOpen(false)
                resetAssignUserForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignUser}>
              Assign User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Invoice Form */}
      {client && (
        <EnhancedInvoiceForm
          clientId={client.id}
          clientName={client.name}
          isOpen={isInvoiceFormOpen}
          initialServiceId={initialInvoiceServiceId}
          onClose={() => {
            setIsInvoiceFormOpen(false)
            setInitialInvoiceServiceId(null)
          }}
          onSuccess={() => {
            // Refresh the page data after successful invoice creation
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
