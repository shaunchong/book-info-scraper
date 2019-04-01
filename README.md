# Book Info Scraper

## Getting started
- Install [NodeJS](https://nodejs.org)
- Go to your project folder, and run `npm install`
- Then run `node scrape.js`
- The script will (hard-coded at this point) read from `Book List.xlsx` and outputs to `output.xlsx`
- For eslint, run `./node_modules/.bin/eslint scrape.js`

## Summary

This project is an exercise in scraping data from the web. It reads an Excel sheet that contains an ISBN column, 
goes to bookdepository.com to scrape information about the book, and fills in the information (i.e. width, height, length, synopsis,
format, etc) into the Excel sheet.

This project started off as a way to perform data entry in a more efficient manner -- why spend countless hours doing a repetitive task
when it can easily be automated?

It would take a human at least 2 minutes to perform data entry per row. At ~4400 rows, that would take ~73 hours.

During my tests on running this script, it takes about 7 minutes to complete 4400 rows (also dependent on internet connection, 
so results may vary).

## Knowledge gained
- The concept of asynchronous functions, the event loop in JavaScript, and what non-blocking I/O means
- Various libraries in node
- Rate limiting when it comes to making asynchronous HTTP requests
- Promises, how to run them sequentially, and how to run resolve Promise.all() even if some promises get rejected

## Possible improvements
- For a project that took a couple of days over the weekend, the script is very straightforward and is meant to do a very specific task
- This also means there may be some sloppy parts -- code could use some tests, less hardcoding, more generic wrapper functions so
we can swap out the Excel and web request implementations, enforce type-checking, etc. so that it could also be re-used for other 
Excel + scraping projects in the future
- One of the requirements of this project was to specifically scrape bookdepository.com, however I could transform this to use a
Books API for future projects
