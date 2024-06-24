import soundcloud from 'soundcloud-key-fetch';
import axios from 'axios/dist/node/axios.cjs';


const cooldownTime = 15 * 1000;
let lastRequestTime = Date.now();

let requestCount = 0;
const maxRequestsPerCooldown = 5;

export default async function handler(req, res) {
    const { url } = req.query;

   const currentTime = Date.now();
   const clientid = await soundcloud.fetchKey();

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

   const response = await axios.get(url);
   const data = response.data;
   const firstSplit = data.split('\"quality\":\"sq\"},{\"url\":\"')[1];
   const secondSplit = firstSplit.split('\"')[0] + "?client_id=" + clientid;

   const secresponse = await axios.get(secondSplit);
   res.status(302).setHeader('Location', secresponse.data.url);
   res.end();
}