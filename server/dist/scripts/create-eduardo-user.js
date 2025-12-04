import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import bcrypt from 'bcryptjs';
/**
 * Create a user account for Eduardo Cerato
 * Username: eduardo
 * Password: eduardo123
 * Role: team_member
 */
async function createEduardoUser() {
    try {
        console.log('🔐 Creating user account for Eduardo Cerato...');
        const username = 'eduardo';
        const password = 'eduardo123';
        const hashedPassword = await bcrypt.hash(password, 12);
        const [newUser] = await db
            .insert(users)
            .values({
            username: username,
            password: hashedPassword,
            fullName: 'Eduardo Cerato',
            email: 'eduardo.cerato@vestov.com',
            role: 'team_member',
            position: 'Full-Stack Developer',
            isActive: true,
        })
            .returning();
        console.log('✅ User account created successfully!');
        console.log('📋 Login credentials:');
        console.log('   Username: eduardo');
        console.log('   Password: eduardo123');
        console.log('   Role: team_member');
        console.log(`   User ID: ${newUser.id}`);
    }
    catch (error) {
        if (error.code === '23505') {
            console.log('ℹ️  User account already exists');
        }
        else {
            console.error('❌ Error creating user account:', error);
            process.exit(1);
        }
    }
    finally {
        process.exit(0);
    }
}
createEduardoUser();
