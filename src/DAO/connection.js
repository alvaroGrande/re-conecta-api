import { createClient } from '@supabase/supabase-js'

import config from  '../config.js';
const { KEY, URL } = config.SUPABASE;

const supabaseUrl = URL
const supabaseKey = KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

