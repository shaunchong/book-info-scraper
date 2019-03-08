const rp = require('request-promise');
const cheerio = require('cheerio');
const hostname = `https://www.bookdepository.com`;
const options = {
  uri: `${hostname}/bestsellers12345`,
  transform: function (body) {
    return cheerio.load(body);
  }
};

rp(options)
  .then(($) => {
    let bookItems = $('.book-item .item-img a');
    let urlsToVisit = [];
    bookItems.each((index, item) => {
      urlsToVisit.push(item.attribs.href);
    })

    urlsToVisit = urlsToVisit.slice(0, 10);

    urlsToVisit.forEach(async item => {
      let subOptions = {
        uri: `${hostname}/${item}`,
        transform: function (body) {
          return cheerio.load(body);
        }
      };
      let response = await processPage(subOptions);
      console.log(response);
    })

    //console.log(urlsToVisit);
    // bookItems.initialize.forEach(item => {
    //   console.log(item);
    // })
  })
  .catch((e) => {
    console.log(e)
  })

  function processPage(subOptions) {
    return rp(subOptions)
    .then(($) => {
      let details = {}
      details.title = $('.item-info h1').text();

      let $biblio = $('.biblio-info li');
      details.bookType = $($biblio[0]).find('span').text().replace(/(\r\n|\n|\r)/gm,"").replace(/\s+/g, " ").trim();

      details.dimensions = $($biblio[1]).find('span').text().replace(/(\r\n|\n|\r)/gm,"").replace(/\s+/g, " ").trim();

      details.publicationDate = $($biblio[2]).find('span').text().replace(/(\r\n|\n|\r)/gm,"").replace(/\s+/g, " ").trim();
      details.publisher = $($biblio[3]).find('span').text().replace(/(\r\n|\n|\r)/gm,"").replace(/\s+/g, " ").trim();
      return details;
    })
    .catch((e) => {
      console.log(e);
    })
  }