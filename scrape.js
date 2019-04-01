const fetch = require('node-fetch');
const cheerio = require('cheerio');
const excelJs = require('exceljs');
const bookDepo = 'https://www.bookdepository.com';
const pLimit = require('p-limit');

// TODO: Return mock responses so that we can do development without
//       needing to hit a webserver constantly
// const mockResponse = require('./mock-response');

console.time('mainScript');
const workbook = new excelJs.Workbook();
(function() {
  workbook.xlsx
      .readFile(`${__dirname}/Book List.xlsx`)
      .then(() => {
        const columnIndexes = {};
        const requiredColumns = [
          'ISBN Number',
          'LENGTH',
          'WIDTH',
          'HEIGHT',
          'Binding',
          'Number of Pages',
          'Synopsis',
          'Title',
        ];
        const headerRowIndex = 2;
        const dataRowStartsFromIndex = 3;

        worksheet = workbook.getWorksheet(1);

        // Column index lookup by name
        worksheet
          .getRow(headerRowIndex)
          .eachCell((columnName, columnNumber) => {
            columnIndexes[columnName] = columnNumber;
          });

        requiredColumns.forEach((name) => {
          if (typeof columnIndexes[name] === 'undefined') {
            throw new Error('Required columns do not exist');
          }
        });

        // Rate limit!
        const limit = pLimit(25);
        const promises = [];
        worksheet.eachRow((row, rowNumber) => {
          // Skip to rows where the data starts from
          if (rowNumber < dataRowStartsFromIndex) {
            return;
          }

          promises.push(limit(() => processRow(row, rowNumber, columnIndexes)));
        });

        // Use the reduce trick to chain the promises together so that
        // it is run sequentially i.e. p.then(fn).then(fn).then(fn) and so on
        promises.reduce((p, fn) => p.then(fn), Promise.resolve());

        // Catch the errors before the rejected promises get sent to
        // Promise.all(), which allows us to proceed with writing to the file
        // despite some promises being rejected due to web errors
        Promise.all(promises.map((p) => p.catch((e) => e))).then(() => {
          workbook.xlsx.writeFile('output.xlsx').then(() => {
            console.log('Output to file successfully');
            console.timeEnd('mainScript');
          });
        });
      })
      .catch((e) => {
        console.log(e);
      });
})();

/**
 * Process a row in a worksheet, modifies the values via reference and sets the
 * flag to "commit"
 * @param {Object} row The row object
 * @param {number} rowNumber The row number
 * @param {Object} columnIndexes Object with with
 *     header --> columnIndex values
 * @return {void}
 */
async function processRow(row, rowNumber, columnIndexes) {
  let isbn = '';

  try {
    console.log(`Processing line ${rowNumber}`);
    isbn = row.getCell(columnIndexes['ISBN Number']).value;
    const response = await getPage(`${bookDepo}/book/${isbn}`);
    const bookDetails = processPage(response);
    bookDetails.isbn = isbn;
    row.getCell(columnIndexes['Title']).value = bookDetails.title;
    row.getCell(columnIndexes['LENGTH']).value = bookDetails.dimensionL;
    row.getCell(columnIndexes['WIDTH']).value = bookDetails.dimensionW;
    row.getCell(columnIndexes['HEIGHT']).value = bookDetails.dimensionH;
    row.getCell(columnIndexes['Binding']).value = bookDetails.binding;
    row.getCell(columnIndexes['Number of Pages']).value = bookDetails.pages;
    row.getCell(columnIndexes['Synopsis']).value = bookDetails.synopsis;
    // Add a hyperlink to the book at the end of the row so that the user can
    // easily cross-check if needed
    row.getCell(Object.keys(columnIndexes).length + 1).value = {
      text: `${bookDepo}/book/${isbn}`,
      hyperlink: `${bookDepo}/book/${isbn}`,
      tooltip: `${bookDepo}/book/${isbn}`,
    };
    row.commit();
    return;
  } catch (e) {
    console.log(`Could not load ISBN ${isbn} - ${e.message}`);
    throw new Error(e.message);
  }
}

/**
 * @param {string} url Full URI of the page including protocol
 * @return {Promise} the content of the body if the statuscode is 200 only
 */
function getPage(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
        .then((res) => {
          if (res.status !== 200) {
            throw new Error(`Page load error. Status code: ${res.status}`);
          }
          return res.text();
        })
        .then((body) => {
          resolve(body);
        })
        .catch((err) => {
          reject(err);
        });
  });
}

/**
 * Given a HTML response, use cheerio to extract information from the page using
 * a jQuery like syntax to extract elements and content from the page
 *
 * @param {string} html
 * @return {Object} a generic details object
 */
function processPage(html) {
  const $ = cheerio.load(html);
  const details = {
    title: '',
    binding: '',
    pages: '',
    synopsis: '',
    dimensionL: '0',
    dimensionW: '0',
    dimensionH: '0',
  };
  details.title = $('.item-info h1[itemprop=name]')
      .text()
      .trim();

  // Remove the "show more..." node
  $('.item-description .item-excerpt a').remove();
  details.synopsis = $('.item-description .item-excerpt')
      .text()
      .trim()
      .replace(/ +/g, ' ');

  const biblio = $('.biblio-info li');
  biblio.each((index, item) => {
    const label = $(item)
        .find('label')
        .text();
    const desc = cleanString(
        $(item)
            .children('span')
            .text()
    );

    switch (label) {
      case 'Format':
        const formatSplit = desc.split('|');
        details.binding = abbreviateBookFormat(formatSplit[0].trim());
        if (typeof formatSplit[1] !== 'undefined') {
          details.pages = formatSplit[1].replace('pages', '').trim();
        }
        break;
      case 'Dimensions':
        const dimensions = desc.split('|')[0];
        const dimensionsSplit = dimensions.split('x');

        if (dimensionsSplit.length === 2 || dimensionsSplit.length === 3) {
          details.dimensionL = dimensionsSplit[0].trim();
          details.dimensionW = dimensionsSplit[1].replace('mm', '').trim();

          if (dimensionsSplit.length === 3) {
            details.dimensionH = dimensionsSplit[2].replace('mm', '').trim();
          }
        }
        break;
      default:
        break;
    }
  });

  return details;
}

/**
 * When getting a HTML response, there are lots of whitespace characters that we
 * don't want. This function helps "trim" any unnecessary whitespaces before,
 * anywhere in between, and after a given
 * string. It also removes any newline characters.
 *
 * @param {string} str
 * @return {string} Formatted string
 */
function cleanString(str) {
  return str
      .replace(/(\r\n|\n|\r)/gm, '') // Remove newlines
      .replace(/\s+/g, ' ') // Remove any extra spaces in between words
      .trim(); // Remove beginning and trailing spaces
}

/**
 * Given the format of the book (i.e. Paperback, Hardback, Board Books),
 * return PB, HB, and BB accordingly
 *
 * @param {string} format The input string to be formatted
 * @return {string} abbreviated string
 */
function abbreviateBookFormat(format) {
  switch (format) {
    case 'Paperback':
      return 'PB';
    case 'Hardback':
      return 'HB';
    case 'Board book':
      return 'BB';
    default:
      return format;
  }
}
