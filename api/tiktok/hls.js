// api/tiktok/hls.js
import axios from 'axios/dist/node/axios.cjs';

export default async function handler(req, res) {
   const { url } = req.query;

   if (!url && typeof url !== 'string' && url.includes('tiktok.com')) {
       return res.status(400).json({ error: 'Invalid or missing URL parameter' });
   }

   try {
      
      const headers = {
         'User-Agent': 'undici',
         'Referer': 'https://www.tiktok.com/',
         'Cookie': 'tt_chain_token=XbG1q/8epF4nX8DP7P4zjQ=='
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
       const videoResponse = await axios({
         url: playAddr,
         method: 'GET',
         responseType: 'stream',
         headers: headers // Include headers directly in the axios options
     });

     // Set appropriate headers for video streaming
     res.writeHead(200, {
         'Content-Type': 'video/mp4',
         'Content-Length': videoResponse.headers['content-length'],
         'Set-Cookie': 'tt_chain_token=XbG1q/8epF4nX8DP7P4zjQ=='
     });

     // Pipe the video stream to the client's response
     videoResponse.data.pipe(res);
   } catch (error) {
       console.error('Error fetching data:', error);
       res.status(500).json({ error: 'Failed to fetch data' });
   }
}