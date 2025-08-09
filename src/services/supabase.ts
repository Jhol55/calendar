import { createClient } from '@supabase/supabase-js';

const supabaseUrl = '123';
const supabaseKey = '123';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key are required');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
