import soundcloud from 'soundcloud-key-fetch';
import axios from 'axios/dist/node/axios.cjs';
import Cooldown from '../../cooldown/cooldown';

export default async function handler(req, res) {
    const { url } = req.query;

    
    if (!Cooldown.checkCooldown()) {
        res.status(429).end();
        return;
    }

   const clientid = await soundcloud.fetchKey();

   try {
   const response = await axios.get(url);
   const data = response.data;
   const firstSplit = data.split('\"quality\":\"sq\"},{\"url\":\"')[1];
   if(firstSplit.contains('/hls')) {
    res.status(500).json({ 
        status: false,
        error: 'Unavailable.'
   })
   res.end();
   }

   const secondSplit = firstSplit.split('\"')[0] + "?client_id=" + clientid;

   const secresponse = await axios.get(secondSplit);
   res.status(302).setHeader('Location', secresponse.data.url);
   res.end();
   }
   catch {
   res.status(500).end();
    }
}