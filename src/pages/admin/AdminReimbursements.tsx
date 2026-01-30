import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, Search, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'

const getEvidenceUrl = (evidencePath: string | null) => {
  if (!evidencePath) return null
  const envApiUrl = import.meta.env.VITE_API_URL
  const API_BASE = envApiUrl 
    ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/$/, '')}/api`)
    : '/api'
  // Extract filename from path (e.g., /uploads/evidence-123.jpg -> evidence-123.jpg)
  const filename = evidencePath.split('/').pop() || ''
  // Use the API endpoint to serve the file with authentication
  return `${API_BASE}/reimbursements/evidence/${filename}`
}

interface ReimbursementRequest {
  id: number
  employeeId: number
  employeeName: string
  year: number
  expenseAmount: string
  reimbursementAmount: string
  description: string
  category: string | null
  status: 'pending' | 'approved' | 'rejected' | 'confirmed'
  requestedAt: string
  requestedByName: string
  approvedAt: string | null
  approvalNote: string | null
  evidenceUrl: string | null
  confirmedAt: string | null
}

export function AdminReimbursements() {
  const [requests, setRequests] = useState<ReimbursementRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<ReimbursementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  // Dialog state for approve/reject
  const [showDialog, setShowDialog] = useState(false)
  const [dialogRequest, setDialogRequest] = useState<ReimbursementRequest | null>(null)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve')
  const [dialogNote, setDialogNote] = useState('')

  useEffect(() => {
    loadRequests()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [requests, statusFilter, searchTerm, yearFilter])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const data = await api.request('/reimbursements')
      setRequests(data)
    } catch (error) {
      console.error('Error loading reimbursement requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...requests]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Year filter
    if (yearFilter !== 'all') {
      filtered = filtered.filter(r => r.year.toString() === yearFilter)
    }

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.employeeName.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        (r.category?.toLowerCase().includes(term))
      )
    }

    setFilteredRequests(filtered)
  }

  const handleApproveClick = (request: ReimbursementRequest) => {
    setDialogRequest(request)
    setDialogAction('approve')
    setDialogNote('')
    setShowDialog(true)
  }

  const handleRejectClick = (request: ReimbursementRequest) => {
    setDialogRequest(request)
    setDialogAction('reject')
    setDialogNote('')
    setShowDialog(true)
  }

  const handleDialogSubmit = async () => {
    if (!dialogRequest) return

    if (dialogAction === 'reject' && !dialogNote.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      setProcessing(dialogRequest.id)
      const endpoint = dialogAction === 'approve' ? 'approve' : 'reject'
      await api.request(`/reimbursements/${dialogRequest.id}/${endpoint}`, {
        method: 'PUT',
        body: JSON.stringify({ note: dialogNote.trim() || undefined })
      })

      // Close dialog and reload
      setShowDialog(false)
      setDialogRequest(null)
      setDialogNote('')
      await loadRequests()
      alert(`Request ${dialogAction === 'approve' ? 'approved' : 'rejected'} successfully!`)
    } catch (error: any) {
      console.error(`Error ${dialogAction}ing request:`, error)
      alert(error.message || `Failed to ${dialogAction} request. Please try again.`)
      alert(error.message || `Failed to ${dialogAction} request`)
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pending Review
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <AlertCircle className="w-4 h-4 mr-1" />
            Awaiting Evidence
          </span>
        )
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Confirmed
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4 mr-1" />
            Rejected
          </span>
        )
      default:
        return status
    }
  }

  const getAvailableYears = () => {
    const years = new Set(requests.map(r => r.year))
    return Array.from(years).sort((a, b) => b - a)
  }

  const getStats = () => {
    return {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      confirmed: requests.filter(r => r.status === 'confirmed').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      totalAmount: requests
        .filter(r => r.status === 'confirmed')
        .reduce((sum, r) => sum + parseFloat(r.reimbursementAmount), 0)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const stats = getStats()

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Workspace Reimbursements
            </h1>
            <p className="stripe-text-secondary text-lg">
              Review and manage employee reimbursement requests
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="text-sm text-yellow-700 mb-1">Pending Review</div>
            <div className="text-3xl font-bold text-yellow-900">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-sm text-blue-700 mb-1">Awaiting Evidence</div>
            <div className="text-3xl font-bold text-blue-900">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 mb-1">Confirmed</div>
            <div className="text-3xl font-bold text-green-900">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700 mb-1">Rejected</div>
            <div className="text-3xl font-bold text-red-900">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-700 mb-1">Total Paid ({yearFilter})</div>
            <div className="text-3xl font-bold text-gray-900">${stats.totalAmount.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Employee, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {getAvailableYears().map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all')
                  setSearchTerm('')
                  setYearFilter(new Date().getFullYear().toString())
                }}
                className="w-full"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>Reimbursement Requests</CardTitle>
          <CardDescription>
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No reimbursement requests found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.employeeName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                      {request.category && (
                        <p className="text-xs text-gray-500 mt-1">
                          Category: {request.category.charAt(0).toUpperCase() + request.category.slice(1)}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Expense</div>
                      <div className="font-semibold text-gray-900">
                        ${parseFloat(request.expenseAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Reimbursement</div>
                      <div className="font-semibold text-blue-600">
                        ${parseFloat(request.reimbursementAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Year</div>
                      <div className="font-semibold text-gray-900">{request.year}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Requested</div>
                      <div className="font-semibold text-gray-900">
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">By</div>
                      <div className="font-semibold text-gray-900">{request.requestedByName}</div>
                    </div>
                  </div>

                  {request.approvalNote && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">
                        {request.status === 'rejected' ? 'Rejection Reason' : 'Admin Note'}
                      </div>
                      <div className="text-sm text-gray-900">{request.approvalNote}</div>
                    </div>
                  )}

                  {request.evidenceUrl && (
                    <div className="mb-3">
                      <a
                        href={getEvidenceUrl(request.evidenceUrl) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Uploaded Evidence
                      </a>
                    </div>
                  )}

                  {request.status === 'pending' && (
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectClick(request)}
                        disabled={processing === request.id}
                        className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveClick(request)}
                        disabled={processing === request.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve/Reject Dialog */}
      {showDialog && dialogRequest && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDialog(false)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>
                {dialogAction === 'approve' ? 'Approve' : 'Reject'} Reimbursement
              </CardTitle>
              <CardDescription>
                {dialogAction === 'approve'
                  ? 'Approve this reimbursement request. Employee will need to upload evidence.'
                  : 'Reject this reimbursement request. Please provide a reason.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">{dialogRequest.employeeName}</div>
                  <div className="text-sm text-gray-600 mt-1">{dialogRequest.description}</div>
                  <div className="text-sm font-semibold text-blue-600 mt-2">
                    Reimbursement: ${parseFloat(dialogRequest.reimbursementAmount).toFixed(2)}
                  </div>
                </div>

                <div>
                  <Label>
                    {dialogAction === 'approve' ? 'Note (optional)' : 'Rejection Reason (required)'}
                  </Label>
                  <Textarea
                    value={dialogNote}
                    onChange={(e) => setDialogNote(e.target.value)}
                    placeholder={
                      dialogAction === 'approve'
                        ? 'Add a note (optional)...'
                        : 'Explain why this request is being rejected...'
                    }
                    rows={3}
                    required={dialogAction === 'reject'}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDialog(false)
                      setDialogRequest(null)
                      setDialogNote('')
                    }}
                    disabled={processing === dialogRequest.id}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDialogSubmit}
                    disabled={processing === dialogRequest.id}
                    className={`flex-1 ${
                      dialogAction === 'approve'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    } text-white`}
                  >
                    {processing === dialogRequest.id
                      ? 'Processing...'
                      : dialogAction === 'approve'
                      ? 'Approve'
                      : 'Reject'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
