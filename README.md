# Amazon Price Tracker

An e-commerce product scraping application built with Next.js and Bright Data's webunlocker. Tracks product prices and sends email notifications when products drop in price or come back in stock.

## Tech Stack

- Next.js
- Bright Data
- Cheerio
- Nodemailer
- MongoDB
- Headless UI
- Tailwind CSS

## Features

- **Product Scraping**: Search bar for inputting Amazon product links to scrape product details
- **Product Display**: View scraped product details including image, title, pricing, and other relevant information
- **Price Tracking**: Track products and receive email notifications for price drops
- **Email Notifications**: Automated email alerts for back in stock notifications and lowest price alerts
- **Automated Updates**: Cron jobs for periodic scraping to keep product data up-to-date

## Quick Start

**Prerequisites**

Make sure you have Node.js installed on your machine.

**Set Up Environment Variables**

Create a `.env` file in the root of your project:

```env
#SCRAPER
BRIGHT_DATA_USERNAME=
BRIGHT_DATA_PASSWORD=

#DB
MONGODB_URI=

#OUTLOOK
EMAIL_USER=
EMAIL_PASS=
```

Replace the placeholder values with your actual credentials from [BrightData](https://brightdata.com/), [MongoDB](https://www.mongodb.com/), and [Node Mailer](https://nodemailer.com/).

**Running the Project**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the project.
