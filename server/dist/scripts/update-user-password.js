import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
async function updateUserPassword() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
    });
    const db = drizzle(pool);
    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash('kamran123', 10);
        // Update the password for user 'kamran'
        const updatedUser = await db
            .update(users)
            .set({
            password: hashedPassword,
            updatedAt: new Date()
        })
            .where(eq(users.username, 'kamran'))
            .returning();
        if (updatedUser.length > 0) {
            console.log('Password updated successfully for user:', updatedUser[0].username);
            console.log('Username: kamran');
            console.log('Password: kamran123');
        }
        else {
            console.log('User not found');
        }
    }
    catch (error) {
        console.error('Error updating password:', error);
    }
    finally {
        await pool.end();
    }
}
updateUserPassword();
