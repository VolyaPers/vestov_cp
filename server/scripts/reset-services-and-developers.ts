#!/usr/bin/env npx tsx

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { serviceTypes, developers, clientServices, clientServiceDevelopers } from '../src/db/schema.js'
import { eq } from 'drizzle-orm'

const pool = new Pool({
  connectionString: 'postgresql://localhost:5432/vestov_portal',
})
const db = drizzle(pool)

async function resetServicesAndDevelopers() {
  try {
    console.log('🔄 Resetting services to only 3 required services...')
    
    // Clear existing client service developers first
    await db.delete(clientServiceDevelopers)
    
    // Clear existing client services
    await db.delete(clientServices)
    
    // Clear existing service types
    await db.delete(serviceTypes)
    
    // Insert the 3 required services
    const requiredServices = [
      {
        name: 'Outstaffing',
        description: 'Dedicated developers working on your project remotely as an extension of your team',
        category: 'outstaffing' as const,
        billingModel: 'monthly' as const
      },
      {
        name: 'Outsourcing',
        description: 'Complete project development handled by our team with full project management',
        category: 'outsourcing' as const,
        billingModel: 'fixed' as const
      },
      {
        name: 'Pay Per Delivery (PPD)',
        description: 'Pay only for completed deliverables and milestones',
        category: 'outsourcing' as const,
        billingModel: 'fixed' as const
      }
    ]
    
    await db.insert(serviceTypes).values(requiredServices)
    console.log('✅ Services updated successfully!')
    
    console.log('🔄 Adding test developers...')
    
    // Clear existing developers
    await db.delete(developers)
    
    // Add test developers
    const testDevelopers = [
      {
        name: 'Alex Johnson',
        email: 'alex.johnson@vestov.com',
        skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        hourlyRate: '45.00',
        experienceLevel: 'senior' as const,
        status: 'available' as const,
        bio: 'Full-stack developer with 5+ years experience in modern web technologies',
        location: 'Ukraine'
      },
      {
        name: 'Maria Garcia',
        email: 'maria.garcia@vestov.com',
        skills: ['Vue.js', 'Python', 'Django', 'MongoDB'],
        hourlyRate: '40.00',
        experienceLevel: 'middle' as const,
        status: 'available' as const,
        bio: 'Full-stack developer specializing in Vue.js and Python backends',
        location: 'Spain'
      },
      {
        name: 'Dmitri Volkov',
        email: 'dmitri.volkov@vestov.com',
        skills: ['Angular', 'Java', 'Spring Boot', 'MySQL'],
        hourlyRate: '50.00',
        experienceLevel: 'senior' as const,
        status: 'available' as const,
        bio: 'Enterprise application developer with expertise in Angular and Java ecosystem',
        location: 'Ukraine'
      }
    ]
    
    await db.insert(developers).values(testDevelopers)
    console.log('✅ Test developers added successfully!')
    
    console.log('🎉 Database reset complete!')
    
  } catch (error) {
    console.error('❌ Error resetting database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

resetServicesAndDevelopers()