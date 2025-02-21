import Cooldown from '../cooldown/cooldown';

export default async function handler(req, res) {
   if (!Cooldown.checkCooldown()) {
       res.status(429).end();
       return;
   }

   res.setHeader('Content-Type', 'application/json');
   
   res.status(200).json({ 
      status: true,
      list: [{
         downloader: [{
            tiktok: ["/tiktok", "/tiktok/hls.js"],
            soundcloud: ["/sc", "/sc/hls.js"]
         }]
      }],
      rate_limit: "100 Requests / 1 Minute (Global)",
      message: "I do not track any your activity. This API purely made for testing."
   })
}
