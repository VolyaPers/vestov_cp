import { useState, useEffect } from 'react'
import { DollarSign, Upload, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
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

interface ReimbursementLimits {
  yearsAtCompany: number
  yearlyLimit: number
  usedAmount: number
  availableAmount: number
  year: number
}

interface ReimbursementRequest {
  id: number
  year: number
  expenseAmount: string
  reimbursementAmount: string
  description: string
  category: string | null
  status: 'pending' | 'approved' | 'rejected' | 'confirmed'
  requestedAt: string
  approvedAt: string | null
  approvalNote: string | null
  evidenceUrl: string | null
  confirmedAt: string | null
  approverName: string | null
}

const categories = [
  'laptop',
  'desk',
  'chair',
  'mouse',
  'keyboard',
  'webcam',
  'monitor',
  'headphones',
  'other'
]

export function EmployeeReimbursements() {
  const [limits, setLimits] = useState<ReimbursementLimits | null>(null)
  const [requests, setRequests] = useState<ReimbursementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const year = new Date().getFullYear()

      // Load limits
      try {
        const limitsData = await api.request(`/reimbursements/limits/${year}`)
        setLimits(limitsData)
      } catch (error) {
        console.error('Failed to load limits:', error)
      }

      // Load requests
      try {
        const requestsData = await api.request('/reimbursements/my-requests')
        setRequests(requestsData)
      } catch (error) {
        console.error('Failed to load requests:', error)
      }
    } catch (error) {
      console.error('Error loading reimbursement data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const expense = parseFloat(expenseAmount)
    if (isNaN(expense) || expense <= 0) {
      alert('Please enter a valid expense amount')
      return
    }

    if (!description.trim()) {
      alert('Please provide a description')
      return
    }

    try {
      setSubmitting(true)
      await api.request('/reimbursements', {
        method: 'POST',
        body: JSON.stringify({
          expenseAmount: expense,
          description: description.trim(),
          category: category || null
        })
      })

      // Reset form
      setExpenseAmount('')
      setDescription('')
      setCategory('')
      setShowForm(false)

      // Reload data
      await loadData()
      alert('Reimbursement request submitted successfully!')
    } catch (error: any) {
      console.error('Error submitting request:', error)
      alert(error.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUploadEvidence = async (requestId: number, file: File) => {
    try {
      setUploading(requestId)
      const formData = new FormData()
      formData.append('evidence', file)

      await api.requestFormData(`/reimbursements/${requestId}/upload`, formData)

      // Reload data
      await loadData()
      alert('Evidence uploaded successfully!')
    } catch (error) {
      console.error('Error uploading evidence:', error)
      alert('Failed to upload evidence')
    } finally {
      setUploading(null)
    }
  }

  const calculateReimbursement = () => {
    if (!limits) return 0
    const expense = parseFloat(expenseAmount) || 0
    const halfExpense = expense * 0.5
    return Math.min(halfExpense, limits.availableAmount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            Pending
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Workspace Reimbursements</h1>
        <p className="text-gray-500 mt-1">Request reimbursement for workspace equipment</p>
      </div>

      {/* Limits Card */}
      {limits && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>
              Based on {limits.yearsAtCompany} {limits.yearsAtCompany === 1 ? 'year' : 'years'} at Vestov
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Yearly Limit</div>
                <div className="text-2xl font-bold text-gray-900">
                  ${limits.yearlyLimit.toFixed(2)}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Used</div>
                <div className="text-2xl font-bold text-gray-900">
                  ${limits.usedAmount.toFixed(2)}
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 mb-1">Available</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${limits.availableAmount.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>• You can submit multiple requests throughout the year</p>
              <p>• Reimbursement is 50% of expense amount, up to your available limit</p>
              <p>• After admin approval, you must upload receipt/product evidence</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Button */}
      {!showForm && limits && limits.availableAmount > 0 && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          New Reimbursement Request
        </Button>
      )}

      {/* Request Form */}
      {showForm && (
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>New Reimbursement Request</CardTitle>
            <CardDescription>Submit a new workspace equipment reimbursement</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Expense Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you're purchasing..."
                  rows={3}
                  required
                />
              </div>

              {expenseAmount && limits && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600 mb-1">Estimated Reimbursement</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ${calculateReimbursement().toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    50% of ${parseFloat(expenseAmount).toFixed(2)} expense
                    {calculateReimbursement() < parseFloat(expenseAmount) * 0.5 && (
                      <span className="block mt-1">
                        (Capped to available limit of ${limits.availableAmount.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setExpenseAmount('')
                    setDescription('')
                    setCategory('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle>My Reimbursement Requests</CardTitle>
          <CardDescription>History of all your reimbursement requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No reimbursement requests yet
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.description}</h3>
                      {request.category && (
                        <p className="text-sm text-gray-500 mt-1">
                          Category: {request.category.charAt(0).toUpperCase() + request.category.slice(1)}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
                  </div>

                  {request.status === 'approved' && !request.confirmedAt && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-blue-900">
                            Upload Evidence Required
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            Upload receipt or product image to confirm reimbursement
                          </div>
                        </div>
                        <div>
                          <input
                            type="file"
                            id={`evidence-${request.id}`}
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleUploadEvidence(request.id, file)
                              }
                            }}
                            disabled={uploading === request.id}
                          />
                          <Button
                            size="sm"
                            onClick={() => document.getElementById(`evidence-${request.id}`)?.click()}
                            disabled={uploading === request.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading === request.id ? 'Uploading...' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.approvalNote && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">
                        {request.status === 'rejected' ? 'Rejection Reason' : 'Admin Note'}
                      </div>
                      <div className="text-sm text-gray-900">{request.approvalNote}</div>
                      {request.approverName && (
                        <div className="text-xs text-gray-500 mt-1">
                          By {request.approverName}
                        </div>
                      )}
                    </div>
                  )}

                  {request.evidenceUrl && (
                    <div className="mt-3">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
