#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('📦 Applying cards missing columns migration...\n');

    // Execute each statement directly
    console.log('Adding cards.name column...');
    await prisma.$executeRawUnsafe('ALTER TABLE cards ADD COLUMN IF NOT EXISTS name TEXT');
    
    console.log('Adding cards.metadata column...');
    await prisma.$executeRawUnsafe('ALTER TABLE cards ADD COLUMN IF NOT EXISTS metadata JSONB');
    
    console.log('Adding CardOwnership.quantity column...');
    await prisma.$executeRawUnsafe('ALTER TABLE "CardOwnership" ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1');
    
    console.log('Creating metadata index...');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS cards_metadata_idx ON cards USING GIN (metadata)');
    
    console.log('Adding column comments...');
    await prisma.$executeRawUnsafe("COMMENT ON COLUMN cards.name IS 'Alternate card name field for NS imports'");
    await prisma.$executeRawUnsafe("COMMENT ON COLUMN cards.metadata IS 'Complete metadata from NS API and other sources (JSON)'")

    console.log('\n✅ Migration applied successfully!\n');

    // Verify columns exist
    console.log('Verifying columns...');
    const cardsResult = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cards' 
      AND column_name IN ('name', 'metadata')
      ORDER BY column_name;
    `;
    
    const ownershipResult = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'CardOwnership' 
      AND column_name = 'quantity';
    `;
    
    console.log('Found cards columns:', cardsResult);
    console.log('Found CardOwnership columns:', ownershipResult);

    if (Array.isArray(cardsResult) && cardsResult.length === 2 && 
        Array.isArray(ownershipResult) && ownershipResult.length === 1) {
      console.log('\n✅ All required columns exist!');
      console.log('\n🎉 Migration complete! You can now restart your dev server and import NS cards.');
    } else {
      console.log('\n⚠️  Warning: Missing some columns');
      console.log('Cards columns:', cardsResult.length, '/ 2');
      console.log('Ownership columns:', ownershipResult.length, '/ 1');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

