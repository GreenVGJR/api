const cooldownTime = 15 * 1000;
let lastRequestTime = Date.now();

let requestCount = 0;
const maxRequestsPerCooldown = 5;

export default async function handler(req, res) {
   const currentTime = Date.now();

   // Reset request count if cooldown period has elapsed
   if (currentTime - lastRequestTime > cooldownTime) {
       lastRequestTime = currentTime;
       requestCount = 0;
   }

   // Check if request count exceeds maximum allowed
   if (requestCount >= maxRequestsPerCooldown) {
       return res.status(429).end();
   }

   // Increment request count
   requestCount++;

   res.status(200).json({ 
      status: true,
      list: [{
         downloader: [{
            tiktok: ["/tiktok", "/tiktok/hls.js"],
            soundcloud: ["/sc", "/sc/hls.js"],
            twitter: "/tw",
            facebook: "/fb"
         }]
      }],
      message: "This API is hosted by Vercel.",
      issue: ["Any issues you can DM me", "Discord", "vgjr"]
   })
}