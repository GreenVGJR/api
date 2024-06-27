import soundcloud from 'soundcloud-key-fetch';
import Cooldown from '../../cooldown/cooldown';

export default async function handler(req, res) {
    
    if (!Cooldown.checkCooldown()) {
        res.status(429).end();
        return;
    }

    const clientid = await soundcloud.fetchKey();

   res.status(200).json({ 
      status: true,
      client_id: clientid
   })
}