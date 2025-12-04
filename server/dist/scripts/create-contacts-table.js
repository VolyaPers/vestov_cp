import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
async function createContactsTable() {
    try {
        console.log('Creating client_contacts table...');
        await db.execute(sql `
      CREATE TABLE IF NOT EXISTS "client_contacts" (
        "id" serial PRIMARY KEY NOT NULL,
        "client_id" integer NOT NULL,
        "full_name" text NOT NULL,
        "position" text,
        "email" varchar(255),
        "phone" varchar(20),
        "notes" text,
        "is_primary" boolean DEFAULT false,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);
        console.log('Adding foreign key constraint...');
        await db.execute(sql `
      DO $$ BEGIN
       ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;
    `);
        console.log('Table created successfully!');
        // Test the table exists
        const result = await db.execute(sql `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'client_contacts'
    `);
        console.log('Table verification:', result);
    }
    catch (error) {
        console.error('Error creating table:', error);
    }
    finally {
        process.exit(0);
    }
}
createContactsTable();
