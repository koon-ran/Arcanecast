import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: polls } = await supabase
  .from('dao_polls')
  .select('id, question, section, status, onchain_id')
  .order('created_at', { ascending: false });

console.log('\n📊 All Polls:\n');
if (polls && polls.length > 0) {
  console.log(`Total: ${polls.length} polls\n`);
  polls.forEach(p => {
    const hasOnchain = p.onchain_id !== null ? '✅' : '❌';
    console.log(`  ${hasOnchain} [${p.section}] ${p.question.substring(0, 40)}... (onchain_id: ${p.onchain_id})`);
  });
} else {
  console.log('  No polls found');
}
console.log('');
