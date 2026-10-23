/**
 * Data-Fix Script: Remove 🔥 Emoji from Menu Items
 * 
 * Usage:
 *   Preview changes (dry run, no writes):
 *     npx tsx scripts/data-fix-remove-fire-emoji.ts --dry-run
 * 
 *   Apply changes to staging/local DB:
 *     npx tsx scripts/data-fix-remove-fire-emoji.ts --apply
 * 
 *   Rollback changes:
 *     npx tsx scripts/data-fix-remove-fire-emoji.ts --rollback backup_filename.json
 * 
 * Safety guarantees:
 * - Only modifies the '🔥' character and surrounding extra whitespace.
 * - Leaves all prices, categories, IDs, availability, and description intact.
 * - Generates a timestamped JSON backup before writing any changes.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function cleanItemName(name: string): string {
  return String(name || '').replace(/🔥/g, '').replace(/\s+/g, ' ').trim();
}

async function run() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;
  const rollbackIdx = args.indexOf('--rollback');

  console.log('='.repeat(60));
  console.log('QControl Data-Fix: Remove 🔥 Emoji from Stored Menu Items');
  console.log('Mode:', isApply ? 'APPLY (Modifying Database)' : 'DRY-RUN (Preview Only)');
  console.log('='.repeat(60));

  // Handle Rollback
  if (rollbackIdx !== -1 && args[rollbackIdx + 1]) {
    const backupFile = args[rollbackIdx + 1];
    if (!fs.existsSync(backupFile)) {
      console.error(`Backup file not found: ${backupFile}`);
      process.exit(1);
    }
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`Rolling back ${backupData.length} businesses from backup: ${backupFile}...`);
    for (const b of backupData) {
      const { error } = await supabase
        .from('businesses')
        .update({ menu_items: b.menu_items })
        .eq('id', b.id);
      if (error) console.error(`Failed to rollback business ${b.id}:`, error.message);
      else console.log(`✓ Rolled back business ${b.id} (${b.business_name})`);
    }
    console.log('Rollback completed.');
    return;
  }

  // Fetch all businesses
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, business_name, menu_items');

  if (error || !businesses) {
    console.error('Failed to query businesses:', error?.message);
    process.exit(1);
  }

  const changesToApply: Array<{
    id: string;
    business_name: string;
    original_menu: any[];
    updated_menu: any[];
    modifiedItems: Array<{ before: string; after: string; price: number }>;
  }> = [];

  for (const b of businesses) {
    const menu = b.menu_items || [];
    if (!Array.isArray(menu) || menu.length === 0) continue;

    let hasChanges = false;
    const modifiedItems: Array<{ before: string; after: string; price: number }> = [];

    const updatedMenu = menu.map((item: any) => {
      if (!item || !item.name) return item;
      const rawName = String(item.name);
      if (rawName.includes('🔥')) {
        hasChanges = true;
        const cleaned = cleanItemName(rawName);
        modifiedItems.push({
          before: rawName,
          after: cleaned,
          price: item.price
        });
        return {
          ...item,
          name: cleaned
        };
      }
      return item;
    });

    if (hasChanges) {
      changesToApply.push({
        id: b.id,
        business_name: b.business_name,
        original_menu: menu,
        updated_menu: updatedMenu,
        modifiedItems
      });
    }
  }

  if (changesToApply.length === 0) {
    console.log('✓ Clean scan: Zero menu items found containing the 🔥 emoji.');
    return;
  }

  console.log(`Found ${changesToApply.length} business(es) with items containing 🔥:\n`);
  for (const c of changesToApply) {
    console.log(`🏢 Business: ${c.business_name} (${c.id})`);
    for (const item of c.modifiedItems) {
      console.log(`   - "${item.before}" ➔ "${item.after}" (Price: ₹${item.price} UNCHANGED)`);
    }
    console.log();
  }

  if (isDryRun) {
    console.log('Dry run complete. No rows were modified in the database.');
    console.log('To apply these changes, run with: --apply');
    return;
  }

  // Create timestamped backup
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFileName = path.join(backupDir, `menu_items_backup_${Date.now()}.json`);
  const backupContent = changesToApply.map(c => ({
    id: c.id,
    business_name: c.business_name,
    menu_items: c.original_menu
  }));
  fs.writeFileSync(backupFileName, JSON.stringify(backupContent, null, 2));
  console.log(`✓ Safety backup created at: ${backupFileName}`);

  // Apply updates
  for (const c of changesToApply) {
    const { error: updateErr } = await supabase
      .from('businesses')
      .update({ menu_items: c.updated_menu })
      .eq('id', c.id);

    if (updateErr) {
      console.error(`✗ Error updating business ${c.id}:`, updateErr.message);
    } else {
      console.log(`✓ Updated business ${c.business_name} (${c.modifiedItems.length} items sanitized)`);
    }
  }

  console.log('\nData fix completed successfully.');
  console.log(`To revert, execute: npx tsx scripts/data-fix-remove-fire-emoji.ts --rollback ${backupFileName}`);
}

run().catch(err => {
  console.error('Fatal data-fix error:', err);
  process.exit(1);
});
