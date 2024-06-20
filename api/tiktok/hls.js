// api/tiktok/hls.js

export default async function handler(req, res) {
   const { url } = req.query;

   if (!url || typeof url !== 'string') {
       return res.status(400).json({ error: 'Invalid or missing URL parameter' });
   }

   try {
       // Process the URL parameter as needed (e.g., fetch data)
       const responseData = { message: 'Data fetched for URL: ' + url };

       // Return a JSON response with the processed data
       res.status(200).json(responseData);
   } catch (error) {
       console.error('Error fetching data:', error);
       res.status(500).json({ error: 'Failed to fetch data' });
   }
}