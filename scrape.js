const fetch = require('node-fetch');
const cheerio = require('cheerio');
const bookDepo = `https://www.bookdepository.com`;
const mockResponse = require('./mock-response');

// const entryPoint = `${hostname}/bestsellers`;

// fetch(entryPoint)
//   .then(response => response.text())
//   .then(body => {
//     let $ = cheerio.load(body)
//     let bookItems = $('.book-item .item-img a')
   
//     let urlsToVisit = []
//     bookItems.each((index, item) => {
//       urlsToVisit.push(item.attribs.href)
//     })

//     urlsToVisit = urlsToVisit.slice(0, 1);

//     urlsToVisit.forEach(async item => {
//       let url = `${hostname}/${item}`

//       let response = await processPage(url);
//       console.log(response);
//     })
//   })
//   .catch((e) => {
//     console.log(e);
//   })

(async function () {

  const isbnList = ['9781328460837', '9781328557261', '9781328566423', '9781328567550', '9781328585080', '9781328588777', 
    '9781328589279', '9781328589828', '9781328594433', '9781328604309', '9781328662057', '9781328780966', '9781328879981'];

    isbnList.forEach(async (isbn) => {
    try {
      let response = await getPage(`${bookDepo}/seo/${isbn}`);
      let processed = processPage(response);
      processed.isbn = isbn;
      console.log(processed);
    }
    catch(e) {
      console.log(`Could not load ISBN ${isbn} - ${e.message}`)
    }
  })
})();

function getPage(url) {
  return new Promise((resolve, reject) => {

    fetch(url)
      .then(res => {
        if (res.status !== 200) {
          throw new Error('Page load error. Status code: ' + res.status);
        }
        return res.text()
      })
      .then(body => {
        resolve(body);
      })
      .catch(err => {
        reject(err);
      });
  });
}

function processPage(html) {
  const $ = cheerio.load(html);
  const details = {
    title: '',
    binding: '',
    pages: '',
    dimensionL: '0',
    dimensionW: '0',
    dimensionH: '0'
  };
  details.title = $('.item-info h1[itemprop=name]').text().trim();

  // Remove the "show more..." node
  $('.item-description .item-excerpt a').remove();
  details.synopsys = cleanString($('.item-description .item-excerpt').text().trim());

  let biblio = $('.biblio-info li');
  biblio.each((index, item)=> {
    let label = $(item).find('label').text();
    let desc = cleanString($(item).children('span').text());
    
    switch(label) {
      case 'Format':
        let formatSplit = desc.split('|');
        details.binding = abbreviateFormat(formatSplit[0].trim());
        if (typeof formatSplit[1] !== 'undefined') {
          details.pages = formatSplit[1].replace("pages", "").trim();
        }
        // Can get the binding and number of pages here
        break;
      case 'Dimensions':
        let dimensions = desc.split('|')[0];
        let dimensionsSplit = dimensions.split('x');
        if (dimensionsSplit.length == 3) {
          details.dimensionL = dimensionsSplit[0].trim();
          details.dimensionW = dimensionsSplit[1].trim();
          details.dimensionH = dimensionsSplit[2].replace("mm", "").trim();
        }
        break;
      default:
        break;
      
    }
  });

  return details;

  return fetch(url)
    .then(res => res.text())
    .then(body => {
      let $ = cheerio.load(body)
      let details = {}
      details.title = $('.item-info h1').text()

      let biblio = $('.biblio-info li');
      biblio.each(item => {
        console.log(item);
        //console.log(item.find('label').text)
      })
      // details.bookType = cleanString($($biblio[0]).find('span')[0].text())

      // details.dimensions = cleanString($($biblio[1]).find('span').text())

      // details.publicationDate = cleanString($($biblio[2]).find('span').text())
      // details.publisher = cleanString($($biblio[3]).find('span').text())
      return details;
  })
  .catch((e) => {
    console.log(e);
  })
}

function cleanString(str) {
  return str
    .replace(/(\r\n|\n|\r)/gm,"") // Remove newlines
    .replace(/\s+/g, " ") // Remove any extra spaces in between words
    .trim() // Remove beginning and trailing spaces
}

// Paperback - PB, Hardback - HB, Board Books - BB
function abbreviateFormat(format) {
  switch(format) {
    case 'Paperback':
      return 'PB';
    case 'Hardback':
      return 'HB';
    case 'Board Books':
      return 'BB';
    default:
      return format;
  }
}