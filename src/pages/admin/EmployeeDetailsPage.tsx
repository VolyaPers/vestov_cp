import { useQuery } from '@tanstack/react-query'
import { useRoute } from 'wouter'
import { ArrowLeft, Edit, MapPin, Mail, Phone, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Employee Not Found</h2>
        <p className="mt-2 text-gray-600">The employee you're looking for doesn't exist.</p>
        <Button className="mt-4" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={employee.avatarUrl} alt={employee.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {employee.name.split(' ').map((n: string) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
              <p className="text-gray-600">{employee.role}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  employee.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {employee.status}
                </span>
                {employee.clientName && (
                  <span className="text-sm text-gray-600">
                    Assigned to {employee.clientName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="professional">Professional Info</TabsTrigger>
          <TabsTrigger value="assignments">Assignment History</TabsTrigger>
          <TabsTrigger value="vacation">Leave & Vacation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="feedback">Feedback & Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Personal contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-600">{employee.email}</p>
                  </div>
                </div>
                {employee.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Phone</p>
                      <p className="text-sm text-gray-600">{employee.phone}</p>
                    </div>
                  </div>
                )}
                {employee.location && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Location</p>
                      <p className="text-sm text-gray-600">{employee.location}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Start Date</p>
                    <p className="text-sm text-gray-600">{formatDate(employee.startDate)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {employee.bio && (
            <Card>
              <CardHeader>
                <CardTitle>Biography</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{employee.bio}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="professional" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Professional Details</CardTitle>
              <CardDescription>Role, skills, and compensation information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Position</p>
                  <p className="text-sm text-gray-600 mt-1">{employee.role}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Status</p>
                  <p className="text-sm text-gray-600 mt-1 capitalize">{employee.status}</p>
                </div>
                {employee.hourlyRate && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Base Hourly Rate</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatCurrency(parseFloat(employee.hourlyRate))}
                    </p>
                  </div>
                )}
                {employee.monthlyRate && (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Monthly Rate</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatCurrency(parseFloat(employee.monthlyRate))}
                    </p>
                  </div>
                )}
              </div>

              {employee.skills && Array.isArray(employee.skills) && employee.skills.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-3">Skills & Expertise</p>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Assignment History</CardTitle>
              <CardDescription>Past and current client assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {employee.clientName ? (
                <div className="space-y-4">
                  <div className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="h-2 w-2 bg-green-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{employee.clientName}</h4>
                        <span className="text-sm text-green-600">Current</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Started: {formatDate(employee.startDate)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No client assignments found</p>
                  <p className="text-sm mt-1">This team member is currently on the bench</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vacation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balances</CardTitle>
              <CardDescription>Current vacation and leave balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>Leave balance information not available</p>
                <p className="text-sm mt-1">Vacation management system is being set up</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leave History</CardTitle>
              <CardDescription>Recent leave requests and history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>No leave history found</p>
                <p className="text-sm mt-1">Leave requests will appear here once submitted</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Employee Documents</CardTitle>
              <CardDescription>Contracts, certifications, and other documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>No documents available</p>
                <p className="text-sm mt-1">Employee documents will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Reviews</CardTitle>
              <CardDescription>Client feedback and performance evaluations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <p>No feedback available</p>
                <p className="text-sm mt-1">Client feedback and reviews will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}