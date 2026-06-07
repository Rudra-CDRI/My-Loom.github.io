/* -------------------------------------------------------------
   MY LOOM // SUPABASE DATABASE CLIENT INITIALIZATION
   ------------------------------------------------------------- */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://yaqxdzqceskedgatqcib.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CWxPtwLT9VzlQEs-sG5xPw_UdGyMQm7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
