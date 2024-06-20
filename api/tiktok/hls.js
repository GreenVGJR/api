// api/tiktok/hls.js
import axios from 'axios/dist/node/axios.cjs';

export default async function handler(req, res) {
   const { url } = req.query;

   if (!url && typeof url !== 'string' && url.includes('tiktok.com')) {
       return res.status(400).json({ error: 'Invalid or missing URL parameter' });
   }

   if(url.includes("vt.tiktok.com") || url.includes("vm.tiktok.com")) {
       const realurl = url;
       const headers = {
        'User-Agent': req.headers['user-agent'] || 'undici',
        'Referer': 'https://www.tiktok.com/'
    };
    const response = await axios.get(realurl, { headers: headers });

    const data = response.data;
    const playAddrPart = data.split('"playAddr":"')[1];
    const playAddr = playAddrPart.split('"')[0];
   }

   try {
       // Process the URL parameter as needed (e.g., fetch data)
       const responseData = { message: 'Data fetched for URL: ' + playAddr };

       // Return a JSON response with the processed data
       res.status(200).json(responseData);
   } catch (error) {
       console.error('Error fetching data:', error);
       res.status(500).json({ error: 'Failed to fetch data' });
   }
}