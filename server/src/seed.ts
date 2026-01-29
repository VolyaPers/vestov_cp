import bcrypt from 'bcryptjs'
import { db } from './db/index.js'
import { users, clients, teamMembers, serviceTypes, leaveTypes } from './db/schema.js'

async function seed() {
  console.log('Seeding database...')

  try {
    // Create leave types
    const leaveTypesData = [
      { name: 'Vacation', isDeductible: true, halfDaySupported: true },
      { name: 'Sick Leave', isDeductible: true, halfDaySupported: true },
      { name: 'Personal Leave', isDeductible: true, halfDaySupported: true },
      { name: 'Maternity Leave', isDeductible: false, halfDaySupported: false },
      { name: 'Emergency Leave', isDeductible: true, halfDaySupported: true },
    ]

    await db.insert(leaveTypes).values(leaveTypesData).onConflictDoNothing()
    console.log('✓ Leave types created')

    // Create service types
    const serviceTypesData = [
      { name: 'Software Development', description: 'Full-stack development services', category: 'outstaffing', billingModel: 'hourly' },
      { name: 'UI/UX Design', description: 'User interface and experience design', category: 'outstaffing', billingModel: 'hourly' },
      { name: 'DevOps Services', description: 'Infrastructure and deployment automation', category: 'outstaffing', billingModel: 'monthly' },
      { name: 'Project Management', description: 'End-to-end project delivery', category: 'outsourcing', billingModel: 'fixed' },
      { name: 'Quality Assurance', description: 'Testing and quality assurance services', category: 'outstaffing', billingModel: 'hourly' },
    ]

    await db.insert(serviceTypes).values(serviceTypesData).onConflictDoNothing()
    console.log('✓ Service types created')

    // Create sample client
    const [sampleClient] = await db.insert(clients).values({
      name: 'TechCorp Inc',
      industry: 'Technology',
      contactPerson: 'John Smith',
      email: 'john.smith@techcorp.com',
      phone: '+1-555-0123',
      address: '123 Tech Street, Silicon Valley, CA',
      status: 'active',
      contractType: 'outstaffing',
      contractStart: '2024-01-01',
      contractEnd: '2024-12-31',
      billingRate: '150.00',
      billingCycle: 'monthly',
      activeServices: ['Software Development', 'UI/UX Design'],
      teamSize: 5,
    }).returning()
    console.log('✓ Sample client created')

    // Create admin user
    const hashedAdminPassword = await bcrypt.hash('admin123', 12)
    await db.insert(users).values({
      username: 'admin',
      password: hashedAdminPassword,
      fullName: 'System Administrator',
      email: 'admin@vestov.com',
      role: 'admin',
      position: 'System Administrator',
    }).onConflictDoNothing()
    console.log('✓ Admin user created (username: admin, password: admin123)')

    // Create client user
    const hashedClientPassword = await bcrypt.hash('client123', 12)
    await db.insert(users).values({
      username: 'client',
      password: hashedClientPassword,
      fullName: 'John Smith',
      email: 'john.smith@techcorp.com',
      role: 'client',
      position: 'Technical Director',
    }).onConflictDoNothing()
    console.log('✓ Client user created (username: client, password: client123)')

    // Create sample team members
    const teamMembersData = [
      {
        name: 'Alice Johnson',
        role: 'Senior Full-Stack Developer',
        email: 'alice.johnson@vestov.com',
        phone: '+1-555-0124',
        skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
        bio: 'Experienced full-stack developer with 5+ years in web development',
        hourlyRate: '85.00',
        monthlyRate: '14400.00',
        status: 'active',
        clientId: sampleClient.id,
        startDate: '2024-01-15',
        location: 'Remote',
      },
      {
        name: 'Bob Wilson',
        role: 'UI/UX Designer',
        email: 'bob.wilson@vestov.com',
        phone: '+1-555-0125',
        skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
        bio: 'Creative designer focused on user-centered design principles',
        hourlyRate: '75.00',
        monthlyRate: '12600.00',
        status: 'active',
        clientId: sampleClient.id,
        startDate: '2024-02-01',
        location: 'New York, NY',
      },
      {
        name: 'Carol Davis',
        role: 'DevOps Engineer',
        email: 'carol.davis@vestov.com',
        phone: '+1-555-0126',
        skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
        bio: 'DevOps specialist with expertise in cloud infrastructure',
        hourlyRate: '95.00',
        monthlyRate: '16000.00',
        status: 'active',
        clientId: sampleClient.id,
        startDate: '2024-01-20',
        location: 'Austin, TX',
      },
      {
        name: 'David Brown',
        role: 'QA Engineer',
        email: 'david.brown@vestov.com',
        phone: '+1-555-0127',
        skills: ['Selenium', 'Jest', 'Cypress', 'Test Automation'],
        bio: 'Quality assurance engineer ensuring robust software delivery',
        hourlyRate: '65.00',
        monthlyRate: '10920.00',
        status: 'bench',
        startDate: '2024-03-01',
        location: 'Remote',
      },
    ]

    const insertedTeamMembers = await db.insert(teamMembers).values(teamMembersData).returning()
    console.log('✓ Sample team members created')

    // Create team member user (eduardo) linked to first team member
    const hashedEmployeePassword = await bcrypt.hash('eduardo123', 12)
    await db.insert(users).values({
      username: 'eduardo',
      password: hashedEmployeePassword,
      fullName: 'Eduardo Cerato',
      email: 'eduardo.cerato@vestov.com',
      role: 'team_member',
      position: 'Full-Stack Developer',
      teamMemberId: insertedTeamMembers[0]?.id || 1,
    }).onConflictDoNothing()
    console.log('✓ Team member user created (username: eduardo, password: eduardo123)')

    console.log('🎉 Database seeding completed successfully!')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

seed()
  .catch((err) => {
    console.error('Seed script failed:', err)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })