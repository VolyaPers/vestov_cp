import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
async function createAdminUser() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
    });
    const db = drizzle(pool);
    try {
        // Check if admin user already exists
        const existingAdmin = await db
            .select()
            .from(users)
            .where(eq(users.username, 'admin'))
            .limit(1);
        if (existingAdmin.length > 0) {
            console.log('Admin user already exists');
            return;
        }
        // Hash the password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        // Create admin user
        await db.insert(users).values({
            username: 'admin',
            password: hashedPassword,
            fullName: 'System Administrator',
            email: 'admin@vestov.com',
            role: 'admin',
            position: 'System Administrator',
            isActive: true,
        });
        console.log('Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
    }
    catch (error) {
        console.error('Error creating admin user:', error);
    }
    finally {
        await pool.end();
    }
}
createAdminUser();
