import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: polls } = await supabase
  .from('dao_polls')
  .select('id, question, section, onchain_id')
  .eq('section', 'voting');

console.log('\n📊 Voting Polls:\n');
if (polls && polls.length > 0) {
  polls.forEach(p => {
    console.log(`  ${p.onchain_id !== null ? '✅' : '❌'} ${p.question.substring(0, 50)}... (onchain_id: ${p.onchain_id})`);
  });
} else {
  console.log('  No voting polls found');
}
console.log('');
