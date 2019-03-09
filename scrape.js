const fetch = require('node-fetch');
const cheerio = require('cheerio');
const Excel = require('exceljs');
const bookDepo = `https://www.bookdepository.com`;
const mockResponse = require('./mock-response');
const pLimit = require('p-limit');

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}
const workbook = new Excel.Workbook();
( function () {

    workbook.xlsx.readFile(`${__dirname}/Book List2.xlsx`)
      .then(function() {

          worksheet = workbook.getWorksheet(1);

          const columnIndexes = {};

          // Column index lookup by name
          worksheet.getRow(2).eachCell((columnName, columnNumber) => {
            columnIndexes[columnName] = columnNumber;
          })

          switch("undefined") {
            case typeof(columnIndexes['ISBN Number']):
            case typeof(columnIndexes['LENGTH']):
            case typeof(columnIndexes['WIDTH']):
            case typeof(columnIndexes['HEIGHT']):
            case typeof(columnIndexes['Binding']):
            case typeof(columnIndexes['Number of Pages']):
            case typeof(columnIndexes['Synopsis']):
            case typeof(columnIndexes['Title']):
              throw new Error('Required columns do not exist');
            default:
              break;
          }

          // Rate limit!
          const limit = pLimit(10);
          const promises = [];
          worksheet.eachRow((row, rowNumber) => {
            promises.push(limit(() => processRow(row, rowNumber, columnIndexes)))
          });
          // Use the reduce trick to chain the promises together so that
          // it is run sequentially
          promises.reduce((p, fn) => p.then(fn), Promise.resolve())

          Promise.all(promises).then(function() {
            workbook.xlsx.writeFile('output.xlsx').then(function () {
              console.log('Output to file successfully');
              return;
            })
          })

        }).catch(e => {console.log(e)});
    return;
})();

async function processRow(row, rowNumber, columnIndexes) {

    // Iterate over all rows that have values in a worksheet
    if (rowNumber < 3) {
      return
    }
    let isbn = '';
    try {
      console.log('Processing line ' + rowNumber);
      isbn = row.getCell(columnIndexes['ISBN Number']).value;
      let response = await getPage(`${bookDepo}/seo/${isbn}`)
      let processed = processPage(response);
      processed.isbn = isbn;

      row.getCell(columnIndexes['LENGTH']).value = processed.dimensionL;
      row.getCell(columnIndexes['WIDTH']).value = processed.dimensionW;
      row.getCell(columnIndexes['HEIGHT']).value = processed.dimensionH;
      row.getCell(columnIndexes['Binding']).value = processed.binding;
      row.getCell(columnIndexes['Number of Pages']).value = processed.pages;
      row.getCell(columnIndexes['Synopsis']).value = processed.synopsis;

      // worksheet.getRow(rowNumber).values = row.values;
      return;
      
      
    }
    catch (e) {
      console.log(`Could not load ISBN ${isbn} - ${e.message}`)
      throw new Error(e.message);
    }
}

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
    synopsis: '',
    dimensionL: '0',
    dimensionW: '0',
    dimensionH: '0'
  };
  details.title = $('.item-info h1[itemprop=name]').text().trim();

  // Remove the "show more..." node
  $('.item-description .item-excerpt a').remove();
  details.synopsis = $('.item-description .item-excerpt').text();

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

        if (dimensionsSplit.length == 2 || dimensionsSplit.length == 3) {
          details.dimensionL = dimensionsSplit[0].trim();
          details.dimensionW = dimensionsSplit[1].trim();

          if (dimensionsSplit.length == 3) {
            details.dimensionH = dimensionsSplit[2].replace("mm", "").trim();
          }
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