// api/tiktok/hls.js
import axios from 'axios/dist/node/axios.cjs';

export default async function handler(req, res) {
   const { url } = req.query;

   if (!url && typeof url !== 'string' && url.includes('tiktok.com')) {
       return res.status(400).json({ error: 'Invalid or missing URL parameter' });
   }

   async function getCookieTiktok() {
      try {
         const headers = {
            'User-Agent': req.headers['user-agent'],
            'Referer': 'https://www.tiktok.com/'
           };

          const response = await axios.get("https://www.tiktok.com", { headers: headers });
          const setCookieHeader = response.headers['set-cookie'];
          const setCookieString = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
          let match = setCookieString.match(/tt_chain_token=[^;]+/);
          return match ? match[0] : ''; // Return the matched token or an empty string if not found
      } catch (error) {
          console.error('Failed to fetch TikTok video:', error);
          throw new Error('Failed to fetch TikTok video'); // Re-throw the error to be caught by the caller
      }
  }

   try {

      const headers = {
         'User-Agent': req.headers['user-agent'],
         'Referer': 'https://www.tiktok.com/',
         'Cookie': getCookieTiktok()
      };

      const response = await axios.get(url, { headers: headers });

      const data = response.data;
      const playAddrPart = data.split('"playAddr":"')[1];
      let playAddr = playAddrPart.split('"')[0];

      // Replace occurrences of \\u002F with /
      playAddr = playAddr.replace(/\\u002F/g, '/');

      // Decode URI component
      playAddr = decodeURIComponent(playAddr);
      
       // Stream the video from TikTok to the client

     const videoResponse = await axios.get(playAddr, { headers: headers, responseType: 'stream' });
     console.log(playAddr);

     // Set appropriate headers for video streaming
     res.writeHead(200, {
         'Content-Type': 'video/mp4',
         'Content-Length': videoResponse.headers['content-length'],
         'Set-Cookie': getCookieTiktok()
     });

     // Pipe the video stream to the client's response
     videoResponse.data.pipe(res);
   } catch (error) {
      if (error.response) {
         // The request was made and the server responded with a status code
         console.error('Request failed with status code:', error.response.status);
         res.status(error.response.status).json({ 
            error: `Request failed with status code ${error.response.status}`,
            data: [{
               cookie: getCookieTiktok()
            }]
         });
     } else if (error.request) {
         // The request was made but no response was received
         console.error('Request made but no response received:', error.request);
         res.status(500).json({ error: 'Request made but no response received' });
     } else {
         // Something happened in setting up the request that triggered an error
         console.error('Error setting up request:', error.message);
         res.status(500).json({ error: 'Error setting up request' });
     }
   }
}