// Fresh buyer workspace after a real sign-in. Quote history is an audit
// trail and is left intact.

import { supabase } from '../supabase';

export async function startFreshBuyerSession(userId: string): Promise<void> {
  const [cart, favourites] = await Promise.all([
    supabase.from('cart_items').delete().eq('user_id', userId),
    supabase.from('favourites').delete().eq('user_id', userId),
  ]);
  if (cart.error) throw cart.error;
  if (favourites.error) throw favourites.error;
}
