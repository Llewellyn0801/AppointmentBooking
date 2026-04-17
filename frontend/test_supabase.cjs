const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Connecting to Supabase...');
  
  // Create a slot to test on
  console.log('Creating a test slot...');
  const { data: insertData, error: insertError } = await supabase
    .from('slots')
    .insert([
      { teacher_name: 'Test Simulator', start_time: new Date().toISOString(), end_time: new Date().toISOString() }
    ])
    .select();
    
  if (insertError) {
    console.error("Setup failed (Did you run the SQL script in your Supabase Dashboard?):", insertError);
    return;
  }
  
  const targetSlotId = insertData[0].id;
  console.log("Test slot created:", targetSlotId);

  console.log('Simulating 10 users booking at the exact same physical millisecond...');
  
  let promises = [];
  for (let i = 1; i <= 10; i++) {
    // Calling the atomic RPC function simultaneously
    promises.push(
      supabase.rpc('book_slot', {
        target_slot_id: targetSlotId,
        parent_name: `Parent Competitor ${i}`
      })
    );
  }

  const results = await Promise.all(promises);
  
  let successes = 0;
  let blocks = 0;
  
  results.forEach((res, i) => {
    if (res.error) {
      console.log(`❌ Parent ${i+1} Failed: ${res.error.message}`);
      blocks++;
    } else {
      console.log(`✅ Parent ${i+1} SUCCEEDED!`);
      successes++;
    }
  });

  console.log('\n--- Simulation Complete ---');
  console.log(`Winners: ${successes}`);
  console.log(`Blocked: ${blocks}`);
  
  if (successes === 1 && blocks === 9) {
    console.log("Perfect Supabase database-level concurrency protection verified.");
  } else {
    console.log("WARNING: Protection failed or setup issues.");
  }
  
  // Cleanup
  await supabase.from('slots').delete().eq('id', targetSlotId);
}

run();
