import { useQuery } from '@tanstack/react-query'
import { useRoute } from 'wouter'
import { ArrowLeft, Edit, MapPin, Mail, Phone, Calendar, User, FileText, Star, Clock, CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

export function EmployeeDetailsPage() {
  const [, params] = useRoute('/admin/employees/:id')
  const employeeId = params?.id

  const { data: employee, isLoading } = useQuery({
    queryKey: ['admin', 'team-members', employeeId],
    queryFn: () => api.getTeamMember(employeeId!),
    enabled: !!employeeId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-sky-400 border-r-purple-400"></div>
          <div className="absolute inset-0 rounded-full bg-slate-200 opacity-20"></div>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="stripe-card rounded-lg p-12 border border-white/20 shadow-xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <User className="h-8 w-8 text-gray-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Employee Not Found</h2>
          <p className="text-gray-600 mb-8">The employee you're looking for doesn't exist.</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => window.history.back()}
                className="w-12 h-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-lg bg-slate-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {employee.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-xl bg-green-500 border-2 border-white flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 via-purple-600 to-purple-700 bg-clip-text text-transparent">{employee.name}</h1>
                  <p className="text-xl text-gray-600 font-medium mb-3">{employee.role}</p>
                  <div className="flex items-center space-x-4">
                    <span className={`px-4 py-2 text-sm font-semibold rounded-lg ${
                      employee.status === 'active' 
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200' 
                        : 'bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-700 border border-yellow-200'
                    }`}>
                      {employee.status}
                    </span>
                    {employee.clientName && (
                      <span className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-lg border border-blue-200">
                        Assigned to {employee.clientName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 hover:from-sky-500 hover:via-purple-500 hover:to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Edit className="h-4 w-4" />
              </div>
              Edit
            </button>
          </div>
        </div>

        {/* Modern Tabs */}
        <div className="space-y-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-lg p-4 border border-white/30 shadow-lg">
            <div className="flex gap-3 overflow-x-auto">
              {[
                { id: 'personal', label: 'Personal Info', icon: User },
                { id: 'professional', label: 'Professional Info', icon: Star },
                { id: 'assignments', label: 'Assignment History', icon: Calendar },
                { id: 'vacation', label: 'Leave & Vacation', icon: Clock },
                { id: 'documents', label: 'Documents', icon: FileText },
                { id: 'feedback', label: 'Feedback & Reviews', icon: Star }
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sky-400 via-purple-400 to-purple-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 whitespace-nowrap"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contact Information */}
          <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Contact Information</h2>
                <p className="text-gray-600 font-medium">Personal contact details</p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Email</p>
                  <p className="text-gray-600 font-medium">{employee.email}</p>
                </div>
              </div>
              {employee.phone && (
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Phone</p>
                    <p className="text-gray-600 font-medium">{employee.phone}</p>
                  </div>
                </div>
              )}
              {employee.location && (
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Location</p>
                    <p className="text-gray-600 font-medium">{employee.location}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Start Date</p>
                  <p className="text-gray-600 font-medium">{formatDate(employee.startDate)}</p>
                </div>
              </div>
            </div>
          </div>

          {employee.bio && (
            <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Biography</h2>
              </div>
              <p className="text-gray-700 leading-relaxed text-lg">{employee.bio}</p>
            </div>
          )}

          {/* Professional Details */}
          <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Professional Details</h2>
                <p className="text-gray-600 font-medium">Role, skills, and compensation information</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                  <p className="text-sm font-bold text-gray-900 mb-2">Position</p>
                  <p className="text-gray-700 font-medium text-lg">{employee.role}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-white/80 to-gray-50/80 rounded-lg border border-white/40">
                  <p className="text-sm font-bold text-gray-900 mb-2">Status</p>
                  <p className="text-gray-700 font-medium text-lg capitalize">{employee.status}</p>
                </div>
                {employee.hourlyRate && (
                  <div className="p-4 bg-gradient-to-br from-green-50/80 to-emerald-50/80 rounded-lg border border-green-200/40">
                    <p className="text-sm font-bold text-green-700 mb-2">Base Hourly Rate</p>
                    <p className="text-green-600 font-bold text-xl">
                      {formatCurrency(parseFloat(employee.hourlyRate))}
                    </p>
                  </div>
                )}
                {employee.monthlyRate && (
                  <div className="p-4 bg-gradient-to-br from-blue-50/80 to-sky-50/80 rounded-lg border border-blue-200/40">
                    <p className="text-sm font-bold text-blue-700 mb-2">Monthly Rate</p>
                    <p className="text-blue-600 font-bold text-xl">
                      {formatCurrency(parseFloat(employee.monthlyRate))}
                    </p>
                  </div>
                )}
              </div>

              {employee.skills && Array.isArray(employee.skills) && employee.skills.length > 0 && (
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-4">Skills & Expertise</p>
                  <div className="flex flex-wrap gap-3">
                    {employee.skills.map((skill: string, index: number) => (
                      <span
                        key={index}
                        className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-lg border border-blue-200 hover:shadow-md transition-all duration-200"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Assignment History */}
          <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Client Assignment History</h2>
                <p className="text-gray-600 font-medium">Past and current client assignments</p>
              </div>
            </div>
            {employee.clientName ? (
              <div className="space-y-4">
                <div className="flex items-start space-x-6 p-6 bg-gradient-to-br from-green-50/80 to-emerald-50/80 rounded-lg border border-green-200/40">
                  <div className="w-4 h-4 bg-green-500 rounded-full mt-2 shadow-lg"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xl font-bold text-gray-900">{employee.clientName}</h4>
                      <span className="px-4 py-2 text-sm font-semibold bg-green-500 text-white rounded-lg">
                        Current
                      </span>
                    </div>
                    <p className="text-gray-600 font-medium">
                      Started: {formatDate(employee.startDate)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No client assignments found</h3>
                <p className="text-gray-600 font-medium">This team member is currently on the bench</p>
              </div>
            )}
          </div>

          {/* Leave & Vacation */}
          <div className="space-y-8">
            <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Leave Balances</h2>
                  <p className="text-gray-600 font-medium">Current vacation and leave balances</p>
                </div>
              </div>
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Leave balance information not available</h3>
                <p className="text-gray-600 font-medium">Vacation management system is being set up</p>
              </div>
            </div>

            <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Leave History</h2>
                  <p className="text-gray-600 font-medium">Recent leave requests and history</p>
                </div>
              </div>
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No leave history found</h3>
                <p className="text-gray-600 font-medium">Leave requests will appear here once submitted</p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Documents</h2>
                <p className="text-gray-600 font-medium">Contracts, certifications, and other documents</p>
              </div>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No documents available</h3>
              <p className="text-gray-600 font-medium">Employee documents will be displayed here</p>
            </div>
          </div>

          {/* Feedback & Reviews */}
          <div className="stripe-card rounded-lg p-8 border border-white/20 shadow-xl shadow-purple-100/50 hover:shadow-2xl hover:shadow-purple-100/60 transition-all duration-300">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Performance Reviews</h2>
                <p className="text-gray-600 font-medium">Client feedback and performance evaluations</p>
              </div>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center">
                <Star className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No feedback available</h3>
              <p className="text-gray-600 font-medium">Client feedback and reviews will appear here</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}