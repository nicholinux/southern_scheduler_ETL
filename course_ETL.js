// EagleExplorer.js
// Direct API webcrawler for Georgia Southern Course Search
// Requirements: axios, csv-writer

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const axios = require('axios');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const qs = require('querystring');
const cheerio = require('cheerio');

const csvWriter = createCsvWriter({
  path: 'courses.csv',
  header: [
    {id: 'crn', title: 'CRN'},
    {id: 'subject', title: 'Subject'},
    {id: 'title', title: 'Title'},
    {id: 'hours', title: 'Hours'},
    {id: 'instructor', title: 'Instructor'},
    {id: 'days', title: 'Days'},
    {id: 'start_time', title: 'Start Time'},
    {id: 'end_time', title: 'End Time'},
    {id: 'location', title: 'Location'}, // not yet working
    {id: 'seats_available', title: 'Seats Available'} // not yet working
  ]
});


// Step 1: Fetch the course search page and extract all subject options from the dropdown
async function getSubjectOptions(term_code) {
  const url = `https://coursesearch.georgiasouthern.edu/?term_code=${term_code}`;
  const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EagleExplorer/1.0)' } });
  const $ = cheerio.load(response.data);
  const subjects = [];
  $('#form-search-subject option').each((i, el) => {
    const code = $(el).attr('value');
    const desc = $(el).text().trim();
    if (code && code !== '') {
      subjects.push(`${code} ${desc}`);
    }
  });
  return subjects;
}

// Step 2: Query structure for course lookup page
async function fetchCoursesForSubject(term_code, subject_code, campus_code) {
  const url = 'https://coursesearch.georgiasouthern.edu/search/';
  const formData = {
    'form-search-semester': term_code,
    'form-search-subject': subject_code,
    'form-search-course': '',
    'form-search-campus': campus_code,
    'form-search-crn': '',
    'form-search-instructor': '',
    'form-search-level': '',
    'form-search-department': '',
    'form-search-status': 'all',
    'form-search-schedule-type': '',
    'form-search-instruction-method': '',
    'form-search-begin-time': '',
    'form-search-end-time': '',
    'form-search-mat-cost': '',
    'form-search-keyword': ''
  };
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; EagleExplorer/1.0)'
  };
  const response = await axios.post(url, qs.stringify(formData), { headers });
  return response.data;
}

function parseCoursesFromHtml(html, subject_code) {
  const $ = cheerio.load(html);
  const rows = $('#results-table tbody tr');
  const courses = [];
  rows.each((i, row) => {
    const tds = $(row).find('td');
    if (tds.length === 0) return;
    const crn = $(tds[0]).text().trim();
    const subject = subject_code;
    const title = $(tds[2]).text().trim();
    const hours = $(tds[3]).text().trim();
    const instructor = $(tds[4]).text().replace(/\s+/g, ' ').trim();
    // Seats available: 16th td (index 15), parse (x / y)
    let seats_available = '';
    const seatsCell = $(tds[15]).html() || '';
    const match = seatsCell.match(/\((\d+)\s*\/\s*(\d+)\)/);
    if (match) {
      const enrolled = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      seats_available = (max - enrolled).toString();
    }
    // Meeting patterns: inside the 10th td (index 9)
    const timeCell = $(tds[9]);
    timeCell.find('table.table-course-days').each((_, mtgTable) => {
      let days = '';
      $(mtgTable).find('td.day').each((_, dtd) => {
        if ($(dtd).hasClass('active')) days += $(dtd).text().trim();
      });
      let start_time = '', end_time = '';
      const timeText = $(mtgTable).parent().find('span.break').first().text().trim();
      if (timeText && timeText.includes('-')) {
        const [start, end] = timeText.split('-').map(s => s.trim());
        start_time = start;
        end_time = end;
      }
      let location = $(tds[12]).find('strong').first().text().trim();
      if (!location) location = $(tds[12]).text().trim();
      courses.push({
        crn,
        subject,
        title,
        hours,
        instructor,
        days,
        start_time,
        end_time,
        location,
        seats_available
      });
    });
  });
  return courses;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const term_code = '202601';
  const campus_code = '10'; // Statesboro
  const subjects = await getSubjectOptions(term_code);
  const batchSize = 10;
  let allCourses = [];
  for (let i = 0; i < subjects.length; i += batchSize) {
    const batch = subjects.slice(i, i + batchSize);
    for (const subj of batch) {
      const [subject_code] = subj.split(' ');
      try {
        const html = await fetchCoursesForSubject(term_code, subject_code, campus_code);
        const courses = parseCoursesFromHtml(html, subject_code);
        allCourses.push(...courses);
        console.log(`Fetched ${courses.length} courses for subject ${subject_code}`);
      } catch (err) {
        console.error(`Error fetching courses for subject ${subject_code}:`, err.message);
      }
    }
    if (i + batchSize < subjects.length) {
      console.log('Waiting 5 seconds before next batch...');
      await sleep(5000);
    }
  }
  await csvWriter.writeRecords(allCourses);
  console.log('Done. Wrote', allCourses.length, 'courses to courses.csv');
}

main();

main();

async function fetchCourses(formData) {
  const url = 'https://coursesearch.georgiasouthern.edu/search/';
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; EagleExplorer/1.0)'
  };
  // Use qs to encode arrays as repeated keys 
  const response = await axios.post(url, qs.stringify(formData, { arrayFormat: 'repeat' }), { headers });
  return response.data;
}


function parseCoursesFromHtml(html) {
  const $ = cheerio.load(html);
  const rows = $('#results-table tbody tr');
  const courses = [];
  rows.each((i, row) => {
    const tds = $(row).find('td');
    if (tds.length === 0) return;
    const crn = $(tds[0]).text().trim();
    const subject = $(tds[1]).text().trim();
    const title = $(tds[2]).text().trim();
    const hours = $(tds[3]).text().trim();
    const instructor = $(tds[4]).text().replace(/\s+/g, ' ').trim();
    // Seats available: 16th td (index 15), parse (x / y)
    let seats_available = '';
    const seatsCell = $(tds[15]).html() || '';
    const match = seatsCell.match(/\((\d+)\s*\/\s*(\d+)\)/);
    if (match) {
      const enrolled = parseInt(match[1], 10);
      const max = parseInt(match[2], 10);
      seats_available = (max - enrolled).toString();
    }
    // Meeting patterns: inside the 10th td (index 9)
    const timeCell = $(tds[9]);
    timeCell.find('table.table-course-days').each((_, mtgTable) => {
      // Days: look for <td class="day active">X</td>
      let days = '';
      $(mtgTable).find('td.day').each((_, dtd) => {
        if ($(dtd).hasClass('active')) days += $(dtd).text().trim();
      });
      // Time: get the next sibling span.break after the table
      let start_time = '', end_time = '';
      const timeText = $(mtgTable).parent().find('span.break').first().text().trim();
      if (timeText && timeText.includes('-')) {
        const [start, end] = timeText.split('-').map(s => s.trim());
        start_time = start;
        end_time = end;
      }
      // Location: 13th td (index 12), strong tag text
      let location = $(tds[12]).find('strong').first().text().trim();
      if (!location) location = $(tds[12]).text().trim();
      courses.push({
        crn,
        subject,
        title,
        hours,
        instructor,
        days,
        start_time,
        end_time,
        location,
        seats_available
      });
    });
  });
  return courses;
}

// Only run the subject-fetching main (no course queries)
