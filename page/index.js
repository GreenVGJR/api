/*
* Created with https://www.css-gradient.com
* Gradient link: https://www.css-gradient.com/?c1=042f47&c2=917eca&gt=l&gd=dtr
*/

export default function handler(req, res) {
   res.status(503).send(`
       <!DOCTYPE html>
       <html lang="en">
       <head>
           <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
           <title>Maintenance</title>
           <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">
           <style>
               * { padding: 0; margin: 0; }
               body {
                   width: 100%;
                   height: 100vh;
                   background: linear-gradient(225deg, rgba(4, 47, 71, 1.0), rgba(145, 126, 202, 1.0));
                   display: flex;
                   justify-content: center;
                   align-items: center;
                   color: rgb(182, 145, 255);
                   font-family: 'Poppins', sans-serif;
                   font-size: 2rem;
                   text-shadow: 0 3px 5px rgba(0, 0, 0, 0.3);
               }
           </style>
       </head>
       <body>
           <p>Maintenance</p>
       </body>
       </html>
   `);
}